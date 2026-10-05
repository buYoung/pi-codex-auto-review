# [build] Prepare @buyong/pi-codex-computer-use for publishing

## Work Type
build

## Current State (As-Is)
- [confirmed] After `02`–`05`, `packages/pi-codex-computer-use` builds and works in live sessions on this Mac but has no `files` list beyond the scaffold, no README, no usage document, and no packaging check — Evidence: `docs/handoffs/computer-use/03-package-setup.json`, `04-mcp-bridge.json`, `05-confirmations.json`, `06-browser-use.json` (predecessor deliverables).
- [confirmed] `scripts/check-package.mjs` hard-codes `../packages/pi-codex-auto-review/` and an explicit expected-file list; `scripts/package-shared-files.mjs` copies every non-`dist/` entry of a package's `files` from the repository root into the package directory at `prepack` and removes it at `postpack`; `.gitignore` lists the copied auto-review paths — Evidence: those scripts, `.gitignore`.
- [confirmed] `scripts/release.mjs` `listPublishablePackages()` discovers non-private workspaces generically; `.github/workflows/npm-package.yml` takes `inputs.package` (default `@buyong/pi-codex-auto-review`) and contains one step conditioned on `steps.release.outputs.package == '@buyong/pi-codex-auto-review'` — Evidence: `scripts/release.mjs`, `.github/workflows/npm-package.yml`.
- [confirmed] `docs/publishing.md` states that a new package's first version must be published manually from the repository root before npm Trusted Publishing can connect, and that the release command refuses a dirty working tree — Evidence: `docs/publishing.md` § First publish of a new package.
- [confirmed] The repository root `README.md`, `README.ko.md`, `docs/usage*.md`, `docs/publishing*.md`, `docs/security/*`, `docs/testing/*` describe `pi-codex-auto-review` and are copied into that package through its `files` — Evidence: `packages/pi-codex-auto-review/package.json` `files`, root `README.md`.
- [confirmed] `scripts/run-tests.mjs` imports `packages/pi-codex-auto-review/dist/reports.js` and digests only that package's `src` — Evidence: `scripts/run-tests.mjs`.
- [confirmed] Prerequisites, limitations, and the proprietary-runtime boundary to document are fixed by the handoffs: Codex-capable ChatGPT subscription and login, Codex Desktop app installed and logged in, macOS verified and Windows implemented but unverified, Linux unsupported, OS permission grants to the Computer Use service, Chrome plus the ChatGPT Chrome extension for Browser Use, no bundled or downloaded runtime files, interfaces that may change with app updates, possible telemetry from the runtime, both features enabled by default — Evidence: § 사전 요구사항, § 설치, § 제약과 위험 in `docs/handoffs/computer-use/01-codex-runtime-bridge.md`, `03-package-setup.json` `platforms`.
- [confirmed] pi installs packages with `pi install npm:<name>@<version>` or `pi install ./local-package` — Evidence: `node_modules/@earendil-works/pi-coding-agent/docs/packages.md`.
- [inferred] The auto-review-specific workflow step may or may not need a counterpart for the new package — Confirm by: reading that step's purpose in Stage 2; a required change is `ci` work outside this child.

## Desired Outcome (To-Be)
- `packages/pi-codex-computer-use/package.json` at version `0.1.0` has a complete `files` list (`dist/**/*.js`, `dist/**/*.d.ts`, `dist/**/*.js.map`, `README.md`, `README.ko.md`, `LICENSE`, `NOTICE`, the package's usage docs), `prepack`/`postpack` scripts matching auto-review, and `npm pack --dry-run --json --ignore-scripts` lists exactly those files.
- Package-local `README.md` and `README.ko.md` state the prerequisites (including the Codex subscription and login), supported platforms (macOS verified, Windows implemented but not yet verified, Linux unsupported), installation (`pi install npm:@buyong/pi-codex-computer-use`), `/codex-computer-use` usage, the default-on behavior and per-feature on/off switches, the confirmation dialogs, the proprietary-runtime boundary, verified backends and limitations from `06-browser-use.json`, and the telemetry caveat; they do not mention or depend on `pi-codex-auto-review`.
- `scripts/check-package.mjs` validates both workspace packages (per-package expected-file lists or a package argument) and the new package's `prepack` runs it; `.gitignore` covers the files copied into the new package at pack time.
- A local install from the packed tarball (`pi install ./<tarball>` or the package directory) loads the extension and `/codex-computer-use` works, then the local install is removed.
- `docs/handoffs/computer-use/07-publish-prep.json` records the pack contents, verification results, the manual first-publish steps from `docs/publishing.md`, the Windows verification gap, and any `ci` follow-up; no publish, release, tag, or push happens in this child.

## Scope
### In Scope
- Package `files`, `version`, `description`, `keywords`, `repository`/`homepage`/`bugs`, `prepack`/`postpack` scripts for the new package.
- Package-local `README.md` / `README.ko.md` and `docs/computer-use/usage.md` / `usage.ko.md` (copied at pack time like auto-review's docs).
- `scripts/check-package.mjs` generalization and `.gitignore` entries.
- Root `README.md` gets a short section linking to the new package (one paragraph, no restructuring).
- Dry-run pack, local install/uninstall verification, and the handoff JSON.
### Out of Scope
- [hard] `npm publish`, `npm run release`, creating tags, pushing branches, or triggering `.github/workflows/npm-package.yml`; publishing needs the user's separate approval.
- [hard] Editing `.github/workflows/*.yml`; if the auto-review-specific step needs a counterpart, record it as `ci` follow-up for the parent.
- [hard] Touching `scripts/run-tests.mjs`, `scripts/verify-*.mjs`, or adding the new package to the test suites (no tests were requested).
- [hard] Changing `packages/pi-codex-auto-review` or its documents beyond the root README link paragraph, and documenting any integration with it.
- [deferred] Translating the handoff document into user documentation; README links to it instead.
- [deferred] Windows live verification before the first publish; the README states the gap until a Windows run is recorded.

## Constraints
- Follow `docs/publishing.md`: version `0.1.0`, `publishConfig.access: public`, no credentials in any file, first publish is manual and out of scope.
- Documentation must say the package never bundles, downloads, or copies OpenAI runtime files and requires the Codex Desktop app installed and logged in with a Codex-capable subscription; it must not claim support the handoffs did not verify (for example `iab`, `mcpapps`, Linux, a verified Windows run, or automatic reviewer routing).
- Keep `scripts/check-package.mjs` backward compatible: running it with no argument from the auto-review package must still validate auto-review exactly as today.
- Korean and English READMEs carry the same sections; code blocks, paths, and identifiers stay identical across both.
- Use `pi install` with the local tarball or directory for verification and remove it afterwards (`pi remove` or the documented removal) so the user's pi configuration is left unchanged.

## Related Files / Entry Points
- `packages/pi-codex-computer-use/package.json` (proposed) — complete `files`, `version`, scripts, metadata.
- `packages/pi-codex-computer-use/README.md` (proposed) — package-local English README.
- `packages/pi-codex-computer-use/README.ko.md` (proposed) — Korean README.
- `docs/computer-use/usage.md` (proposed) — usage document copied at pack time.
- `docs/computer-use/usage.ko.md` (proposed) — Korean usage document.
- `scripts/check-package.mjs` — generalize per package.
- `scripts/package-shared-files.mjs` — confirm it handles the new package's `files` without change.
- `.gitignore` — add the paths copied into the new package at pack time.
- `README.md` — add the link paragraph for the new package.
- `docs/publishing.md` — first-publish and Trusted Publisher steps to cite in the handoff.
- `.github/workflows/npm-package.yml` — read the auto-review-specific step to decide whether a `ci` follow-up is needed (no edit here).
- `packages/pi-codex-auto-review/package.json` — reference `files` and `prepack`/`postpack` shape only.
- `docs/handoffs/computer-use/03-package-setup.json` (proposed) — consumed: platform matrix and prerequisites to document.
- `docs/handoffs/computer-use/06-browser-use.json` (proposed) — consumed: backends and limitations to document.
- `docs/handoffs/computer-use/07-publish-prep.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Manifest, files, and packaging check
- Starts when: `docs/handoffs/computer-use/06-browser-use.json` has `status` `complete` or `blocked` with its limitations recorded, and `docs/handoffs/computer-use/03-package-setup.json` provides the platform matrix.
- Work: Complete the package manifest (`files`, `version 0.1.0`, metadata, `prepack`/`postpack`), generalize `scripts/check-package.mjs` for both packages, and add the `.gitignore` entries for pack-time copies.
- No-op when: `npm pack --dry-run --json --ignore-scripts` in the new package already lists the complete file set and `node scripts/check-package.mjs` validates both packages.
- No-op handoff: The parent receives the existing `docs/handoffs/computer-use/07-publish-prep.json`.
- Deliverable: A pack-ready manifest and a packaging check that covers both packages.
- Verify: `cd packages/pi-codex-computer-use && npm pack --dry-run --json --ignore-scripts`; Inputs: the new package directory after `npm run build`; Expected: exit 0 and the `files` array contains `dist/index.js`, `dist/index.d.ts`, `LICENSE`, `NOTICE`, `README.md`, `README.ko.md`, and the usage docs, with no `src/` or `tsconfig.json` entries.
- Ends when:
  - [ ] `node scripts/check-package.mjs` (auto-review, unchanged invocation) and the new package's `prepack` both exit 0.
  - [ ] `npm run build && npm run check` exit 0.
- Handoff: Stage 2 receives the pack-ready package.
- Replan when: `package-shared-files.mjs` cannot handle a nested docs path for the new package; adjust the `files` layout rather than the script unless the script change is trivially additive.
- Worker decision: Whether `check-package.mjs` takes a package-directory argument or iterates all workspaces, and the per-package expected-file lists.

### Stage 2 — Documentation
- Starts when: Stage 1 packs the expected files.
- Work: Write package-local `README.md`/`README.ko.md` and `docs/computer-use/usage*.md` covering prerequisites, supported platforms and their verification status, installation, `/codex-computer-use`, default-on settings and per-feature behavior, confirmations UI, verified backends and limitations, the proprietary-runtime boundary, telemetry caveat, and troubleshooting pointers (`mcp.log`, the runtime's Chrome diagnostics); add the root README paragraph; read the workflow's auto-review-specific step and record whether a `ci` follow-up is needed.
- Deliverable: Complete bilingual documentation consistent with the handoffs.
- Verify: `Inspect the READMEs against the handoff files`; Inputs: `README.md`, `README.ko.md`, `docs/computer-use/usage.md`, `docs/computer-use/usage.ko.md`, `docs/handoffs/computer-use/{03,04,05,06}-*.json`; Expected: every prerequisite and platform status from `03-package-setup.json`, every limitation from `06-browser-use.json`, and the default-on behavior appear, and no sentence claims `iab`, `mcpapps`, Linux, a verified Windows run, automatic reviewer support, or any `pi-codex-auto-review` integration.
- Ends when:
  - [ ] `npm run check` passes with the new Markdown present (Biome ignores unknown files).
  - [ ] The workflow decision (`ci` follow-up needed or not) is written down with the step's purpose.
- Handoff: Stage 3 receives the documentation.
- Replan when: A handoff reports a `blocked` capability; document it as unsupported instead of inventing a workaround, and flag it to the parent.

### Stage 3 — Local install proof and handoff
- Starts when: Stage 2 documentation is complete.
- Work: Build, `npm pack` the new package to a temporary directory, `pi install` the tarball (or `./packages/pi-codex-computer-use`), start pi, run `/codex-computer-use status`, then remove the local install; write `docs/handoffs/computer-use/07-publish-prep.json` with `status`, `version`, `packedFiles`, `verification` (commands and results), `platformStatus`, `firstPublishSteps` (from `docs/publishing.md`), `ciFollowUp`, `unresolved`.
- Deliverable: `docs/handoffs/computer-use/07-publish-prep.json`.
- Verify: `Run the installed package in pi`; Inputs: `pi install <tarball>` then `pi` and `/codex-computer-use status`, followed by removal; Expected: the status output matches the development build, `pi` lists no leftover package entry after removal, and the handoff is valid JSON with `status: "ready-for-manual-publish"`.
- Ends when:
  - [ ] The user's pi settings contain no reference to the local tarball after the test.
  - [ ] The handoff lists the exact manual commands for the first publish without executing them.
- Handoff: The parent receives `docs/handoffs/computer-use/07-publish-prep.json` for global acceptance.
- Replan when: The installed package behaves differently from the development build (missing file, broken import); fix the `files` list, re-pack, and repeat Stage 3.

## Side Effect Checkpoints
- [ ] `cd packages/pi-codex-auto-review && npm pack --dry-run --json --ignore-scripts` produces the same file list as before this child.
- [ ] `npm run build`, `npm run check`, and `node scripts/check-package.mjs` exit 0 at the repository root.
- [ ] `.github/workflows/npm-package.yml` is unchanged (`git diff --quiet -- .github/workflows`).
- [ ] The user's `~/.pi/agent` configuration has no leftover package entry or files from the local install test.
- [ ] No credential, local path under `/Users`, or app-list data appears in the READMEs or the handoff.

## Acceptance Criteria
- [ ] `npm pack --dry-run --json --ignore-scripts` for `@buyong/pi-codex-computer-use@0.1.0` lists exactly the intended files, and the auto-review package's list is unchanged.
- [ ] `node scripts/check-package.mjs` validates both packages and both `prepack` scripts succeed.
- [ ] `README.md`/`README.ko.md` and `docs/computer-use/usage*.md` state the Codex subscription, login, Codex Desktop app, platform status, permission, and Chrome prerequisites, the default-on settings and switches, limitations, and the runtime boundary, with no unverified capability claims and no auto-review integration.
- [ ] A local `pi install` of the packed tarball loads the extension and `/codex-computer-use status` works; the install is removed afterwards.
- [ ] `docs/handoffs/computer-use/07-publish-prep.json` exists with `status: "ready-for-manual-publish"` and the manual first-publish steps; no publish or tag was performed.

## Open Questions
- None — publishing itself is excluded by the user's instruction and documented as a manual step; documentation content is fixed by the handoffs.
