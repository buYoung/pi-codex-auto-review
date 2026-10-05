# Use Codex Computer Use and Browser Use in pi

**English** | [한국어](usage.ko.md)

This guide takes you from an installed Codex Desktop runtime to model-driven app/browser work in pi. Both features default to on, but runtime approval still governs access to apps and origins. The package is only the MCP host bridge; it does not supply an automation engine or an OS sandbox.

## Before starting

- Use Node.js `>=22.19.0` and pi `0.99.1` or later. Live sessions were verified with pi `0.99.1`.
- Install Codex Desktop, log in with a ChatGPT subscription that includes Codex, and enable Computer Use once so Desktop installs its plugin launch configuration. The package never reads `auth.json` and cannot verify your subscription/login.
- On macOS, grant Accessibility and Screen Recording to `Codex Computer Use.app`, not indiscriminately to other processes.
- For Browser Use, run Google Chrome with the ChatGPT Chrome extension enabled and enable the Chrome/Browser plugin in Codex Desktop to install its native messaging host.
- Keep Codex Desktop running during initial use; operation while it is quit has not been verified. macOS is verified, Windows is implemented but unverified, and Linux is unsupported.

## 1. Load the package

After the first npm publication, install `0.1.0`:

```sh
pi install npm:@buyong/pi-codex-computer-use@0.1.0
pi list
pi
```

Before publication, use the source build from the repository root:

```sh
npm install
npm run build -- --filter=@buyong/pi-codex-computer-use
node_modules/.bin/pi -ne -e packages/pi-codex-computer-use/dist/index.js
```

A successful session exposes `/computer-use` and, while at least one feature is on and the runtime connects, `mcp__cua_repl__js` and `mcp__cua_repl__js_reset`. The footer reports the feature/server state.

## 2. Check prerequisites

Run these commands separately from the compact feature settings list:

```text
/computer-use-check
/computer-use status
```

`/computer-use-check` verifies the runtime and Chrome prerequisites and prints a setup guide. It summarizes missing/unverified/user-confirmation counts; those checks are not proof that a live automation task will succeed. The original `/computer-use check` remains an alias. `status` reports current flags, runtime source, and server PID/surfaces without running full diagnostics. `ok` means the check passed; `missing` gives your next action; `user-owned` means login/subscription or an OS permission only you can supply; `unverified` is not a pass.

Discovery prefers the newest enabled Codex Desktop config under `CODEX_HOME/plugins/cache/openai-bundled/unified-computer-use/<version>/.mcp.json` (`CODEX_HOME` normally is `~/.codex`). macOS can compose a plan from the installed app's `cua_node/manifest.json` when the cache is absent. Windows requires the Desktop-written cache entry. No config is written back to Codex. App-bundle fallback configuration and service locations are marked unverified because cold first-use service launch has not been established.

The guide follows this first-use order: install Codex Desktop (CLI alone is insufficient), sign in with a Codex-capable account, enable Computer Use once and grant native service permissions if using it, configure Chrome and its ChatGPT extension/Browser plugin if using Browser Use, rerun `/computer-use-check`, then enable the desired pi features. Keep Desktop running during initial use. The command does not install, copy, repair registration, grant permissions, change your switches, read credentials, open tabs, or operate apps. Unsupported platforms get supported-platform guidance instead of a misleading local install path.

## 3. Select the features

```text
/computer-use
```

The single list contains **Computer Use** and **Browser Use**. Use `↑` / `↓` to select a feature and `Enter` / `Space` to switch `on`/`off`. Changes save immediately, with progress/errors displayed in place. The screen stays open and preserves the selected row so you can change both features in one visit. `Esc` closes without reverting saved changes.

For Browser Use only, set Computer Use to `off` and Browser Use to `on`. Explicit command arguments remain available:

```text
/computer-use computer off
/computer-use browser on
```

RPC uses a repeating picker with the same two feature switches and Close. Print/JSON mode prints status and accepts explicit arguments; it does not try to render a custom screen.

| Flags | Runtime surfaces | Model tools |
| --- | --- | --- |
| Both on | `browser,computer` | `js`, `js_reset` |
| Computer only | `computer` | `js`, `js_reset` |
| Browser only | `browser` | `js`, `js_reset` |
| Both off | No server | Hidden |

Settings are stored at `<agentDir>/codex-computer-use/settings.json` (`PI_CODING_AGENT_DIR`, otherwise `~/.pi/agent`). A missing file defaults to both true. Only the two boolean keys are accepted; invalid files fail closed and are not overwritten by toggle commands. Fix the file and reload/restart the session. Changing a flag waits until idle and restarts the server, discarding previous REPL state.

## 4. Run a task and answer approvals

For an inventory-only first check, ask:

```text
Use mcp__cua_repl__js to run await cua.getState(). Summarize the available apps and browsers without operating them.
```

For a public browser page, you can ask:

```text
Use Browser Use to open https://example.com in Chrome, read its accessibility state, and close the tab. Do not submit forms or download anything.
```

The runtime requires the first `js` call to use exactly one entry API such as `cua.getState()`, `cua.getApp()`, or `cua.createBrowserTab()` (optionally assigning its result). Read the returned documentation/state before any further call. `cua` is already initialized: the unified runtime suppresses the legacy bootstrap skills, so do not import/setup the old `@oai/sky` or browser-client flow.

The runtime's Desktop examples still mention `iab` and `mcpapps`, although pi enables Chrome only. The package now annotates the model-facing tool declaration with the current host limits and also contributes pi prompt guidelines. It preserves the registered runtime description and a caller's custom system prompt. For a new page without a requested backend, the guide selects Chrome; an explicitly requested unavailable backend is explained rather than silently substituted.

Entry APIs and default `getAXState()` already emit documentation/state. Do not wrap their output again. Plain JavaScript expression values are not printed; use `nodeRepl.write()` for additional values and await `nodeRepl.emitImage()` for additional images. Reuse persistent bindings. After a REPL reset or settings restart, reacquire them; after context compaction, restore documentation with `cua.rewriteDocumentation()`.

Approval dialogs keep Codex's labels:

- `Allow`: approve this request once.
- `Allow for this session`: shown only when the runtime offers session persistence. Verified to suppress later Finder requests within the session.
- `Always allow`: shown only when the runtime offers permanent persistence. It can alter permissions remembered by the OpenAI runtime; it was not exercised in verification to avoid persistent grants.
- `Cancel`: dismiss a tool approval. Non-tool requests additionally offer `Deny`.

An origin request may offer only `Allow`, `Always allow`, `Cancel`. This was the observed `example.com` flow. The package does not maintain a second permission store.

The UI accepts a delayed answer without the client imposing a 30-second timeout: a 60-second Finder approval wait succeeded with the runtime's default `js` timeout. Esc sends cancellation to the pending MCP call and dismisses the dialog. A JavaScript operation already executing may finish later; cancellation is not an immediate OS-level kill.

## 5. Confirm cleanup

Have the model explicitly close test-created browser tabs, and check `/computer-use status` after changing features. `turn_ended` is sent once when the agent fully settles (`Stop` normally, `Interrupt` when aborted). Closing/reloading pi stops the package's server process tree; it does not stop Codex Desktop's own processes.

Large text output is middle-truncated after approximately 25,000 tokens (100,000 bytes). The result names a full-output file in the system temporary directory, written with owner-only permissions. Image blocks pass to the model unchanged.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Runtime unavailable | Install/update Codex Desktop and enable Computer Use once; inspect the runtime source in `status`. Use `PI_CODEX_COMPUTER_USE_APP_PATH` for a nonstandard macOS app path. |
| `platform-unsupported` | Use macOS or Windows. Windows still needs real-machine validation. |
| Invalid settings | Fix the two boolean keys in the named settings file and reload/restart. Unknown keys are not silently discarded. |
| Codex's `setup.sh` says `bin/npm` is missing | The tested Desktop build does not ship npm/npx although its validation script expects them. The package reports the script as unverified and separately validates Node's manifest version, the `@oai/sky` import, and `node_repl --help`. |
| Chrome prerequisite missing | Follow `check`: install/start Chrome, enable its ChatGPT extension, or enable/reinstall the Chrome/Browser plugin in Codex Desktop. The package does not repair the native host. |
| `Browser is not available: iab` / `mcpapps` | Use Chrome. Those backends failed from pi even with Codex Desktop running. |
| No approval surface in print/JSON mode | Run interactively or use a dialog-capable RPC client. The package declines rather than hanging; the tool error includes the explanation. |
| Login/OTP/URL approval declined | pi has no supported browser-auth/OTP/URL elicitation surface in this package. |
| A cancelled call delays later calls | The runtime serializes calls; a cancelled JavaScript execution can continue until completion/timeout. `turn_ended` can wait behind it. |

Logs live at `<agentDir>/codex-computer-use/mcp.log` (rotated at 5 MiB). Key-based redaction is not a guarantee that all page/app data is removed; inspect logs before sharing. The proprietary runtime may emit telemetry; its outside-Codex behavior is unverified.

## Verified scope and remaining gaps

On 2026-10-05, macOS `ChatGPT.app` `26.930.31730` and pi `0.99.1` were used to verify app/browser inventories, Finder Allow/session/Cancel/delayed approval, RPC abort, Chrome `example.com` origin approval/accessibility/close, four feature combinations, metadata, image output, and truncation. Approval flows used RPC. The `/computer-use` settings screen was also exercised in actual pi TUI with regular/dark and narrow fullscreen/light configurations, including single-list selection, saving, reopen, and closing. A live follow-up on `example.com` confirmed the model chose Chrome from the host guidance and completed create/read/close successfully; this is one run, not a measured failure-rate improvement.

Windows execution, cold native service launch from the app-bundle fallback, operation with Desktop quit, persistent `Always allow`, and downloads/uploads/full CDP/WebMCP are not verified. Guardian-required automatic prechecks can fail. OpenAI runtime files are not distributed or relicensed; account eligibility and applicable OpenAI terms remain user responsibilities.

Implementation evidence is in the repository's `docs/handoffs/computer-use/02-feasibility.json` through `07-publish-prep.json`; the earlier settings UI update is recorded in `08-settings-ui.json`, superseded by the single-list and host-guidance update in `09-guidance-and-settings.json`. First publication is manual and requires separate approval; the shared CI packaging workflow is otherwise workspace-aware.
