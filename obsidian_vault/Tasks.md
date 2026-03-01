# Tasks
## Current Focus
1. Mobile compact shell chain `PLN-005 -> BLD-005 -> TW-005 -> VF-005 -> DOC-005` is fully closed on `main`.
2. Name + Hour chain `PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006` is fully closed on `main`.
3. Lane cards `BLD-006`, `TW-006`, `VF-006`, and `DOC-006` are complete with recorded exit evidence.
4. `obsidian_vault/Tasks.md` `Active Lane Board (Kanban)` remains the handoff source of truth.
5. The board is ready for `PLN-007` to start the next gameplay-depth planning handoff.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-01.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Every lane updates this board at start and completion.

### Lane Cards
| Card ID | Lane       | Status     | Priority | Depends On | Source Task                                                                | Exit Evidence                                                                                                                                                                                              |
| ------- | ---------- | ---------- | -------- | ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLN-001 | Planner    | DONE       | P0       | N/A        | `Error Hammer workflow + vault reset planning`                             | `Agents.md` and active vault docs rewritten for Error Hammer baseline; legacy source project carryover archived to one migration note.                                                                     |
| PLN-002 | Planner    | DONE       | P0       | PLN-001    | `Spec.md MVP implementation planning lock + chain supersession`            | `Vision.md`, `Decisions.md`, `Tasks.md`, `Testing.md`, `README.md`, and `Agents.md` updated with decision-complete `BLD-002` handoff and acceptance gates.                                                 |
| BLD-001 | Builder    | SUPERSEDED | P0       | PLN-001    | `Error Hammer MVP bootstrap implementation (legacy baseline chain)`        | Superseded by `BLD-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                        |
| TW-001  | TestWriter | SUPERSEDED | P0       | BLD-001    | `Deterministic bootstrap scenarios and assertions (legacy baseline chain)` | Superseded by `TW-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                         |
| VF-001  | Verifier   | SUPERSEDED | P0       | TW-001     | `Bootstrap verification and bug-fix patching (legacy baseline chain)`      | Superseded by `VF-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                         |
| DOC-001 | Documenter | SUPERSEDED | P0       | VF-001     | `Bootstrap documentation closeout (legacy baseline chain)`                 | Superseded by `DOC-002` per `PLN-002` (see `Supersession Archive`).                                                                                                                                        |
| BLD-002 | Builder    | DONE       | P0       | PLN-002    | `Spec.md full MVP bootstrap implementation`                                | Implemented runtime/core/ui/content/schema/scripts/tests scaffold, emitted `src/generated/content.bundle.json`, and added command-gate CI in `.github/workflows/ci.yml`.                                   |
| TW-002  | TestWriter | DONE       | P0       | BLD-002    | `Deterministic full-spec scenarios and assertions`                         | Implemented deterministic scenarios `EH-TW-001..EH-TW-016` in `tests/tw_scenarios.test.ts` with explicit day-resolution pass/fail assertions.                                                              |
| VF-002  | Verifier   | DONE       | P0       | TW-002     | `Full bootstrap verification and validated bug-fix patching`               | Checklist PASS for validate/compile/test/build, deterministic replay parity PASS, and headless manual smoke PASS (see `obsidian_vault/Testing.md`).                                                        |
| DOC-002 | Documenter | DONE       | P0       | VF-002     | `Bootstrap documentation closeout`                                         | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to final verified behavior and board state.                                                                                  |
| PLN-003 | Planner    | DONE       | P1       | N/A        | `Deterministic bot tool-buy economy planning lock`                         | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete `BLD-003` handoff and acceptance gates.                                                                           |
| BLD-003 | Builder    | DONE       | P1       | PLN-003    | `Deterministic bot tool-buy economy implementation`                        | Added shared bot planning helper and resolver end-of-day bot purchase phase with deterministic tie-breaks and day log purchase lines.                                                                      |
| TW-003  | TestWriter | DONE       | P1       | BLD-003    | `Deterministic bot-buy scenarios and helper tie-break assertions`          | Added `EH-TW-017..EH-TW-021` plus helper tie-break coverage in `tests/tw_scenarios.test.ts`, `tests/bots.test.ts`, and `tests/resolver.test.ts`.                                                           |
| VF-003  | Verifier   | DONE       | P1       | TW-003     | `Bot-buy economy verification and deterministic replay evidence`           | Verified validate/compile/test/build gates, deterministic purchase and no-purchase replay parity, and headless dev-server smoke probe PASS (see `obsidian_vault/Testing.md`).                              |
| DOC-003 | Documenter | DONE       | P1       | VF-003     | `Bot-buy economy documentation closeout`                                   | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified bot-buy behavior and board state.                                                                                |
| PLN-004 | Planner    | DONE       | P0       | N/A        | `Itch.io HTML packaging planning lock`                                     | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete `BLD-004` handoff and packaging acceptance gates.                                                                 |
| BLD-004 | Builder    | DONE       | P0       | PLN-004    | `Itch.io-relative production asset path implementation`                    | Set Vite production base to `./` so built HTML uses relative asset URLs for static HTML uploads.                                                                                                           |
| TW-004  | TestWriter | DONE       | P0       | BLD-004    | `Relative asset-path packaging assertion`                                  | Added deterministic config assertion `EH-TW-022` in `tests/vite_config.test.ts`.                                                                                                                           |
| VF-004  | Verifier   | DONE       | P0       | TW-004     | `Itch packaging verification and ZIP evidence`                             | Verified validate/compile/test/build gates, relative asset references in `dist/index.html`, and generated an upload ZIP with `3` files from `dist/`.                                                       |
| DOC-004 | Documenter | DONE       | P0       | VF-004     | `Itch publish documentation closeout`                                      | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified itch packaging behavior and board state.                                                                         |
| PLN-005 | Planner    | DONE       | P0       | N/A        | `Mobile-compact UI and UX redesign planning lock`                          | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete compact-shell handoff and acceptance gates.                                                                       |
| BLD-005 | Builder    | DONE       | P0       | PLN-005    | `Compact mobile-first black/silver app-shell redesign`                     | Replaced the flat page stack with a compact bottom-tab shell, overlay components, segmented store flow, compact work view, contract carousel, and industrial dark theme across `src/ui/**`.                |
| TW-005  | TestWriter | DONE       | P0       | BLD-005    | `Deterministic compact-shell interaction scenarios`                        | Added `tests/ui_shell.test.tsx` with deterministic UI scenarios `EH-TW-023..EH-TW-034` covering new game, continue, tab routing, overlays, store sections, and supplier sheet behavior.                    |
| VF-005  | Verifier   | DONE       | P0       | TW-005     | `Mobile-width shell verification and validated UI bug fixes`               | Verified `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`; validated the compact shell with mobile-width interaction coverage and patched only UI-shell regressions. |
| DOC-005 | Documenter | DONE       | P0       | VF-005     | `Compact-shell documentation closeout`                                     | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified compact-shell behavior and 2026-03-01 board state.                                                               |
| PLN-006 | Planner    | DONE       | P0       | PLN-005    | `Name + Hour flow planning lock`                                           | Capture acceptance gates for title-name prompts, hours terminology, quick-buy tooling, and modal-only company details plus the `PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006` lane chain.             |
| BLD-006 | Builder    | DONE       | P0       | PLN-006    | `Implement Name + Hour flow`                                               | Add player/company name persistence, hour-labelled UI, quick-buy contract flow, and company tab buttons without inline summary content.                                                                    |
| TW-006  | TestWriter | DONE       | P0       | BLD-006    | `Deterministic Name + Hour scenarios`                                      | Add `EH-TW-040..EH-TW-042` plus UI quick-buy assertions (`EH-TW-039`) and document expected outcomes.                                                                                                      |
| VF-006  | Verifier   | DONE       | P0       | TW-006     | `Name + Hour verification checklist`                                       | Run content validate/compile, `npm test`, `npm run build`, and manual/title-name + quick-buy + company tab smoke steps; record results.                                                                    |
| DOC-006 | Documenter | DONE       | P0       | VF-006     | `Document Name + Hour flow`                                                | Update README usage/testing sections and obsidian vault summaries to capture the new flow, scenarios, and lane chain.                                                                                      |
| PLN-007 | Planner    | READY      | P1       | PLN-006    | `Gameplay depth planning lock`                                             | Define crew hiring/resolver requirements and event cue acceptance gates so the `PLN-007 -> BLD-007 -> TW-007 -> VF-007 -> DOC-007` chain can deepen the loop after the Name + Hour flow closes.            |
| BLD-007 | Builder    | READY      | P1       | PLN-007    | `Implement crew + event depth`                                             | Add crew unlock/hire flow, resolve crew assignments, and surface active event cues in the compact shell without creating new randomness.                                                                   |
| TW-007  | TestWriter | READY      | P1       | BLD-007    | `Deterministic crew/event scenarios`                                       | Cover crew hiring, crew assignment resolution, and event cue visibility with new day-resolution scenarios plus updated UI helpers.                                                                         |
| VF-007  | Verifier   | READY      | P1       | TW-007     | `Crew + event verification checklist`                                      | Re-run content validate/compile, `npm test`, `npm run build`, and execute manual crew hire plus event cue smoke checks; capture evidence of deterministic resolution.                                      |
| DOC-007 | Documenter | READY      | P1       | VF-007     | `Document crew + event depth`                                              | Sync README usage/testing sections and vault artifacts to describe the new crew workflow, event cues, and associated tests/evidence.                                                                       |

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
Status: READY after the Name + Hour chain (`PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006`) closed on 2026-03-01.

### Problem Statement
1. Crew progression is marked as deferred (`bundle.strings.crewDeferred`) even though `Spec.md` calls for up to three crews and `resolver.ts` already tracks crew stamina; the player never hires or assigns crew, so the “rising from solo contractor to small company” arc is incomplete.
2. Active events currently only appear in logs, so players miss the chance to plan quick buys or tool purchases around modifiers and tag-based cues before accepting contracts.
3. The compact shell lacks any explicit signal for the new depth we want to ship, leaving quick-buy tooling and event timing feeling like afterthoughts instead of strategic touchpoints.

### Goals
1. Replace the crew placeholder with a deterministic crew unlock/hire flow that integrates with the existing `CrewState` data, resolver assignment handling, and company tab UI to show names, stamina, and their role in the ledger.
2. Surface active event headlines, impact lines, and tag clues on the `Work` tab hero so players can immediately see what modifiers are live and adjust quick-buy or contract choices without scrolling through logs.
3. Keep the compact shell layout intact, preserve the seeded randomness surface area, and limit the new depth to data we already ship (tools, events, strings) plus deterministic crew naming so no new RNG pathways open.

### Constraints
1. Crew assignments must continue to honor `resolver.ts`’s stamina tracker, tool gating, and tie-breakers so the deterministic resolution contract still holds.
2. UI additions must live within existing tabs/modals (work hero, company tab) and avoid introducing new navigation shells or full-page screens.
3. The crew cap remains three; hiring is gated by company progression so we preserve the scrappy vibe and avoid introducing new content files outside `content/strings`.

### Completion Evidence
#### Builder (`BLD-007`)
1. Implement crew unlock/hire logic in `playerFlow.ts` so `hireCrew()` instantiates deterministic crew records once `companyLevel >= 2`, appends crew log entries, and updates `GameState`.
2. Update `Contracts`/`Work` wiring so crew IDs can appear in assignment selectors and `resolver.ts` resolves crew assignments (stamina reduction, tool wear, log lines) using the existing `Intent.assignee` hooks.
3. Expand the `Company` modal to show live crew stats and rename the `crewDeferred` string, plus add new strings for the crew roster and event hero messaging.
4. Surface active event data (headline, impact_line, tag hints) in the `Work` hero so players immediately see modifiers without hunting through field logs.

#### TestWriter (`TW-007`)
1. Add deterministic resolver/unit tests covering crew hiring, crew stamina use, and log entries when a crew wins/losses a contract.
2. Extend scenario suites to include new day-resolution cases (`EH-TW-043..EH-TW-045`) verifying crew unlock gating, assignment success, and event hero text presence.
3. Update UI-shell scenarios as needed to confirm the `Work` hero surfaces the event headline/impact_line and that company modals list newly hired crews.

#### Verifier (`VF-007`)
1. Re-run `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` once crew/event changes land.
2. Perform a manual crew hire simulation (reach company level 2, hire, assign crew) and confirm resolver logs, stamina drains, and event hero messaging appear deterministically.
3. Record event cue evidence plus crew assignment data in `obsidian_vault/Testing.md`.

#### Documenter (`DOC-007`)
1. Update README usage/testing sections to describe the crew unlock path, crew assignment expectations, new event hero cues, and the tests that prove them.
2. Sync `Vision.md`, `Decisions.md`, and `Testing.md` with the crew/event planning chain and its verification evidence.

### Exit Evidence
1. Planner: ready (`PLN-007`).
2. Builder: ready (`BLD-007`).
3. TestWriter: ready (`TW-007`).
4. Verifier: ready (`VF-007`).
5. Documenter: ready (`DOC-007`).
