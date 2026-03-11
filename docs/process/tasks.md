# Process Tasks

## Current Focus (2026-03-10)
1. `BLD-025` remains the active implementation chain focus.
2. `VF-025` is blocked until `BLD-025` closes with deterministic evidence.
3. `BLD-022` remains next Builder pull after 025 chain closeout unless reprioritized.
4. Legacy non-`Plan/Build/Verify` cards are retired for new work and retained only in archive history.
5. `PLN-026` process migration is closed with docs migration and full gate evidence recorded.

## Active Board (Kanban)
Snapshot date: 2026-03-10.

### Pull Order Rules
1. Priority order is `P0`, then `P1`, then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.

### Lane Cards
1. `PLN-026`
Lane: `Plan`
Status: `DONE`
Priority: `P0`
Depends On: `none`
Exit Evidence: process/docs migration completed in `Agents.md`, `README.md`, and `docs/**`; vault active notes converted to archive pointers; full gate pass on 2026-03-10 (`content:validate`, `content:compile`, `typecheck`, `test` 40 files/279 tests, `build`).

2. `BLD-025`
Lane: `Build`
Status: `IN_PROGRESS`
Priority: `P0`
Depends On: `PLN-025`
Exit Evidence: out-of-gas rescue flow and OSHA can starter-kit gate are implemented in core/UI/tests with deterministic behavior and no mandatory refuel stop units.

3. `VF-025`
Lane: `Verify`
Status: `BLOCKED`
Priority: `P0`
Depends On: `BLD-025`
Exit Evidence: all five gates pass (`content:validate`, `content:compile`, `typecheck`, `test`, `build`) with no regressions in progression, accounting logs, or bot determinism.

4. `BLD-022`
Lane: `Build`
Status: `READY`
Priority: `P2`
Depends On: `PLN-022`
Exit Evidence: deterministic Rebar Bob encounter continuation implemented with daily cap, task-line inclusion, and non-blocking shell popup behavior.

5. `VF-022`
Lane: `Verify`
Status: `BLOCKED`
Priority: `P2`
Depends On: `BLD-022`
Exit Evidence: all five gates pass with encounter cadence and flavor-only scope preserved.

## Historical Supersession Mapping (Reference Only)
1. `BLD-021 -> BLD-023`, `VF-021 -> VF-023`.
2. `BLD-023 -> BLD-024`, `VF-023 -> VF-024`.
3. `BLD-024 -> BLD-025`, `VF-024 -> VF-025`.

## Archive References
1. Prior lane-board snapshot: [Tasks-Lane-Board-2026-03-01.md](../../obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md)
2. Board reset ledger: [Tasks-Lane-Board-Reset-2026-03-06.md](../../obsidian_vault/archive/Tasks-Lane-Board-Reset-2026-03-06.md)
