import { randomUUID } from 'node:crypto';
import { createBashToolDefinition, withFileMutationQueue, type BashToolOptions, type BashOperations, type ExtensionContext, type ToolDefinition, type ToolCallEvent, type ReadToolOptions } from '@earendil-works/pi-coding-agent';
import { pathToFileURL } from 'node:url';
import { createAction, canonicalJson, digest, decision, GuardError, TOOL_NAMES, type ActionSource, type GuardAction, type Json, type PermissionProfile, type WorkerJob, type ExecutionOptions, type PolicyDecision } from '../contracts.js';
import { PolicyEngine, canonicalPath, resolveToolPath, type GuardSettings } from '../policy/index.js';
import { ApprovalManager, type ApprovalUI, type Admission } from '../approvals.js';
import { PiReviewProvider, type ReviewProvider } from '../reviewer.js';
import { AuditLog, redact } from '../audit.js';
import { type SandboxExecutor } from '../sandbox/executor.js';
import { workloadEnvironment } from '../sandbox/config.js';
import { ReviewContextStore, safeEvidence } from '../review/context.js';
import { NativeInvestigation } from '../review/investigation.js';
import { matchesDomain } from '../policy/domains.js';
import { reviewFeedback } from '../review/lifecycle.js';

export class GuardController {
  readonly policy: PolicyEngine;
  readonly approvals: ApprovalManager;
  private sources = new Map<string, ActionSource>();
  private ownedOperations = new WeakSet<BashOperations>();
  private stopped = new AbortController();
  private sessionId = 'not-started';
  private isReady = false;
  readonly reviewContext = new ReviewContextStore();
  private activeReviews = new Set<string>();
  private retryArguments = new Map<string, Readonly<Record<string, Json>>>();
  constructor(readonly options: { profile: PermissionProfile; settings: GuardSettings; executor: SandboxExecutor; approvals: ApprovalManager; audit: AuditLog; provider?: ReviewProvider; shellPath?: string }) {
    this.policy = new PolicyEngine(options.settings, options.profile);
    this.approvals = options.approvals;
  }
  async initialize(cwd: string): Promise<void> {
    await this.policy.initialize(cwd);
    await this.approvals.initialize();
    await this.options.executor.qualify(this.options.profile, cwd);
    this.isReady = true;
  }
  assertReady(): void { if (!this.isReady || this.stopped.signal.aborted) throw new GuardError('GUARD_NOT_READY', 'Guard is not ready for execution'); }
  isBoundToSession(sessionId: string): boolean { return this.sessionId === sessionId && !this.stopped.signal.aborted; }
  reset(sessionId: string, manager?: ExtensionContext['sessionManager']): void {
    this.stopped.abort(new GuardError('SESSION_CHANGED', 'Session changed'));
    this.stopped = new AbortController();
    this.sessionId = sessionId;
    this.reviewContext.reset(sessionId, manager);
    this.approvals.reset(sessionId);
    this.sources.clear();
    this.activeReviews.clear(); this.retryArguments.clear();
  }
  startTurn(): void { this.reviewContext.startTurn(); this.approvals.lifecycle.startTurn(); this.activeReviews.clear(); }
  async authorizeRetry(id: string, context: ExtensionContext) {
    this.assertReady();
    const denial = this.approvals.lifecycle.authorizeRetry(id, {sessionId:context.sessionManager.getSessionId(),contextId:this.reviewContext.identity,cwd:await canonicalPath(context.cwd,context.cwd),policyRevision:this.policy.revision,permissionDigest:digest(this.options.profile)});
    const args = this.retryArguments.get(id) ?? denial.action.args;
    this.retryArguments.delete(id);
    return {denial, args};
  }
  async retryUserBash(action: GuardAction, context: ExtensionContext): Promise<void> {
    this.startTurn();
    const next = createAction({...action,toolCallId:randomUUID()},this.options.profile);
    const command=String(next.args.command),shellPath=String(next.args.shellPath??'/bin/bash');
    await this.admitAndExecute(next,{kind:'shell',command,shellPath,cwd:next.cwd},context,{timeoutSeconds:typeof next.args.timeout==='number'?next.args.timeout:undefined,env:next.args.environment as NodeJS.ProcessEnv});
  }
  authorizeUser(text: string): void { this.reviewContext.authorize(text); this.approvals.lifecycle.invalidateRetries(); }
  noteCall(event: ToolCallEvent): void {
    this.sources.set(event.toolCallId, event.parentToolCallId ? 'nested' : 'model');
    this.reviewContext.toolCall({tool: event.toolName, args: JSON.parse(canonicalJson(event.input))}, event.toolCallId);
  }
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
      if (selected) this.reviewContext.confirm({actionDigest: action.digest, choice: selected});
      return selected ? scopes[selected as keyof typeof scopes] : undefined;
    } };
  }
  private async requestAdmission(action: GuardAction, policyDecision: PolicyDecision, context: ExtensionContext, signal: AbortSignal, trustedAuthorization = '') {
    let reviewContext = policyDecision.kind === 'ask' ? this.reviewContext.snapshot(this.options.settings.reviewContextChars, canonicalJson(action).length + canonicalJson(policyDecision.delta).length + 1000) : undefined;
    if (reviewContext && trustedAuthorization) {
      const data = {...reviewContext, items: [...reviewContext.items, {id: 'direct-user-bash', source: 'user' as const, trust: 'authorization' as const, content: safeEvidence(trustedAuthorization)}]};
      reviewContext = {...data, digest: digest(data)};
    }
    const turnIdentity = this.reviewContext.turnIdentity;
    return this.approvals.admit(action, policyDecision, {
      provider: this.options.provider ?? new PiReviewProvider(context, this.options.settings, new NativeInvestigation(this.options.executor, this.options.profile, action.cwd)), ui: this.ui(context), trustedAuthorization, signal, reviewContext, settings: this.options.settings,
      onReviewStart: () => {this.activeReviews.add(action.digest);if(context.hasUI)context.ui.setStatus('auto-review',`자동 검토 중 (${this.activeReviews.size})`);},
      onReviewResult: result => {
        this.activeReviews.delete(action.digest);
        if (turnIdentity !== this.reviewContext.turnIdentity || !context.hasUI) return;
        const labels = {'approved':'승인','denied':'거부','timed-out':'시간 초과','aborted':'취소','failed':'실패'};
        context.ui.setStatus('auto-review',this.activeReviews.size ? `자동 검토 중 (${this.activeReviews.size})` : result ? `자동 검토: ${labels[result.status]}` : undefined);
        if (result && result.status !== 'approved' && result.status !== 'aborted') context.ui.notify(`자동 검토 ${labels[result.status]}: ${redact('assessment' in result ? result.assessment.rationale : result.reason).slice(0,1000)}`,'warning');
      },
      onInterrupt: () => {if(context.hasUI)context.ui.notify('자동 검토의 반복 거부 한도에 도달해 현재 작업을 중단합니다.','warning');context.abort?.();},
    });
  }
  private denied(admission: Admission, retryArguments?: Readonly<Record<string, Json>>): GuardError {
    if (admission.denialId && retryArguments) this.retryArguments.set(admission.denialId, retryArguments);
    const retained = new Set(this.approvals.lifecycle.recentDenials.map(item => item.id));
    for (const id of this.retryArguments.keys()) if (!retained.has(id)) this.retryArguments.delete(id);
    if (admission.review) {
      const feedback = reviewFeedback(admission.review);
      return new GuardError(feedback.code, `[${feedback.code}] ${feedback.message}${admission.denialId ? `\nRecent denial: ${admission.denialId}. The user may request /approve for one exact reviewed retry.` : ''}`);
    }
    return new GuardError('PERMISSION_DENIED',admission.reason);
  }
  private async admitAndExecute(action: GuardAction, job: WorkerJob, context: ExtensionContext, options: ExecutionOptions, trustedAuthorization = '', retryArguments?: Readonly<Record<string, Json>>): Promise<Json> {
    this.assertReady();
    const signal = AbortSignal.any([this.stopped.signal,this.approvals.lifecycle.signal,...(options.signal ? [options.signal] : [])]);
    const authorizationVersion = this.reviewContext.scopeVersion;
    const policyDecision = await this.policy.evaluate(action);
    const admission = await this.requestAdmission(action, policyDecision, context, signal, trustedAuthorization);
    if (!admission.isAllowed) throw this.denied(admission,retryArguments);
    signal.throwIfAborted();
    if (this.reviewContext.scopeVersion !== authorizationVersion) throw new GuardError('STALE_AUTHORIZATION', 'User authorization changed during review; request a fresh review');
    if (this.sessionId !== action.sessionId || await canonicalPath(context.cwd, context.cwd) !== action.cwd || this.policy.revision !== action.policyRevision) throw new GuardError('STALE_APPROVAL', 'Execution context changed after admission');
    const finalDecision = await this.policy.evaluate(action);
    if (finalDecision.kind === 'deny') throw new GuardError('PERMISSION_DENIED', finalDecision.reason);
    if(digest(finalDecision.delta)!==digest(policyDecision.delta))throw new GuardError('STALE_APPROVAL','Resolved permissions changed after admission');
    if (digest(finalDecision.authority ?? null) !== digest(policyDecision.authority ?? null)) throw new GuardError('STALE_APPROVAL', 'Execution authority changed after admission');
    try {
      let networkDenial: GuardError | undefined;
      const result = await this.options.executor.execute(job, this.options.profile, admission.delta, {
        ...options, signal, authority: admission.authority, timeoutSeconds: options.timeoutSeconds ?? this.options.settings.executionTimeoutSeconds,
        onNetworkRequest: async (destination, networkSignal) => {
          if (networkSignal.aborted || action.sessionId !== this.sessionId || this.options.profile.deniedDomains.some(pattern => matchesDomain(destination.host, pattern))) return false;
          const networkAction = createAction({toolCallId: `${action.toolCallId}:network:${randomUUID()}`, tool: action.tool, args: {...action.args, networkDestination: {...destination}, originatingActionDigest: action.digest}, cwd: action.cwd, source: action.source, sessionId: action.sessionId, policyRevision: action.policyRevision}, this.options.profile);
          const networkPolicy = decision(networkAction, 'ask', 'Runtime network request from the exact originating command', {readPaths:[],writePaths:[],domains:[destination.host]});
          const networkAuthorizationVersion = this.reviewContext.scopeVersion;
          const reviewed = await this.requestAdmission(networkAction, networkPolicy, context, networkSignal, trustedAuthorization);
          if (!reviewed.isAllowed) networkDenial = this.denied(reviewed,retryArguments);
          if (networkSignal.aborted || this.reviewContext.scopeVersion !== networkAuthorizationVersion || this.sessionId !== action.sessionId || this.policy.revision !== action.policyRevision || await canonicalPath(context.cwd, context.cwd) !== action.cwd) return false;
          return reviewed.isAllowed;
        },
      });
      if (networkDenial) throw networkDenial;
      await this.options.audit.record(action, 'execution', 'settled');
      return result;
    } catch (error) { await this.options.audit.record(action, 'execution', 'failed'); throw error; }
    finally { this.completeCall(action.toolCallId); }
  }
  wrapTool(definition: ToolDefinition<any, any, any>, toolOptions?: ReadToolOptions | BashToolOptions): ToolDefinition<any, any, any> {
    const tool = definition.name as (typeof TOOL_NAMES)[number];
    if (!TOOL_NAMES.includes(tool)) throw new GuardError('UNKNOWN_LOCAL_TOOL', 'Cannot delegate unknown local tool');
    const parameters = tool === 'bash' ? {...definition.parameters, properties: {...definition.parameters.properties,
      sandbox_permissions: {type:'string',enum:['use_default','require_escalated'],description:'Request review before this exact command crosses the native sandbox boundary.'},
      additional_permissions: {type:'object',properties:{readPaths:{type:'array',items:{type:'string'}},writePaths:{type:'array',items:{type:'string'}},domains:{type:'array',items:{type:'string'}}},additionalProperties:false,description:'Narrow permission increase for this invocation; omit for an explicitly reviewed full command.'},
      justification: {type:'string',description:'Explain the boundary crossing for review.'},
    }} : definition.parameters;
    return { ...definition, parameters, execute: async (toolCallId, params, signal, onUpdate, context) => {
      this.assertReady();
      const cwd = await canonicalPath(context.cwd, context.cwd);
      if (tool === 'bash') {
        const input = params as Record<string, Json>;
        const requested = JSON.parse(canonicalJson(Object.fromEntries(['sandbox_permissions','additional_permissions','justification'].filter(key => input[key] !== undefined).map(key => [key, input[key]])))) as Record<string, Json>;
        const delegate = createBashToolDefinition(cwd, { ...toolOptions as BashToolOptions, operations: { exec: async (command, finalCwd, options) => {
          const env = workloadEnvironment(options.env);
          const shellPath = (toolOptions as BashToolOptions)?.shellPath ?? '/bin/bash';
          const args = { command, shellPath, ...(options.timeout !== undefined ? { timeout: options.timeout } : {}), environment: env, ...requested };
          const resolvedCwd = await canonicalPath(finalCwd, finalCwd);
          const action = createAction({ toolCallId, tool, args: JSON.parse(canonicalJson(args)), cwd: resolvedCwd, source: this.sources.get(toolCallId) ?? 'model', sessionId: context.sessionManager.getSessionId(), policyRevision: this.policy.revision }, this.options.profile);
          return await this.admitAndExecute(action, {kind:'shell',command,shellPath,cwd:resolvedCwd}, {...context,cwd:finalCwd}, {signal:options.signal,timeoutSeconds:options.timeout,env,onData:options.onData},'',JSON.parse(canonicalJson(params))) as unknown as {exitCode:number|null};
        } } });
        return delegate.execute(toolCallId, params as {command:string;timeout?:number}, signal, onUpdate, context);
      }
      const args = JSON.parse(canonicalJson(params)) as Record<string, Json>;
      const target = await resolveToolPath(typeof args.path==='string'?args.path:'.',cwd,tool==='read');
      args.path=pathToFileURL(target).href;
      const action = createAction({ toolCallId, tool, args, cwd, source: this.sources.get(toolCallId) ?? 'model', sessionId: context.sessionManager.getSessionId(), policyRevision: this.policy.revision }, this.options.profile);
      const options = tool === 'read' ? { ...(toolOptions as ReadToolOptions), ...(context.model?.inputLimits?.images?.resize ? { resizeOptions: context.model.inputLimits.images.resize } : {}) } : undefined;
      const execute=()=>this.admitAndExecute(action, { kind: 'tool', tool, args: action.args as Record<string, Json>, cwd, toolCallId, ...(options ? {options} : {}) }, context, { signal, onUpdate: onUpdate ? result => onUpdate(result as never) : undefined },'',JSON.parse(canonicalJson(params)));
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
      return await this.admitAndExecute(action, { kind: 'shell', command, shellPath, cwd: resolvedCwd }, context, { signal: options.signal, timeoutSeconds: options.timeout, env: options.env, onData: options.onData }, trustedCommand === undefined ? '' : `The user directly requested this shell command: ${trustedCommand}`,{command:trustedCommand??command}) as unknown as {exitCode:number|null};
    } };
    this.ownedOperations.add(operations);
    return operations;
  }
  isGuardedOperations(operations: BashOperations): boolean { return this.ownedOperations.has(operations); }
}
