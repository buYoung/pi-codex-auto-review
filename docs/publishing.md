# Publishing to npm

**English** | [한국어](publishing.ko.md)

Choose a version in `pnpm release` and confirm the commit, tag, and push. GitHub Actions then builds and verifies the JavaScript package and publishes to npm. The local command does not use npm credentials. Version `0.2.0` uses this JavaScript-only workflow; the published `0.1.4` still contains the earlier native executables.

## One-time setup

### Source and dependencies

Commit release configuration, scripts, package changes, and workflows to `master`, and push them to the remote repository. The release branch must track `origin/master`. The release command stops if the working tree or index has changes.

Use a terminal with Node.js 24.14.0 and pnpm 10 available. Install dependencies from the repository root.

```sh
npm ci --ignore-scripts
```

Dependency installation and CI builds use the existing `package-lock.json`. `pnpm` serves as the entry point for the release script; it does not switch installation to `pnpm-lock.yaml`. The current package does not bundle sandbox dependencies and uses the Pi host as a peer dependency.

### npm Trusted Publisher

Add a GitHub Actions connection in **Settings → Trusted publishing** for `pi-codex-auto-review` on npm.

| Field | Value |
| --- | --- |
| Organization or user | `buYoung` |
| Repository | `pi-codex-auto-review` |
| Workflow filename | `npm-package.yml` |
| Environment name | Leave empty |
| Allowed actions | Allow direct publishing with `npm publish` |

Enter only the workflow filename, without the `.github/workflows/` path. Allowing only the default `npm stage publish` permission causes this workflow's direct publishing to fail.

The publish job has `id-token: write` permission and checks for npm 11.5.1 or later. It uses OIDC authentication issued by a GitHub-hosted runner, so do not add `NPM_TOKEN` as a GitHub Secret. npm does not validate the connection when it is saved; confirm it during the first actual publish. See the [official npm Trusted Publishing guide](https://docs.npmjs.com/trusted-publishers/).

## Version selection and release

Run after committing changes on `master`.

```sh
pnpm release
```

1. Review the current version and concrete next versions, then select one. For a release from `0.1.1` to `0.1.2`, choose **patch**. If no local version tag exists, **현재 준비 버전 출시** (release the currently prepared version) is also available.
2. Confirm the commit and create a release commit. Releasing the current version unchanged creates an empty commit to record the release.
3. Confirm creation of the `v<version>` tag and create an annotated tag.
4. Confirm pushing `master` and that tag. Approval pushes both references atomically and starts npm publishing in Actions.

Each confirmation defaults to approval. Entering `n` or pressing `Ctrl+C` stops that operation and all later steps. Skipping questions through `--ci`, version arguments, or automatic answers is unsupported.

Version selection does not automatically apply a version such as `0.1.2`. release-it updates versions in `package.json` and `package-lock.json` without running npm version lifecycle scripts. The local process does not rebuild the package or publish to npm.

An npm version cannot be published again. If the currently prepared version has already been published, choose a higher version. Prereleases use npm's `next` tag; stable releases use `latest`.

## What GitHub Actions does

Pushing a `v*` tag starts `.github/workflows/npm-package.yml`.

1. Install the official development dependencies from the npm lockfile on `ubuntu-22.04`.
2. Check that the tag matches the version in `package.json` and that the tagged commit is included in `origin/master`, then build TypeScript and run policy tests, including the captured Codex result corpus.
3. The `npm pack` prepack step compiles TypeScript, checks required files, and exercises the JavaScript rule worker. It removes obsolete sandbox/native output and rejects archives containing native binaries, `.node` or `.wasm` files, or bundled dependencies.
4. Save the verified `pi-codex-auto-review-<version>.tgz` in the `npm-package` artifact.
5. A separate publish job downloads that same artifact and publishes it to npm through OIDC.

Running **Actions → npm 배포 → Run workflow** manually prepares the archive only and skips publishing. For tag publishing, use a tag-triggered run of the same workflow.

One JavaScript archive serves all platforms; it has no rule-engine CPU or libc dependency. Actual Pi availability, path behavior, and shell support still depend on the host. The separate OS workflow retains Linux and Windows execution checks without installing Rust. Follow the [verification guide](testing/auto-review-protection.md) for the executed scope.

## After cancellation or failure

When the local command exits, it reports file and index changes, current HEAD, local tags, and push attempt status. Rejecting a prompt or cancelling preserves version, index, commit, and tag changes already made.

After a failed push, release-it may attempt to clean up remote tags. Do not infer remote state from that output alone; check the following results.

```sh
git status --short
git log -1
git ls-remote origin refs/heads/master 'refs/tags/v*'
```

If Actions fails after the tag push, inspect that run's logs and rerun the failed job. First check whether npm publishing actually succeeded. Do not repeat a published version; use a new version for new changes.

## Checking publication and Pi installation

After publishing `0.2.0`, verify with these commands.

```sh
npm view pi-codex-auto-review@0.2.0 version --registry=https://registry.npmjs.org/
pi install npm:pi-codex-auto-review@0.2.0
pi list
pi
```

For later releases, replace the version with the one selected. `0.1.2` uses the earlier sandbox structure; `0.1.3` removes the sandbox and adds approval settings commands. `0.1.4` improves English approval descriptions, model scope integration, user reapproval, and review context passing and restoration. `0.2.0` replaces the Rust rule engine with TypeScript compiled to JavaScript and removes the repackaged development SDK. After installation, check `/approve`'s English descriptions, `/approve-model`'s `/scoped-models` integration, and that saved choices survive a restart. See the [usage guide](usage.md) for settings files and the SDK entry point.

## Preparing an archive locally

Use this when you need to inspect the publishable archive directly. Install the development dependencies first; no platform artifacts are required.

```sh
npm run build
mkdir -p tmp/npm-release
npm pack --pack-destination tmp/npm-release
```

`npm run build` creates the JavaScript modules and rule evaluation entry points. Prepack verifies their inclusion and rejects leftover native artifacts. Do not skip prepack with `--ignore-scripts` when preparing an actual release.

## References

- [release-it 21.0.1](https://github.com/release-it/release-it/tree/21.0.1)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub-hosted runner types](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Pi package registration](https://github.com/earendil-works/pi/blob/v0.99.1/packages/coding-agent/docs/packages.md)
