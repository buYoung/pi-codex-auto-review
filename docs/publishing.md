# Publish workspace packages to npm

**English** | [한국어](publishing.ko.md)

Use `pnpm release` to select **one package and one version**, then confirm the release commit, tag, and push. GitHub Actions builds and checks that package, saves its archive, and publishes the same archive to npm through Trusted Publishing. The local release command does not publish to npm or require npm publishing credentials.

This guide is for repository maintainers. All shell commands run from the repository root unless stated otherwise. Publishing creates a public npm version that cannot be overwritten; inspect the selected package, version, and archive before approving publication.

## Packages and release order

The root package is private. These six workspace packages can be released independently:

| Package | Directory | Manifest version in this checkout |
| --- | --- | --- |
| `@buyong/redact` | `packages/redact` | `0.1.0` |
| `@buyong/pi-codex-auto-review` | `packages/pi-codex-auto-review` | `0.3.0` |
| `@buyong/pi-codex-computer-use` | `packages/pi-codex-computer-use` | `0.1.0` |
| `@buyong/pi-codex-fast-mode` | `packages/pi-codex-fast-mode` | `0.1.0` |
| `@buyong/pi-codex-image-gen` | `packages/pi-codex-image-gen` | `0.2.1` |
| `@buyong/pi-codex` | `packages/pi-codex` | `0.1.0` |

These are **local manifest versions, not npm publication status or proof of pushed tags**. The release command reads public registry metadata again on every run.

Publish dependencies before their consumers:

1. Publish `@buyong/redact` before automatic review. Automatic review pins `@buyong/redact@0.1.0` and does not bundle it.
2. Publish individual extensions before the combined package. The combined package pins automatic review `0.3.0`, Computer Use `0.1.0`, Fast mode `0.1.0`, and image generation `0.2.1`.
3. After updating a dependency, update its consumer's pinned version and the root `package-lock.json`, commit those changes, then release the consumer. The release command does **not** update consumer dependency pins for you.

The combined archive bundles the four extensions and their runtime dependencies. Pi host packages and Codex's private runtime are not bundled. The existing package check requires its extension pins to match the workspace versions being packaged.

Git tags use `<full scoped package name>@<version>`, for example `@buyong/pi-codex-auto-review@0.3.0`. The workflow uses npm dist-tag `latest` for stable versions and `next` for prereleases.

## Prepare the checkout

You need permission to push `master` and tags to `origin`, and an interactive terminal for the release prompts.

- Use Node.js **24.14.0** to match CI, npm **11.5.1 or later**, and pnpm **10** for the documented `pnpm release` entry point.
- Install with the root npm lockfile. This is an npm workspaces repository; pnpm only launches the release script. Do not replace `package-lock.json` with a pnpm lockfile.
- Commit the release scripts, configuration, workflow, and package changes.
- Work on `master`, tracking `origin/master`. The release preflight rejects repository-wide tracked-file and index changes. Unrelated untracked files are not automatically included in the release commit.

```sh
npm ci --ignore-scripts
git status --short
git branch --show-current
git rev-parse --symbolic-full-name '@{upstream}'
```

The last two commands should show `master` and `refs/remotes/origin/master`. Check that the selected package and all required workspace dependency versions are registered on npm before a normal release.

## Configure Trusted Publishing once per package

For an already registered npm package, open **Settings → Trusted publishing** and add a GitHub Actions connection:

| Field | Value |
| --- | --- |
| Organization or user | `buYoung` |
| Repository | `pi-codex-auto-review` |
| Workflow filename | `npm-package.yml` |
| Environment name | Leave empty |
| Allowed actions | Allow direct publishing with `npm publish` |

Use only the workflow filename, not `.github/workflows/npm-package.yml`. This workflow publishes directly: allowing only `npm stage publish` is insufficient.

Configure **each package separately**, including `@buyong/pi-codex`. A dependency's publisher connection does not authorize publication of its consumer.

The publish job runs on a GitHub-hosted runner with `id-token: write` and checks npm's minimum version. npm uses OIDC authentication, so no `NPM_TOKEN` GitHub Secret is needed. Saving a connection does not verify it; the first actual publish confirms it. See [npm's Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

### First publication of an unregistered package

This repository's tag workflow requires a package to be registered first. `pnpm release` stops before version, commit, or tag changes when the selected package has no published versions, and prints the initial publishing commands.

For this bootstrap step, you need an npm account with 2FA and publishing rights under `@buyong`. Publish required dependency versions first. Do **not** repeat this step for a version already on npm.

The following example selects the combined package. Set `PACKAGE_NAME` to the package you intend to register; `VERSION` is read from that workspace's manifest:

```sh
PACKAGE_NAME=@buyong/pi-codex
VERSION=$(npm pkg get version --workspace "$PACKAGE_NAME" | node --input-type=module -e 'let text = ""; for await (const chunk of process.stdin) text += chunk; console.log(Object.values(JSON.parse(text))[0]);')
npm view "$PACKAGE_NAME" versions --json --registry=https://registry.npmjs.org/
```

A registry `404` means the package is not registered. Authentication, network, or service errors do not establish that it is unregistered. If it is registered, use the normal release flow instead.

Build and inspect an archive before the first public publish:

```sh
npm run build -- --filter="$PACKAGE_NAME"
mkdir -p tmp/npm-release
npm pack --workspace "$PACKAGE_NAME" --pack-destination tmp/npm-release
```

`prepack` checks the archive contents. Review the generated file list and selected version. Then authenticate and publish the selected workspace:

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --workspace "$PACKAGE_NAME" --access public --registry=https://registry.npmjs.org/
npm view "$PACKAGE_NAME@$VERSION" version --registry=https://registry.npmjs.org/
```

Complete any 2FA prompt. The final command should return the manifest version selected above. Add that package's Trusted Publisher connection, then use `pnpm release` with a new version for subsequent publications. `npm publish --workspace` packs again and runs the package's lifecycle checks; this bootstrap path is distinct from CI's verified-artifact publishing.

## Release a registered package

After committing your changes on `master`, run without arguments:

```sh
pnpm release
```

1. **Select the package.** The menu reads actual manifests from the root `workspaces` declaration and excludes private packages; it does not rely on stale `node_modules` contents.
2. **Select the version.** The script checks registration and published workspace runtime dependencies. Choose a concrete increment or enter a higher SemVer without build metadata. Published versions are excluded. If the current version is unpublished and has no local package release tag, the menu also offers **현재 준비 버전 … 출시 (첫 태그 생성)** to release it unchanged.
3. **Confirm the commit.** release-it changes the selected manifest version without npm version lifecycle scripts. A plugin refreshes and stages the root lockfile. Confirming creates the release commit; releasing the same version records an empty commit.
4. **Confirm the tag.** The command creates an annotated `<package>@<version>` tag.
5. **Confirm the push.** It atomically pushes `HEAD` to `origin/master` and that exact tag. This also publishes any other commits on the branch that are not yet on the remote. The tag starts GitHub Actions publication.

**Enter approves each Git confirmation.** Enter `n` or press Ctrl+C to stop that step and all later steps. Files may already be updated and staged before the commit prompt. Cancellation preserves work already done; see [recovery](#after-cancellation-or-failure).

This entry point requires a TTY and rejects command arguments. `--ci`, automatic answers, version arguments, and skipped commit/tag/push stages are not supported. Local release does not rebuild packages, run the package test suites, or publish to npm; CI performs the package checks described below.

For a dependency update, repeat the flow in dependency order. If an already prepared version has been published, choose a higher version. Do not attempt to publish the same npm version again.

## What GitHub Actions checks and publishes

Pushing a package tag starts `.github/workflows/npm-package.yml`, displayed as **npm 배포** in Actions.

| Stage | Checks and result |
| --- | --- |
| Validate | Finds the tagged workspace, checks tag/manifest version equality and that the commit is included in `origin/master`, then checks registration, version uniqueness, and published workspace runtime dependencies |
| Build | Runs the selected Turborepo build on `ubuntu-22.04` with Node.js 24.14.0 and the committed npm lockfile |
| Targeted tests | Runs `test:policy` for automatic review. For `@buyong/redact`, builds the workspace and runs `test:redaction`. This is not a full live-model or OS verification. |
| Pack | Runs `npm pack --workspace`, including the package's `prepack` and archive checks |
| Save | Uploads the verified `.tgz` as the `npm-package` artifact |
| Publish | A separate job downloads that same archive and runs `npm publish` through OIDC with `latest` or `next` |

Archive checks differ by package:

- **Automatic review:** compiles TypeScript, temporarily copies shared README/license/notice/docs from the repository, checks required modules and the JavaScript rule worker, and rejects native artifacts or bundled dependencies. `postpack` removes the copied files.
- **Computer Use, Fast mode, image generation, and redact:** check their required JavaScript, declarations, package documents, and allowed file lists. image generation also checks its bundled skill and attribution; redact checks its masking and PII data modules.
- **Combined package:** builds and stages the original extension entry points, `imagegen` skill, and runtime dependencies. Checks exact versions and required files; rejects bundled Pi hosts, native artifacts, and the private Codex runtime.

**Actions → npm 배포 → Run workflow** prepares an archive for the selected package but **does not publish it**. This manual path can inspect an unregistered package too; registration/dependency publication checks apply to tag publishing.

JavaScript distribution removes a platform-specific rule binary requirement. It does not establish support for every host OS or shell. The separate **자동 검토 운영체제 검증** workflow defines Linux x64 and Windows x64 execution checks; see the [verification guide](testing/auto-review-protection.md) for their scope.

## After cancellation or failure

The local command reports the starting/current HEAD, remaining file/index changes, selected file version, relevant local tag, and push attempt status once release state reporting is available. A stopped run does not undo version, index, commit, or tag changes already made.

Inspect local and remote state before deciding how to continue:

```sh
git status --short
git log -1
git ls-remote origin refs/heads/master 'refs/tags/*@*'
```

- **Stopped before commit:** inspect the manifest and root lockfile changes. Do not assume the index is unchanged.
- **Stopped after commit or tag:** preserve and inspect those records. Simply rerunning `pnpm release` is not a resume operation and may encounter the existing tag or select another version.
- **Push failed:** remote state is unknown until checked. release-it may attempt remote tag cleanup after a push error; do not infer the final state from one message.
- **Actions failed:** inspect the failing job and check npm first. If the version is unpublished, rerun the appropriate failed job after resolving its cause. If publishing succeeded, do not publish that version again; new changes need a new version.

Do not delete or recreate pushed release tags as an automatic recovery step.

## Confirm publication and installation

Set `PACKAGE_NAME` and `VERSION` to the package and version actually released. For example, after an automatic-review release:

```sh
PACKAGE_NAME=@buyong/pi-codex-auto-review
VERSION=0.3.1
npm view "$PACKAGE_NAME@$VERSION" version --registry=https://registry.npmjs.org/
npm view "$PACKAGE_NAME" dist-tags --registry=https://registry.npmjs.org/
pi install "npm:$PACKAGE_NAME@$VERSION"
pi list
pi
```

`0.3.1` is an example, not a claim that the version exists. The registry must return your selected version, the expected dist-tag must point to it, and `pi list` must show the installation source.

For automatic review, run `/approve` and `/approve-model`, check that the review model does not change the conversation model, and restart Pi to confirm saved choices. Full Access must not persist. See the [usage guide](usage.md) for the settings path and protected startup.

For the combined package, remove overlapping individual package sources before enabling it. Its component requirements still apply; see the [combined package guide](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex/README.md) and the component guides linked from the [README](../README.md#workspace-packages). `@buyong/redact` is a library, not a Pi extension; verify its public import rather than using `pi install`.

## Prepare an archive without publishing

With development dependencies installed, choose a package and run:

```sh
PACKAGE_NAME=@buyong/pi-codex-auto-review
npm run build -- --filter="$PACKAGE_NAME"
mkdir -p tmp/npm-release
npm pack --workspace "$PACKAGE_NAME" --pack-destination tmp/npm-release
```

The archive appears in `tmp/npm-release`. Change `PACKAGE_NAME` to inspect another workspace. Do not use `--ignore-scripts` for release packing: it would skip the required preparation and checks. Packing shared documents normally removes its temporary copies through `postpack`; if packing fails, inspect the workspace for leftover copies before retrying.

## References

- [release-it 21.0.1](https://github.com/release-it/release-it/tree/21.0.1)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [Publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [Pi package registration](https://github.com/earendil-works/pi/blob/v0.99.1/packages/coding-agent/docs/packages.md)
