# [fix] Preserve verification evidence across platforms

## Work Type
fix

## Current State (As-Is)
- [confirmed] The authoring baseline is `master` at `147ecac82faaf0ede925acc64ff6be32d9622017`, including six existing uncommitted naming changes — Evidence: `git status --short --branch` on 2026-10-03.
- [confirmed] `runSuite()` writes every platform's result to `.reports/pi-guard/<suite>.json` — Evidence: `scripts/run-tests.mjs`, final `writeFile()` call.
- [confirmed] `verify-guard.mjs` deletes the shared audit population, writes fixed handoff names, and expects `darwin-arm64` plus `linux-x64` — Evidence: `scripts/verify-guard.mjs`, `platformResults` and `writeHandoffs()` flow.
- [confirmed] The latest reviewed run passed 38 existing cases on `darwin-arm64`; the retained October 1 handoff records Linux as environment-blocked — Evidence: `.reports/pi-guard/` suite records and `docs/handoffs/pi-guard/06-verification.json`, `platformResults`.
- [inferred] Earlier Docker results may have occupied the overwritten suite filenames; their former contents are not recoverable from the current files alone — Confirm by: inspect preserved run artifacts and available project-specific history before attributing any result to Docker.

## Reproduction
- Environment: the baseline checkout, Node.js 24.14.0, and the existing `runSuite()` writer.
- Steps: preserve the current report bytes, then trace two executions of the same suite with different recorded platforms to the identical output filename.
- Observed: the later `writeFile()` replaces the earlier evidence; a shared audit file can also be reset by aggregate verification.
- Expected: both executions remain addressable with their original platform, source identity, timestamps, and outcomes.
- Frequency: deterministic when the same output location is reused; do not overwrite genuine historical evidence to reproduce it.

## Desired Outcome (To-Be)
- Every verification run has an immutable identity and separate platform, suite, audit, and summary artifacts.
- Existing evidence remains distinguishable from new executions, reconstructed fixtures, and unavailable historical records.
- Aggregate verification consumes only complete, matching evidence and never substitutes Linux ARM results for Linux x64 results.

## Scope
### In Scope
- Change report storage, aggregate readers, handoff generation, fixture audit collection, and their existing validation coverage.
- Preserve the current artifacts before running commands that can rewrite them.
- Retain exact commands, source and contract digests, runtime versions, platform/architecture, evidence kind, and blocked reasons.
- Add Docker image/provider metadata without storing environment values or credentials.
### Out of Scope
- [hard] Fabricating or relabeling historical Docker executions as restored passing evidence.
- [hard] Changing approval decisions, reviewer policy, or sandbox isolation.
- [deferred] A remote artifact service or organization-wide retention system.

## Constraints
- Preserve existing `TestEvidence` fields and `pass`, `fail`, `environment-blocked`, `not-run` meanings; evolve readers compatibly before changing writers.
- Keep existing `npm run test:*` and `npm run verify:guard` entrypoints usable.
- A latest-result alias may reference a run, but must not be the sole retained evidence.
- Use a new run directory for each attempt, including failed and interrupted attempts; preserve original bytes and metadata when importing legacy evidence.
- Keep required platform qualification explicit. Preserve the existing `darwin-arm64` and `linux-x64` requirements unless the parent is deliberately replanned; record additional architectures separately.
- Prove storage behavior with isolated writer fixtures carrying distinct platform metadata. Label those fixtures synthetic; real Linux qualification belongs to the Docker and final-verification children.
- Do not run paid/live providers in the existing offline suites.

## Related Files / Entry Points
- `scripts/run-tests.mjs` — change `runSuite()`, `sourceDigest()`, and the report destination contract.
- `scripts/verify-guard.mjs` — replace shared destructive initialization and fixed-path aggregation.
- `scripts/handoffs.mjs` — preserve prior generated handoffs before publishing a new run's references.
- `src/contracts.ts` — extend only `TestEvidence` metadata compatibly.
- `src/reports.ts` — validate run identity, provenance, architecture, and evidence completeness.
- `test/harness/fixtures.mjs` — direct owned audit collection into the current run.
- `test/unit/contracts.test.mjs` — retain and extend report rejection assertions.
- `test/e2e/guard.test.mjs` — route the cleanup assertion to its own run's audit population.
- `docs/handoffs/auto-review/01-evidence.json` (proposed) — publish the immutable artifact contract for successors.

## Execution Plan
### Stage 1 — Preserve and reproduce the collision
- Starts when: The baseline checkout and existing `.reports/pi-guard/` plus `docs/handoffs/pi-guard/` files are available.
- Work: Snapshot existing evidence with checksums, inventory its actual platform/source provenance, and reproduce the overwrite through isolated report fixtures.
- No-op when: The current writer and readers already retain two distinct runs without overwriting either, with passing evidence for every acceptance item.
- No-op handoff: Record the inspected artifacts and no-change result in `docs/handoffs/auto-review/01-evidence.json`; the parent may start contracts and Docker work after validating that record.
- Deliverable: A preserved legacy inventory and a collision reproduction tied to the writer callsite.
- Verify: `Inspect runSuite() and two isolated output attempts`; Inputs: `scripts/run-tests.mjs` and copied evidence fixtures; Expected: the original destination collision is demonstrated without changing preserved source artifacts.
- Ends when:
  - [ ] Every existing artifact is preserved or its actual read failure is recorded.
  - [ ] The overwrite cause and audit-reset cause have separate observations.
- Handoff: Stage 2 receives the preserved inventory and reproduction.
- Replan when: Evidence was already modified concurrently; stop writers, reconcile the inventory, and establish a new baseline before proceeding.

### Stage 2 — Implement run-scoped writers and compatible readers
- Starts when: Stage 1 provides preserved evidence and the collision reproduction.
- Work: Introduce collision-resistant run directories, atomic non-overwriting writes, run-local audit collection, compatible summary readers, and explicit required-platform selection.
- Deliverable: A report contract implemented consistently by suite execution, aggregate verification, fixtures, and handoffs.
- Verify: `Inspect a pair of platform records and a pair of same-platform runs`; Inputs: the revised report writer and isolated copied fixtures; Expected: all four records remain distinct and their original bytes are unchanged after later writes.
- Ends when:
  - [ ] Legacy records retain their original provenance instead of inheriting the current source digest.
  - [ ] Incomplete, stale, skipped, simulated-native, and architecture-mismatched evidence cannot qualify as a pass.
  - [ ] The source identity includes executed Docker fixtures/scripts when they are added by the Docker child.
- Handoff: Stage 3 receives the complete writer/reader migration.
- Replan when: A reader requires removal of an existing field or interpretation of old records as current; retain compatibility and return the contract conflict to the parent.

### Stage 3 — Verify persistence and publish the contract
- Starts when: Stage 2's writer/reader migration is integrated.
- Work: Run the existing affected verification, exercise consecutive and concurrent artifact creation, and publish the format consumed by later children.
- Deliverable: `docs/handoffs/auto-review/01-evidence.json` with `status`, `sourceDigest`, `contractDigest`, `digestRules`, `runLayout`, `requiredPlatforms`, `legacyInventory`, `commands`, `artifactPaths`, and `unresolved`.
- Verify: `npm run build && npm run test:contracts && npm run test:e2e`; Inputs: this checkout and its revised report fixtures; Expected: exit 0 with passing contract/cleanup assertions and preserved earlier run directories.
- Ends when:
  - [ ] The isolated overwrite reproduction now preserves both runs.
  - [ ] Existing affected checks have actual outcomes and distinguish host restrictions from product failures.
- Handoff: The parent, contracts child, Docker child, and final verification receive `docs/handoffs/auto-review/01-evidence.json`.
- Replan when: A proof fails; correct this writer/reader change and reverify before releasing dependent writers.

## Side Effect Checkpoints
- [ ] Existing report fields, suite names, evidence kinds, and digest checks remain readable.
- [ ] A failed run cannot erase a previously passing run or make a stale run look current.
- [ ] Audit assertions inspect a nonempty population from the intended run.
- [ ] Parallel runs cannot share a destructive cleanup target.
- [ ] Historical handoffs are preserved before any latest-view update.

## Acceptance Criteria
- [ ] Two isolated writer invocations with different recorded platform identities and two with the same identity retain independently readable artifacts with the correct source identities; these storage fixtures are not claimed as OS qualification.
- [ ] Aggregate verification rejects mismatched source, contract, architecture, skipped cases, and absent native controls.
- [ ] Existing supported commands produce exact artifact locations that an operator can retrieve after containers are removed.
- [ ] No report stores API keys, request authorization headers, or complete Docker environment values.
- [ ] `docs/handoffs/auto-review/01-evidence.json` provides the contract needed by every subsequent verification producer.

## Open Questions
- None — result preservation is required by the requested Docker verification recovery; implementation choices are bounded above.
