# [feat] Implement deterministic permission and command policy

## Work Type
feat

## Current State (As-Is)
- [confirmed] No permission policy implementation exists in the inspected root entry — Evidence: src/index.ts contains only console.log.
- [confirmed] Pi tool_call accepts block/reason and its input can be mutated by handlers — Evidence: ToolCallEventResult in tmp/pi-main/packages/coding-agent/src/core/extensions/types.ts and ExtensionRunner.emitToolCall().
- [confirmed] Codex separates parsed command rules from approval and sandbox orchestration — Evidence: ExecPolicyManager.create_exec_approval_requirement_for_parsed_commands() in tmp/codex-main/codex-rs/core/src/exec_policy.rs.
- [inferred] Raw path prefixes and naive shell splitting can misclassify the final operation — Confirm by: tests derived from actual canonicalization/parser boundaries using controlled fixtures.

## Desired Outcome (To-Be)
- Execution record (2026-10-01): implemented and verified on Darwin ARM64; current passing evidence, source/contract digests and build proof are in `docs/handoffs/pi-guard/02-policy.json`. Automated providers/UI are controlled doubles; native effects use the genuine pinned OS runtime.
- Deterministic policy returns allow, ask, or deny for the exact final local action under read-only or workspace-write.
- Protected control paths and data remain hard-denied regardless of model replies or reusable grants.
- Compound commands and unsupported shell syntax cannot inherit permission from a harmless-looking first segment.

## Scope
### In Scope
- Trusted settings validation, immutable effective profiles, path canonicalization and rule precedence.
- Argv-prefix matching and conservative shell analysis for policy decisions.
- Executable policy tests derived from settings, path, command and identity behavior, with actual results consumed by integration.
### Out of Scope
- [hard] Model calls, approval dialogs, backend launching, or editing shared contract/top-level build files.
- [hard] Treating MCP annotations or a caller-provided path string as verified authorization.
- [deferred] Full Codex Starlark language execution and configuration file compatibility.

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
- Use the child 01 request/decision/profile types and its command map; do not fork their field vocabulary.
- Policy settings may be narrowed by a trusted project layer, but project data never silently broadens a controller-owned boundary.
- Handle nonexistent paths via existing ancestors and resolve symlink targets; actual I/O must still be enforced at the OS boundary.
- Refuse blanket reusable interpreter prefixes. Preserve exact command semantics instead of rewriting scripts to fit a parser.
- Use reviewed parser support only when needed; no substring allowlist or naive split is an acceptable security parser.

## Related Files / Entry Points
- `docs/handoffs/pi-guard/01-contracts.json` (proposed) — first read the verified types, identity and script map before implementing policy.
- `src/contracts.ts` (proposed) — consume the immutable action and permission contracts established by child 01.
- `src/policy/` (proposed) — implement configuration validation, path analysis, command analysis, and pure rule decisions nearby.
- `test/unit/policy.test.mjs` (proposed) — derive assertions from verified path resolution, command analysis and trusted-setting precedence.
- `tmp/codex-main/codex-rs/core/src/exec_policy.rs` — inspect parsed command decision and forbidden/prompt/allow precedence as a semantic reference.
- `docs/handoffs/pi-guard/02-policy.json` (proposed) — expose the verified policy module and policy-suite evidence to the integration child.

## Execution Plan
### Stage 1 — Consume contracts and pin policy fixtures
- Starts when: `docs/handoffs/pi-guard/01-contracts.json` exists with state=ready, actual runtime versions, immutable action/profile types, and the test command map.
- Work: Establish policy inputs and trusted-setting precedence, protected fixture roots, canonical paths, supported command grammar, and exact action-identity binding.
- No-op when: The policy module passes current executable tests covering this brief's behavior under current contract and policy revisions.
- No-op handoff: Refresh `docs/handoffs/pi-guard/02-policy.json` with current passing suite results, coverage and policy hashes; let integration continue without policy edits.
- Deliverable: Verified policy inputs, supported grammar, resolved-target boundaries and coverage goals from which Stage 2 derives concrete tests.
- Verify: `Bounded inspection of the contract handoff and current policy source if present.`; Inputs: `docs/handoffs/pi-guard/01-contracts.json`, src/contracts.ts, src/policy/ and required behavior.; Expected: Precedence, resolved target/argv boundaries and unsupported syntax have explicit outcomes testable through the public decision interface.
- Ends when:
  - [x] Rule precedence and protected-path rules are explicit.
  - [x] The consumer uses the stabilized contract without new shared fields.
- Handoff: Stage 2 receives verified policy boundaries, coverage goals and supported grammar.
- Replan when: The required grammar or path resolution cannot be implemented safely within this contract; return to child 01/parent for a bounded contract or parser change before downstream integration.

### Stage 2 — Implement and prove deterministic decisions
- Starts when: Stage 1 has stabilized trusted config, canonical target, and command-analysis boundaries.
- Work: Implement deterministic decisions and derive tests for escapes, compound commands, deny precedence and corrupt/weakening configuration from actual decision paths.
- Deliverable: `docs/handoffs/pi-guard/02-policy.json` JSON with schemaVersion=1, state=ready, contractDigest, modulePaths, supportedGrammar, policyRevision semantics, testFiles, coveredBehavior and actual suite results.
- Verify: `npm run build && npm run test:policy`; Inputs: src/policy/, test/unit/policy.test.mjs and disposable path/argv fixtures derived during implementation.; Expected: Commands exit 0; the non-empty suite proves deny precedence and request binding with no path-prefix, symlink, unsupported-shell or interpreter-grant widening.
- Ends when:
  - [x] Required policy behavior has executable assertions and actual results.
  - [x] The handoff contains a verified module export map and no fabricated readiness.
- Handoff: Pi integration receives `docs/handoffs/pi-guard/02-policy.json` and the final-action decision contract.
- Replan when: Any fixture reveals an unsafe allow branch; stop the integration successor, repair this child's decision boundary, rerun its checks, and update the parent handoff state.

## Side Effect Checkpoints
- [x] Configuration load failures do not activate permissive defaults.
- [x] A model or cached grant cannot override a hard-deny result.
- [x] Canonicalization decisions remain input analysis, with symlink races independently covered by the native executor.
- [x] No policy test touches real home credentials or files outside its owned fixture.

## Acceptance Criteria
- [x] Tests derived from actual policy boundaries exist in test/unit/policy.test.mjs; `npm run build && npm run test:policy` has run with recorded behavior coverage and outcomes.
- [x] `docs/handoffs/pi-guard/02-policy.json` records successful build and policy-suite results under the current contract and policy revision.
- [x] Final input changes and policy revisions invalidate prior decisions through the shared identity fields.
- [x] Every required escape, precedence, parser, and trusted-settings case has a concrete negative assertion; the suite is not empty and no case is skipped.
- [x] The integration owner can consume this policy without adding a new model, changing Pi tool schemas, or weakening a protected boundary.

## Open Questions
- None — product scope is fixed by the requester; remaining API, backend, and test-harness choices have bounded investigation and replan routes.
