# pi-codex-fast-mode

**English** | [한국어](README.ko.md)

Select Standard, Fast, or Ultrafast OpenAI service tiers in Pi. The default is Standard without changing the request payload. Enabling Fast adds `service_tier: "priority"` to requests for supported models, using the same model and endpoint. See the [official OpenAI Fast mode guide](https://developers.openai.com/api/docs/guides/fast-mode).

## Run from source

Requires Node.js 22.19+ and a Pi 0.99.1+ host. From the repository root:

```sh
npm ci --ignore-scripts
npm run build --workspace @buyong/pi-codex-fast-mode
pi -e ./packages/pi-codex-fast-mode/dist/index.js
```

Run `/codex-fast` to see separate **Fast on/off** and **Ultrafast on/off** rows. Use **↑/↓ to select a row** and **Tab or Enter to toggle it**. Each change applies and saves immediately, keeping the settings view open. Esc closes the view. Enabling one mode disables the other; both off means Standard. If Ultrafast requirements are not met, the current choice is retained and a reason is shown. Command arguments also support autocomplete.

```text
/codex-fast on
/codex-fast off
/codex-fast fast on
/codex-fast fast off
/codex-fast ultrafast on
/codex-fast ultrafast off
/openai-tier
/openai-tier ultrafast
```

On a supported model, enabling Fast shows a footer status such as `gpt-6.1-sol fast`. `/openai-tier` shows the desired tier, current activation, settings path, and last payload injection. Selecting off returns to Standard and clears the footer status.

Add `--fast` to start with Fast. This takes precedence over the saved tier at session initialization. The commands above also work without UI. `/codex-fast fast off` and `/codex-fast ultrafast off` disable only the named mode, preserving any other enabled mode. The existing `/codex-fast on` selects Fast and `/codex-fast off` disables both modes. RPC uses a dialog where selecting a Fast or Ultrafast row toggles it.

`/openai-settings` offers `fast.enabled` and `serviceTier` choices, also available as arguments:

```text
/openai-settings fast.enabled on
/openai-settings serviceTier standard
```

## Settings

Global settings live at `<agentDir>/codex-fast-mode/settings.json`; project settings at `<cwd>/.pi/codex-fast-mode/settings.json`. `agentDir` honors Pi's `PI_CODING_AGENT_DIR`. Project settings override global settings. Commands save to the project file if it exists, otherwise to the global file.

```json
{
    "serviceTier": "standard",
    "persistState": true,
    "notifyOnModelSwitch": true
}
```

| Setting | Behavior |
| --- | --- |
| `serviceTier` | `standard`, `fast`, or `ultrafast` |
| `persistState` | Defaults to `true`; `false` keeps tier changes within the session |
| `notifyOnModelSwitch` | Defaults to `true`; notify when a model switch changes activation |
| `supportedModels` | A `provider/id` array replacing the default Fast allowlist; an empty array disables Fast support |
| `desiredActive`, `active`, `fast.enabled` | Legacy boolean settings; within one layer, precedence is `serviceTier`, `desiredActive`, `active`, then `fast.enabled` |

Persistence updates `serviceTier`, `desiredActive`, and `active` while preserving unknown fields. Switching models recalculates activation without losing the desired tier. A Fast choice on an unsupported model activates automatically when returning to a supported model.

After editing settings, use `/reload`. Invalid or unreadable settings produce an error and use defaults with session-only changes. A failed command save restores the previous tier.

## Supported models and payloads

The default Fast allowlist is below. Explicit `supportedModels` arrays are used as written.

| Provider | Model IDs |
| --- | --- |
| `openai` | `gpt-5.4`, `gpt-5.5`, `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna` |
| `openai-codex` | All of the above plus `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` |

Ultrafast uses separate checks: `openai/gpt-6-astra`, the `openai-responses` API, configured API-key authentication without OAuth, and an HTTPS `/v1` endpoint at `api.openai.com` or `us.api.openai.com`. Switching to an unsupported model retains the Ultrafast choice but injects no tier, without falling back to Fast or Standard. See the [official Ultrafast guide](https://developers.openai.com/api/docs/guides/ultrafast-mode).

| Selection | `service_tier` |
| --- | --- |
| Initial Standard | No field added |
| Explicit Standard or off | `"default"` on Fast-supported models |
| Fast | `"priority"` on Fast-supported models |
| Ultrafast | `"ultrafast"` when Ultrafast checks pass |

The hook returns a copy only for object payloads whose `payload.model` matches the current model ID. Auxiliary requests for other models remain unchanged. The footer and last injection record describe the requested tier, not confirmed server processing or billing. The actual tier must be checked in the server response. Fast API pricing differs from Standard. [OpenAI guide](https://developers.openai.com/api/docs/guides/fast-mode)

## License

[Apache-2.0](LICENSE).
