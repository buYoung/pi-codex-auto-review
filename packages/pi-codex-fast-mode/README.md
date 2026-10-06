# @buyong/pi-codex-fast-mode

**English** | [한국어](README.ko.md)

Request an OpenAI service tier from Pi while keeping the same conversation model and endpoint. Choose Standard, Fast, or Ultrafast; the extension adds the corresponding `service_tier` only when its local compatibility checks pass. Without a saved preference or startup override, Standard leaves the payload unchanged.

**A selected tier is a request, not confirmation of processing speed or billing.** Check the server response and applicable pricing before using paid tiers. See the OpenAI [Fast](https://developers.openai.com/api/docs/guides/fast-mode) and [Ultrafast](https://developers.openai.com/api/docs/guides/ultrafast-mode) guides.

## Requirements

Use Node.js 22.19 or later and Pi 0.99.1 or later with configured model access. For Fast, select an available model in the [local allowlist](#supported-models-and-payloads); Ultrafast has additional API, authentication, and endpoint requirements. The list does not supply account access or establish backend availability.

## Quick start

Install a published release:

```sh
pi install npm:@buyong/pi-codex-fast-mode
pi list
pi
```

Do not also enable this extension through `@buyong/pi-codex`. In Pi:

1. Select a model in the [local Fast allowlist](#supported-models-and-payloads).
2. Run `/codex-fast` and enable Fast.
3. Run `/codex-fast status` to confirm that the desired tier is active for the selected model.
4. Send a short prompt to make a model request, for example:

```text
Reply with READY only. Do not use tools.
```

Run `/codex-fast status` again. An active choice shows a footer such as `gpt-6.1-sol fast`; a matching request records `priority` as the last injection. **Active means the extension's local checks passed.** The injection record shows a payload field prepared by the hook, not proof that the provider received it or used that tier. Disable acceleration with `/codex-fast off`.

## Select a tier

`/codex-fast` opens **Fast** and **Ultrafast** rows. Use **↑/↓** to select and **Tab/Enter** to toggle. Each change applies and saves immediately unless persistence is disabled. The view stays open; Esc closes it. Enabling one mode disables the other; both off means Standard.

| Command | Behavior |
| --- | --- |
| `/codex-fast on` | Select Fast |
| `/codex-fast off` | Select Standard; turn off both accelerated modes |
| `/codex-fast fast on` / `/codex-fast fast off` | Toggle Fast; turning off an inactive mode preserves the other mode |
| `/codex-fast ultrafast on` / `/codex-fast ultrafast off` | Toggle Ultrafast; unsupported activation leaves the previous choice unchanged |
| `/codex-fast status` | Show the desired tier, activation, model, settings path, persistence, and last injection without changing the preference |

Explicit arguments also work without a UI. RPC uses the same repeating Fast/Ultrafast picker. Mode changes wait for the current agent run to become idle. `status` does not save settings or make a model request. Adding `--fast` to the Pi startup command selects Fast over the saved tier at initialization.

A Fast preference on an unsupported model is retained but adds no tier; switching back to a supported model activates it. An existing Ultrafast preference is also retained on unsupported models without injecting a fallback tier. Selecting Ultrafast through a command first requires the current model/authentication checks to pass.

## Migrating from earlier commands

This checkout registers only `/codex-fast`; `/openai-tier` and `/openai-settings` have been removed, not kept as aliases. Use `/codex-fast status` for diagnostics, the named-mode commands above for Fast/Ultrafast, and `/codex-fast off` for Standard. The existing `/codex-fast on` and `off` shortcuts remain supported.

Update scripts that call the removed commands. Settings keys, precedence, and storage paths are unchanged, including legacy boolean settings. Published releases can differ from this checkout; use a release containing this change or the source build below.

## Settings and persistence

| Location | Path |
| --- | --- |
| Global | `<agentDir>/codex-fast-mode/settings.json` |
| Project | `<cwd>/.pi/codex-fast-mode/settings.json` |

`agentDir` honors `PI_CODING_AGENT_DIR` and normally is `~/.pi/agent`. The project layer overrides the global layer. Commands save to the project file if it exists, otherwise to the global file.

```json
{
  "serviceTier": "standard",
  "persistState": true,
  "notifyOnModelSwitch": true
}
```

| Setting | Default | Behavior |
| --- | --- | --- |
| `serviceTier` | `"standard"` | `standard`, `fast`, or `ultrafast`. Explicitly saving Standard differs from having no preference; see the payload table. |
| `persistState` | `true` | `false` keeps command changes in the session only |
| `notifyOnModelSwitch` | `true` | Notifies when a model switch changes activation |
| `supportedModels` | Built-in list below | Replaces the Fast allowlist with exact `provider/id` strings. `[]` disables Fast support; it does not change Ultrafast checks. |
| `desiredActive`, `active`, `fast.enabled` | Unset | Legacy booleans. Within each layer, precedence is `serviceTier`, then `desiredActive`, `active`, and `fast.enabled`. |

Each layer is resolved before merging, so a project legacy boolean can override a global `serviceTier`. Saves update `serviceTier`, `desiredActive`, and `active` while preserving unrelated fields. Model switches recalculate activation without losing the desired tier.

After manual edits, run `/reload`. Invalid or unreadable settings report an error and use defaults with session-only changes. A failed command save restores the previous tier.

## Supported models and payloads

This is the extension's **default local Fast allowlist**, not a promise that your provider/account offers every listed model or service tier:

| Provider | Model IDs |
| --- | --- |
| `openai` | `gpt-5.4`, `gpt-5.5`, `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna` |
| `openai-codex` | All of the above plus `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` |

Ultrafast requires all of these:

- `openai/gpt-6-astra` using the `openai-responses` API.
- Configured authentication without OAuth.
- An HTTPS `/v1` or `/v1/` endpoint at `api.openai.com` or `us.api.openai.com`, using the default HTTPS port or 443, without URL credentials, query, or fragment.

| Selection | Injected `service_tier` |
| --- | --- |
| Initial Standard with no explicit preference | No field added |
| Explicit or saved Standard, including the settings example above | `"default"` on Fast-supported models |
| Fast | `"priority"` on Fast-supported models |
| Ultrafast | `"ultrafast"` when its checks pass |
| Accelerated preference on an unsupported model | No field added; preference retained |

The hook returns a payload copy only for an object whose `payload.model` matches the current model ID. Auxiliary requests for a different model are not changed. Unsupported cases are left unchanged; the extension does not change endpoints, select another model, or verify the backend's actual tier.

## When the selected tier is not active

| Symptom | What to check |
| --- | --- |
| Preference retained but not active | Check the selected `provider/id` and your `supportedModels` override. A saved choice is not a compatibility result. |
| Ultrafast selection rejected | Check every Ultrafast requirement above. The previous tier remains selected; the command does not fall back to Fast. |
| No injection after a prompt | Check the selected model and whether its provider payload has a matching `model` field. Other-model requests and incompatible payloads are left unchanged. |
| Settings load/save error | Follow the reported settings path. Load errors use defaults with session-only changes; a failed command save restores the previous tier. |

## Build and load from source

Run from the repository root:

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex-fast-mode
node_modules/.bin/pi -ne -e ./packages/pi-codex-fast-mode/dist/index.js
```

This loads the extension for one invocation without registering a permanent package source. Rebuild after source changes. The [repository publishing guide](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/publishing.md) describes release preparation.

## License

[Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE). The npm archive includes `LICENSE`.
