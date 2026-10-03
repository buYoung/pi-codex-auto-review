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
import { canonicalJson, GuardError } from './contracts.js';
import { redact } from './audit.js';
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
    const agentDir = options.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi', 'agent');
    const controlDir = join(agentDir, 'guard');
    const profile = options.profile ?? await defaultProfile(cwd, settings, [agentDir, ...(options.settingsPath ? [resolve(options.settingsPath)] : [])]);
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
    pi.on('agent_start', () => { guard.startTurn(); });
    pi.on('message_end', event => { guard.reviewContext.message(event.message); });
    pi.on('tool_call', event => {
      guard.assertReady(); guard.noteCall(event);
      if (!['bash','read','edit','write','grep','find','ls','codemode',...settings.trustedTools].includes(event.toolName) && !guard.isExternalTool(event.toolName)) return { block:true, reason:'Unknown tool needs an explicit trusted adapter' };
    });
    pi.on('tool_result', event => {
      guard.reviewContext.toolResult({tool: event.toolName, content: event.content.filter(item => item.type === 'text').map(item => ({type:'text',text:item.text}))}, event.toolCallId);
      guard.completeCall(event.toolCallId);
    });
    pi.on('user_bash', (event, context) => { guard.assertReady(); return { operations: guard.userBashOperations(context, event.command) }; });
    pi.on('session_shutdown', async () => { await guard.close(); });
    pi.registerCommand('approve', {description:'최근 자동 검토 거부 중 정확한 작업 하나를 한 번 재검토합니다.',handler:async(args,context)=>{
      await context.waitForIdle();
      const denials=guard.approvals.lifecycle.recentDenials;
      if (!denials.length) {context.ui.notify('재검토할 최근 거부가 없습니다.','info');return;}
      let id=args.trim();
      if (!id) {
        if (!context.hasUI) throw new GuardError('APPROVAL_UI_UNAVAILABLE','Use /approve <denial-id> to select one exact recent denial');
        const choices=denials.map(item=>`${item.id} | ${item.action.tool} | ${redact(canonicalJson(item.action.args))} | ${item.assessment.rationale}`);
        const selected=await context.ui.select('자동 검토 거부 — 한 번 재검토할 작업 선택',choices);
        if (!selected) return; id=denials[choices.indexOf(selected)]!.id;
      }
      const retry=await guard.authorizeRetry(id,context);
      if (retry.denial.action.source==='user-bash' && !retry.denial.action.args.networkDestination) {
        await guard.retryUserBash(retry.denial.action,context);context.ui.notify('선택한 명령을 다시 검토하고 실행했습니다.','info');return;
      }
      const nested=retry.denial.action.source==='nested'?'Invoke only this exact tool through codemode to preserve the original nested source.':'Retry only this exact tool action.';
      pi.sendUserMessage(`${nested}\nTool: ${retry.denial.action.tool}\nArguments: ${canonicalJson(retry.args)}\nThe user selected denial ${id} for one retry. The controller holds a one-use exact-action marker; automatic review and policy still apply. Do not repeat unrelated earlier side effects.`,{expandPromptTemplates:false});
    }});
  };
  return { factory, assertReady() { if (!controller) throw new Error('pi-codex-auto-review extension failed to load'); controller.assertReady(); return controller; } };
}
export default createGuardExtension().factory;
