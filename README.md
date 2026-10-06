# pi-codex-auto-review

**English** | [한국어](README.ko.md)

Automatic execution approval review for [Pi](https://pi.dev), inspired by Codex's **Approve for me**. The extension checks tool calls against local rules, asks a review model to assess operations that need approval, and offers user approval when required. Approved calls run through Pi's original executor.

**This is an approval assistant, not an OS sandbox.** Approved commands run with the host's permissions. The extension does not isolate files, processes, or network access.

This repository also contains Computer Use, Fast mode, image generation, a redaction library, and a combined Pi package. See [workspace packages](#workspace-packages) to choose a package.

## Requirements

| Component | Requirement |
| --- | --- |
| Node.js | 22.19 or later |
| Pi for automatic review | 0.99.1 or 1.0.0. The guarded CLI and SDK reject other host versions, even though the manifest declares a broader peer range. |
| Model access | A configured Pi provider and model. Automatic review uses the current model unless you select another one. |
| Rule engine | JavaScript compiled from TypeScript. No Rust compiler or platform-specific rule binary is required. Pi's own native dependencies are separate. |

These documents describe the current checkout. An npm installation uses the published release, which may differ from unreleased source changes.

## Install and try automatic review

Install the latest published automatic-review package:

```sh
pi install npm:@buyong/pi-codex-auto-review
pi list
pi
```

In Pi:

1. Configure model access with `/login` if needed, then select your conversation model.
2. Run `/approve` and choose **Approve for me**.
3. Ask Pi: `Read this project's README and summarize how to run it. Do not change files.`

Pi should return a summary. Calls within the ordinary policy scope can run directly; calls that need approval go through the selected review method. Use `/approve-model` to choose a separate reviewer without changing the conversation model.

Add `--local` to `pi install` for a project-scoped installation. Project packages load only after Pi trusts that project. To pin a release, append `@<version>` to the npm package name. If you previously installed the unscoped `pi-codex-auto-review`, remove that source before installing the scoped package.

**Need to refuse startup when approval controls fail to load?** Use the [guarded CLI or SDK](docs/usage.md#run-with-protected-startup). Normal Pi extension loading can report a failure and continue without the extension.

## Choose how approvals work

| `/approve` choice | Behavior | Persistence |
| --- | --- | --- |
| **Approve for me** | A model reviews calls that require approval. This is the default. | Saved |
| **Ask for approval** | You review calls that require approval. It does not prompt for every ordinary read or workspace write. | Saved |
| **Full Access** | Skips approval and path, command, and network restrictions after confirmation. | Until Pi exits or you choose another approval mode; never saved |

Settings are stored in `<agentDir>/guard/settings.json`, or the policy file selected through the CLI or SDK. `agentDir` normally means `~/.pi/agent` and honors `PI_CODING_AGENT_DIR`. Cancelling a picker preserves the existing settings. Fixed command, picker, and approval-dialog text is in English.

## What the extension protects

With **Full Access off**:

- `workspace-write` allows ordinary writes in the workspace and default temporary directories. `read-only` sends writes through approval review instead.
- Guard control files, the selected policy file, and rule files are hidden from guarded reads and protected from writes. The extension's own code and explicitly trusted extension code directories are protected from model writes.
- Writes to project `.git`, `.agents`, `.codex`, `.aws`, and `.pi` metadata require review rather than an unconditional block. Project `.pi/guard` remains write-protected.
- Absolute denials run before model review and saved approvals. Review errors, timeouts, and cancellations never become approvals.
- Exact-action approvals bind to the tool, input, execution context, policy, and requested scope. Eligible MCP tools and skill scripts can also reuse an approval for the same version and content.
- Reviewer-bound evidence is masked by `@buyong/redact`; opt-in personal-information detection and custom masking rules are available.

See the [usage guide](docs/usage.md) for policy settings, approval reuse, retries, and MCP behavior.

## Limits to understand before use

- Review scope is not an OS-enforced permission boundary. Approved shells and interpreters can perform indirect file access or contact different network destinations during execution.
- The extension does not recursively inspect every directory or hard-link alias, create a network proxy, or isolate execution inside external MCP servers.
- Pi, loaded extension code, and external MCP servers are trusted execution components. Tools registered by other trusted extensions do not automatically receive this extension's approval gate.
- Cancelling a request already sent to an MCP server depends on that server's implementation.
- The public Codex policies and rule contracts used here do not guarantee the same decisions as Codex's proprietary model or the security of its sandbox.
- This repository's lockfile does not replace dependencies in a separately installed Pi host. See [dependency security](docs/security/dependencies.md).

The policy and rule baseline is Codex [`rust-v0.160.0`](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc).

## Workspace packages

The repository uses npm workspaces under `packages/`. Each package has an independent version and release. Linked package guides describe their own requirements; a combined installation does not remove them.

| Package | Purpose |
| --- | --- |
| `@buyong/pi-codex-auto-review` | Automatic approval review; this README and the [usage guide](docs/usage.md) |
| [`@buyong/pi-codex`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex/README.md) | Combined installation of the four extensions and the `imagegen` skill |
| [`@buyong/pi-codex-computer-use`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-computer-use/README.md) | Computer Use and Chrome Browser Use through an installed Codex Desktop runtime; Linux is unsupported |
| [`@buyong/pi-codex-fast-mode`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-fast-mode/README.md) | Standard, Fast, and Ultrafast service-tier selection for supported OpenAI models |
| [`@buyong/pi-codex-image-gen`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-image-gen/README.md) | Image generation and editing through Pi's `openai-codex` subscription login |
| [`@buyong/redact`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/redact/README.md) | Host-independent credential, private-key, and opt-in personal-information masking |

Do not enable the combined package and the same individual extensions together: their tools, commands, and event handlers can register twice. Check npm availability before installing a newly prepared package; a local manifest version does not prove publication.

## Build and verify from source

Run from the repository root:

```sh
npm ci --ignore-scripts
npm run build
npm run verify:guard
```

`verify:guard` rebuilds and runs the automatic-review checks for the current operating system. It uses model and UI fixtures, not paid model calls. Reports are stored under `.reports/pi-guard/runs/<run ID>/<platform>/`; it also refreshes verification handoffs in the checkout.

A local pass does not establish results for another operating system or a live model. The separate OS workflow defines Linux x64 and Windows x64 jobs; Windows checks cover rules, approval policy, file execution, and cancellation, not full shell support. See the [verification matrix](docs/testing/auto-review-protection.md) and [Docker instructions](docs/usage.md#ollama-cloud-verification-in-docker).

## Documentation and help

- [Usage](docs/usage.md) · [한국어](docs/usage.ko.md) — Installation, approval settings, protected startup, policies, and verification.
- [Publishing](docs/publishing.md) · [한국어](docs/publishing.ko.md) — Independent package releases, first publication, Trusted Publishing, and recovery.
- [Dependency security](docs/security/dependencies.md) · [한국어](docs/security/dependencies.ko.md) — Recorded dependency fixes and their scope.
- [Protection verification](docs/testing/auto-review-protection.md) · [한국어](docs/testing/auto-review-protection.ko.md) — Current checks, historical results, and unverified boundaries.
- [Issues](https://github.com/buYoung/pi-codex-auto-review/issues) — Bug reports and questions.

## License

[Apache-2.0](LICENSE). Attribution for the TypeScript port of Codex rule contracts and the included policies is preserved in [NOTICE](NOTICE).
