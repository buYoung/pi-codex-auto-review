# [feat] Add denial recovery and review lifecycle controls

## Work Type
feat

## Current State (As-Is)
- [confirmed] The inspected source is `master` at `147ecac82faaf0ede925acc64ff6be32d9622017` with the existing naming edits — Evidence: the October 3 `git status` inventory.
- [confirmed] The reviewed baseline returns a generic permission error after reviewer denial — Evidence: `src/tools/controller.ts`, `admitAndExecute()`.
- [confirmed] `ApprovalManager` has grant storage and dialog serialization but no turn-level rejection circuit breaker or recent-denial registry — Evidence: `src/approvals.ts`, class state and `admit()`.
- [confirmed] `src/index.ts` registers tool/session/input hooks but no `/approve` command — Evidence: `createGuardExtension()` registration body.
- [confirmed] Audit events currently retain action identity and outcome without risk or authorization assessment — Evidence: `src/audit.ts`, `AuditLog.record()`.
- [confirmed] The official lifecycle describes separate timeout handling, standard rejection thresholds of 3 consecutive denials or 10 in the last 50 reviews, and up to 10 recent denied actions for one-retry approval — Evidence: the Auto-review documentation linked in the contracts handoff.

## Desired Outcome (To-Be)
- The main Pi agent receives a clear, typed result and the appropriate next-action instructions after review.
- Repeated policy denials interrupt the current turn at the pinned thresholds.
- A user can approve one exact recent denied action for one retry that still passes through automatic review.
- TUI/RPC and audit evidence expose useful status and rationale without exposing secrets or private reasoning.

## Scope
### In Scope
- Consume shared terminal-state and assessment contracts from the reviewer and permission children.
- Implement denial guidance, turn-scoped counting, recent-denial retention, exact retry authorization, and the supported Pi command/UI path.
- Preserve manual one-use/session/persistent approvals for their existing purpose.
- Add bounded structured status/risk/authorization/rationale reporting and observable cancellation/cleanup.
### Out of Scope
- [hard] Broad approvals of similar actions through `/approve`, bypassing re-review, or overriding absolute/critical denials.
- [hard] Treating timeouts and provider failures as proof that an action is unsafe.
- [hard] New app/browser/MCP approval surfaces.
- [deferred] A separate web dashboard for review history.

## Constraints
- Consume the completed assessment and execution contracts rather than reclassifying risks in the UI.
- Count review outcomes at the correct Pi turn boundary, including nested/concurrent calls; follow the pinned handling of non-denials and terminal failures.
- Keep the standard 3-consecutive and 10-of-50 thresholds and 10-entry recent-denial limit unless the pinned reference requires a documented distinction.
- Bind each retry marker to the exact action, cwd, session/context, policy, and permission identity. Consume it once.
- Mark explicit user retry approval through a trusted controller path; untrusted text cannot mint a marker.
- Preserve caller cancellation and ensure an interrupted turn cannot later execute a queued approval or dangling review.
- Keep the existing approval UI scopes and stored grant compatibility.
- Redact before persisting rationale and never persist complete provider requests, credentials, or hidden reasoning.

## Related Files / Entry Points
- `src/approvals.ts` — consume outcomes, manage exact retry authority, and retain existing UI/grant behavior.
- `src/tools/controller.ts` — return typed feedback and stop pending execution after a turn interrupt.
- `src/index.ts` — register supported Pi turn hooks and `/approve`.
- `src/audit.ts` — add bounded structured review status metadata.
- `src/reports.ts` — preserve evidence semantics when reporting review terminal states.
- `test/unit/approvals.test.mjs` — verify counters, retry consumption, dialog cancellation, and persistence boundaries.
- `test/integration/pi-tools.test.mjs` — observe actual turn interruption and UI/command routes.
- `docs/handoffs/auto-review/04-permissions.json` (proposed) — consume verified admission and execution behavior.
- `docs/handoffs/auto-review/05-denials.json` (proposed) — publish lifecycle behavior and proofs.

## Execution Plan
### Stage 1 — Map terminal outcomes to Pi lifecycle events
- Starts when: `docs/handoffs/auto-review/04-permissions.json` confirms integrated reviewed execution and references the shared reviewer/contract handoffs.
- Work: Identify public Pi turn/cancellation/command hooks and map each review terminal state to feedback, counter effects, execution prohibition, and cleanup.
- No-op when: The current lifecycle already passes all denial, interruption, retry, and reporting acceptance criteria with current-source evidence.
- No-op handoff: Publish verified lifecycle evidence in `docs/handoffs/auto-review/05-denials.json` so final verification can continue.
- Deliverable: A terminal-state and turn-event mapping tied to actual Pi APIs.
- Verify: `Inspect registered hooks and controlled outcome traces`; Inputs: `src/index.ts`, `src/approvals.ts`, and the preceding handoff's terminal states; Expected: every state has one consumer and explicit turn/reset semantics.
- Ends when:
  - [ ] The interrupt hook can stop the agent turn and its pending guarded calls.
  - [ ] The recent-denial scope differs explicitly from the per-turn counter scope.
- Handoff: Stage 2 receives the lifecycle mapping.
- Replan when: Public Pi APIs cannot enforce turn interruption or trusted command input; return the concrete capability gap to the parent instead of substituting a warning-only implementation.

### Stage 2 — Implement denial feedback and exact retry approval
- Starts when: Stage 1 supplies the verified lifecycle mapping.
- Work: Implement distinct feedback, race-safe rejection counting, bounded denial history, `/approve` selection, one-retry markers, and structured review status reporting.
- Deliverable: A complete denial/recovery path that preserves review and native enforcement.
- Verify: `Inspect controlled mixed-outcome sequences and exact-action retries`; Inputs: approval fixtures and real Pi command/turn integration; Expected: interruption occurs at the pinned threshold, a changed action cannot reuse approval, and the exact retry reaches the reviewer again.
- Ends when:
  - [ ] Explicit denial returns the rationale and the reference's no-circumvention/safer-alternative instructions.
  - [ ] Timeout, cancellation, and technical failure return their own actionable status.
  - [ ] Either three consecutive denials or ten denials in the last fifty reviews interrupts the standard-policy turn.
  - [ ] Defined non-denials reset the consecutive count and a new turn resets turn-local state.
  - [ ] The history retains no more than ten relevant denials and rejects stale retry selections.
  - [ ] Exact user reapproval cannot override an absolute policy denial or authorize a second retry.
- Handoff: Stage 3 receives the complete lifecycle and controlled traces.
- Replan when: A counter can be bypassed by concurrent reviews or a retry marker authorizes changed data; stop the parent join and correct the lifecycle before live verification.

### Stage 3 — Verify interruption, recovery, and reporting
- Starts when: Stage 2 integrates all lifecycle consumers.
- Work: Run affected unit/integration checks, exercise queued cancellation and user retry flows, and record UI/audit outcomes separately from execution effects.
- Deliverable: `docs/handoffs/auto-review/05-denials.json` with `status`, `sourceDigest`, `terminalStateMap`, `thresholds`, `turnHooks`, `retryBinding`, `statusSurfaces`, `commands`, `artifactPaths`, and `unresolved`.
- Verify: `npm run build && npm run test:approvals && npm run test:integration`; Inputs: mixed-outcome, concurrent-review, exact-retry, stale-context, and queued-cancellation fixtures; Expected: exit 0 and no side effect after interruption or an invalid retry.
- Ends when:
  - [ ] The actual Pi agent turn stops, rather than only displaying a message.
  - [ ] The exact-action retry is observed entering review before any effect.
  - [ ] The audit population is nonempty and contains only the allowed structured/redacted fields.
- Handoff: Final verification receives `docs/handoffs/auto-review/05-denials.json`.
- Replan when: Any lifecycle proof fails; stop dependent acceptance, correct this child, and rerun the affected sequences before resuming.

## Side Effect Checkpoints
- [ ] Manual approval dialogs still serialize and preserve once/session/persistent semantics.
- [ ] Session reset, shutdown, resume, and fork cannot transfer stale retry authorization.
- [ ] Counters distinguish an explicit policy denial from a transport/parse/deadline failure.
- [ ] Native execution and reviewer work settle before an interrupted turn is considered stopped.
- [ ] Existing audit identity fields and evidence status meanings remain readable.

## Acceptance Criteria
- [ ] Each terminal outcome has observed main-agent feedback and the correct execution prohibition.
- [ ] Standard circuit-breaker thresholds and rolling-window behavior are proven, including concurrent and nested requests.
- [ ] `/approve` authorizes one exact retry in the same valid context and that retry is reviewed again.
- [ ] Changed arguments, cwd, policy, session, or already-consumed markers cannot reuse retry authority.
- [ ] TUI/RPC and audit results distinguish review status from actual execution outcome.
- [ ] `docs/handoffs/auto-review/05-denials.json` contains evidence for the actual Pi lifecycle, not only isolated counter logic.

## Open Questions
- None — the user approved denial/reapproval parity on current Pi surfaces.
