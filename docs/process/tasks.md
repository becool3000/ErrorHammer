# Process Tasks

## Current Focus (2026-03-10)
1. `BLD-025` is closed with targeted deterministic evidence for rescue/manual-travel/day-labor fallback behavior.
2. `VF-025` is closed with full five-gate verification evidence recorded.
3. `BLD-022` is closed with deterministic encounter continuation and non-blocking popup evidence.
4. `VF-022` is closed with full five-gate verification evidence recorded.
5. Legacy non-`Plan/Build/Verify` cards are retired for new work and retained only in archive history.
6. `PLN-026` process migration is closed with docs migration and full gate evidence recorded.
7. `PLN-027` is closed with decision-complete scope for settlement fail-floor, day-labor visibility gating, bid scaling, add-on/tip settlement bonuses, and perk explain UX.
8. `BLD-027` is closed with deterministic gameplay/UI/test implementation evidence for payment reliability, day-labor hide-until-end-day behavior, negotiation+estimating bid scaling, add-on/tip payouts, and perk explain controls.
9. `VF-027` is closed with full five-gate verification evidence recorded.

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
Status: `DONE`
Priority: `P0`
Depends On: `PLN-025`
Exit Evidence: out-of-gas rescue flow and OSHA can starter-kit gate are implemented in core/UI/tests with deterministic behavior and no mandatory refuel stop units. Targeted checks passed on 2026-03-10: `npm test -- tests/tw_scenarios.test.ts` (55/55), `npm test -- tests/ui_shell.test.tsx -t EH-TW-062`, `-t EH-TW-262`, `-t EH-TW-263`, `-t EH-TW-063`, and `npm test -- tests/stability_balance.test.ts -t "out-of-gas rescue"`.

3. `VF-025`
Lane: `Verify`
Status: `DONE`
Priority: `P0`
Depends On: `BLD-025`
Exit Evidence: full Verify gate sequence passed on 2026-03-10 via `npm.cmd` (`content:validate` OK tools=25/jobs=188/babaJobs=22/events=12/districts=3/bots=10/supplies=35; `content:compile` wrote `src/generated/content.bundle.json`; `typecheck` passed; `test` passed 40 files/279 tests after rerun with longer command timeout; `build` passed with production bundle output). Regression-sensitive suites covering progression/accounting/bot determinism passed (`tests/progression.test.ts`, `tests/accounting.test.ts`, `tests/bots.test.ts`).

4. `BLD-022`
Lane: `Build`
Status: `DONE`
Priority: `P2`
Depends On: `PLN-022`
Exit Evidence: Rebar Bob continuation behavior is deterministic with one encounter per day cap, task-line/detail inclusion, and non-blocking shell popup behavior. Build validation passed on 2026-03-10: `npm.cmd run typecheck`; `npm.cmd test -- tests/encounters.test.ts`; `npm.cmd test -- tests/ui_shell.test.tsx -t EH-TW-123`; `-t EH-TW-125`; `-t EH-TW-126`; `-t EH-TW-127`.

5. `VF-022`
Lane: `Verify`
Status: `DONE`
Priority: `P2`
Depends On: `BLD-022`
Exit Evidence: full Verify gate sequence passed on 2026-03-10 via `npm.cmd` (`content:validate` OK tools=25/jobs=188/babaJobs=22/events=12/districts=3/bots=10/supplies=35; `content:compile` wrote `src/generated/content.bundle.json`; `typecheck` passed; `test` passed 40 files/279 tests; `build` passed with production bundle output). Encounter cadence/flavor scope remained stable in full suite (`tests/encounters.test.ts`, `tests/ui_shell.test.tsx` EH-TW-126/127).

6. `PLN-027`
Lane: `Plan`
Status: `DONE`
Priority: `P1`
Depends On: `none`
Exit Evidence: implementation spec finalized for contract settlement fail-floor (`skill rank >=2 OR negotiation >=1`), day-labor hide-until-end-day gating, negotiation+estimating auto-bid scaling, deterministic add-on/tip settlement logic, and per-perk explain UI controls.

7. `BLD-027`
Lane: `Build`
Status: `DONE`
Priority: `P1`
Depends On: `PLN-027`
Exit Evidence: implemented and validated deterministic core/UI/test updates for settlement fail-floor, day-labor board hiding/reset on end day, bid scaling with negotiation+estimating, add-on work injection plus tip payouts, and skills-modal perk explain toggles. Targeted checks passed on 2026-03-10: `npm.cmd test -- tests/auto_bid.test.ts`; `npm.cmd test -- tests/tw_scenarios.test.ts -t EH-TW-063`; `-t EH-TW-243`; `-t EH-TW-268`; `-t EH-TW-269`; `npm.cmd test -- tests/ui_shell.test.tsx -t EH-TW-063`; `-t EH-TW-130`; `-t EH-TW-272`.

8. `VF-027`
Lane: `Verify`
Status: `DONE`
Priority: `P1`
Depends On: `BLD-027`
Exit Evidence: full Verify gate sequence passed on 2026-03-10 via `npm.cmd` (`content:validate` OK tools=25/jobs=188/babaJobs=22/events=12/districts=3/bots=10/supplies=35; `content:compile` wrote `src/generated/content.bundle.json`; `typecheck` passed; `test` passed 40 files/283 tests; `build` passed with production bundle output).

## Historical Supersession Mapping (Reference Only)
1. `BLD-021 -> BLD-023`, `VF-021 -> VF-023`.
2. `BLD-023 -> BLD-024`, `VF-023 -> VF-024`.
3. `BLD-024 -> BLD-025`, `VF-024 -> VF-025`.

## Archive References
1. Prior lane-board snapshot: [Tasks-Lane-Board-2026-03-01.md](../../obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md)
2. Board reset ledger: [Tasks-Lane-Board-Reset-2026-03-06.md](../../obsidian_vault/archive/Tasks-Lane-Board-Reset-2026-03-06.md)
