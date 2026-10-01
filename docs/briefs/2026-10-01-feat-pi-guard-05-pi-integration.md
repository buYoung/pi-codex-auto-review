# [feat] Connect final Pi consumers to guard admission and isolation

## Work Type
feat

## Current State (As-Is)
- [confirmed] Pi's copied runner executes tool_call handlers serially on mutable input and stops on block=true — Evidence: ExtensionRunner.emitToolCall() in core/extensions/runner.ts.
- [confirmed] user_bash returning undefined can continue to local execution, while a handled operations/result stops propagation — Evidence: emitUserBash() and docs/extensions.md user_bash contract.
- [confirmed] Built-in file operations default to Node fs while pluggable operations can replace them — Evidence: defaultReadOperations, defaultEditOperations and defaultWriteOperations.
- [confirmed] Same-name extension tools override built-ins in the copied registry — Evidence: AgentSession toolRegistry.set(tool.name,tool) in core/agent-session.ts.
- [confirmed] The copied Pi exports InteractiveMode, runPrintMode, runRpcMode, DefaultResourceLoader and createAgentSession — Evidence: coding-agent/src/index.ts public exports; installed-version parity is the contract child's prerequisite.
- [confirmed] A failed extension factory is discarded and load errors are returned without an active extension — Evidence: load.commit()/load.discard() and loadExtension() in core/extensions/loader.ts.
- [inferred] A gate-only hook can approve stale input or leave failed startup unprotected — Confirm by: tests derived from actual public host lifecycle and later mutating handlers.

## Desired Outcome (To-Be)
- Execution record (2026-10-01): implemented and verified on Darwin ARM64; current passing evidence, source/contract digests and build proof are in `docs/handoffs/pi-guard/05-integration.json`. Automated providers/UI are controlled doubles; native effects use the genuine pinned OS runtime.
- Model, nested/codemode and user !/!! calls use the same final-action admission and native enforcement.
- Pi's existing file editing/rendering/output semantics remain intact while local effects are delegated.
- The protected startup route verifies readiness and supported API versions before executing a user request.
- Mode-specific dialogs, no-UI denials, unknown tool treatment and redacted audit correlation are observable.

## Scope
### In Scope
- Default extension factory, guarded startup entry, Pi package manifest wiring and public SDK mode integration.
- Built-in shell and file/search operation adapters with final-input revalidation and request-bound permissions.
- tool_call/user_bash, nested/codemode paths, session reset/shutdown and mode-specific approvals.
- Integration tests derived from actual final consumers and host mode/startup paths, using fake providers/UI and real native effects where required.
### Out of Scope
- [hard] A Pi core fork or copying a private TUI/RPC implementation to bypass missing public APIs.
- [hard] Automatically trusting unknown extension/MCP annotations or claiming confinement of remote MCP server internals.
- [hard] Treating ordinary Pi's logged extension-load error as protected startup.
- [deferred] Sandboxing arbitrary third-party in-process extension code without an explicit process-isolation adapter.

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
- Use the child 01 shared contracts and the verified policy/review/native handoffs without changing their schemas independently.
- Own src/index.ts final wiring, src/cli.ts, src/tools/ and package.json's final pi/bin metadata in this wave; serialize those root edits after child 01.
- Native file adapters must cover read/edit/write/grep/find/ls including auxiliary access, mkdir, MIME detection/stat/context reads; bash-only wrapping is insufficient.
- Check the approved identity immediately before the owned executor starts; a later handler mutation, changed cwd or policy revision requires a new decision.
- Bind read/access/write helpers within one logical edit call to the same admitted request and permission profile. Do not consume its one-use grant again for each helper or reuse it for another toolCallId.
- A declared guarded SDK/launcher route must verify extension and backend readiness before admitting work. Document ordinary unguarded host loading honestly rather than overclaiming safety.
- Preserve Pi's matching/diff/encoding/truncation/rendering behavior by using existing tool factories with operations adapters.
- Guard unfamiliar tools by identity and policy; hints remain advisory. Do not reroute external MCP calls through a file worker or claim remote-side protection.
- Test harnesses must isolate Pi resource/auth/settings directories and supply a fake provider so integration never resolves real user credentials or generates paid traffic.

## Related Files / Entry Points
- `docs/handoffs/pi-guard/01-contracts.json` (proposed) — first verify the installed public API, identity, result, startup and command contracts.
- `docs/handoffs/pi-guard/02-policy.json` (proposed) — consume the ready final-action policy implementation.
- `docs/handoffs/pi-guard/03-review.json` (proposed) — consume ready reviewer, grant, dialog and audit behavior.
- `docs/handoffs/pi-guard/04-sandbox.json` (proposed) — consume the native executor and its actually qualified platform capabilities.
- `src/index.ts` — implement the final default extension factory and guarded event connections.
- `src/cli.ts` (proposed) — implement the supported protected startup route using verified public Pi run modes.
- `src/tools/` (proposed) — connect all owned local effects to native operations and final identity checks.
- `package.json` — complete serialized pi.extensions and guarded launch metadata after the contract wave.
- `test/integration/pi-tools.test.mjs` (proposed) — derive assertions from actual host routes and observe final file/command effects.
- `tmp/pi-main/packages/coding-agent/src/core/agent-session.ts` — inspect registry overrides and nested hook routing.
- `tmp/pi-main/packages/coding-agent/src/core/extensions/runner.ts` — inspect mutable tool_call and handled user_bash semantics.
- `tmp/pi-main/packages/coding-agent/src/core/extensions/loader.ts` — inspect factory discard/load-error behavior before asserting protected startup.
- `docs/handoffs/pi-guard/05-integration.json` (proposed) — publish guarded modes, public entry points and integration-suite evidence for overall verification.

## Execution Plan
### Stage 1 — Consume all readiness handoffs and pin owned effect paths
- Starts when: `docs/handoffs/pi-guard/01-contracts.json`, `docs/handoffs/pi-guard/02-policy.json`, `docs/handoffs/pi-guard/03-review.json`, and `docs/handoffs/pi-guard/04-sandbox.json` exist with matching contract digests, actual required results and at least one qualified native platform.
- Work: Map model/nested/codemode/user-bash calls through final consumers, establish protected startup and identify all delegated operations and external trust boundaries.
- No-op when: Existing integration passes current tests covering required final-consumer and startup behavior under current handoffs.
- No-op handoff: Refresh `docs/handoffs/pi-guard/05-integration.json` with current results, coverage, entry points and effect routing; send to verification without source edits.
- Deliverable: Verified effect-path/mode/startup inventory and coverage goals tied to actual public Pi APIs.
- Verify: `Bounded inspection of all four handoffs, installed public Pi APIs and actual consumer/startup paths.`; Inputs: Contract/module/platform handoffs, tool/event/loader/run-mode interfaces, src/index.ts, src/tools/ and offline provider/UI harness.; Expected: Effects have constrained final consumers, input mutations invalidate approvals, startup has a readiness barrier, and concrete integration tests can be derived from this inventory.
- Ends when:
  - [x] Every named tool and !/!! path has one admission/enforcement route.
  - [x] The protected startup seam is public, compatible and checked before any request executes.
  - [x] Remote MCP and trusted in-process extension boundaries are explicitly separated.
- Handoff: Stage 2 receives the complete effect-path, mode and protected-startup inventory.
- Replan when: Installed public Pi APIs cannot enforce the readiness/final-consumer contract; stop overall verification and return to the parent/contract owner for a bounded compatibility or startup-route replan.

### Stage 2 — Wire tools and preserve caller contracts
- Starts when: Stage 1 has proved the public startup and operation-adapter route for the current handoffs.
- Work: Connect policy, review, approval and native execution to all owned Pi consumers, implement guarded startup/modes and ensure request identity is checked at the execution boundary.
- Deliverable: A built, loadable extension/guarded entry and complete built-in operation adapters for Stage 3.
- Verify: `npm run build`; Inputs: src/index.ts, src/cli.ts, src/tools/, serialized metadata, runtime handoff exports and required behavior; inspect final operation/event/startup mappings.; Expected: Build exits 0; guarded user_bash never returns undefined; local effects reach native adapters and preserve caller options/result schemas.
- Ends when:
  - [x] All built-in filesystem effects including auxiliary reads/access/mkdir are delegated.
  - [x] AbortSignal, timeout, env and update callbacks reach the real final consumer.
  - [x] Unknown tools and loader failures cannot be mislabeled as protected local execution.
- Handoff: Stage 3 receives the built extension, protected launcher and effect inventory.
- Replan when: A source path still performs guarded host-local I/O or a hook mutation changes an admitted request; repair the integration boundary before testing completion.

### Stage 3 — Execute final-consumer integration assertions
- Starts when: Stage 2 produces the built extension, guarded launch route and verified qualified platform adapter.
- Work: Derive and implement tests from the built host routes; run with fake providers/dialogs, isolated Pi resources and actual native effects for local consumers.
- Deliverable: `docs/handoffs/pi-guard/05-integration.json` JSON with schemaVersion=1, state=ready, contractDigest, modulePaths, guardedStartup, modes, toolRoutes, trustBoundaries, qualifiedPlatforms, testFiles, coveredBehavior and actual suite results.
- Verify: `npm run build && npm run test:integration`; Inputs: test/integration/pi-tools.test.mjs, actual SDK/run-mode routes, native backend, owned fixtures and fake providers/UI.; Expected: Commands exit 0; non-empty tests prove required routes and final effects, !/!! cannot fall through, mutations invalidate stale approval and caller contracts reach final consumers.
- Ends when:
  - [x] Required routes have executable assertions for final effects and denied no-effect outcomes.
  - [x] No integration scenario auto-loads user auth/extensions or calls a live model.
  - [x] The ready handoff accurately names protected modes and unsupported external boundaries.
- Handoff: Overall verification receives `docs/handoffs/pi-guard/05-integration.json`, guarded package/CLI entry points, complete effect routing and actual integration-suite results.
- Replan when: Any owned route bypasses admission or native execution; stop the verification successor, return to this owner for bounded correction and re-verification, then refresh parent relationships and readiness.

## Side Effect Checkpoints
- [x] read/edit/write retain existing Pi schemas, Buffer/encoding and edit-diff behavior rather than a new user-facing tool contract.
- [x] BashOperations retains supplied env, timeout seconds, AbortSignal, streaming output and non-zero/signal exit results.
- [x] TUI/RPC supported dialogs preserve cancellation, while print/JSON cannot hang waiting for absent UI.
- [x] Reload/session replacement clears grants/pending work and shutdown releases native resources after in-flight effects settle.
- [x] The package uses the intended host-provided Pi modules and does not accidentally create duplicate runtime registries.

## Acceptance Criteria
- [x] Tests derived from actual integration paths exist in test/integration/pi-tools.test.mjs; `npm run build && npm run test:integration` has run with recorded required coverage and actual results.
- [x] `docs/handoffs/pi-guard/05-integration.json` records successful build and integration-suite results under the current contract and qualified runtime.
- [x] read/edit/write/grep/find/ls, model/nested/codemode bash and !/!! all have an actually tested final consumer boundary.
- [x] Later handler mutation, revision/cwd changes and cancellation cannot reuse stale approval or widen another call's permissions.
- [x] Protected startup rejects unsupported APIs, failed extension initialization/loading and unavailable native enforcement before side effects.
- [x] Pi tool names, parameter/results, structured output, streaming, edit semantics and supported UI modes remain compatible.

## Open Questions
- None — the requester confirmed briefset authoring/validation now and mandatory feature-test execution during implementation; product scope is fixed and technical unknowns have investigation/replan routes.
