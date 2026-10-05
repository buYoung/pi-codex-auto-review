# [chore] Verify the integrated image_gen package against the FDD and record evidence

## Work Type
chore

## Current State (As-Is)
- [confirmed] Children `01`–`05` each verify their own slice and write `docs/handoffs/image-gen/01-tool-contract.json` … `05-exposure.json`; no artifact yet proves the integrated package against the FDD acceptance boundary or the global criteria in the parent — Evidence: the five handoffs' `status` fields and the parent `Global Acceptance Criteria`.
- [confirmed] The FDD §13 lists risks only a live, integrated run can settle: ChatGPT sign-in token acceptance on `/v1/images/*`, `gpt-image-2` account access, multipart edit acceptance, `gpt-image-2` transparent background (SDK says preview; Codex docs say unsupported on the public API), token refresh at call time, Node `fetch` default timeouts, codemode behavior — Evidence: `docs/FDD/codex-image-gen.md` §13.
- [confirmed] Repository verification commands are `npm run build`, `npm run check`, and per-package `npm pack --dry-run --json --ignore-scripts`; `scripts/check-package.mjs` and `scripts/run-tests.mjs` are hard-coded to `packages/pi-codex-auto-review` and must not be modified — Evidence: root `package.json`, those scripts.
- [confirmed] The user has not activated the FDD (`status: draft`, `verified-against: not-applicable-pre-implementation`); updating it after implementation is a separate documentation action — Evidence: FDD frontmatter.
- [confirmed] Live OpenAI calls spend the user's quota and require chat approval before each verification session (parent Shared Constraints).

## Desired Outcome (To-Be)
- `docs/handoffs/image-gen/06-verification.json` records, for the final integrated source: the credential × operation matrix (API key, ChatGPT sign-in) × (generate, edit-paths, edit-history, transparent) with HTTP statuses and outcomes; failure-path observations (invalid key message, cancellation, read-only save root, non-vision model placeholder); exposure matrix re-check; repository checks (`build`, `check`, pack file list, auto-review unchanged, lockfile diff); a secret scan of session files and handoffs; the Codex-parity deviation list for a later FDD revision; and the final commit digest.
- Any rejected matrix cell is recorded as `blocked` with status and body excerpt, and the parent receives a clear stop/decision request instead of a softened pass.

## Scope
### In Scope
- Running the integrated verification matrix and inspections, with user approval for paid calls.
- Writing the handoff and listing FDD deviations observed.
### Out of Scope
- [hard] Fixing defects found here — return them to the owning child (`01`–`05`) via the parent; this child edits no `src/**`, `skills/**`, or manifest files.
- [hard] Adding automated tests, CI jobs, or verification scripts to `scripts/` (not requested; shared scripts are off-limits).
- [hard] Editing `docs/FDD/codex-image-gen.md`; record deviations for the user to apply.
- [hard] `npm run release`, `npm publish`, tags, pushes.

## Constraints
- Ask the user in chat before each paid verification session and state the planned call count; keep live calls to the minimum matrix (one call per cell, retried only when the parent requests).
- Record every cell with `credentialType`, `operation`, `httpStatus`, `model`, `outcome`, `savedPath` (or `null`), and the exact error string for failures; no body images or credentials.
- Secret scan: `grep -rlE "Bearer |sk-[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{20,}" <session dir for the verification sessions> docs/handoffs/image-gen/` must print no files, and the scanned population (listed with `find … -type f | wc -l`) must be non-empty.
- Run repository checks from the root: `npm run build`, `npm run check`; run `npm pack --dry-run --json --ignore-scripts` inside `packages/pi-codex-image-gen` and compare the file list to the intended set (dist JS/d.ts/maps, skill Markdown, `LICENSE.txt`, `NOTICE`, package metadata).
- Record `git rev-parse HEAD` and `git status --short` for the verified state; evidence for an uncommitted tree is labeled as such.

## Related Files / Entry Points
- `docs/handoffs/image-gen/04-ref-images.json` (proposed) — predecessor evidence for edits.
- `docs/handoffs/image-gen/05-exposure.json` (proposed) — predecessor evidence for exposure.
- `docs/handoffs/image-gen/02-backend.json` (proposed) — generation evidence and error strings to re-check.
- `docs/FDD/codex-image-gen.md` — §13 risks to settle, §9.11 parity exceptions, §15 result states.
- `docs/briefs/2026-10-05-briefset-codex-image-gen.md` — Global Acceptance Criteria this child evidences.
- `package.json` — `build` and `check` scripts.
- `packages/pi-codex-image-gen/package.json` (proposed) — pack target.
- `docs/handoffs/image-gen/06-verification.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Repository and offline checks
- Starts when: `docs/handoffs/image-gen/04-ref-images.json` and `docs/handoffs/image-gen/05-exposure.json` both exist with `status: "complete"` (or `blocked` with the parent's go-ahead to verify the remaining surface).
- Work: Run `npm run build`, `npm run check`, the pack dry-run, the auto-review unchanged check, the lockfile diff review, and the mock-server failure cases from `02` Stage 1 on the integrated build; re-run the `05` exposure matrix.
- No-op when: A `06-verification.json` for the current `git rev-parse HEAD` already records every item in this stage with passing results.
- No-op handoff: The parent receives the existing `docs/handoffs/image-gen/06-verification.json` and evaluates global acceptance.
- Deliverable: Offline section of the handoff.
- Verify: `npm run build && npm run check && (cd packages/pi-codex-image-gen && npm pack --dry-run --json --ignore-scripts)`; Inputs: repository root at the verified commit; Expected: both scripts exit 0 and the pack JSON `files[].path` set equals the intended list (no `src/`, `tmp/`, or scripts), `git diff --stat -- packages/pi-codex-auto-review scripts .github` is empty, and `git diff --stat -- package-lock.json` shows only the new workspace entries.
- Ends when:
  - [ ] All `02` mock failure cases still return the exact Codex strings on the integrated build.
  - [ ] The `05` matrix (login / key / none / user-disabled / excluded) reproduces.
- Handoff: Stage 2 receives the offline results.
- Replan when: Any offline check fails; stop, record the failure, and return it to the owning child through the parent before any paid call.

### Stage 2 — Approved live matrix and failure paths
- Starts when: Stage 1 passes and the user approves the paid verification session with the stated call count.
- Work: For each available credential type run generate, edit-paths, edit-history, and a transparent-background generate; then exercise failure paths: an invalid `OPENAI_API_KEY` in a scratch agent directory, Esc during a generation, a read-only `generated_images` directory, and a non-vision model session.
- Deliverable: Live and failure-path sections of the handoff.
- Verify: `Inspect each run's tool result, saved file, and session entry`; Inputs: the verification session files and `<agentDir>/generated_images/<session>/`; Expected: `200` cells have a PNG at the recorded `savedPath` (transparent cell: `sips -g hasAlpha` reports `yes`, or the actual response/limitation is recorded); the invalid-key run returns `image generation failed: http 401 Unauthorized: Some("…")` without the key text; the cancelled run writes no file and the session continues; the read-only run returns the image without the hint; the non-vision run shows the placeholder text and still saves the file.
- Ends when:
  - [ ] Every matrix cell has a recorded status; untested cells are marked `untested` with the reason (e.g. credential type not configured).
- Handoff: Stage 3 receives the live results.
- Replan when: The ChatGPT token, `gpt-image-2`, multipart edits, or `background: transparent` is rejected; record the exact status and body excerpt, stop further paid calls, and return to the parent for the user's decision — the owning child (`02` or `04`) performs bounded correction and re-verification before this stage resumes.

### Stage 3 — Secret scan, deviation list, and handoff
- Starts when: Stage 2 results are recorded.
- Work: Run the secret scan over the verification session files and `docs/handoffs/image-gen/`; compile the Codex-parity deviations observed (anything outside FDD §9.11's list) and the FDD §13 risks settled or still open; write `docs/handoffs/image-gen/06-verification.json`.
- Deliverable: `docs/handoffs/image-gen/06-verification.json` with `status`, `commit`, `treeState`, `repositoryChecks`, `offlineCases`, `exposureMatrix`, `liveMatrix`, `failurePaths`, `secretScan` (population size, matches), `parityDeviations`, `fddRisks` (settled/open), `unresolved`.
- Verify: `Inspect the handoff against the parent Global Acceptance Criteria`; Inputs: `docs/handoffs/image-gen/06-verification.json` and `docs/briefs/2026-10-05-briefset-codex-image-gen.md`; Expected: every global criterion maps to a recorded result (pass, blocked, or untested with reason), `secretScan.matches` is empty with a non-zero population, and the file is valid JSON.
- Ends when:
  - [ ] The handoff names the exact commit and labels uncommitted state if any.
- Handoff: The parent evaluates global acceptance from `docs/handoffs/image-gen/06-verification.json` and reports blockers to the user.
- Replan when: The secret scan matches; stop, redact nothing silently, report the file and line to the user, and return to the owning child to fix the leak before any report is shared.

## Side Effect Checkpoints
- [ ] No source, skill, manifest, or script file is modified by this child (`git status --short` shows only `docs/handoffs/image-gen/06-verification.json` and scratch outside the repo).
- [ ] Paid calls do not exceed the approved count; each is recorded.
- [ ] Scratch agent directories and read-only directories created for failure paths are removed afterwards.

## Acceptance Criteria
- [ ] `npm run build`, `npm run check`, and the pack dry-run pass on the verified commit with the intended file list, and auto-review/scripts/workflows have no diff.
- [ ] The live matrix records every credential × operation cell with its actual status; transparent-background behavior and token acceptance are no longer unverified in the handoff.
- [ ] Failure paths behave as FDD §8.3 specifies (exact 401 string without the key, cancellation without a file, hint omitted on save failure, placeholder on non-vision models).
- [ ] The secret scan over a non-empty population reports no matches.
- [ ] `docs/handoffs/image-gen/06-verification.json` exists with `status` `complete` or `blocked` and a complete `parityDeviations` list.

## Open Questions
- None — the matrix and criteria come from the FDD and the parent; cost approval is a per-session constraint, not an open design decision.
