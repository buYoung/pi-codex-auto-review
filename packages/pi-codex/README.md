# @buyong/pi-codex

**English** | [한국어](README.ko.md)

Install automatic approval review, Computer Use and Browser Use, OpenAI Fast mode, and image generation in one Pi package. The bundle includes the four original extensions and the `imagegen` skill; each component keeps its commands and settings.

Use the bundle when you want several of these features together. If you need only one, use its individual package guide below. The bundle adds no separate automation or approval engine and does not supply Codex Desktop or account access.

## Before installing

- Node.js 22.19 or later and a configured Pi conversation provider/model.
- Pi 0.99.1 or later is the manifest requirement. The repository builds against 0.99.1; component verification scopes differ. The automatic-review guarded CLI/SDK accepts only 0.99.1 or 1.0.0.
- The feature-specific requirements in the table. You can leave unused features off.

| Feature | Additional requirement | Initial state without saved settings |
| --- | --- | --- |
| [Automatic review](https://github.com/buYoung/pi-codex-auto-review/blob/master/README.md) | Model access for automatic review, or user confirmation for calls needing approval | **Approve for me**; not an OS sandbox |
| [Computer Use](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-computer-use/README.md) | Installed Codex Desktop runtime; Chrome Browser Use also needs its extension/native host. macOS has live records, Windows is unverified, Linux is unsupported. | Computer and Browser both on; runtime startup can be attempted when Pi starts |
| [Fast mode](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-fast-mode/README.md) | A supported provider/model/authentication combination | Standard; no acceleration selected |
| [Image generation](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-image-gen/README.md) | Pi's `openai-codex` subscription login | Tool and skill hidden without login |

**Do not enable the bundle alongside the same individual extensions.** Tools, commands, and event handlers can register twice. If those packages are already installed, follow [migration](#switch-from-individual-packages) before loading the bundle.

## Install a published release

```sh
pi install npm:@buyong/pi-codex
pi list
pi
```

An unversioned source selects the latest published release; append `@<version>` to pin one. Add `--local` for a project-scoped entry, which requires project trust. A checkout version does not establish npm publication: for an unregistered package or unreleased changes, use [source loading](#build-and-load-from-source).

## Switch from individual packages

1. Run `pi list` and identify overlapping extension sources in both global and project settings.
2. Remove those entries with `pi remove <source>`, or `pi remove --local <source>` for a project entry.
3. Install the bundle in the intended scope and restart Pi.

Use the sources reported by `pi list`, not a guessed version string. Component settings paths do not change, so existing preferences remain available after switching.

## Confirm setup before running feature tasks

Inside Pi, configure conversation access with `/login` if needed. Then run `/approve` and choose **Approve for me** or **Ask for approval**. To try a bounded approval-review task, send:

```text
Use bash to run exactly node --version and report the result. Do not install anything or change files.
```

Under the default policy, the command requires review. A successful run reports the installed Node.js version; custom rules and saved approvals can change the route. Automatic review makes additional model calls.

Configure other features separately:

| Goal | Entry point | Result to check |
| --- | --- | --- |
| Operate apps or Chrome | `/computer-use-check`, then `/computer-use` | Resolve missing prerequisites and enable the surfaces you need. A connected runtime exposes `mcp__cua_repl__js`; runtime approval governs app/origin access. |
| Request a faster service tier | `/codex-fast`, then `/openai-tier` | Check both the desired tier and local activation. The last injection record is not confirmation of server processing or billing. |
| Generate an image | `/login openai-codex`, then `/codex-imagen` | Sign in, choose an image model, and ask Pi to use `image_gen`. The result includes an image; saving is best-effort. |

Turn both Computer Use surfaces off if you do not use them. Choosing a service tier or image model does not switch the conversation model; tier activation still depends on that model's compatibility. Existing saved preferences override the initial states listed above.

The component guides also cover `/approve-model`, `/approve retry`, `/openai-settings`, settings files, and failures. Follow them before granting persistent app permissions or using a paid service tier.

## Protected startup is a separate choice

Normal Pi extension discovery can continue after an extension fails to load. Installing the bundle is therefore **not** a guarantee that execution starts with approval controls ready.

If that guarantee is required, use the [automatic-review CLI or SDK](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/usage.md#run-with-protected-startup). Load any additional components explicitly through that entry point; do not also load a second automatic-review extension. Approved commands still run with host permissions, not an OS sandbox.

## Build and load from source

Run from the repository root:

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex
node_modules/.bin/pi -ne -e ./packages/pi-codex
```

The build first builds the components, then stages their publishable files and runtime dependencies inside the bundle. `-ne` disables automatic extension discovery and `-e` loads this package for one invocation without a permanent entry. Desktop prerequisites and subscription login still apply.

Rebuild after changing a component: the bundle loads its staged copies, not the component source directories.

## Contents and release order

The manifest pins the four extensions in `dependencies` and packages them through `bundleDependencies`. `pi.extensions` and `pi.skills` point to their original entry points and skill directory. Development dependencies, Pi hosts, and the private Codex runtime are excluded.

Publish the pinned individual versions first. To include an updated component, update its bundle dependency pin and the root lockfile, rebuild, and release the bundle. See the [publishing guide](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/publishing.md) for registration, package-specific Trusted Publishing, and recovery.

## License

[Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE), included as `LICENSE` in the npm archive. Included dependencies retain their own licenses and attribution notices.
