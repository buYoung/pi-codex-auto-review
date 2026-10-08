# Automatic review usage

**English** | [한국어](usage.ko.md)

Use this guide to install `@buyong/pi-codex-auto-review`, choose an approval method, run with protected startup, and configure policies. It describes the current checkout; a published npm release may not yet include every source change. Other workspace extensions have their own guides linked from the [README](../README.md#workspace-packages).

## Installing from npm

You need Node.js 22.19 or later, Pi 0.99.1 or 1.0.0, and access to a Pi model. The JavaScript rule engine requires no Rust compiler or platform-specific rule binary.

```sh
pi install npm:@buyong/pi-codex-auto-review
pi list
pi
```

In Pi, configure model access with `/login` if needed. Run `/approve` to choose an approval method, then ask Pi to read and summarize a project file. Ordinary in-scope calls can run directly; calls requiring approval use your selected method.

- Add `--local` to install in the current project's `.pi/settings.json`. Pi loads project packages only after the project trust decision.
- Append `@<version>` to pin an npm release. An unversioned source installs the latest published release.
- Pi supplies the host SDK to managed extensions. Do not add a second SDK copy or symbolic link to the managed package.
- Remove an installation with `pi remove <source>`, using the source shown by `pi list`. Use `--local` when removing a project-scoped entry.

Normal extension registration connects the guarded local tools and the guarded MCP adapter. It replaces Pi's built-in MCP extension to avoid duplicate connections. **Registration is not a protected-startup guarantee:** Pi can report an extension loading failure and continue. Use the [CLI or SDK](#run-with-protected-startup) when approval controls must be ready before execution.

## Choose an approval method and review model

Run `/approve` in a TUI session, or in RPC with a client that answers Pi UI requests:

| Choice | What changes |
| --- | --- |
| **Approve for me** | Uses automatic model review for calls requiring approval; the default |
| **Ask for approval** | Uses user review for those calls; ordinary policy-allowed calls still run directly |
| **Full Access** | After confirmation, skips approval and all path, command, and network restrictions |

The first two choices persist. **Full Access is never saved** and lasts until Pi exits or you choose another approval mode. It also bypasses otherwise absolute path and command denials. Cancelling the confirmation returns to the picker without enabling it. Policy enforcement, approval reuse, and MCP review described below assume Full Access is off.

Run `/approve-model` to search available models in Pi's current `/scoped-models` scope, plus Codex's approval review model `codex-auto-review`. Selecting a reviewer does not change the main conversation model. **Use current Pi model** sets `reviewModel: null`.

- Without a model scope, the picker shows all available models.
- If every scoped model is unavailable, it does not expand to the full list.
- `codex-auto-review` appears as **Codex Auto Review (openai free)** and **Codex Auto Review (openai-codex)** for each of those providers that has credentials and lists `gpt-5.6-luna`. It reuses that model's endpoint and limits. Pi's `/model` does not list it, so it appears regardless of the model scope.
- A model removed from the scope while the picker is open is not saved.
- Esc preserves the existing settings. Fixed UI text is in English.

Selections save to `<agentDir>/guard/settings.json`, or to an explicit `settingsPath`. Menu changes apply after saving and invalidate pending reviews and exact-action grants from the previous policy. For manual policy-file edits, reload the extension with `/reload` or restart the guarded runtime.

## Building from source

Run from the repository root. The committed npm lockfile supplies the development SDK; no repackaged `vendor` SDK is needed.

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex-auto-review
node packages/pi-codex-auto-review/dist/cli.js --help
```

Turborepo builds `@buyong/redact` before automatic review. Use `npm run build` without a filter to build all workspace packages.

To register the built automatic-review package permanently, run from the same repository root:

```sh
pi install ./packages/pi-codex-auto-review
pi list
```

Pi loads a local package directly from its path, without copying it. Rebuild after source changes, then reload or restart Pi. Do not also enable an npm installation of the same extension.

## Run with protected startup

The guarded CLI and `createGuardedRuntime()` check extension and controller readiness. They reject Pi versions other than **0.99.1 and 1.0.0** with `UNSUPPORTED_PI`, regardless of the broader manifest peer range. They also check readiness after mode reconnection and for direct user shell calls.

These entry points disable automatic extension discovery. Load any additional extension explicitly and treat its code as trusted. Other extension tools do not automatically gain an approval gate; local shell/file tools and the guarded MCP adapter retain theirs.

Project instructions, settings, and MCP servers follow Pi's saved trust decision and global `defaultProjectTrust`. Without saved or explicit trust, project resources do not start. `--trust-project` or SDK `isProjectTrusted: true` trusts the initial project for this run; later directory changes use each directory's own trust record.

### CLI

After the source build above, run from the repository root. Replace `/absolute/path/to/project` with your project directory:

```sh
node packages/pi-codex-auto-review/dist/cli.js --cwd /absolute/path/to/project
```

For a one-shot response instead of the terminal UI:

```sh
node packages/pi-codex-auto-review/dist/cli.js --mode print "Read the README and summarize how to run this project. Do not change files."
```

The CLI uses your configured Pi model and credentials. `print` returns text; `json` returns JSONL events; `rpc` runs the Pi RPC interface. Automatic review works without a UI, but a call that needs user approval is not executed when no approval UI is available.

| Option | Behavior |
| --- | --- |
| `--mode tui\|print\|json\|rpc` | Selects the interface; defaults to `tui` |
| `-p` | Shorthand for `--mode print` |
| `--cwd path` | Initial project directory; defaults to the invocation directory |
| `--agent-dir path` | Pi resource directory; defaults to `PI_CODING_AGENT_DIR`, then `~/.pi/agent` |
| `--policy file` | Policy JSON file; must exist and validate. Relative paths resolve from the invocation directory. |
| `--trust-project` | Trusts the initial project for this run |
| `--extension path`, `-e path` | Repeatable trusted extension paths, resolved from the invocation directory. The containing code directory is protected from model writes. |
| `--provider provider --model model` | Selects an exact registered provider/model pair. Specify both; an unavailable model blocks startup. |
| `--` | Ends option parsing so the prompt can start with `-` |

This wrapper accepts only its own options, not every option of the standard `pi` CLI. An ordinary npm installation also exposes the `pi-codex-auto-review` executable; a Pi-managed package installation does not guarantee that executable is on your shell's `PATH`.

For an external provider, explicitly load its registration extension. The repository includes `pi-ollama-cloud` as a development dependency. With `OLLAMA_API_KEY` already exported in the invoking shell:

```sh
node packages/pi-codex-auto-review/dist/cli.js \
  --extension node_modules/pi-ollama-cloud/index.ts \
  --provider ollama-cloud --model glm-5.3 \
  --mode print "Read the README and summarize this project. Do not change files."
```

Use a model available to your account. This makes real provider calls and may consume usage. Do not pass credentials in command arguments.

### SDK

For an application outside this checkout, install the extension and matching Pi host packages in that application's directory:

```sh
npm install @buyong/pi-codex-auto-review \
  @earendil-works/pi-coding-agent@0.99.1 \
  @earendil-works/pi-ai@0.99.1 \
  @earendil-works/pi-tui@0.99.1
```

Use the public `startup` export in an ESM application. The example selects your existing Pi resources and credentials, prints the final response, and disposes the runtime:

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createGuardedRuntime } from '@buyong/pi-codex-auto-review/startup';

const runtime = await createGuardedRuntime({
  cwd: process.cwd(),
  agentDir: process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi', 'agent'),
});
try {
  await runtime.session.prompt('Read the README and summarize this project. Do not change files.');
  console.log(runtime.session.getLastAssistantText());
} finally {
  await runtime.dispose();
}
```

| Option | Behavior |
| --- | --- |
| `cwd`, `agentDir` | Required initial project and Pi resource directories |
| `settings` | Default policy values; values in the stored settings file override them |
| `settingsPath` | Explicit policy file. Unlike the default path, a missing file blocks startup. |
| `isProjectTrusted` | Optional trust choice for the initial project |
| `model` or `modelSelection` | A model object or `{ provider, id }`; cannot be used together |
| `trustedExtensionPaths` | Extension entry paths, resolved from the initial `cwd`. Protects the containing directories, including sibling imports. |
| `profile` | Custom permission profile, including `readOnlyPaths`. Required guard control/rule-file and extension-code protection still applies. |
| `mcp` | MCP extension options; `false` disables the guarded MCP adapter |
| `mcpToolPolicies` | `approvalMode` overrides keyed by `server/tool` |
| `modelRuntime`, `settingsManager`, `sessionManager` | Optional Pi services and session storage supplied by the embedding application |
| `trustedExtensions`, `externalExtensions` | Explicit inline integrations; the caller owns trust in their code |

The SDK starts without an approval UI. Automatic reviews can still approve calls; user-review requests need a suitable bound interface or are declined. If you supply a `settingsManager`, an explicit trust choice must agree with that manager.

## Policy file

Normal Pi installations read `<agentDir>/guard/settings.json`. The CLI's `--policy` and SDK's `settingsPath` select another file. Create an explicit file before startup. Missing keys use defaults; unknown keys and invalid values reject the file. SDK `settings` supplies defaults only: a stored file takes precedence, without deep-merging nested objects.

This example keeps default approval behavior and adds two command rules:

```json
{
  "mode": "workspace-write",
  "approvalPolicy": "on-request",
  "approvalsReviewer": "auto_review",
  "reviewModel": null,
  "commandRules": [
    {"prefix": ["git", "status"], "decision": "allow"},
    {"prefix": ["git", "push"], "decision": "deny"}
  ]
}
```

### Approval and scope settings

All scope and denial rules below assume **Full Access is off**.

| Field | Default | Behavior |
| --- | --- | --- |
| `mode` | `"workspace-write"` | Ordinary workspace/temporary writes are allowed. `"read-only"` sends writes through review; an approved write can still run. |
| `approvalPolicy` | `"on-request"` | Allows review when needed. `"never"` blocks calls that need approval, but does not block policy-allowed calls. Category settings are described below. |
| `approvalsReviewer` | `"auto_review"` | `"user"` requests user review |
| `reviewModel` | `null` | Current model, or a registered `{ "provider": "...", "id": "..." }` pair |
| `commandRules` | `[]` | Literal argument-prefix rules with `allow`, `ask`, or `deny` decisions |
| `ruleFiles` | `[]` | Rule-file paths, resolved from the working directory |
| `allowedDomains` | `[]` | Host patterns for interpreted network commands. `*.example.com` matches subdomains, not `example.com`. No OS network restriction is created. |
| `writableRoots` | `[]` | Additional ordinary writable roots, resolved from the working directory |
| `excludeSlashTmp` | `false` | Removes `/tmp` from the default writable roots |
| `excludeTmpdir` | `false` | Removes `os.tmpdir()` from the default writable roots; both exclusions may be needed when paths overlap |
| `trustedTools` | `[]` | Compatibility field; other extension tools no longer need to be listed |

`approvalPolicy` can instead enable individual categories:

```json
{
  "approvalPolicy": {
    "sandbox": true,
    "rules": false,
    "mcp_elicitations": true
  }
}
```

`sandbox` is the compatibility name for general approval requests, **not OS isolation**. `rules` controls rule-requested approval and `mcp_elicitations` controls MCP approval requests. `sandbox` and `rules` are required in this object; omitted `mcp_elicitations` is disabled. A disabled category blocks the request without model or user review.

### Review limits and project instructions

| Field | Default | Behavior |
| --- | --- | --- |
| `reviewTimeoutMs` | `20000` | Automatic-review deadline in milliseconds |
| `approvalTimeoutMs` | `60000` | Approval-dialog deadline in milliseconds |
| `executionTimeoutSeconds` | `120` | Guarded shell fallback timeout in seconds; caller-supplied timeouts take precedence |
| `reviewPolicy` | `null` | Optional replacement for the reviewer's organization policy section. Risk, source-trust, and outcome criteria remain. |
| `reviewMaxRounds` | `4` | Reviewer model rounds, including investigation; integer from 1 to 16 |
| `reviewMaxOutputTokens` | `2048` | Reviewer output limit; integer from 1 to 16384 |
| `reviewContextChars` | `60000` | Review-context character budget; integer from 1 to 500000 |
| `projectDocMaxBytes` | `32768` | Combined project-instruction byte budget; integer from 0 to 1000000 |
| `projectDocFallbackFilenames` | `[]` | Instruction filenames tried after `AGENTS.override.md` and `AGENTS.md` |
| `projectRootMarkers` | `null` | Uses `.git` as the root marker. A list replaces it; `[]` disables parent traversal. |
| `redaction` | Four empty lists | Additions to mandatory reviewer masking; see [reviewer redaction](#reviewer-redaction) |

The guard discovers global instructions in `agentDir` and trusted project instructions from the root to `cwd`. In each directory it chooses `AGENTS.override.md`, then `AGENTS.md`, then a configured fallback. Protected-file aliases are rejected; filenames mentioned in tool output do not become instruction sources. Refresh rereads the files.

## Rule files

The TypeScript engine evaluates `.rules` contracts ported from Codex revision `a956835d020762cb2b570053af06f643a11c0ecc`. [Parity tests](https://github.com/buYoung/pi-codex-auto-review/blob/master/test/unit/execpolicy-parity.test.mjs) replay captured outputs from the former native engine; they do not prove equivalence for every Starlark program.

For example, create a user-managed rule file containing:

```python
prefix_rule(["git", "status"], decision="allow")
prefix_rule(["git", "push"], decision="forbidden")
```

Add its path to `ruleFiles` in your policy and reload or restart. JSON `commandRules` uses `ask`/`deny`; `.rules` uses `prompt`/`forbidden` for those decisions.

- Supports Starlark functions, conditionals, comprehensions, string interpolation, `prefix_rule`, `host_executable`, `network_rule`, and `match`/`not_match` validation.
- Exposes Starlark values and policy functions, not host file/network functions or JavaScript `eval`.
- Bounds input/output, evaluation steps, collection size, nesting, and time. Invalid input, unsupported syntax, or exhausted limits rejects evaluation.
- Uses a cancellable Node.js worker for asynchronous evaluation and a bounded Node.js child process for the synchronous API. No evaluator starts when no rule files are configured.
- Uses the strongest matching decision for compound commands. Network protocol labels merge into host allow/deny lists, not separate protocol permissions.
- Requires review for uninterpretable shell syntax unless a trusted full-command rule allows it.
- Reviews `curl`/`wget` when the destination is not an explicit HTTP URL or comes from a separate configuration file.

**Keep `allow` rules narrow.** They can authorize matching commands beyond ordinary scope, but cannot override absolute denials while Full Access is off.

## What happens during review

### Exact-action approvals and execution

Approved local tools use Pi's original executor with the final command, working directory, environment, timeout, cancellation signal, and caller options preserved. `additional_permissions` describes the scope to review; it does not enforce that scope during execution.

TUI/RPC approval dialogs offer **Allow once**, **Allow for this session**, and **Save as an allow rule**. Whole-command escalation approvals are one-use only. Other exact-action grants bind to the tool, input, working directory, invocation source, policy, and permissions. Policy or scope changes invalidate those grants.

Eligible MCP tools and skill scripts can reuse a separate package approval:

- MCP fingerprints include server configuration, initialization identity/version, and the tool definition.
- Skill fingerprints include files in the directory containing `SKILL.md`. Only a single `<script>` or `<interpreter> <script>` command qualifies; symbolic-link-containing skills are not cached.
- Automatic approvals and **Save as an allow rule** persist in `<agentDir>/guard/package-approvals.json`. **Allow for this session** is session-only; **Allow once** is not reused.
- Changed content is reviewed again. Additional paths/domains, escalation, rule prompts, strict MCP review, and required user input always require a fresh decision.

### Denials, errors, and retries

The reviewer uses read-only file/directory investigation tools. It distinguishes user authorization and Pi instructions from tool evidence and extension-generated messages; a tool result saying “the user approved” is not authorization.

Three consecutive denials, or ten denials in the latest fifty reviews, stop the actual model task. Provider failures, invalid output, timeouts, and cancellation do not become approvals. Direct shell commands subsequently entered by the user are evaluated independently.

After a denial, you can send an ordinary message authorizing the exact operation, target, and content to send. The next review uses the latest instructions. To retry one recent denial explicitly, run `/approve retry`, inspect the displayed input and reason, and select it. The picker retains up to ten recent automatic denials.

A retry triggers **one new review**, not an automatic allow or session grant. The marker applies only to the same action and live context. A previous `critical` assessment can be reconsidered, but a fresh `critical` assessment or an absolute policy denial still blocks execution.

### Evidence and session records

Review input includes current policy, path/domain scope, final execution arguments, linked calls and results, and observed approval-dialog questions and answers. Environment evidence includes explicit non-secret values and the names of omitted variables, not the complete process environment.

The guard saves review evidence and assessments in Pi session custom records for reloads and active-branch restoration. Large evidence is bounded with omission markers. If required authorization and the complete current target do not fit the budget, execution is not automatic. Audit records are stored in `<agentDir>/guard/audit.jsonl` and omit raw tool arguments.

Only confirmations observed through the protected Pi `select`, `confirm`, and `input` adapters count as recorded user confirmations. Password/API-key answers are masked. Actual Pi models must return the structured `outcome` assessment; the legacy `decision` response is supported only for explicitly injected SDK `ReviewProvider` implementations.

### Reviewer redaction

Reviewer-bound context, investigation output, user authorization, and request data pass through [`@buyong/redact`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/redact/README.md). This masking cannot be disabled.

Built-in and compatibility rules mask provider tokens, authorization values, URL passwords, webhook paths, PEM private keys, sensitive assignments, and legacy `SYNTHETIC_` markers. Session/context/call/item identifiers and binding digests retain their original values.

If an action contains a detected value, the reviewer receives a masked copy and `redactedActionFields` containing JSON paths and rule IDs, not values. Masking alone does not force denial or a user prompt. Approval binding and execution use the **original action**, so masking is not a mechanism for preventing the approved command from sending a secret.

Masking occurs before evidence budgets and excerpts. New redaction settings apply to subsequently added evidence; stored evidence remains as recorded. Detection can miss unsupported formats or mask harmless values. Review logs before sharing them.

| `redaction` key | Entry | Effect |
| --- | --- | --- |
| `sensitiveFields` | Field name | Masks the value of a matching field; names are compared after keeping letters/digits and lowercasing |
| `rules` | `{ "id": "custom.name", "pattern": "...", "flags": "i" }` | Adds a JavaScript RegExp rule. A `(?<secret>…)` group masks only that group. Flags may contain `i`, `m`, `s`, and `u`. |
| `exceptions` | `{ "ruleId": "...", "value": "..." }` | Keeps one exact value visible for one rule; another matching rule can still mask it |
| `piiEntities` | Entity name, such as `EMAIL_ADDRESS` | Enables local personal-information detection; off by default |

```json
{
  "redaction": {
    "sensitiveFields": ["sessionKey"],
    "rules": [{"id": "custom.acme", "pattern": "ACME_[A-Z0-9]+"}],
    "exceptions": [{"ruleId": "custom.acme", "value": "ACME_EXAMPLE"}],
    "piiEntities": ["EMAIL_ADDRESS"]
  }
}
```

Invalid entries cause `INVALID_SETTINGS`; redaction validation errors name the key/index without repeating the pattern or value. Versions without this setting reject files containing it with `Unknown setting: redaction`. Back up the policy and remove the key before downgrading to such a version.

## MCP approvals

The adapter uses servers registered with Pi, `<agentDir>/mcp.json`, and trusted projects' `.pi/mcp.json`. Mode reconnection closes old connections and creates new ones. Approval binds to the actual server/tool registration; a registration change during review or cancellation prevents execution.

SDK `mcpToolPolicies` selects an approval mode for a `server/tool` key:

| Mode | Normal approval behavior |
| --- | --- |
| `auto` | Uses annotation precedence: destructive calls require review; otherwise read-only calls skip review, and missing destructive/open-world hints default to review |
| `prompt` | Always reviews |
| `writes` | Skips review only when `readOnlyHint` is `true` |
| `approve` | Skips normal review |

Strict review, sensitive operations, and required user input override these normal skip paths. `codex_requires_user_input` is not approved by the model on your behalf. The adapter handles empty approval forms but rejects ordinary forms with input fields and URL authentication requests.

The same rules apply to `node_repl/js`. Additional approval requests must match the original live call's tool, connection, and input; they cannot name another tool or connector instead. Already-dispatched cancellation depends on the external server.

## Execution limits

- Paths are normalized literally; they are not converted into OS permission patterns.
- Direct protected paths and protected paths in interpretable commands are denied before review, unless Full Access is enabled.
- Startup and execution do not scan every directory tree or hard-link alias.
- Indirect access inside approved interpreters and destination changes during execution are not isolated. There is no network proxy or OS sandbox.
- Trusting an extension protects its containing code directory from model writes, not every dependency it might import elsewhere.

See the [verification matrix](testing/auto-review-protection.md) for current checks and clearly separated historical sandbox results.

## Ollama Cloud verification in Docker

Run these commands from the repository root with Docker running. They verify the automatic-review package, not every workspace extension. No local Ollama server is installed.

The image pins Node.js 24.14.0, Pi 0.99.1, `pi-ollama-cloud` 0.12.2, and `fd` 10.3.0. Containers run as a non-root user, drop capabilities, enable `no-new-privileges`, and use Docker's default seccomp/AppArmor behavior. They do not mount host directories/sockets or publish ports. These are **verification-container controls**, not protection added to normal Pi execution.

### Verification without keys

```sh
npm run verify:docker -- --mode offline --platform linux/amd64
```

Image building needs network access; the offline container uses `--network none`. For a separate ARM64 result, use `--platform linux/arm64`. Reports distinguish native from emulated execution.

### Live model verification

Export `OLLAMA_API_KEY` in the invoking shell through your normal credential setup. Do not put it in command arguments, build arguments, or `auth.json`. Actual calls may consume account usage. Select a model available to your account:

```sh
export OLLAMA_MODEL=glm-5.3
npm run verify:docker -- --mode live --platform linux/amd64
npm run verify:docker -- --mode conformance --platform linux/amd64
```

**Live and conformance containers use bridge networking**, unlike offline verification. The API key is passed only at runtime.

- `live` checks actual main-agent/reviewer behavior for external-path writes.
- `conformance` checks allowed operations, external-path approval, protected-path blocks, policy denials, and CLI provider selection.
- Cases bound model calls, time, and output; disable provider retries, web tools, and usage queries; and observe calls without replacing responses.
- Missing keys/models, provider errors, and failed environment checks are not passes.
- Reuse a matching image with `--image` and the output's immutable `imageDigest`. Source or architecture mismatches reject reuse; rebuild after source changes.

Reports are stored under `.reports/pi-guard/runs/<run ID>/<platform>/`. The script exports evidence and removes its owned container; inspect a reported cleanup failure rather than treating it as success.
