# [feat] Apply reviewed permissions to exact Pi actions

## Work Type
feat

## Current State (As-Is)
- [confirmed] The inspected source is `master` at `147ecac82faaf0ede925acc64ff6be32d9622017` with the existing naming edits — Evidence: the October 3 `git status` inventory.
- [confirmed] At the inspected baseline, `reviewAction()` converts model approval with a nonempty permission delta into human approval or denial — Evidence: `src/reviewer.ts`, `hasDelta` branch.
- [confirmed] `ApprovalManager.admit()` executes model-approved actions with `EMPTY_DELTA`; explicit UI grants carry the requested delta — Evidence: `src/approvals.ts`, review and UI branches.
- [confirmed] Shell decisions review many commands regardless of whether the sandbox permits them and always review `curl`/`wget` — Evidence: `src/policy/index.ts`, `shellDecision()`.
- [confirmed] Domain checks use exact array membership although settings and the native backend accept wildcard domains — Evidence: `validateSettings()`, `shellDecision()`, and `nativeConfig()`.
- [confirmed] Shell path checks apply `denyWrite` even to read operands; the default profile omits workspace `.agents` and `.codex` — Evidence: `src/policy/index.ts`, operand loop and `defaultProfile()`.
- [confirmed] The native broker starts without an approval callback and uses a strict domain allowlist — Evidence: `src/sandbox/broker.ts`, `SandboxManager.initialize()`, and `src/sandbox/config.ts`.
- [confirmed] Command rules are JSON literal prefixes and do not implement Codex outside-sandbox allow semantics — Evidence: `CommandRule`, `matchesPrefix()`, and `admitAndExecute()`.

## Desired Outcome (To-Be)
- Existing Pi actions cross an approval boundary through the pinned reviewer-routing policy, and an approved exact action receives its authorized execution permissions.
- Routine sandbox-permitted actions avoid unnecessary review; absolute policy denials remain non-overridable.
- Filesystem, command-rule, and network decisions agree with the actual execution boundary.
- No approval leaks into a sibling, later action, changed cwd, or changed policy.

## Scope
### In Scope
- Wire shared approval settings and reviewer outcomes through policy, admission, controller, broker, and final native execution.
- Implement automatic per-action elevation, explicit permission requests, rule-granted execution authority, and no-UI semantics from the pinned contract.
- Correct wildcard-domain matching and read-versus-write protection classification.
- Align ordinary read access, temporary roots, protected workspace metadata, and resolved Git-directory handling with the selected reference.
- Implement the documented `prefix_rule` surface needed for Codex-compatible command rules, including strongest-decision precedence, alternatives, justification, and match/not-match checks.
- Route eligible runtime network-boundary requests to review with the originating action and exact destination context.
### Out of Scope
- [hard] New MCP/app/Computer Use execution adapters.
- [hard] Treating arbitrary trusted-extension code as sandboxed workload code.
- [hard] Turning off the native guard globally to simulate successful elevation.
- [deferred] General-purpose Starlark execution beyond the documented command-rule contract.

## Constraints
- Use the contract and reviewer handoffs; do not invent a second assessment or permission schema.
- Preserve existing Pi input/result fields, streaming callbacks, edit semantics, nested calls, and direct user-bash handling.
- Add any necessary escalation input compatibly; keep existing valid calls executable.
- Separate base-sandbox protection from absolute controller/policy denial. A base restriction that Codex permits reviewing must not remain an accidental unconditional refusal.
- Keep the controller's own code, credentials, and policy store protected; document any necessary host-specific exception in the compatibility matrix rather than claiming it matches Codex.
- Apply full command-scoped elevation only when the pinned rule/approval contract authorizes it; otherwise retain narrow deltas. Never silently convert one authority class into the other.
- Preserve caller signals, configured seconds/milliseconds, exact action binding, file mutation serialization, and per-invocation isolation.
- Re-evaluate action identity and resolved permissions immediately before execution.
- Preserve legacy JSON command rules through an explicit adapter while adding the supported Codex rule format.

## Related Files / Entry Points
- `src/policy/index.ts` — change routing, profiles, domain matching, and permission classification.
- `src/policy/shell.ts` — align conservative shell splitting and rule application.
- `src/policy/paths.ts` — preserve canonical paths and resolve protected Git/worktree targets.
- `src/approvals.ts` — propagate reviewed authority and scoped grants.
- `src/tools/controller.ts` — bind the final action to the admitted execution context.
- `src/index.ts` — connect compatible tool request fields and configuration.
- `src/sandbox/config.ts` — translate the admitted authority into OS restrictions.
- `src/sandbox/executor.ts` — carry per-action approval exchanges and cancellation.
- `src/sandbox/broker.ts` — attribute eligible runtime network requests to the exact originating workload.
- `test/unit/policy.test.mjs` — cover rule, wildcard, and access-classification regressions.
- `test/native/sandbox.test.mjs` — observe actual allowed and denied effects.
- `test/integration/pi-tools.test.mjs` — verify automatic elevation through real Pi routes.
- `docs/handoffs/auto-review/02-contracts.json` (proposed) — consume shared settings and authority semantics.
- `docs/handoffs/auto-review/03-reviewer.json` (proposed) — consume verified reviewer outcomes.
- `docs/handoffs/auto-review/04-permissions.json` (proposed) — publish execution evidence.

## Execution Plan
### Stage 1 — Pin concrete boundary differences
- Starts when: `docs/handoffs/auto-review/02-contracts.json` and `docs/handoffs/auto-review/03-reviewer.json` provide stable authority contracts and a verified reviewer.
- Work: Establish owned reproductions for automatic outside writes, wildcard network allowances, read-only protected-path access, allowed-rule authority, and runtime-discovered network destinations.
- No-op when: All boundary acceptance criteria already hold through actual final consumers with matching reference/source evidence.
- No-op handoff: Publish the existing verified effects in `docs/handoffs/auto-review/04-permissions.json` so denial handling can proceed without redundant edits.
- Deliverable: A before/after boundary matrix with exact inputs, policy routing, review result, intended permissions, and observable effects.
- Verify: `Inspect owned fixture execution traces`; Inputs: existing policy/native/integration fixtures, `*.example.com` matching, `.git/HEAD` reads, and a temporary outside sentinel; Expected: each existing mismatch is pinned without using personal files or external production services.
- Ends when:
  - [ ] The difference between policy denial, sandbox restriction, review, and execution failure is explicit for every fixture.
  - [ ] The wildcard and shell-read defects have reproduction evidence before correction.
- Handoff: Stage 2 receives the boundary matrix.
- Replan when: A proposed permission cannot be enforced by the backend without changing the agreed trust boundary; return the specific unsupported effect to the parent.

### Stage 2 — Integrate policy routing with native authority
- Starts when: Stage 1 provides the boundary matrix and pinned reference rules.
- Work: Align review triggers, rule parsing/precedence, filesystem defaults/protection, domain matching, automatic admission, and attributed network approvals across the complete execution path.
- Deliverable: Integrated action-scoped permissions from request through final OS enforcement.
- Verify: `Inspect the policy-to-broker value flow and owned side effects`; Inputs: the matrix and native workload traces; Expected: approved permission reaches the final consumer while a parallel unapproved action remains restricted.
- Ends when:
  - [ ] A reviewer-approved boundary crossing executes without an unnecessary second human prompt.
  - [ ] No-UI behavior follows configured approval policy rather than unconditionally rejecting automatic elevation.
  - [ ] A sandbox-permitted routine command and an already allowed destination avoid an unintended review.
  - [ ] Prefix rules, shell wrappers, compound segments, conservative unsupported syntax, and rule precedence follow the pinned reference.
  - [ ] Read-only access to write-protected metadata is distinguished from mutation, and workspace `.agents`/`.codex` plus resolved Git metadata are protected correctly.
  - [ ] Runtime network requests carry the originating action and are cancelled or denied without executing an unapproved alternative.
- Handoff: Stage 3 receives the integrated path and observations.
- Replan when: Routing requires changes to the shared schema, a caller option would be dropped, or a command needs unbounded authority not granted by policy; update the owning contract through the parent before proceeding.

### Stage 3 — Verify final effects and publish permissions
- Starts when: Stage 2 integrates all boundary consumers.
- Work: Execute the affected existing suites, preserve regression coverage, and record allowed/denied effects across direct tools, nested calls, and user-bash routes.
- Deliverable: `docs/handoffs/auto-review/04-permissions.json` with `status`, `sourceDigest`, `reference`, `authorityModes`, `ruleCompatibility`, `filesystemMatrix`, `networkMatrix`, `effectEvidence`, `commands`, `artifactPaths`, and `unresolved`.
- Verify: `npm run build && npm run test:policy && npm run test:approvals && npm run test:native && npm run test:integration`; Inputs: owned boundary fixtures in this checkout; Expected: exit 0 with observed allowed effects and unchanged denied sentinels.
- Ends when:
  - [ ] Concurrent/subsequent isolation, stale approval rejection, final-input mutation checks, and cancellation still pass.
  - [ ] Host restrictions are recorded as blocked evidence rather than bypassed or reported as product success.
- Handoff: Denial handling and final verification receive `docs/handoffs/auto-review/04-permissions.json`.
- Replan when: A denied side effect occurs or approved authority reaches another call; stop successors, correct this execution path, and rerun the boundary proofs.

## Side Effect Checkpoints
- [ ] Existing `bash`, `read`, `edit`, `write`, `grep`, `find`, and `ls` schemas/results retain their current fields.
- [ ] One-use approval still covers one logical edit and its helpers without authorizing another tool call.
- [ ] Session/persistent grants remain bound to action, source, cwd, policy, and effective permissions.
- [ ] Protected controller paths cannot be widened by model-supplied fields or stored grants.
- [ ] Broker control messages cannot be forged by sandboxed workload output.
- [ ] Approved network access does not leak into another invocation's allowlist.
- [ ] Unsupported rule syntax fails explicitly and cannot borrow a safe command prefix.

## Acceptance Criteria
- [ ] Automatic approval of an owned outside action produces the intended native effect without a redundant UI decision.
- [ ] Absolute denials, stale identities, concurrent siblings, and subsequent unapproved calls remain blocked at the final consumer.
- [ ] Wildcard domains and read-versus-write protection are consistent between deterministic policy and the native backend.
- [ ] Supported Codex command-rule behavior is demonstrated for `allow`, `prompt`, `forbidden`, alternatives, compound commands, and unsupported syntax.
- [ ] Dynamic network approval is bound to the actual originating workload and does not replay completed side effects.
- [ ] `docs/handoffs/auto-review/04-permissions.json` records every matrix row with actual effect evidence or a blocking limitation.

## Open Questions
- None — the user approved current Pi execution/approval parity; authority and compatibility choices follow the pinned contract.
