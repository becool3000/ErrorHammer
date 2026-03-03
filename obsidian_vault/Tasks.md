# Tasks
## Current Focus
1. `PLN-012` Office Ops Expansion is implemented on `main`.
2. Lane handoffs for `012` are closed with evidence.
3. Next planner pull is post-`PLN-012` economy pacing and content polish.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-03.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Add cards here only when they are active or next-up work.

### Lane Cards
1. `BLD-012`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-012`
Exit Evidence: core systems added for research queue unlocks, daily operations bills/late fees, dumpster yard mechanics, accountant hire, readability/accounting helpers, and Office `Research` + `Yard` surfaces.
2. `TW-012`
Lane: `TestWriter`
Status: `DONE`
Priority: `P0`
Depends On: `BLD-012`
Exit Evidence: deterministic suites added for research, operations, dumpster, and readability; UI shell assertions updated for Office sections and accounting clarity/hire flow.
3. `VF-012`
Lane: `Verifier`
Status: `DONE`
Priority: `P0`
Depends On: `TW-012`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main`.
4. `DOC-012`
Lane: `Documenter`
Status: `DONE`
Priority: `P1`
Depends On: `VF-012`
Exit Evidence: vault artifacts updated to reflect `PLN-012` direction, decisions, and lane-board status.
5. `BLD-011`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-011`
Exit Evidence: trade-skill overhaul baseline shipped (19 skills, 95 jobs, 10 bots, grouped contracts).
6. `TW-011`
Lane: `TestWriter`
Status: `DONE`
Priority: `P0`
Depends On: `BLD-011`
Exit Evidence: deterministic trade-overhaul tests landed and replaced legacy skill assertions.
7. `VF-011`
Lane: `Verifier`
Status: `DONE`
Priority: `P0`
Depends On: `TW-011`
Exit Evidence: prior chain validation gates green on `main`.
8. `DOC-011`
Lane: `Documenter`
Status: `DONE`
Priority: `P1`
Depends On: `VF-011`
Exit Evidence: prior chain vault updates completed.

## Planner Chain `PLN-012`
### Goals
1. Add hard-lock research progression: Day Labor start, Baba unlock second, then category+skill unlocks.
2. Add deterministic daily operations costs with scaling, late fees, and negative cash handling.
3. Add yard dumpster capacity flow with trash generation, service emptying, and acceptance gating.
4. Add Office reading/accounting progression with clarity effects and accountant staffing.
5. Keep save compatibility at `SAVE_VERSION=5` through migration defaults in normalization.

### Constraints
1. Keep core work loop intact; expand management systems additively.
2. Preserve deterministic behavior via seeded flows and explicit log lines.
3. No hard reset for legacy saves in this pass; normalize missing fields safely.
4. Mobile readability remains primary in new Office surfaces.

### Deliverables
1. New core modules: `research.ts`, `operations.ts`, and `ui/readability.ts` integration.
2. New Office tabs: `Research` and `Yard`, plus Accounting upgrades and accountant hire action.
3. Contract visibility/acceptance hard gates for research and dumpster capacity.
4. Trash flow from job settlement into yard dumpster with service cost action.
5. Added deterministic tests and regression gate evidence.

## Recent Closeouts
1. `PLN-012 -> BLD-012 -> TW-012 -> VF-012 -> DOC-012`
Result: Office ops expansion shipped with R&D gating, daily bills, dumpster logistics, readability/accounting clarity systems, and green regression gates.
2. `PLN-011 -> BLD-011 -> TW-011 -> VF-011 -> DOC-011`
Result: trade overhaul baseline (19 skills / 95 jobs / 10 bots) shipped and verified.

## Archive
1. Closed lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Earlier task-history notes remain under [archive](/g:/ErrorHammer/obsidian_vault/archive).
