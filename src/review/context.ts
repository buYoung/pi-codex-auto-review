import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { BeforeAgentStartEvent, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { canonicalJson, digest, GuardError, immutable, type Json, type ReviewContext, type ReviewContextItem } from '../contracts.js';
import { redact } from '../audit.js';

export const AUTHORIZATION_ENTRY = 'pi-codex-auto-review.authorization.v1';
export function safeEvidence(value: Json): Json {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(safeEvidence);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /^(authorization|api[_-]?key|token|password|secret)$/i.test(key) ? '[REDACTED]' : safeEvidence(item)]));
  return value;
}
function visibleMessage(message: unknown): Json | undefined {
  if (!message || typeof message !== 'object') return;
  const raw = message as { role?: string; content?: unknown; toolCallId?: string };
  if (!['assistant', 'toolResult', 'user'].includes(raw.role ?? '')) return;
  const content = typeof raw.content === 'string' ? raw.content : Array.isArray(raw.content) ? raw.content.flatMap<Json>(item => {
    if (item.type === 'text') return [{type: 'text', text: String(item.text)}];
    if (item.type === 'toolCall') return [{type: 'toolCall', id: String(item.id), name: String(item.name), arguments: JSON.parse(canonicalJson(item.arguments))}];
    return []; // Private reasoning, signatures and binary payloads never enter review.
  }) : [];
  return safeEvidence({role: raw.role!, content, ...(raw.toolCallId ? {toolCallId: raw.toolCallId} : {})});
}

/** Retains genuine authorization separately from summaries and extension-generated messages. */
export class ReviewContextStore {
  private items = new Map<string, ReviewContextItem>();
  private sessionId = '';
  private contextId = randomUUID();
  private turnId = randomUUID();
  reset(sessionId: string, manager?: ExtensionContext['sessionManager']): void {
    this.sessionId = sessionId; this.contextId = randomUUID(); this.turnId = randomUUID(); this.items.clear();
    for (const entry of manager?.getBranch?.() ?? []) {
      if (entry.type === 'custom' && entry.customType === AUTHORIZATION_ENTRY) {
        const data = entry.data as {text?: unknown; source?: unknown};
        if (typeof data?.text === 'string' && ['interactive', 'rpc'].includes(String(data.source))) this.authorize(data.text, entry.id);
      } else if (entry.type === 'message') this.message(entry.message, entry.id);
      else if (entry.type === 'compaction' || entry.type === 'branch_summary') this.add('assistant', 'evidence', entry.summary, entry.id);
    }
  }
  startTurn(): void { this.turnId = randomUUID(); }
  authorize(text: string, id: string = randomUUID()): void { this.add('user', 'authorization', text, id); }
  confirm(content: Json, id: string = randomUUID()): void { this.add('user-confirmation', 'authorization', content, id); }
  instructions(event: BeforeAgentStartEvent): void {
    // The structured runtime source establishes provenance, never a filename found in tool output.
    for (const file of event.systemPromptOptions.contextFiles) if (basename(file.path) === 'AGENTS.md') this.add('agents', 'authorization', {path: file.path, content: file.content}, `agents:${file.path}`);
    for (const [name, content] of [['customPrompt', event.systemPromptOptions.customPrompt], ['appendSystemPrompt', event.systemPromptOptions.appendSystemPrompt]] as const) {
      if (content) this.add('developer', 'authorization', content, `runtime:${name}`);
    }
  }
  message(message: unknown, id: string = randomUUID()): void {
    const content = visibleMessage(message);
    if (content !== undefined) this.add((message as {role:string}).role === 'toolResult' ? 'tool-result' : 'assistant', 'evidence', content, id);
  }
  toolCall(content: Json, id: string): void { this.add('tool-call', 'evidence', content, `call:${id}`); }
  toolResult(content: Json, id: string): void { this.add('tool-result', 'evidence', content, `result:${id}`); }
  private add(source: ReviewContextItem['source'], trust: ReviewContextItem['trust'], content: Json, id: string): void {
    this.items.set(id, immutable({id, source, trust, content: safeEvidence(content)}));
  }
  snapshot(maxChars: number, exactActionChars = 0): ReviewContext {
    const authorization = [...this.items.values()].filter(item => item.trust === 'authorization');
    const evidence = [...this.items.values()].filter(item => item.trust === 'evidence');
    const fields = {sessionId: this.sessionId, contextId: this.contextId, turnId: this.turnId};
    let remaining = maxChars - exactActionChars - canonicalJson({ ...fields, items: authorization }).length - 512;
    if (remaining < 0) throw new GuardError('REVIEW_CONTEXT_OVERFLOW', 'Required authorization and exact action exceed review context capacity');
    const retained: ReviewContextItem[] = [];
    for (const item of evidence.reverse()) {
      const text = canonicalJson(item);
      if (text.length <= remaining) { retained.unshift(item); remaining -= text.length; }
    }
    if (retained.length !== evidence.length) retained.unshift({id: 'omission', source: 'assistant', trust: 'evidence', content: '<truncated reason="review-context-budget" />', isTruncated: true});
    const data = {...fields, items: [...authorization, ...retained]};
    return immutable({...data, digest: digest(data)});
  }
}
