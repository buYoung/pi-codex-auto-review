import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { canonicalJson, immutable, ruleDigest, GuardError, EMPTY_DELTA, type Grant, type GuardAction, type PermissionDelta, type PolicyDecision } from './contracts.js';
import { deadlineSignal, withSignal, type Clock } from './signals.js';
import { reviewAction, type ReviewProvider } from './reviewer.js';
import { AuditLog } from './audit.js';

export type ApprovalChoice = 'deny' | 'once' | 'session' | 'persistent';
export interface ApprovalUI { select(action: GuardAction, delta: PermissionDelta, options: { signal: AbortSignal; timeoutMs: number }): Promise<ApprovalChoice | undefined> }
export interface GrantPersistence { load(): Promise<Grant[]>; save(grants: readonly Grant[]): Promise<void> }
export class FileGrantPersistence implements GrantPersistence {
  constructor(readonly path: string) {}
  async load(): Promise<Grant[]> {
    try {
      const data: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      if (!Array.isArray(data) || data.some(value => !value || value.scope !== 'persistent' || typeof value.ruleDigest !== 'string' || typeof value.policyRevision !== 'string' || typeof value.permissionDigest !== 'string' || !value.delta || !['readPaths', 'writePaths', 'domains'].every(key => Array.isArray(value.delta[key]) && value.delta[key].every((x: unknown) => typeof x === 'string')))) throw new Error('Invalid persistent rules');
      return immutable(data as Grant[]);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw new GuardError('INVALID_GRANTS', 'Persistent rules could not be loaded', { cause: error }); }
  }
  async save(grants: readonly Grant[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temp = `${this.path}.${randomUUID()}.tmp`;
    try { await writeFile(temp, canonicalJson(grants) + '\n', { mode: 0o600, flag: 'wx' }); await rename(temp, this.path); }
    finally { await rm(temp, { force: true }); }
  }
}
export interface Admission { readonly isAllowed: boolean; readonly delta: PermissionDelta; readonly reason: string; readonly grant?: Grant }
export class ApprovalManager {
  private grants: Grant[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  private epoch = new AbortController();
  private sessionId?: string;
  constructor(readonly options: { reviewTimeoutMs: number; approvalTimeoutMs: number; audit: AuditLog; persistence?: GrantPersistence; clock?: Clock }) {}
  async initialize(): Promise<void> { this.grants = await this.options.persistence?.load() ?? []; }
  reset(sessionId?: string): void {
    this.epoch.abort(new GuardError('SESSION_CHANGED', 'Session changed'));
    this.epoch = new AbortController();
    this.sessionId = sessionId;
    this.grants = this.grants.filter(grant => grant.scope === 'persistent');
  }
  invalidate(): void { this.reset(this.sessionId); this.grants = []; }
  async admit(action: GuardAction, policy: PolicyDecision, context: { provider: ReviewProvider; ui?: ApprovalUI; trustedAuthorization: string; signal?: AbortSignal }): Promise<Admission> {
    this.sessionId ??= action.sessionId;
    const signal = context.signal ? AbortSignal.any([context.signal, this.epoch.signal]) : this.epoch.signal;
    const deny = (reason: string): Admission => ({ isAllowed: false, delta: EMPTY_DELTA, reason });
    if (signal.aborted || action.sessionId !== this.sessionId) return deny('Cancelled or stale session');
    if (policy.actionDigest !== action.digest || policy.kind === 'deny' || policy.isHardDeny) { await this.options.audit.record(action, 'policy', 'deny'); return deny(policy.reason); }
    if (policy.kind === 'allow') { await this.options.audit.record(action, 'policy', 'allow'); return { isAllowed: true, delta: EMPTY_DELTA, reason: policy.reason }; }
    const cached = this.grants.find(grant => grant.ruleDigest === ruleDigest(action) && grant.permissionDigest === action.permissionDigest && grant.policyRevision === action.policyRevision && (grant.scope === 'persistent' || grant.sessionId === action.sessionId));
    if (cached) { await this.options.audit.record(action, 'grant', cached.scope); return { isAllowed: true, delta: cached.delta, grant: cached, reason: 'Bound rule authorized the action' }; }
    const review = await reviewAction({ action, policyDecision: policy, provider: context.provider, trustedAuthorization: context.trustedAuthorization, hasUI: Boolean(context.ui), signal, timeoutMs: this.options.reviewTimeoutMs, clock: this.options.clock });
    if (signal.aborted) return deny('Call cancelled');
    if (review.decision === 'deny') { await this.options.audit.record(action, 'review', 'deny'); return deny(review.reason); }
    if (review.decision === 'allow') { await this.options.audit.record(action, 'review', 'allow'); return { isAllowed: true, delta: EMPTY_DELTA, reason: review.reason }; }
    if (!context.ui) return deny('Approval UI unavailable');
    const ui = context.ui;
    // Queue all dialogs, including compensated persistence, until this decision settles.
    const pending = this.tail.then(async (): Promise<Admission> => {
      if (signal.aborted) return deny('Queued approval cancelled');
      const deadline = deadlineSignal(signal, this.options.approvalTimeoutMs, this.options.clock);
      try {
        const choice = await withSignal(ui.select(action, policy.delta, { signal: deadline.signal, timeoutMs: this.options.approvalTimeoutMs }), deadline.signal);
        deadline.signal.throwIfAborted();
        if (!choice || choice === 'deny') return deny('User denied the action');
        if (!['once', 'session', 'persistent'].includes(choice)) return deny('Invalid approval scope');
        if (choice === 'persistent' && !this.options.persistence) return deny('Persistent rules are unavailable');
        const grant: Grant = immutable({ id: randomUUID(), scope: choice, actionDigest: action.digest, ruleDigest: ruleDigest(action), sessionId: action.sessionId, policyRevision: action.policyRevision, permissionDigest: action.permissionDigest, delta: policy.delta });
        if (choice === 'persistent') {
          const prior = this.grants.filter(item => item.scope === 'persistent');
          await this.options.persistence!.save([...prior, grant]);
          if (deadline.signal.aborted) { await this.options.persistence!.save(prior); return deny('Persistent approval cancelled and reverted'); }
        }
        deadline.signal.throwIfAborted();
        if (choice !== 'once') this.grants.push(grant);
        await this.options.audit.record(action, 'approval', choice);
        // Once-grants are consumed at logical admission; helpers share this returned immutable profile.
        return { isAllowed: true, delta: grant.delta, grant, reason: 'User authorized the bound action' };
      } catch { await this.options.audit.record(action, 'approval', 'cancelled-or-failed'); return deny('Approval cancelled or failed'); }
      finally { deadline.dispose(); }
    });
    this.tail = pending.then(() => {}, () => {});
    return pending;
  }
  async settle(): Promise<void> { await this.tail; await this.options.audit.flush(); }
}
