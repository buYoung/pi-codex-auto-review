# [feat] Establish guard contracts and executable test harness

## Work Type
feat

## Current State (As-Is)
- [confirmed] The 2026-10-01 checkout at /Users/buyonglee/Documents/work/private/pi-guard has no verified HEAD commit — Evidence: git rev-parse --verify HEAD returned fatal: Needed a single revision.
- [confirmed] The application is a skeleton with only a console.log entry and a tsc build command — Evidence: src/index.ts and package.json scripts.build.
- [confirmed] TypeScript currently targets es2016/commonjs and src only — Evidence: tsconfig.json compilerOptions and include.
- [confirmed] The installed versions observed are Node.js 24.14.0 and Pi 0.99.1 while the copied Pi package is 0.99.2 — Evidence: prior node --version and pi --version output, and tmp/pi-main/packages/coding-agent/package.json version.
- [confirmed] Pi exposes operations-based local tools, a model registry, and public SDK run modes in the copied source — Evidence: BashOperations in core/tools/bash.ts, ModelRegistry.complete() and streamSimple(), and coding-agent/src/index.ts Run modes exports.
- [confirmed] The user requires test-code creation and actual execution during each brief's implementation, with concrete cases derived then rather than fixed in advance — Evidence: the scope answer and subsequent clarifications in this conversation.
- [inferred] A version-pinned interface inventory is required before parallel consumers implement against a stable contract — Confirm by: installed declaration inspection and tests derived from the verified shared interfaces.

## Desired Outcome (To-Be)
- Execution record (2026-10-01): implemented and verified on Darwin ARM64; current passing evidence, source/contract digests and build proof are in `docs/handoffs/pi-guard/01-contracts.json`. Automated providers/UI are controlled doubles; native effects use the genuine pinned OS runtime.
- Downstream policy, approval, native execution, and Pi integration work share one typed, versioned request/decision/permission/worker/report contract.
- The package has an ESM build and a runnable offline test harness with actual suite results and required behavior coverage.
- Consumers can start from an addressable contract handoff without guessing Pi APIs, timeout units, or process readiness.

## Scope
### In Scope
- Root package/build metadata, shared types, evidence schema, and disposable fixture harness.
- Pi 0.99.1 compatibility inventory and comparison with the copied 0.99.2 reference.
- Executable contract tests and npm verification commands derived from verified runtime and shared schema behavior.
- A disabled/fail-closed bootstrap entry suitable for later integration; it is not an operational permission plugin yet.
### Out of Scope
- [hard] Implementing policy decisions, calling the review model, or executing protected user work in this child.
- [hard] Editing or building tmp/pi-main, tmp/codex-main, or tmp/OpenShell-main.
- [deferred] Full Codex Starlark .rules/config compatibility and native Windows support.

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
- Own package.json, tsconfig.json, dependency lockfile creation, src/contracts.ts, and shared test harness in this wave. Later consumers read these contracts rather than editing them independently.
- Use host-provided Pi packages as peerDependencies and local type-check dependencies as needed; do not bundle a duplicate runtime Pi registry.
- A handoff state=ready means contract and harness readiness only, not completed feature protection.
- Introduce executable npm commands in this child; they are proposed commands, not existing baseline checks. Missing test files or empty declared suites must exit non-zero.

## Related Files / Entry Points
- `package.json` — start with scripts.build and define ESM/Pi manifest, exact reviewed local dependency versions, and required test commands.
- `tsconfig.json` — change module/target only after checking the installed Node/Pi loading contract.
- `src/index.ts` — replace the console placeholder with a bootstrap that never admits protected work before readiness.
- `src/contracts.ts` (proposed) — define shared immutable action, permission, grant, worker-frame, and test-report types.
- `src/reports.ts` (proposed) — validate suite results, required behavior coverage and pass/fail/blocked/not-run evidence states.
- `test/harness/` (proposed) — provide isolated fixtures, clock/provider/UI doubles and actual suite-result recording.
- `test/unit/contracts.test.mjs` (proposed) — derive contract tests after verifying interfaces and report semantics.
- `scripts/run-tests.mjs` (proposed) — run declared non-empty suites and produce bounded machine-readable summaries.
- `tmp/pi-main/packages/coding-agent/src/index.ts` — inspect public SDK and run-mode exports before selecting the guarded startup seam.
- `tmp/pi-main/packages/coding-agent/docs/packages.md` — follow Declare dependencies and explicit pi.extensions manifest guidance.
- `docs/handoffs/pi-guard/01-contracts.json` (proposed) — publish the verified contract and command map consumed by later children.

## Execution Plan
### Stage 1 — Pin the public runtime and contract boundary
- Starts when: The inspected skeleton and agreed guard behavior, compatibility boundaries and test obligations are available.
- Work: Resolve the installed Pi API/version boundary and define the immutable action, permissions, approvals, worker IPC, evidence-state vocabulary, fixture safety, and guarded-startup seam.
- No-op when: Public contracts, executable contract tests, build metadata and a current ready handoff exist; their checks pass and cover this brief's behavior.
- No-op handoff: Refresh `docs/handoffs/pi-guard/01-contracts.json` with actual check results and existing contract hashes, then allow policy, review, and sandbox consumers to continue without source edits.
- Deliverable: An installed-versus-reference API inventory and versioned shared contract draft for Stage 2.
- Verify: `Bounded inspection of root configuration and the installed Pi declarations, plus node --version, pi --version, and uname -srm from the repository root.`; Inputs: package.json, tsconfig.json, src/index.ts, installed Pi public declarations, copied Pi package/version and src/index.ts exports; do not inspect user auth files.; Expected: Record actual versions, supported public hooks/run modes, argument/result/cancellation contracts, and any unsupported APIs; no API is assumed from the newer copy alone.
- Ends when:
  - [x] Every downstream contract has explicit types, units, identity binding, and state vocabulary.
  - [x] The selected protected-startup seam uses public APIs or has a named replan boundary.
- Handoff: Stage 2 receives the API inventory, contract draft, and fixture/test command map.
- Replan when: An installed public API cannot preserve the named contracts; stop dependent implementation and update the parent contract/compatibility route before continuing.
- Worker decision: Select Node's built-in test runner with ESM .mjs tests importing built artifacts unless the verified host requires another equally offline runner; keep additional test dependencies minimal.

### Stage 2 — Build contracts and executable evidence accounting
- Starts when: Stage 1 supplies the verified API inventory and stable type/fixture/command decisions.
- Work: Produce shared ESM contracts and the offline harness, derive and implement contract tests, and make declared test commands reject missing or empty suites.
- Deliverable: `docs/handoffs/pi-guard/01-contracts.json` JSON with schemaVersion=1, state=ready, runtimeVersions, publicPiApis, requestContract, decisionContract, permissionContract, grantContract, workerProtocol, reportContract, fixtureContract, startupProtection, commands, testFiles, coveredBehavior and actual suite results.
- Verify: `npm run build && npm run test:contracts`; Inputs: src/contracts.ts, src/reports.ts, root metadata, test/unit/contracts.test.mjs and isolated fixtures; run after introducing the harness commands.; Expected: Build and the non-empty suite exit 0; tests prove identity/profile immutability, decision/worker/report validation and truthful evidence states against actual interfaces.
- Ends when:
  - [x] The contract handoff contains actual versions and results, not placeholder success.
  - [x] All test commands have concrete target files and record missing cases as errors.
  - [x] The bootstrap and package manifest do not claim an operational guard before integration.
- Handoff: Policy, review/approval, and native sandbox children receive `docs/handoffs/pi-guard/01-contracts.json` and its command/type/fixture contracts.
- Replan when: Harness evidence accepts missing required coverage or incomplete suite results or ESM loading duplicates Pi runtime packages; stop consumers and repair this contract before publishing a ready handoff.

## Side Effect Checkpoints
- [x] Existing npm run build remains the supported build entry after the module change and emits resolvable package/worker paths.
- [x] Root metadata changes preserve unrelated user edits; inspect their existing diff before patching package.json or tsconfig.json.
- [x] No fixture reads actual home credentials or starts the default authenticated Pi provider.
- [x] Contract tests distinguish schema validity from completed native feature verification.

## Acceptance Criteria
- [x] Tests derived from verified contracts exist in test/unit/contracts.test.mjs; `npm run build && npm run test:contracts` has run with recorded behavior coverage and actual results.
- [x] `docs/handoffs/pi-guard/01-contracts.json` exists with the minimum schema above and records successful build and contract-suite results.
- [x] A worker reading this child and its handoff can identify all npm test targets, timeout units, final request binding fields, and evidence status semantics without asking the requester.
- [x] Evidence validation rejects missing/empty suites, missing required behavior coverage, and skipped/blocked/not-run proof represented as passed.
- [x] Peer dependency/module loading metadata is verified against the actual supported Pi version; no operational guard or native coverage is reported from this contract-only wave.

## Open Questions
- None — product scope is fixed by the requester; remaining API, backend, and test-harness choices have bounded investigation and replan routes.
