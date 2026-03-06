# Decisions
## Active Decisions
1. Runtime remains browser-first React + TypeScript + Vite on `main`.
2. Gameplay and simulation outcomes remain deterministic; seeded RNG is required for variable paths.
3. Gameplay mutations stay core-owned in `src/core/**`; UI dispatches transitions and renders state.
4. Content remains schema-validated JSON compiled into tracked `src/generated/content.bundle.json`.
5. Trade content baseline is expanded to 50 skills, 188 jobs, and 10 bots.
6. New-game contract access is hard-gated by research:
1. Start: Day Labor only.
2. Baba unlock: dedicated project `rd-baba-network`.
3. Trade unlocks: category first, then skill projects.
7. Research model is single active queued project with upfront cost and day-based progress.
8. Business tier progression is explicit: `truck -> office -> yard`, with facility ownership flags and buy-in costs.
9. Billing uses a monthly lump model on a 22-shift cycle with unpaid carry-forward and late fees.
10. Two missed monthly bills trigger forced downgrade by tier:
1. Yard downgrades to Office.
2. Office downgrades to Truck.
3. Truck applies bankruptcy reset with emergency cash floor.
11. Unpaid balances are tracked explicitly; negative spiral recovery is part of intended gameplay.
12. Yard dumpster is now a gating resource:
1. Jobs add trash.
2. Store-leftovers unloads pending trash into yard dumpster.
3. Full dumpster blocks non-day-labor acceptance.
13. Trash economics run in two modes:
1. Premium haul-off charges per job when dumpster service is disabled.
2. Dumpster service shifts cost to yard emptying and monthly base fees once enabled.
14. Accountant hire is permanent staff with utility discount, monthly salary, and accounting clarity boost.
15. Reading and Accounting clarity effects intentionally obfuscate non-critical copy/values at low skill, while critical action labels remain un-obfuscated.
16. Core Perks are additive deterministic modifiers gated by perk-tree research and point spend.
17. Save version is bumped to `SAVE_VERSION=6` for the economy/perk architecture migration.
18. `Tasks.md` remains the live lane-board source of truth and `Testing.md` remains the evidence summary source.
19. Itch publishing uses versioned archives from `package.json` with format `error-hammer-v<version>-itch.zip`, produced by `npm run build:itch`.
20. The title screen displays the same app version (`Version <version>`) so build identity is visible in-game and on itch uploads.
19. Contract triage uses persistent quick filters (`Profitable`, `Low Risk`, `Near Route`, `No New Tools`) with AND semantics.
20. Recovery actions are additive and deterministic:
1. `Finish Cheap` = forced neutral closeout at 70% payout with rep -1.
2. `Defer` = queue job (max 3) with upfront fee + daily carrying fee + expiry penalty.
3. `Abandon` = immediate cash/rep penalty with active job cleared.
21. Profit clarity surfaces before/after contract net and deterministic \"biggest cost driver\" labels to explain payout variance.
22. Perk identity is descriptive (archetype badges), not a hard class lock.
23. Non-day-labor completion uses short visual payoff FX; mutation actions remain locked during FX windows, with reduced-FX setting available.
24. ReleaseOps for itch is standardized with release label format `vX.Y.Z+itch.YYYYMMDD.NN` and artifact naming `error-hammer-vX.Y.Z+itch.YYYYMMDD.NN-itch.zip`.
25. `npm run release:itch` is the canonical publish command and enforces `content:validate`, `content:compile`, `test`, and `build` before finalize.
26. Every release requires curated changelog sections (`Added`, `Changed`, `Fixed`, `Balance`, `Content`, `UX/Mobile`, `Technical`, `Known Issues`) and fails preflight on placeholders.
27. Platform release manifests/indexes live under `release/platforms/<platform>/...` with global rollup at `release/index.json` for future multi-platform scaling.
28. Runtime build metadata (`appVersion`, `buildId`, `releaseLabel`, `gitCommit`, `builtAtUtc`) is surfaced in title and settings for support traceability.

## Dated Decision Log
1. `2026-03-06` `PLN-019-D1`
Decision: use one dated archive ledger for the board reset (`Tasks-Lane-Board-Reset-2026-03-06.md`).
Rationale: keeps cleanup history centralized and reduces split-brain archive notes.
2. `2026-03-06` `PLN-019-D2`
Decision: supersede unfinished legacy lane cards from chains `015`, `016`, and `018`, then reissue fresh replacement cards now as `PLN-020`, `PLN-021`, and `PLN-022`.
Rationale: preserves traceability while eliminating stale execution context from the live board.
3. `2026-03-06` `PLN-019-D3`
Decision: run cleanup-first planning under `PLN-019` before resuming feature execution.
Rationale: restores lane discipline and reduces WIP ambiguity before additional implementation work.
4. `2026-03-06` `PLN-019-D4`
Decision: enforce active-board scope as active/next-up only; historical detail must live in archive with explicit `legacy -> replacement` mapping rows.
Rationale: keeps `Tasks.md` operational and ensures handoff continuity remains auditable.

## Archive
1. Closed-chain and lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Planner reset supersession history is archived in [Tasks-Lane-Board-Reset-2026-03-06.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-Reset-2026-03-06.md).
3. Earlier decision-history notes remain in [Decisions-History-2026-02-13.md](/g:/ErrorHammer/obsidian_vault/archive/Decisions-History-2026-02-13.md).
