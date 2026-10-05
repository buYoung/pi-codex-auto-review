# [feat] Bridge the cua_repl server into pi tools with Codex-shaped calls

## Work Type
feat

## Current State (As-Is)
- [confirmed] After `02-package-setup`, the package has `FeatureState` (`computerUse`, `browserUse`) and a `RuntimePlan` (`command`, `args`, `env`) but starts no server and registers no tools — Evidence: `docs/handoffs/computer-use/03-package-setup.json` (predecessor deliverable), `docs/briefs/2026-10-05-feat-codex-cua-02-package-setup.md`.
- [confirmed] `01-feasibility` records whether a plain stdio client can execute `js`, which env variant works, whether `_meta` is required, and how `turn_ended` responds — Evidence: `docs/handoffs/computer-use/02-feasibility.json` (predecessor deliverable).
- [confirmed] pi's built-in MCP support (`mcp.json`, `pi.registerMcpServer()`) cannot host this runtime because pi 0.99.1's MCP runtime neither declares nor handles `elicitation/create`, and auto-review's guarded transport declines any elicitation whose `tool_name`/`connector_id` do not match the outer tool — Evidence: `node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/runtime.js`, `packages/pi-codex-auto-review/src/tools/mcp.ts` (`elicit`), § MCP 연결은 패키지가 직접 소유한다 in `docs/handoffs/computer-use/01-codex-runtime-bridge.md`.
- [confirmed] `@earendil-works/pi-mcp` `McpClient` accepts `capabilities`, `protocolVersion`, `setRequestHandler(method, handler)`, `request(method, params, { timeoutMs, signal })`, `onClose`; `LATEST_PROTOCOL_VERSION` is `2025-11-25`, default request timeout is 30 s, `timeoutMs <= 0` disables it, and `ClientCapabilities` has no `extensions` field — Evidence: `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-mcp/dist/{client.d.ts,client.js,protocol/types.d.ts}`.
- [confirmed] The `cua_repl` launcher reads `CUA_REPL_ENABLED_SURFACES` (`browser`, `computer`, both, or empty), computes `NODE_REPL_TRUSTED_SERVICES` only when that variable is absent, and injects per-surface tool descriptions through `NODE_REPL_TOOL_OVERRIDES`; the tool names never change, only the `js` description — Evidence: `@oai/cua-repl/dist/lib/js/oai_js_cua_repl/src/launch.js`, § 기능별 켜기·끄기 in the handoff document.
- [confirmed] Codex registers the tools as `mcp__cua_repl__js` etc., sends `tools/call` `_meta` with `callId`, `x-codex-turn-metadata` (`session_id`, `thread_id`, `turn_id`, `model`, `node_repl_auto_review_required`, `node_repl_disabled`, `codex_version`, …), `openai/confirmation_policies` (empty object when none), `threadId`, `sessionId`, and conditional `windowId`/`itemId`/`plugin_id` — Evidence: `tmp/codex-main/codex-rs/core/src/mcp_tool_call.rs`, `core/src/turn_metadata.rs`, § 2. 도구 호출과 `_meta` in the handoff document.
- [confirmed] Codex plugins call `turn_ended` with `{hook_event_name, session_id, turn_id}` on `Stop`, `Interrupt`, and `SubagentStop`; Codex core emits Stop when no follow-up turn runs and Interrupt on `TurnAbortReason::Interrupted` — Evidence: `~/.codex/plugins/cache/openai-bundled/unified-computer-use/26.930.31730/.codex-plugin/plugin.json`, `tmp/codex-main/codex-rs/core/src/session/turn.rs`, `core/src/tasks/mod.rs`.
- [confirmed] pi exposes `agent_start`, `agent_before_settle` (`BoundaryState.outcome`: `completed` | `aborted` | `error`), `agent_settled` (final, notification-only), `session_start`, `session_shutdown`, `ctx.sessionManager.getSessionId()`, `pi.registerTool()` with `namespace`, `annotations`, `executionMode: "sequential"`, and re-registration with `exposure: "hidden"` to withdraw a tool; `AgentEndEvent` carries only `messages` — Evidence: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`, `docs/extensions.md`.
- [confirmed] The `.mcp.json` sets `output_token_limit: 25000` for `js` and `startup_timeout_sec: 120`; pi's built-in MCP truncates text at 20 KB — Evidence: the `.mcp.json`, `node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js`.
- [inferred] `node_repl` may emit a `js` execution-approval elicitation when `x-codex-turn-metadata.node_repl_auto_review_required` is true, and may reject calls when `model` names a model it considers unsupported — Confirm by: `docs/handoffs/computer-use/02-feasibility.json` `metaRequired`, and Stage 2 below with `node_repl_auto_review_required: false`.

## Desired Outcome (To-Be)
- When at least one feature is on, `session_start` starts one `cua_repl` process from the `RuntimePlan` with `CUA_REPL_ENABLED_SURFACES` derived from `FeatureState` and `NODE_REPL_TRUSTED_SERVICES` filtered to the enabled services (`browser` → `@oai/browser-desktop/service`, `computer` → `sky`), using the env strategy recommended by `02-feasibility.json`.
- `initialize` uses protocol `2025-06-18` and declares `capabilities.elicitation.form`; the client's `tools/list` result registers `mcp__cua_repl__js` and `mcp__cua_repl__js_reset` in pi with the server's description, annotations, input schema, and server `instructions` as the namespace description; `turn_ended` and `js_add_node_module_dir` are never exposed to the model.
- Every `tools/call` carries Codex-shaped `_meta`: `callId` = pi `toolCallId`, `sessionId` and `threadId` = pi session id, `x-codex-turn-metadata` with `session_id`, `thread_id`, `turn_id` (new id per `agent_start`), `model` (pi's current model id), `node_repl_auto_review_required: false`, `node_repl_disabled: false`, and `openai/confirmation_policies: {}`; requests use `timeoutMs: 0` and the pi `signal` for cancellation.
- Results map text blocks to `TextContent` and image blocks to `ImageContent`; text beyond the configured limit is truncated with a marker that names the saved full-text path, mirroring the `output_token_limit: 25000` intent.
- `turn_ended` is sent once per agent run from `agent_settled` with `hook_event_name` `Stop` (outcome `completed`) or `Interrupt` (outcome `aborted`), and the chosen handling for `error`.
- Changing settings while a session runs waits for idle, stops the server, restarts with the new surfaces, re-registers tools with the new descriptions, or re-registers them `hidden` when both features are off; `session_shutdown` closes the client and the process group.
- `docs/handoffs/computer-use/04-mcp-bridge.json` documents the server identity, tool names, `_meta` keys, env policy per setting, turn lifecycle observations, and restart behavior for `04-confirmations` and `05-browser-use`.

## Scope
### In Scope
- `src/connection.ts` (client lifecycle, env composition, logging), `src/tools.ts` (registration, `_meta`, result conversion), `src/turn.ts` (turn ids, `turn_ended`), and the `index.ts` event wiring for `session_start`, `agent_start`, `agent_before_settle`, `agent_settled`, `session_shutdown`, and settings-change restart.
- A debug log of JSON-RPC traffic with redaction at `<agentDir>/codex-computer-use/mcp.log` (rotating like pi's `mcp.log`), used by every later child's verification.
- The handoff JSON.
### Out of Scope
- [hard] Handling `elicitation/create` beyond a placeholder that answers `cancel` and logs the request — `04-confirmations` owns the real handler.
- [hard] Browser backend selection (`BROWSER_USE_AVAILABLE_BACKENDS`, `CUA_REPL_BROWSER_ENV`) — `05-browser-use`; keep the `.mcp.json` values verbatim here.
- [hard] Supporting the legacy `node_repl` + `@oai/sky` path (Codex's `computer-use` skill plugin); only the unified `cua_repl` server is bridged.
- [hard] Copying `Codex Computer Use.app` or writing under `CODEX_HOME`.
- [hard] Importing or depending on `packages/pi-codex-auto-review`; this package stays an independent extension.
- [hard] New automated test files; verification uses live pi sessions and the debug log.
- [deferred] Windows live verification of the connection lifecycle (process-tree termination, env composition with Windows paths); implement platform-neutrally and record the gap.
- [deferred] Codex's Guardian evidence retention (8 MB screenshot buffer) and grouped TUI rendering of consecutive calls.

## Constraints
- One server process per session; never start a second `cua_repl` while one is running, and terminate the whole process tree on close so `node_repl` children do not linger (POSIX process group on macOS, `taskkill /T` or an equivalent tree kill on Windows); use `RuntimePlan` paths verbatim with no POSIX-only path handling.
- Pass `RuntimePlan.env` merged over `process.env` and override only `CUA_REPL_ENABLED_SURFACES` and `NODE_REPL_TRUSTED_SERVICES`; if the existing `NODE_REPL_TRUSTED_SERVICES` cannot be parsed as a JSON object, omit it so the launcher recomputes it.
- Follow `02-feasibility.json` `recommendedEnv` for `SKY_CUA_SERVICE_PATH`; if it says the app-internal copy works, prefer `$CODEX_HOME/computer-use` when present and fall back to the app-internal copy, never copying files.
- Tool `description`, `inputSchema`, `annotations`, and server `instructions` are passed through verbatim from `tools/list`; do not author descriptions.
- `tools/call` requests use `timeoutMs: 0`; cancellation comes only from pi's `signal`, and a cancelled call sends MCP `notifications/cancelled` through the client.
- Register `js` and `js_reset` with `executionMode: "sequential"` because the REPL state is shared.
- Preserve pi's tool-naming convention `mcp__<server>__<tool>` and `namespace.name` `mcp__cua_repl` so pi's `tool_call` hooks and permission extensions identify them like MCP tools.
- Do not start the server in the extension factory; start on `session_start` (or on the settings command) and tolerate `session_start` being fired again for mode rebinds by closing the previous client first.
- Redact values whose key contains `token`, `key`, `secret`, or `account` in the debug log.

## Related Files / Entry Points
- `docs/handoffs/computer-use/02-feasibility.json` (proposed) — consumed: working env variant, `metaRequired`, `turnEnded`, `recommendedEnv`.
- `docs/handoffs/computer-use/03-package-setup.json` (proposed) — consumed: `RuntimePlan`, `FeatureState`, module exports.
- `packages/pi-codex-computer-use/src/index.ts` (proposed) — add session/agent event wiring and settings-change restart.
- `packages/pi-codex-computer-use/src/runtime.ts` (proposed) — add surface/service env composition on top of discovery.
- `packages/pi-codex-computer-use/src/connection.ts` (proposed) — `McpClient` + `StdioTransport` lifecycle.
- `packages/pi-codex-computer-use/src/tools.ts` (proposed) — tool registration, `_meta`, result conversion.
- `packages/pi-codex-computer-use/src/turn.ts` (proposed) — turn ids and `turn_ended`.
- `packages/pi-codex-auto-review/src/tools/mcp.ts` — read-only pattern reference for `_meta.callId` injection and session rebind handling (`hasStarted` guard); do not import or reuse its code.
- `node_modules/@earendil-works/pi-mcp/dist/client.d.ts` — `McpClient` API.
- `node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js` — reference for converting `CallToolResult` blocks to pi content and the truncation marker format.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` — `ToolDefinition`, `BoundaryState.outcome`, `agent_settled`.
- `tmp/codex-main/codex-rs/core/src/mcp_tool_call.rs` — `build_mcp_tool_call_request_meta`, `with_mcp_tool_call_ids_meta`, `build_confirmation_policies_request_meta`.
- `tmp/codex-main/codex-rs/core/src/turn_metadata.rs` — `current_meta_value_for_mcp_request` key list.
- `docs/handoffs/computer-use/04-mcp-bridge.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Connection lifecycle gated by feature state
- Starts when: `docs/handoffs/computer-use/02-feasibility.json` has `status: "complete"` with a `recommendedEnv`, and `docs/handoffs/computer-use/03-package-setup.json` describes `RuntimePlan` and `FeatureState`.
- Work: Implement `connection.ts`: compose env from `FeatureState` (surfaces, trusted services, service path strategy), start `StdioTransport` + `McpClient` on `session_start` when any feature is on, `initialize` with `2025-06-18` and `elicitation.form`, register a placeholder `elicitation/create` handler that logs and answers `cancel`, log traffic redacted, close on `session_shutdown`, and skip startup when both features are off.
- No-op when: The package already starts `cua_repl` from `session_start` with the four-combination env policy and `mcp.log` shows a successful `initialize` for the current `FeatureState`.
- No-op handoff: `docs/briefs/2026-10-05-feat-codex-cua-04-confirmations.md` and `docs/briefs/2026-10-05-feat-codex-cua-05-browser-use.md` receive the existing `docs/handoffs/computer-use/04-mcp-bridge.json`.
- Deliverable: A connected client whose effective `CUA_REPL_ENABLED_SURFACES` and `NODE_REPL_TRUSTED_SERVICES` are written to `mcp.log` at startup.
- Verify: `Inspect mcp.log after starting pi under each setting`; Inputs: four sessions of `pi -e packages/pi-codex-computer-use/dist/index.js` with settings both-on, computer-only, browser-only, both-off; Expected: three sessions log `initialize` success with surfaces `browser,computer`, `computer`, `browser` and trusted-service keys `browser,sky`, `sky`, `browser` respectively, and the both-off session logs `server not started` with no `cua-repl` process in `pgrep -fl cua-repl`.
- Ends when:
  - [ ] Startup, close, and both-off paths behave as expected in the four sessions.
  - [ ] Closing the session leaves no `node_repl` or `cua-repl.mjs` process.
- Handoff: Stage 2 receives the connected client and env policy.
- Replan when: `initialize` fails with the recommended env or the server exits within `startup_timeout_sec`; capture stderr, compare with `02-feasibility.json`, and return the discrepancy to the parent before continuing.
- Worker decision: Client `clientInfo.name`/`title` (own package name vs Codex's `codex-mcp-client`/`Codex`); switch to the Codex identity only if the server behaves differently.

### Stage 2 — Tool registration and Codex-shaped calls
- Starts when: Stage 1 connects under every setting.
- Work: Implement `tools.ts`: register `js` and `js_reset` from `tools/list` (`mcp__cua_repl__*`, namespace description from server `instructions`, annotations verbatim, `executionMode: "sequential"`), build `_meta` per call (`callId`, `sessionId`, `threadId`, `x-codex-turn-metadata`, `openai/confirmation_policies: {}`), forward `timeout_ms`/`title` arguments untouched, send with `timeoutMs: 0` and `signal`, convert results (text/image, truncation with saved-file marker), and surface `isError` as a pi tool error; implement `turn.ts` turn-id generation on `agent_start`.
- Deliverable: Model-callable `mcp__cua_repl__js` and `mcp__cua_repl__js_reset` with Codex-shaped `_meta`.
- Verify: `Run a live pi session with computer on and ask the model to call await cua.getState()`; Inputs: prompt "Use mcp__cua_repl__js to run `await cua.getState()` and summarize"; Expected: the tool result lists apps or browsers, `mcp.log` shows `tools/call` with `_meta.callId` equal to the pi tool call id and `x-codex-turn-metadata.turn_id` present, and pressing Esc during a long call logs `notifications/cancelled`.
- Ends when:
  - [ ] The `js` description shown in pi matches the server's description for the active surfaces (grep `Browser APIs are disabled.` or `Native computer APIs are disabled.` accordingly).
  - [ ] A text result longer than the limit is truncated with a marker and the full text is saved to a temp file named in the marker.
  - [ ] An image block returned by `nodeRepl.emitImage` reaches the model as `ImageContent`.
- Handoff: Stage 3 receives registered tools and the turn-id source.
- Replan when: `node_repl` rejects calls because of `model` or `node_repl_auto_review_required` values; adjust the metadata per `02-feasibility.json`, record the accepted shape, and inform `04-confirmations` if a `js` execution-approval elicitation appears.
- Worker decision: Exact truncation threshold (characters approximating 25,000 tokens) and the temp-file location for full text.

### Stage 3 — Turn lifecycle and settings-change restart
- Starts when: Stage 2 tools work in a live session.
- Work: Send `turn_ended` from `agent_settled` using the outcome recorded at `agent_before_settle` (`completed` → `Stop`, `aborted` → `Interrupt`, `error` → chosen mapping), once per agent run and only when the server is running; implement restart on settings change (`waitForIdle` → close → start with new surfaces → re-register tools with new descriptions, or re-register `exposure: "hidden"` when both features turn off); make `session_start` rebinds close the previous client first.
- Deliverable: Observable turn-end notifications and a restart path that leaves exactly one server process.
- Verify: `Inspect mcp.log and process list across a run, an interrupted run, and a settings change`; Inputs: one completed `getState` run, one run interrupted with Esc, then `/codex-computer-use browser off` followed by another `getState` run; Expected: exactly one `turn_ended` per run with `Stop` then `Interrupt`, the settings change logs close + new `initialize` with surfaces `computer`, the `js` description now contains `Browser APIs are disabled.`, and `pgrep -fl cua-repl` shows one process.
- Ends when:
  - [ ] Turning both features off hides `mcp__cua_repl__js` from `pi.getActiveTools()` and stops the process.
  - [ ] The "ChatGPT is using your computer" overlay disappears after `turn_ended` (or the handoff records that it did not).
- Handoff: Stage 4 receives the lifecycle observations.
- Replan when: `agent_settled` is not delivered in a mode the package must support or `BoundaryState.outcome` is unavailable; fall back to `agent_end` with `Stop` and record the limitation.
- Worker decision: `error` outcome mapping (default `Stop`) and whether `SubagentStop` is ever emitted from pi (default: not emitted).

### Stage 4 — Publish the bridge handoff
- Starts when: Stage 3 observations are recorded.
- Work: Write `docs/handoffs/computer-use/04-mcp-bridge.json` with `status`, `serverInfo`, `toolNames`, `elicitationHook` (how `04-confirmations` installs its handler), `envPolicy` keyed `bothOn`, `computerOnly`, `browserOnly`, `bothOff` (each with `CUA_REPL_ENABLED_SURFACES`, trusted-service keys, and server started or not), `metaKeys` and sample values (redacted), `turnLifecycle` (events, outcomes, overlay observation), `restart`, `log` path, `unresolved`.
- Deliverable: `docs/handoffs/computer-use/04-mcp-bridge.json`.
- Verify: `Inspect the handoff file`; Inputs: `docs/handoffs/computer-use/04-mcp-bridge.json`; Expected: valid JSON with `status: "complete"`, `toolNames` equal to `["mcp__cua_repl__js", "mcp__cua_repl__js_reset"]`, `envPolicy.browserOnly.CUA_REPL_ENABLED_SURFACES` equal to `browser`, and no credential-like values.
- Ends when:
  - [ ] Every `Desired Outcome (To-Be)` item is marked verified or `unverified` with reason.
- Handoff: `docs/briefs/2026-10-05-feat-codex-cua-04-confirmations.md` and `docs/briefs/2026-10-05-feat-codex-cua-05-browser-use.md` receive `docs/handoffs/computer-use/04-mcp-bridge.json`.
- Replan when: None — this stage records Stage 1–3 results.

## Side Effect Checkpoints
- [ ] `npm run build` and `npm run check` still exit 0.
- [ ] `/codex-computer-use` from `02-package-setup` still reports prerequisites and toggles settings; toggling now also restarts the server.
- [ ] pi's built-in MCP extension and `mcp.json` servers are unaffected (a session with an unrelated `mcp.json` server still connects it).
- [ ] Codex Desktop's own Computer Use still works after pi sessions (one Codex request succeeds, or the check is recorded as skipped).
- [ ] No server process survives `session_shutdown`, `/reload`, or a settings-change restart.
- [ ] `mcp.log` contains no credential values.

## Acceptance Criteria
- [ ] In a live pi TUI session with Computer Use on, the model's `mcp__cua_repl__js` call `await cua.getState()` returns an inventory, and `mcp.log` shows `_meta.callId`, `sessionId`, `threadId`, and `x-codex-turn-metadata.turn_id` on the request.
- [ ] The four setting combinations produce the expected server state: three start with surfaces `browser,computer` / `computer` / `browser` and matching trusted services, both-off starts nothing and hides the tools.
- [ ] `turn_ended` is logged exactly once per agent run with `Stop` after completion and `Interrupt` after Esc.
- [ ] A settings change mid-session restarts the server and the `js` description reflects the new surfaces without a new pi session.
- [ ] `docs/handoffs/computer-use/04-mcp-bridge.json` exists with `status: "complete"`.

## Open Questions
- None — the user chose the recommended unified `cua_repl` runtime, so the legacy `node_repl` + `@oai/sky` path stays excluded; remaining unknowns are technical and routed to `Replan when` boundaries.
