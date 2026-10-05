# [feat] Implement the Images API backend, retry, saving, and generation result

## Work Type
feat

## Current State (As-Is)
- [confirmed] After `01-tool-contract`, `image_gen` is declared with the Codex schema and `prepareArguments` yields an `ImageRequestPlan`, but `execute()` returns `image generation failed: backend unavailable (pending 02-backend)` — Evidence: `docs/handoffs/image-gen/01-tool-contract.json` (`placeholderExecute`).
- [confirmed] Codex posts generation as JSON to `{base_url}/images/generations` and edits to `{base_url}/images/edits`, parses `{created, data:[{b64_json, generation_id?}], background?, quality?, size?}`, and uses only `data[0].b64_json`; an empty `data` array yields `image generation returned no image data`; a missing `data` field is a decode error — Evidence: `ImagesClient::generate()`/`edit()`/`post_image_request()` in `tmp/codex-main/codex-rs/codex-api/src/endpoint/images.rs`; `ImageResponse` in `codex-api/src/images.rs`; `handle_call()` in `tmp/codex-main/codex-rs/ext/image-generation/src/tool.rs`.
- [confirmed] Codex request bodies carry `model: "gpt-image-2"`, `quality: "auto"`, `size: "auto"`, `background: "transparent" | "opaque"`, no `n` — Evidence: `IMAGE_MODEL` and `request_for_call_args()` in `tool.rs`.
- [confirmed] The public OpenAI SDK sends `/images/edits` as multipart form data with one `image[]` file part per image, and `/images/generations` as JSON — Evidence: `edit()` using `multipartFormRequestOptions` in `node_modules/openai/resources/images.js`; `key + '[]'` array encoding in `node_modules/openai/internal/uploads.js`.
- [confirmed] Codex retry policy: `max_attempts` 4 (so up to 5 tries), `base_delay` 200 ms, `retry_429: false`, `retry_5xx: true`, `retry_transport: true`; backoff `base × 2^(attempt−1)` with jitter in `0.9..1.1`; `Retry-After` honored when present — Evidence: `ApiRetryConfig` in `tmp/codex-main/codex-rs/model-provider-info/src/lib.rs` (`DEFAULT_REQUEST_MAX_RETRIES = 4`); `should_retry()`, `backoff()`, `run_with_retry()` in `tmp/codex-main/codex-rs/codex-client/src/retry.rs`.
- [confirmed] Codex failure text is `image generation failed: ` + the error's display: HTTP → `http <StatusCode Display>: <Option<String> Debug>` (e.g. `http 401 Unauthorized: Some("…")`), `timeout`, `connection failed: <e>`, `network error: <e>`, `retry limit reached`; decode failures → `stream error: failed to decode image generation response: <e>` (`image edit response` for edits) — Evidence: `TransportError` in `tmp/codex-main/codex-rs/http-client/src/error.rs`; `ApiError` in `tmp/codex-main/codex-rs/codex-api/src/error.rs`; `ImageBackendError::from_image_request()` in `tmp/codex-main/codex-rs/ext/image-generation/src/backend.rs`.
- [confirmed] Codex saves to `{save_root}/generated_images/{sanitize(session)}/{sanitize(call)}.png`, replacing every character outside `[A-Za-z0-9_-]` with `_` and using `generated_image` for an empty name; the save-root path creates parents recursively and overwrites an existing file; a save failure only logs a warning and the call still succeeds — Evidence: `image_generation_artifact_path()` in `tmp/codex-main/codex-rs/ext/image-generation/src/artifact.rs`; the `Some(save_root)` branch of `save_image_generation_result()` in `tool.rs`.
- [confirmed] Codex returns the image as `data:image/png;base64,…` plus an output hint (dropped when longer than 1024 bytes) with the exact three sentences in `image_generation_output_hint()`; an empty `b64_json` is treated as success — Evidence: `artifact.rs`; `GeneratedImageOutput::to_response_item()` in `tool.rs`.
- [confirmed] Pi `AgentToolResult` is `{ content: (TextContent | ImageContent)[], details, isError? }`; `ImageContent` is `{ type: "image", data, mimeType }`; `getAgentDir()` is exported by `@earendil-works/pi-coding-agent`; the FDD fixes the save root as `<agentDir>/generated_images/<sessionId>/<toolCallId>.png` — Evidence: `pi-agent-core/dist/types.d.ts`, `pi-coding-agent/dist/index.d.ts`, FDD §9.7.
- [confirmed] Pi's `openai` provider sends `OPENAI_API_KEY` and the ChatGPT sign-in token alike as `apiKey` to `https://api.openai.com/v1`; `getProviderAuth()` refreshes a near-expiry OAuth token and rejects when refresh fails — Evidence: `openaiProvider()` in `node_modules/@earendil-works/pi-ai/dist/providers/openai.js`, `openaiChatGPTOAuth.toAuth()` in `dist/auth/oauth/openai-chatgpt.js`, `Models.getAuth()` in `dist/models.js`.
- [inferred] Whether `/v1/images/generations` accepts the ChatGPT sign-in token and whether the account can use `gpt-image-2` is unverified — Confirm by: the Stage 3 live call with each configured credential type, after the user approves the paid call.

## Desired Outcome (To-Be)
- A prompt-only `image_gen` call generates a PNG through `POST {baseUrl}/images/generations`, shows the image in the TUI, returns the image plus the Codex output hint to the model, and saves `<agentDir>/generated_images/<sessionId>/<toolCallId>.png` (overwriting an existing file).
- An `ImagesClient` with `generate(plan)` (JSON) and `edit(plan, images)` (multipart `image[]` parts from already-prepared `{ bytes, mimeType, fileName }` inputs) applies the Codex retry policy, honors the tool `signal`, and maps failures to the Codex strings.
- Response handling matches Codex: `data[0].b64_json` only; empty `data` → `image generation returned no image data`; missing/undecodable response → the `stream error: failed to decode …` form; empty `b64_json` → success with an empty file and empty image (FDD §9.11).
- The call-time credential check returns the FDD §9.1 message before any request when no `openai` credential resolves (including refresh failure).
- Edit plans reach the edit client only after `04-ref-images` supplies images; until then an edit plan returns the explicit error `image generation failed: reference images unavailable (pending 04-ref-images)`.
- `docs/handoffs/image-gen/02-backend.json` records request/response shapes, retry policy, error strings, artifact rules, result shape, and the live run matrix.

## Scope
### In Scope
- `packages/pi-codex-image-gen/src/backend.ts` (client, retry, error mapping), `src/artifact.ts` (sanitize, path, write, hint), `src/result.ts` (result content/details), and the `execute()` body in `src/tool.ts` (progress update, credential check, generate path, save, result; edit dispatch stub).
- One approved live generation call per available credential type to confirm the endpoint, model, and response shape.
- The handoff JSON.
### Out of Scope
- [hard] Reading local reference images, scanning session history, or building the `images` input for edits — `04-ref-images`.
- [hard] Tool/skill exposure, `setActiveTools`, `session_start`/`before_agent_start` handlers — `05-exposure`.
- [hard] Changing the declared schema, description, `prepareArguments`, or error strings owned by `01-tool-contract`.
- [hard] Codex-backend-only behavior: `chatgpt-account-id`/`originator`/`x-codex-image-turn-id` headers, usage-limit (`image_gen`) mapping, request-id analytics (FDD §9.11).
- [hard] Local file-size limits, destination-exists refusal, symlink checks — these belong to Codex's workspace fallback path, not the save-root path (FDD §9.7).
- [hard] Modifying `packages/pi-codex-auto-review`, `scripts/*.mjs`, `.github/workflows/*`; adding test files.
- [deferred] Quality/size/model options, `n > 1`, streaming partial images (FDD §12).

## Constraints
- TypeScript only; use Node 22 global `fetch`, `FormData`, `Blob`, `Buffer`; no new `dependencies` (FDD §9.11).
- Headers: `Authorization: Bearer ${apiKey}` plus any `auth.headers` from `01`'s resolver; no Codex-backend headers. Generation uses `Content-Type: application/json`; edit lets `fetch` set the multipart boundary and sends `prompt`, `model`, `background`, `quality`, `size` as text fields plus one `image[]` part per image with its MIME type and file name.
- Retry exactly as Codex: at most 5 attempts; retry only on HTTP 5xx and on timeout/connection/network errors (never 429 or other 4xx); delay for retry attempt `k` (1-based) is `200 ms × 2^(k−1)` scaled by a random factor in `[0.9, 1.1)`, replaced by `Retry-After` (seconds or HTTP-date) when the response has it; abort immediately when `signal` fires, including during a delay.
- Error strings (FDD §9.6): final HTTP failure → `image generation failed: http <status> <canonical reason>: Some("<body>")` (`None` when the body is empty; use the IANA reason phrase table so HTTP/2 responses still carry the reason); transport failures → `image generation failed: timeout` / `connection failed: <e>` / `network error: <e>` / `retry limit reached`; decode failure → `image generation failed: stream error: failed to decode image generation response: <e>` (`image edit response` for edits); empty `data` → `image generation returned no image data`.
- Response handling: use only `data[0].b64_json`; treat an empty string as success (write a 0-byte file, return an empty `image/png` block). Ignore `background`/`quality`/`size` echoes.
- Save path and rules from FDD §9.7: root `getAgentDir()`, `generated_images/<sanitize(sessionId)>/<sanitize(toolCallId)>.png`, sanitize = keep `[A-Za-z0-9_-]`, else `_`, empty → `generated_image`; `mkdir -p`; overwrite; save failure → still a success result, hint omitted, `details.savedPath` absent.
- Output hint verbatim from Codex (`artifact.rs`), with `<dir>` = parent directory and `<path>` = file path; omit when `Buffer.byteLength(hint) > 1024`.
- Result `content` = `[{ type: "image", data: <b64>, mimeType: "image/png" }, { type: "text", text: <hint> }?]`; `details` = `{ operation: "generate" | "edit", background, savedPath? }` with no base64; call `onUpdate` once before the request with a short progress text and `details.operation`.
- Never log, return, or store the key/token; strip `Authorization` from any error text.
- No request time limit shorter than the Codex "a few minutes" expectation; if a timeout is added, make it ≥ 300 000 ms and route its expiry to the `timeout` error string.
- Live calls spend the user's OpenAI quota: ask the user in chat before the first paid call and record each run (credential type, operation, HTTP status, model) in the handoff without body images.

## Related Files / Entry Points
- `docs/handoffs/image-gen/01-tool-contract.json` (proposed) — consume `ImageRequestPlan`, `resolveOpenAiCredentials`, and the placeholder contract.
- `docs/FDD/codex-image-gen.md` — §8.1 behavior, §8.3 failures, §9.5 request values, §9.6 error strings, §9.7 saving, §9.8 hint, §9.11 retry and parity.
- `tmp/codex-main/codex-rs/codex-api/src/endpoint/images.rs` — endpoint paths and response parsing to mirror.
- `tmp/codex-main/codex-rs/codex-client/src/retry.rs` — `should_retry()`, `backoff()`, `run_with_retry()` to mirror.
- `tmp/codex-main/codex-rs/http-client/src/error.rs` — `TransportError` display strings.
- `tmp/codex-main/codex-rs/ext/image-generation/src/artifact.rs` — sanitize rule and hint text.
- `tmp/codex-main/codex-rs/ext/image-generation/src/tool.rs` — `handle_call()`, `save_image_generation_result()`, `GeneratedImageOutput`.
- `node_modules/openai/resources/images.js` — multipart `image[]` encoding reference for the public API.
- `packages/pi-codex-image-gen/src/tool.ts` (proposed) — replace the placeholder `execute()` body.
- `packages/pi-codex-image-gen/src/backend.ts` (proposed) — `ImagesClient`, retry, error mapping.
- `packages/pi-codex-image-gen/src/artifact.ts` (proposed) — path, write, hint.
- `packages/pi-codex-image-gen/src/result.ts` (proposed) — result content and details.
- `docs/handoffs/image-gen/02-backend.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Images client with Codex retry and error mapping
- Starts when: `docs/handoffs/image-gen/01-tool-contract.json` has `status: "complete"` and names `ImageRequestPlan` and `resolveOpenAiCredentials`.
- Work: Implement `backend.ts` with `generate(plan, auth, signal)` (JSON) and `edit(plan, images, auth, signal)` (multipart), the retry loop, `Retry-After` handling, abort propagation, response parsing, and the Codex error strings.
- No-op when: `packages/pi-codex-image-gen/dist/backend.js` already exports `ImagesClient` whose retry constants and error strings match Constraints and `01-tool-contract.json` lists no placeholder.
- No-op handoff: `docs/briefs/2026-10-05-feat-codex-image-gen-04-ref-images.md` receives the existing `docs/handoffs/image-gen/02-backend.json`.
- Deliverable: `ImagesClient` with documented request shapes and error mapping, exercised against a local mock server.
- Verify: `node --input-type=module -e "<script starting a local http server that scripts responses, then calling dist/backend.js>"`; Inputs: scripted responses `500,500,200`, `429`, `401` with JSON body, `200` with `{}`, `200` with `{"created":1,"data":[]}`, `200` with `Retry-After: 1` then `503`, and an `AbortController` aborted during the first backoff; Expected: `500,500,200` succeeds after 3 attempts with delays ≈200 ms and ≈400 ms (±10%); `429` fails once with `image generation failed: http 429 Too Many Requests: Some("…")`; `401` fails once with the `http 401 Unauthorized` string; `{}` yields the `stream error: failed to decode image generation response` form; empty `data` yields `image generation returned no image data`; `Retry-After` is honored; the abort stops before the next attempt; the multipart body from `edit()` contains `image[]` parts and the five text fields.
- Ends when:
  - [ ] The generate JSON body equals `{"prompt","background","model":"gpt-image-2","quality":"auto","size":"auto"}` with no `n`.
  - [ ] No error string or log line contains the bearer value.
- Handoff: Stage 2 receives `ImagesClient`.
- Replan when: Node's `fetch` cannot express a required behavior (e.g. `Retry-After` date parsing or multipart file names); record the gap in `unresolved` and report to the parent instead of adding a dependency.

### Stage 2 — Artifact saving, result content, and the generation path
- Starts when: Stage 1's client passes the mock cases.
- Work: Implement `artifact.ts` (path, sanitize, mkdir, overwrite write, hint ≤ 1024 bytes) and `result.ts`; replace the placeholder `execute()` with: `onUpdate` progress → credential check (FDD §9.1 message) → `generate` plans call the client → parse → save → result; `edit-*` plans return `image generation failed: reference images unavailable (pending 04-ref-images)`.
- Deliverable: End-to-end generation against the mock server from a live Pi session, with the file saved under the agent directory.
- Verify: `Inspect the saved artifact and tool result in a pi session pointed at the mock server`; Inputs: `pi -ne -e packages/pi-codex-image-gen/dist/index.js` with the `openai` provider's base URL overridden to the mock (via a `models.json` provider entry or the resolver's base URL) and a request that makes the model call `image_gen` with a prompt; Expected: the mock receives one JSON POST to `/images/generations`, the TUI shows the returned image, the session file's tool result has one `image` block and one text block equal to the Codex hint with the real paths, and `file <agentDir>/generated_images/<sanitized session>/<sanitized call>.png` reports PNG data; re-running with the same ids overwrites the file.
- Ends when:
  - [ ] With the agent directory made read-only, the call still succeeds, the result has no hint, and `details.savedPath` is absent.
  - [ ] With `OPENAI_API_KEY` unset and no stored `openai` login (temporary `PI_CODING_AGENT_DIR`), the tool returns the §9.1 message without contacting the mock.
  - [ ] An edit plan returns the pending-04 error without contacting the mock.
- Handoff: Stage 3 receives the working generation path.
- Replan when: Pi does not render or forward the image block as expected (e.g. `blockImages` or non-vision model); record the observed behavior and confirm it matches FDD §6 before continuing.

### Stage 3 — Approved live generation and handoff
- Starts when: Stage 2 passes and the user has approved paid live calls in chat.
- Work: Run one real generation per available credential type (`OPENAI_API_KEY`; ChatGPT sign-in token) against `https://api.openai.com/v1`, record status/model/outcome, then write `docs/handoffs/image-gen/02-backend.json`.
- Deliverable: `docs/handoffs/image-gen/02-backend.json` with `status`, `endpoints`, `requestShapes` (generate JSON, edit multipart parts), `retryPolicy`, `errorStrings`, `artifact` (`root`, `pattern`, `sanitize`, `overwrite: true`, `hintByteLimit`), `resultShape`, `editClient` (signature `04` must call), `liveRuns` [{`credentialType`, `operation`, `httpStatus`, `model`, `outcome`}], `unresolved`.
- Verify: `Inspect the live run record and the saved file`; Inputs: `docs/handoffs/image-gen/02-backend.json` and the saved PNG path it names; Expected: at least one `liveRuns` entry has `httpStatus: 200` with a PNG saved, and every tested credential type has an entry with its actual status.
- Ends when:
  - [ ] The handoff validates as JSON and contains no key, token, or base64 image data.
- Handoff: `docs/briefs/2026-10-05-feat-codex-image-gen-04-ref-images.md` receives `docs/handoffs/image-gen/02-backend.json`.
- Replan when: The ChatGPT sign-in token is rejected while the API key works, or `gpt-image-2` is rejected for the account; stop, record the exact status and body in `liveRuns`, and return to the parent for a user decision (API-key-only release or another model) before `04` starts.
- Worker decision: How the mock server base URL is injected for Stage 2 (test `models.json` provider or an environment override read only when set), as long as production behavior uses the resolver's base URL rule.

## Side Effect Checkpoints
- [ ] `01`'s declared schema, description, and `prepareArguments` behavior are unchanged (re-run the `01` Stage 2/3 inspections).
- [ ] `packages/pi-codex-auto-review` has no diff; `npm run build && npm run check` exit 0.
- [ ] The session file for the live run contains the base64 image in the tool result (expected, as in Codex) but no `Bearer` or key string.
- [ ] No request is sent when the plan is invalid, when credentials are missing, or when the user cancels before the first attempt.
- [ ] No file is written for failed or cancelled calls.

## Acceptance Criteria
- [ ] A prompt-only `image_gen` call in a live Pi session returns the image and the Codex hint and saves `<agentDir>/generated_images/<sessionId>/<toolCallId>.png`.
- [ ] Every scripted failure case in Stage 1 produces the exact Codex string listed in Constraints, and the retry schedule matches the Codex policy within jitter.
- [ ] Missing credentials and cancellation end the call without a request or a file.
- [ ] `docs/handoffs/image-gen/02-backend.json` exists with `status: "complete"` (or `blocked` with the rejection recorded) and the fields named in Stage 3.

## Open Questions
- None — request values, retry, error strings, and saving are fixed by the FDD; endpoint acceptance is a technical unknown routed to Stage 3's `Replan when`.
