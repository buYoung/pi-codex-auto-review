# [feat] Verify the Chrome backend and fix the Browser Use environment policy

## Work Type
feat

## Current State (As-Is)
- [confirmed] After `03-mcp-bridge` and `04-confirmations`, the package starts `cua_repl` with `CUA_REPL_ENABLED_SURFACES=browser` when Browser Use is on, passes `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab,mcpapps` verbatim from `.mcp.json`, and classifies browser confirmation requests without having exercised them — Evidence: `docs/handoffs/computer-use/04-mcp-bridge.json` and `docs/handoffs/computer-use/05-confirmations.json` (predecessor deliverables).
- [confirmed] The browser-surface `js` description instructs the model to use `cua.createBrowserTab("iab", url, { visible })`, `"chrome"` / `"edge"` with a `sessionName`, `cua.getBrowser({ id: "mcpapps" })`, and `plugin://` tab mentions, regardless of which backends actually work — Evidence: `@oai/cua-repl/instructions/macos/browser.md`, § 직접 확인한 `cua_repl` MCP 계약 in `docs/handoffs/computer-use/01-codex-runtime-bridge.md`.
- [confirmed] `launch.js` reads `CUA_REPL_BROWSER_ENV` (`codex-app` default, `training`, `cloud`, `orbit`) and `CUA_REPL_BROWSER_GUIDANCE` to choose the browser instruction variant; `cloud`/`orbit` switch to CDP-oriented instructions — Evidence: `@oai/cua-repl/dist/lib/js/oai_js_cua_repl/src/launch.js`, `instructions.js`, `@oai/cua-repl/README.md`.
- [confirmed] The Chrome backend depends on Google Chrome, the ChatGPT Chrome extension (ids `hehggadaopoacecdllhhajmbjkdcmajg`, `odlomjlbamekndcpllcnffbgeohgkmjh`), and the native-messaging manifest `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json` pointing at `~/.codex/plugins/cache/openai-bundled/chrome/latest/extension-host/macos/arm64/ChatGPT for Chrome`; `~/.codex/chrome-native-hosts-v2.json` records a `presence.pid` — Evidence: those files, § 설치 step 6 in the handoff document.
- [confirmed] `browser-service.mjs` reads `BROWSER_USE_AVAILABLE_BACKENDS`, `BROWSER_USE_SECURITY_MODE`, `BROWSER_USE_FULL_CDP_ACCESS_ENABLED`, `BROWSER_USE_DISABLE_TAB_CAPABILITIES`, `BROWSER_USE_DISABLE_BROWSER_CAPABILITIES`, `BROWSER_USE_DISABLE_API_MEMBERS`, `BROWSER_USE_AUTOMATIC_OTP_ENABLED`, `BROWSER_USE_AUTOMATED_SAFETY_PRECHECKS_ENABLED`, `BROWSER_USE_CONFIG_PATH`, `CODEX_CHROMIUM_*` — Evidence: variable scan of `~/.codex/plugins/cache/openai-bundled/browser/26.930.31730/scripts/browser-service.mjs`.
- [confirmed] Origin access requests carry `codex_sensitive_action: true`; downloads/uploads, page assets, raw CDP, WebMCP, OTP, and browser-auth requests have distinct `_meta` shapes already classified by `04-confirmations` — Evidence: § 4 in the handoff document, `05-confirmations.json` `kinds`.
- [inferred] `iab` (in-app browser) and `mcpapps` need the ChatGPT desktop app process and will fail from pi — Confirm by: Stage 2 below, calling `cua.createBrowserTab("iab", ...)` and `cua.getBrowser({ id: "mcpapps" })` and recording the error text.
- [inferred] The Chrome native host may require the ChatGPT desktop app to be running (`presence.pid` in `chrome-native-hosts-v2.json`) — Confirm by: Stage 1 below with the ChatGPT app quit and then running.
- [inferred] Automated safety prechecks (`BROWSER_USE_AUTOMATED_SAFETY_PRECHECKS_ENABLED`) fail without an automatic reviewer, so some navigations may be blocked by design in the user-approval-only configuration — Confirm by: Stage 1 observing any `automated_safety_precheck.*` request and its result.

## Desired Outcome (To-Be)
- With Browser Use on and Chrome prerequisites satisfied, the model can open a tab in Chrome through `cua.createBrowserTab("chrome", url, { sessionName })`, answer the origin-access confirmation through the `04-confirmations` dialog, read the page accessibility state, and close the tab, all observable in `mcp.log`.
- `runtime.ts` composes `BROWSER_USE_AVAILABLE_BACKENDS` from the backends verified in this child (default `chrome` only, or the verified subset), and sets `CUA_REPL_BROWSER_ENV` / `CUA_REPL_BROWSER_GUIDANCE` only if a variant better matches pi; the choice and its evidence are recorded.
- The behavior of unavailable backends (`iab`, `mcpapps`, and `edge` when not installed) is recorded with the runtime's exact error text so documentation can state the limits.
- `/codex-computer-use` prerequisite output distinguishes "Browser Use on but Chrome backend prerequisites missing" with the user action (install Chrome, install the ChatGPT Chrome extension, enable the Chrome plugin in the ChatGPT app).
- `docs/handoffs/computer-use/06-browser-use.json` records the verified backends, env policy, observed confirmations, and limitations for `06-publish-prep`, including that Windows Chrome prerequisites (registry-based native-host registration) are implemented from documentation only and unverified.

## Scope
### In Scope
- Live verification of the Chrome backend (open tab on a user-approved URL, origin confirmation, read state, close) and of the failure modes of `iab` and `mcpapps` from pi.
- Backend and instruction-variant env composition in `runtime.ts`, plus the Browser Use prerequisite messages in `install.ts`.
- The handoff JSON.
### Out of Scope
- [hard] Downloads, uploads, raw CDP access, WebMCP calls, OTP, and browser-auth flows beyond observing their confirmation requests if they appear; no `BROWSER_USE_FULL_CDP_ACCESS_ENABLED` changes.
- [hard] Installing or repairing Chrome, the ChatGPT Chrome extension, or the native-host manifest; the package only reports what is missing.
- [hard] Implementing `iab`, `mcpapps`, or Edge support.
- [hard] Modifying `04-confirmations` dialog semantics; if a browser request kind is misclassified, record it and return to that child's owner.
- [hard] New automated test files; verification uses live sessions and `mcp.log`.
- [deferred] A user-facing setting to choose backends or the instruction variant; this child fixes defaults only.
- [deferred] Windows live verification of the Chrome backend and its native-host prerequisite check.

## Constraints
- Use a URL the user names or approves in chat for the live tab test; never open pages that require login, and never submit forms.
- Create tabs with a short emoji-prefixed `sessionName` as the instructions require, and close every tab the test opened before the session ends.
- Keep all `BROWSER_USE_*` variables from `.mcp.json` verbatim except `BROWSER_USE_AVAILABLE_BACKENDS`; record every variable the package changes in the handoff.
- Do not set `CUA_REPL_BROWSER_ENV` to `cloud` or `orbit` unless Stage 2 shows the default variant actively misleads the model in pi; the default `codex-app` variant stays unless evidence says otherwise.
- Run the Chrome tests twice when feasible, once with the ChatGPT desktop app quit and once with it running, and record both outcomes.
- The user approves each live browser run in chat before it starts.

## Related Files / Entry Points
- `docs/handoffs/computer-use/04-mcp-bridge.json` (proposed) — consumed: env policy, log path.
- `docs/handoffs/computer-use/05-confirmations.json` (proposed) — consumed: browser request kinds and dialog behavior.
- `packages/pi-codex-computer-use/src/runtime.ts` (proposed) — add backend and instruction-variant composition.
- `packages/pi-codex-computer-use/src/install.ts` (proposed) — Browser Use prerequisite messages.
- Runtime Chrome diagnostics outside the repository — `~/.codex/plugins/cache/openai-bundled/chrome/<version>/docs/chrome-troubleshooting.md` describes `scripts/chrome-is-running.js`, `check-extension-installed.js`, and `check-native-host-manifest.js` to reuse for prerequisite checks.
- Runtime extension catalog outside the repository — `~/.codex/plugins/cache/openai-bundled/chrome/<version>/scripts/extension-ids.json` lists extension ids and store URLs per browser family.
- `docs/handoffs/computer-use/01-codex-runtime-bridge.md` — § `cua_repl` 실행 설정, § 4, § 진행 단계 5 define the backend questions.
- `docs/handoffs/computer-use/06-browser-use.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Verify the Chrome backend end to end
- Starts when: `docs/handoffs/computer-use/04-mcp-bridge.json` and `docs/handoffs/computer-use/05-confirmations.json` both have `status: "complete"`, Chrome and the ChatGPT Chrome extension are installed, and the user approves the live run and names a URL.
- Work: With Browser Use on (Computer Use off), ask the model to `cua.createBrowserTab("chrome", "<url>", { sessionName: "🔎 pi test" })`, approve the origin-access dialog, read `await tab.getAXState()`, then close the tab; repeat with the ChatGPT desktop app quit and running; record every confirmation request and runtime message.
- No-op when: `docs/handoffs/computer-use/06-browser-use.json` already records a successful Chrome run for the installed app version with the current `04`/`05` handoff digests.
- No-op handoff: `docs/briefs/2026-10-05-build-codex-cua-06-publish-prep.md` receives the existing `docs/handoffs/computer-use/06-browser-use.json`.
- Deliverable: Observed Chrome backend behavior from pi, including whether the desktop app must be running.
- Verify: `Inspect mcp.log for the Chrome run`; Inputs: the live session log and the Chrome window; Expected: a `tools/call` whose result contains the page's accessibility text, one origin-access `elicitation/create` answered `accept`, and the tab closed at the end (Chrome shows no leftover tab from the session name).
- Ends when:
  - [ ] Both desktop-app states (quit, running) have a recorded outcome.
  - [ ] Any `automated_safety_precheck.*` or other unexpected request is recorded with its result.
- Handoff: Stage 2 receives the Chrome observations.
- Replan when: The Chrome backend cannot connect from pi in either desktop-app state (native host rejects, extension unreachable); record the exact diagnostics output from the runtime's `scripts/*.js` checks, write the handoff with `chrome: "blocked"`, and return to the parent to decide whether Browser Use ships as unsupported.

### Stage 2 — Probe unavailable backends and fix the env policy
- Starts when: Stage 1 has outcomes.
- Work: With the same session, call `cua.createBrowserTab("iab", "<url>", { visible: false })` and `cua.getBrowser({ id: "mcpapps" })` and record the errors; then implement in `runtime.ts` the `BROWSER_USE_AVAILABLE_BACKENDS` default derived from the verified set, decide `CUA_REPL_BROWSER_ENV` (default unchanged), and add Browser Use prerequisite messages to `install.ts` using the runtime's diagnostic scripts or equivalent file checks.
- Deliverable: Env policy that lists only working backends and prerequisite guidance for Chrome on macOS, with the Windows native-host check implemented against the documented registry location and marked `unverified-on-this-platform`.
- Verify: `Inspect mcp.log after restarting with Browser Use on`; Inputs: `/codex-computer-use browser off` then `browser on` and one `getState` call; Expected: the logged env shows `BROWSER_USE_AVAILABLE_BACKENDS` equal to the verified set, `cua.getState()` lists only those browsers, and `/codex-computer-use` reports Chrome prerequisites as ok on this Mac.
- Ends when:
  - [ ] `iab` and `mcpapps` error texts are recorded.
  - [ ] Removing the Chrome extension prerequisite (simulated by pointing the check at a missing manifest path through an override) produces the install guidance.
- Handoff: Stage 3 receives the policy and observations.
- Replan when: Trimming `BROWSER_USE_AVAILABLE_BACKENDS` breaks `cua.getState()` or the server refuses to start; keep the `.mcp.json` value, document the mismatch between advertised and working backends, and record it for `06-publish-prep`.
- Worker decision: Whether to reuse the runtime's `scripts/check-extension-installed.js` / `check-native-host-manifest.js` by spawning them or to reimplement the file checks in TypeScript.

### Stage 3 — Publish the Browser Use handoff
- Starts when: Stage 2 policy is in place.
- Work: Write `docs/handoffs/computer-use/06-browser-use.json` with `status`, `verifiedBackends`, `envPolicy` (variables changed and why), `desktopAppRequired`, `unavailableBackends` (error texts), `confirmationsObserved`, `prerequisites`, `limitations`, `unresolved`.
- Deliverable: `docs/handoffs/computer-use/06-browser-use.json`.
- Verify: `Inspect the handoff file`; Inputs: `docs/handoffs/computer-use/06-browser-use.json`; Expected: valid JSON with `status: "complete"` or `"blocked"`, `verifiedBackends` listing `chrome` when Stage 1 succeeded, and no URLs other than the user-approved test URL.
- Ends when:
  - [ ] `06-publish-prep` can state Browser Use prerequisites and limitations from this file alone.
- Handoff: `docs/briefs/2026-10-05-build-codex-cua-06-publish-prep.md` receives `docs/handoffs/computer-use/06-browser-use.json`.
- Replan when: None — this stage records Stage 1–2 results.

## Side Effect Checkpoints
- [ ] Computer Use-only sessions behave as in `03-mcp-bridge` after the env policy change (surfaces `computer`, no browser variables added).
- [ ] Codex Desktop's own Chrome plugin still works after pi's Chrome sessions (one Codex Browser request succeeds, or the check is recorded as skipped).
- [ ] No Chrome tab created by the tests remains open, and no `cua-repl` process survives the session.
- [ ] `npm run build` and `npm run check` exit 0.
- [ ] `~/.codex/chrome-native-hosts*.json` and the native-host manifest are unchanged.

## Acceptance Criteria
- [ ] A live pi session with Browser Use on opens a Chrome tab on the approved URL, prompts once for origin access, returns the page's accessibility text, and closes the tab.
- [ ] `docs/handoffs/computer-use/06-browser-use.json` records whether the ChatGPT desktop app must be running for the Chrome backend.
- [ ] The default `BROWSER_USE_AVAILABLE_BACKENDS` equals the verified set and `cua.getState()` advertises only those browsers.
- [ ] `/codex-computer-use` names the missing Chrome prerequisite and user action when the extension or native-host manifest is absent.
- [ ] `iab` and `mcpapps` outcomes from pi are recorded with the runtime's error text.

## Open Questions
- None — backend defaults are derived from observed behavior; a user-facing backend setting is deferred.
