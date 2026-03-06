# Tasks
## Current Focus
1. `PLN-019` Planner reset pass is complete on `main` (2026-03-06).
2. `BLD-021` implementation is in progress on `main`; `TW-021` is now `READY`.
3. `BLD-020` implementation is complete on `main`; `TW-020` is now `READY`.
4. Next Builder pull after 021 chain is `BLD-022`.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-06.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Add cards here only when they are active or next-up work.

### Lane Cards
1. `BLD-020`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-020`
Exit Evidence: ReleaseOps helper invariants hardened in `scripts/release_utils.ts` (strict `X.Y.Z` patch bump validation, `itch.YYYYMMDD.NN` date/sequence guardrails, and daily sequence cap at `99`) with no regression in release command path (`npm.cmd run release:verify`, `npm.cmd run test -- tests/release_ops.test.ts`, and `npm.cmd run test -- tests/release_ui.test.tsx` all pass on `main`).
2. `TW-020`
Lane: `TestWriter`
Status: `READY`
Priority: `P0`
Depends On: `BLD-020`
Exit Evidence: deterministic suites for build-id formatting, semver patch bump helper behavior, changelog gating, and release metadata rendering are updated and passing.
3. `VF-020`
Lane: `Verifier`
Status: `BLOCKED`
Priority: `P0`
Depends On: `TW-020`
Exit Evidence: `npm run release:prepare` scaffold fail/pass behavior, `npm run release:verify`, `npm test`, and `npm run build` pass with 020 changes.
4. `DOC-020`
Lane: `Documenter`
Status: `BLOCKED`
Priority: `P1`
Depends On: `VF-020`
Exit Evidence: README/vault release workflow docs match verified 020 behavior, artifact naming, and platform manifest/index flow.
5. `BLD-021`
Lane: `Builder`
Status: `IN_PROGRESS`
Priority: `P1`
Depends On: `PLN-021`
Exit Evidence: deterministic timing and quantity fixes are in-progress in `src/core/playerFlow.ts` (`SHOP_SUPPLIER_TICKS`, `resolveTiming`, `getRefuelTaskTicks`, `getRefuelPurchaseUnits`, `createTaskTemplate`) and `src/ui/screens/ContractsTab.tsx` (`estimatePlannedHours`) to enforce fixed 0.5h travel/refuel actions with fill fallback.
6. `TW-021`
Lane: `TestWriter`
Status: `READY`
Priority: `P1`
Depends On: `BLD-021`
Exit Evidence: ready for deterministic scenario definition for fixed 0.5h travel/refuel timing and partial-affordability fill fallback behavior.
7. `VF-021`
Lane: `Verifier`
Status: `BLOCKED`
Priority: `P1`
Depends On: `TW-021`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main` with 021 changes.
8. `DOC-021`
Lane: `Documenter`
Status: `BLOCKED`
Priority: `P1`
Depends On: `VF-021`
Exit Evidence: README and vault summaries explain triage filters, recovery options, recap loop, and completion feedback behavior.
9. `BLD-022`
Lane: `Builder`
Status: `READY`
Priority: `P2`
Depends On: `PLN-022`
Exit Evidence: deterministic Rebar Bob encounter continuation implemented with daily cap, task-line inclusion, and non-blocking shell popup behavior.
10. `TW-022`
Lane: `TestWriter`
Status: `BLOCKED`
Priority: `P2`
Depends On: `BLD-022`
Exit Evidence: deterministic encounter suites cover eligibility, seeded determinism, daily cap, popup visibility, and task-result line inclusion.
11. `VF-022`
Lane: `Verifier`
Status: `BLOCKED`
Priority: `P2`
Depends On: `TW-022`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main` with 022 changes.
12. `DOC-022`
Lane: `Documenter`
Status: `BLOCKED`
Priority: `P2`
Depends On: `VF-022`
Exit Evidence: README and vault summaries capture encounter cadence cap, popup behavior, and flavor-only scope.

### Active Handoff Steps
1. `BLD-020` implementation evidence is complete on `main`; handoff is now with `TW-020`.
2. Execute `TW-020` deterministic test evidence for release helper guardrails and release metadata rendering.
3. Move `VF-020` to `READY` when `TW-020` is `DONE`, then complete 020 verification evidence.
4. Move `DOC-020` to `READY` when `VF-020` is `DONE`, then finalize 020 documentation evidence.
5. Keep `BLD-021` active until timing/refuel handoff evidence is complete.
6. Pull `BLD-022` after 021 chain closeout unless Planner explicitly reprioritizes.
7. `BLD-021` handoff evidence becomes `DONE` when `TW-021` scenarios are ready.

### Builder -> TestWriter Handoff `BLD-020 -> TW-020`
1. Validate strict semver patch bump behavior in `bumpPatchVersion` (`scripts/release_utils.ts`): exact `X.Y.Z` inputs pass; invalid forms like `0.1`, `0.1.2-beta`, and `0.1.2.3` fail with deterministic errors.
2. Validate build-id guardrails in `formatBuildId` (`scripts/release_utils.ts`): valid `YYYYMMDD` date stamp plus sequence `1..99` passes; invalid stamp/sequence inputs fail deterministically.
3. Validate daily-sequence cap in `reserveNextBuild` (`scripts/release_utils.ts`): same-day state at sequence `99` must throw on next reserve request instead of emitting an out-of-contract `NNN` suffix.
4. Reconfirm release metadata rendering contract remains stable in `tests/release_ui.test.tsx` for title and settings surfaces (`Version`, `Build`, `Release`, and `Commit` lines present).

### Builder -> TestWriter Handoff `BLD-021 -> TW-021`
1. Add a deterministic scenario validating 0.5h timing for `travel_to_supplier` with standard action (`performTaskUnit(..., "standard")` reports both estimated and actual ticks of `1`, and task completion advances to `travel_to_job_site` after 1 tick spent).
2. Add a deterministic scenario validating 0.5h timing for `travel_to_job_site` with standard action and supplier-required route (`travel_to_job_site` always consumes exactly `1` tick regardless of RNG state).
3. Add a deterministic scenario validating `refuel_at_station` timing parity between `Buy 1 Fuel` (`"standard"`) and `Fill Tank` (`"careful"`) actions (same `0.5h` duration; differing `fuel` delta only).
4. Add a deterministic scenario validating fill-fallback behavior: if room is > 1 and cash cannot afford a full top-up, `careful` purchase is exactly 1 gallon, with cost deducted and no negative cash state.

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
1. Updated `Vision.md`, `Decisions.md`, and `Tasks.md` aligned to `019/020/021/022`.
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

## Archive
1. `PLN-019` reset ledger is [Tasks-Lane-Board-Reset-2026-03-06.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-Reset-2026-03-06.md).
2. Prior board history remains in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
3. Earlier task-history notes remain under [archive](/g:/ErrorHammer/obsidian_vault/archive).
