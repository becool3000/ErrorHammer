# Tasks
## Current Focus
1. Mobile compact shell chain `PLN-005 -> BLD-005 -> TW-005 -> VF-005 -> DOC-005` is fully closed on `main`.
2. Name + Hour chain `PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006` is fully closed on `main`.
3. Crew + event depth chain `PLN-007 -> BLD-007 -> TW-007 -> VF-007 -> DOC-007` is fully closed on `main`.
4. `PLN-008` is now active and defines a rolling Builder session for ongoing UI/UX iteration on `main`.
5. `BLD-008` is the only active `IN_PROGRESS` lane card and remains open until the user explicitly ends the Builder session.
6. `TW-008`, `VF-008`, and `DOC-008` stay deferred until the rolling Builder session is closed.
7. `PLN-009 -> BLD-009 -> TW-009 -> VF-009 -> DOC-009` is fully closed on `main`.
8. `obsidian_vault/Tasks.md` `Active Lane Board (Kanban)` remains the handoff source of truth.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-01.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Every lane updates this board at start and completion.

### Lane Cards
| Card ID | Lane       | Status      | Priority | Depends On | Source Task                                                                | Exit Evidence                                                                                                                                                                                              |
| ------- | ---------- | ----------- | -------- | ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLN-001 | Planner    | DONE        | P0       | N/A        | `Error Hammer workflow + vault reset planning`                             | `Agents.md` and active vault docs rewritten for Error Hammer baseline; legacy source project carryover archived to one migration note.                                                                     |
| PLN-002 | Planner    | DONE        | P0       | PLN-001    | `Spec.md MVP implementation planning lock + chain supersession`            | `Vision.md`, `Decisions.md`, `Tasks.md`, `Testing.md`, `README.md`, and `Agents.md` updated with decision-complete `BLD-002` handoff and acceptance gates.                                                 |
| BLD-001 | Builder    | SUPERSEDED  | P0       | PLN-001    | `Error Hammer MVP bootstrap implementation (legacy baseline chain)`        | Superseded by `BLD-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                        |
| TW-001  | TestWriter | SUPERSEDED  | P0       | BLD-001    | `Deterministic bootstrap scenarios and assertions (legacy baseline chain)` | Superseded by `TW-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                         |
| VF-001  | Verifier   | SUPERSEDED  | P0       | TW-001     | `Bootstrap verification and bug-fix patching (legacy baseline chain)`      | Superseded by `VF-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                         |
| DOC-001 | Documenter | SUPERSEDED  | P0       | VF-001     | `Bootstrap documentation closeout (legacy baseline chain)`                 | Superseded by `DOC-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                        |
| BLD-002 | Builder    | DONE        | P0       | PLN-002    | `Spec.md full MVP bootstrap implementation`                                | Implemented runtime/core/ui/content/schema/scripts/tests scaffold, emitted `src/generated/content.bundle.json`, and added command-gate CI in `.github/workflows/ci.yml`.                                   |
| TW-002  | TestWriter | DONE        | P0       | BLD-002    | `Deterministic full-spec scenarios and assertions`                         | Implemented deterministic scenarios `EH-TW-001..EH-TW-016` in `tests/tw_scenarios.test.ts` with explicit day-resolution pass/fail assertions.                                                              |
| VF-002  | Verifier   | DONE        | P0       | TW-002     | `Full bootstrap verification and validated bug-fix patching`               | Checklist PASS for validate/compile/test/build, deterministic replay parity PASS, and headless manual smoke PASS (see `obsidian_vault/Testing.md`).                                                        |
| DOC-002 | Documenter | DONE        | P0       | VF-002     | `Bootstrap documentation closeout`                                         | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to final verified behavior and board state.                                                                                  |
| PLN-003 | Planner    | DONE        | P1       | N/A        | `Deterministic bot tool-buy economy planning lock`                         | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete `BLD-003` handoff and acceptance gates.                                                                           |
| BLD-003 | Builder    | DONE        | P1       | PLN-003    | `Deterministic bot tool-buy economy implementation`                        | Added shared bot planning helper and resolver end-of-day bot purchase phase with deterministic tie-breaks and day log purchase lines.                                                                      |
| TW-003  | TestWriter | DONE        | P1       | BLD-003    | `Deterministic bot-buy scenarios and helper tie-break assertions`          | Added `EH-TW-017..EH-TW-021` plus helper tie-break coverage in `tests/tw_scenarios.test.ts`, `tests/bots.test.ts`, and `tests/resolver.test.ts`.                                                           |
| VF-003  | Verifier   | DONE        | P1       | TW-003     | `Bot-buy economy verification and deterministic replay evidence`           | Verified validate/compile/test/build gates, deterministic purchase and no-purchase replay parity, and headless dev-server smoke probe PASS (see `obsidian_vault/Testing.md`).                              |
| DOC-003 | Documenter | DONE        | P1       | VF-003     | `Bot-buy economy documentation closeout`                                   | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified bot-buy behavior and board state.                                                                                |
| PLN-004 | Planner    | DONE        | P0       | N/A        | `Itch.io HTML packaging planning lock`                                     | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete `BLD-004` handoff and packaging acceptance gates.                                                                 |
| BLD-004 | Builder    | DONE        | P0       | PLN-004    | `Itch.io-relative production asset path implementation`                    | Set Vite production base to `./` so built HTML uses relative asset URLs for static HTML uploads.                                                                                                           |
| TW-004  | TestWriter | DONE        | P0       | BLD-004    | `Relative asset-path packaging assertion`                                  | Added deterministic config assertion `EH-TW-022` in `tests/vite_config.test.ts`.                                                                                                                           |
| VF-004  | Verifier   | DONE        | P0       | TW-004     | `Itch packaging verification and ZIP evidence`                             | Verified validate/compile/test/build gates, relative asset references in `dist/index.html`, and generated an upload ZIP with `3` files from `dist/`.                                                       |
| DOC-004 | Documenter | DONE        | P0       | VF-004     | `Itch publish documentation closeout`                                      | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified itch packaging behavior and board state.                                                                         |
| PLN-005 | Planner    | DONE        | P0       | N/A        | `Mobile-compact UI and UX redesign planning lock`                          | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete compact-shell handoff and acceptance gates.                                                                       |
| BLD-005 | Builder    | DONE        | P0       | PLN-005    | `Compact mobile-first black/silver app-shell redesign`                     | Replaced the flat page stack with a compact bottom-tab shell, overlay components, segmented store flow, compact work view, contract carousel, and industrial dark theme across `src/ui/**`.                |
| TW-005  | TestWriter | DONE        | P0       | BLD-005    | `Deterministic compact-shell interaction scenarios`                        | Added `tests/ui_shell.test.tsx` with deterministic UI scenarios `EH-TW-023..EH-TW-034` covering new game, continue, tab routing, overlays, store sections, and supplier sheet behavior.                    |
| VF-005  | Verifier   | DONE        | P0       | TW-005     | `Mobile-width shell verification and validated UI bug fixes`               | Verified `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`; validated the compact shell with mobile-width interaction coverage and patched only UI-shell regressions. |
| DOC-005 | Documenter | DONE        | P0       | VF-005     | `Compact-shell documentation closeout`                                     | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified compact-shell behavior and 2026-03-01 board state.                                                               |
| PLN-006 | Planner    | DONE        | P0       | PLN-005    | `Name + Hour flow planning lock`                                           | Capture acceptance gates for title-name prompts, hours terminology, quick-buy tooling, and modal-only company details plus the `PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006` lane chain.             |
| BLD-006 | Builder    | DONE        | P0       | PLN-006    | `Implement Name + Hour flow`                                               | Add player/company name persistence, hour-labelled UI, quick-buy contract flow, and company tab buttons without inline summary content.                                                                    |
| TW-006  | TestWriter | DONE        | P0       | BLD-006    | `Deterministic Name + Hour scenarios`                                      | Add `EH-TW-040..EH-TW-042` plus UI quick-buy assertions (`EH-TW-039`) and document expected outcomes.                                                                                                      |
| VF-006  | Verifier   | DONE        | P0       | TW-006     | `Name + Hour verification checklist`                                       | Run content validate/compile, `npm test`, `npm run build`, and manual/title-name + quick-buy + company tab smoke steps; record results.                                                                    |
| DOC-006 | Documenter | DONE        | P0       | VF-006     | `Document Name + Hour flow`                                                | Update README usage/testing sections and obsidian vault summaries to capture the new flow, scenarios, and lane chain.                                                                                      |
| PLN-007 | Planner    | DONE        | P1       | PLN-006    | `Gameplay depth planning lock`                                             | `Vision.md`, `Decisions.md`, `Tasks.md`, and `README.md` updated with deterministic crew-hiring, active-job assignee, event-cue scope, risks, deliverables, and a Builder-ready `BLD-007` handoff.         |
| BLD-007 | Builder    | DONE        | P1       | PLN-007    | `Implement crew + event depth`                                             | Added deterministic crew hiring, active-job assignee support, save-safe assignee defaults, and work-hero event cues in the compact shell without introducing new randomness.                               |
| TW-007  | TestWriter | DONE        | P1       | BLD-007    | `Deterministic crew/event scenarios`                                       | Added deterministic scenarios `EH-TW-044..EH-TW-049` for crew hire gating, assignee stamina/lock behavior, save-safe defaults, crew-modal hiring, and work-tab event cues.                                 |
| VF-007  | Verifier   | DONE        | P1       | TW-007     | `Crew + event verification checklist`                                      | Verified `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`; all `EH-TW-044..EH-TW-049` checks passed and no validated bug patch was required.                         |
| DOC-007 | Documenter | DONE        | P1       | VF-007     | `Document crew + event depth`                                              | Synced README usage/testing sections and vault artifacts to the verified crew workflow, event cues, scenario coverage, and `VF-007` evidence.                                                              |
| PLN-008 | Planner    | DONE        | P1       | DOC-007    | `Rolling Builder session planning lock for ongoing UI/UX iteration`        | `Vision.md`, `Decisions.md`, `Tasks.md`, and `README.md` updated with a decision-complete rolling `BLD-008` handoff, session guardrails, and explicit close conditions.                                    |
| BLD-008 | Builder    | IN_PROGRESS | P1       | PLN-008    | `Rolling UI/UX iteration session`                                          | Session remains active until the user explicitly says Builder is done; Builder ships small `[Builder]` commits, stays within UI/UX plus directly supporting refinements, and pauses on feature drift.      |
| TW-008  | TestWriter | READY       | P1       | BLD-008    | `Deterministic coverage for final BLD-008 session delta`                   | Trigger only after the user closes `BLD-008`; convert the final Builder delta into deterministic scenarios, pass/fail criteria, and any manual UX smoke steps.                                             |
| VF-008  | Verifier   | READY       | P1       | TW-008     | `Verification closeout for final BLD-008 session delta`                    | Trigger only after `TW-008`; run the command checklist, execute the `TW-008` scenarios, patch only validated defects, and record evidence tied to the final Builder batch set.                             |
| DOC-008 | Documenter | READY       | P1       | VF-008     | `Documentation sync for final BLD-008 session delta`                       | Trigger only after `VF-008`; sync README/vault notes to the final verified UI/UX behavior and close the rolling session chain.                                                                             |
| PLN-009 | Planner    | DONE        | P1       | PLN-008    | `Skill level-up visibility, Operator Level, and progression popup system`  | `Vision.md`, `Decisions.md`, and `Tasks.md` updated with a decision-complete progression handoff; the chain is explicitly queued outside active `BLD-008`.                                                 |
| BLD-009 | Builder    | DONE        | P1       | PLN-009    | `Implement skill levels, Operator Level, and progression popups`           | Added tiered level-threshold helpers, derived Operator Level, work-shell/operator-card progression UI, expanded skill labels, and deterministic progression popup queueing without new RNG.                |
| TW-009  | TestWriter | DONE        | P1       | BLD-009    | `Deterministic progression math and popup scenarios`                       | Added deterministic threshold math, popup ordering, readable skill-label, and persistent-popup assertions through `EH-TW-054..EH-TW-061`.                                                                  |
| VF-009  | Verifier   | DONE        | P1       | TW-009     | `Progression system verification checklist`                                | Verified `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`; recorded PASS evidence for progression helpers, popup persistence, and manual smoke confirmation.         |
| DOC-009 | Documenter | DONE        | P1       | VF-009     | `Document progression visibility and popup system`                         | Sync README/vault notes to verified skill-level, Operator Level, expanded skill set, and manual-dismiss popup behavior after `VF-009` closeout.                                                            |

### Supersession Archive
| Superseded Card | Replacement Card | Date | Reason |
| --------------- | ---------------- | ---- | ------ |
| BLD-001 | BLD-002 | 2026-02-27 | `PLN-002` replaced baseline bootstrap chain with full `Spec.md` decision-complete implementation scope. |
| TW-001 | TW-002 | 2026-02-27 | `PLN-002` expanded deterministic scenario contract to `EH-TW-001..EH-TW-016`. |
| VF-001 | VF-002 | 2026-02-27 | `PLN-002` aligned verifier checklist and evidence expectations to the new Builder/TestWriter chain. |
| DOC-001 | DOC-002 | 2026-02-27 | `PLN-002` moved documentation closeout dependency to the new verification chain. |

## [TASK] Compact Shell Redesign Chain (`PLN-005`)
Status: Completed on 2026-03-01 with all lane cards in `DONE` state.

### Problem Statement
1. The original UI stacked too much information vertically on mobile and forced long scrolls across active work, contracts, store, and company views.
2. The runtime lacked a compact navigation shell for fast mobile interaction and nested detail views.
3. The visual treatment remained light and flat instead of the requested black/silver industrial dashboard direction.

### Goals
1. Replace the flat page-stack UI with a compact mobile-first shell driven by bottom tabs and overlays.
2. Keep `Work` focused on active-job execution and current task actions.
3. Move contracts, store, and company information into tighter nested views with clear click targets.
4. Add deterministic UI interaction coverage for the new shell without changing gameplay logic.

### Constraints
1. No gameplay logic changes in resolver or content systems.
2. UI-only navigation state must stay separate from core gameplay state.
3. Mobile layout rules drive the shell and desktop must scale from that same information model.
4. Production build and itch packaging behavior must remain valid.

### Completion Evidence
#### Builder (`BLD-005`)
1. Replaced the old `Title/Main/Store/Company` routing shell with a title screen plus a compact `GameShell`.
2. Added bottom navigation, compact header, modal, bottom-sheet, contract carousel, and segmented control components.
3. Split tab content into focused `Work`, `Contracts`, `Store`, and `Company` compact views with overlay-based details.
4. Replaced the light theme with a black/gunmetal/silver industrial dashboard CSS system.

#### TestWriter (`TW-005`)
1. Added deterministic UI scenarios `EH-TW-023..EH-TW-034` in `tests/ui_shell.test.tsx`.
2. Covered title start, continue restore, empty work CTA, contract acceptance routing, store segmentation, company overlays, bottom-nav state retention, and supplier sheet rendering.
3. Increased automated totals to `44` tests across `7` files.

#### Verifier (`VF-005`)
1. Verified `npm run content:validate` PASS.
2. Verified `npm run content:compile` PASS with emitted bundle path.
3. Verified `npm test` PASS (`7` files, `44` tests).
4. Verified `npm run build` PASS with the compact shell assets emitted for production.
5. Validated compact-shell behavior through the new mobile-focused UI interaction scenarios and patched only UI-shell issues revealed during verification.

#### Documenter (`DOC-005`)
1. Updated README usage/testing sections for the compact bottom-tab shell.
2. Updated `Vision.md`, `Decisions.md`, and `Testing.md` to reflect the new runtime baseline and verification evidence.
3. Updated this board to record `PLN-005 -> DOC-005` closeout state.
4. Documented `EH-TW-043` title-screen persistence scenario, the gated `New Game` requirement, and the manual return-to-title check in README/testing references.

### Exit Evidence
1. Planner: complete (`PLN-005`).
2. Builder: complete (`BLD-005`).
3. TestWriter: complete (`TW-005`).
4. Verifier: complete (`VF-005`).
5. Documenter: complete (`DOC-005`).

## [TASK] Gameplay Depth Chain (`PLN-007`)
Status: Planned on 2026-03-01 after the Name + Hour chain (`PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006`) closed on 2026-03-01.

### Problem Statement
1. Crew progression is marked as deferred (`bundle.strings.crewDeferred`) even though `Spec.md` calls for up to three crews and the runtime already carries `CrewState`; the player never hires or assigns crew, so the "rising from solo contractor to small company" arc is incomplete.
2. Active events currently only appear in logs, so players miss the chance to plan quick buys or tool purchases around modifiers and tag-based cues before accepting contracts.
3. The compact shell lacks any explicit signal for the new depth we want to ship, leaving quick-buy tooling and event timing feeling like afterthoughts instead of strategic touchpoints.
4. The shipped player loop runs through `playerFlow.ts` and one active job at a time, while `resolver.ts` already supports `assignee`; the next Builder handoff must bridge that seam explicitly instead of assuming the old assignment screen still exists.

### Goals
1. Replace the crew placeholder with a deterministic crew unlock and hire flow that integrates with the existing `CrewState` data, the active-job shell, and the company tab UI so the player can see names, stamina, and available slots instead of a deferred stub.
2. Add an explicit assignee choice for the compact shell's active-job flow so accepted jobs can be worked by `self` or one hired crew without introducing a new navigation model or a second contract board.
3. Surface active event headlines, impact lines, and tag clues on the `Work` tab hero so players can immediately see what modifiers are live and adjust quick-buy or contract choices without scrolling through logs.
4. Keep the compact shell layout intact, preserve the seeded randomness surface area, and limit the new depth to data already shipped or static runtime constants so no new RNG pathways open.

### Constraints
1. Crew assignments must continue to honor the deterministic stamina, tool-gating, and tie-break rules already present in core modules so the resolution contract still holds.
2. UI additions must live within existing tabs/modals (work hero, company tab) and avoid introducing new navigation shells or full-page screens.
3. The crew cap remains three; hiring is gated by company progression so we preserve the scrappy vibe and avoid introducing new content files outside `content/strings`.
4. Existing saves from the verified `DOC-006` baseline must load safely; any new active-job assignee or crew metadata needs defaults or a guarded compatibility path.
5. Builder scope remains incremental: no new district, tool, event, or bot content packs are required to land `BLD-007`.

### Risks
1. The current player loop lives in `src/core/playerFlow.ts`, but crew-aware stamina plumbing already exists in `src/core/resolver.ts`; duplicating rules between those paths is the main regression risk for `BLD-007`.
2. Adding assignee state to the active job can break save/continue or quick-buy gating if the default path for existing saves is not defined up front.
3. Crew stats (`efficiency`, `reliability`, `morale`) exist in `CrewState` but have no verified gameplay meaning yet; Builder must keep their first-use bonuses small and deterministic so the shell does not drift from the current balance baseline.
4. Event cues can easily turn into noisy copy if the `Work` hero dumps full event text; Builder needs a compact read-only presentation that preserves the shell's dense mobile layout.

### Deliverables
1. A deterministic hire action that replaces the deferred crew button, unlocks at `companyLevel >= 2`, fills the lowest open crew slot, persists through save/load, and records a clear log or notice line.
2. Compact-shell assignee controls that let the player choose `self` or one hired crew for the current accepted job, with a safe default of `self` for old and new saves until changed.
3. Active-job task execution that spends the selected assignee's stamina, keeps tool/material gating intact, and records assignee-aware log lines without introducing unseeded randomness.
4. A `Work` hero event-cue block that renders each active event's `headline`, `impact_line`, and concise tag cues derived from existing event modifiers.
5. Updated company modal content that shows roster slots, live crew stats, unlock gating, and hire CTA state in place of the deferred placeholder.

### Completion Evidence
#### Builder (`BLD-007`)
1. Implement crew unlock and hire logic in the player-facing flow (`src/core/playerFlow.ts`, `src/core/resolver.ts`, and save-safe state wiring as needed) so hiring at `companyLevel >= 2` creates deterministic crew records, persists them, and records visible evidence in notices/logs.
2. Add compact-shell assignee selection to the current accepted-job flow so `self` or a hired crew can work the active job, and route stamina/tool usage through the same deterministic gating rules already enforced by core modules.
3. Replace the deferred crew modal copy with a live roster view that shows slot state, stamina, and hire availability while keeping the `Company` experience modal-only.
4. Surface active event data (`headline`, `impact_line`, tag cues) in the `Work` hero without changing event generation, modifier math, or the compact shell navigation model.
5. Preserve `main` save/continue behavior by defaulting existing saves to `self` assignee state and guarding any newly introduced fields.

### Builder Handoff (`BLD-007`)
1. Start from the shipped compact-shell path, not the old `Main`/assignment-panel route: the player-facing workflow lives in `src/ui/screens/ContractsTab.tsx`, `src/ui/screens/WorkTab.tsx`, `src/ui/screens/CompanyTab.tsx`, `src/ui/state.ts`, and `src/core/playerFlow.ts`.
2. Treat `src/core/resolver.ts` as the rule reference for crew stamina semantics, but do not rebuild the legacy day-intent screen to make crews playable in this chain.
3. Add a single active-job assignee field with a safe default of `self`, expose it in the compact shell, and keep quick-buy, accept-contract, and end-shift behavior intact for the no-crew path.
4. Use a fixed three-slot deterministic roster/order for hires so the feature stays testable without adding new RNG calls or broad content/schema work.
5. Keep any first-pass crew stat effects small, explicit, and deterministic; if a stat has no verified gameplay effect yet, display it in UI but avoid inventing hidden systems around it.
6. Leave the board ready for `TW-007` by making assignee changes and event cues easy to assert in unit tests, scenario tests, and UI-shell tests.

#### TestWriter (`TW-007`)
1. Add deterministic unit and scenario coverage for crew hiring, assignee stamina use, assignee-aware log entries, and event hero visibility.
2. Extend scenario suites with new cases for unlock gating, save-safe default assignee behavior, assignment success, and event cue rendering.
3. Update UI-shell scenarios as needed to confirm the `Work` hero surfaces event cue text and that company modals list newly hired crews.

#### Verifier (`VF-007`)
1. Re-run `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` once crew/event changes land.
2. Perform a manual crew hire simulation (reach company level 2, hire, assign crew) and confirm stamina drains, logs, and event hero messaging appear deterministically.
3. Record event cue evidence plus crew assignment data in `obsidian_vault/Testing.md`.

#### Documenter (`DOC-007`)
1. Update README usage/testing sections to describe the crew unlock path, crew assignment expectations, new event hero cues, and the tests that prove them.
2. Sync `Vision.md`, `Decisions.md`, and `Testing.md` with the crew/event planning chain and its verification evidence.

### Exit Evidence
1. Planner: complete (`PLN-007`).
2. Builder: complete (`BLD-007`).
3. TestWriter: complete (`TW-007`).
4. Verifier: complete (`VF-007`).
5. Documenter: complete (`DOC-007`).

## [TASK] Rolling Builder Session (`PLN-008`)
Status: Active on 2026-03-01 after `DOC-007` closed the crew + event depth chain.

### Problem Statement
1. The project needs sustained UI/UX iteration without reopening Planner for every small adjustment.
2. A normal one-card feature chain would create unnecessary handoff overhead for incremental polish work.
3. Without explicit guardrails, open-ended UI refinement can drift into gameplay or content changes that should be separately planned and verified.

### Goals
1. Create one long-running Builder session for many small UI/UX improvements on `main`.
2. Keep Builder shipping small, focused `[Builder]` commits while preserving current deterministic gameplay behavior.
3. Defer TestWriter, Verifier, and Documenter until the user explicitly ends the Builder session.
4. Make the stop conditions and pause conditions explicit so Builder can work autonomously without scope confusion.

### Constraints
1. Builder scope is UI/UX first: layout, hierarchy, navigation clarity, copy, affordances, interaction polish, and visual cleanup.
2. Small supporting changes outside `src/ui/**` are allowed only when required to make the UX work cleanly and without introducing new gameplay scope.
3. Builder must preserve pure core logic in `src/core/**`, route randomness through seeded `rng.ts`, and keep UI state transitions resolver-driven.
4. Builder must pause for Planner input before adding gameplay systems, economy/progression rule changes, substantial new content scope, or broader product redesign.
5. Later lanes do not begin until the user explicitly ends `BLD-008`.

### Risks
1. Scope creep can turn UI/UX polish into feature work without a fresh planning decision.
2. A long-running Builder session can accumulate verification debt if commit intent is not kept clear.
3. Fast UI iteration can leak business logic into components if resolver boundaries are not enforced.
4. README/vault summaries can temporarily lag the in-progress Builder state until the session is formally closed.

### Deliverables
1. A rolling `BLD-008` lane card marked `IN_PROGRESS` with explicit session-close evidence.
2. A Builder handoff that authorizes repeated small UI/UX commits without repeated Planner restarts.
3. Explicit deferred follow-on cards `TW-008`, `VF-008`, and `DOC-008` that activate only after user-directed session close.

### Builder Handoff (`BLD-008`)
1. Prioritize player-facing clarity first: navigation, affordances, spacing, hierarchy, copy, and state visibility.
2. Prefer small focused edits that each improve one part of the experience rather than broad rewrites.
3. If a UI problem requires a narrow supporting code change outside the UI layer, implement the smallest change that preserves current gameplay rules.
4. Commit frequently on `main` with `[Builder]` messages that describe the UI/UX intent of the batch.
5. Keep a short running handoff summary after each batch so the final `TW-008` pass can identify what changed.
6. Pause and ask for Planner input before adding gameplay systems, changing economy/progression/event math, expanding content scope, or drifting into product redesign.
7. When the user explicitly says the Builder session is done, stop implementation and hand off the consolidated session delta to `TW-008`.

### Exit Evidence
1. Planner: complete (`PLN-008`).
2. Builder: still active (`BLD-008`) until explicit user close.
3. TestWriter: deferred (`TW-008`) until `BLD-008` closes.
4. Verifier: deferred (`VF-008`) until `TW-008` closes.
5. Documenter: deferred (`DOC-008`) until `VF-008` closes.

## [TASK] Skill Level-Up Visibility + Operator Progression (`PLN-009`)
Status: Completed on 2026-03-01. This chain was executed and verified on `main` while the rolling `BLD-008` UI session remained open.

### Problem Statement
1. Raw skill XP already exists in runtime state, but players cannot see an explicit skill level, progress to the next level, or an overall Operator Level summary.
2. The current hidden `100 XP = 1 rank` math is not suitable as a visible progression model because it does not communicate early-vs-late pacing or progress milestones.
3. XP gains currently land silently, so the player gets no celebratory feedback when a skill improves or when their broader operator progression increases.
4. The next implementation must expose progression clearly without adding perk trees, stat unlocks, or non-deterministic reward systems.

### Goals
1. Make each player skill show a visible Level plus raw XP using a tiered cumulative curve.
2. Add an Operator Level derived from average raw XP across all tracked player skills.
3. Add deterministic, presentation-only progression popups for XP gains, skill level-ups, and Operator level-ups.
4. Keep all progression math pure, save-safe, and compatible with the compact-shell architecture already on `main`.

### Constraints
1. No new RNG, perk unlocks, payout bonuses, stamina bonuses, or other progression rewards are introduced in this phase.
2. Gameplay logic must remain pure in `src/core/**`, and UI state transitions must stay resolver/store-driven.
3. Raw skill XP remains the only persisted source of truth; visible levels and Operator Level are derived at runtime.
4. Popup queues do not persist across reload and must not replay retroactively on continue/load.
5. This chain is outside the scope of `BLD-008`; Builder must not silently fold it into the rolling UI session.

### Deliverables
1. Pure helper functions for threshold translation, progress-to-next-level, and Operator Level derivation from average raw XP.
2. Player-facing skill displays that show Level and XP rather than ambiguous hidden rank semantics.
3. An Operator card display that surfaces `Operator Lv X` and related progression context.
4. A deterministic popup queue with escalating presentation tiers for XP gain, skill level-up, and Operator level-up events.
5. Deterministic test coverage for threshold math, popup ordering, and shell rendering once later lanes begin.

### Completion Evidence
#### Builder (`BLD-009`)
1. Add pure progression helpers that translate raw XP into visible levels with the cumulative thresholds `0, 100, 250, 450, 650, 850, ...` and `+200 XP` for each later level.
2. Derive Operator Level from average raw XP across all tracked player skills using the same threshold helper functions.
3. Update player-facing skill displays and the `Work` operator card to show visible Level and XP information while keeping raw XP as the only persisted source of truth.
4. Enqueue deterministic progression popups after XP-granting actions in this order: one combined XP popup, one popup per skill level-up, then one Operator level-up popup if triggered.
5. Preserve save/load compatibility, avoid retroactive popup replay on load, and keep the feature free of perks, unlock trees, or new RNG paths.

#### TestWriter (`TW-009`)
1. Add pure math assertions for threshold boundaries, progress calculations, and Operator Level derivation from average raw XP.
2. Add deterministic scenario coverage for XP-only gains, skill-threshold crossings, and combined `XP -> skill -> Operator` popup ordering.
3. Extend UI-shell tests to confirm visible Level/XP rows in the Skills view, Operator Level in the operator card, and deterministic popup queue behavior.

#### Verifier (`VF-009`)
1. Re-run `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` after progression changes land.
2. Manually verify XP-only, skill-level-up, and Operator-level-up action flows, including popup ordering and escalating visual treatment.
3. Confirm save/load preserves raw XP and derived visible levels without replaying stale popups.

#### Documenter (`DOC-009`)
1. Sync README usage/testing/workflow notes to the verified progression system once `VF-009` closes.
2. Update vault summaries to reflect the visible skill levels, Operator Level, popup queue behavior, and final evidence chain.

### Builder Handoff (`BLD-009`)
1. Add pure helpers under `src/core/**` for `xp -> level`, XP floor/ceiling per level, progress-to-next-level, and Operator Level from average raw XP.
2. Use the tiered cumulative thresholds `0, 100, 250, 450, 650, 850, ...`; early levels should be faster, then increase by `200 XP` per level from level 5 onward.
3. Treat raw skill XP as the only persisted progression state; visible skill levels and Operator Level must always be derived from that XP.
4. Replace player-facing uses of hidden `rank` wording with `level` wording where progression is shown in UI.
5. Add a compact `Operator Lv X` display to the `Work` shell operator card plus a clearer Skills view that shows skill name, level, raw XP, and progress to the next level.
6. Generate progression popups by comparing previous and next state after XP-granting actions using existing `TaskUnitResult.skillXpDelta` output.
7. Queue only one active popup at a time and render multiple events in stable order:
   1. `XP Earned`
   2. `Skill Leveled Up`
   3. `Operator Leveled Up!`
8. Keep popup copy concise and deterministic:
   1. XP popup lines like `Procurement +10`
   2. Skill popup lines like `Procurement reached Lv 2`
   3. Operator popup lines like `Operator reached Lv 3`
9. Popups are presentation-only in this phase; do not add perk unlocks, stat bonuses, content packs, or replay-on-load behavior.
10. Keep the resulting implementation easy for `TW-009` to assert through pure helper tests, scenario tests, and UI-shell tests.

### Risks
1. Changing the XP-to-level curve changes gameplay pacing because visible level math also drives existing skill effectiveness.
2. Popup spam could become noisy if every XP grant produces too many separate messages.
3. Mixed use of `rank` and `level` language could leave the codebase and UI inconsistent if not normalized carefully.
4. Queue bugs could cause progression popups to drop, duplicate, or render out of order.

### Mitigations
1. Centralize the threshold curve and progress calculations in one pure helper path under `src/core/**`.
2. Use one combined XP popup per action rather than one popup per XP delta line item.
3. Rename player-facing progression language consistently to `level` where the feature is shown.
4. Drive popup creation from deterministic previous/next state comparison rather than from ad hoc UI-side heuristics.

### Exit Evidence
1. Planner: complete (`PLN-009`).
2. Builder: complete (`BLD-009`).
3. TestWriter: complete (`TW-009`).
4. Verifier: complete (`VF-009`).
5. Documenter: complete (`DOC-009`).
