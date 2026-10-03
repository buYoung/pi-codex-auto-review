import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createMcpExtension, type ExtensionFactory, type InlineExtension, type McpExtensionOptions, type McpTransportFactory, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { canonicalJson, digest, GuardError, type Json } from '../contracts.js';
import type { GuardController } from './controller.js';
import { externalInvocations, type ExternalInvocation, type ExternalToolIdentity } from './external.js';

type Transport = ReturnType<McpTransportFactory>;
type Message = Parameters<Transport['send']>[0];
type Tool = ToolDefinition<any, any, any>;
export interface ExternalExtension {
  readonly extension: InlineExtension;
  /** Trusted adapter metadata; model arguments and tool-result text never supply this. */
  readonly identifyTool: (definition: Tool) => ExternalToolIdentity;
}
export function guardedExternalExtension(input: ExternalExtension, controller: () => GuardController): InlineExtension {
  const factory = typeof input.extension === 'function' ? input.extension : input.extension.factory;
  const guarded: ExtensionFactory = api => factory(new Proxy(api, {get(target, key, receiver) {
    if (key === 'registerTool') return (definition: Tool) => target.registerTool(controller().wrapExternalTool(definition, () => input.identifyTool(definition)));
    return Reflect.get(target, key, receiver);
  }}));
  return typeof input.extension === 'function' ? guarded : {...input.extension, factory:guarded};
}

interface CatalogEntry { readonly identity: ExternalToolIdentity; readonly label: string; readonly namespace: string }
export type McpToolPolicies = Readonly<Record<string, Partial<Pick<ExternalToolIdentity, 'approvalMode' | 'kind'>>>>;
function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function optionalText(value: unknown): string | undefined { return typeof value === 'string' && value.length ? value : undefined; }

function guardedTransport(base: Transport, server: string, registration: string, catalog: Map<string, CatalogEntry>, policies: McpToolPolicies): Transport {
  const pending = new Map<string | number, {method: string; callId?: string}>();
  const active = new Map<string, ExternalInvocation>();
  let generation = 0;
  const captureTools = (tools: unknown) => {
    if (!Array.isArray(tools)) throw new GuardError('INVALID_MCP_CATALOG', 'MCP tools/list did not return tools');
    for (const raw of tools) {
      const tool = record(raw), meta = record(tool._meta);
      if (typeof tool.name !== 'string' || !tool.name) throw new GuardError('INVALID_MCP_CATALOG', 'MCP tool has no identity');
      const override = policies[`${server}/${tool.name}`];
      const identity: ExternalToolIdentity = {
        kind:override?.kind ?? (server === 'node_repl' && tool.name === 'js' ? 'computer-use' : 'mcp'),
        server, tool:tool.name, registration:`${registration}:${generation}:${digest(JSON.parse(JSON.stringify(tool)))}`,
        ...(optionalText(meta.connector_id) ? {connectorId:meta.connector_id} : {}),
        ...(optionalText(meta.account) ? {account:meta.account} : {}),
        ...(override?.approvalMode ? {approvalMode:override.approvalMode} : {}),
        annotations:record(tool.annotations),
        requiresUserInput:meta.codex_requires_user_input === true,
        isSensitiveAction:meta.codex_sensitive_action === true,
        requiresStrictReview:meta.codex_strict_auto_review === true,
      };
      catalog.set(`${server}\0${tool.name}`, {identity, label:`${server}/${tool.name}`, namespace:`mcp__${server}`});
    }
  };
  const elicit = async (message: any) => {
    const params = record(message.params), meta = record(params._meta);
    const callId = optionalText(meta.callId), invocation = callId ? active.get(callId) : undefined;
    let isAllowed = false;
    // Arbitrary forms and URL authentication need an actual human-input UI. Never infer their fields.
    const schema = record(params.requestedSchema);
    const isApprovalForm = params.mode !== 'url' && schema.type === 'object' && Object.keys(record(schema.properties)).length === 0 && (!Array.isArray(schema.required) || schema.required.length === 0);
    if (invocation && !invocation.signal.aborted && isApprovalForm && meta.codex_approval_kind === 'mcp_tool_call' && typeof meta.tool_name === 'string' && meta.tool_params && typeof meta.tool_params === 'object' && !Array.isArray(meta.tool_params)) {
      const isComputerUse = invocation.identity.kind === 'computer-use';
      const isMatchingOuter = meta.tool_name === invocation.identity.tool && (meta.connector_id ?? undefined) === invocation.identity.connectorId;
      // Only a live Computer Use invocation can name a different nested action/connector.
      if (isComputerUse || isMatchingOuter) {
        const nested: ExternalToolIdentity = {
          ...invocation.identity, tool:meta.tool_name,
          ...(typeof meta.connector_id === 'string' ? {connectorId:meta.connector_id} : {}),
          requiresUserInput:meta.codex_requires_user_input === true,
          isSensitiveAction:meta.codex_sensitive_action === true,
          requiresStrictReview:invocation.identity.requiresStrictReview === true || meta.codex_strict_auto_review === true,
        };
        try {
          await invocation.checkCurrent();
          isAllowed = await invocation.approveNested(nested, JSON.parse(canonicalJson(isComputerUse ? meta.tool_params : invocation.arguments)));
          await invocation.checkCurrent();
          isAllowed &&= active.get(callId!) === invocation && !invocation.signal.aborted;
        } catch { isAllowed = false; }
      }
    }
    await base.send({jsonrpc:'2.0',id:message.id,result:{action:isAllowed ? 'accept' : 'decline', ...(isAllowed ? {content:{}} : {})}});
  };
  return new Proxy(base, {get(target, key) {
    if (key === 'send') return async (message: Message) => {
      const raw = message as any;
      if (raw.method && raw.id !== undefined) {
        const invocation = externalInvocations.getStore();
        if (raw.method === 'tools/call') {
          if (!invocation || invocation.identity.server !== server || invocation.identity.tool !== raw.params?.name) throw new GuardError('UNBOUND_MCP_CALL', 'MCP execution has no matching reviewed invocation');
          await invocation.checkCurrent();
          active.set(invocation.toolCallId, invocation);
          pending.set(raw.id, {method:raw.method,callId:invocation.toolCallId});
          return target.send({...raw,params:{...raw.params,_meta:{...record(raw.params?._meta),callId:invocation.toolCallId}}});
        }
        pending.set(raw.id,{method:raw.method});
        if (raw.method === 'tools/list' && !raw.params?.cursor) {
          generation++;
          for (const [name, item] of catalog) if (item.identity.server === server) catalog.delete(name);
        }
        if (raw.method === 'initialize') return target.send({...raw,params:{...raw.params,capabilities:{...record(raw.params?.capabilities),elicitation:{form:{}}}}});
      }
      return target.send(message);
    };
    if (key === 'onMessage') return (listener: Parameters<Transport['onMessage']>[0]) => target.onMessage(message => {
      const raw = message as any;
      if (raw.method === 'elicitation/create' && raw.id !== undefined) {
        void elicit(raw).catch(() => {}); return;
      }
      const request = !raw.method && raw.id !== undefined ? pending.get(raw.id) : undefined;
      if (request) {
        pending.delete(raw.id);
        if (request.callId) active.delete(request.callId);
        if (request.method === 'tools/list' && raw.result) {
          try { captureTools(raw.result.tools); } catch { listener({jsonrpc:'2.0',id:raw.id,error:{code:-32603,message:'Invalid MCP tool catalog'}}); return; }
        }
      }
      listener(message);
    });
    if (key === 'close') return async () => { active.clear(); pending.clear(); await target.close(); };
    const value = Reflect.get(target,key,target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
}

/**
 * Pi 0.99.1 exports the extension API but not its default transport/config helpers.
 * This small, version-qualified seam preserves the SDK's transport, config and OAuth implementation.
 */
export async function createGuardedMcpExtension(agentDir: string, controller: () => GuardController, options: McpExtensionOptions = {}, policies: McpToolPolicies = {}): Promise<InlineExtension> {
  const sdk = new URL('./', import.meta.resolve('@earendil-works/pi-coding-agent'));
  const [runtime, config, auth] = await Promise.all([
    import(new URL('extensions/mcp/runtime.js',sdk).href),
    import(new URL('extensions/mcp/config.js',sdk).href),
    import(new URL('core/auth-storage.js',sdk).href),
  ]);
  const catalog = new Map<string, CatalogEntry>(), registrations = new Map<string,string>();
  const transportFactory: McpTransportFactory = (entry, cwd, provider) => {
    const registration = digest({name:entry.name,source:entry.source,config:JSON.parse(JSON.stringify(entry.config)),connection:randomUUID()});
    registrations.set(entry.name,registration);
    return guardedTransport((options.createTransport ?? runtime.createDefaultTransport)(entry,cwd,provider),entry.name,registration,catalog,policies);
  };
  const factory = createMcpExtension({
    ...options, createTransport:transportFactory,
    loadConfig:options.loadConfig ?? (context => config.loadMcpConfig({agentDir,cwd:context.cwd,projectTrusted:context.isProjectTrusted()})),
    credentials:options.credentials ?? new runtime.McpOAuthCredentialStore(new auth.FileAuthStorageBackend(join(agentDir,'mcp-auth.json')),agentDir),
    logPath:options.logPath ?? join(agentDir,'mcp.log'),
  });
  return guardedExternalExtension({extension:{name:'guarded-mcp',factory},identifyTool:definition => {
    const entry = [...catalog.values()].find(item => item.label === definition.label && item.namespace === definition.namespace?.name);
    if (entry) return entry.identity;
    if (['list_mcp_resources','list_mcp_resource_templates','read_mcp_resource'].includes(definition.name)) return {kind:'mcp',server:'mcp-resources',tool:definition.name,registration:digest([...registrations]),annotations:{readOnlyHint:true}};
    throw new GuardError('UNBOUND_MCP_TOOL', 'Tool does not belong to the registered MCP catalog');
  }},controller);
}
