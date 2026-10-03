# [feat] Define the Codex compatibility contract

## Work Type
feat

## Current State (As-Is)
- [confirmed] The inspected implementation is `master` at `147ecac82faaf0ede925acc64ff6be32d9622017` with existing package-name edits — Evidence: `git status` on 2026-10-03.
- [confirmed] `GuardAction`, `PermissionDelta`, `Grant`, and `WorkerFrame` carry immutable action identity and execution permissions — Evidence: `src/contracts.ts`, named interfaces and `createAction()`.
- [confirmed] Settings expose two filesystem modes, command rules, timeouts, domains, and trusted tool names, but no reviewer-routing or structured risk contract — Evidence: `src/policy/index.ts`, `GuardSettings` and `validateSettings()`.
- [confirmed] Reviewer replies currently contain `decision` and `reason`; grants are persisted separately — Evidence: `src/reviewer.ts`, `ReviewReply`, and `src/approvals.ts`, `FileGrantPersistence`.
- [confirmed] The local Codex CLI reported `0.160.0`; the source copy under `tmp/codex-main/` has no verified commit correspondence — Evidence: the recorded `codex --version` inspection and the source-copy inventory.
- [confirmed] The user selected parity for current Pi execution/approval surfaces and excluded new MCP, app, and Computer Use implementations — Evidence: the 2026-10-03 decision response.

## Desired Outcome (To-Be)
- All implementation children consume one versioned definition of action review, permission routing, outcome states, and compatibility scope.
- A pinned, retrievable Codex reference defines expected behavior; unverified local source details never silently become requirements.
- Existing Pi tool contracts and stored data have explicit compatibility treatment.

## Scope
### In Scope
- Establish the reference manifest and a complete behavior-to-owner matrix for the prior review findings.
- Define additive action/request, risk assessment, terminal-state, reviewer-context, denial-history, and retry-authorization contracts.
- Define settings/defaults for reviewer routing, eligible approvals, review-model selection, policy text, and rule interpretation on existing Pi surfaces.
- Specify how execution-rule grants, scoped permission deltas, and absolute policy denials differ.
- Stabilize the fields required by Docker provider loading and reproducible evidence.
### Out of Scope
- [hard] Introducing a new MCP client, connector platform, browser, or Computer Use engine.
- [hard] Claiming identical stochastic outputs from Codex and an Ollama model.
- [deferred] Enterprise administration UIs, managed-service integration, Windows qualification, and unrestricted full-access operation.

## Constraints
- Preserve `pi-codex-auto-review`, its `./startup` export, `createGuardExtension()`, `createGuardedRuntime()`, current CLI flags, and the seven native tool names.
- Preserve existing `mode`, `commandRules`, `allowedDomains`, `reviewTimeoutMs`, `approvalTimeoutMs`, `executionTimeoutSeconds`, and `trustedTools` inputs; add documented defaults and adapters rather than silently rejecting old valid configurations.
- Keep review/UI deadlines in milliseconds and command execution deadlines in seconds.
- Preserve existing action identity fields and stored grant readability. If a new policy digest invalidates a grant, report that explicitly instead of reusing it under changed authority.
- Distinguish exact-action retry identity from a fresh attempt's `toolCallId`; a retry must remain bound to semantic input and session/context without requiring reuse of an old invocation ID.
- Add new protocol fields compatibly or introduce an explicit version decoder; never send an unsupported frame shape to the existing broker.
- Keep the intermediate checkout buildable and conservatively executable; this child defines contracts without enabling half-wired elevation.
- Preserve the evidence contract delivered by the preceding child.

## Related Files / Entry Points
- `src/contracts.ts` — define the shared request, result, context, and protocol contracts.
- `src/policy/index.ts` — extend `GuardSettings` and its validation/default mapping.
- `src/reviewer.ts` — inspect existing provider and reply contracts before designing adapters.
- `src/approvals.ts` — inspect grant binding, persistence, and admission consumers.
- `src/startup.ts` — inspect supported runtime options and explicit trusted-extension loading.
- `test/unit/contracts.test.mjs` — validate additive contracts and old payload/config compatibility.
- `tmp/codex-main/codex-rs/guardian-context/` — investigate reference context handling after establishing provenance.
- `tmp/codex-main/codex-rs/ext/guardian-reviewer/src/` — compare assessment, routing, model, completion, and circuit-breaker behavior against the pinned reference.
- `docs/handoffs/auto-review/01-evidence.json` (proposed) — consume the preceding report contract.
- `docs/handoffs/auto-review/02-contracts.json` (proposed) — publish the compatibility and ownership manifest.
- https://learn.chatgpt.com/docs/sandboxing/auto-review — official lifecycle and scope baseline.
- https://learn.chatgpt.com/docs/agent-approvals-security — official approval and sandbox behavior.
- https://learn.chatgpt.com/docs/agent-configuration/rules — official command-rule semantics.

## Execution Plan
### Stage 1 — Pin the reference and map every difference
- Starts when: `docs/handoffs/auto-review/01-evidence.json` confirms the immutable report contract and the current checkout is recorded.
- Work: Resolve a public Codex revision corresponding to the inspected CLI version, record source URLs/revision and documentation retrieval dates, and map every reviewed difference to its owning child or the user's explicit exclusion.
- No-op when: An existing current-source manifest already pins a retrievable reference and covers every acceptance item in this child.
- No-op handoff: Publish verified existing references and no-change evidence in `docs/handoffs/auto-review/02-contracts.json` so the reviewer and Docker children can start.
- Deliverable: A pinned reference inventory and a complete gap/owner matrix.
- Verify: `Inspect the reference manifest against the prior review and the selected upstream files`; Inputs: the three official URLs above, the local source-copy provenance, and `codex --version`; Expected: every normative behavior has an identifiable reference and no unknown revision is presented as verified.
- Ends when:
  - [ ] The reference distinguishes documented behavior from snapshot-only details.
  - [ ] The matrix covers automatic elevation, policy, transcript context, read-only investigation, model selection, review triggers, rules, filesystem boundaries, dynamic network requests, failure states, circuit breaking, exact retry approval, UI/audit feedback, wildcard-domain matching, and the incorrect application of write denial to shell reads.
  - [ ] New MCP/app/Computer Use implementations and unsupported platform/product features are explicitly excluded.
- Handoff: Stage 2 receives the reference inventory and gap/owner matrix.
- Replan when: The matching public revision cannot be established or contradicts the documented target in a material way; stop dependent behavior changes and return the concrete discrepancy to the parent.

### Stage 2 — Stabilize compatible settings and data contracts
- Starts when: Stage 1 establishes the normative reference and ownership map.
- Work: Define shared types, compatible settings, trust-labelled context, distinct review terminal states, per-action permission authority, and exact-action retry markers with the minimum adapters required for existing consumers.
- Deliverable: Buildable shared contracts and a migration table naming preserved fields, new defaults, invalidated grants, and unsupported categories.
- Verify: `npm run build && npm run test:contracts && npm run test:policy`; Inputs: existing contract/policy fixtures plus directly affected compatibility cases; Expected: exit 0 with old valid payloads/settings still accepted and malformed new data rejected.
- Ends when:
  - [ ] `allow`/`deny` assessment, risk, authorization, rationale, timeout, cancellation, and technical failure have unambiguous representations.
  - [ ] Existing Pi surfaces have a defined approval-policy/reviewer mapping, including no-UI behavior and explicit unsupported categories.
  - [ ] Rule-based authority and sandbox-boundary approval cannot be confused with an absolute policy denial.
  - [ ] A model override can be resolved through Pi's registry without hard-coding a Codex-only model identifier.
- Handoff: Stage 3 receives the contracts and migration table.
- Replan when: Compatibility requires a public API removal, a new runtime dependency outside the existing Pi model APIs, or a different user-visible scope; return the specific change to the parent.

### Stage 3 — Publish the contract handoff
- Starts when: The shared contracts pass the affected checks.
- Work: Record exact symbols, defaults, policy/reference identities, wire and persistence compatibility, provider-loading seams, and executable verification commands.
- Deliverable: `docs/handoffs/auto-review/02-contracts.json` with `status`, `reference`, `gapOwners`, `settings`, `authorityModes`, `requestSchema`, `assessmentSchema`, `terminalStates`, `contextContract`, `protocolCompatibility`, `grantMigration`, `providerLoading`, `evidenceContract`, and `unresolved`.
- Verify: `Inspect each manifest entry against exported types and callers`; Inputs: the manifest and `src/contracts.ts`, `src/policy/index.ts`, `src/approvals.ts`, `src/startup.ts`; Expected: every downstream field names an implemented contract or an explicitly assigned later behavior, without claiming that behavior already works.
- Ends when:
  - [ ] All downstream consumers have concrete field names, defaults, and version handling.
  - [ ] The parent can start reviewer and Docker integration without another product interview.
- Handoff: Reviewer, permission-execution, Docker, and final-verification work receive `docs/handoffs/auto-review/02-contracts.json`.
- Replan when: A manifest field has no producer or requires mutually incompatible consumers; correct the contract and rerun its checks before releasing it.

## Side Effect Checkpoints
- [ ] Stored `Grant` records remain readable and cannot gain broader authority through defaulting.
- [ ] `GuardAction.digest`, `ruleDigest()`, policy revision, source, cwd, session, and permission binding remain effective.
- [ ] `WorkerJob`, `WorkerFrame`, and `BrokerControlFrame` compatibility is explicit at both endpoints.
- [ ] Existing Pi tool parameter/result schemas and guarded startup remain intact.
- [ ] The evidence contract remains compatible with the first child's writer/reader changes.

## Acceptance Criteria
- [ ] The reference and gap/owner matrix cover every in-scope finding and every user-approved exclusion.
- [ ] All later children can name the same assessment, terminal-state, authorization, and permission contracts.
- [ ] Existing configurations, public exports, valid persisted records, and tool contracts pass the compatibility checks.
- [ ] No claim of full Codex product parity or identical Ollama/Codex model judgments appears in the manifest.
- [ ] `docs/handoffs/auto-review/02-contracts.json` supplies a usable, versioned handoff with no unresolved blocking contract decision.

## Open Questions
- None — the user fixed the product scope; technical reference and adapter choices have bounded investigation and replan routes.
