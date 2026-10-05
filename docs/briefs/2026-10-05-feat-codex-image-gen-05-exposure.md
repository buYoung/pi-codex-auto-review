# [feat] Gate tool and skill exposure on openai credentials without overriding user choices

## Work Type
feat

## Current State (As-Is)
- [confirmed] After `01-tool-contract`, `image_gen` is registered with default activation, so it is declared to the model regardless of credentials; `03-skill` ships the `imagegen` skill, which Pi lists whenever `read` or `bash` is active — Evidence: `docs/handoffs/image-gen/01-tool-contract.json`, `docs/handoffs/image-gen/03-skill.json`; `formatSkillsForPrompt` gating in `node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.js`.
- [confirmed] FDD §9.9: hide `image_gen` when no `openai` credential is configured; re-evaluate at `session_start` and before each user prompt; re-enable only a tool this extension hid; never re-enable a tool the user disabled; the extension records its own hiding in the session branch to survive `/tree`; `OPENAI_API_KEY` set mid-session needs a Pi restart; call-time credential check stays in the tool — Evidence: `docs/FDD/codex-image-gen.md` §9.9.
- [confirmed] FDD §9.10: the skill is listed only while `image_gen` is exposed, regardless of why it is hidden — Evidence: FDD §9.10.
- [confirmed] `before_agent_start` handlers may call `pi.setActiveTools()` and the result applies to that prompt's request (the loadout is rebuilt from the live active set after handlers run); handlers may also mutate `event.systemPromptOptions.skills` for that prompt — Evidence: the `emitBeforeAgentStart()` block in `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`; `NormalizedBuildSystemPromptOptions.skills` in `dist/core/system-prompt.d.ts`; `BeforeAgentStartEvent.systemPromptOptions` in `dist/core/extensions/types.d.ts`.
- [confirmed] Pi re-activates all extension tools at session start/resume and on `/reload` (`includeAllExtensionTools: true`); only `/tree` navigation restores tool state from the branch record (`_restoreToolsFromTranscript()`); `-t/--tools`, `-xt/--exclude-tools`, `-nt/--no-tools` remove excluded tools from the registry entirely (`isAllowedTool`), while `defaultTools` `-name` cannot disable extension tools — Evidence: `agent-session.js` (`_buildRuntime`, `_restoreToolsFromTranscript`, `isAllowedTool`), `settings-manager.js` (`resolveDefaultTools`), `sdk.js` (`initialActiveToolNames`).
- [confirmed] `ctx.modelRegistry.getProviderAuthStatus("openai")` returns `{ configured, source }` without network; `getProviderAuth("openai")` performs OAuth refresh and may reject; `pi.appendEntry(customType, data)` writes a `custom` entry and `ctx.sessionManager.getBranch()` returns the branch entries including `CustomEntry { customType, data }` — Evidence: `model-registry.d.ts`, `model-runtime.js`, `extensions/types.d.ts` (`appendEntry`), `session-manager.d.ts` (`CustomEntry`, `getBranch`).
- [confirmed] `pi.getActiveTools()`, `pi.getAllTools()`, `pi.setActiveTools(names)` exist on `ExtensionAPI`; `session_start` and `before_agent_start` events are available — Evidence: `extensions/types.d.ts`.
- [inferred] `getProviderAuthStatus("openai").configured` is the right exposure predicate (true for stored OAuth or an API key, false otherwise) and a refresh failure is surfaced only at call time by `02`'s credential check — Confirm by: Stage 1 inspection in a session with a stored login, one with `OPENAI_API_KEY` only, and one with neither.

## Desired Outcome (To-Be)
- With no `openai` credential, `image_gen` is not declared to the model and `imagegen` is absent from the skills list; with a credential, both appear — evaluated at `session_start` and before every user prompt.
- After `/login` for OpenAI mid-session, the next prompt sees the tool and skill; after credentials disappear, the next prompt does not.
- The extension re-enables only a tool it hid itself (tracked in memory and in a branch `custom` entry `image_gen.exposure`), so a tool disabled at runtime by another extension or command stays disabled while credentials exist; tools removed by `--tools`/`--exclude-tools`/`--no-tools` are never touched (Pi removed them).
- After resume or `/reload`, Pi's own re-activation is accepted and the extension re-evaluates credentials; after `/tree`, the branch record distinguishes extension-hidden from user-disabled.
- `docs/handoffs/image-gen/05-exposure.json` records the predicate, timing, branch record shape, and the observed matrix.

## Scope
### In Scope
- `packages/pi-codex-image-gen/src/exposure.ts` (predicate, decision, branch record read/write, skill filter) and its wiring in `src/index.ts` (`session_start`, `before_agent_start`).
- The handoff JSON.
### Out of Scope
- [hard] The call-time credential check and its message — `02-backend` (FDD §9.1); this child must not duplicate it.
- [hard] Changing `src/tool.ts`, `backend.ts`, `reference-images.ts`, or the skill files.
- [hard] Hiding the tool when the current model lacks image input (FDD §12 deferred) or for any reason other than credentials.
- [hard] Providing a settings-based permanent disable (FDD §9.9 records that `defaultTools` cannot disable extension tools).
- [hard] Touching the active state of any tool other than `image_gen`.
- [hard] Modifying `packages/pi-codex-auto-review`, `scripts/*.mjs`, `.github/workflows/*`; adding test files.

## Constraints
- Exposure predicate: `ctx.modelRegistry.getProviderAuthStatus("openai").configured === true`; no network call in `session_start`/`before_agent_start`.
- Decision table per evaluation: tool not in `getAllTools()` → do nothing; tool active and credentials missing → `setActiveTools(active without image_gen)` and record `{ hiddenByExtension: true }`; tool inactive and credentials present and the latest record on this branch (or in-memory state) says `hiddenByExtension: true` → `setActiveTools(active + image_gen)` and record `{ hiddenByExtension: false }`; tool inactive with no such record → leave it (user or another extension disabled it); tool active and credentials present → do nothing.
- Branch record: `pi.appendEntry("image_gen.exposure", { hiddenByExtension: boolean, at: ISO timestamp })`; read the latest `custom` entry of that type from `ctx.sessionManager.getBranch()` when in-memory state is absent (after `/tree`, resume, `/reload`). Write a record only when the state changes.
- Skill filter: in `before_agent_start`, if `image_gen` is not in `getActiveTools()` after the decision, remove skills named `imagegen` from `event.systemPromptOptions.skills` for that prompt; never add skills.
- Order inside `before_agent_start`: run the tool decision first, then the skill filter, so both reflect the same evaluation.
- Never call `setActiveTools` with any change other than adding/removing `image_gen`; preserve the existing order of other tools.
- Log nothing containing credentials; the decision log (if any) names only `configured: true|false`.

## Related Files / Entry Points
- `docs/handoffs/image-gen/01-tool-contract.json` (proposed) — tool name and registration facts.
- `docs/handoffs/image-gen/03-skill.json` (proposed) — skill name `imagegen` and loading verification.
- `docs/FDD/codex-image-gen.md` — §9.9 exposure policy, §9.10 skill visibility, §7.3 flows.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js` — `emitBeforeAgentStart()` block, `_buildRuntime`, `_restoreToolsFromTranscript()`, `isAllowedTool`: the Pi behaviors the design depends on.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` — `BeforeAgentStartEvent`, `setActiveTools`, `appendEntry`.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/model-registry.d.ts` — `getProviderAuthStatus`.
- `node_modules/@earendil-works/pi-coding-agent/docs/cli.md` — `--tools`, `--exclude-tools`, `--no-tools` semantics.
- `packages/pi-codex-image-gen/src/index.ts` (proposed) — add `session_start` and `before_agent_start` wiring.
- `packages/pi-codex-image-gen/src/exposure.ts` (proposed) — predicate, decision, record, skill filter.
- `docs/handoffs/image-gen/05-exposure.json` (proposed) — this child's handoff.

## Execution Plan
### Stage 1 — Exposure decision and branch record
- Starts when: `docs/handoffs/image-gen/01-tool-contract.json` and `docs/handoffs/image-gen/03-skill.json` both have `status: "complete"`.
- Work: Implement `exposure.ts` and wire `session_start`/`before_agent_start` in `index.ts` per the decision table and record rules.
- No-op when: `dist/exposure.js` exists and the Verify matrix already yields the expected declarations.
- No-op handoff: `docs/briefs/2026-10-05-chore-codex-image-gen-06-verification.md` receives the existing `docs/handoffs/image-gen/05-exposure.json`.
- Deliverable: Credential-gated tool exposure with user-disable preservation.
- Verify: `Inspect the tool declarations and image_gen.exposure entries in session files across the credential matrix`; Inputs: three sessions started with `pi -ne -e packages/pi-codex-image-gen/dist/index.js`: (a) stored OpenAI login, (b) a temporary `PI_CODING_AGENT_DIR` with no login and `OPENAI_API_KEY` exported, (c) the temporary directory with neither; plus in (a) a run where another extension (a scratch `-e` file calling `pi.setActiveTools` without `image_gen` on `session_start`) disables the tool; Expected: (a) and (b) declare `image_gen` on the first prompt; (c) does not and the session file has one `image_gen.exposure` entry with `hiddenByExtension: true`; in the disabled run the tool stays undeclared across prompts and no `image_gen.exposure` entry is written; `pi -ne -e … -xt image_gen` declares nothing and writes no entry.
- Ends when:
  - [ ] In (c), after `/login` for OpenAI inside the session, the next prompt declares `image_gen` and the file gains `hiddenByExtension: false`.
  - [ ] After `/tree` back to a node where the tool was extension-hidden, the next prompt with credentials re-enables it; after `/tree` to a node where the user had disabled it, it stays off.
- Handoff: Stage 2 receives the working decision and record.
- Replan when: `setActiveTools` inside `before_agent_start` does not change that prompt's declaration in the installed Pi, or `getBranch()` lacks `custom` entries; record the observed behavior and return to the parent — FDD §9.9 depends on both.

### Stage 2 — Skill visibility and handoff
- Starts when: Stage 1's matrix passes.
- Work: Add the `imagegen` skill filter in `before_agent_start`; write the handoff.
- Deliverable: `docs/handoffs/image-gen/05-exposure.json` with `status`, `predicate`, `evaluationPoints`, `decisionTable`, `branchRecord` (type, shape), `skillFilter`, `observedMatrix`, `piBehaviors` (resume/reload/tree/exclude facts observed), `unresolved`.
- Verify: `Inspect the skills section of the system prompt in the session file`; Inputs: sessions (a) and (c) from Stage 1 started with `--skill packages/pi-codex-image-gen/skills/imagegen`; Expected: (a) lists `imagegen`; (c) does not list it while other skills remain; after `/login` in (c) the next prompt lists it; in the user-disabled run it is not listed.
- Ends when:
  - [ ] `/skill:imagegen` still works when invoked explicitly in (c) and its guidance tells the user to `/login` or set `OPENAI_API_KEY`.
  - [ ] The handoff validates as JSON.
- Handoff: `docs/briefs/2026-10-05-chore-codex-image-gen-06-verification.md` receives `docs/handoffs/image-gen/05-exposure.json`.
- Replan when: mutating `event.systemPromptOptions.skills` does not change the rendered prompt; record and return to the parent.
- Worker decision: Whether to keep an in-memory exposure state per session in addition to the branch record, as long as the branch record is authoritative after `/tree`.

## Side Effect Checkpoints
- [ ] Other tools' active state is identical before and after each evaluation (compare `getActiveTools()` minus `image_gen`).
- [ ] No evaluation performs a network request or token refresh (`getProviderAuth` is not called here).
- [ ] `01`, `02`, `03`, `04` behaviors are unchanged; `tool.ts`, `backend.ts`, `reference-images.ts`, `skills/**` have no diff from this child.
- [ ] Session files gain `image_gen.exposure` entries only on state changes (no entry per prompt).
- [ ] `packages/pi-codex-auto-review` has no diff; `npm run build && npm run check` exit 0.

## Acceptance Criteria
- [ ] The credential matrix (login / API key / none / user-disabled / excluded) produces the declarations and skill listings specified in Stages 1–2.
- [ ] Mid-session `/login` exposes the tool and skill on the next prompt without restart; a user-disabled tool is never re-enabled while credentials exist.
- [ ] `/tree` navigation respects the branch record; resume and `/reload` re-evaluate credentials.
- [ ] `docs/handoffs/image-gen/05-exposure.json` exists with `status: "complete"`.

## Open Questions
- None — the user fixed "unusable without credentials", "never re-enable a user-disabled tool", and "hide the skill with the tool"; the remaining items are technical confirmations with `Replan when` routes.
