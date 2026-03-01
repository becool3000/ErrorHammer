# Tasks
## Current Focus
1. Mobile compact shell chain `PLN-005 -> BLD-005 -> TW-005 -> VF-005 -> DOC-005` is fully closed on `main`.
2. Lane cards `BLD-005`, `TW-005`, `VF-005`, and `DOC-005` are complete with recorded exit evidence.
3. New implementation work now requires a new Planner card (`PLN-006`) before additional runtime changes.
4. `obsidian_vault/Tasks.md` `Active Lane Board (Kanban)` remains the handoff source of truth.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-01.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Every lane updates this board at start and completion.

### Lane Cards
| Card ID | Lane | Status | Priority | Depends On | Source Task | Exit Evidence |
| ------- | ---- | ------ | -------- | ---------- | ----------- | ------------- |
| PLN-001 | Planner | DONE | P0 | N/A | `Error Hammer workflow + vault reset planning` | `Agents.md` and active vault docs rewritten for Error Hammer baseline; legacy source project carryover archived to one migration note. |
| PLN-002 | Planner | DONE | P0 | PLN-001 | `Spec.md MVP implementation planning lock + chain supersession` | `Vision.md`, `Decisions.md`, `Tasks.md`, `Testing.md`, `README.md`, and `Agents.md` updated with decision-complete `BLD-002` handoff and acceptance gates. |
| BLD-001 | Builder | SUPERSEDED | P0 | PLN-001 | `Error Hammer MVP bootstrap implementation (legacy baseline chain)` | Superseded by `BLD-002` per `PLN-002` (see `Supersession Archive`). |
| TW-001 | TestWriter | SUPERSEDED | P0 | BLD-001 | `Deterministic bootstrap scenarios and assertions (legacy baseline chain)` | Superseded by `TW-002` per `PLN-002` (see `Supersession Archive`). |
| VF-001 | Verifier | SUPERSEDED | P0 | TW-001 | `Bootstrap verification and bug-fix patching (legacy baseline chain)` | Superseded by `VF-002` per `PLN-002` (see `Supersession Archive`). |
| DOC-001 | Documenter | SUPERSEDED | P0 | VF-001 | `Bootstrap documentation closeout (legacy baseline chain)` | Superseded by `DOC-002` per `PLN-002` (see `Supersession Archive`). |
| BLD-002 | Builder | DONE | P0 | PLN-002 | `Spec.md full MVP bootstrap implementation` | Implemented runtime/core/ui/content/schema/scripts/tests scaffold, emitted `src/generated/content.bundle.json`, and added command-gate CI in `.github/workflows/ci.yml`. |
| TW-002 | TestWriter | DONE | P0 | BLD-002 | `Deterministic full-spec scenarios and assertions` | Implemented deterministic scenarios `EH-TW-001..EH-TW-016` in `tests/tw_scenarios.test.ts` with explicit day-resolution pass/fail assertions. |
| VF-002 | Verifier | DONE | P0 | TW-002 | `Full bootstrap verification and validated bug-fix patching` | Checklist PASS for validate/compile/test/build, deterministic replay parity PASS, and headless manual smoke PASS (see `obsidian_vault/Testing.md`). |
| DOC-002 | Documenter | DONE | P0 | VF-002 | `Bootstrap documentation closeout` | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to final verified behavior and board state. |
| PLN-003 | Planner | DONE | P1 | N/A | `Deterministic bot tool-buy economy planning lock` | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete `BLD-003` handoff and acceptance gates. |
| BLD-003 | Builder | DONE | P1 | PLN-003 | `Deterministic bot tool-buy economy implementation` | Added shared bot planning helper and resolver end-of-day bot purchase phase with deterministic tie-breaks and day log purchase lines. |
| TW-003 | TestWriter | DONE | P1 | BLD-003 | `Deterministic bot-buy scenarios and helper tie-break assertions` | Added `EH-TW-017..EH-TW-021` plus helper tie-break coverage in `tests/tw_scenarios.test.ts`, `tests/bots.test.ts`, and `tests/resolver.test.ts`. |
| VF-003 | Verifier | DONE | P1 | TW-003 | `Bot-buy economy verification and deterministic replay evidence` | Verified validate/compile/test/build gates, deterministic purchase and no-purchase replay parity, and headless dev-server smoke probe PASS (see `obsidian_vault/Testing.md`). |
| DOC-003 | Documenter | DONE | P1 | VF-003 | `Bot-buy economy documentation closeout` | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified bot-buy behavior and board state. |
| PLN-004 | Planner | DONE | P0 | N/A | `Itch.io HTML packaging planning lock` | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete `BLD-004` handoff and packaging acceptance gates. |
| BLD-004 | Builder | DONE | P0 | PLN-004 | `Itch.io-relative production asset path implementation` | Set Vite production base to `./` so built HTML uses relative asset URLs for static HTML uploads. |
| TW-004 | TestWriter | DONE | P0 | BLD-004 | `Relative asset-path packaging assertion` | Added deterministic config assertion `EH-TW-022` in `tests/vite_config.test.ts`. |
| VF-004 | Verifier | DONE | P0 | TW-004 | `Itch packaging verification and ZIP evidence` | Verified validate/compile/test/build gates, relative asset references in `dist/index.html`, and generated an upload ZIP with `3` files from `dist/`. |
| DOC-004 | Documenter | DONE | P0 | VF-004 | `Itch publish documentation closeout` | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified itch packaging behavior and board state. |
| PLN-005 | Planner | DONE | P0 | N/A | `Mobile-compact UI and UX redesign planning lock` | `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` updated with decision-complete compact-shell handoff and acceptance gates. |
| BLD-005 | Builder | DONE | P0 | PLN-005 | `Compact mobile-first black/silver app-shell redesign` | Replaced the flat page stack with a compact bottom-tab shell, overlay components, segmented store flow, compact work view, contract carousel, and industrial dark theme across `src/ui/**`. |
| TW-005 | TestWriter | DONE | P0 | BLD-005 | `Deterministic compact-shell interaction scenarios` | Added `tests/ui_shell.test.tsx` with deterministic UI scenarios `EH-TW-023..EH-TW-034` covering new game, continue, tab routing, overlays, store sections, and supplier sheet behavior. |
| VF-005 | Verifier | DONE | P0 | TW-005 | `Mobile-width shell verification and validated UI bug fixes` | Verified `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`; validated the compact shell with mobile-width interaction coverage and patched only UI-shell regressions. |
| DOC-005 | Documenter | DONE | P0 | VF-005 | `Compact-shell documentation closeout` | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to verified compact-shell behavior and 2026-03-01 board state. |

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
3. Increased automated totals to `39` tests across `7` files.

#### Verifier (`VF-005`)
1. Verified `npm run content:validate` PASS.
2. Verified `npm run content:compile` PASS with emitted bundle path.
3. Verified `npm test` PASS (`7` files, `39` tests).
4. Verified `npm run build` PASS with the compact shell assets emitted for production.
5. Validated compact-shell behavior through the new mobile-focused UI interaction scenarios and patched only UI-shell issues revealed during verification.

#### Documenter (`DOC-005`)
1. Updated README usage/testing sections for the compact bottom-tab shell.
2. Updated `Vision.md`, `Decisions.md`, and `Testing.md` to reflect the new runtime baseline and verification evidence.
3. Updated this board to record `PLN-005 -> DOC-005` closeout state.

### Exit Evidence
1. Planner: complete (`PLN-005`).
2. Builder: complete (`BLD-005`).
3. TestWriter: complete (`TW-005`).
4. Verifier: complete (`VF-005`).
5. Documenter: complete (`DOC-005`).
