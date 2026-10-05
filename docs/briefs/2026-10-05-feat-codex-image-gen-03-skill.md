# [feat] Bundle the Pi-adapted imagegen skill

## Work Type
feat

## Current State (As-Is)
- [confirmed] Codex ships a bundled skill `imagegen` (`SKILL.md`, `references/{prompting,sample-prompts,cli,image-api,codex-network}.md`, `scripts/{image_gen,remove_chroma_key}.py`, `agents/openai.yaml`, `assets/`, `LICENSE.txt` Apache-2.0); the user's installed copy at `~/.codex/skills/.system/imagegen` is byte-identical to `tmp/codex-main/codex-rs/skills/src/assets/samples/imagegen` — Evidence: `diff -rq` on 2026-10-05.
- [confirmed] Pi skill discovery skips directories whose name starts with `.`, so the Codex installed copy is not loaded by Pi; the skill is not in this session's skill list — Evidence: `entry.name.startsWith(".")` in `node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js`.
- [confirmed] The FDD §9.10 fixes the adaptation: keep the name `imagegen` and the when-to-use/when-not-to-use judgment; replace `view_image` with `read`; rewrite "Built-in edit semantics" and Workflow step 7 to the `referenced_image_paths` behavior; replace `$CODEX_HOME/generated_images/...` with the FDD save root; replace "Does not require `OPENAI_API_KEY`" with the Pi `openai` credential requirement; drop the CLI fallback entirely (files and sentences); drop `agents/openai.yaml` and `assets/`; keep `LICENSE.txt`, add Codex `NOTICE` content and modification notices — Evidence: `docs/FDD/codex-image-gen.md` §9.10.
- [confirmed] The CLI fallback text is spread beyond `SKILL.md`: `references/prompting.md` lines 5, 7, 61, 79–85, 92 and `references/sample-prompts.md` lines 5, 14, 16, 18–23 reference the CLI, `cli.md`/`image-api.md`, `gpt-image-1.5`, and `background=transparent` CLI caveats; `SKILL.md` also carries the `gpt-image-1.5` switch rule, `n`/`generate-batch` guidance, Workflow steps 1/4/17/18 CLI parts, "gpt-image-2 guidance for CLI fallback", and "Fallback CLI mode only" — Evidence: the independent review on 2026-10-05 against those files.
- [confirmed] Codex's `NOTICE` reads "OpenAI Codex / Copyright 2025 OpenAI" plus a Ratatui attribution; Apache-2.0 §4(b) requires modification notices in changed files and §4(d) requires carrying NOTICE content — Evidence: `tmp/codex-main/NOTICE`, `LICENSE.txt` §4.
- [confirmed] A Pi package registers skills through its manifest `"pi": { "skills": ["./resources/skills"] }`; a local directory can be loaded for testing with `pi --skill <path>`; `-ns` disables discovered skills but keeps explicit `--skill` paths — Evidence: `node_modules/@earendil-works/pi-coding-agent/docs/packages.md`, `docs/cli.md`.
- [confirmed] Pi lists skills by name and description in the system prompt and loads `SKILL.md` on demand; `/skill:imagegen` forces loading; duplicate names keep the first found with a warning — Evidence: `node_modules/@earendil-works/pi-coding-agent/docs/skills.md`.
- [confirmed] Pi's `read` tool reads png/jpg/gif/webp/bmp images as attachments, so it can replace `view_image` — Evidence: `description` in `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/read.js`.

## Desired Outcome (To-Be)
- `packages/pi-codex-image-gen/skills/imagegen/` contains `SKILL.md`, `references/prompting.md`, `references/sample-prompts.md`, `LICENSE.txt`, and `NOTICE`, adapted exactly as FDD §9.10 prescribes, with a modification notice at the top of each changed Markdown file.
- The package manifest registers the skill (`"pi": { "skills": ["./skills"] }`) and the `files` list ships `skills/**` and `NOTICE`.
- No file or sentence in the shipped skill references `view_image`, `image_gen.py`, `remove_chroma_key.py`, `cli.md`, `image-api.md`, `codex-network.md`, `generate-batch`, `gpt-image-1.5`, `uv pip`, `$CODEX_HOME`, "Does not require `OPENAI_API_KEY`", `python`, or Codex Desktop UI metadata; the `n` parameter guidance is removed.
- Where the original pointed to the CLI fallback, the skill instructs: if the `image_gen` tool cannot be used, tell the user, and when credentials are missing point to `/login` or `OPENAI_API_KEY`.
- In a Pi session with the skill loaded, the system prompt lists `imagegen` with the retained description and `/skill:imagegen` loads the adapted body.
- `docs/handoffs/image-gen/03-skill.json` records the file list, removed sections, changed phrases, the forbidden-token scan result, the manifest entry, and license handling.

## Scope
### In Scope
- Copy and adaptation of the three Markdown files, `LICENSE.txt`, and a new `NOTICE`.
- Manifest edits in `packages/pi-codex-image-gen/package.json`: `pi.skills` and `files` entries only.
- The handoff JSON.
### Out of Scope
- [hard] Hiding the skill when `image_gen` is hidden — `05-exposure` owns visibility; this child only ships the files and the manifest entry.
- [hard] Any TypeScript or tool behavior change; `src/**` is not edited here.
- [hard] Shipping `scripts/image_gen.py`, `scripts/remove_chroma_key.py`, `references/cli.md`, `references/image-api.md`, `references/codex-network.md`, `agents/openai.yaml`, or `assets/` (FDD §9.10).
- [hard] Rewriting the retained judgment criteria (when to use / when not to use) or the prompt-shaping guidance beyond removing CLI sentences.
- [hard] Modifying `packages/pi-codex-auto-review`, `scripts/*.mjs`, `.github/workflows/*`; adding test files.
- [deferred] Package README and usage docs (FDD §12).

## Constraints
- Start from `tmp/codex-main/codex-rs/skills/src/assets/samples/imagegen/` (identical to the installed copy); do not reference `~/.codex/skills/.system/imagegen` at runtime.
- Keep the frontmatter `name: imagegen` and the description's judgment content; change only "Codex" → the Pi tool context and "built-in" wording in the description.
- Apply every FDD §9.10 edit: `view_image` → `read`; "Built-in edit semantics" + Workflow step 7 → "pass local files via `referenced_image_paths`; use `num_last_images_to_include` only for images without a local path; never both" (same rule as the tool description); `$CODEX_HOME/generated_images/...` → `<Pi agent directory>/generated_images/<session>/<call>.png` (default `~/.pi/agent`); "Does not require `OPENAI_API_KEY`" → requires the Pi `openai` credential (API key or Sign in with ChatGPT); remove CLI fallback files and every CLI sentence in `SKILL.md`, `prompting.md`, `sample-prompts.md` (including links to deleted references and the `gpt-image-1.5`/`background=transparent` CLI caveats); remove `n` and `generate-batch` guidance; put the "tool unavailable → tell the user; missing credentials → `/login` or `OPENAI_API_KEY`" instruction where the CLI fallback sentence was.
- Keep the copy-to-workspace and no-overwrite rules for project-bound assets.
- Each changed Markdown file begins with an HTML comment modification notice naming the source (`OpenAI Codex`, path, retrieval date 2026-10-05) and that it was modified for Pi; `NOTICE` carries the Codex NOTICE text; `LICENSE.txt` is copied unchanged.
- Manifest: add `"skills": ["./skills"]` inside `"pi"` and `skills/**/*.md`, `skills/**/LICENSE.txt`, `skills/**/NOTICE` to `files`; touch nothing else in `package.json` (owned by `01-tool-contract`).
- Markdown only inside `skills/`; no scripts of any language (FDD §9.11).

## Related Files / Entry Points
- `docs/handoffs/image-gen/01-tool-contract.json` (proposed) — confirms the manifest exists and the tool's two-selector rule to mirror in the skill.
- `docs/FDD/codex-image-gen.md` — §9.10 adaptation list and license decisions; §9.4 selector rules; §9.7 save root.
- `tmp/codex-main/codex-rs/skills/src/assets/samples/imagegen/SKILL.md` — source to copy and adapt.
- `tmp/codex-main/codex-rs/skills/src/assets/samples/imagegen/references/prompting.md` — source; strip CLI sentences.
- `tmp/codex-main/codex-rs/skills/src/assets/samples/imagegen/references/sample-prompts.md` — source; strip CLI sentences.
- `tmp/codex-main/codex-rs/skills/src/assets/samples/imagegen/LICENSE.txt` — copy unchanged.
- `tmp/codex-main/NOTICE` — NOTICE text to carry.
- `tmp/codex-main/codex-rs/ext/image-generation/imagegen_description.md` — the two-selector rule the skill must agree with.
- `node_modules/@earendil-works/pi-coding-agent/docs/skills.md` — frontmatter and loading rules.
- `node_modules/@earendil-works/pi-coding-agent/docs/packages.md` — `pi.skills` manifest field.
- `packages/pi-codex-image-gen/package.json` (proposed) — add `pi.skills` and `files` entries.
- `packages/pi-codex-image-gen/skills/imagegen/SKILL.md` (proposed) — adapted skill.
- `packages/pi-codex-image-gen/skills/imagegen/references/prompting.md` (proposed) — adapted reference.
- `packages/pi-codex-image-gen/skills/imagegen/references/sample-prompts.md` (proposed) — adapted reference.
- `packages/pi-codex-image-gen/skills/imagegen/NOTICE` (proposed) — Codex NOTICE text.
- `docs/handoffs/image-gen/03-skill.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Copy and adapt the skill files
- Starts when: `docs/handoffs/image-gen/01-tool-contract.json` has `status: "complete"` (the package directory and manifest exist).
- Work: Copy the three Markdown files and `LICENSE.txt` into `packages/pi-codex-image-gen/skills/imagegen/`, add `NOTICE`, and apply every FDD §9.10 edit with modification notices.
- No-op when: The five files already exist and the forbidden-token scan in Verify prints 0 matches.
- No-op handoff: `docs/briefs/2026-10-05-feat-codex-image-gen-05-exposure.md` receives the existing `docs/handoffs/image-gen/03-skill.json`.
- Deliverable: Adapted skill directory with license files.
- Verify: `grep -rnE "view_image|image_gen\.py|remove_chroma_key|cli\.md|image-api\.md|codex-network\.md|generate-batch|gpt-image-1\.5|uv pip|CODEX_HOME|Does not require|python|openai\.yaml" packages/pi-codex-image-gen/skills/imagegen/`; Inputs: the five shipped files; Expected: no matches (the scanned population is the complete `skills/imagegen` tree, listed with `find packages/pi-codex-image-gen/skills/imagegen -type f` showing exactly `SKILL.md`, `references/prompting.md`, `references/sample-prompts.md`, `LICENSE.txt`, `NOTICE`).
- Ends when:
  - [ ] `diff` between each shipped Markdown file and its Codex source shows only the FDD §9.10 edits plus the modification notice.
  - [ ] `SKILL.md` frontmatter keeps `name: imagegen` and a description with the retained when/when-not judgment.
- Handoff: Stage 2 receives the skill directory.
- Replan when: A retained passage cannot be kept coherent after removing CLI sentences (e.g. a section becomes empty); record the removed section in the handoff and keep the retained judgment intact rather than inventing new guidance.

### Stage 2 — Register the skill and verify loading
- Starts when: Stage 1's scan prints 0 matches.
- Work: Add `pi.skills` and `files` entries to the manifest; verify Pi lists and loads the skill; write the handoff.
- Deliverable: `docs/handoffs/image-gen/03-skill.json` with `status`, `files`, `removedSections`, `changedPhrases`, `forbiddenTokenScan`, `manifest` (`pi.skills`, `files` additions), `license` (`LICENSE.txt`, `NOTICE`, modification notices), `unresolved`.
- Verify: `Run pi -ne -ns -e packages/pi-codex-image-gen/dist/index.js --skill packages/pi-codex-image-gen/skills/imagegen and invoke /skill:imagegen`; Inputs: the built extension and the skill directory; Expected: the session's system prompt lists `imagegen` with the adapted description and `/skill:imagegen` loads the adapted `SKILL.md` text (no CLI mode, `read` instead of `view_image`), and `npm pack --dry-run --json --ignore-scripts` run in `packages/pi-codex-image-gen` lists the five skill files.
- Ends when:
  - [ ] `npm run check` exits 0 (Markdown is ignored by Biome; the manifest change is formatted).
  - [ ] The handoff validates as JSON.
- Handoff: `docs/briefs/2026-10-05-feat-codex-image-gen-05-exposure.md` receives `docs/handoffs/image-gen/03-skill.json`.
- Replan when: Pi rejects the frontmatter or warns about a duplicate `imagegen` skill from another loaded location; record the warning and the colliding path for the parent.

## Side Effect Checkpoints
- [ ] `packages/pi-codex-image-gen/package.json` differs from `01`'s version only in `pi.skills` and `files`.
- [ ] `src/**` and `dist/**` of the package are unchanged by this child.
- [ ] `~/.codex/skills/.system/imagegen` is not modified or referenced.
- [ ] `packages/pi-codex-auto-review` has no diff; `npm run build && npm run check` exit 0.

## Acceptance Criteria
- [ ] The shipped skill tree is exactly `SKILL.md`, `references/prompting.md`, `references/sample-prompts.md`, `LICENSE.txt`, `NOTICE`, and the forbidden-token scan prints 0 matches.
- [ ] Every FDD §9.10 edit is present (`read` for `view_image`, `referenced_image_paths` edit guidance, Pi save root, Pi `openai` credential requirement, CLI fallback removed, unavailable-tool guidance added).
- [ ] Pi lists and loads the skill in a session started with `--skill` on the directory.
- [ ] `docs/handoffs/image-gen/03-skill.json` exists with `status: "complete"`.

## Open Questions
- None — the user fixed the skill adaptation, CLI removal, and license handling in the FDD.
