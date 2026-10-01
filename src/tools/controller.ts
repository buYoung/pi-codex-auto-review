import { randomUUID } from 'node:crypto';
import { createBashToolDefinition, withFileMutationQueue, type BashToolOptions, type BashOperations, type ExtensionContext, type ToolDefinition, type ToolCallEvent, type ReadToolOptions } from '@earendil-works/pi-coding-agent';
import { pathToFileURL } from 'node:url';
import { createAction, canonicalJson, digest, GuardError, TOOL_NAMES, type ActionSource, type GuardAction, type Json, type PermissionProfile, type WorkerJob, type ExecutionOptions } from '../contracts.js';
import { PolicyEngine, canonicalPath, resolveToolPath, type GuardSettings } from '../policy/index.js';
import { ApprovalManager, type ApprovalUI } from '../approvals.js';
import { PiReviewProvider, type ReviewProvider } from '../reviewer.js';
import { AuditLog } from '../audit.js';
import { type SandboxExecutor } from '../sandbox/executor.js';
import { workloadEnvironment } from '../sandbox/config.js';

export class GuardController {
  readonly policy: PolicyEngine;
  readonly approvals: ApprovalManager;
  private sources = new Map<string, ActionSource>();
  private ownedOperations = new WeakSet<BashOperations>();
  private stopped = new AbortController();
  private sessionId = 'not-started';
  private isReady = false;
  private trustedAuthorization = '';
  constructor(readonly options: { profile: PermissionProfile; settings: GuardSettings; executor: SandboxExecutor; approvals: ApprovalManager; audit: AuditLog; provider?: ReviewProvider; shellPath?: string }) {
    this.policy = new PolicyEngine(options.settings, options.profile);
    this.approvals = options.approvals;
  }
  async initialize(cwd: string): Promise<void> {
    await this.approvals.initialize();
    await this.options.executor.qualify(this.options.profile, cwd);
    this.isReady = true;
  }
  assertReady(): void { if (!this.isReady || this.stopped.signal.aborted) throw new GuardError('GUARD_NOT_READY', 'Guard is not ready for execution'); }
  reset(sessionId: string): void {
    this.stopped.abort(new GuardError('SESSION_CHANGED', 'Session changed'));
    this.stopped = new AbortController();
    this.sessionId = sessionId;
    this.trustedAuthorization = '';
    this.approvals.reset(sessionId);
    this.sources.clear();
  }
  authorizeUser(text: string): void { this.trustedAuthorization = text; }
  noteCall(event: ToolCallEvent): void { this.sources.set(event.toolCallId, event.parentToolCallId ? 'nested' : 'model'); }
  completeCall(toolCallId: string): void { this.sources.delete(toolCallId); }
  async close(): Promise<void> {
    this.isReady = false; this.stopped.abort(); this.approvals.reset();
    await this.options.executor.close(); await this.approvals.settle();
  }
  private ui(context: ExtensionContext): ApprovalUI | undefined {
    if (!context.hasUI || (context.mode !== 'tui' && context.mode !== 'rpc')) return undefined;
    const scopes = { '한 번 허용': 'once', '이 세션에서 허용': 'session', '규칙으로 저장해 허용': 'persistent', '거부': 'deny' } as const;
    return { select: async (action, delta, options) => {
      const text = `도구: ${action.tool}\n작업 디렉터리: ${action.cwd}\n입력: ${canonicalJson(action.args)}\n추가 권한: ${canonicalJson(delta)}`;
      const selected = await context.ui.select(`실행 승인\n${text}`, Object.keys(scopes), { signal: options.signal, timeout: options.timeoutMs });
      return selected ? scopes[selected as keyof typeof scopes] : undefined;
    } };
  }
  private async admitAndExecute(action: GuardAction, job: WorkerJob, context: ExtensionContext, options: ExecutionOptions, trustedAuthorization = this.trustedAuthorization): Promise<Json> {
    this.assertReady();
    const signal = options.signal ? AbortSignal.any([options.signal, this.stopped.signal]) : this.stopped.signal;
    const policyDecision = await this.policy.evaluate(action);
    const admission = await this.approvals.admit(action, policyDecision, { provider: this.options.provider ?? new PiReviewProvider(context), ui: this.ui(context), trustedAuthorization, signal });
    if (!admission.isAllowed) throw new GuardError('PERMISSION_DENIED', admission.reason);
    signal.throwIfAborted();
    if (this.sessionId !== action.sessionId || await canonicalPath(context.cwd, context.cwd) !== action.cwd || this.policy.revision !== action.policyRevision) throw new GuardError('STALE_APPROVAL', 'Execution context changed after admission');
    const finalDecision = await this.policy.evaluate(action);
    if (finalDecision.kind === 'deny') throw new GuardError('PERMISSION_DENIED', finalDecision.reason);
    if(digest(finalDecision.delta)!==digest(policyDecision.delta))throw new GuardError('STALE_APPROVAL','Resolved permissions changed after admission');
    try {
      const result = await this.options.executor.execute(job, this.options.profile, admission.delta, { ...options, signal, timeoutSeconds: options.timeoutSeconds ?? this.options.settings.executionTimeoutSeconds });
      await this.options.audit.record(action, 'execution', 'settled');
      return result;
    } catch (error) { await this.options.audit.record(action, 'execution', 'failed'); throw error; }
    finally { this.completeCall(action.toolCallId); }
  }
  wrapTool(definition: ToolDefinition<any, any, any>, toolOptions?: ReadToolOptions | BashToolOptions): ToolDefinition<any, any, any> {
    const tool = definition.name as (typeof TOOL_NAMES)[number];
    if (!TOOL_NAMES.includes(tool)) throw new GuardError('UNKNOWN_LOCAL_TOOL', 'Cannot delegate unknown local tool');
    return { ...definition, execute: async (toolCallId, params, signal, onUpdate, context) => {
      this.assertReady();
      const cwd = await canonicalPath(context.cwd, context.cwd);
      if (tool === 'bash') {
        const delegate = createBashToolDefinition(cwd, { ...toolOptions as BashToolOptions, operations: { exec: async (command, finalCwd, options) => {
          const env = workloadEnvironment(options.env);
          const shellPath = (toolOptions as BashToolOptions)?.shellPath ?? '/bin/bash';
          const args = { command, shellPath, ...(options.timeout !== undefined ? { timeout: options.timeout } : {}), environment: env };
          const resolvedCwd = await canonicalPath(finalCwd, finalCwd);
          const action = createAction({ toolCallId, tool, args: JSON.parse(canonicalJson(args)), cwd: resolvedCwd, source: this.sources.get(toolCallId) ?? 'model', sessionId: context.sessionManager.getSessionId(), policyRevision: this.policy.revision }, this.options.profile);
          return await this.admitAndExecute(action, {kind:'shell',command,shellPath,cwd:resolvedCwd}, {...context,cwd:finalCwd}, {signal:options.signal,timeoutSeconds:options.timeout,env,onData:options.onData}) as unknown as {exitCode:number|null};
        } } });
        return delegate.execute(toolCallId, params as {command:string;timeout?:number}, signal, onUpdate, context);
      }
      const args = JSON.parse(canonicalJson(params)) as Record<string, Json>;
      const target = await resolveToolPath(typeof args.path==='string'?args.path:'.',cwd,tool==='read');
      args.path=pathToFileURL(target).href;
      const action = createAction({ toolCallId, tool, args, cwd, source: this.sources.get(toolCallId) ?? 'model', sessionId: context.sessionManager.getSessionId(), policyRevision: this.policy.revision }, this.options.profile);
      const options = tool === 'read' ? { ...(toolOptions as ReadToolOptions), ...(context.model?.inputLimits?.images?.resize ? { resizeOptions: context.model.inputLimits.images.resize } : {}) } : undefined;
      const execute=()=>this.admitAndExecute(action, { kind: 'tool', tool, args: action.args as Record<string, Json>, cwd, toolCallId, ...(options ? {options} : {}) }, context, { signal, onUpdate: onUpdate ? result => onUpdate(result as never) : undefined });
      const result = await (tool==='write'||tool==='edit'?withFileMutationQueue(await canonicalPath(target,cwd),execute):execute());
      return result as never;
    } };
  }
  userBashOperations(context: ExtensionContext, trustedCommand?: string): BashOperations {
    const operations: BashOperations = { exec: async (command, cwd, options) => {
      const resolvedCwd = await canonicalPath(cwd, cwd);
      const env = workloadEnvironment(options.env);
      const shellPath = this.options.shellPath ?? '/bin/bash';
      const action = createAction({ toolCallId: randomUUID(), tool: 'bash', source: 'user-bash', args: JSON.parse(canonicalJson({ command, shellPath, environment: env, ...(options.timeout !== undefined ? {timeout:options.timeout} : {}) })), cwd: resolvedCwd, sessionId: context.sessionManager.getSessionId(), policyRevision: this.policy.revision }, this.options.profile);
      return await this.admitAndExecute(action, { kind: 'shell', command, shellPath, cwd: resolvedCwd }, context, { signal: options.signal, timeoutSeconds: options.timeout, env: options.env, onData: options.onData }, trustedCommand === undefined ? this.trustedAuthorization : `The user directly requested this shell command: ${trustedCommand}`) as unknown as {exitCode:number|null};
    } };
    this.ownedOperations.add(operations);
    return operations;
  }
  isGuardedOperations(operations: BashOperations): boolean { return this.ownedOperations.has(operations); }
}
