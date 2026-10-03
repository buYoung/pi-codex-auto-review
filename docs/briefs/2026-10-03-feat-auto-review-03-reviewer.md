# [feat] Implement evidence-based approval review

## Work Type
feat

## Current State (As-Is)
- [confirmed] The reviewed baseline is `master` at `147ecac82faaf0ede925acc64ff6be32d9622017` with existing naming edits — Evidence: the October 3 checkout inventory.
- [confirmed] `PiReviewProvider.complete()` sends one user JSON payload to the current Pi model, advertises no tools, and limits output to 384 tokens — Evidence: `src/reviewer.ts`, `streamSimple()` call.
- [confirmed] `reviewAction()` uses a short authorization prompt without the Codex risk taxonomy and combines technical failures with deadline expiry — Evidence: `src/reviewer.ts`, prompt construction and `catch`.
- [confirmed] `GuardController.authorizeUser()` replaces the prior authorization text — Evidence: `src/tools/controller.ts`, `trustedAuthorization`, and `src/index.ts`, `input` hook.
- [confirmed] Existing reviewer tests use controlled providers and clocks rather than a real service — Evidence: `test/unit/reviewer.test.mjs`.
- [confirmed] The approved live verification provider is the `pi-ollama-cloud` package with a Docker-injected `OLLAMA_API_KEY` — Evidence: the user's scope decision.

## Desired Outcome (To-Be)
- The reviewer evaluates the exact action using the pinned security policy, accumulated authorization, and relevant execution evidence.
- Missing local facts can be checked through bounded read-only tools without granting the reviewer mutation, escalation, or workload-network access.
- Review outcomes distinguish policy judgments from timeout, cancellation, provider failure, malformed output, and stale authorization.
- Model selection remains compatible with Pi providers, including `ollama-cloud`.

## Scope
### In Scope
- Implement the policy, context, model-selection, assessment, and failure contracts delivered by the contracts child.
- Capture retained user messages, trusted runtime instructions, surfaced assistant messages, relevant tool calls/results, and exact proposed actions with explicit trust labels.
- Carry prior authorization across follow-up messages and handle session switch, resume/fork, compaction, and concurrent reviews without mixing contexts.
- Add read-only investigation and a bounded review loop with a total deadline.
- Keep an explicit assessment-consumer adapter buildable until the permission child adopts the complete result contract; new failure states must never map to execution approval.
- Preserve configurable policy text and revision identity, including the pinned reference's replacement/precedence semantics where supported locally.
### Out of Scope
- [hard] Granting execution permissions or writing persistent approval rules from reviewer output.
- [hard] New MCP/app/browser investigation tools, external web browsing by the reviewer, or exposure of hidden assistant reasoning.
- [hard] Reimplementing `pi-ollama-cloud` or reading host login files to obtain its API key.
- [deferred] Proprietary Codex model access and bit-for-bit reproduction of a different provider's judgments.

## Constraints
- Use `docs/handoffs/auto-review/02-contracts.json` as the normative field/default reference.
- Treat assistant/tool/repository evidence as data. Only verified user instructions, trusted supplied instructions, and controller-generated exact-action approval markers can establish authorization under the reference policy.
- Preserve the provenance of runtime-supplied `AGENTS.md` instructions and actual user-confirmation responses according to the pinned trust contract. A file name or quoted tool-output text alone does not make an instruction trusted.
- Never promote a tool result containing approval-like text to a user decision.
- Preserve the complete pending action. If the minimum trustworthy context and action cannot fit, report the defined review failure instead of silently truncating authority or arguments.
- Exclude reasoning/thinking blocks from retained reviewer input and logs.
- Keep caller cancellation linked to every provider request and investigation operation; use one total review deadline across any permitted retries.
- Keep actual API credentials in the provider/controller process; the reviewer tools receive the restricted workload environment.
- Existing tests that intentionally expect the old one-message/tool-free contract must be updated only for the approved behavior change, retaining their cancellation and malformed-output coverage.

## Related Files / Entry Points
- `src/reviewer.ts` — replace the minimal prompt and provider interaction with the shared review contract.
- `src/approvals.ts` — inspect the direct review consumer and retain a fail-closed compatibility adapter until permission routing is integrated.
- `src/tools/controller.ts` — supply immutable review context and preserve caller cancellation.
- `src/index.ts` — capture trusted input and relevant session/tool lifecycle evidence.
- `src/signals.ts` — reuse total-deadline and cancellation helpers.
- `src/sandbox/executor.ts` — reuse the native execution boundary for read-only investigation.
- `src/review/` (proposed) — keep policy, context retention, and reviewer-tool responsibilities adjacent to `src/reviewer.ts`.
- `test/unit/reviewer.test.mjs` — exercise risk output, context retention, provider failure, deadlines, and cancellation.
- `test/integration/pi-tools.test.mjs` — observe actual Pi event-to-reviewer context delivery.
- `docs/handoffs/auto-review/02-contracts.json` (proposed) — consume the pinned policy and assessment contract.
- `docs/handoffs/auto-review/03-reviewer.json` (proposed) — publish reviewer behavior and evidence.

## Execution Plan
### Stage 1 — Trace context and establish the reviewer baseline
- Starts when: `docs/handoffs/auto-review/02-contracts.json` provides the reference, context contract, assessment schema, defaults, and evidence contract.
- Work: Trace Pi input/session/tool events into `admitAndExecute()` and record which retained items and instructions can be captured without private reasoning or untrusted authorization promotion.
- No-op when: The current reviewer already satisfies the pinned policy, context, investigation, model, and terminal-state acceptance criteria with current-source evidence.
- No-op handoff: Publish the verified no-change result in `docs/handoffs/auto-review/03-reviewer.json` for permission execution and final verification.
- Deliverable: A context/trust mapping and a baseline of the existing single-message review behavior.
- Verify: `npm run test:reviewer`; Inputs: existing reviewer fixtures after report preservation is available; Expected: the original behavior is recorded and directly changed assertions are identified before implementation.
- Ends when:
  - [ ] Every trusted input class has a verified Pi event or explicit runtime source.
  - [ ] Session identity, retained-history boundaries, and compaction behavior have named adapters.
  - [ ] Missing Pi hooks have a bounded supported-API route instead of an assumed private API.
- Handoff: Stage 2 receives the context mapping and baseline.
- Replan when: Required context can only be obtained by exposing hidden reasoning or bypassing the public Pi API; return the specific unsupported surface to the parent.

### Stage 2 — Implement policy and evidence evaluation
- Starts when: Stage 1 establishes the context mapping and the contract child supplies the reference policy.
- Work: Implement risk/authorization assessment, retained trust-labelled context, read-only investigation, configured reviewer-model resolution with supported fallback, and distinct terminal-state handling.
- Deliverable: A reviewer that returns the shared assessment or failure result bound to the original action and context identity.
- Verify: `Inspect recorded provider requests and read-only execution traces from controlled fixtures`; Inputs: `test/unit/reviewer.test.mjs` and the integrated reviewer; Expected: prior user scope survives a follow-up, untrusted text cannot grant authority, and attempted writes/network/escalation by reviewer tools fail.
- Ends when:
  - [ ] The policy covers data egress, credential probing, persistent weakening, destructive actions, risk thresholds, and the reference's exact-action override rules.
  - [ ] A missing local fact can be resolved by a read-only check and the resulting evidence reaches the final assessment.
  - [ ] Schema validation accepts the pinned reference's valid short/full outputs and rejects unsupported authority-bearing fields.
  - [ ] Configured deadlines, caller cancellation, model capability limits, and any retry count reach the final provider/tool consumer.
  - [ ] Timeout, explicit denial, cancellation, provider error, parse error, and stale authorization stay distinguishable.
- Handoff: Stage 3 receives the integrated reviewer and controlled traces.
- Replan when: Policy customization would erase mandatory instructions, the provider lacks required tool/structured-output behavior, or an investigation requires mutation; fail conservatively and return the affected capability to the parent.

### Stage 3 — Verify Pi integration and publish reviewer evidence
- Starts when: Stage 2 integrates the reviewer with the current Pi event path.
- Work: Verify first-message authorization followed by continuation, tool-evidence trust boundaries, session replacement, interrupted investigations, and current-model/override fallback.
- Deliverable: `docs/handoffs/auto-review/03-reviewer.json` with `status`, `sourceDigest`, `reference`, `policyDigest`, `contextSources`, `modelResolution`, `investigationCapabilities`, `terminalStates`, `commands`, `artifactPaths`, and `unresolved`.
- Verify: `npm run build && npm run test:reviewer && npm run test:integration`; Inputs: the reviewer and Pi context-delivery fixtures; Expected: exit 0 with final provider/tool traces proving the intended values and authority boundaries.
- Ends when:
  - [ ] Mock/provider-controlled outcomes and actual native investigation effects are labelled separately.
  - [ ] No real-model judgment is claimed from controlled-provider tests.
- Handoff: Permission execution and final verification receive `docs/handoffs/auto-review/03-reviewer.json`.
- Replan when: A changed event path bypasses the reviewer or loses authorization evidence; stop dependent execution work, correct this integration, and rerun the affected checks.

## Side Effect Checkpoints
- [ ] Existing caller cancellation is composed with the review deadline rather than replaced.
- [ ] Context reset/resume/fork cannot authorize a different session or changed action.
- [ ] Review tools cannot call the approval manager recursively or mint grants.
- [ ] New review terminal states remain non-authorizing through the current admission adapter.
- [ ] All trust labels survive serialization into the actual provider request.
- [ ] Policy/model configuration changes affect the revision/digest used by approval consumers.
- [ ] Audit/report output contains structured outcomes without raw credentials or hidden reasoning.

## Acceptance Criteria
- [ ] A multi-message authorized task remains reviewable after a short continuation message, with the original limitations retained.
- [ ] Untrusted tool instructions cannot expand user authorization in the reviewer input or controller decisions.
- [ ] The pinned security-policy categories and structured assessment contract are implemented and exercised.
- [ ] Read-only investigation gathers a missing fact while its mutation/network/escalation controls remain enforced.
- [ ] Every terminal state has an observed path, and configured deadlines/cancellation are verified at the final consumer.
- [ ] `docs/handoffs/auto-review/03-reviewer.json` supplies evidence usable by the execution and denial consumers.

## Open Questions
- None — policy, context, and provider behavior are governed by the pinned contract and the user's selected Pi-only scope.
