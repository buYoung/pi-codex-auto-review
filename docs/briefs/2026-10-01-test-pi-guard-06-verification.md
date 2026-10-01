# [test] Prove complete guard behavior and packaged consumption

## Work Type
test

## Current State (As-Is)
- [confirmed] The authoring checkout contains no implemented guard or feature test suite — Evidence: src/index.ts placeholder and package.json scripts.build on 2026-10-01.
- [confirmed] The requester explicitly chose briefset completion/validation now and mandatory feature tests during implementation — Evidence: the answered test-execution scope question in this conversation.
- [confirmed] The requester wants test code derived during implementation without a fixed advance case catalog — Evidence: the latest clarification in this conversation.
- [confirmed] No runtime enforcement evidence exists in the authoring checkout — Evidence: placeholder entry and no implemented sandbox executor; source/API availability alone does not establish enforcement.
- [inferred] Green unit or document checks could be mistaken for complete protection — Confirm by: reviewing actual suite coverage, native controls and final-consumer evidence.

## Desired Outcome (To-Be)
- Execution record (2026-10-01): all seven suites passed on Darwin ARM64 (38 executed tests, no skips). `npm run verify:guard` returned 1 because the required Linux x64 runner is unavailable; the version-bound final handoff is `environment-blocked`, not complete. Correction owners 04/06 must qualify the matching source on Linux and rerun the complete matrix before set-level acceptance.
- All required logical cases have concrete executable assertions and actual version-bound results.
- An isolated, fake-provider Pi task demonstrates permitted work and denied effects through real final native consumers.
- The packed extension and guarded startup route work without the source checkout or duplicate Pi runtime packages.
- Final evidence separates functional failures, unsupported environments and actual pass results for each target platform.

## Scope
### In Scope
- Workflow tests, packed consumption and evidence aggregation derived from the actual integrated execution routes.
- Re-execute established unit/native/integration/workflow suites and required side-effect checks on qualified platforms.
- Bounded regression assertions for defects found during verification, routed back to the implementation owner for corrections.
- Addressable final implementation/test evidence and truthful platform/support status.
### Out of Scope
- [hard] Claiming functionality or native enforcement from the briefset structural validator.
- [hard] Live provider traffic, paid model calls, real credential reads, global settings changes or package publication.
- [hard] Bypassing missing native dependencies, skipped required cases, or an unavailable Linux runner by marking tests passed.
- [hard] Broad production rewrites in this verification child; failed proofs return to the owning implementation child.
- [deferred] Performance thresholds, native Windows qualification and remote MCP server internals.

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
- Own test/e2e/guard.test.mjs, scripts/verify-guard.mjs and final report aggregation. Root metadata and production corrections remain with the named owning child.
- Reports identify test names/files, covered behavior, suite, platform, source/contract/runtime versions, commands, outcomes and observed effects using the shared report contract.
- Completion requires non-empty executed suites and proof of required brief behavior; missing, skipped, failed, blocked or not-run required proof prevents completion.
- Record Linux execution on an actually qualified Linux host. If absent, keep its required native result blocked and leave set-level cross-platform completion unchecked.
- Paid/live model validation is not necessary for this test contract and must not be silently added; injected provider output tests exercise deterministic admission.
- A report filename or worker-reported sandbox flag alone is insufficient native evidence. Preserve the permitted and forbidden controls observed by the test harness.

## Related Files / Entry Points
- `docs/handoffs/pi-guard/01-contracts.json` (proposed) — consume shared interfaces, suite/evidence status semantics and the executable command map.
- `docs/handoffs/pi-guard/02-policy.json` (proposed) — inspect verified policy behavior and source hashes.
- `docs/handoffs/pi-guard/03-review.json` (proposed) — inspect verified reviewer/approval behavior, cancellation and redaction evidence.
- `docs/handoffs/pi-guard/04-sandbox.json` (proposed) — inspect actual native platform qualification and native controls.
- `docs/handoffs/pi-guard/05-integration.json` (proposed) — start execution only after final tool routes and guarded startup are ready.
- `test/e2e/guard.test.mjs` (proposed) — derive workflow tests from actual integration using fake providers and real qualified consumers.
- `scripts/verify-guard.mjs` (proposed) — run established non-empty suites and check required behavior proof from actual tests and handoffs.
- `package.json` — consume the established build/test/pack entry points and verify package metadata without publishing.
- `.reports/pi-guard/` (proposed) — write versioned platform and suite evidence without secrets.
- `docs/handoffs/pi-guard/06-verification.json` (proposed) — publish overall completion or explicit failure/blocked evidence.

## Execution Plan
### Stage 1 — Verify all producer handoffs and proof readiness
- Starts when: `docs/handoffs/pi-guard/01-contracts.json`, `docs/handoffs/pi-guard/02-policy.json`, `docs/handoffs/pi-guard/03-review.json`, `docs/handoffs/pi-guard/04-sandbox.json`, `docs/handoffs/pi-guard/05-integration.json` exist with the required ready contracts/modules, current suite reports and qualified platform data.
- Work: Inspect producer versions, actual test files and coverage, native controls, startup routes and package targets; identify missing behavior proof before a complete run.
- No-op when: None — the requester requires explicit complete-run evidence, so this child performs verification even when production source edits are unnecessary.
- No-op handoff: None — verification always produces a current report; it never invents production edits to create work.
- Deliverable: A complete-run fixture/platform/command manifest with implementation owners for every failed proof.
- Verify: `Bounded inspection of all five producer handoffs and actual test coverage, then npm run build.`; Inputs: `docs/handoffs/pi-guard/01-contracts.json`, `docs/handoffs/pi-guard/02-policy.json`, `docs/handoffs/pi-guard/03-review.json`, `docs/handoffs/pi-guard/04-sandbox.json`, `docs/handoffs/pi-guard/05-integration.json`, test files, root manifest and guard/worker assets.; Expected: Versions agree, required behavior has executable proof or a named gap, claimed platforms have native controls, and build exits 0.
- Ends when:
  - [ ] Every needed fixture/runner/consumer artifact is available and the established suites are non-empty.
  - [ ] Platform limitations are explicit and no blocked result is relabeled ready.
- Handoff: Stage 2 receives the complete-run manifest and defect-to-owner map.
- Replan when: Any handoff is stale, incomplete or unsupported; stop dependent verification, return to the parent, activate bounded correction and re-verification in the owning child, then recalculate topology and handoffs before resuming.

### Stage 2 — Execute final workflows and package consumption
- Starts when: Stage 1 supplies the complete-run manifest, isolated fake-provider harness and qualified native executor.
- Work: Derive and implement workflow/package tests from final consumers, approval concurrency, !/!! routes, protected startup and loading; add focused regressions for discovered defects and execute the suite.
- Deliverable: Actual workflow-suite results, behavior coverage and a reproducible package-consumer record for Stage 3.
- Verify: `npm run build && npm run test:e2e`; Inputs: test/e2e/guard.test.mjs, prior suite artifacts, isolated Pi directories, native backend and tarball produced with npm pack --ignore-scripts --json in an owned artifact directory.; Expected: Commands exit 0; the non-empty suite proves required final behavior, permitted/denied effects, protected startup and loading without source paths or real auth/provider calls.
- Ends when:
  - [ ] Final native consumer effects are observed, not inferred from mocks.
  - [ ] The packed package and guarded startup work through the verified host API.
  - [ ] No owned test leaves a live child/service or writes outside its fixture root.
- Handoff: Stage 3 receives the actual workflow, package and cleanup evidence.
- Replan when: A workflow or package proof fails; stop final acceptance, return to the parent and owning implementation child for bounded correction plus re-verification, then refresh affected reports and handoffs before continuing.

### Stage 3 — Run the complete matrix and publish truthful evidence
- Starts when: Stage 2 supplies successful final workflow/package evidence and all producer checks are current.
- Work: Run established suites on applicable qualified platforms, review required coverage and side-effect checkpoints, publish actual results and route proof gaps to their implementation owners.
- Deliverable: `docs/handoffs/pi-guard/06-verification.json` JSON with schemaVersion=1, state=complete only when required checks pass, source/contract/runtime versions, platformResults, coveredBehavior, testFiles, suiteCommands, actual results, blockedReasons, packageProof, cleanup and trustBoundaries.
- Verify: `npm run verify:guard`; Inputs: Actual test files and coverage, producer handoffs, .reports/pi-guard/ records and package proof; run after creating the aggregator and repeat native/final-consumer checks on a qualified Linux host before claiming Linux success.; Expected: Exit 0 and state=complete only when established suites run and required behavior has genuine proof with no unresolved failure or environment gap; otherwise record exact failure/blocked status.
- Ends when:
  - [ ] Actual suite results account for required behavior on each applicable platform; missing proof is explicit.
  - [ ] Native and mock evidence are distinguishable and every claimed platform has actual controls.
  - [ ] The non-empty scoped audit/output population contains no full synthetic secret markers.
- Handoff: The parent receives `docs/handoffs/pi-guard/06-verification.json` for set-level acceptance and may tick child status only after the required proof succeeds.
- Replan when: Any final proof fails or is blocked; stop acceptance, return to the parent, assign bounded correction/re-verification to its owner and recalculate affected waves and handoffs before resuming.

## Side Effect Checkpoints
- [x] Existing Pi tool names, schemas, structured output, streaming, edit matching/encoding and BashOperations option units remain compatible at final consumers.
- [x] Model/user/nested/codemode and !/!! effects share actual admission and execution restrictions.
- [x] One-use/session/persistent grants, concurrent dialogs, cancellation, reload and policy revision changes do not cross-authorize requests.
- [x] Backend startup, IPC failure, dependency absence and package loading failure never produce unconstrained local execution.
- [x] Fixture files, processes, sockets and services are cleaned up; no real user resource or global setting is touched.
- [x] Packed files include worker assets and do not bundle a second host Pi registry.
- [x] Audit redaction checks scan a non-empty explicitly enumerated result population.
- [x] Linux and Darwin results use actual matching source/contract/runtime versions rather than an unverified merged report.

## Acceptance Criteria
- [x] Tests derived from integrated workflows exist in test/e2e/guard.test.mjs; `npm run build && npm run test:e2e && npm run verify:guard` has run with recorded coverage and actual results.
- [x] `docs/handoffs/pi-guard/06-verification.json` identifies actual test files, commands, outcomes and observed effects after all stages and side-effect checkpoints.
- [x] npm run verify:guard exits 0 only when established non-empty suites run and required behavior/native/final-consumer coverage has no unresolved gap.
- [x] Workflow tests prove permitted work, denied shell/file effects, narrow elevation, adversarial command handling, concurrent approval isolation and user-shell parity.
- [x] Tests prove packed consumption and protected startup through supported public APIs without source-checkout dependencies or unconstrained fallback.
- [x] Evidence review refuses empty/skipped/blocked/not-run proof and mock-only native claims; missing Linux qualification remains visible and prevents Linux success claims.
- [x] Full synthetic secret markers are absent from the non-empty owned audit/output artifacts and no real credentials or paid model calls were used.
- [ ] Every failure is corrected by its implementation owner and affected proofs are rerun before the parent reports completion.

## Open Questions
- None — the requester confirmed authoring/validation now and mandatory feature-test execution during implementation; technical environment gaps have explicit investigation and blocked/replan routes.
