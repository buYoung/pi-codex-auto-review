# [feat] Implement model review and bounded approval lifecycle

## Work Type
feat

## Current State (As-Is)
- [confirmed] Pi's copied ModelRegistry exposes complete() and streamSimple() with provider runtime delegation — Evidence: tmp/pi-main/packages/coding-agent/src/core/model-registry.ts.
- [confirmed] Pi dialogs accept AbortSignal and timeout in milliseconds; hasUI is available in TUI/RPC contexts — Evidence: ExtensionUIDialogOptions and ExtensionContext in core/extensions/types.ts.
- [confirmed] The requester accepted reuse of the current Pi model through a separate tool-free request and bounded approval scopes — Evidence: the preceding implementation briefing adopted as this initiative's input.
- [inferred] Concurrent dialogs, stale identity and shared permission mutation could cross-authorize requests — Confirm by: tests derived from actual queue, grant and invalidation lifecycles.

## Desired Outcome (To-Be)
- Execution record (2026-10-01): implemented and verified on Darwin ARM64; current passing evidence, source/contract digests and build proof are in `docs/handoffs/pi-guard/03-review.json`. Automated providers/UI are controlled doubles; native effects use the genuine pinned OS runtime.
- Only ambiguous actions call a separate, tool-free reviewer through the verified current Pi model runtime.
- Allow, ask, deny, malformed output, provider failure, timeout, and cancellation have explicit admission outcomes.
- One-use, session, and explicitly user-authored persistent grants remain bound to the exact action and policy revision.
- Audit output records decisions and execution correlation without exposing synthetic or real secret data.

## Scope
### In Scope
- Reviewer request/response validation and authorization context extraction.
- Approval queue, cancellation, grant consumption/invalidation, user-controlled persistence, and audit redaction.
- Executable tests derived from review admission, grants, cancellation, persistence and audit lifecycles.
### Out of Scope
- [hard] Live provider calls, paid tokens, user auth discovery, or policy hard-deny overrides in automated tests.
- [hard] Launching a workload, changing native runtime policy, or editing shared types/root metadata.
- [deferred] A separate always-on reviewer service, a new model subscription, and arbitrary model selection UI.

## Constraints
- During implementation, derive concrete test cases from verified APIs, agreed behavior, changed execution paths and discovered defects. Write runnable tests alongside the implementation, assert observable outcomes independently of internal layout, execute the named suites, and correct and rerun failures before completion. Record test files, covered behavior, commands and actual results in the handoff.
- No OpenShell integration, Docker runtime dependency, Pi core fork, package publication, real credential access, or paid/live model calls in automated tests.
- Treat Pi and explicitly trusted extensions as the controller. Native protection covers delegated local work; remote MCP server internals and arbitrary in-process third-party extension effects are separate trust boundaries.
- Bind every approval to the final tool identity, normalized input, resolved cwd, session, policy revision, and effective permission digest. Hard deny rules cannot be overridden by a model or cached grant.
- Preserve Pi tool names, argument/result schemas, structuredContent, error/exit semantics, streaming updates, caller AbortSignal, BashOperations timeout in seconds, and caller-supported options through the final consumer.
- Use the current Pi model runtime for separate tool-free review requests. All automated review/provider/UI interactions use injected doubles and an isolated Pi resource directory.
- Use disposable, owned fixture directories and synthetic secrets. Native proofs require successful permitted controls plus denied effects; missing dependencies, skipped cases, and denied nested sandbox launch are environment-blocked, not pass.
- Keep tests traceable to this brief's behavior and compatibility requirements. Reports identify actual test files and covered behavior, distinguishing unit doubles, simulated provider/UI integration and real OS enforcement.
- Read upstream tmp snapshots as references only. Confirm installed Pi 0.99.1 APIs against the copied 0.99.2 source before depending on them, and record exact selected sandbox package/runtime versions.
- Do not claim protected startup for ordinary Pi when a failed extension factory has been discarded. A declared guarded startup route must verify guard readiness before accepting execution.
- Do not stage, commit, install global packages, change machine sandbox settings, weaken a backend to make a test pass, or access an external Linux runner without the corresponding authorization.
- Use the existing model runtime through a typed adapter and inject a fake in tests. Do not attach tools or reuse the execution agent's mutable conversation as reviewer authority.
- Supply exact action and permission delta plus trusted user authorization, and mark tool descriptions/output as untrusted data.
- Pass caller cancellation through the final provider request. Derive controlled-clock checks from the implemented deadline, proving the configured value and caller signal reach the final provider consumer.
- Invalid or failed review never returns allow. With UI it may ask or block according to the declared policy; without UI it blocks.
- Keep dialog serialization, grant consumption, cancellation, and compensated persistence together under K2 because they share the same approval failure path.
- Consume a one-use grant once at logical tool admission. All reviewed helper operations of that same tool call share its bound profile until settlement; no second logical call can reuse it.
- Store persistent rules only through an explicit user control and outside the workload-writable roots. Logs use the child 01 evidence/redaction vocabulary.

## Related Files / Entry Points
- `docs/handoffs/pi-guard/01-contracts.json` (proposed) — first read reviewer, grant, identity, evidence, and test command contracts.
- `src/reviewer.ts` (proposed) — implement tool-free model requests and validated decisions.
- `src/approvals.ts` (proposed) — implement the serialized dialog queue and bound grant lifecycle.
- `src/audit.ts` (proposed) — implement redacted decision and result correlation.
- `test/unit/reviewer.test.mjs` (proposed) — derive decision/failure/cancellation/deadline assertions using provider doubles and controlled time.
- `test/unit/approvals.test.mjs` (proposed) — derive queue/grant/persistence/audit assertions using fake dialogs and owned fixtures.
- `tmp/pi-main/packages/coding-agent/src/core/model-registry.ts` — inspect complete() and streamSimple() provider-neutral delegation.
- `tmp/pi-main/packages/coding-agent/src/core/extensions/types.ts` — inspect ExtensionUIDialogOptions and hasUI/ctx.signal.
- `docs/handoffs/pi-guard/03-review.json` (proposed) — expose verified approval admission and audit behavior to integration.

## Execution Plan
### Stage 1 — Stabilize approval admission and fake reviewer inputs
- Starts when: `docs/handoffs/pi-guard/01-contracts.json` exists with state=ready, request/decision/grant/report types, public model/UI APIs and test commands.
- Work: Establish reviewer requests, invalid-response handling, grant scopes, queue, cancellation and persistence boundaries; identify behavior to verify when deriving tests.
- No-op when: Reviewer, approval queue and audit code pass current executable tests covering required behavior with no live provider path.
- No-op handoff: Refresh `docs/handoffs/pi-guard/03-review.json` with current suite results, coverage and module hashes; let integration continue without source edits.
- Deliverable: Verified admission-state, grant and provider/UI boundaries with coverage goals for tests derived during Stage 2.
- Verify: `Bounded inspection of the contract handoff and actual provider/UI/cancellation interfaces.`; Inputs: `docs/handoffs/pi-guard/01-contracts.json`, installed declarations, shared fixtures and required behavior.; Expected: Decision/error/cancel paths have non-permissive fallbacks and grants have explicit action/session/policy binding.
- Ends when:
  - [x] The model is never the author of a hard-policy exception or permanent grant.
  - [x] Reviewer/provider/UI tests are injected, tool-free and offline.
- Handoff: Stage 2 receives verified state transitions, provider/UI seams and response/persistence contracts.
- Replan when: Installed model/UI APIs cannot preserve cancellation or provider neutrality; stop dependent integration and return to the contract owner before adding another provider or service.

### Stage 2 — Implement approval lifecycle and prove isolation
- Starts when: Stage 1 supplies the bounded admission, scope, cancellation, and fixture contracts.
- Work: Implement review, serialized approvals, grant lifecycle, persistence and redaction; derive and execute tests from actual state transitions and public outcomes.
- Deliverable: `docs/handoffs/pi-guard/03-review.json` JSON with schemaVersion=1, state=ready, contractDigest, modulePaths, decisionFallbacks, grantScopes, redactionRules, testFiles, coveredBehavior and actual suite results.
- Verify: `npm run build && npm run test:reviewer && npm run test:approvals`; Inputs: src/reviewer.ts, src/approvals.ts, src/audit.ts, both named tests and owned offline fixtures derived during implementation.; Expected: Commands exit 0; non-empty suites prove grounded decisions, configured deadline/caller signal at the final provider, isolated grants and redaction over a non-empty audit population.
- Ends when:
  - [x] Required review/approval behavior has executable assertions and actual results; required checks are not skipped.
  - [x] One-use permissions do not change shared global state or leak to a concurrent sibling.
  - [x] Audit checks prove the target log population is non-empty before a no-match assertion.
- Handoff: Pi integration receives `docs/handoffs/pi-guard/03-review.json`, admission outcomes, grant consumption and redacted audit contracts.
- Replan when: A reply, stale identity, revision change, or concurrent queue action authorizes the wrong request; stop successors, correct this lifecycle and rerun its exact suites before marking the handoff ready.

## Side Effect Checkpoints
- [x] The caller's AbortSignal is combined with a deadline rather than replaced.
- [x] Approval dialogs disappear and queued requests are removed when their caller cancels or their session changes.
- [x] Model replies cannot invoke a tool or persist a policy rule.
- [x] Audit redaction includes failed/denied model and worker output, not only successful actions.

## Acceptance Criteria
- [x] Tests derived from the actual lifecycle exist in test/unit/reviewer.test.mjs and test/unit/approvals.test.mjs; `npm run build && npm run test:reviewer && npm run test:approvals` has run with recorded coverage and results.
- [x] `docs/handoffs/pi-guard/03-review.json` records successful build and reviewer/approval suite results with no missing required behavior proof.
- [x] Separate review calls contain no tools, preserve the exact final action, and use the verified current Pi provider runtime.
- [x] Executable tests prove serialized dialogs and one-use/session/profile isolation under concurrent, cancelled, stale and replacement-session requests.
- [x] Tests prove configured deadline and caller cancellation at the final provider signal; audit checks enumerate a non-empty population.

## Open Questions
- None — product scope is fixed by the requester; remaining API, backend, and test-harness choices have bounded investigation and replan routes.
