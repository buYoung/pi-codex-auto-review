# [test] Verify Pi approval parity in the Docker workflow

## Work Type
test

## Current State (As-Is)
- [confirmed] The inspected source is `master` at `147ecac82faaf0ede925acc64ff6be32d9622017` with the existing naming edits — Evidence: the October 3 `git status` inventory.
- [confirmed] The reviewed checkout passed 38 existing cases on macOS, but those cases encode the current implementation's behavior rather than a Codex compatibility matrix — Evidence: the October 3 suite records and `test/unit/reviewer.test.mjs`.
- [confirmed] Existing integration helpers supply a fake model and controlled provider — Evidence: `test/harness/pi.mjs`, `FAKE_MODEL`, `offlineModelRuntime()`, and `guardedFixture()`.
- [confirmed] Native tests observe real effects and refuse to turn missing isolation into a pass — Evidence: `test/native/sandbox.test.mjs` and `src/reports.ts`, `validateEvidence()`.
- [confirmed] The selected scope is current Pi execution/approval parity plus Docker verification through installed `pi-ollama-cloud` using environment-injected authentication — Evidence: the user's final decisions.
- [inferred] Integrated behavior may differ from individually passing children — Confirm by: rebuilding the final joined source and running the complete matrix through actual Pi and Docker consumers.

## Desired Outcome (To-Be)
- Each in-scope difference has an explicit reference, concrete scenario, expected route/outcome, and observed effect.
- Deterministic compatibility, native OS enforcement, and live Ollama behavior have separate evidence and pass conditions.
- One final source identity is qualified on macOS and the required Docker Linux target, with historical evidence preserved.
- The user receives reproducible commands and a truthful compatibility/limitation report.

## Scope
### In Scope
- Add or update focused conformance fixtures for the user-requested approval and Docker verification work.
- Register the focused suite with the existing test runner without changing production approval logic in this child.
- Rebuild the joined plugin and Docker image, execute existing suites plus conformance checks, and run bounded real-provider scenarios.
- Record reference mapping, native effects, terminal states, provider identity, run provenance, and operator commands.
- Update the execution/verification documentation to describe the actual resulting behavior and retained artifacts.
### Out of Scope
- [hard] Fixing production defects silently inside the verification child; return each failure to its owning child and reverify.
- [hard] Claiming identical free-text rationale, identical stochastic decisions on every input, or proprietary Codex-model equivalence.
- [hard] Replacing live calls with mocks, or weakening assertions when the selected model fails the policy scenario.
- [hard] New MCP/app/Computer Use coverage, Windows certification, local Ollama serving, or unrelated test/lint infrastructure.

## Constraints
- Use the pinned reference and gap/owner matrix from the contract handoff.
- Preserve previous suite/run artifacts before executing any legacy command.
- Compare behavior and observable effects rather than exact rationale prose.
- Keep synthetic-provider tests, real native controls, and real-provider requests distinctly labelled.
- Use only owned temporary files and services. Real API credentials authenticate the provider; they are never fixture contents or prompts.
- Require a finite live scenario list and record call/deadline limits before execution.
- Missing credentials, missing model, unsupported Docker isolation, and service failures are explicit non-passing prerequisites/outcomes.
- Preserve existing package exports, scripts, tool schemas, grant persistence, cancellation, and deadline units.
- Keep the existing required `darwin-arm64` and `linux-x64` qualification targets explicit; additional architecture results do not replace them.

## Related Files / Entry Points
- `scripts/suites.mjs` — register only the targeted conformance coverage.
- `scripts/run-tests.mjs` — consume its run/evidence API without changing ownership of storage semantics.
- `scripts/verify-guard.mjs` — integrate the completed evidence matrix into aggregate reporting.
- `package.json` — expose the focused verification command after its implementation exists.
- `test/unit/reviewer.test.mjs` — preserve directly affected review assertions.
- `test/unit/approvals.test.mjs` — preserve lifecycle and grant assertions.
- `test/integration/pi-tools.test.mjs` — observe final values and behavior through Pi.
- `test/native/sandbox.test.mjs` — reuse actual allowed/denied controls.
- `test/conformance/auto-review.test.mjs` (proposed) — own reference-based behavioral scenarios.
- `test/docker/live-review.mjs` (proposed) — own bounded real-provider workflow cases on the Docker harness.
- `README.md` — document actual compatibility, Docker usage, and result retrieval.
- `docs/handoffs/auto-review/01-evidence.json` (proposed) — consume required-platform and artifact contracts.
- `docs/handoffs/auto-review/05-denials.json` (proposed) — consume the completed permission/review/lifecycle chain.
- `docs/handoffs/auto-review/06-docker-cloud.json` (proposed) — consume the qualified image and exact launch commands.
- `docs/handoffs/auto-review/07-conformance.json` (proposed) — publish the final joined-source result.

## Execution Plan
### Stage 1 — Assemble the final scenario matrix
- Starts when: `docs/handoffs/auto-review/01-evidence.json`, `docs/handoffs/auto-review/05-denials.json`, and `docs/handoffs/auto-review/06-docker-cloud.json` identify compatible completed contracts, the full approval chain, and a qualified Docker/provider route.
- Work: Read all preceding handoffs, record the joined implementation baseline, and map each contract difference to deterministic, native, and live proof paths with explicit expected observations.
- No-op when: Matching final-source artifacts already cover every scenario, side-effect checkpoint, required platform, and real-provider acceptance criterion.
- No-op handoff: Publish the verified existing artifact references in `docs/handoffs/auto-review/07-conformance.json` and return the complete acceptance judgment to the parent.
- Deliverable: A finite scenario matrix, implementation-baseline identity, and live execution envelope.
- Verify: `Inspect the matrix against 02-contracts.json gap owners and the actual handoff artifact paths`; Inputs: every preceding handoff and final checkout; Expected: every in-scope row has a proof path and every excluded surface retains its explicit exclusion.
- Ends when:
  - [ ] The matrix distinguishes automatic approval, manual approval, absolute denial, timeout, cancellation, and technical failure.
  - [ ] It includes cumulative authorization, untrusted evidence, read-only investigation, rule precedence/syntax, wildcard domains, protected-path reads/writes, network escalation, exact retry, and circuit breaking.
  - [ ] Live cases include a routine allowed action, an authorized outside action, a protected-path denial, and a reviewer-policy denial using harmless owned targets.
- Handoff: Stage 2 receives the implementation baseline and complete matrix.
- Replan when: A predecessor is incomplete, a reference has changed, or a proof fails during no-op evaluation; stop successors, return to the parent, activate bounded correction plus reverification in the owning child, and recalculate topology/handoffs before resuming.

### Stage 2 — Execute deterministic and native compatibility checks
- Starts when: Stage 1 supplies the complete matrix and an identified integrated implementation baseline.
- Work: Implement focused fixtures, then freeze the complete source identity including those fixtures before rebuilding the plugin and Docker image. Execute existing suites and verify required platform effects without rewriting expected behavior to hide failures.
- Deliverable: Immutable deterministic/native result sets with observed allowed and denied effects.
- Verify: `npm run build && npm run test:contracts && npm run test:policy && npm run test:reviewer && npm run test:approvals && npm run test:native && npm run test:integration && npm run test:e2e`; Inputs: the complete checkout frozen after fixture authoring and its owned fixture population, with equivalent container commands from `06-docker-cloud.json`; Expected: exit 0 on each required qualified platform and separately retained conformance-suite outcomes.
- Ends when:
  - [ ] The actual final consumer receives the admitted permissions, configured timeouts, cancellation, and model/context options.
  - [ ] Denied sentinels are unchanged and authorized effects are positively observed.
  - [ ] Repeated runs preserve earlier reports and architecture identities.
  - [ ] Every newly added verification command exists in `package.json` and identifies its concrete fixture targets.
- Handoff: Stage 3 receives matching-source deterministic/native evidence and the qualified rebuilt image.
- Replan when: Any proof fails; stop the final join, assign the defect to its owning child, perform bounded correction and reverification, and refresh the parent handoffs/source identity before continuing.

### Stage 3 — Run the bounded real-provider workflow
- Starts when: Stage 2 passes and the operator supplies the Docker runtime key and a supported `OLLAMA_MODEL`.
- Work: Run the finite live cases through actual Pi, installed `pi-ollama-cloud`, and the built guard; capture separate main-agent/reviewer calls, decisions, user-visible status, and native effects.
- Deliverable: A retained live-provider report linked to the same source and image identities as the deterministic/native results.
- Verify: `Execute the recorded live Docker command`; Inputs: `test/docker/live-review.mjs`, the qualified image, runtime-injected key/model, and owned synthetic targets; Expected: real provider calls and intended allow/deny effects are observed without mock substitution or credential disclosure.
- Ends when:
  - [ ] The authorized outside action proceeds through automatic review without an unnecessary manual prompt.
  - [ ] The live reviewer-policy denial leaves its harmless target unchanged and returns the appropriate feedback.
  - [ ] Cancellation/provider failures have explicit recorded outcomes and cannot qualify as successful policy judgments.
  - [ ] The inspected report/log population is nonempty and contains no runtime credential values.
- Handoff: Stage 4 receives live evidence and any limitations.
- Replan when: A live result violates the expected route or safety outcome; stop successors, return the concrete result to the owning implementation/provider child, correct and reverify, then recalculate the final evidence join before resuming.

### Stage 4 — Publish the compatibility result and operator route
- Starts when: Stage 3 supplies live evidence and all required matrix rows have actual results.
- Work: Validate aggregate evidence, update usage/verification instructions, and publish the reference-by-reference result without erasing historical records.
- Deliverable: `docs/handoffs/auto-review/07-conformance.json` with `status`, `sourceDigest`, `contractDigest`, `reference`, `scenarioMatrix`, `requiredPlatforms`, `platformRuns`, `liveRun`, `packagePins`, `commands`, `artifactPaths`, `limitations`, and `unresolved`.
- Verify: `npm run verify:guard`; Inputs: the final joined source and matching retained platform evidence, plus bounded inspection of the live report and README commands; Expected: exit 0 only when all required evidence qualifies and every documented command resolves to the recorded environment/artifacts.
- Ends when:
  - [ ] The report distinguishes recovered history, reconstructed harness assets, and newly executed evidence.
  - [ ] The operator can identify installation, key/model variable names, execution, result retrieval, and owned cleanup commands.
  - [ ] No unqualified platform or excluded product feature is described as compatible.
- Handoff: The parent receives `docs/handoffs/auto-review/07-conformance.json` for global acceptance and completion reporting.
- Replan when: Aggregation finds missing/stale evidence; stop completion, return to the responsible producer, perform bounded correction/reverification, and refresh topology/handoffs if ownership or scope changed.

## Side Effect Checkpoints
- [ ] Existing seven native tools, nested calls, direct user bash, edit helpers, and structured/streaming results remain functional.
- [ ] Existing configuration and grants load compatibly with the intended policy invalidation behavior.
- [ ] Guarded startup and reload cannot fall back to unguarded tools after an extension failure.
- [ ] Model/API credentials are absent from workload processes, prompts, artifacts, and diagnostic output.
- [ ] New verification commands do not make ordinary offline suites perform live requests.
- [ ] README compatibility statements match the actual scope and final evidence.

## Acceptance Criteria
- [ ] Every in-scope gap has a referenced, executed proof with the expected route and observable effect.
- [ ] All existing affected suites and focused conformance coverage pass on the required qualified macOS/Linux targets for the same final source.
- [ ] Docker runs installed `pi-ollama-cloud` and the current guard with runtime-only Ollama API authentication.
- [ ] A real main-agent/reviewer workflow demonstrates automatic boundary approval and a policy denial on owned targets.
- [ ] No blocked, skipped, stale, simulated, or wrong-architecture result is counted as the missing required evidence.
- [ ] Repeated verification preserves historical and current result retrieval.
- [ ] The final handoff and README provide reproducible commands and state every remaining limitation truthfully.

## Open Questions
- None — scope and provider selection are user-approved; runtime credentials/model selection are explicit operator inputs.
