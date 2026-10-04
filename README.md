# pi-codex-auto-review

**English** | [한국어](README.ko.md)

A Pi extension for automatic execution approval review, inspired by Codex's “Approve for me”. Review approval requests with rules and a secondary model, or ask the user to approve them. Approved tools run through Pi's original executor. The extension does not configure an OS sandbox or file and network isolation. It draws on the public approval policies in Codex [`rust-v0.160.0`](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc).

## Installation

The installation example targets the published `0.1.4`, which still contains native rule executables. The current source replaces them with a TypeScript rule engine and removes the repackaged Pi SDK under `vendor`; these changes await the next release. Use [Building from source](docs/usage.md#building-from-source) for the current implementation.

```sh
pi install npm:pi-codex-auto-review@0.1.4
pi list
```

Pi can ignore extension loading failures. If approval protection must be ready before execution starts, use the CLI or SDK entry points in the [usage guide](docs/usage.md).

## How it works

1. **Policy evaluation** — Evaluate protected paths and `commandRules` first. Model review and saved approvals cannot override protected paths.
2. **Automatic review** — The review model assesses the risk and outcome of remaining operations.
3. **Approval** — The user confirms operations that still require approval.
4. **Pi execution** — Run approved operations through the original SDK tools, preserving cancellation signals and caller options.

## Approval settings

- `/approve`: Choose **Approve for me** (secondary model review) or **Ask for approval** (user approval).
- `/approve-model`: Search registered models and choose a secondary review model within Pi's current `/scoped-models` scope. Choose **Use current Pi model** to return to the main model.

Selections are saved to `<agentDir>/guard/settings.json` and persist across runs. The main conversation model stays unchanged. Cancelling preserves the existing settings.

## Requirements

| Component | Requirement |
| --- | --- |
| Node.js | 22.19 or later |
| Pi | 0.99.1 or 1.0.0 |
| Current source build | TypeScript; no Rust compiler or platform-specific rule executable |
| Rule runtime | Node.js worker for asynchronous evaluation; Node.js child process for the synchronous API |

## Protection boundaries

- Modes are `workspace-write` (writes to the workspace and default temporary paths) and `read-only`.
- Model writes to control and authentication paths, project `.pi` settings and extension code, and trusted extension code directories are always blocked.
- File access outside the normal scope, review rules, and commands that cannot be interpreted are reviewed before execution. Reads and ordinary operations within scope follow the policy.
- Approvals can apply once, for the session, or as a saved rule. Saved approvals are bound to the exact tool, input, and policy.
- Automatic review uses the current model by default and stops the actual task after repeated denials. Review errors never become approvals.
- MCP tool approvals and project instruction discovery follow the same trust and review boundaries.

See the [usage guide](docs/usage.md) for configuration and the exact conditions that bind approvals.

## Limitations

- Approved shells and interpreters run with host permissions. The file and domain scope shown during review is not an OS-enforced access restriction.
- The extension does not configure recursive directory scans, exhaustive hard-link checks, or network proxies. It does not isolate indirect file access or destination changes during execution.
- Pi, trusted extension code, and execution inside external MCP servers are part of the trust boundary.
- Cancellation of requests already sent to an MCP server depends on the external provider's implementation.
- Compatibility checks for public policies and flows do not establish identical decisions to the proprietary Codex model.
- The extension does not automatically replace dependencies in a separately installed Pi host. See [dependency security](docs/security/dependencies.md) for this repository's remediation evidence.

## Verification

```sh
npm run verify:guard
```

`verify:guard` builds the project and runs all local checks for the current operating system. Results for other operating systems and live models require separate execution evidence.

- Individual `npm run test:*` checks do not use real credentials or paid models. Environment restrictions and missing dependencies are not treated as passes.
- `npm run verify:platform` runs the full checks for the current operating system.
- The GitHub Actions workflow `자동 검토 운영체제 검증` runs on Linux x64 and exports the Docker image and results. It receives no Ollama key.
- Windows `verify:windows` checks the rule engine, approval policy, file execution, and cancellation. It does not verify full shell execution support.
- See the [Docker section](docs/usage.md#ollama-cloud-verification-in-docker) for container verification.
- Each run is stored under `.reports/pi-guard/runs/<run ID>/<platform>/`. See the [protection verification matrix](docs/testing/auto-review-protection.md) for allowed, blocked, and failure cases.

## Documentation

- [Usage](docs/usage.md) · [한국어](docs/usage.ko.md) — Installation, source builds, CLI, SDK, policies, and Docker verification.
- [Publishing](docs/publishing.md) · [한국어](docs/publishing.ko.md) — `pnpm release`, npm Trusted Publishing, and GitHub Actions.
- [Dependency security](docs/security/dependencies.md) · [한국어](docs/security/dependencies.ko.md) — Audit findings, fixes, and their scope.
- [Protection verification](docs/testing/auto-review-protection.md) · [한국어](docs/testing/auto-review-protection.ko.md) — Allowed and blocked cases, failures, cancellation, and unverified boundaries.

## License

[Apache-2.0](LICENSE). Attribution for the TypeScript port of Codex rule contracts and the included policies is preserved in [NOTICE](NOTICE).
