# Usage

**English** | [한국어](usage.ko.md)

This guide covers registering pi-codex-auto-review as a Pi extension and configuring the CLI, SDK, and policy files.

## Installing from npm

Install the npm package with Node.js 22.19 or later and Pi 0.99.1 or 1.0.0. Version `0.2.0` distributes the rule engine as JavaScript, replacing the native executables included through `0.1.4`. The extension requires no Rust compiler or platform-specific rule binary; Pi's own native modules are separate.

`0.1.4` includes English approval descriptions, `/scoped-models` integration, `/approve retry`, reapproval through ordinary user messages, and fixes for passing and restoring review context. The earlier `0.1.3` removed the sandbox and added the `/approve` and `/approve-model` settings commands.

```sh
pi install npm:@buyong/pi-codex-auto-review@0.2.2
pi list
pi remove npm:@buyong/pi-codex-auto-review
```

Add `--local` to register the package in the current project's `.pi/settings.json`. Project packages load after a trust decision for that project. Specifying a version pins the installation to that version.

Pi does not install a physical copy of the host SDK for managed extensions. The extension locates the host SDK through Pi's public path API, so no additional SDK copy or symbolic link is needed.

The earlier `Directory metadata scope is too large to qualify safely` error and startup delays came from sandbox directory inspection. The current source removes that execution path and the `@anthropic-ai/sandbox-runtime` dependency.

The extension can read the code and dependencies needed to run even inside the default installation directory, `.pi/agent/npm`. Agent settings and credential paths remain protected.

## Building from source

Source builds use TypeScript and require no Rust compiler or platform binary. Install development dependencies and build from the repository root. The official Pi SDK is installed from the committed npm lockfile; no `vendor` archive is needed. Follow the [publishing guide](publishing.md) to prepare an npm release package.

```sh
npm ci --ignore-scripts
npm run build
node packages/pi-codex-auto-review/dist/cli.js --help
```

## Registering as a Pi plugin

Register the built package directory, `packages/pi-codex-auto-review`, as a local package. Local paths load directly from their location without copying.

```sh
pi install ./pi-codex-auto-review/packages/pi-codex-auto-review
pi list
pi remove ./pi-codex-auto-review/packages/pi-codex-auto-review
```

- Registration connects local tools and official MCP tools to the approval path. Pi's default MCP extension is replaced to avoid duplicate connections.
- Extension registration alone does not guarantee protected startup. Pi can ignore extension loading failures. When approval protection must be ready at startup, use the CLI entry point below or the SDK's `createGuardedRuntime()`.
- Project instructions, settings, and MCP servers follow Pi's saved project trust decision and global `defaultProjectTrust`. Without a decision, project resources do not start. To explicitly trust the project for this run, use CLI `--trust-project` or SDK `isProjectTrusted: true`.

## CLI

```sh
node packages/pi-codex-auto-review/dist/cli.js --cwd /작업/디렉터리
node packages/pi-codex-auto-review/dist/cli.js --mode print "프로젝트를 분석해줘"
node packages/pi-codex-auto-review/dist/cli.js --mode rpc
node packages/pi-codex-auto-review/dist/cli.js --mode tui
```

Specify a registered external provider with `--extension`, and select both `--provider` and `--model`. Run from a shell with `OLLAMA_API_KEY` exported.

```sh
node packages/pi-codex-auto-review/dist/cli.js \
  --extension node_modules/pi-ollama-cloud/index.ts \
  --provider ollama-cloud --model glm-5.3 \
  --mode print "현재 프로젝트를 분석해줘"
```

| Option | Description |
| --- | --- |
| `--mode tui\|print\|json\|rpc` | Execution mode; defaults to TUI. Automatic review also works in print and JSON modes |
| `--cwd path` | Initial working directory |
| `--agent-dir path` | Pi resource directory. If omitted, uses `PI_CODING_AGENT_DIR`, then Pi's default resource directory |
| `--policy file` | Absolute path to a user-managed policy JSON file. Invalid settings block startup |
| `--trust-project` | Explicitly trusts the selected project for this run |
| `--extension path`, `-e` | Repeatable. Paths are relative to the directory where the command runs. The code directory is trusted and protected from model writes |
| `--provider provider --model model` | Must be specified together. Startup is rejected if no registered model matches. Do not put keys in command arguments |

## SDK

Use `createGuardedRuntime()` from `@buyong/pi-codex-auto-review/startup` when execution must refuse to start without approval controls. It checks extension and approval controller readiness and applies the same checks to mode reconnection and direct user shell calls.

```ts
import { createGuardedRuntime } from '@buyong/pi-codex-auto-review/startup';

const runtime = await createGuardedRuntime({
  cwd: process.cwd(),
  agentDir: '/사용자가/선택한/pi/자원/디렉터리',
});
try {
  await runtime.session.prompt('프로젝트를 분석해줘');
} finally {
  await runtime.dispose();
}
```

| Option | Description |
| --- | --- |
| `cwd`, `agentDir` | Initial directory and Pi resource directory |
| `settings` or `settingsPath` | Execution policy in the same format as the policy file |
| `isProjectTrusted` | Explicit project trust. If unspecified, follows Pi's trust decision and global `defaultProjectTrust`. Later directory changes follow each directory's saved trust decision |
| `model` or `modelSelection` | A model object or `{provider, id}` selection. These cannot be used together |
| `trustedExtensionPaths` | Trusted extension entry files, loaded through Pi's public loader. The entire containing directory is protected from model writes, including relative imports |
| `profile` | Directly supplies an SDK profile, including `readOnlyPaths`. Required control and authentication path protection also applies |
| `mcp: false`, `mcpToolPolicies` | Disables MCP connections, or configures `approvalMode` by `server/tool` key |

The protected entry point disables automatic extension discovery. Tools outside the known set are blocked unless they have a trusted adapter.

## Policy file

Specify a policy with `--policy` or SDK `settings` or `settingsPath`.

A normal Pi installation uses `<agentDir>/guard/settings.json`. Choose **Approve for me** or **Ask for approval** in `/approve`. The screen uses the English descriptions from [Codex's official approval picker](https://learn.chatgpt.com/docs/security-administration) and wraps the selected description on narrow terminals. Command descriptions, selection screens, status text, and fixed approval dialog text are in English.

`/approve-model` shows only available models in Pi's current `/scoped-models` scope. Without a configured scope, it shows all available models, as Pi does. If every scoped model is unavailable, it does not expand to the full list. A model removed from the scope while the picker is open is not saved; existing settings are preserved.

**Use current Pi model** corresponds to `reviewModel: null` and uses the current main model for review instead of a secondary model. Selecting a secondary model does not change the main model. Esc cancels without saving. When `settingsPath` is specified, the menus also save to that file.

```json
{
  "mode": "workspace-write",
  "approvalPolicy": "on-request",
  "approvalsReviewer": "auto_review",
  "reviewModel": null,
  "ruleFiles": [],
  "commandRules": [
    {"prefix": ["git", "status"], "decision": "allow"},
    {"prefix": ["git", "push"], "decision": "deny"}
  ],
  "allowedDomains": [],
  "reviewTimeoutMs": 20000,
  "approvalTimeoutMs": 60000,
  "executionTimeoutSeconds": 120
}
```

| Field | Default | Description |
| --- | --- | --- |
| `mode` | `workspace-write` | `read-only` or `workspace-write` |
| `approvalPolicy` | `on-request` | `"on-request"`, `"never"`, or `{"sandbox": true, "rules": false, "mcp_elicitations": true}`. The `sandbox` key names the general approval category for compatibility with existing files; it does not mean OS isolation. Omitted `mcp_elicitations` is not allowed. `never` and disabled categories block requests without review |
| `approvalsReviewer` | `auto_review` | `"user"` selects user review |
| `reviewModel` | `null` | A registered model to use instead of the current model (`{"provider": "ollama-cloud", "id": "glm-5.3"}`). Register the provider first |
| `ruleFiles` | `[]` | Paths to the rule files described below |
| `commandRules` | `[]` | Literal argument prefix rules (`allow`, `ask`, `deny`) |
| `allowedDomains` | `[]` | Allowed domain patterns |
| `trustedTools` | `[]` | Additional tool names allowed outside the known set |
| `reviewTimeoutMs`, `approvalTimeoutMs`, `executionTimeoutSeconds` | 20000, 60000, 120 | Reviewer and approval dialog timeouts are in milliseconds; shell timeout is in seconds |
| `reviewPolicy`, `reviewMaxRounds`, `reviewMaxOutputTokens`, `reviewContextChars` | `null`, 4, 2048, 60000 | Replaces the reviewer's organization policy section. Risk assessment, source distinction, and outcome criteria remain intact |
| `writableRoots` | `[]` | Additional writable roots |
| `excludeSlashTmp`, `excludeTmpdir` | `false` | Excludes the default temporary paths (`/tmp`, `os.tmpdir()`) from allowed writes |
| `projectDocMaxBytes`, `projectDocFallbackFilenames`, `projectRootMarkers` | 32768, `[]`, `null` | Combined project instruction limit, fallback filenames, and root markers (`null` means `.git`; `[]` disables parent traversal) |

## Rule files

The TypeScript engine evaluates `.rules` files in `ruleFiles` using contracts ported from Codex revision `a956835d020762cb2b570053af06f643a11c0ecc`. Captured outputs from the former native engine are replayed in the [parity tests](../test/unit/execpolicy-parity.test.mjs).

Evaluation exposes only Starlark values and policy functions, with no host file or network functions or JavaScript `eval`. Input/output size, execution steps, collection size, nesting, and evaluation time are bounded. The asynchronous API uses a cancellable Node.js worker; the synchronous API uses a bounded Node.js process. Invalid or unsupported input and exhausted budgets reject the rules. Without rule files, startup needs neither an evaluation worker nor an external executable.

- Supports Starlark functions, conditionals, comprehensions, string interpolation, `prefix_rule`, `host_executable`, `network_rule`, and `match` and `not_match` validation.
- Applies the strongest matching rule to compound commands.
- As in Codex's network rule conversion, protocol labels are merged into host allow and deny lists rather than separate protocol permissions.
- Shell syntax that cannot be interpreted requires review unless a trusted full-command rule allows it.
- `curl` and `wget` require review when the destination is not an explicit HTTP URL or comes from a separate configuration file. Omitting the scheme or supplying the URL through a configuration file does not bypass general approval review.
- Trusted `allow` rules can broaden permissions for matching commands; limit them to the commands that need them.

## Behavior details

### Command review and approval

- Approved tools run through Pi's original SDK executor. The final shell command, working directory, environment, timeout, and cancellation signal are preserved.
- File access outside the normal scope, explicit approval requests, review rules, and commands that cannot be interpreted are reviewed before execution.
- `additional_permissions` describes the scope to review. Approved commands run with host permissions; the scope is not enforced as an OS access restriction. The extension does not intercept network destinations during execution or create a separate proxy.
- TUI and RPC approval dialogs offer one-time, session, and saved-rule approval. Full-command permissions can be approved only once. Saved approvals bind to the exact tool, input, working directory, invocation path, policy, and permissions. Policy changes invalidate existing approvals.
- Direct shell commands entered later by the user are evaluated independently even if repeated denials stopped the model's task.

### Automatic reviewer

- Uses the current model by default; `reviewModel` can select another registered model.
- Preserves the sources and chronology of accumulated user instructions and instructions supplied by Pi. Tool results are execution evidence. The outer `user` message sent to the review API and user-role messages generated by extensions do not themselves grant authorization.
- Investigation is limited to read-only file and directory tools.
- Stops the actual Pi task after three consecutive denials or ten denials in the latest fifty reviews.
- Errors and timeouts never become approvals. Invalid risk or authorization level responses are also treated as review failures.
- `/approve` configures the approval method; `/approve-model` selects the secondary model. Changes apply immediately after saving and invalidate pending reviews and saved approvals from the previous policy.
- After reading a denial reason, the user can authorize the exact operation, target, and content to send in an ordinary message. The next review receives the latest authorization and new facts; no special command is needed. If the user withdraws authorization or requests another target, review is based on the current instructions and actual operation.
- `/approve retry` lets the user select one exact operation from up to ten recent automatic review denials. Selecting it after checking the target, input, and denial reason triggers one new review of the same operation in the same context. It does not automatically allow the operation or grant session approval. A previous `critical` assessment can be reevaluated, but an operation still assessed as `critical` or subject to an explicit absolute denial remains blocked. The authorization marker does not apply to changed inputs or stale context.
- A custom `reviewPolicy` replaces only the original organization policy section. Strings such as `{{ extra_policy }}` inside the policy are preserved literally. Risk and authorization criteria are not replaced.
- Actual model responses must use the structured `outcome` assessment. The existing `decision` interface of a `ReviewProvider` explicitly injected through the SDK remains for compatibility; actual Pi models cannot use that path.
- Review input includes the current approval policy, path and domain scope, final execution arguments, linked tool calls and results, and the actual approval dialog's questions and answers. Shell environment evidence includes explicit non-secret values and the names of omitted variables; it is not described as the full process environment.
- Final prepared calls, results, review assessments, and user confirmations are saved in Pi session custom records for extension reloads and active branch restoration. Audit logs still omit raw arguments. Large evidence is limited with omission markers. If user authorization and the full current review target exceed the budget, execution is not automatic.
- A statement from an ordinary tool that “the user approved” is evidence. Only answers observed by the protected adapter through actual Pi `select`, `confirm`, and `input` APIs are recorded as user confirmations with their questions. Answers to questions marked as password or API key input are masked in the record.

### Context files

- Automatically discovers global instructions in `agentDir` and project instructions from the project root to the current directory.
- In each directory, chooses `AGENTS.override.md`, then `AGENTS.md`, then `projectDocFallbackFilenames`.
- Rejects aliases pointing to protected files and does not treat filenames in tool output as instruction sources. Untrusted projects are excluded. Files are reread on refresh.

### MCP

- Uses servers registered in Pi, `agentDir/mcp.json`, and trusted projects' `.pi/mcp.json`. Mode reconnection closes existing connections and creates new ones.
- Final execution approval binds to the server's actual tool registration. Changes to registration during review, or cancellation, prevent execution.
- The normal path follows Codex's annotation precedence and approval modes regardless of reviewer type. Strict review requests, sensitive operations, and required user input need fresh approval; read-only annotations and previous approvals cannot skip it.
- The model does not approve `codex_requires_user_input` on the user's behalf. Empty approval forms are handled, but ordinary forms with input fields and URL authentication requests are rejected by this adapter.
- The same approval rules apply to the `node_repl/js` name. Additional approval requests bind to the original live call's tool, connection, and actual input. Requests naming another tool or connector instead are rejected.

### Execution scope

- Review input paths are normalized literally, without conversion to separate OS permission patterns.
- The extension does not exhaustively scan directory trees or hard links at startup or before tool execution.
- Direct tool paths and protected paths in interpretable commands are rejected before approval. Indirect access inside approved interpreters, hard-link aliases, and network changes during execution are not isolated.

## Ollama Cloud verification in Docker

### Preparation

- Run from the repository root with the Docker engine running. No local Ollama server is installed.
- The image pins Node 24.14.0, Pi 0.99.1, `pi-ollama-cloud` 0.12.2, and `fd` 10.3.0. It does not mount host directories or sockets or publish ports, and retains Docker's default security restrictions.
- Only the initial image build requires network access. Verification containers run without a network.

### Verification without keys

```sh
npm run verify:docker -- --mode offline --platform linux/amd64
```

For a separate ARM64 result on an ARM Docker host, run with `--platform linux/arm64`.

### Live model verification

Export `OLLAMA_API_KEY` in the shell that will run verification. Do not put the key in command arguments, image build arguments, or `auth.json`. Actual calls may consume account usage.

```sh
export OLLAMA_MODEL=glm-5.3
npm run verify:docker -- --mode live --platform linux/amd64
npm run verify:docker -- --mode conformance --platform linux/amd64
```

- `live` checks external-path writes by the actual main agent and reviewer.
- `conformance` checks allowed operations, external-path approvals, protected-path blocks, policy denials, and provider selection approval in the distributed CLI.
- Each case limits model calls, time, and output, and disables automatic provider retries. The observation extension records only call counts and selected models; it does not replace responses. Web tools and usage queries are disabled.
- Missing keys, unsupported models, service errors, and isolation errors are not treated as success.
- Supply the output's `imageDigest` through `--image` to reuse an existing image with matching source and architecture. After source changes, rebuild without `--image`.
