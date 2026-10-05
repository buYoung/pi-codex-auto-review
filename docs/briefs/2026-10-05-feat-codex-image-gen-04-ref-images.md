# [feat] Collect reference images for edits from local paths and session history

## Work Type
feat

## Current State (As-Is)
- [confirmed] After `02-backend`, generation works end-to-end and `ImagesClient.edit(plan, images, auth, signal)` accepts prepared `{ bytes, mimeType, fileName }` inputs, but `edit-paths`/`edit-history` plans return `image generation failed: reference images unavailable (pending 04-ref-images)` — Evidence: `docs/handoffs/image-gen/02-backend.json` (`editClient`).
- [confirmed] Codex reads each referenced file, sniffs the format from content, decodes it, passes png/jpeg/webp bytes through unchanged, and re-encodes every other decodable format (e.g. GIF) to PNG; there is no size limit; read failure → `` unable to read referenced image at `<path>`: <error> ``, decode failure → `` unable to process referenced image at `<path>`: <error> `` — Evidence: `image_url()` in `tmp/codex-main/codex-rs/ext/image-generation/src/tool.rs`; `load_for_prompt_bytes_uncached()` and `can_preserve_source_bytes()` in `tmp/codex-main/codex-rs/utils/image/src/lib.rs`.
- [confirmed] Codex `recent_images()` walks history newest-first over every `Message` item regardless of role plus tool outputs and earlier image-generation results, takes image blocks in reverse order inside each item, stops at exactly N, returns chronological order, and otherwise fails with `requested the last <N> conversation images, but only <M> were available` — Evidence: `recent_images()` / `output_images()` in `tool.rs`.
- [confirmed] Pi's model-visible context is `ctx.sessionManager.buildSessionProjection().messages` (compaction and `context_edit` applied); `buildContextEntries()` ignores `context_edit`; image blocks appear in `user`, `custom`, and `toolResult` messages as `ImageContent { type: "image", data, mimeType }` — Evidence: `ReadonlySessionManager`, `buildSessionProjection()`, `CustomMessageEntry` in `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts`; `ImageContent` in `node_modules/@earendil-works/pi-ai/dist/types.d.ts`; the 2026-10-05 independent review.
- [confirmed] Pi exports `convertToPng(base64Data, mimeType)` (WASM image decode, applies EXIF orientation, returns `null` on failure) from `@earendil-works/pi-coding-agent`; the FDD §9.11 designates it as the only decode/convert mechanism — Evidence: `node_modules/@earendil-works/pi-coding-agent/dist/index.d.ts`, `dist/utils/image-convert.js`.
- [confirmed] The FDD §9.4 fixes: absolute paths only (`~` expanded by `01`), content-based format detection, decode check for every image, png/jpeg/webp pass-through, other formats → PNG, no size limit; history from the model-visible context over `user`/`custom`/`toolResult` messages — Evidence: `docs/FDD/codex-image-gen.md` §9.4, §9.11.
- [inferred] Whether `/v1/images/edits` accepts multipart `image[]` for `gpt-image-2` is unverified — Confirm by: the approved live edit call in Stage 3.

## Desired Outcome (To-Be)
- `edit-paths` plans read each path, detect the format by content, verify decodability, send png/jpeg/webp bytes unchanged and other formats converted to PNG, and fail with the Codex read/process strings naming the path.
- `edit-history` plans collect exactly N images from the model-visible context in Codex order (newest-first scan over `user`, `custom`, `toolResult` messages, reverse within a message, chronological result), including earlier `image_gen` results, and fail with the Codex count string.
- Both paths call `ImagesClient.edit()` and return the same result shape as generation (`details.operation: "edit"`), saving under the same artifact rule.
- `docs/handoffs/image-gen/04-ref-images.json` records detection rules, conversion behavior, history selection, and live edit runs.

## Scope
### In Scope
- `packages/pi-codex-image-gen/src/reference-images.ts` (path loader, format sniffing, decode check, conversion, history collector) and the edit dispatch in `src/tool.ts`.
- One approved live edit call per selector kind (paths, history) when credentials allow.
- The handoff JSON.
### Out of Scope
- [hard] Changing `ImagesClient` request shapes, retry, or error mapping — `02-backend`; if the edit client signature is insufficient, replan rather than editing `backend.ts` here.
- [hard] Argument parsing, `~` expansion, path count, selector combination checks — `01-tool-contract`.
- [hard] Local size limits, masks, `input_fidelity`, fixed-reference image ids (FDD §12, §13).
- [hard] Adding image libraries or any non-TypeScript component; only `convertToPng` and Node built-ins are allowed (FDD §9.11).
- [hard] Modifying `packages/pi-codex-auto-review`, `scripts/*.mjs`, `.github/workflows/*`; adding test files.

## Constraints
- Detect format from magic bytes: PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`, GIF `GIF8`, BMP `BM`, and treat anything else as "other"; MIME for pass-through is `image/png`, `image/jpeg`, `image/webp`.
- Decode check for every file through `convertToPng`: for pass-through formats call it with a non-PNG MIME argument so decoding actually runs, discard the output, and send the original bytes; for other formats send the returned PNG bytes with `image/png`; `null` → `` unable to process referenced image at `<path>`: <error> ``.
- `fs.readFile` errors → `` unable to read referenced image at `<path>`: <error message> `` (Node's error message, no stack).
- No file-size check; oversize files reach the API and fail as HTTP errors (FDD §13).
- History: use `ctx.sessionManager.buildSessionProjection().messages`; scan from the last message backward; consider `user`, `custom`, and `toolResult` messages; within a message iterate content blocks from last to first and take `type: "image"` blocks; stop when N collected; reverse to chronological; fewer than N → `requested the last <N> conversation images, but only <M> were available`.
- History images are sent with their recorded `mimeType` and a synthetic file name `image-<index>.<ext>`; convert non-png/jpeg/webp history images to PNG the same way as files.
- All collection and validation happens before the credential check and before any request; a collection failure sends nothing.
- Multipart part order follows the chronological image order so the API sees images in the order Codex would send them.

## Related Files / Entry Points
- `docs/handoffs/image-gen/02-backend.json` (proposed) — consume `editClient` signature and artifact/result rules.
- `docs/FDD/codex-image-gen.md` — §9.4 routing and selection rules, §9.6 strings, §9.11 parity differences (EXIF/ICC, decodable format set).
- `tmp/codex-main/codex-rs/ext/image-generation/src/tool.rs` — `image_url()`, `recent_images()`, `output_images()` to mirror.
- `tmp/codex-main/codex-rs/utils/image/src/lib.rs` — pass-through formats and PNG re-encoding behavior.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts` — `buildSessionProjection()` and message roles.
- `node_modules/@earendil-works/pi-coding-agent/dist/utils/image-convert.js` — `convertToPng` semantics (null on failure, EXIF orientation applied).
- `packages/pi-codex-image-gen/src/tool.ts` (proposed) — wire edit plans to the collector and the edit client.
- `packages/pi-codex-image-gen/src/reference-images.ts` (proposed) — path loader and history collector.
- `docs/handoffs/image-gen/04-ref-images.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Path loader with content sniffing and conversion
- Starts when: `docs/handoffs/image-gen/02-backend.json` has `status: "complete"` or `blocked` with a working generation path and names the `editClient` signature.
- Work: Implement `loadReferenceImages(paths)` with magic-byte detection, `convertToPng` decode check, pass-through vs conversion, and the two Codex error strings.
- No-op when: `dist/reference-images.js` already exports the loader and the Verify fixtures pass.
- No-op handoff: `docs/briefs/2026-10-05-chore-codex-image-gen-06-verification.md` receives the existing `docs/handoffs/image-gen/04-ref-images.json`.
- Deliverable: Loader returning `{ bytes, mimeType, fileName }[]` in input order.
- Verify: `node --input-type=module -e "<script importing dist/reference-images.js over a scratch directory>"`; Inputs: a scratch directory with a valid PNG, a JPEG, a WebP, a GIF, a text file renamed `.png`, and a nonexistent path; Expected: PNG/JPEG/WebP return the original bytes with their MIME, the GIF returns PNG bytes (`89 50 4E 47` header) with `image/png`, the fake PNG fails with `` unable to process referenced image at `<path>`: … ``, and the missing path fails with `` unable to read referenced image at `<path>`: ENOENT… ``.
- Ends when:
  - [ ] No size check exists (a 60 MB PNG fixture loads without a local error).
- Handoff: Stage 2 receives the loader.
- Replan when: `convertToPng` returns `null` for valid png/jpeg/webp fixtures on this machine (WASM unavailable); record the environment and report to the parent — FDD §13 names this risk.

### Stage 2 — History collector and edit dispatch
- Starts when: Stage 1 fixtures pass.
- Work: Implement `collectRecentImages(ctx, count)` over `buildSessionProjection().messages` with Codex order; wire both edit plans in `execute()` to the collector/loader and then `ImagesClient.edit()`, reusing `02`'s save and result code.
- Deliverable: Working edit path against the `02` mock server from a live Pi session.
- Verify: `Inspect the multipart request received by the mock and the session projection used`; Inputs: a session where the user attaches two images, then `image_gen` generates one image, then the model calls `image_gen` with `num_last_images_to_include: 2` and separately with `referenced_image_paths` pointing at the Stage 1 fixtures; Expected: the history call sends exactly the generated image and the second attached image in chronological order as `image[]` parts, the paths call sends the fixtures in argument order, both POST to `/images/edits` with `prompt`, `model`, `background`, `quality`, `size` text fields, and `num_last_images_to_include: 5` with only three images in context returns `requested the last 5 conversation images, but only 3 were available` without a request.
- Ends when:
  - [ ] After `/compact` or a `context_edit`, the collector only sees images still in the projection.
  - [ ] Edit results save under `generated_images/<session>/<call>.png` with `details.operation: "edit"`.
- Handoff: Stage 3 receives the edit path.
- Replan when: `buildSessionProjection()` is unavailable on `ReadonlySessionManager` in the running Pi or message roles differ from As-Is; record the actual shape and align the scan without changing the Codex order.

### Stage 3 — Approved live edit calls and handoff
- Starts when: Stage 2 passes and the user has approved paid live edit calls.
- Work: Run one real `edit-paths` call (a local PNG) and one `edit-history` call (the previous generation) against `https://api.openai.com/v1` with each available credential type; write the handoff.
- Deliverable: `docs/handoffs/image-gen/04-ref-images.json` with `status`, `formatDetection`, `conversion` (pass-through set, converted set, `convertToPng` behavior), `historySelection` (source, roles, order), `errorStrings`, `liveRuns` [{`credentialType`, `selector`, `httpStatus`, `outcome`}], `unresolved`.
- Verify: `Inspect the live run record and saved edit outputs`; Inputs: `docs/handoffs/image-gen/04-ref-images.json` and the PNG paths it names; Expected: each tested selector has an entry with its actual status, and a `200` run has a saved PNG whose source file is unchanged (same size and mtime).
- Ends when:
  - [ ] The handoff contains no credential or base64 data.
- Handoff: `docs/briefs/2026-10-05-chore-codex-image-gen-06-verification.md` receives `docs/handoffs/image-gen/04-ref-images.json`.
- Replan when: `/v1/images/edits` rejects multipart `image[]` for `gpt-image-2`; try the Codex JSON body (`images: [{ "image_url": "data:…" }]`) once, record which form the API accepts, and return to the parent because the accepted form changes `02-backend`'s edit client (FDD §13).

## Side Effect Checkpoints
- [ ] `02`'s generation path and `01`'s argument behavior are unchanged (re-run their Verify inspections).
- [ ] `backend.ts` is not modified by this child.
- [ ] Source files passed by path are never modified or moved.
- [ ] Session images are read only through the projection API; no session file is opened directly.
- [ ] `packages/pi-codex-auto-review` has no diff; `npm run build && npm run check` exit 0.

## Acceptance Criteria
- [ ] Fixture formats behave as Stage 1 specifies (pass-through for png/jpeg/webp, PNG conversion for GIF, Codex strings for unreadable and undecodable files).
- [ ] History selection reproduces the Codex order and count rule in a live session, including earlier `image_gen` results and compaction effects.
- [ ] Both edit selectors produce saved PNGs in a live session against the mock, and the approved live calls are recorded with their actual statuses.
- [ ] `docs/handoffs/image-gen/04-ref-images.json` exists with `status: "complete"` or `blocked` naming the rejected request form.

## Open Questions
- None — selection rules, formats, and error strings are fixed by the FDD; API acceptance of multipart edits is a technical unknown routed to Stage 3's `Replan when`.
