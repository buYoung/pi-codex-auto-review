# [feat] Scaffold the package with settings, runtime discovery and install check

## Work Type
feat

## Current State (As-Is)
- [confirmed] The repository is an npm-workspaces + Turborepo monorepo (`"workspaces": ["packages/*"]`, `turbo.json` `build` task) whose only package is `packages/pi-codex-auto-review`; `master` is at `d5aa4c2` — Evidence: root `package.json`, `ls packages`.
- [confirmed] `packages/pi-codex-auto-review/package.json` is the structural template: ESM, `main`/`types` under `dist/`, `pi.extensions: ["./dist/index.js"]`, `scripts.build: "tsc"`, `prepack` running `tsc` plus `../../scripts/package-shared-files.mjs copy` and `../../scripts/check-package.mjs`, pi packages as `peerDependencies` (`>=0.86.1`) with `0.99.1` in `devDependencies`, `engines.node >=22.19.0`, `publishConfig.access: public` — Evidence: that file.
- [confirmed] `packages/pi-codex-auto-review/tsconfig.json` extends `../../tsconfig.base.json` with `outDir: dist`, `rootDir: src`, `include: ["src"]`; the base sets `module: NodeNext`, `strict`, `declaration`, `sourceMap` — Evidence: both files.
- [confirmed] The auto-review extension resolves its agent directory as `options.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent")` and stores settings under `<agentDir>/guard/settings.json`; this package reuses only the convention, never the code — Evidence: `createGuardExtension()` in `packages/pi-codex-auto-review/src/index.ts`, `src/approval-settings.ts`.
- [confirmed] Pi 0.99.1 exposes `pi.registerCommand(name, { description, handler(args, ctx) })`, `ExtensionCommandContext.waitForIdle()`, `ctx.hasUI`, `ctx.ui.select/confirm/input/notify`, and `getAgentDir()`; the docs forbid starting processes in the extension factory — Evidence: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` (`RegisteredCommand`, `ExtensionCommandContext`), `docs/extensions.md` § Respect the runtime lifecycle.
- [confirmed] On this Mac, Codex Desktop's launch configuration lives at `~/.codex/plugins/cache/openai-bundled/unified-computer-use/<version>/.mcp.json` (`enabled: true`, absolute `command`/`args`, full `env` including `SKY_CUA_SERVICE_PATH` and `CODEX_HOME`); the app-internal template at `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/.mcp.json` is disabled with empty args; the runtime root `/Applications/ChatGPT.app/Contents/Resources/cua_node` carries `manifest.json`, `bin/setup.sh`, and `bin/setup.ps1` — Evidence: § 설치 in `docs/handoffs/computer-use/01-codex-runtime-bridge.md`, `ls /Applications/ChatGPT.app/Contents/Resources/cua_node/bin`.
- [confirmed] Codex models Computer Use configuration for exactly two platforms: macOS (`bundle_ids`) and Windows (`aumids`, `exes`); there is no Linux entry — Evidence: `ComputerUseConfigToml` in `tmp/codex-main/codex-rs/config/src/computer_use.rs`, `ComputerUseRequirementsToml` in `config/src/browser_computer_use_requirements.rs`.
- [confirmed] The runtime carries per-platform code and instructions for macOS, Windows, and Linux (`@oai/sky/dist/project/cua/sky_js/src/targets/{mac,windows,linux}`, `@oai/cua-repl/instructions/{macos,windows,linux}`), and `setup.sh` checks `@oai/sky`, node/npm/corepack versions, and `node_repl --help` only — Evidence: those directories, `cua_node/bin/setup.sh`.
- [confirmed] Prerequisites the package cannot satisfy itself: Codex-capable ChatGPT subscription and login (no public check), Codex Desktop app install (macOS bundle id `com.openai.codex`), OS permission grants to the Computer Use service (macOS Accessibility/Screen Recording), Chrome plus the ChatGPT Chrome extension and native host registration — Evidence: § 사전 요구사항 and § 설치 in the handoff document.
- [confirmed] `@earendil-works/pi-mcp` (0.99.1) is installed only as a nested dependency of `pi-coding-agent`, is not in pi's package-provided list, and its `McpClient` supports `capabilities`, `setRequestHandler`, `request(method, params, { timeoutMs, signal })`; `DEFAULT_REQUEST_TIMEOUT_MS = 30_000` and `timeoutMs <= 0` disables the timer — Evidence: `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-mcp/dist/{client.d.ts,client.js}`, `node_modules/@earendil-works/pi-coding-agent/docs/packages.md`.
- [inferred] On Windows, Codex Desktop materializes the same plugin cache under `CODEX_HOME` (default `%USERPROFILE%\.codex`) with absolute Windows paths in `.mcp.json`, so plugin-cache discovery is platform-neutral while the app-bundle fallback, service-app location, and permission checks are platform-specific — Confirm by: a Windows machine with Codex Desktop installed; none was available on 2026-10-05.
- [inferred] The npm registry may not publish a `pi-mcp` version that matches `pi-coding-agent` 0.99.1 exactly (latest observed 1.0.2) — Confirm by: `npm view @earendil-works/pi-mcp versions` during Stage 1.

## Desired Outcome (To-Be)
- `packages/pi-codex-computer-use` exists as `@buyong/pi-codex-computer-use` 0.1.0, builds with the root `npm run build`, passes `npm run check`, and loads with `pi -e packages/pi-codex-computer-use/dist/index.js`.
- Settings `{ "computerUse": boolean, "browserUse": boolean }` persist at `<agentDir>/codex-computer-use/settings.json`, default to both `true` (users install the package because they want these features in pi), reject unknown keys and non-boolean values, and are read on `session_start`.
- `/codex-computer-use` with no argument shows prerequisite status (platform support, Codex Desktop app, runtime manifest, `.mcp.json`, service app location, Chrome native host, pi version) and current feature state and lets the user toggle each feature; `/codex-computer-use computer on|off`, `browser on|off`, `status`, and `check` work as direct arguments.
- Runtime discovery is platform-aware: on macOS and Windows it returns a `RuntimePlan` (`command`, `args`, `env`, `source`, `appVersion`, `platform`) from the newest enabled `.mcp.json` under `CODEX_HOME`; on macOS without a cache entry it composes the plan from the app-internal `cua_node`; on Windows without a cache entry it returns `RuntimeUnavailable` with guidance to enable Computer Use once in Codex Desktop; on Linux and other platforms it returns `platform-unsupported`. Overrides `PI_CODEX_COMPUTER_USE_APP_PATH`, `PI_CODEX_COMPUTER_USE_PLATFORM`, and `CODEX_HOME` make every branch testable from this Mac.
- Prerequisite checks run `cua_node/bin/setup.sh` (macOS) or `cua_node/bin/setup.ps1` (Windows) and report exit code and output tail, verify `@oai/cua-repl`, `@oai/cua`, `@oai/browser-desktop` directories, check the service app location on macOS and report `unverified-on-this-platform` for Windows-specific checks, and never write under `CODEX_HOME`.
- No MCP server is started in this child; `docs/handoffs/computer-use/03-package-setup.json` hands the module layout, settings contract, platform matrix, and `RuntimePlan` shape to `03-mcp-bridge`.

## Scope
### In Scope
- Package manifest, `tsconfig.json`, `src/index.ts` (default export factory, `session_start` settings load, command registration), `src/settings.ts`, `src/platform.ts`, `src/runtime.ts`, `src/install.ts`, `src/commands.ts`.
- Adding `@earendil-works/pi-mcp` to `dependencies` now so later children do not touch the lockfile, plus pi `peerDependencies`/`devDependencies` mirroring auto-review.
- Root `package-lock.json` update produced by `npm install` for the new workspace.
- The handoff JSON, including the platform matrix (macOS verified on this machine, Windows implemented but unverified, Linux unsupported).
### Out of Scope
- [hard] Starting, connecting to, or probing the `cua_repl` server, registering tools, or handling elicitation — `03-mcp-bridge` and `04-confirmations` own these.
- [hard] Writing to `CODEX_HOME` (`config.toml`, `plugins`, `computer-use`) or the Chrome native-host registration; copying `Codex Computer Use.app`; reading `auth.json`.
- [hard] Importing, depending on, or modifying `packages/pi-codex-auto-review`; this package is an independent extension.
- [hard] Modifying `scripts/check-package.mjs`, `scripts/run-tests.mjs`, or `.github/workflows/*` — `06-publish-prep` owns packaging scripts.
- [hard] Adding automated test files or suites (not requested); verification uses build, lint, and live `pi` sessions.
- [deferred] Windows live verification (needs a Windows machine with Codex Desktop) and a Windows app-bundle fallback; recorded in the handoff for the parent.
- [deferred] Linux support; the runtime has Linux code but Codex Desktop has no Linux Computer Use configuration.
- [deferred] Package-local README and `docs/computer-use/usage*.md` — `06-publish-prep`.

## Constraints
- Match the auto-review package shape exactly: ESM, `tsc` build to `dist/`, `exports["."]` → `./dist/index.js`, `pi.extensions: ["./dist/index.js"]`, `peerDependencies` on `@earendil-works/pi-ai`, `pi-coding-agent`, `pi-tui` `>=0.86.1`, `devDependencies` pinned to `0.99.1`, `engines.node >=22.19.0`, `publishConfig.access: public`, `license: Apache-2.0`, `keywords` including `pi-package` and `pi-extension`.
- Keep Biome formatting (4-space indent) so `npm run check` passes without new config.
- Resolve the agent directory the same way as auto-review (`PI_CODING_AGENT_DIR`, then `~/.pi/agent`) so both packages share one convention, without importing auto-review.
- Settings file writes are atomic (temp file + rename) and never remove unknown keys silently; an invalid file is reported and treated as both features off for that session (fail closed), while a missing file means the defaults (`true`/`true`).
- Runtime discovery is read-only and uses `node:path`/`os.homedir()` for all path handling (no POSIX-only assumptions): resolve `CODEX_HOME` (default `<home>/.codex`), list `plugins/cache/openai-bundled/unified-computer-use/*/.mcp.json`, pick the highest version directory whose `mcpServers.cua_repl.enabled === true` and whose `command` exists; on macOS otherwise compose from `/Applications/ChatGPT.app/Contents/Resources/cua_node` (`manifest.json` → `node_path`, `node_repl_path`, `node_modules`) with the same variable names Codex Desktop uses, leaving `CUA_REPL_ENABLED_SURFACES` and `NODE_REPL_TRUSTED_SERVICES` for `03-mcp-bridge` to set.
- Platform support follows Codex: `darwin` and `win32` are supported, everything else returns `platform-unsupported` without probing files.
- `install.ts` output must name the exact missing prerequisite and the user action (install Codex Desktop, log in with a Codex-capable account, grant permissions, install the Chrome extension, enable the Chrome plugin in Codex Desktop) without claiming the package can perform it; Windows checks that cannot be implemented from macOS evidence report `unverified-on-this-platform` instead of `ok`.
- Run `setup.ps1` through `powershell -NoProfile -ExecutionPolicy Bypass -File` on Windows and `setup.sh` through `bash` on macOS, with a bounded timeout and captured output.
- The command handler must call `ctx.waitForIdle()` before changing settings and must work when `ctx.hasUI` is false by printing status and accepting only explicit arguments.

## Related Files / Entry Points
- `packages/pi-codex-auto-review/package.json` — copy the manifest shape (`exports`, `pi`, `scripts`, peer/dev dependencies, `engines`, `files` skeleton).
- `packages/pi-codex-auto-review/tsconfig.json` — copy verbatim into the new package.
- `packages/pi-codex-auto-review/src/index.ts` — reference for agent-dir resolution and `session_start` / `session_shutdown` wiring (pattern only, no import).
- `packages/pi-codex-auto-review/src/approval-settings.ts` — reference for the settings store pattern (load, validate, persist).
- `packages/pi-codex-auto-review/src/approval-commands.ts` — reference for `registerCommand` usage and argument parsing.
- `package.json` — root workspaces; `npm install` after adding the package updates `package-lock.json`.
- `tsconfig.base.json` — compiler options inherited by the new package.
- `biome.json` — formatting/lint rules the new sources must satisfy.
- `packages/pi-codex-computer-use/package.json` (proposed) — new manifest.
- `packages/pi-codex-computer-use/src/index.ts` (proposed) — extension entry.
- `packages/pi-codex-computer-use/src/settings.ts` (proposed) — feature flags store.
- `packages/pi-codex-computer-use/src/platform.ts` (proposed) — supported-platform detection and per-platform paths/commands.
- `packages/pi-codex-computer-use/src/runtime.ts` (proposed) — discovery and `RuntimePlan`.
- `packages/pi-codex-computer-use/src/install.ts` (proposed) — prerequisite checks and guidance.
- `packages/pi-codex-computer-use/src/commands.ts` (proposed) — `/codex-computer-use`.
- `docs/handoffs/computer-use/01-codex-runtime-bridge.md` — § 사전 요구사항, § 설치, § `cua_repl` 실행 설정 define the checks and variable names.
- `tmp/codex-main/codex-rs/config/src/computer_use.rs` — the macOS/Windows platform set Codex supports.
- `docs/handoffs/computer-use/03-package-setup.json` (proposed) — this child's handoff.
- `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` — command, lifecycle, and tool-exposure rules.

## Execution Plan
### Stage 1 — Create the buildable package
- Starts when: The repository is at a clean commit on `master` and `node --version` satisfies `>=22.19.0`.
- Work: Add `packages/pi-codex-computer-use` with manifest, `tsconfig.json`, an `index.ts` default export that registers nothing but logs load, `@earendil-works/pi-mcp` in `dependencies`, and run `npm install` so the workspace and lockfile include it.
- No-op when: `packages/pi-codex-computer-use/package.json` already names `@buyong/pi-codex-computer-use` and `npm run build` exits 0 with `dist/index.js` present.
- No-op handoff: `docs/briefs/2026-10-05-feat-codex-cua-03-mcp-bridge.md` receives the existing `docs/handoffs/computer-use/03-package-setup.json` describing the current layout.
- Deliverable: A workspace package that builds through Turborepo and loads in pi.
- Verify: `npm run build && npm run check`; Inputs: repository root with the new package; Expected: both exit 0 and `packages/pi-codex-computer-use/dist/index.js` exists.
- Ends when:
  - [ ] `pi -e packages/pi-codex-computer-use/dist/index.js` starts a session without an extension error.
  - [ ] `npm ls @earendil-works/pi-mcp --workspace packages/pi-codex-computer-use` resolves one version.
- Handoff: Stage 2 receives the buildable package.
- Replan when: No `@earendil-works/pi-mcp` version compatible with `pi-coding-agent` 0.99.1 exists on npm; record the available versions, pin the lowest `>=0.99.1` that exports `McpClient`/`StdioTransport`, and flag the mismatch in the handoff for `03-mcp-bridge` to verify at runtime.
- Worker decision: Exact `pi-mcp` version pin and whether to mirror the root `overrides` pattern for it.

### Stage 2 — Settings store and feature flags
- Starts when: Stage 1 builds.
- Work: Implement `settings.ts` (path `<agentDir>/codex-computer-use/settings.json`, schema `{computerUse, browserUse}`, defaults `true`/`true`, validation, atomic write) and load it on `session_start`, exposing a typed `FeatureState` to the rest of the package.
- Deliverable: Persisted feature flags with validation errors reported through `ctx.ui.notify` (or stdout without UI).
- Verify: `Inspect the settings file after first run and after toggling`; Inputs: `~/.pi/agent/codex-computer-use/settings.json`; Expected: with no file present `FeatureState` is `true`/`true` and no file is written until a toggle, after `browser off` the file contains exactly the two boolean keys with `browserUse: false`, and a hand-edited `"computerUse": "yes"` is reported as invalid on the next session start with both features treated as off.
- Ends when:
  - [ ] Defaults are both `true` on first run and the directory is created on first write.
  - [ ] Invalid files never crash the extension and fail closed.
- Handoff: Stage 3 receives `FeatureState`.
- Replan when: `PI_CODING_AGENT_DIR` handling differs from auto-review in the running pi; align with `getAgentDir()` and record the difference.

### Stage 3 — Platform detection, runtime discovery, and prerequisite checks
- Starts when: Stage 2 provides `FeatureState`.
- Work: Implement `platform.ts` (`darwin`, `win32` supported; others `platform-unsupported`; per-platform default `CODEX_HOME`, setup script, service-app check strategy), `runtime.ts` (`discoverRuntime(): RuntimePlan | RuntimeUnavailable`), and `install.ts` (`checkPrerequisites(): PrerequisiteReport` running the platform's setup script, checking `@oai/*` directories, service app location in `SKY_CUA_SERVICE_PATH` → `$CODEX_HOME/computer-use` → app-internal copy on macOS, Chrome native host registration on macOS, platform, pi version) with override variables for testing.
- Deliverable: Discovery and prerequisite modules returning data structures, no side effects beyond running the setup script.
- Verify: `Inspect discovery output on this Mac and under simulated platforms`; Inputs: `node -e` script importing `dist/runtime.js` and `dist/install.js`, plus a temporary `CODEX_HOME` containing a hand-written `.mcp.json` with Windows-style absolute paths and `PI_CODEX_COMPUTER_USE_PLATFORM=win32`; Expected: on this Mac `RuntimePlan.command` equals the real `.mcp.json` command with `source` `plugin-cache` and `platform` `darwin`, the simulated Windows cache yields a `RuntimePlan` with `platform` `win32` and the Windows prerequisites marked `unverified-on-this-platform`, `PI_CODEX_COMPUTER_USE_PLATFORM=linux` yields `platform-unsupported` without touching the filesystem, and `PI_CODEX_COMPUTER_USE_APP_PATH=/nonexistent` with an empty `CODEX_HOME` on `darwin` yields `RuntimeUnavailable` with reason `app-not-found`.
- Ends when:
  - [ ] The setup script exit code and output tail appear in the report on this Mac.
  - [ ] The macOS fallback plan composed from `cua_node/manifest.json` carries the same env keys as the `.mcp.json` plan except `CUA_REPL_ENABLED_SURFACES` and `NODE_REPL_TRUSTED_SERVICES`.
- Handoff: Stage 4 receives `RuntimePlan`, `PrerequisiteReport`, and the platform matrix.
- Replan when: The `.mcp.json` schema or `manifest.json` keys differ from the handoff document on the installed version; record the actual keys and adapt discovery before proceeding.
- Worker decision: Whether the macOS fallback plan is attempted when the plugin cache exists but is disabled, and how setup-script failures are surfaced (warning vs blocking).

### Stage 4 — `/codex-computer-use` command and handoff
- Starts when: Stage 3 modules return data on this Mac.
- Work: Register `/codex-computer-use` showing the prerequisite report, platform status, and feature state, offering toggles through `ctx.ui.select` when `hasUI`, accepting `computer on|off`, `browser on|off`, `check`, and `status` arguments, persisting changes through Stage 2; then write `docs/handoffs/computer-use/03-package-setup.json`.
- Deliverable: `docs/handoffs/computer-use/03-package-setup.json` with `status`, `package` (name, version, entry), `settings` (path, schema, defaults), `platforms` (per platform: support level, verification status, discovery sources), `runtimePlan` (shape, discovery order, override variables), `prerequisites` (checks and this Mac's results), `commands`, `unresolved`.
- Verify: `Run /codex-computer-use in a live pi session`; Inputs: `pi -e packages/pi-codex-computer-use/dist/index.js` then `/codex-computer-use`, `/codex-computer-use browser off`, `/codex-computer-use status`; Expected: status lists every prerequisite with ok/missing/unverified and the user action, `browser off` writes `browserUse: false`, the platform line reads `macOS (verified)`, and the command reports that no server is started yet in this version.
- Ends when:
  - [ ] All argument forms work with and without UI (`pi --mode json` or `-p` prints status).
  - [ ] The handoff file validates as JSON, names the exact module exports `03-mcp-bridge` will consume, and marks Windows as `implemented-unverified` and Linux as `unsupported`.
- Handoff: `docs/briefs/2026-10-05-feat-codex-cua-03-mcp-bridge.md` receives `docs/handoffs/computer-use/03-package-setup.json`.
- Replan when: pi's command context lacks `waitForIdle` or `ui.select` in the installed version; record the API gap and fall back to argument-only toggles.

## Side Effect Checkpoints
- [ ] `npm run build` still builds `packages/pi-codex-auto-review` unchanged (its `dist/index.js` digest is identical before and after).
- [ ] `npm run check` passes for the whole repository, including the new sources.
- [ ] Root `package-lock.json` gains only the new workspace and `@earendil-works/pi-mcp`; `npm audit --audit-level=high` reports no new vulnerability.
- [ ] Loading the extension without the Codex Desktop app (simulated with the override variables) registers the command and reports the missing app without throwing.
- [ ] No file under `CODEX_HOME` is created or modified by discovery or prerequisite checks (compare directory listings before and after).
- [ ] The built package has no import of `@buyong/pi-codex-auto-review` (`grep -r "pi-codex-auto-review" packages/pi-codex-computer-use/dist` returns nothing).

## Acceptance Criteria
- [ ] `npm run build` and `npm run check` exit 0 with the new package included.
- [ ] `pi -e packages/pi-codex-computer-use/dist/index.js` loads and `/codex-computer-use` shows prerequisites, platform status, and feature state; toggles persist to `~/.pi/agent/codex-computer-use/settings.json` with defaults `true`/`true`.
- [ ] On this Mac, discovery returns the plugin-cache `.mcp.json` plan; the simulated Windows cache yields a `win32` plan with Windows checks marked unverified; a simulated Linux platform yields `platform-unsupported`; a missing app on macOS yields `app-not-found` guidance naming the Codex Desktop app.
- [ ] The prerequisite report lists Codex subscription/login as user-owned items that the package cannot verify, and runs `setup.sh` successfully on this Mac.
- [ ] `docs/handoffs/computer-use/03-package-setup.json` exists with `status: "complete"`, the `RuntimePlan` contract, and the platform matrix.

## Open Questions
- None — the user fixed defaults (both on), platform scope (the macOS and Windows platforms Codex supports), and independence from auto-review; Windows live verification is a deferred technical gap recorded in the handoff.
