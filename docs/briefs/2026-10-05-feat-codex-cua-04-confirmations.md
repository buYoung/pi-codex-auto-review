# [feat] Answer runtime confirmation requests the way Codex does

## Work Type
feat

## Current State (As-Is)
- [confirmed] After `03-mcp-bridge`, the package connects `cua_repl`, registers `js`/`js_reset`, and answers every `elicitation/create` with `cancel` while logging it — Evidence: `docs/handoffs/computer-use/04-mcp-bridge.json` (predecessor deliverable), `docs/briefs/2026-10-05-feat-codex-cua-03-mcp-bridge.md` Stage 1.
- [confirmed] `01-feasibility` recorded at least one real `elicitation/create` payload (or `elicitation.status: "not-observed"`) and the runtime's reaction to `accept`, `cancel`, and a delayed answer — Evidence: `docs/handoffs/computer-use/02-feasibility.json` `elicitation`.
- [confirmed] Runtime JS calls `nodeRepl.createElicitation()`; the `sky` policy module requests app access with `_meta` `{codex_approval_kind: "mcp_tool_call", connector_id: "computer-use", connector_name: "Computer Use", persist: ["session"] or ["session","always"], riskLevel, tool_name, tool_params: {app}, tool_params_display: [...]}` and audio recording with `codex_request_type: "approval_request"`, `riskLevel: "high"` — Evidence: `@oai/sky/dist/project/cua/sky_js/src/targets/mac/computer-use-policy.js`.
- [confirmed] The browser service requests history access (`sensitive_data: browsing_history`), origin access (`codex_sensitive_action: true`, optional `codex_request_type: approval_request`), downloads/uploads (`file_transfer`, `origin`, `persist`), page assets (`tool_params.asset_origins`), raw CDP (`riskLevel: high`, `full_cdp_access: true`), WebMCP calls and automated safety prechecks (`codex_strict_auto_review: true`, `codex_sensitive_action: true`), email OTP (`codex_approval_kind: browser_email_otp`, `codex_requires_user_input: true`, schema with `approved` boolean), and browser auth (`codex_approval_kind: browser_auth`, `codex_requires_user_input: true`) — Evidence: `@oai/browser-desktop/scripts/browser-service.mjs`, § 4. 확인 요청 처리 in `docs/handoffs/computer-use/01-codex-runtime-bridge.md`.
- [confirmed] Codex TUI shows `Allow`, `Allow for this session` (when `persist` includes `session`), `Always allow` (when it includes `always`), then `Cancel` only for `codex_approval_kind: mcp_tool_call` requests and `Deny` + `Cancel` for other message-only requests; responses are `{action:"accept"}`, `{action:"accept", _meta:{persist:"session"}}`, `{action:"accept", _meta:{persist:"always"}}`, `{action:"decline"}`, `{action:"cancel"}`; forms with fields return `content` with the field values — Evidence: `tmp/codex-main/codex-rs/tui/src/bottom_pane/mcp_server_elicitation.rs` (option construction and `submit_answers`).
- [confirmed] Codex core auto-approves, without asking, a form elicitation with an empty schema when the approvals reviewer is the user, the server is `node_repl`/`cua_repl`, and `_meta` has `tool_name: "js"`, `connector_id: "node_repl"`, `codex_approval_kind: "mcp_tool_call"`, no `codex_sensitive_action: true`, and no `codex_requires_user_input: true`; the response is `{action:"accept", content:{}, _meta:{approvals_reviewer:"auto_review"}}`, and a cancelled turn answers `cancel` — Evidence: `review_guardian_mcp_elicitation` in `tmp/codex-main/codex-rs/core/src/session/mcp.rs`, `mcp_elicitation_response_from_guardian_decision`.
- [confirmed] Strict requests (`codex_strict_auto_review: true`) fall back to the ordinary user flow when Guardian approval is unavailable; the browser service's automated safety precheck passes only when the response `_meta.approvals_reviewer` is an automatic reviewer, so without auto-review that feature fails by design — Evidence: `core/src/session/mcp.rs` strict branch, `browser-service.mjs` precheck handling, § 4 in the handoff document.
- [confirmed] pi's `ExtensionUIContext` offers `select(title, options, {signal, timeout})`, `confirm`, `input`, `notify`; `ctx.hasUI` is false in JSON/print modes — Evidence: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.
- [inferred] `sky` surrounds the post-approval action, not the confirmation wait, with `withSuspendedTimeout`, so a slow user answer may exhaust the `js` `timeout_ms` unless the runtime pauses it elsewhere — Confirm by: `02-feasibility.json` `elicitation.delayedAnswer` and Stage 2 below with a 60-second delay.

## Desired Outcome (To-Be)
- The `elicitation/create` handler classifies each request and, when `ctx.hasUI`, presents Codex's option set through `ctx.ui.select`: message-only `mcp_tool_call` requests get Allow / Allow for this session / Always allow (per `persist`) / Cancel; other message-only requests get the same allow options plus Deny and Cancel; the dialog shows `message`, `subtitle`, `riskLevel`, `connector_name`, and `tool_params_display` rows.
- Responses match Codex byte-for-byte in shape: `accept` with optional `_meta.persist` of `session` or `always`, `decline`, `cancel`; dismissing the dialog or an aborted turn yields `cancel`.
- Requests whose `requestedSchema` has fields are answered field by field (`boolean` → `ctx.ui.confirm`, `string`/`number` → `ctx.ui.input` with validation, `enum` → `ctx.ui.select`), returning `content` with `accept`; unsupported field types, `mode: "url"`, `browser_auth`, and `browser_email_otp` requests are declined with a logged reason because pi has no QR/screenshot/OTP surface.
- The Codex user-reviewer auto-approval rule for `js` / `node_repl` empty-schema requests is reproduced, answering `{action:"accept", content:{}, _meta:{approvals_reviewer:"auto_review"}}` without prompting; `codex_strict_auto_review` requests are shown to the user like Codex does when Guardian is unavailable.
- Without UI (`!ctx.hasUI`), every request that would need a dialog is declined with `_meta.message` explaining that no interactive approval surface exists, and the tool result tells the model the same.
- `docs/handoffs/computer-use/05-confirmations.json` documents each request kind seen, the options shown, the responses sent, and the runtime's reaction, for `05-browser-use` and `06-publish-prep`.

## Scope
### In Scope
- `src/elicitation.ts` (classification, option building, response building, no-UI policy, auto-approval rule) and the `connection.ts` hook that routes `elicitation/create` to it with the active `ExtensionContext` and the owning tool call's `signal`.
- Dialog rendering through `ctx.ui.select`/`confirm`/`input` only; no custom TUI components.
- Live verification of the app-access flow (allow once, allow for session, always allow, cancel, delayed answer) and the handoff JSON.
### Out of Scope
- [hard] Routing requests to an automatic reviewer (Codex's Guardian path or any other package); this package implements user approval only and does not integrate with `pi-codex-auto-review`.
- [hard] Browser-origin, download, upload, CDP, and WebMCP flows end to end — `05-browser-use` exercises them with this handler; this child only classifies them correctly.
- [hard] Implementing QR, screenshot, or OTP input surfaces; these requests are declined.
- [hard] Modifying `packages/pi-codex-auto-review`.
- [hard] New automated test files; verification uses live sessions and `mcp.log`.
- [deferred] Persisting "Always allow" decisions on the pi side; the runtime owns persistence through `_meta.persist`.

## Constraints
- Option labels are exactly `Allow`, `Allow for this session`, `Always allow`, `Deny`, `Cancel`, in that order, with Codex's descriptions ("Run the tool and continue" wording for tool approvals, "Allow this request and continue" otherwise).
- Show `Always allow` only when `_meta.persist` includes `always`, `Allow for this session` only when it includes `session` (string or array forms both occur).
- Never answer `decline` to a `codex_approval_kind: mcp_tool_call` request from the dialog path; Codex offers only Cancel there, and the browser service treats `decline` as an explicit denial.
- Keep the handler non-blocking for the MCP client: the `js` request stays pending while the dialog is open (requests already use `timeoutMs: 0`), and the dialog receives the tool call's `signal` so Esc cancels both.
- Apply the auto-approval rule only when the request arrives on this package's `cua_repl` connection and all Codex conditions hold; log every auto-approval with the request `_meta`.
- Do not read or persist any value from `tool_params` beyond displaying it; redact credential-like keys in the log.
- `_meta.message` on declines must be a plain sentence the runtime can show the model; never include stack traces or file paths.

## Related Files / Entry Points
- `docs/handoffs/computer-use/04-mcp-bridge.json` (proposed) — consumed: connection hook, log path, tool names.
- `docs/handoffs/computer-use/02-feasibility.json` (proposed) — consumed: real `elicitation/create` payload and reactions.
- `packages/pi-codex-computer-use/src/elicitation.ts` (proposed) — this child's main module.
- `packages/pi-codex-computer-use/src/connection.ts` (proposed) — replace the placeholder handler with `elicitation.ts`.
- `packages/pi-codex-computer-use/src/tools.ts` (proposed) — expose the active tool call context (`ctx`, `signal`) to the handler.
- `tmp/codex-main/codex-rs/tui/src/bottom_pane/mcp_server_elicitation.rs` — option construction and response mapping to replicate.
- `tmp/codex-main/codex-rs/core/src/session/mcp.rs` — `review_guardian_mcp_elicitation` auto-approval condition and response `_meta`.
- `tmp/codex-main/codex-rs/protocol/src/mcp_approval_meta.rs` — canonical `_meta` key names.
- `packages/pi-codex-auto-review/src/tools/mcp.ts` — read-only pattern reference for detecting empty approval forms (`isApprovalForm`) and URL-mode requests; do not import it.
- `docs/handoffs/computer-use/05-confirmations.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Classify requests and build Codex-shaped responses
- Starts when: `docs/handoffs/computer-use/04-mcp-bridge.json` has `status: "complete"` and names the connection hook, and `docs/handoffs/computer-use/02-feasibility.json` provides at least one real request payload.
- Work: Implement `elicitation.ts` pure functions: `classify(params)` → `{kind: "tool-approval" | "message-only" | "form" | "url" | "browser-auth" | "otp" | "auto-approve", persistModes, display}`, `buildOptions(classification)`, `buildResponse(choice | fieldValues | reason)`; wire the connection hook to call them.
- No-op when: The connection already routes `elicitation/create` to a handler that produces the Codex option set and response shapes above (verified by `mcp.log` entries from a previous run).
- No-op handoff: `docs/briefs/2026-10-05-feat-codex-cua-05-browser-use.md` receives the existing `docs/handoffs/computer-use/05-confirmations.json`.
- Deliverable: Deterministic classification and response construction for every request kind listed in `Current State (As-Is)`.
- Verify: `Inspect classification against the recorded payloads`; Inputs: the payloads in `02-feasibility.json` and the `_meta` samples quoted in `docs/handoffs/computer-use/01-codex-runtime-bridge.md` § 4 fed through `node -e` to `dist/elicitation.js`; Expected: the app-access payload yields options `Allow`, `Allow for this session`, `Cancel` (plus `Always allow` when `persist` includes `always`), an origin-access payload with `codex_sensitive_action` yields the same tool-approval set, a `browser_auth` payload yields `decline`, and an empty-schema `js`/`node_repl` payload yields `auto-approve`.
- Ends when:
  - [ ] Each kind maps to exactly one option set or automatic response.
  - [ ] Response objects match the Codex shapes including `_meta.persist` values.
- Handoff: Stage 2 receives the handler wired into the connection.
- Replan when: `02-feasibility.json` shows the runtime sends a request shape not covered here (for example `callId` echo semantics or a new `codex_approval_kind`); extend the classification and record the new kind before continuing.

### Stage 2 — Dialogs, no-UI policy, and live verification
- Starts when: Stage 1 handler is wired.
- Work: Render dialogs with `ctx.ui.select` (title from `connector_name`, body from `message`, `subtitle`, `riskLevel`, `tool_params_display`), handle forms with `confirm`/`input`/`select`, implement the no-UI decline, pass the tool call `signal`, and verify the app-access flow live with a user-named benign app.
- Deliverable: Interactive approval matching Codex in a live pi TUI session, and defined behavior in `pi --mode json`.
- Verify: `Run the app-access flow in a live pi session`; Inputs: with Computer Use on, prompt the model to run `let app = await cua.getApp("<user-named app>"); nodeRepl.write(await app.getAXState());` five times choosing Allow, Allow for this session (then observe no prompt on the next call), Cancel, waiting 60 seconds before Allow, and pressing Esc during the dialog; Expected: `mcp.log` shows `accept`, `accept` with `_meta.persist: "session"`, no new request after the session grant, `cancel` with a `js` result that names the denial, `accept` after the delay with a successful result, and `cancel` plus `notifications/cancelled` on Esc.
- Ends when:
  - [ ] All five outcomes are observed and logged.
  - [ ] In `pi --mode json -p` the same prompt yields a declined request with `_meta.message` and a tool result explaining the missing approval surface.
- Handoff: Stage 3 receives the observations.
- Replan when: The `js` call fails with a timeout during the 60-second wait; record the runtime's timeout behavior and decide with the parent whether the package must pre-extend `timeout_ms` or document the limit.
- Worker decision: Dialog text layout within `ctx.ui.select`'s title/options constraints, and whether `riskLevel: high` adds a warning prefix.

### Stage 3 — Publish the confirmations handoff
- Starts when: Stage 2 observations exist.
- Work: Write `docs/handoffs/computer-use/05-confirmations.json` with `status`, `kinds` (classification table), `options`, `responses`, `autoApproval` (rule and observed count), `noUi`, `observations` (per-outcome results, delayed answer), `declinedKinds`, `unresolved`.
- Deliverable: `docs/handoffs/computer-use/05-confirmations.json`.
- Verify: `Inspect the handoff file`; Inputs: `docs/handoffs/computer-use/05-confirmations.json`; Expected: valid JSON with `status: "complete"`, every kind in `Current State (As-Is)` present in `kinds`, and no credential-like values.
- Ends when:
  - [ ] `05-browser-use` can read which browser request kinds are classified but not yet exercised.
- Handoff: `docs/briefs/2026-10-05-feat-codex-cua-05-browser-use.md` receives `docs/handoffs/computer-use/05-confirmations.json`.
- Replan when: None — this stage records Stage 1–2 results.

## Side Effect Checkpoints
- [ ] `mcp__cua_repl__js` calls that trigger no confirmation still behave as in `03-mcp-bridge` (getState run unchanged).
- [ ] Esc during a dialog cancels the pi tool call, the dialog, and the MCP request without leaving the server in a pending state (next call works).
- [ ] `turn_ended` is still sent exactly once after a run that included dialogs.
- [ ] `npm run build` and `npm run check` exit 0.
- [ ] Codex Desktop's own confirmations still work after the session (one Codex Computer Use request prompts normally, or the check is recorded as skipped).

## Acceptance Criteria
- [ ] An app-access request shows exactly the Codex option labels, and each choice sends the matching response shape (`accept`, `accept` + `persist: session`, `accept` + `persist: always` when offered, `cancel`).
- [ ] "Allow for this session" suppresses the next request for the same app within the session, as observed in `mcp.log`.
- [ ] The `js`/`node_repl` empty-schema rule auto-approves with `_meta.approvals_reviewer: "auto_review"` and is logged.
- [ ] `browser_auth`, OTP, URL-mode, and unsupported-form requests are declined with a message and never hang the call.
- [ ] Without UI, requests are declined with `_meta.message` and the model receives an explanatory tool error.
- [ ] `docs/handoffs/computer-use/05-confirmations.json` exists with `status: "complete"`.

## Open Questions
- None — option labels, response shapes, and the auto-approval rule are fixed by Codex; automatic-reviewer routing is out of scope for this package.
