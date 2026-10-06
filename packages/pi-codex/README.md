# @buyong/pi-codex

**English** | [한국어](README.ko.md)

Install four Codex-inspired Pi extensions together: automatic approval review, Computer Use and Browser Use, OpenAI Fast mode, and image generation with the `imagegen` skill. Each component keeps its original implementation, commands, and settings. The combined package adds no separate automation or approval engine.

## Requirements

- Node.js 22.19 or later and Pi 0.99.1 or later, as declared in the manifest. This repository builds against Pi 0.99.1; individual components have narrower verification scopes.
- A configured Pi conversation provider and model.
- The additional requirements of each feature you use, listed below. Installing the combined package does not install Codex Desktop or supply account access.

| Component | Commands or tools | Additional requirements and limits |
| --- | --- | --- |
| [Automatic review](https://github.com/buYoung/pi-codex-auto-review/blob/master/README.md) | `/approve`, `/approve-model`, `/approve retry` | Uses the current model or a selected reviewer. It is not an OS sandbox. Guarded CLI/SDK startup accepts only Pi 0.99.1 or 1.0.0. |
| [Computer Use](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-computer-use/README.md) | `/computer-use`, `/computer-use-check`, `mcp__cua_repl__js` | Requires an installed Codex Desktop runtime; Chrome Browser Use also needs its extension/native host. macOS has recorded live verification; Windows is implemented but unverified; Linux is unsupported. |
| [Fast mode](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-fast-mode/README.md) | `/codex-fast`, `/openai-tier`, `/openai-settings` | Applies only to supported provider/model/authentication combinations. The default is Standard. A requested tier is not confirmation of server processing or billing. |
| [Image generation](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-image-gen/README.md) | `image_gen`, `/codex-imagen`, `imagegen` skill | Requires Pi's `/login openai-codex` subscription login. Without login, the extension hides its image tool and skill. |

**Do not enable the same individual extensions alongside this package.** Duplicate installations can register tools, commands, and event handlers twice.

## Install or switch from individual packages

For a published npm release:

```sh
pi install npm:@buyong/pi-codex
pi list
pi
```

An unversioned source selects the latest published release. Append `@<version>` to pin one. A local manifest version does not establish npm availability; if the package has not been registered, use the source path below.

When switching from individual extensions:

1. Run `pi list` and identify their installation sources.
2. Remove overlapping entries with `pi remove <source>`. Use `pi remove --local <source>` for project-scoped entries.
3. Install the combined package in the intended scope, then restart Pi.

The component settings paths do not change, so existing settings are reused. Check both global and project entries to avoid leaving an overlapping installation active. Project installations use `pi install --local` and require project trust.

## Make a first useful run

Inside Pi:

1. Configure your conversation model and credentials if needed.
2. Run `/approve` and choose **Approve for me** or **Ask for approval**.
3. Ask Pi to read the project README and summarize how to run it without changing files.

For the other features, start at their own setup commands:

| Goal | First action | What to check |
| --- | --- | --- |
| Operate apps or Chrome | `/computer-use-check`, then `/computer-use` | Resolve missing requirements; enable only the features you need. Runtime approval governs app/origin access. |
| Request a faster service tier | `/codex-fast`, then `/openai-tier` | Select a mode and confirm whether it is active for the current model. |
| Generate an image | `/login openai-codex`, then `/codex-imagen` | Sign in, choose an image model, then ask Pi to use `image_gen`. The conversation model can stay unchanged. |

Computer Use defaults to both features on and can try to start its runtime when Pi starts. Turn both off if you do not use it. Image generation remains hidden without subscription login; Fast mode starts in Standard unless settings or `--fast` select another tier.

Loading this package through normal Pi extension discovery does not guarantee protected startup. For execution that must refuse to start without automatic-review controls, use the [automatic-review CLI or SDK](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/usage.md#run-with-protected-startup). Additional components must be loaded explicitly through that entry point.

## Build and load from source

Run from the repository root:

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex
node_modules/.bin/pi -ne -e ./packages/pi-codex
```

The build first builds the components, then stages their publishable files and runtime dependencies inside the combined package. `-ne` disables automatic extension discovery; `-e` loads this package for the invocation without a permanent installation entry. Desktop prerequisites and image login still apply.

Rebuild after changing a component. The combined package loads its staged copies, not the component source directories.

## Package contents and publishing

The manifest pins all four extensions in `dependencies` and includes them through `bundleDependencies`. `pi.extensions` and `pi.skills` point directly to the bundled packages' original entry points and skill directory. Development dependencies, Pi host packages, and the private Codex runtime are excluded.

Publish the individual pinned extension versions before publishing this package. To include an updated component, update its pin and the root lockfile, rebuild, and release the combined package. See the [publishing guide](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/publishing.md) for first registration, package-specific Trusted Publishing, and the interactive release flow.

## License

[Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE), included as `LICENSE` in the npm archive. Included dependencies keep their own licenses and attribution notices.
