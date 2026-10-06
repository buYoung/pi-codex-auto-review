# @buyong/pi-codex-computer-use

**English** | [한국어](README.ko.md)

Use Codex Desktop's installed Computer Use and Browser Use runtime from Pi. This independent TypeScript extension starts the unified `cua_repl` MCP server, forwards text and images, and presents runtime approval requests in Pi. **Both features default to on**, with separate switches.

The package is a host bridge, not an automation engine or OS sandbox. It does not bundle, download, copy, or redistribute OpenAI's proprietary runtime.

## Requirements

| Requirement | What you need |
| --- | --- |
| Node.js | 22.19 or later |
| Pi | 0.99.1 or later. Recorded live checks used 0.99.1; 1.0.2 has only a status smoke-check record. Older versions in the broader manifest peer range are unverified. |
| Codex Desktop | Installed with its Computer Use runtime and signed in to an account with Codex access. The package cannot verify subscription eligibility or login. |
| Computer Use | Desktop's native service. On macOS, grant Accessibility and Screen Recording to `Codex Computer Use.app`. |
| Browser Use | Running Google Chrome, the enabled ChatGPT Chrome extension, and Desktop's Chrome/Browser plugin with native messaging host registration |

Recorded live verification used macOS `ChatGPT.app` (bundle ID `com.openai.codex`) `26.930.31730`. Windows discovery/checks are implemented but **not verified on a Windows machine**. Linux and other platforms are unsupported. Keep Desktop running; desktop-quit operation is unverified.

**Chrome is the only enabled browser backend.** `iab`, `mcpapps`, and Edge examples in Desktop's runtime documentation do not make those backends available in Pi.

## Install and make a first check

Install a published release:

```sh
pi install npm:@buyong/pi-codex-computer-use
pi list
pi
```

Append `@<version>` to pin a release. For the current checkout or a package not yet published, use the source instructions below. Do not enable this individual extension alongside `@buyong/pi-codex`.

Inside Pi:

1. Run `/computer-use-check` and resolve missing prerequisites. `user-owned` items require your confirmation; `unverified` is not a pass.
2. Run `/computer-use` and enable only the features you need.
3. Ask for an inventory without app/browser operations:

```text
Use mcp__cua_repl__js to run await cua.getState(). Summarize the available apps and browsers without operating them.
```

A connected runtime exposes `mcp__cua_repl__js` and `mcp__cua_repl__js_reset` for the enabled surfaces. If discovery or startup fails, the footer reports an error and runtime tools remain hidden. A prerequisite check is not proof that a live automation task will succeed.

## Change features and inspect status

`/computer-use` opens a single TUI settings list. Use **↑/↓** to select Computer Use or Browser Use and **Enter/Space** to toggle it. Changes save immediately and restart the runtime. The list stays open with the selected row preserved; Esc closes it without undoing saved changes.

| Command | Purpose |
| --- | --- |
| `/computer-use-check` | Prerequisite report and first-use setup guide |
| `/computer-use status` | Current switches, settings path, runtime source, and server state |
| `/computer-use computer on` / `off` | Change Computer Use |
| `/computer-use browser on` / `off` | Change Browser Use |
| `/computer-use check` | Compatibility alias for `/computer-use-check` |

RPC uses a repeating two-feature picker with a Close choice. Without UI, the bare command prints status and explicit arguments remain available. Status/check text is written to stderr in print/JSON mode.

Settings live at `<agentDir>/codex-computer-use/settings.json`. `agentDir` honors `PI_CODING_AGENT_DIR` and normally is `~/.pi/agent`.

```json
{
  "computerUse": true,
  "browserUse": true
}
```

A missing file uses defaults without creating it. An existing file must contain exactly these two boolean keys. Invalid or unreadable settings force both features off; toggle commands will not overwrite an invalid file. Fix it and run `/reload` or restart Pi.

Switch changes wait for the agent to become idle. Restarting clears REPL variables and app/tab bindings. With both features off, no server starts and its tools are hidden. Manual settings edits need reload or restart.

## Approvals and limits

- The runtime owns remembered permissions. Where offered, Pi shows **Allow**, **Allow for this session**, **Always allow**, and **Cancel**; non-tool requests also offer **Deny**. These permissions allow operating the app/origin, not just reading it.
- An ordinary empty-form `js` execution approval from `node_repl` follows Codex's user-reviewer auto-approval rule. Sensitive requests or requests needing user input are not covered by that rule. This bridge does not implement Guardian automatic review.
- Requests needing user interaction are declined in print/JSON mode. RPC clients must answer Pi UI requests. Supported ordinary forms can use Pi input/select/confirm dialogs; browser sign-in/QR, email OTP, URL-mode requests, and unsupported forms are declined.
- Cancellation sends MCP cancellation, but already-running JavaScript may continue until completion or the runtime's timeout. No immediate OS-level stop is guaranteed.
- Cold service launch from the macOS app-bundle fallback, Windows execution, desktop-quit operation, permanent grants, downloads/uploads, full CDP, and WebMCP remain unverified.
- Desktop updates can change private interfaces. Runtime telemetry outside Codex has not been established; check applicable OpenAI terms.

Logs rotate at 5 MiB under `<agentDir>/codex-computer-use/mcp.log`. Key-based masking does not remove every page/app detail. Inspect and redact logs before sharing.

See the [usage guide](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/computer-use/usage.md) for runtime discovery, task examples, approval behavior, troubleshooting, and the recorded verification scope. The npm archive also includes it at `docs/computer-use/usage.md`.

## Build and load from source

Run from the repository root:

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex-computer-use
node_modules/.bin/pi -ne -e ./packages/pi-codex-computer-use/dist/index.js
```

`-ne` disables automatic extension discovery and `-e` loads this extension for one invocation. Desktop setup is still required. After source changes, rebuild and reload/restart Pi.

## License

Bridge code: [Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE), included as `LICENSE` in the archive, with attribution in [NOTICE](NOTICE). OpenAI's proprietary runtime is not included or relicensed. [Implementation and verification records](https://github.com/buYoung/pi-codex-auto-review/tree/master/docs/handoffs/computer-use) describe historical checks, not new results from installing the package.
