# [chore] Prove the Codex Computer Use runtime runs outside Codex

## Work Type
chore

## Current State (As-Is)
- [confirmed] The repository is `master` at `d5aa4c2`; no `packages/pi-codex-computer-use` directory exists and no code in this repository talks to the Codex Computer Use runtime — Evidence: `ls packages` shows only `pi-codex-auto-review`, `git status` on 2026-10-05.
- [confirmed] The runtime is OpenAI's proprietary bundle inside the ChatGPT desktop app: `/Applications/ChatGPT.app/Contents/Resources/cua_node` (bundle id `com.openai.codex`, app 26.930.31730) with `@oai/cua-repl` 0.1.0, `@oai/cua` 0.2.5, `@oai/sky` 0.7.5, `@oai/browser-desktop` 0.1.1 and the `node_repl` binary — Evidence: `docs/handoffs/computer-use/01-codex-runtime-bridge.md` § 확인 환경, `cua_node/manifest.json`.
- [confirmed] Codex Desktop launches the MCP server from `~/.codex/plugins/cache/openai-bundled/unified-computer-use/26.930.31730/.mcp.json`: `cua_node/bin/node` running `@oai/cua-repl/bin/cua-repl.mjs` with `CUA_REPL_ENABLED_SURFACES`, `CUA_REPL_NODE_REPL_PATH`, `NODE_REPL_TRUSTED_SERVICES`, `SKY_CUA_SERVICE_PATH`, `CODEX_HOME`, `BROWSER_USE_AVAILABLE_BACKENDS` and related variables — Evidence: that `.mcp.json`, § `cua_repl` 실행 설정 in the handoff document.
- [confirmed] A plain Node script sending `initialize` (protocol `2025-06-18`, `capabilities.elicitation.form`) and `tools/list` to that command succeeds for all four `CUA_REPL_ENABLED_SURFACES` combinations and returns tools `js`, `js_add_node_module_dir`, `js_reset`, `turn_ended`; `js` is annotated `readOnlyHint: true` — Evidence: § 직접 확인한 `cua_repl` MCP 계약 and § 직접 확인한 결과 in the handoff document (probe run on 2026-10-05, scratch script deleted).
- [confirmed] No `tools/call` has been sent yet; whether `js` can reach `SkyComputerUseService` from a non-Codex host, whether the service checks the connecting process, whether `elicitation/create` arrives and in what shape, and whether the missing `x-codex-turn-metadata` matters are all unknown — Evidence: § 미확인 사항 in the handoff document.
- [confirmed] `sky` locates the service app in this order: `SKY_CUA_SERVICE_PATH` → `$CODEX_HOME/computer-use/Codex Computer Use.app` → bundle id `com.openai.sky.CUAService`; when the service is down it needs `nodeRepl.nativePipe` / `nodeRepl.launchServices` (`ensureService` over the Unix socket `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`) — Evidence: `@oai/sky/dist/project/cua/sky_js/src/targets/mac/native-pipe.js`.
- [confirmed] `~/.codex/computer-use/Codex Computer Use.app` is byte-identical to the copy inside `@oai/sky`; the bundle carries `embedded.provisionprofile`, `*_Parent.coderequirement` and `SharedSupport/Codex Computer Use Installer.app`, so a plain copy may not be how Codex Desktop installs it — Evidence: § 설치 in the handoff document.
- [confirmed] Codex sends `_meta.callId`, `_meta["x-codex-turn-metadata"]` (including `session_id`, `thread_id`, `turn_id`, `model`, `node_repl_auto_review_required`, `node_repl_disabled`), `openai/confirmation_policies`, `threadId`, `sessionId` and conditionally `windowId`, `itemId`, `plugin_id` on `tools/call`; the `node_repl` binary contains `node_repl_auto_review_required`, `node_repl is unavailable for this model` and `NodeReplTurnMetadata` strings — Evidence: `tmp/codex-main/codex-rs/core/src/mcp_tool_call.rs` (`build_mcp_tool_call_request_meta`), `core/src/turn_metadata.rs`, § 2. 도구 호출과 `_meta` in the handoff document.
- [inferred] `js` may work without any `_meta`, or `node_repl` may reject calls whose turn metadata is missing (`node_repl is unavailable for this model`) — Confirm by: Stage 1 below, sending `js` with and without `x-codex-turn-metadata`.
- [inferred] The service may require the connecting process to be a Codex/ChatGPT child (parent code requirement files exist in the bundle), which would make the whole bridge impossible — Confirm by: Stage 1 below, observing whether `cua.getState()` returns an inventory or a transport error.

## Desired Outcome (To-Be)
- `docs/handoffs/computer-use/02-feasibility.json` records, for this Mac, whether a plain `@earendil-works/pi-mcp` style stdio client can execute `js` with `await cua.getState()` and receive an inventory, with the exact environment used.
- The record states the observed effect of each probed variable: `.mcp.json` env verbatim, `x-codex-turn-metadata` present vs absent, `SKY_CUA_SERVICE_PATH` pointed at the app-internal copy instead of `~/.codex/computer-use`, `CUA_REPL_ENABLED_SURFACES=computer` only.
- The record captures the first `elicitation/create` request as received (method, `params.message`, `params.requestedSchema`, `params._meta` keys and values) when the user approves running one app-access action, and the runtime's reaction to `accept`, `cancel`, and a 30-second unanswered request.
- The record states whether `Codex Computer Use.app` auto-launched, whether macOS permission prompts appeared, whether `turn_ended` is accepted with `{hook_event_name, session_id, turn_id}`, and whether any error names authentication, plan, or login.
- Successor children (`03-mcp-bridge`, `04-confirmations`) can read the file and start without repeating the probe.

## Scope
### In Scope
- A scratch probe script outside the repository that speaks MCP over stdio to the `.mcp.json` command, sends `initialize`, `tools/list`, `tools/call js`, `turn_ended`, and logs every JSON-RPC message with secrets redacted.
- The probe matrix in `Desired Outcome (To-Be)`, each run started only after the user approves it in chat.
- The handoff JSON with raw observations, redacted logs or excerpts, and a verdict per probed variable.
### Out of Scope
- [hard] No file under `packages/`, no `package.json` or lockfile change, no edits under `~/.codex`, and no copying of `Codex Computer Use.app` anywhere.
- [hard] No reading of `~/.codex/auth.json` or any other credential file; no network requests other than those the runtime itself makes.
- [hard] No UI actions beyond `cua.getState()` and one user-named benign app read (`cua.getApp(<app>)` followed by `getAXState()`); no clicks, typing, browser navigation, downloads or uploads.
- [deferred] Browser backend probing (`chrome`, `iab`, `mcpapps`) belongs to `docs/briefs/2026-10-05-feat-codex-cua-05-browser-use.md`.

## Constraints
- Keep the probe script in `$TMPDIR` or `/tmp`, record its full content inside the handoff JSON (or a sibling `.mjs` text field), and delete the directory when the child finishes.
- Use the `.mcp.json` `command`, `args`, and `env` exactly as discovered (do not hard-code the `26.930.31730` version — resolve the newest `unified-computer-use/*/.mcp.json` with `enabled: true`), and merge the process environment underneath it.
- Redact any value whose key contains `token`, `key`, `secret`, or `account` before writing logs or the handoff; record the key names only.
- Each `tools/call js` run and each `cua.getApp` run requires a fresh explicit user approval in chat because it launches `Codex Computer Use.app` and reads live app or browser inventory.
- Send `tools/call` with no client-side timeout (wait for the response or the user's cancellation) so an unanswered elicitation is observed rather than aborted at 30 seconds by the probe.
- Treat the handoff as evidence only: record what was observed, including failures, without weakening or retrying past the matrix.

## Related Files / Entry Points
- `docs/handoffs/computer-use/01-codex-runtime-bridge.md` — source of truth for runtime structure, env variables, `_meta` keys and the open questions this child answers.
- `docs/handoffs/computer-use/02-feasibility.json` (proposed) — the handoff this child produces.
- `tmp/codex-main/codex-rs/core/src/mcp_tool_call.rs` — `build_mcp_tool_call_request_meta` / `with_mcp_tool_call_ids_meta` define the `_meta` shape to imitate in the "with metadata" run.
- `tmp/codex-main/codex-rs/core/src/session/mcp.rs` — `review_guardian_mcp_elicitation` shows the elicitation `_meta` keys Codex expects (`tool_name`, `connector_id`, `codex_approval_kind`, `codex_sensitive_action`, `codex_requires_user_input`).
- `tmp/codex-main/codex-rs/app-server/tests/suite/v2/mcp_tool.rs` — mock of the `js` execution-approval request emitted when `node_repl_auto_review_required` is true.
- `node_modules/@earendil-works/pi-mcp/dist/client.d.ts` — `McpClient` / `StdioTransport` API the probe may reuse instead of a hand-written JSON-RPC loop.

## Execution Plan
### Stage 1 — Execute `js` from a plain stdio client
- Starts when: The user approves the first live run in chat and `~/.codex/plugins/cache/openai-bundled/unified-computer-use/*/.mcp.json` resolves to an enabled entry whose `command` exists.
- Work: Run the probe matrix for `cua.getState()`: (a) `.mcp.json` env verbatim with `CUA_REPL_ENABLED_SURFACES=browser,computer` and Codex-shaped `_meta`, (b) same without any `_meta`, (c) `CUA_REPL_ENABLED_SURFACES=computer` with `NODE_REPL_TRUSTED_SERVICES` removed, (d) `SKY_CUA_SERVICE_PATH` set to `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/Codex Computer Use.app`; after each run send `turn_ended` and record the response.
- No-op when: `docs/handoffs/computer-use/02-feasibility.json` already exists with `status: "complete"` and a `runtime.appVersion` equal to the installed `ChatGPT.app` `CFBundleShortVersionString`.
- No-op handoff: `docs/briefs/2026-10-05-feat-codex-cua-03-mcp-bridge.md` receives the existing `docs/handoffs/computer-use/02-feasibility.json` unchanged.
- Deliverable: Redacted JSON-RPC transcripts and a per-run verdict (`inventory-received`, `transport-error`, `rejected`, `timeout`) for runs (a)–(d).
- Verify: `Inspect the probe transcript of each run`; Inputs: the four run logs under the scratch directory; Expected: run (a) returns a `tools/call` result whose text content lists at least one app or browser, and every other run has a recorded verdict with the first error message quoted.
- Ends when:
  - [ ] Each of runs (a)–(d) has a verdict and, on failure, the exact first error text.
  - [ ] `turn_ended` responses are recorded for each run.
  - [ ] Whether `Codex Computer Use.app` was launched by the runtime and whether a macOS permission dialog appeared is recorded.
- Handoff: Stage 2 receives the working environment variant (or the conclusion that none works) and the transcripts.
- Replan when: Run (a) fails with a transport, signature, authentication, plan, or login error that runs (b)–(d) do not resolve; stop Stage 2, write the handoff with `status: "blocked"`, and return to the parent, which halts `03-mcp-bridge` and later children until the user decides whether to continue.

### Stage 2 — Observe one real confirmation request
- Starts when: Stage 1 found at least one environment variant that returns an inventory, and the user names a benign app and approves the run in chat.
- Work: With the working variant, execute `js` with `let app = await cua.getApp("<user-named app>"); nodeRepl.write(await app.getAXState());`, answer the first `elicitation/create` with `accept`, then repeat the call and answer the next request with `cancel`, then once more leaving the request unanswered for 60 seconds before answering `cancel`; record each request and the runtime's result text.
- Deliverable: The exact `elicitation/create` payloads (message, `requestedSchema`, `_meta` keys and non-secret values including whether `callId` is echoed), the runtime's reaction to `accept`, `cancel`, and the delayed answer, and the `_meta` of the response the runtime accepted.
- Verify: `Inspect the recorded elicitation payloads`; Inputs: the Stage 2 transcript; Expected: at least one `elicitation/create` with `_meta.codex_approval_kind` recorded, an `accept` run that returns accessibility text, and a `cancel` run whose `js` result text names the denial.
- Ends when:
  - [ ] The request shape and the three response outcomes are recorded.
  - [ ] Whether the `js` call stayed pending through the 60-second delay (no server-side timeout) is recorded.
- Handoff: Stage 3 receives the full observation set.
- Replan when: No `elicitation/create` arrives and the action executes without confirmation; record `elicitation.status: "not-observed"` and flag it for the parent, because `04-confirmations` must then be re-scoped before it starts.

### Stage 3 — Publish the feasibility handoff
- Starts when: Stages 1–2 have their observations (or Stage 1 ended in `blocked`).
- Work: Write `docs/handoffs/computer-use/02-feasibility.json` with `status`, `runtime` (app version, runtime archive, service app version, `.mcp.json` path), `runs` (variant, env key list, verdict, first error), `recommendedEnv` (the variant 03 should adopt, including the `SKY_CUA_SERVICE_PATH` strategy), `metaRequired` (boolean plus evidence), `elicitation` (`status` of `observed` or `not-observed`, `requests` with each payload's `message`, `requestedSchema`, and redacted `_meta`, and `reactions` for accept, cancel, and the delayed answer), `turnEnded`, `permissions`, `unresolved`; then delete the scratch directory.
- Deliverable: `docs/handoffs/computer-use/02-feasibility.json`.
- Verify: `Inspect the handoff file`; Inputs: `docs/handoffs/computer-use/02-feasibility.json`; Expected: valid JSON, `status` is `complete` or `blocked`, no value matches a credential pattern, and `recommendedEnv.keys` lists only key names.
- Ends when:
  - [ ] The handoff answers every item in `Desired Outcome (To-Be)` or marks it `unverified` with the reason.
  - [ ] The scratch directory no longer exists.
- Handoff: `docs/briefs/2026-10-05-feat-codex-cua-03-mcp-bridge.md` and `docs/briefs/2026-10-05-feat-codex-cua-04-confirmations.md` receive `docs/handoffs/computer-use/02-feasibility.json`.
- Replan when: None — this stage only records what Stages 1–2 observed.

## Side Effect Checkpoints
- [ ] Codex Desktop's own Computer Use still works after the probe (open the ChatGPT app and run one Computer Use request, or record that this check was skipped).
- [ ] `~/.codex/config.toml`, `~/.codex/plugins`, and `~/.codex/computer-use` are unchanged (`git`-less check: compare modification times before and after).
- [ ] No probe process (`node`, `node_repl`, `cua-repl.mjs`) remains after the runs (`pgrep -fl cua-repl` returns nothing).
- [ ] The handoff contains no credential values and no user-identifying data beyond the app name the user chose.

## Acceptance Criteria
- [ ] `docs/handoffs/computer-use/02-feasibility.json` exists with `status` `complete` or `blocked` and one verdict per run (a)–(d).
- [ ] The file states whether `js` works without `_meta` and which `SKY_CUA_SERVICE_PATH` strategy worked.
- [ ] The file records at least one real `elicitation/create` payload shape under `elicitation.requests` or explicitly states `elicitation.status: "not-observed"`.
- [ ] The file records the `turn_ended` response and any permission or login prompts observed.
- [ ] The scratch probe directory has been removed and no runtime process is left running.

## Open Questions
- None — the probe matrix and approval gates are fixed by the handoff document; the user approves each live run in chat when it is about to start.
