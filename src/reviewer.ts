import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { canonicalJson, digest, GuardError, immutable, type DecisionKind, type GuardAction, type PolicyDecision, type ReviewAssessment, type ReviewContext, type ReviewResult } from './contracts.js';
import { deadlineSignal, withSignal, type Clock } from './signals.js';
import { reviewPolicy } from './review/policy.js';
import { safeEvidence } from './review/context.js';
import { INVESTIGATION_TOOLS, type ReviewInvestigation } from './review/investigation.js';
import { DEFAULT_SETTINGS, type GuardSettings } from './policy/index.js';

export interface ReviewRequest { readonly systemPrompt: string; readonly data: string }
export interface ReviewReply { readonly decision: DecisionKind; readonly reason: string; readonly result?: ReviewResult; readonly isLegacy?: boolean }
export interface ReviewProvider { complete(request: ReviewRequest, options: { signal: AbortSignal; timeoutMs: number }): Promise<unknown> }
type ProviderContext = Parameters<ExtensionContext['modelRegistry']['streamSimple']>[1];
export class PiReviewProvider implements ReviewProvider {
  constructor(private readonly context: Pick<ExtensionContext, 'model' | 'modelRegistry'>, private readonly settings: GuardSettings = DEFAULT_SETTINGS, private readonly investigation?: ReviewInvestigation) {}
  async complete(request: ReviewRequest, options: { signal: AbortSignal; timeoutMs: number }): Promise<unknown> {
    const override = this.settings.reviewModel;
    const model = override ? this.context.modelRegistry.find(override.provider, override.id) : this.context.model;
    if (!model) throw new GuardError('REVIEW_PROVIDER', override ? 'Configured review model is unavailable' : 'No current Pi model is available for review');
    const maxTokens = Math.min(this.settings.reviewMaxOutputTokens, model.maxTokens ?? this.settings.reviewMaxOutputTokens);
    const context: ProviderContext = {systemPrompt: request.systemPrompt, messages: [{role: 'user', content: request.data, timestamp: Date.now()}], tools: this.investigation ? [...INVESTIGATION_TOOLS] as unknown as ProviderContext['tools'] : []};
    const startedAt = Date.now();
    for (let round = 0; round < this.settings.reviewMaxRounds; round++) {
      options.signal.throwIfAborted();
      if (model.contextWindow && canonicalJson(context).length > Math.max(0, model.contextWindow - maxTokens) * 3) throw new GuardError('REVIEW_CONTEXT_OVERFLOW', 'Exact review request exceeds model context capacity');
      const response = await withSignal(this.context.modelRegistry.streamSimple(model, context, {
        signal: options.signal, timeoutMs: round === 0 ? options.timeoutMs : Math.max(1, options.timeoutMs - (Date.now() - startedAt)),
        maxTokens, temperature: 0,
      }).result(), options.signal);
      options.signal.throwIfAborted();
      if (response.stopReason === 'error' || response.stopReason === 'aborted' || response.stopReason === 'length') throw new GuardError('REVIEW_PROVIDER', 'Review model did not complete its response');
      const calls = response.content.filter(item => item.type === 'toolCall');
      if (!calls.length) return response.content.filter(item => item.type === 'text').map(item => item.text).join('');
      if (!this.investigation || calls.length > 4 || round + 1 === this.settings.reviewMaxRounds) throw new GuardError('REVIEW_INVESTIGATION', 'Unsupported investigation or review round limit exceeded');
      // Keep visible tool calls, never returned private reasoning, in the bounded follow-up.
      context.messages.push({...response, content: response.content.filter(item => item.type !== 'thinking')});
      for (const call of calls) {
        let text: string;
        try { text = await withSignal(this.investigation.execute(call.name, call.arguments, options.signal), options.signal); }
        catch (cause) { throw new GuardError('REVIEW_INVESTIGATION', 'Read-only investigation failed', {cause}); }
        context.messages.push({role: 'toolResult', toolCallId: call.id, toolName: call.name, content: [{type: 'text', text}], isError: false, timestamp: Date.now()});
      }
    }
    throw new GuardError('REVIEW_INVESTIGATION', 'Review round limit exceeded');
  }
}
export function parseAssessment(value: unknown): ReviewAssessment {
  if (typeof value !== 'string' || value.length > 16000) throw new GuardError('REVIEW_PARSE', 'Invalid review output');
  let data: Record<string, unknown>;
  try { data = JSON.parse(value); } catch {
    const first = value.indexOf('{'), last = value.lastIndexOf('}');
    if (first < 0 || last < first) throw new GuardError('REVIEW_PARSE', 'Invalid review JSON');
    try { data = JSON.parse(value.slice(first, last + 1)); } catch { throw new GuardError('REVIEW_PARSE', 'Invalid review JSON'); }
  }
  if (!data || Array.isArray(data) || Object.keys(data).some(key => !['risk_level', 'user_authorization', 'outcome', 'rationale'].includes(key)) || !['allow', 'deny'].includes(String(data.outcome))) throw new GuardError('REVIEW_PARSE', 'Invalid review schema');
  const risk = data.risk_level ?? (data.outcome === 'allow' ? 'low' : 'high'), authorization = data.user_authorization ?? 'unknown';
  if (!['low', 'medium', 'high', 'critical'].includes(String(risk)) || !['unknown', 'low', 'medium', 'high'].includes(String(authorization)) || (data.rationale !== undefined && (typeof data.rationale !== 'string' || data.rationale.length > 4000))) throw new GuardError('REVIEW_PARSE', 'Invalid risk assessment');
  const rationale = typeof data.rationale === 'string' && data.rationale.trim() ? data.rationale : data.outcome === 'allow' ? 'Auto-review returned a low-risk allow decision.' : 'Auto-review denied the action without a rationale.';
  const cannotAllow = risk === 'critical' || (risk === 'high' && !['medium', 'high'].includes(String(authorization)));
  return immutable({risk_level: risk, user_authorization: authorization, outcome: cannotAllow ? 'deny' : data.outcome, rationale: cannotAllow && data.outcome === 'allow' ? 'Assessment contradicts the mandatory risk threshold' : rationale} as ReviewAssessment);
}
export function parseReview(value: unknown): ReviewReply {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Invalid review output');
  const data = JSON.parse(value) as Record<string, unknown>;
  if (!data || Object.keys(data).some(key => !['decision', 'reason'].includes(key)) || !['allow', 'ask', 'deny'].includes(String(data.decision)) || typeof data.reason !== 'string' || data.reason.length > 1000) throw new Error('Invalid review schema');
  return immutable({ decision: data.decision as DecisionKind, reason: data.reason, isLegacy: true });
}
export async function reviewAction(options: {
  action: GuardAction; policyDecision: PolicyDecision; provider: ReviewProvider; trustedAuthorization: string;
  hasUI: boolean; signal?: AbortSignal; timeoutMs: number; clock?: Clock;
  context?: ReviewContext; settings?: GuardSettings;
}): Promise<ReviewReply> {
  const { action, policyDecision } = options;
  if (policyDecision.actionDigest !== action.digest || policyDecision.isHardDeny || policyDecision.kind === 'deny') return { decision: 'deny', reason: 'Deterministic policy denied the action' };
  if (policyDecision.kind === 'allow') return { decision: 'allow', reason: policyDecision.reason };
  const deadline = deadlineSignal(options.signal, options.timeoutMs, options.clock);
  const policy = reviewPolicy(options.settings?.reviewPolicy);
  const context = options.context ?? {sessionId: action.sessionId, contextId: 'legacy', turnId: 'legacy', items: [{id: 'legacy-user', source: 'user', trust: 'authorization', content: safeEvidence(options.trustedAuthorization)}]};
  const binding = {actionDigest: action.digest, contextDigest: options.context?.digest ?? digest(context), policyDigest: policy.digest};
  try {
    deadline.signal.throwIfAborted();
    if (context.sessionId !== action.sessionId) throw new GuardError('REVIEW_CONTEXT', 'Review context belongs to another session');
    // The action must remain exact: refusing a credential-bearing request is safer than silently rewriting it.
    if (canonicalJson(safeEvidence(action as unknown as import('./contracts.js').Json)) !== canonicalJson(action)) throw new GuardError('REVIEW_CONTEXT', 'Exact action contains credential material that cannot enter the reviewer prompt');
    const request = {
      systemPrompt: policy.text,
      data: canonicalJson({ context, untrustedAction: action, requestedPermissionDelta: policyDecision.delta, policyReason: policyDecision.reason }),
    };
    if (request.data.length > (options.settings?.reviewContextChars ?? DEFAULT_SETTINGS.reviewContextChars)) throw new GuardError('REVIEW_CONTEXT_OVERFLOW', 'Exact request exceeds review context capacity');
    const value = await withSignal(options.provider.complete(request, { signal: deadline.signal, timeoutMs: options.timeoutMs }), deadline.signal);
    deadline.signal.throwIfAborted();
    // Existing explicitly supplied providers keep their narrow legacy interface.
    if (typeof value === 'string' && /"decision"\s*:/.test(value)) {
      let legacy: ReviewReply;
      try { legacy = parseReview(value); } catch { throw new GuardError('REVIEW_PARSE', 'Invalid legacy review schema'); }
      if (legacy.decision === 'allow' && Object.values(policyDecision.delta).some(paths => paths.length)) return {...legacy, decision: options.hasUI ? 'ask' : 'deny', reason: 'Legacy assessment cannot automatically increase permission'};
      if (legacy.decision === 'ask' && !options.hasUI) return {...legacy, decision: 'deny', reason: 'User approval is unavailable in this mode'};
      return legacy;
    }
    const assessment = parseAssessment(value);
    const result: ReviewResult = {...binding, status: assessment.outcome === 'allow' ? 'approved' : 'denied', assessment};
    return {decision: assessment.outcome, reason: assessment.rationale, result};
  } catch (error) {
    const failure = options.signal?.aborted ? 'cancelled' : deadline.signal.aborted ? 'timeout' : error instanceof GuardError && error.code === 'REVIEW_PARSE' ? 'invalid-output' : error instanceof GuardError && error.code.startsWith('REVIEW_CONTEXT') ? 'context' : error instanceof GuardError && error.code === 'REVIEW_INVESTIGATION' ? 'investigation' : 'provider';
    const status = failure === 'cancelled' ? 'aborted' : failure === 'timeout' ? 'timed-out' : 'failed';
    const reason = failure === 'cancelled' ? 'Call cancelled' : failure === 'timeout' ? 'Auto-review timed out; this alone is not evidence that the action is unsafe' : `Auto-review failed (${failure}); the action was not executed`;
    return {decision: 'deny', reason, result: {...binding, status, failure, reason}};
  } finally { deadline.dispose(); }
}
