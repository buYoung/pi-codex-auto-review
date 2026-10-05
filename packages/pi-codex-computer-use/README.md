# @buyong/pi-codex-computer-use

**English** | [한국어](README.ko.md)

Computer Use and Browser Use for pi, using the proprietary runtime already installed by Codex Desktop. This independent TypeScript extension launches Codex's unified `cua_repl` MCP server, forwards text and images, and presents its approval requests with Codex's option labels. Both features are **on by default**, with separate switches.

The package never bundles, downloads, copies, or redistributes OpenAI runtime files. It is not an OS sandbox and does not reproduce the automation engine.

## Requirements

| Requirement | What you need |
| --- | --- |
| Node.js | `>=22.19.0` |
| pi | Use `0.99.1` or later. Full live verification used `0.99.1`; `1.0.2` passed a status smoke check. Older versions within the manifest's peer range have not been verified. |
| Codex account | A ChatGPT subscription that includes Codex, with Codex Desktop signed in. The package does not read credentials or verify account eligibility. |
| Codex Desktop | Installed with the Computer Use runtime. Tested on macOS with `ChatGPT.app` (bundle ID `com.openai.codex`) `26.930.31730`. |
| Computer Use | Native service installed by Codex Desktop; on macOS grant Accessibility and Screen Recording to `Codex Computer Use.app`. |
| Browser Use | Google Chrome running, ChatGPT Chrome extension enabled, and Codex Desktop's Chrome plugin/native messaging host installed. |

macOS is verified. Windows discovery and checks are implemented but **not verified on a Windows machine**. Linux and other platforms are unsupported. Chrome is the only enabled browser backend; `iab`, `mcpapps`, and Edge are not supported by this package. Keep Codex Desktop running: behavior with the desktop app quit is unverified.

## Installation

Version `0.1.0` is prepared for its first publication; these commands are for use **after it is published**:

```sh
pi install npm:@buyong/pi-codex-computer-use@0.1.0
pi list
pi
```

From a source checkout, run the following from the repository root without adding a permanent package entry:

```sh
npm install
npm run build -- --filter=@buyong/pi-codex-computer-use
node_modules/.bin/pi -ne -e packages/pi-codex-computer-use/dist/index.js
```

In pi, run `/computer-use-check` for prerequisite checks and a first-use setup guide, then `/computer-use` to select features. The report separates missing, unverified, and user-owned requirements, including Desktop installation/login, native service permissions, Chrome extension and native-host registration. The package checks Codex's installed runtime and locates its service without repairing Codex settings, plugin caches, or native-host registration.

## Usage

```text
/computer-use
```

The command opens one native pi settings list with **Computer Use** and **Browser Use**. Use `↑` / `↓` to select a feature and `Enter` / `Space` to switch it between `on` and `off`. Changes save immediately, the runtime reconnects, and both the screen and selection stay in place. `Esc` closes it without undoing saved changes. There are no tabs or diagnostic panels in this view.

RPC clients get a repeating settings picker because custom terminal components are TUI-only. Without UI, the bare command prints status. Explicit arguments remain available for scripts:

```text
/computer-use-check
/computer-use status
/computer-use computer off
/computer-use browser off
/computer-use computer on
/computer-use browser on
```

`/computer-use check` remains a compatibility alias for the same diagnostic report and guide. The check does not install software, repair registration, change feature settings, read Codex credentials, or run an app/browser task. A macOS app-bundle fallback and cold native service launch are marked unverified rather than ready.

Settings live at `<agentDir>/codex-computer-use/settings.json`, where `agentDir` honors `PI_CODING_AGENT_DIR` and normally is `~/.pi/agent`.

```json
{
  "computerUse": true,
  "browserUse": true
}
```

A missing file uses these defaults without writing it. An invalid file forces both features off for that session and reports the error. Toggle commands wait for the agent to become idle, persist the change, and restart the runtime. Restarting discards REPL variables and app/tab bindings. With both features off, no MCP process starts and the tools are hidden.

Ask the model to use `mcp__cua_repl__js`, for example:

```text
Use mcp__cua_repl__js to run await cua.getState(). Summarize the available apps and browsers without operating them.
```

The server's original instructions remain intact. pi also supplies host guidance in the model-facing tool declaration and default system prompt: Chrome-only Browser Use, enabled surfaces, a single entry call after startup/reset, no legacy manual bootstrap, and correct output/binding handling. This prevents Desktop-only `iab`/`mcpapps` examples from being mistaken for available pi backends, including when a custom system prompt is used. No extra skill or automatic retry/reset is installed. `js` and `js_reset` are exposed; `turn_ended` and module-directory mutation are internal. Browser creation, accessibility reads, text/image output, interruption, and turn-end notifications have been exercised in live pi sessions. See the [usage guide](docs/computer-use/usage.md) for the verification scope and troubleshooting.

## Approvals and limitations

- Approval options are `Allow`, `Allow for this session`, `Always allow`, and `Cancel`, where the runtime offers the corresponding persistence modes. Non-tool requests also offer `Deny`. The runtime, not pi, owns remembered permissions. These permissions allow operating the selected app/origin, not just reading it.
- In print/JSON mode, requests requiring user interaction are declined and the tool result explains the missing approval surface. RPC clients must answer pi's UI requests. Status/diagnostic text goes to stderr in modes without UI.
- Ordinary empty-schema `js`/`node_repl` execution approvals follow Codex's user-reviewer auto-approval rule. Sensitive requests are not covered by this rule. Guardian routing is not implemented; some automated safety prechecks consequently cannot work.
- Browser sign-in/QR, email OTP, URL-mode elicitation, and unsupported forms are declined. Downloads, uploads, full CDP access, and WebMCP have not been validated end to end.
- Cancellation sends MCP cancellation, but a running JavaScript call may continue inside the runtime until it completes or reaches its own timeout. `turn_ended` can consequently be delayed. No immediate OS-level stop guarantee is provided.
- Cold service launch from the app-bundle fallback, Windows execution, and desktop-quit operation have not been verified. Settings navigation and saving were verified in actual pi TUI (regular/dark and narrow fullscreen/light); approval flows were driven through pi RPC.
- Codex's private runtime interfaces may change when Desktop updates. Runtime telemetry may transmit usage data; its behavior outside Codex has not been established. Check the applicable OpenAI terms before using this host bridge.

Logs are stored at `<agentDir>/codex-computer-use/mcp.log` with rotation and key-based secret redaction. They can still contain page/app content; inspect and redact them before sharing.

## License

The bridge code is Apache-2.0; see [LICENSE](LICENSE) and [NOTICE](NOTICE). OpenAI's proprietary runtime is not part of the package and is not relicensed by it. [Source and implementation evidence](https://github.com/buYoung/pi-codex-auto-review/tree/master/docs/handoffs/computer-use).
