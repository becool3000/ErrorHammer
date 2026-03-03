# Decisions
## Active Decisions
1. Runtime remains browser-first React + TypeScript + Vite on `main`.
2. Gameplay and simulation outcomes remain deterministic; seeded RNG is required for variable paths.
3. Gameplay mutations stay core-owned in `src/core/**`; UI dispatches transitions and renders state.
4. Content remains schema-validated JSON compiled into tracked `src/generated/content.bundle.json`.
5. Trade content baseline remains locked to 19 skills, 95 jobs, and 10 bots.
6. New-game contract access is hard-gated by research:
1. Start: Day Labor only.
2. Baba unlock: dedicated project `rd-baba-network`.
3. Trade unlocks: category first, then skill projects.
7. Research model is single active queued project with upfront cost and day-based progress.
8. Daily bills are deterministic fixed components with company-level scaling and optional accountant effects.
9. Unpaid operating costs can push negative cash; late fees apply immediately and reputation penalty clamps at zero floor.
10. Yard dumpster is now a gating resource:
1. Jobs add trash.
2. Store-leftovers unloads pending trash into yard dumpster.
3. Full dumpster blocks non-day-labor acceptance.
11. Accountant hire is permanent staff with utility discount, daily salary, and accounting clarity boost.
12. Reading and Accounting clarity effects intentionally obfuscate non-critical copy/values at low skill, while critical action labels remain un-obfuscated.
13. Save migration policy for this pass is in-place normalization at `SAVE_VERSION=5`; no hard reset.
14. `Tasks.md` remains the live lane-board source of truth and `Testing.md` remains the evidence summary source.

## Archive
1. Closed-chain and lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Earlier decision-history notes remain in [Decisions-History-2026-02-13.md](/g:/ErrorHammer/obsidian_vault/archive/Decisions-History-2026-02-13.md).
