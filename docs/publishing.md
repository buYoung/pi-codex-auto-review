# Publishing to npm

**English** | [한국어](publishing.ko.md)

Choose a package and a version in `pnpm release` and confirm the commit, tag, and push. GitHub Actions then builds and verifies that JavaScript package and publishes it to npm. The local command does not use npm credentials. Version `0.2.0` uses this JavaScript-only workflow; the published `0.1.4` still contains the earlier native executables.

## One-time setup

### Source and dependencies

Commit release configuration, scripts, package changes, and workflows to `master`, and push them to the remote repository. The release branch must track `origin/master`. The release command stops if the working tree or index has changes.

Use a terminal with Node.js 24.14.0 and pnpm 10 available. Install dependencies from the repository root.

```sh
npm ci --ignore-scripts
```

The repository is an npm workspaces monorepo: each published package lives in `packages/<package>`, and Turborepo runs the package builds. Tests, scripts, and documents stay at the repository root. Dependency installation and CI builds use the root `package-lock.json`. `pnpm` serves as the entry point for the release script; it does not switch installation to `pnpm-lock.yaml`. The current package does not bundle sandbox dependencies and uses the Pi host as a peer dependency.

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

npm can connect a Trusted Publisher only to a package that already exists in the registry. A new package's first version therefore cannot be published by GitHub Actions; publish it once directly from the repository root. The same applies when a package is published under a new name. For example, for `@buyong/pi-codex-auto-review`, used from `0.2.2`:

```sh
npm login
npm publish --workspace packages/pi-codex-auto-review --access public
npm deprecate pi-codex-auto-review "Renamed to @buyong/pi-codex-auto-review"
```

`prepack` runs the build and the pre-publish checks. `npm deprecate` points the earlier name, `pi-codex-auto-review`, to the new one. After publishing, add a connection in the new package's **Settings → Trusted publishing** with the same values as the table above. From then on, publish it by selecting the package in `pnpm release`. A directly published version cannot be published again, so choose a higher version.

## Version selection and release

Run after committing changes on `master`.

```sh
pnpm release
```

1. Select the package to release. Only workspace packages that are not `private` are listed.
2. Review the current version and concrete next versions, then select one. For a release from `0.1.1` to `0.1.2`, choose **patch**. If no local release tag exists for that version, **현재 준비 버전 출시** (release the currently prepared version) is also available.
3. Confirm the commit and create a release commit. Releasing the current version unchanged creates an empty commit to record the release.
4. Confirm creation of the `<package>@<version>` tag and create an annotated tag.
5. Confirm pushing `master` and that tag. Approval pushes both references atomically and starts npm publishing in Actions.

Each confirmation defaults to approval. Entering `n` or pressing `Ctrl+C` stops that operation and all later steps. Skipping questions through `--ci`, version arguments, or automatic answers is unsupported.

Version selection does not automatically apply a version such as `0.1.2`. release-it updates the version in the selected package's `package.json` without running npm version lifecycle scripts, and the release plugin records the same version in the root `package-lock.json` for the release commit. The local process does not rebuild the package or publish to npm.

An npm version cannot be published again. If the currently prepared version has already been published, choose a higher version. Prereleases use npm's `next` tag; stable releases use `latest`.

## What GitHub Actions does

Pushing a `<package>@<version>` tag starts `.github/workflows/npm-package.yml`.

1. Install the official development dependencies from the npm lockfile on `ubuntu-22.04`.
2. Find the workspace package named by the tag, check that the tag matches the version in its `package.json`, and check that the tagged commit is included in `origin/master`. Then build the package with Turborepo. For `@buyong/pi-codex-auto-review`, also run policy tests, including the captured Codex result corpus.
3. `npm pack --workspace <package>` runs the package's prepack step. For `@buyong/pi-codex-auto-review`, prepack compiles TypeScript, copies the README, LICENSE, NOTICE, and documents listed in `files` from the repository root, checks required files, and exercises the JavaScript rule worker. It rejects archives containing native binaries, `.node` or `.wasm` files, or bundled dependencies. Postpack removes the copied documents.
4. Save the verified `<package>-<version>.tgz` in the `npm-package` artifact.
5. A separate publish job downloads that same artifact and publishes it to npm through OIDC.

Running **Actions → npm 배포 → Run workflow** manually prepares the archive for the entered package only and skips publishing. For tag publishing, use a tag-triggered run of the same workflow.

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
