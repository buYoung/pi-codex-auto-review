# [feat] Restore Docker verification with Ollama Cloud

## Work Type
feat

## Current State (As-Is)
- [confirmed] The inspected source is `master` at `147ecac82faaf0ede925acc64ff6be32d9622017` with the existing naming edits — Evidence: the October 3 `git status` inventory.
- [confirmed] No project-owned Docker verification files were found in the current checkout or its reachable Git history during the October 3 inspection — Evidence: project file inventory and `git log --all` for Docker/Linux paths.
- [inferred] A previous Docker run may have used untracked or temporary commands; its exact implementation and result are not established — Confirm by: a bounded search of project-specific artifacts before reconstruction.
- [confirmed] Existing native tests exercise real files, subprocesses, network services, cancellation, and per-call isolation — Evidence: `test/native/sandbox.test.mjs`.
- [confirmed] Guarded startup disables automatic extension discovery and accepts explicit trusted inline extensions — Evidence: `src/startup.ts`, `createGuardedRuntime()`.
- [confirmed] The inspected upstream `pi-ollama-cloud` manifest reports version `0.12.2`; its provider factory registers `ollama-cloud` with `apiKey: "$OLLAMA_API_KEY"` — Evidence: the upstream package manifest and `index.ts` linked below.
- [confirmed] The user selected installation of `pi-ollama-cloud` and Docker environment injection of the Ollama API key — Evidence: the final scope decision.
- [inferred] The selected package can load through guarded Pi 0.99.1 without opening automatic extension discovery — Confirm by: installing a pinned published package and exercising the supported Pi loader inside the verification image.

## Desired Outcome (To-Be)
- A reproducible Docker environment runs Pi, the installed `pi-ollama-cloud` package, and the current built `pi-codex-auto-review` plugin together.
- The controller resolves `OLLAMA_API_KEY` from the container runtime environment and calls the `ollama-cloud` provider.
- Offline native verification and explicitly selected live-provider verification produce separate retained evidence.
- An operator can build, run, retrieve results, and clean up the owned test environment using documented commands.

## Scope
### In Scope
- Recover any available project-specific Docker assets, or rebuild equivalent reproducible assets and label their provenance accurately.
- Add a version-pinned test image, isolated agent/workspace directories, a minimal Compose configuration or equivalent checked-in runner, and documented offline/live entrypoints.
- Load the provider package explicitly through supported Pi APIs while preserving guarded startup.
- Package and load the current plugin build, record its identity, and verify the provider plus guard coexist after startup/reload.
- Configure runtime environment injection, model selection, native Linux prerequisites, result export, cancellation, and owned resource cleanup.
### Out of Scope
- [hard] Replacing `pi-ollama-cloud` with a hand-written compatible endpoint provider or the differently named `pi-ollama-cloud-provider`.
- [hard] Local Ollama model serving, `ollama signin`, GPU setup, and downloading local model weights.
- [hard] Enabling provider web-search/web-fetch tools or adding new MCP/app/Computer Use coverage.
- [hard] Making Docker a production dependency of the permission plugin.
- [hard] Copying host credential/session directories or the Docker daemon socket into the workload container.
- [deferred] A hosted CI deployment or remote GPU runner.

## Constraints
- Install the exact `pi-ollama-cloud` package. Qualify a published version compatible with Pi 0.99.1; `0.12.2` is the inspected candidate, not an already-tested installed version.
- Pin the final package version, integrity, image digest, Node/Pi versions, sandbox-runtime version, and image architecture in the build/run evidence.
- Preserve `noExtensions` discovery restrictions. Use explicit trusted paths/factories through Pi's loader for the provider's raw TypeScript entrypoint.
- Set `PI_OLLAMA_WEB_TOOLS=0` and leave usage polling disabled in the fixture so provider installation does not add unrelated tool surfaces or traffic.
- Omit the live API key and disable provider network refresh in offline runs while retaining the installed provider and its baked-in catalog. Do not reuse this offline restriction or a fake provider for the live path.
- Receive the real key only as runtime `OLLAMA_API_KEY`. Do not bake it into image layers, build arguments, committed files, generated `auth.json`, logs, or reports.
- Use a separate harness model variable such as `OLLAMA_MODEL`; require a supported tool-capable model instead of guessing an account-specific model ID.
- The main agent and reviewer use the actual registered `ollama-cloud` provider in live verification; record both effective selections.
- Keep credentials available to provider/controller requests while preserving `workloadEnvironment()` filtering for tool processes.
- Keep native sandboxing active inside Docker. Install `bubblewrap`, `socat`, and `ripgrep`; verify namespace/seccomp capabilities and use only container-scoped setup needed for the test boundary.
- Do not enable weaker sandbox modes to obtain a pass. If the host blocks required primitives, record the precise blocked capability.
- Preserve the existing required Linux x64 qualification target. An ARM run is additional evidence and cannot satisfy a Linux x64 requirement by relabeling.
- Live calls use only owned synthetic fixture data and finite call/deadline limits. Missing key/model or provider errors must never fall back to a fake provider and report success.

## Related Files / Entry Points
- `src/startup.ts` — inspect the explicit extension-loading seam and add only the required compatible trusted-loading option.
- `src/cli.ts` — expose a minimal compatible launch route if the existing SDK route cannot serve the harness.
- `src/sandbox/config.ts` — verify provider keys remain absent from workload environments.
- `package.json` — preserve current exports/scripts and register only the required Docker verification entrypoints.
- `test/native/sandbox.test.mjs` — reuse the existing OS-effect checks.
- `test/harness/pi.mjs` — keep mock-provider fixtures separate from the live harness.
- `test/docker/` (proposed) — own the Dockerfile, runtime bootstrap, Compose/runner configuration, model selection, and env-name-only examples.
- `scripts/verify-docker.mjs` (proposed) — coordinate owned runs and export immutable result references.
- `docs/handoffs/auto-review/01-evidence.json` (proposed) — consume artifact storage and required-platform rules.
- `docs/handoffs/auto-review/02-contracts.json` (proposed) — consume provider-loading and approval-configuration contracts.
- `docs/handoffs/auto-review/06-docker-cloud.json` (proposed) — publish reproducible image/launch evidence.
- https://github.com/fgrehm/pi-ollama-cloud — package installation and runtime configuration.
- https://raw.githubusercontent.com/fgrehm/pi-ollama-cloud/main/package.json — inspected package name/version and shipped TypeScript entrypoint.
- https://raw.githubusercontent.com/fgrehm/pi-ollama-cloud/main/index.ts — provider registration and environment-based key reference.
- https://raw.githubusercontent.com/fgrehm/pi-ollama-cloud/main/utils.ts — provider credential resolution.
- https://docs.ollama.com/api/authentication — Cloud API authentication boundary.

## Execution Plan
### Stage 1 — Recover assets and qualify the provider-loading route
- Starts when: `docs/handoffs/auto-review/01-evidence.json` and `docs/handoffs/auto-review/02-contracts.json` provide preserved evidence, required platforms, and the trusted provider-loading contract.
- Work: Inspect project-specific Docker artifacts/history once, identify recovered versus newly reconstructed assets, resolve a published package pin, and verify the supported Pi loader path with web tools disabled.
- No-op when: Existing checked-in Docker assets already install the exact package and current guard, preserve runtime-only credentials, and have matching image/startup/evidence proofs for all acceptance items.
- No-op handoff: Publish the verified existing environment and its provenance in `docs/handoffs/auto-review/06-docker-cloud.json` so final verification can use it directly.
- Deliverable: A recovery inventory, package/image pin plan, and verified public loader route.
- Verify: `Inspect the package manifest, extension registration, and loader diagnostics`; Inputs: project-specific recovery inventory, the pinned package tarball, and Pi 0.99.1 public loading APIs; Expected: the installed `ollama-cloud` provider is registered while unknown extension discovery remains disabled.
- Ends when:
  - [ ] Recovery evidence is distinguished from reconstruction without claiming prior Docker success.
  - [ ] The exact package and compatible version are established.
  - [ ] The provider can coexist with guard ownership of native tools.
- Handoff: Stage 2 receives the pin plan and verified loader route.
- Replan when: Compatibility requires a Pi core fork, unbounded automatic extension discovery, or replacing the requested provider package; stop and return the concrete integration conflict to the parent.

### Stage 2 — Build the isolated Docker verification environment
- Starts when: Stage 1 provides the loader route, package pin, and recovery inventory.
- Work: Implement the test image and runtime bootstrap, install native prerequisites, inject runtime environment values, load the current plugin artifact explicitly, and export run-scoped results.
- Deliverable: Checked-in Docker assets with exact offline/live launch commands, owned resource naming, image/plugin identity, environment-variable names, and cleanup behavior.
- Verify: `Inspect the built image and run its offline startup/native qualification`; Inputs: `test/docker/`, the current package build, and the existing native suite; Expected: Pi and the requested provider load, native permitted/denied controls execute, and retained results identify the actual Linux architecture.
- Ends when:
  - [ ] The image contains pinned Pi, `pi-ollama-cloud`, and the current packaged guard artifact.
  - [ ] `noExtensions` remains effective and provider web tools are absent.
  - [ ] Runtime key injection does not create persistent credential files or expose the key through diagnostic commands.
  - [ ] Namespace/seccomp failures produce an explicit blocked result rather than weaker execution.
  - [ ] Container removal leaves exported evidence intact and cleanup affects only this run's resources.
- Handoff: Stage 3 receives the runnable environment and its recorded commands.
- Replan when: The required Linux target cannot enforce the native boundary on the available Docker host; preserve diagnostics, correct container-scoped prerequisites, or return the host limitation to the parent.

### Stage 3 — Prove live provider and guarded startup
- Starts when: Stage 2 passes offline qualification and the operator supplies runtime `OLLAMA_API_KEY` plus a valid model selection.
- Work: Execute a bounded synthetic live conversation through the installed provider and guarded SDK/CLI, confirm a separate reviewer request, and retain startup/authentication/cancellation outcomes.
- Deliverable: `docs/handoffs/auto-review/06-docker-cloud.json` with `status`, `sourceDigest`, `recoveryProvenance`, `packagePins`, `imageDigest`, `platform`, `pluginArtifactDigest`, `provider`, `models`, `envNames`, `commands`, `nativeCapabilities`, `artifactPaths`, and `unresolved`.
- Verify: `Execute the live launch command produced in Stage 2 and inspect its retained traces`; Inputs: the built image, runtime-injected key, selected tool-capable model, and owned synthetic workspace; Expected: real main-agent and reviewer provider calls complete, a guarded tool effect is observed, and no fake-provider substitution occurs.
- Ends when:
  - [ ] Provider identity and plugin artifact identity are recorded independently of a successful container startup.
  - [ ] Missing/invalid credentials, rate limits, provider failure, and cancellation have truthful bounded outcomes.
  - [ ] Offline and live evidence remain separately identifiable.
- Handoff: Final verification receives `docs/handoffs/auto-review/06-docker-cloud.json`, the runnable image, and exact invocation/artifact paths.
- Replan when: Live verification fails or required credentials/model are unavailable; preserve the failure, stop the final join, correct the environment or report the external prerequisite, and reverify before reporting completion.

## Side Effect Checkpoints
- [ ] Existing direct SDK/CLI guarded startup and reload behavior remain fail-closed.
- [ ] Loading the provider does not enable arbitrary tools through `trustedTools`.
- [ ] The actual `OLLAMA_API_KEY` is consumed only by provider/controller requests and is filtered from shell descendants.
- [ ] Docker env diagnostics, build history, exported records, and fixture logs do not disclose credential values.
- [ ] The live harness does not reuse the offline harness's synthetic provider or host sessions.
- [ ] A failed or interrupted container run preserves its own result directory and leaves unrelated containers/volumes untouched.

## Acceptance Criteria
- [ ] An operator can reproduce the environment from checked-in assets and recorded immutable package/image pins.
- [ ] The installed provider is `pi-ollama-cloud`, using provider ID `ollama-cloud` and runtime `OLLAMA_API_KEY`.
- [ ] The current plugin artifact is proven loaded through guarded startup, including after the supported reload path.
- [ ] Real native allow/deny effects are observed inside the qualified Docker Linux environment.
- [ ] Real main-agent and reviewer calls occur with owned synthetic data and retained, distinct live evidence.
- [ ] Result artifacts survive cleanup and identify the actual source, architecture, image, provider package, and model.
- [ ] `docs/handoffs/auto-review/06-docker-cloud.json` provides working commands and any actual limitations without claiming historical evidence was recovered when it was reconstructed.

## Open Questions
- None — the user explicitly selected `pi-ollama-cloud` and runtime Docker environment authentication; the operator supplies values at execution time.
