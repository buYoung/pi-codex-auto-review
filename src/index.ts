import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createBashToolDefinition, createReadToolDefinition, createEditToolDefinition, createWriteToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition, type ExtensionFactory, type BashToolOptions, type ReadToolOptions, type McpExtensionOptions } from '@earendil-works/pi-coding-agent';
import { defaultProfile, type GuardSettings } from './policy/index.js';
import { ApprovalManager, FileGrantPersistence } from './approvals.js';
import { AuditLog } from './audit.js';
import { PiExecutor, type ToolExecutor } from './tools/executor.js';
import { GuardController } from './tools/controller.js';
import type { PermissionProfile } from './contracts.js';
import type { ReviewProvider } from './reviewer.js';
import { AUTHORIZATION_ENTRY, REVIEW_CONTEXT_ENTRY, safeEvidence } from './review/context.js';
import { createProfile } from './contracts.js';
import { createGuardedMcpExtension, type McpToolPolicies } from './tools/mcp.js';
import { ApprovalSettingsStore } from './approval-settings.js';
import { registerApprovalCommands } from './approval-commands.js';
export interface GuardOptions {
  cwd?: string;
  agentDir?: string;
  settings?: Partial<GuardSettings>;
  settingsPath?: string;
  profile?: PermissionProfile;
  executor?: ToolExecutor;
  provider?: ReviewProvider;
  bashOptions?: Omit<BashToolOptions,'operations'>;
  readOptions?: Omit<ReadToolOptions,'operations'>;
  /** Trusted code directories are protected against model writes, including imported siblings. */
  trustedExtensionPaths?: readonly string[];
  mcp?: McpExtensionOptions | false;
  mcpToolPolicies?: McpToolPolicies;
}
export function createGuardExtension(options: GuardOptions = {}) {
  let controller: GuardController | undefined;
  const factory: ExtensionFactory = async pi => {
    const previous = controller;
    controller = undefined;
    await previous?.close();
    const cwd = options.cwd ?? process.cwd();
    const agentDir = options.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi', 'agent');
    const controlDir = join(agentDir, 'guard');
    const settingsPath = options.settingsPath ? resolve(options.settingsPath) : join(controlDir,'settings.json');
    const settingsStore = new ApprovalSettingsStore(settingsPath,options.settings,Boolean(options.settingsPath));
    const settings = await settingsStore.load();
    const baseline = await defaultProfile(cwd, settings, [agentDir,settingsPath], options.trustedExtensionPaths);
    const profile = options.profile ? createProfile({...options.profile,
      denyRead:[...new Set([...options.profile.denyRead,...baseline.denyRead])],
      denyWrite:[...new Set([...options.profile.denyWrite,...baseline.denyWrite])],
    }) : baseline;
    const audit = new AuditLog(join(controlDir, 'audit.jsonl'));
    const approvals = new ApprovalManager({ reviewTimeoutMs: settings.reviewTimeoutMs, approvalTimeoutMs: settings.approvalTimeoutMs, approvalPolicy: settings.approvalPolicy, approvalsReviewer: settings.approvalsReviewer, audit, persistence: new FileGrantPersistence(join(controlDir, 'grants.json')) });
    controller = new GuardController({ profile, settings, executor: options.executor ?? new PiExecutor(), approvals, audit, provider: options.provider, shellPath: options.bashOptions?.shellPath,
      persistContext:item=>pi.appendEntry(REVIEW_CONTEXT_ENTRY,item),
    });
    try { await controller.initialize(cwd); } catch (error) { await controller.close(); controller = undefined; throw error; }
    const guard = controller;
    pi.registerTool(guard.wrapTool(createBashToolDefinition(cwd, options.bashOptions), options.bashOptions));
    pi.registerTool(guard.wrapTool(createReadToolDefinition(cwd, options.readOptions), options.readOptions));
    for (const create of [createEditToolDefinition, createWriteToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition]) pi.registerTool(guard.wrapTool(create(cwd)));
    pi.on('session_start', (_event, context) => { guard.assertReady(); guard.reset(context.sessionManager.getSessionId(), context.sessionManager); });
    pi.on('session_tree', (_event, context) => { guard.reset(context.sessionManager.getSessionId(), context.sessionManager); });
    pi.on('session_compact', event => { guard.reviewContext.summary(event.compactionEntry.summary,event.compactionEntry.id); });
    pi.on('input', event => {
      if (event.source === 'interactive' || event.source === 'rpc') {
        guard.authorizeUser(event.text);
        pi.appendEntry(AUTHORIZATION_ENTRY, {text: safeEvidence(event.text), source: event.source});
      }
    });
    pi.on('before_agent_start', event => { guard.reviewContext.instructions(event); });
    pi.on('agent_start', (_event,context) => { guard.startTurn(context); });
    pi.on('message_end', event => { guard.reviewContext.message(event.message); });
    pi.on('tool_call', event => {
      guard.assertReady(); guard.noteCall(event);
      if (!['bash','read','edit','write','grep','find','ls','codemode',...guard.options.settings.trustedTools].includes(event.toolName) && !guard.isExternalTool(event.toolName)) return { block:true, reason:'Unknown tool needs an explicit trusted adapter' };
    });
    pi.on('tool_execution_end', event => {
      const result = event.result ?? {}, callIdentity = guard.reviewContext.callIdentity(event.toolCallId);
      guard.reviewContext.toolResult({tool:event.toolName,toolCallId:event.toolCallId,callIdentity,isError:event.isError,
        content:(result.content ?? []).filter((item: {type:string}) => item.type === 'text').map((item: {text:string}) => ({type:'text',text:item.text})),
        ...(result.structuredContent !== undefined ? {structuredContent:JSON.parse(JSON.stringify(result.structuredContent))} : {}),
        ...(event.parentToolCallId ? {parentToolCallId:event.parentToolCallId,parentCallIdentity:guard.reviewContext.callIdentity(event.parentToolCallId)} : {}),
      },callIdentity);
      guard.completeCall(event.toolCallId);
    });
    pi.on('user_bash', (event, context) => { guard.assertReady(); return { operations: guard.userBashOperations(context, event.command) }; });
    pi.on('session_shutdown', async () => { await guard.close(); });
    registerApprovalCommands(pi,guard,settingsStore);
    if (options.mcp !== false) {
      try {
        const mcp = await createGuardedMcpExtension(agentDir, () => guard, options.mcp, options.mcpToolPolicies);
        await (typeof mcp === 'function' ? mcp : mcp.factory)(pi);
      } catch (error) { await guard.close(); controller = undefined; throw error; }
    }
  };
  return { factory, assertReady() { if (!controller) throw new Error('pi-codex-auto-review extension failed to load'); controller.assertReady(); return controller; } };
}
export default createGuardExtension().factory;
