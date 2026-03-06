# Tasks
## Current Focus
1. `PLN-024` Storage-First Company Flow (Cash-Only Facilities) is now active on `main` (2026-03-06).
2. `BLD-024` is `IN_PROGRESS`; `TW-024` is `READY`; `VF-024` and `DOC-024` are blocked by lane dependency.
3. `BLD-023/TW-023/VF-023/DOC-023` are now marked `SUPERSEDED` by `024` replacement cards.
4. Next Builder pull after 024 chain closeout remains `BLD-022`.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-06.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Add cards here only when they are active or next-up work.

### Lane Cards
1. `BLD-024`
Lane: `Builder`
Status: `IN_PROGRESS`
Priority: `P0`
Depends On: `PLN-024`
Exit Evidence: storage-first flow is implemented in core and UI (`src/core/operations.ts`, `src/core/playerFlow.ts`, `src/core/resolver.ts`, `src/core/accounting.ts`, `src/ui/screens/FacilitiesTab.tsx`, `src/ui/screens/StoreTab.tsx`, `src/ui/screens/OfficeTab.tsx`, `src/ui/screens/WorkTab.tsx`, `src/ui/state.ts`) with `Truck -> Storage -> Office -> Yard` cash-only progression, starter-kit gating, truck/storage capacity limits, and `R&D` company-only render.
2. `TW-024`
Lane: `TestWriter`
Status: `READY`
Priority: `P0`
Depends On: `BLD-024`
Exit Evidence: deterministic tests cover cash-only facility gates, starter-tool restrictions, storage open gating, truck/storage capacity behavior, storage-rent accounting parsing/UI, storage-surface copy updates, and `R&D` company-only rendering (`tests/**`).
3. `VF-024`
Lane: `Verifier`
Status: `BLOCKED`
Priority: `P0`
Depends On: `TW-024`
Exit Evidence: `npm.cmd run test` and `npm.cmd run build` pass on `main`; verified no regression in contracts, yard actions, research start behavior, trade index details, storage/shop actions, and accounting ledger rendering.
4. `DOC-024`
Lane: `Documenter`
Status: `BLOCKED`
Priority: `P1`
Depends On: `VF-024`
Exit Evidence: README/vault summaries document storage-first facility order, starter-kit requirements, capacity caps, storage-rent accounting, and Company hub behavior updates.
5. `BLD-023`
Lane: `Builder`
Status: `SUPERSEDED`
Priority: `P0`
Depends On: `PLN-023`
Exit Evidence: superseded by `BLD-024` storage-first Company flow scope.
6. `TW-023`
Lane: `TestWriter`
Status: `SUPERSEDED`
Priority: `P0`
Depends On: `BLD-023`
Exit Evidence: superseded by `TW-024` storage-first deterministic test coverage.
7. `VF-023`
Lane: `Verifier`
Status: `SUPERSEDED`
Priority: `P0`
Depends On: `TW-023`
Exit Evidence: superseded by `VF-024` verification gate for storage-first Company flow.
8. `DOC-023`
Lane: `Documenter`
Status: `SUPERSEDED`
Priority: `P1`
Depends On: `VF-023`
Exit Evidence: superseded by `DOC-024` documentation alignment scope.
9. `BLD-020`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-020`
Exit Evidence: ReleaseOps helper invariants hardened in `scripts/release_utils.ts` (strict `X.Y.Z` patch bump validation, `itch.YYYYMMDD.NN` date/sequence guardrails, and daily sequence cap at `99`) with no regression in release command path (`npm.cmd run release:verify`, `npm.cmd run test -- tests/release_ops.test.ts`, and `npm.cmd run test -- tests/release_ui.test.tsx` all pass on `main`).
10. `TW-020`
Lane: `TestWriter`
Status: `READY`
Priority: `P0`
Depends On: `BLD-020`
Exit Evidence: deterministic suites for build-id formatting, semver patch bump helper behavior, changelog gating, and release metadata rendering are updated and passing.
11. `VF-020`
Lane: `Verifier`
Status: `BLOCKED`
Priority: `P0`
Depends On: `TW-020`
Exit Evidence: `npm run release:prepare` scaffold fail/pass behavior, `npm run release:verify`, `npm test`, and `npm run build` pass with 020 changes.
12. `DOC-020`
Lane: `Documenter`
Status: `BLOCKED`
Priority: `P1`
Depends On: `VF-020`
Exit Evidence: README/vault release workflow docs match verified 020 behavior, artifact naming, and platform manifest/index flow.
13. `BLD-021`
Lane: `Builder`
Status: `SUPERSEDED`
Priority: `P1`
Depends On: `PLN-021`
Exit Evidence: superseded by `BLD-023` Company hub IA consolidation scope.
14. `TW-021`
Lane: `TestWriter`
Status: `SUPERSEDED`
Priority: `P1`
Depends On: `BLD-021`
Exit Evidence: superseded by `TW-023` deterministic Company hub navigation/test coverage scope.
15. `VF-021`
Lane: `Verifier`
Status: `SUPERSEDED`
Priority: `P1`
Depends On: `TW-021`
Exit Evidence: superseded by `VF-023` verification gate for Company hub consolidation.
16. `DOC-021`
Lane: `Documenter`
Status: `SUPERSEDED`
Priority: `P1`
Depends On: `VF-021`
Exit Evidence: superseded by `DOC-023` documentation alignment scope for the Company hub IA update.
17. `BLD-022`
Lane: `Builder`
Status: `READY`
Priority: `P2`
Depends On: `PLN-022`
Exit Evidence: deterministic Rebar Bob encounter continuation implemented with daily cap, task-line inclusion, and non-blocking shell popup behavior.
18. `TW-022`
Lane: `TestWriter`
Status: `BLOCKED`
Priority: `P2`
Depends On: `BLD-022`
Exit Evidence: deterministic encounter suites cover eligibility, seeded determinism, daily cap, popup visibility, and task-result line inclusion.
19. `VF-022`
Lane: `Verifier`
Status: `BLOCKED`
Priority: `P2`
Depends On: `TW-022`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main` with 022 changes.
20. `DOC-022`
Lane: `Documenter`
Status: `BLOCKED`
Priority: `P2`
Depends On: `VF-022`
Exit Evidence: README and vault summaries capture encounter cadence cap, popup behavior, and flavor-only scope.

### Active Handoff Steps
1. Keep `BLD-024` as the only `Builder` card in `IN_PROGRESS` until storage-first implementation evidence is complete.
2. Execute `TW-024` deterministic validation for facility cash gates, starter-kit restrictions, capacity limits, and Company hub render changes.
3. Move `VF-024` to `READY` when `TW-024` is `DONE`, then complete verification evidence (`npm.cmd run test`, `npm.cmd run build`).
4. Move `DOC-024` to `READY` when `VF-024` is `DONE`, then finalize README/vault alignment for the storage-first flow.
5. Keep `BLD-022` queued after the 024 chain unless Planner explicitly reprioritizes.
6. Keep superseded `021/023` chain cards as archive references only; do not pull them.

### Builder -> TestWriter Handoff `BLD-020 -> TW-020`
1. Validate strict semver patch bump behavior in `bumpPatchVersion` (`scripts/release_utils.ts`): exact `X.Y.Z` inputs pass; invalid forms like `0.1`, `0.1.2-beta`, and `0.1.2.3` fail with deterministic errors.
2. Validate build-id guardrails in `formatBuildId` (`scripts/release_utils.ts`): valid `YYYYMMDD` date stamp plus sequence `1..99` passes; invalid stamp/sequence inputs fail deterministically.
3. Validate daily-sequence cap in `reserveNextBuild` (`scripts/release_utils.ts`): same-day state at sequence `99` must throw on next reserve request instead of emitting an out-of-contract `NNN` suffix.
4. Reconfirm release metadata rendering contract remains stable in `tests/release_ui.test.tsx` for title and settings surfaces (`Version`, `Build`, `Release`, and `Commit` lines present).

### Builder -> TestWriter Handoff `BLD-024 -> TW-024`
1. Validate facility gates: `Open Storage ($250)` requires full starter kit ownership; `Open Office ($1800)` requires storage owned; yard/dumpster flows remain deterministic cash-gated.
2. Validate starter-tool economy: no free starter hammer on new game; pre-storage buy/quick-buy blocks non-starter tools; post-storage non-starter purchases work.
3. Validate capacity behavior: truck inflows cap at 8 units, storage cap at 40 units on leftovers transfer, and overflow remains in truck with explicit notice/log.
4. Validate Company hub behavior: `Operations -> Contracts` and `Facilities` render correctly, facilities includes Yard + Storage surfaces, Finance includes Trade Index + Accounting, and `R&D` renders Company-only content.
5. Validate accounting updates: storage-rent lines parse into accounting categories and render in the Accounting breakdown UI.

## Planner Chain `PLN-019` (Cleanup and Archive Reset)
### Goals
1. Archive finished and parked legacy lane cards from the live board.
2. Reissue unfinished scopes into fresh replacement chains with explicit dependencies.
3. Restore clean-slate lane execution discipline.

### Constraints
1. Planner-doc scope only: no runtime logic changes.
2. One `IN_PROGRESS` card maximum per lane.
3. Every active card must include `Lane`, `Status`, `Priority`, `Depends On`, and `Exit Evidence`.

### Deliverables
1. Updated `Vision.md`, `Decisions.md`, and `Tasks.md` aligned to active chains `019/020/021/022/023/024`.
2. New archive ledger with moved `DONE` cards and supersession mappings.
3. Active board containing only replacement cards and current pull order.

## Planner Chain `PLN-020` (ReleaseOps Continuation)
### Goals
1. Complete remaining ReleaseOps lane work from prior 018 execution context.
2. Keep release traceability and changelog quality gates deterministic.
3. Preserve runtime release metadata visibility for support/debug workflows.

### Constraints
1. Zip artifacts remain local and untracked.
2. Release command chain must enforce validation gates before finalize.
3. Build ID format remains `itch.YYYYMMDD.NN` in UTC.

### Deliverables
1. 020 lane cards close with deterministic Builder/TestWriter/Verifier/Documenter evidence.
2. Release docs and vault logs remain aligned with verified command behavior.

## Planner Chain `PLN-021` (Confidence and Flow Continuation)
### Goals
1. Continue confidence-loop polish for estimate-vs-actual recap clarity.
2. Keep contract triage speed high with persistent deterministic filters.
3. Preserve deterministic recovery-control behavior and progression identity cues.

### Constraints
1. No new gameplay randomness.
2. Keep mobile readability and tap-target baseline intact.
3. Avoid schema migration unless conflict forces planner approval.

### Deliverables
1. 021 lane cards close with deterministic behavior and verification gates.
2. Documentation reflects verified recap/filter/recovery/archetype behavior.

## Planner Chain `PLN-022` (Rebar Bob Continuation)
### Goals
1. Continue deterministic flavor encounter scope without changing economy outcomes.
2. Maintain once-per-day encounter cadence for readability.
3. Keep encounter surfaced in task results and non-blocking shell popup UX.

### Constraints
1. Use seeded deterministic RNG only.
2. No save schema migration in this continuation scope.
3. Keep scope flavor-only with no payout/risk formula changes.

### Deliverables
1. 022 lane cards close with deterministic encounter and UI behavior evidence.
2. Documentation records cadence cap and flavor-only boundaries.

## Planner Chain `PLN-023` (Company Hub Rebrand + IA Consolidation)
### Goals
1. Rebrand the bottom nav hub label from `Office` to `Company` without changing core game simulation behavior.
2. Reduce Office-menu complexity by grouping navigation into top-level categories with fewer consolidated destinations.
3. Preserve legacy shortcut intent (`contracts`, `store`, `company`) while routing into the new grouped Company IA.

### Constraints
1. Keep gameplay mutation logic deterministic and unchanged in `src/core/**`.
2. Maintain one `IN_PROGRESS` card per lane and explicit supersession tracking for replaced cards.
3. Keep consolidated pages compositional (reuse existing screen modules instead of rewriting domain logic).

### Deliverables
1. `BLD-023/TW-023/VF-023/DOC-023` lane cards with deterministic evidence and dependencies.
2. Company hub state/type updates: categories (`operations|strategy|finance`) plus consolidated section IDs.
3. UI/test updates validating two-row grouped navigation, merged destination rendering, legacy shortcut mapping, and accounting progression continuity.

## Planner Chain `PLN-024` (Storage-First Company Flow)
### Goals
1. Shift facilities progression to `Truck -> Storage -> Office -> Yard` using cash-only unlocks.
2. Enforce a strict pre-storage starter-tool gate and truck/storage supply capacity model.
3. Keep Company hub routing compatibility while rendering `R&D` as Company-only content.

### Constraints
1. Preserve deterministic gameplay and compatibility ids (`office`, `shop`, `load_from_shop`).
2. Keep facility research internals available for future scope, but remove facility-program UX from active Company flow.
3. Maintain lane discipline with one `IN_PROGRESS` card per lane and explicit supersession mappings.

### Deliverables
1. `BLD-024/TW-024/VF-024/DOC-024` lane cards with dependencies and exit evidence.
2. Core updates for storage unlock, starter gating, cash-only facility dependencies, and monthly storage billing.
3. UI/test/docs updates for storage-first surfaces, capacity behavior, and accounting storage-rent visibility.

## Archive
1. `PLN-019` reset ledger is [Tasks-Lane-Board-Reset-2026-03-06.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-Reset-2026-03-06.md).
2. Prior board history remains in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
3. Earlier task-history notes remain under [archive](/g:/ErrorHammer/obsidian_vault/archive).
4. Supersession archive row (`2026-03-06`): `BLD-021 -> BLD-023`, `TW-021 -> TW-023`, `VF-021 -> VF-023`, `DOC-021 -> DOC-023`.
5. Supersession archive row (`2026-03-06`): `BLD-023 -> BLD-024`, `TW-023 -> TW-024`, `VF-023 -> VF-024`, `DOC-023 -> DOC-024`.
