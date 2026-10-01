# [feat] Enforce native sandbox boundaries for delegated work

## Work Type
feat

## Current State (As-Is)
- [confirmed] The current root contains no sandbox executor or file worker — Evidence: src/index.ts placeholder and package.json empty dependencies.
- [confirmed] The copied Pi example replaces bash through BashOperations and uses @anthropic-ai/sandbox-runtime 0.0.26 — Evidence: examples/extensions/sandbox/index.ts createSandboxedBashOps() and its package.json dependencies.
- [confirmed] The example only replaces bash/user_bash while the built-in write/edit/read operations default to host fs calls — Evidence: createWriteToolDefinition(), defaultEditOperations, and defaultReadOperations in the copied Pi source.
- [confirmed] The current observed host is Darwin 24.6.0 ARM64 and sandbox-exec is on PATH — Evidence: prior uname -srm and command -v output; this does not establish successful native launch.
- [confirmed] The upstream runtime documents Seatbelt/bubblewrap and proxy-based filesystem/network confinement — Evidence: https://github.com/anthropics/sandbox-runtime README How It Works and As a library, inspected 2026-10-01.
- [inferred] Shared singleton/proxy policy updates could leak elevation across calls — Confirm by: actual runtime instance inspection and concurrency tests derived from the chosen adapter.
- [inferred] A surrounding agent sandbox can prevent nested launch — Confirm by: a permitted-process control on the actual host; record launch restrictions as environment-blocked.

## Desired Outcome (To-Be)
- Execution record (2026-10-01): implemented and verified on Darwin ARM64; current passing evidence, source/contract digests and build proof are in `docs/handoffs/pi-guard/04-sandbox.json`. Linux qualification is environment-blocked and is not claimed supported. Automated providers/UI are controlled doubles; native effects use the genuine pinned OS runtime.
- Every owned local command and delegated file operation executes through a real, qualified native boundary.
- Read-only/workspace-write profiles and narrow approved deltas remain specific to their invocation.
- Startup, worker failure, timeout, cancellation, and denial cannot fall through to unconstrained host execution.
- Platform qualification reports distinguish supported source/API availability from proven Darwin/Linux enforcement.

## Scope
### In Scope
- A pinned sandbox-runtime adapter, native capability qualification, broker lifecycle and isolated per-profile execution.
- Constrained file-worker IPC for read/access/write/mkdir/image-type/stat/list/search operations required by the Pi consumers.
- Streaming, caller env filtering, timeout, cancellation, child-tree shutdown and cleanup.
- Native tests derived from the selected backend's process, file, network and lifecycle boundaries, with permitted controls and actual observations.
### Out of Scope
- [hard] Introducing OpenShell, Docker, a VM runtime, or modifications to cloned upstream repositories.
- [hard] Applying a one-use permission delta by widening shared global proxy or filesystem policy.
- [hard] Allowing weaker isolation or ignoring violations to turn a failing test into a pass.
- [deferred] Native Windows backend and arbitrary remote service side-effect confinement.

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
- Own src/sandbox/ and test/native/sandbox.test.mjs. Serialize required root dependency/build changes through the child 01 contract owner before consuming a changed dependency or contract, then rerun and refresh affected prerequisite evidence.
- Keep the controller and broker control channels outside workload reach; pass user paths/content as validated IPC data instead of shell interpolation.
- Qualify the exact pinned runtime APIs and package assets before depending on per-exec permissions. Use a separate broker/runtime process per profile/invocation if isolation cannot be proved with shared instances.
- Preserve caller AbortSignal alongside internal deadlines and send termination to the owned process tree; release queues/resources only after in-flight effects settle.
- A denied process may have completed earlier authorized effects. Never automatically retry an arbitrary partly executed command, and never classify every non-zero exit as a sandbox denial.
- Use controlled fixture credentials/environment only. Filter sensitive inherited variables and review NODE_OPTIONS/BASH_ENV/ENV and control socket access at the worker boundary.
- If the selected runtime cannot support a local positive network fixture under its legitimate policy, stop that proof and investigate a bounded test transport; do not weaken production network restrictions.
- Mac native proof is mandatory on a qualified host. Linux proof is mandatory before Linux support is claimed; lack of a Linux runner is recorded as blocked with a specific required environment.

## Related Files / Entry Points
- `docs/handoffs/pi-guard/01-contracts.json` (proposed) — first consume the immutable profiles, worker-frame types, final-consumer options and evidence-state contract.
- `src/sandbox/` (proposed) — implement native qualification, broker/launch adapter, worker operations and cleanup in cohesive modules.
- `test/native/sandbox.test.mjs` (proposed) — derive and execute tests against the actual qualified native backend.
- `test/harness/` (proposed) — consume disposable roots, synthetic markers, owned-service controls, and report helpers from child 01.
- `tmp/pi-main/packages/coding-agent/examples/extensions/sandbox/index.ts` — inspect wrapWithSandbox() and BashOperations adaptation; replace its permissive startup fallback behavior.
- `tmp/pi-main/packages/coding-agent/src/core/tools/bash.ts` — preserve exec(command,cwd,{onData,signal,timeout,env}) and timeout seconds.
- `tmp/pi-main/packages/coding-agent/src/core/tools/read.ts` — cover readFile/access/image MIME detection operations.
- `tmp/pi-main/packages/coding-agent/src/core/tools/edit.ts` — cover Buffer reads, writes and access while preserving Pi's edit semantics.
- `docs/handoffs/pi-guard/04-sandbox.json` (proposed) — publish platform-qualified execution/worker contracts and actual native-suite evidence.

## Execution Plan
### Stage 1 — Qualify the pinned backend and instance boundary
- Starts when: `docs/handoffs/pi-guard/01-contracts.json` exists with state=ready, exact host/runtime inventory, immutable profiles, worker/report schemas and test commands.
- Work: Verify the selected package's real native primitives, supported options, assets, per-invocation isolation and network fixture transport on the available host.
- No-op when: The native executor passes current executable tests covering required boundaries and platform matrix under the same runtime/contract versions.
- No-op handoff: Refresh `docs/handoffs/pi-guard/04-sandbox.json` with current genuine native results, coverage and capabilities; let integration consume qualified platforms.
- Deliverable: A backend qualification record and bounded broker/worker design with an explicit platform matrix for Stage 2.
- Verify: `Bounded inspection of the pinned runtime, command -v sandbox-exec bwrap socat rg, and a controlled native launch probe derived from the selected API.`; Inputs: `docs/handoffs/pi-guard/01-contracts.json`, pinned package, actual host and fresh disposable fixtures.; Expected: Record versions/assets/capabilities; prove constrained permitted launch or record a blocked result; identify per-invocation isolation and legitimate network control transport.
- Ends when:
  - [x] A backend's ability to launch is proved rather than inferred from PATH.
  - [x] One-call network/file elevation has a documented isolated-instance route.
  - [x] Unavailable platform qualification is explicitly blocked, with no fake pass.
- Handoff: Stage 2 receives the qualification record, broker/worker protocol and supported-platform configuration.
- Replan when: Required confinement, cancellation or isolated elevation cannot be proved; stop integration, return to the parent for a bounded adapter/runtime correction and re-verification, then recalculate affected handoffs.
- Worker decision: Prefer the upstream sandbox runtime over handwritten OS profiles; pin a reviewed compatible version after checking its API/security changes rather than blindly copying 0.0.26.

### Stage 2 — Implement isolated execution and worker lifecycle
- Starts when: Stage 1 provides a qualified native adapter and a broker/IPC route that does not share one-call policy mutations.
- Work: Produce the constrained shell/file executor, immutable effective profiles, safe data transport, streaming, deadline/cancel propagation and resource cleanup without host-local fallback.
- Deliverable: An executable native adapter and worker protocol ready for behavior-derived native tests.
- Verify: `npm run build`; Inputs: Native broker, launch adapter, worker operations, protocol validation, inherited-env allowlist and process-tree cleanup code under src/sandbox/; also inspect all local effect paths in that directory.; Expected: Build exits 0; all requested effects reach the adapter; launch/init/IPC errors return errors and never spawn an unconstrained command or call host filesystem fallback.
- Ends when:
  - [x] Caller signal, timeout seconds and supported environment reach the final consumer.
  - [x] User data is not assembled into executable shell glue.
  - [x] Permissions are immutable per invocation and resource cleanup is tied to actual completion.
- Handoff: Stage 3 receives the built executor and worker assets plus exact effect-path inventory.
- Replan when: Lifecycle teardown or cancellation can leave executing descendants or release a mutation queue early; repair this same lifecycle before running the final-consumer proofs.

### Stage 3 — Prove native boundaries with positive and negative controls
- Starts when: Stage 2 has produced the built adapter and worker assets on a qualified platform.
- Work: Derive native tests from the built adapter's boundaries; implement and run serially in owned fixtures, observe permitted and denied effects, and record platform-specific evidence.
- Deliverable: `docs/handoffs/pi-guard/04-sandbox.json` JSON with schemaVersion=1, state=ready for qualified platforms, contractDigest, runtimeVersion, modulePaths, workerProtocol, capabilities, platformResults, testFiles, coveredBehavior and actual suite results; blocked platforms retain their blocked states.
- Verify: `npm run build && npm run test:native`; Inputs: test/native/sandbox.test.mjs, actual Darwin/Linux adapter, owned sentinels and service controls derived during implementation.; Expected: Build and non-empty suite exit 0 on a qualified platform; permitted controls succeed, denied effects stay absent, cancellation/deadline checks observe the final process tree, and elevation remains isolated.
- Ends when:
  - [x] Reports contain actual launch/enforcement evidence, command exits, fixture observations and runtime versions.
  - [x] No native required case is skipped or turned into a mock assertion.
  - [x] Cancellation and configured timeout reach the process tree; approved elevation remains isolated to its invocation.
- Handoff: Pi integration receives `docs/handoffs/pi-guard/04-sandbox.json`, qualified platform capabilities, executor/worker exports and actual native case evidence.
- Replan when: Any denied effect succeeds or any native proof is blocked; stop claims for the affected platform, return to this owner for bounded correction and re-verification, update the parent topology/handoff state before resuming.

## Side Effect Checkpoints
- [x] Permitted package/test commands keep their supplied working directory, output, environment options and exit status.
- [x] No secret environment marker or protected file content is copied into controller audit output.
- [x] A cancelled worker's in-flight mutation settles before the file-mutation queue is released.
- [x] Temporary files, process groups, proxy services and control channels created by tests are removed only within owned fixture roots.

## Acceptance Criteria
- [x] Tests derived from the selected backend exist in test/native/sandbox.test.mjs; `npm run build && npm run test:native` has run with required boundary coverage and actual observations for each claimed platform.
- [x] `docs/handoffs/pi-guard/04-sandbox.json` records genuine native-suite results and runtime/platform capabilities; unqualified platforms are not marked ready.
- [x] An existing, normally writable outside sentinel is unchanged under denied shell, file-worker, symlink and descendant-process paths.
- [x] The allowed file/command controls prove the backend executed, and network denial is confirmed at the controlled service/enforcement path.
- [x] Caller cancellation and configured BashOperations timeout reach the final process consumer with seconds preserved, and terminate owned descendants.
- [x] Initialization, dependency, invalid IPC and worker failures never trigger unconstrained host execution.

## Open Questions
- None — the requester confirmed briefset authoring/validation now and mandatory feature-test execution during implementation; product scope is fixed and technical unknowns have investigation/replan routes.
