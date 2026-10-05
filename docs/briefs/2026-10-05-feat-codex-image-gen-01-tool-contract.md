# [feat] Scaffold the package and land the Codex-identical tool contract

## Work Type
feat

## Current State (As-Is)
- [confirmed] The repository is an npm-workspaces + Turborepo monorepo (`"workspaces": ["packages/*"]`, `turbo.json` `build` task) whose only package is `packages/pi-codex-auto-review` 0.3.0; `master` is at `d5aa4c2` — Evidence: root `package.json`, `turbo.json`, `ls packages`, `git log`.
- [confirmed] No image-generation tool exists in this repository or in Pi 0.99.1's `openai` provider; pi-ai's `generateImages()` registry only knows `openrouter-images` — Evidence: `node_modules/@earendil-works/pi-ai/dist/images.d.ts`, `types.d.ts` (`KnownImageApi`).
- [confirmed] The design source is `docs/FDD/codex-image-gen.md` (status `draft`, all user decisions resolved); its §9.2, §9.3, §9.4, §9.6, §9.11 fix the tool name `image_gen`, label `Image generation`, the model-facing schema, the four description changes, the argument check order, the error strings, and the TypeScript-only rule — Evidence: that file.
- [confirmed] Codex's argument struct is `prompt: String`, `transparent_background: bool` (default `false`), `referenced_image_paths: Option<Vec<AbsolutePathBuf>>` (`length(max = 5)`), `num_last_images_to_include: Option<usize>` (`range(min = 1, max = 5)`), with `#[serde(deny_unknown_fields)]`; the schema is built with schemars draft 2019-09 and `inline_subschemas = true` — Evidence: `ImagegenArgs` and `imagegen_tool_spec()` in `tmp/codex-main/codex-rs/ext/image-generation/src/tool.rs`.
- [confirmed] Codex's `JsonSchema` tool-schema type has no `maxItems`, `minimum`, `maximum`, or `default` fields, so those keywords are dropped before the schema reaches the model; the model sees field types (nullable for `Option`), `description`, `required`, and `additionalProperties` — Evidence: `pub struct JsonSchema` in `tmp/codex-main/codex-rs/tools/src/json_schema/types.rs`; `deserialize_tool_input_schema()` in `tmp/codex-main/codex-rs/tools/src/json_schema.rs`.
- [inferred] The exact model-facing Codex schema is `{type: object, properties: {prompt: {type: string}, transparent_background: {type: boolean, description: "Whether the output should have a transparent background. Defaults to false."}, referenced_image_paths: {type: [array, null], items: {type: string}}, num_last_images_to_include: {type: [integer, null]}}, required: [prompt], additionalProperties: false}` — Confirm by: a Rust build was not run; derive from the schemars derive attributes and the `JsonSchema` field list above, and record any deviation found while implementing in the handoff.
- [confirmed] Codex validates in this order: serde parse (`unknown field`, `missing field`, type errors, `AbsolutePathBuf deserialized without a base path` for relative paths; `~` is expanded), then `referenced_image_paths.len() > 5`, then the selector combination, then the `1..=5` range for the count — Evidence: `parse_args()` and `request_for_call_args()` in `tool.rs`; `AbsolutePathBufGuard::deserialization_base()` and `maybe_expand_home_directory()` in `tmp/codex-main/codex-rs/utils/absolute-path/src/lib.rs`.
- [confirmed] Codex's own error strings are `` `referenced_image_paths` must contain at most 5 paths ``, `` `num_last_images_to_include` must be between 1 and 5 ``, `` provide only one of `referenced_image_paths` or `num_last_images_to_include` `` — Evidence: `request_for_call_args()` in `tool.rs`.
- [confirmed] The Codex tool description is `tmp/codex-main/codex-rs/ext/image-generation/imagegen_description.md`; the FDD changes exactly four things: `image_gen.imagegen` → `image_gen`, `view_image` → `read`, drop the code-mode line (`@exec`, `generatedImage()`, `text()`, `notify()`), and drop the sentence "Do not use the `python` tool for image editing unless specifically instructed." — Evidence: FDD §9.3.
- [confirmed] Pi validates tool arguments against the TypeBox `parameters` schema before `execute()` and returns `Validation failed for tool "<name>": ...` on failure; `prepareArguments(args)` runs before that validation and a thrown `Error` there becomes the model-visible error result — Evidence: `prepareToolCallArguments()` / `validateToolArguments()` in `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js`; `validateToolArguments()` in `node_modules/@earendil-works/pi-ai/dist/utils/validation.js`.
- [confirmed] `ToolDefinition` has `name`, `label`, `description`, `promptSnippet`, `promptGuidelines`, `parameters` (TypeBox), `annotations`, `prepareArguments`, `execute(toolCallId, params, signal, onUpdate, ctx)`; `Type` is re-exported by `@earendil-works/pi-ai`; `ctx.modelRegistry.getProviderAuth("openai")` returns `{ auth: { apiKey, headers, baseUrl }, env, source }` and `getProvider("openai")` returns the provider (`baseUrl` `https://api.openai.com/v1`) — Evidence: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`, `dist/core/model-registry.d.ts`, `node_modules/@earendil-works/pi-ai/dist/providers/openai.js`.
- [confirmed] `packages/pi-codex-auto-review/package.json` and `tsconfig.json` are the manifest/tsconfig templates (ESM, `tsc` → `dist/`, `pi.extensions`, peer `@earendil-works/*`, dev-pinned `0.99.1`, `engines.node >=22.19.0`); its `src/index.ts` default-exports the extension factory — Evidence: those files.

## Desired Outcome (To-Be)
- `packages/pi-codex-image-gen` (`@buyong/pi-codex-image-gen` 0.1.0) builds through root `npm run build`, passes `npm run check`, and loads with `pi -ne -e packages/pi-codex-image-gen/dist/index.js`.
- The model sees one tool `image_gen` whose declared JSON schema equals the Codex model-facing schema (no `maxItems`/`minimum`/`maximum`/`default`), whose description is the Codex text with exactly the four FDD changes, and which has no `promptSnippet` or `promptGuidelines`.
- Argument validation runs inside the tool in Codex order and returns Codex's error strings (serde-format messages for parse errors, without the `at line N column M` suffix); Pi's generic `Validation failed for tool` message never reaches the model for `image_gen`.
- A typed request plan (`generate` / `edit-paths` / `edit-history` with `prompt`, `background`, expanded absolute paths or count) and an `openai` credential resolver (`apiKey`, `headers`, `baseUrl`, and the FDD §9.1 missing-credential message) exist as modules for `02-backend`, `04-ref-images`, and `05-exposure`.
- Until `02-backend` lands, `execute()` returns an explicit error result `image generation failed: backend unavailable (pending 02-backend)` so the intermediate checkout is loadable but never silently succeeds.
- `docs/handoffs/image-gen/01-tool-contract.json` records the schema, description digest, error strings, module exports, and verification results.

## Scope
### In Scope
- `packages/pi-codex-image-gen/package.json`, `tsconfig.json`, `src/index.ts` (default-export factory calling `pi.registerTool`), `src/tool.ts` (definition, schema, description, `prepareArguments`, placeholder `execute`), `src/arguments.ts` (parse + plan), `src/auth.ts` (credential resolution), `src/description.ts` or a `.md` loaded at build time.
- Root `package-lock.json` update from `npm install` for the new workspace (no new dependencies).
- The handoff JSON.
### Out of Scope
- [hard] Any HTTP request to OpenAI, image saving, result content, retry — `02-backend` owns these.
- [hard] Reading reference image files or scanning session history — `04-ref-images`.
- [hard] Credential-gated tool/skill exposure and `setActiveTools` — `05-exposure`.
- [hard] The skill copy and `pi.skills` manifest entry — `03-skill`.
- [hard] Modifying `packages/pi-codex-auto-review`, `scripts/*.mjs`, `.github/workflows/*`.
- [hard] Adding automated test files (not requested); verification uses build, lint, `node -e` inspections, and a live `pi` session.
- [hard] `promptSnippet`, `promptGuidelines`, and any system-prompt text about this tool (FDD §9.3).

## Constraints
- TypeScript only; runtime imports limited to `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and Node built-ins (FDD §9.11). No new `dependencies`.
- Manifest mirrors `packages/pi-codex-auto-review/package.json`: `"type": "module"`, `main`/`types` under `dist/`, `exports["."]`, `"pi": { "extensions": ["./dist/index.js"] }`, `scripts.build: "tsc"`, `peerDependencies` on `@earendil-works/pi-ai`, `pi-coding-agent`, `pi-tui` with floor `>=0.99.1` (the only verified version), `devDependencies` pinned `0.99.1`, `@types/node` `24.0.0`, `typescript` `6.0.3`, `engines.node >=22.19.0`, `license: Apache-2.0`, `publishConfig.access: public`, `keywords` `pi-package`, `pi-extension`. Do not add `prepack`/`postpack` (the shared scripts are hard-coded to auto-review).
- Schema: build `parameters` so the declared JSON equals the Codex model-facing schema in As-Is (nullable `referenced_image_paths` and `num_last_images_to_include`, `prompt` required, `additionalProperties: false`, `transparent_background` description verbatim, no limits or defaults). `null` is treated as absent.
- `prepareArguments` performs the complete Codex check order and throws `Error` with these exact messages: `` unknown field `<name>`, expected one of `prompt`, `transparent_background`, `referenced_image_paths`, `num_last_images_to_include` `` (first unknown key), `` missing field `prompt` ``, serde-style type errors `invalid type: <json type description>, expected <expected>` (e.g. `invalid type: string "x", expected a boolean`; integer fields expect `usize`), `AbsolutePathBuf deserialized without a base path` for a relative path (after `~` expansion to the home directory), then `` `referenced_image_paths` must contain at most 5 paths ``, then `` provide only one of `referenced_image_paths` or `num_last_images_to_include` ``, then `` `num_last_images_to_include` must be between 1 and 5 ``. No `at line … column …` suffix (FDD §9.11).
- The returned plan carries `background: "transparent" | "opaque"` derived from `transparent_background`, `model: "gpt-image-2"`, `quality: "auto"`, `size: "auto"` so consumers never recompute them (FDD §9.5).
- `annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }` (FDD §11.1).
- `src/auth.ts` resolves credentials only through `ctx.modelRegistry.getProviderAuth("openai")` and `getProvider("openai")`; base URL is `auth.baseUrl ?? provider.baseUrl ?? "https://api.openai.com/v1"` without trailing `/`; the missing-credential message names both `/login` (OpenAI, Sign in with ChatGPT) and `OPENAI_API_KEY`. Never read Pi credential files.
- Keep Biome formatting (4-space indent) so `npm run check` passes.

## Related Files / Entry Points
- `docs/FDD/codex-image-gen.md` — §9.2 schema, §9.3 description changes, §9.4 check order, §9.6 error strings, §9.11 parity rules; read first.
- `tmp/codex-main/codex-rs/ext/image-generation/imagegen_description.md` — source text for the description.
- `tmp/codex-main/codex-rs/ext/image-generation/src/tool.rs` — `ImagegenArgs`, `parse_args()`, `request_for_call_args()` define the contract to mirror.
- `tmp/codex-main/codex-rs/tools/src/json_schema/types.rs` — `JsonSchema` field list that bounds the model-facing schema.
- `tmp/codex-main/codex-rs/utils/absolute-path/src/lib.rs` — `~` expansion and relative-path rejection.
- `packages/pi-codex-auto-review/package.json` — manifest template.
- `packages/pi-codex-auto-review/tsconfig.json` — copy verbatim.
- `packages/pi-codex-auto-review/src/index.ts` — default-export factory pattern (pattern only, no import).
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` — `ToolDefinition`, `prepareArguments`, `ExtensionToolContext`.
- `node_modules/@earendil-works/pi-ai/dist/utils/validation.js` — how Pi validates after `prepareArguments`.
- `packages/pi-codex-image-gen/package.json` (proposed) — new manifest.
- `packages/pi-codex-image-gen/src/index.ts` (proposed) — extension entry.
- `packages/pi-codex-image-gen/src/tool.ts` (proposed) — tool definition.
- `packages/pi-codex-image-gen/src/arguments.ts` (proposed) — Codex-order parsing and plan.
- `packages/pi-codex-image-gen/src/auth.ts` (proposed) — `openai` credential resolution.
- `docs/handoffs/image-gen/01-tool-contract.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Create the buildable package
- Starts when: `master` is at `d5aa4c2` or later with a clean tree for `packages/` and `node --version` satisfies `>=22.19.0`.
- Work: Add `packages/pi-codex-image-gen` with manifest, `tsconfig.json`, and an `index.ts` factory that registers nothing yet; run `npm install` at the root so the lockfile links the workspace.
- No-op when: `packages/pi-codex-image-gen/package.json` already names `@buyong/pi-codex-image-gen` and `npm run build` exits 0 with `dist/index.js` present.
- No-op handoff: `docs/briefs/2026-10-05-feat-codex-image-gen-02-backend.md` receives the existing `docs/handoffs/image-gen/01-tool-contract.json` describing the current layout.
- Deliverable: A workspace package that builds through Turborepo and loads in Pi.
- Verify: `npm run build && npm run check`; Inputs: repository root with the new package; Expected: both exit 0 and `packages/pi-codex-image-gen/dist/index.js` exists.
- Ends when:
  - [ ] `pi -ne -e packages/pi-codex-image-gen/dist/index.js --print "say hi"` completes without an extension load error.
  - [ ] `git diff --stat package-lock.json` shows only the new workspace link, no dependency version change.
- Handoff: Stage 2 receives the buildable package.
- Replan when: `npm install` changes any existing dependency version (concurrent lockfile edits); stop, re-run `npm install` on a fresh checkout state, and report to the parent before continuing.

### Stage 2 — Declare the tool with the Codex schema and description
- Starts when: Stage 1 builds.
- Work: Implement `src/tool.ts` with name, label, description (Codex text with the four FDD changes), the model-facing schema, annotations, no `promptSnippet`/`promptGuidelines`, and a placeholder `execute()` returning the explicit `isError` result; register it in `index.ts`.
- Deliverable: A registered `image_gen` tool whose declaration matches Codex.
- Verify: `node -e "import('./packages/pi-codex-image-gen/dist/tool.js').then(m=>console.log(JSON.stringify(m.imageGenTool.parameters)))"`; Inputs: the built `dist/tool.js`; Expected: output JSON deep-equals the As-Is Codex schema (four properties, `required: ["prompt"]`, `additionalProperties: false`, no `maxItems`/`minimum`/`maximum`/`default`), and `grep -c "image_gen.imagegen\|view_image\|@exec\|generatedImage\|python" packages/pi-codex-image-gen/dist/*.js` prints 0 for every file.
- Ends when:
  - [ ] In `pi -ne -e packages/pi-codex-image-gen/dist/index.js`, the session file's tool declaration lists `image_gen` with the expected schema and the system prompt contains no `image_gen` snippet or rule.
  - [ ] Calling the tool returns `image generation failed: backend unavailable (pending 02-backend)` as an error result.
- Handoff: Stage 3 receives the registered tool.
- Replan when: Pi 0.99.1 rewrites the declared schema (e.g. drops `type: [..., "null"]`); record the actual declaration and align the TypeBox construction so the model-facing JSON matches, or report the unavoidable difference to the parent for FDD §9.11.

### Stage 3 — Codex-order argument parsing, plan, and credential resolver
- Starts when: Stage 2's declaration is verified.
- Work: Implement `src/arguments.ts` (`prepareArguments` → `ImageRequestPlan`) with the exact check order and messages from Constraints, `~` expansion and relative-path rejection, and `src/auth.ts` (`resolveOpenAiCredentials(ctx)` → `{ apiKey, headers, baseUrl } | { error }`); wire `prepareArguments` into the tool.
- Deliverable: Exported `parseImageGenArguments()`, `ImageRequestPlan`, `resolveOpenAiCredentials()`, `MISSING_CREDENTIAL_MESSAGE`.
- Verify: `node --input-type=module -e "<script importing dist/arguments.js and asserting each case>"`; Inputs: cases `{}`, `{prompt:"x", foo:1}`, `{prompt:1}`, `{prompt:"x", referenced_image_paths:"a"}`, `{prompt:"x", referenced_image_paths:["./a.png"]}`, `{prompt:"x", referenced_image_paths:["~/a.png"]}`, six absolute paths, `{prompt:"x", referenced_image_paths:["/a.png"], num_last_images_to_include:1}`, `{prompt:"x", num_last_images_to_include:0}` and `6`, `{prompt:"x", num_last_images_to_include:null, referenced_image_paths:null}`; Expected: each invalid case throws exactly the string listed in Constraints (first unknown key, `missing field `prompt``, type error, relative-path error, at-most-5, provide-only-one, between-1-and-5) and the valid cases return plans `generate`, `edit-paths` with `/Users/<home>/a.png`, `edit-history` with the count, each carrying `model: "gpt-image-2"`, `quality: "auto"`, `size: "auto"`, and `background` `opaque` unless `transparent_background: true`.
- Ends when:
  - [ ] Pi's generic `Validation failed for tool "image_gen"` message is not reachable for any case above (the thrown message is returned verbatim as the tool error).
  - [ ] `resolveOpenAiCredentials()` returns the `openai` key and base URL in a live session with credentials and the FDD §9.1 message in a session whose agent directory has no `openai` credential and no `OPENAI_API_KEY`.
- Handoff: `02-backend`, `03-skill`, and `05-exposure` receive `docs/handoffs/image-gen/01-tool-contract.json` with `status`, `package` (name, dir, version, entry), `tool` (name, label, `schema`, `descriptionSha256`, `annotations`), `argumentContract` (plan type, check order, `errorStrings`), `auth` (exports, `baseUrlRule`, `missingCredentialMessage`), `placeholderExecute`, `commands`, `unresolved`.
- Replan when: A Codex serde message cannot be reproduced for a parsed-argument shape (for example a non-object argument payload); record the case and the Pi message actually emitted in `unresolved` and continue.
- Worker decision: Whether the description is embedded as a TypeScript string constant or read from a bundled `.md` at build time, as long as `dist/` contains the exact text.

## Side Effect Checkpoints
- [ ] `npm run build` still produces `packages/pi-codex-auto-review/dist` unchanged (identical file list and digests).
- [ ] `packages/pi-codex-auto-review`, `scripts/*.mjs`, and `.github/workflows/*` have no diff.
- [ ] The built package imports nothing outside `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `node:*` (`grep -h "^import" packages/pi-codex-image-gen/dist/*.js`).
- [ ] With the auto-review extension also loaded, `image_gen` is routed by its `annotations` (`openWorldHint: true` → review) and auto-review behavior is unchanged.
- [ ] The placeholder error never writes a file or sends a request (no `generated_images` directory appears).

## Acceptance Criteria
- [ ] `npm run build` and `npm run check` exit 0 with the new package included.
- [ ] The declared `image_gen` schema deep-equals the Codex model-facing schema and the description equals the Codex text with exactly the four FDD changes (diff against `imagegen_description.md` shows only those edits).
- [ ] Every argument case in Stage 3 returns the exact Codex string listed in Constraints and valid cases return the expected plan.
- [ ] `docs/handoffs/image-gen/01-tool-contract.json` exists with `status: "complete"` and the fields named in Stage 3.

## Open Questions
- [non-blocking] Is `packages/pi-codex-image-gen` with npm name `@buyong/pi-codex-image-gen` the intended package identity? — Default: use that directory and name, matching `@buyong/pi-codex-auto-review`; Reconfirm before: the first `npm run release` for this package.
