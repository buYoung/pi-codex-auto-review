# Publishing to npm

**English** | [한국어](publishing.ko.md)

Choose a package and a version in `pnpm release` and confirm the commit, tag, and push. GitHub Actions then builds and verifies that JavaScript package and publishes it to npm. The local command does not use npm credentials. Version `0.2.0` uses this JavaScript-only workflow; the published `0.1.4` still contains the earlier native executables.

Select any of the four Pi extensions or their dependency library, `@buyong/redact`, for an independent release. Git tags use the full scoped `<package name>@<version>`. npm dist-tags use `latest` for stable versions and `next` for prereleases.

| Package | Git tag for the current file version | npm registration |
| --- | --- | --- |
| `@buyong/pi-codex-auto-review` | `@buyong/pi-codex-auto-review@0.3.0` | `0.3.0` published |
| `@buyong/pi-codex-computer-use` | `@buyong/pi-codex-computer-use@0.1.0` | Not registered |
| `@buyong/pi-codex-fast-mode` | `@buyong/pi-codex-fast-mode@0.1.0` | Not registered |
| `@buyong/pi-codex-image-gen` | `@buyong/pi-codex-image-gen@0.1.0` | Not registered |
| `@buyong/redact` | `@buyong/redact@0.1.0` | Not registered |

Registration was checked against the public npm registry on 2026-10-05. Git tags in the table are naming examples, not confirmation that those tags exist or were pushed. The release command checks registration again when it runs.

## One-time setup

### Source and dependencies

Commit release configuration, scripts, package changes, and workflows to `master`, and push them to the remote repository. The release branch must track `origin/master`. The release command stops if the working tree or index has changes.

Use a terminal with Node.js 24.14.0 and pnpm 10 available. Install dependencies from the repository root.

```sh
npm ci --ignore-scripts
```

The repository is an npm workspaces monorepo: each published package lives in `packages/<package>`, and Turborepo runs the package builds. Tests, scripts, and documents stay at the repository root. Dependency installation and CI builds use the root `package-lock.json`. `pnpm` serves as the entry point for the release script; it does not switch installation to `pnpm-lock.yaml`. The current package does not bundle sandbox dependencies and uses the Pi host as a peer dependency. Its one runtime dependency is `@buyong/redact` from `packages/redact`.

### npm Trusted Publisher

Add a GitHub Actions connection in **Settings → Trusted publishing** on npm for each package published from this repository, such as `@buyong/pi-codex-auto-review`. Every package uses the same workflow.

| Field | Value |
| --- | --- |
| Organization or user | `buYoung` |
| Repository | `pi-codex-auto-review` |
| Workflow filename | `npm-package.yml` |
| Environment name | Leave empty |
| Allowed actions | Allow direct publishing with `npm publish` |

Enter only the workflow filename, without the `.github/workflows/` path. Allowing only the default `npm stage publish` permission causes this workflow's direct publishing to fail.

The publish job has `id-token: write` permission and checks for npm 11.5.1 or later. It uses OIDC authentication issued by a GitHub-hosted runner, so do not add `NPM_TOKEN` as a GitHub Secret. npm does not validate the connection when it is saved; confirm it during the first actual publish. See the [official npm Trusted Publishing guide](https://docs.npmjs.com/trusted-publishers/).

### First publish of a new package

Trusted Publisher connections are configured in a package's Settings, so register a package once before using this repository's OIDC workflow. Prepare an npm account with two-factor authentication (2FA) and permission to publish under `@buyong`. For a personal scope, the npm username must be `buyong`; for an organization scope, the account needs publishing permission in that organization. See [npm's scoped public package publishing guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

From the repository root, publish the unregistered packages with these commands. Register `@buyong/redact` first so auto-review's pinned dependency can be installed. Skip commands for packages already registered.

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --workspace packages/redact --access public --registry=https://registry.npmjs.org/
npm publish --workspace packages/pi-codex-computer-use --access public --registry=https://registry.npmjs.org/
npm publish --workspace packages/pi-codex-fast-mode --access public --registry=https://registry.npmjs.org/
npm publish --workspace packages/pi-codex-image-gen --access public --registry=https://registry.npmjs.org/
```

Every package's `prepack` builds and verifies its archive contents. Respond to the 2FA prompt during publishing, then confirm that each command below returns `0.1.0`.

```sh
npm view @buyong/redact@0.1.0 version --registry=https://registry.npmjs.org/
npm view @buyong/pi-codex-computer-use@0.1.0 version --registry=https://registry.npmjs.org/
npm view @buyong/pi-codex-fast-mode@0.1.0 version --registry=https://registry.npmjs.org/
npm view @buyong/pi-codex-image-gen@0.1.0 version --registry=https://registry.npmjs.org/
```

After publishing, add a connection in **each package's Settings → Trusted publishing** with the values above. Check the existing auto-review connection too. Then use `pnpm release` and choose a version higher than the first directly published version. Selecting an unregistered package prints its initial publishing commands and this guide's path, then stops before changing versions, commits, or tags.

To point users of the earlier `pi-codex-auto-review` name to the scoped name, use:

```sh
npm deprecate pi-codex-auto-review "Renamed to @buyong/pi-codex-auto-review"
```

### Release order with `@buyong/redact`

`@buyong/pi-codex-auto-review` pins an exact `@buyong/redact` version in `dependencies`. Publish that `@buyong/redact` version first: an auto-review release that refers to an unpublished version cannot be installed. The first `@buyong/redact` version is published directly, as described above, and then connected to the Trusted Publisher:

```sh
npm login
npm publish --workspace packages/redact --access public
```

When a change needs a new engine version, release `@buyong/redact` first, update the pinned version in `packages/pi-codex-auto-review/package.json` and the root `package-lock.json`, and then release `@buyong/pi-codex-auto-review`.

## Version selection and release

Run after committing changes on `master`.

```sh
pnpm release
```

1. Select the package to release. The list reads the root `workspaces` declaration and actual package manifests, excludes `private` packages, and does not omit packages because of stale `node_modules`.
2. Check npm registration and publication of workspace runtime dependencies. Review the current version and concrete next versions, then select one. For a release from `0.1.1` to `0.1.2`, choose **patch**. If the version is unpublished and has no local release tag, **현재 준비 버전 출시** (release the currently prepared version) is also available. Already published versions cannot be selected.
3. Confirm the commit and create a release commit. Releasing the current version unchanged creates an empty commit to record the release.
4. Confirm creation of the `<package>@<version>` tag and create an annotated tag.
5. Confirm pushing `master` and that tag. Approval pushes both references atomically and starts npm publishing in Actions.

Each confirmation defaults to approval. Entering `n` or pressing `Ctrl+C` stops that operation and all later steps. Skipping questions through `--ci`, version arguments, or automatic answers is unsupported.

Version selection does not automatically apply a version such as `0.1.2`. release-it updates the version in the selected package's `package.json` without running npm version lifecycle scripts, and the release plugin records the same version in the root `package-lock.json` for the release commit. The local process does not rebuild the package or publish to npm.

An npm version cannot be published again. If the currently prepared version has already been published, choose a higher version. Prereleases use npm's `next` tag; stable releases use `latest`.

## What GitHub Actions does

Pushing a `<package>@<version>` tag starts `.github/workflows/npm-package.yml`.

1. Install the official development dependencies from the npm lockfile on `ubuntu-22.04`.
2. Find the workspace package named by the tag, check that the tag matches the version in its `package.json`, and check that the tagged commit is included in `origin/master`. For tag publishing, recheck initial registration, duplicate versions, and publication of workspace runtime dependencies. Then build the package with Turborepo. For `@buyong/pi-codex-auto-review`, also run policy tests, including the captured Codex result corpus. For `@buyong/redact`, run the redaction tests.
3. `npm pack --workspace <package>` runs the package's prepack step. For `@buyong/pi-codex-auto-review`, prepack compiles TypeScript, copies the README, LICENSE, NOTICE, and documents listed in `files` from the repository root, checks required files, and exercises the JavaScript rule worker. It rejects archives containing native binaries, `.node` or `.wasm` files, or bundled dependencies. Postpack removes the copied documents.
   The other four packages also verify required JavaScript, declarations, documents, and allowed archive contents. image-gen checks its image tool, bundled skill, license, and attribution notices; redact checks its masking engine and PII recognition data.
4. Save the verified `<package>-<version>.tgz` in the `npm-package` artifact.
5. A separate publish job downloads that same artifact and publishes it to npm through OIDC.

Running **Actions → npm 배포 → Run workflow** manually prepares the archive for one of the five selectable packages and skips publishing. Unregistered packages can be checked this way too. For tag publishing, use a tag-triggered run of the same workflow.

One JavaScript archive serves all platforms; it has no rule-engine CPU or libc dependency. Actual Pi availability, path behavior, and shell support still depend on the host. The separate OS workflow retains Linux and Windows execution checks without installing Rust. Follow the [verification guide](testing/auto-review-protection.md) for the executed scope.

## After cancellation or failure

When the local command exits, it reports file and index changes, current HEAD, local tags, and push attempt status. Rejecting a prompt or cancelling preserves version, index, commit, and tag changes already made.

After a failed push, release-it may attempt to clean up remote tags. Do not infer remote state from that output alone; check the following results.

```sh
git status --short
git log -1
git ls-remote origin refs/heads/master 'refs/tags/*@*'
```

If Actions fails after the tag push, inspect that run's logs and rerun the failed job. First check whether npm publishing actually succeeded. Do not repeat a published version; use a new version for new changes.

## Checking publication and Pi installation

After publishing `0.2.2`, verify with these commands.

```sh
npm view @buyong/pi-codex-auto-review@0.2.2 version --registry=https://registry.npmjs.org/
pi install npm:@buyong/pi-codex-auto-review@0.2.2
pi list
pi
```

For later releases, replace the version with the one selected. `0.1.2` uses the earlier sandbox structure; `0.1.3` removes the sandbox and adds approval settings commands. `0.1.4` improves English approval descriptions, model scope integration, user reapproval, and review context passing and restoration. `0.2.0` replaces the Rust rule engine with TypeScript compiled to JavaScript and removes the repackaged development SDK. From `0.2.2`, the package is published as `@buyong/pi-codex-auto-review`; earlier versions remain under `pi-codex-auto-review`. After installation, check `/approve`'s English descriptions, `/approve-model`'s `/scoped-models` integration, and that saved choices survive a restart. See the [usage guide](usage.md) for settings files and the SDK entry point.

## Preparing an archive locally

Use this when you need to inspect the publishable archive directly. Install the development dependencies first; no platform artifacts are required.

```sh
npm run build
mkdir -p tmp/npm-release
npm pack --workspace packages/pi-codex-auto-review --pack-destination tmp/npm-release
```

`npm run build` creates the JavaScript modules and rule evaluation entry points in `packages/pi-codex-auto-review/dist`. Prepack verifies their inclusion and rejects leftover native artifacts. Do not skip prepack with `--ignore-scripts` when preparing an actual release.

## References

- [release-it 21.0.1](https://github.com/release-it/release-it/tree/21.0.1)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub-hosted runner types](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Pi package registration](https://github.com/earendil-works/pi/blob/v0.99.1/packages/coding-agent/docs/packages.md)
