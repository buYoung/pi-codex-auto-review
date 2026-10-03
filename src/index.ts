import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createBashToolDefinition, createReadToolDefinition, createEditToolDefinition, createWriteToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition, type ExtensionFactory, type BashToolOptions, type ReadToolOptions } from '@earendil-works/pi-coding-agent';
import { defaultProfile, loadSettings, validateSettings, type GuardSettings } from './policy/index.js';
import { ApprovalManager, FileGrantPersistence } from './approvals.js';
import { AuditLog } from './audit.js';
import { NativeExecutor, type SandboxExecutor } from './sandbox/executor.js';
import { GuardController } from './tools/controller.js';
import type { PermissionProfile } from './contracts.js';
import type { ReviewProvider } from './reviewer.js';
import { AUTHORIZATION_ENTRY, safeEvidence } from './review/context.js';
export interface GuardOptions {
  cwd?: string;
  agentDir?: string;
  settings?: Partial<GuardSettings>;
  settingsPath?: string;
  profile?: PermissionProfile;
  executor?: SandboxExecutor;
  provider?: ReviewProvider;
  bashOptions?: Omit<BashToolOptions,'operations'>;
  readOptions?: Omit<ReadToolOptions,'operations'>;
}
export function createGuardExtension(options: GuardOptions = {}) {
  let controller: GuardController | undefined;
  const factory: ExtensionFactory = async pi => {
    const cwd = options.cwd ?? process.cwd();
    const settings = options.settingsPath ? await loadSettings(options.settingsPath) : validateSettings(options.settings ?? {});
    const controlDir = join(options.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi', 'agent'), 'guard');
    const profile = options.profile ?? await defaultProfile(cwd, settings, [controlDir, ...(options.settingsPath ? [resolve(options.settingsPath)] : [])]);
    const audit = new AuditLog(join(controlDir, 'audit.jsonl'));
    const approvals = new ApprovalManager({ reviewTimeoutMs: settings.reviewTimeoutMs, approvalTimeoutMs: settings.approvalTimeoutMs, approvalPolicy: settings.approvalPolicy, approvalsReviewer: settings.approvalsReviewer, audit, persistence: new FileGrantPersistence(join(controlDir, 'grants.json')) });
    controller = new GuardController({ profile, settings, executor: options.executor ?? new NativeExecutor(), approvals, audit, provider: options.provider, shellPath: options.bashOptions?.shellPath });
    try { await controller.initialize(cwd); } catch (error) { await controller.close(); controller = undefined; throw error; }
    const guard = controller;
    pi.registerTool(guard.wrapTool(createBashToolDefinition(cwd, options.bashOptions), options.bashOptions));
    pi.registerTool(guard.wrapTool(createReadToolDefinition(cwd, options.readOptions), options.readOptions));
    for (const create of [createEditToolDefinition, createWriteToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition]) pi.registerTool(guard.wrapTool(create(cwd)));
    pi.on('session_start', (_event, context) => { guard.assertReady(); guard.reset(context.sessionManager.getSessionId(), context.sessionManager); });
    pi.on('session_tree', (_event, context) => { guard.reset(context.sessionManager.getSessionId(), context.sessionManager); });
    pi.on('input', event => {
      if (event.source === 'interactive' || event.source === 'rpc') {
        guard.authorizeUser(event.text);
        pi.appendEntry(AUTHORIZATION_ENTRY, {text: safeEvidence(event.text), source: event.source});
      }
    });
    pi.on('before_agent_start', event => { guard.reviewContext.instructions(event); });
    pi.on('agent_start', () => { guard.reviewContext.startTurn(); });
    pi.on('message_end', event => { guard.reviewContext.message(event.message); });
    pi.on('tool_call', event => {
      guard.assertReady(); guard.noteCall(event);
      if (!['bash','read','edit','write','grep','find','ls','codemode',...settings.trustedTools].includes(event.toolName)) return { block:true, reason:'Unknown tool needs an explicit trusted adapter' };
    });
    pi.on('tool_result', event => {
      guard.reviewContext.toolResult({tool: event.toolName, content: event.content.filter(item => item.type === 'text').map(item => ({type:'text',text:item.text}))}, event.toolCallId);
      guard.completeCall(event.toolCallId);
    });
    pi.on('user_bash', (event, context) => { guard.assertReady(); return { operations: guard.userBashOperations(context, event.command) }; });
    pi.on('session_shutdown', async () => { await guard.close(); });
  };
  return { factory, assertReady() { if (!controller) throw new Error('pi-guard extension failed to load'); controller.assertReady(); return controller; } };
}
export default createGuardExtension().factory;
