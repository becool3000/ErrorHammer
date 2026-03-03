# Tasks
## Current Focus
1. No lane card is currently `IN_PROGRESS`.
2. Planner chain `PLN-011` is implemented and verified on `main`.
3. Active work has moved to post-overhaul tuning only.
4. The live board below should stay small: only active or immediately ready handoffs belong here.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-02.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Add cards here only when they are active or next-up work.

### Lane Cards
1. `BLD-011`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-011`
Exit Evidence: core types migrated to 19 trade skills, `primarySkill` added to jobs, strict `95` trade jobs + `10` bots validated, `baba_jobs` content/schema/pipeline added, board generation guarantees one offer per trade skill, and contracts UI moved to grouped mobile trade tabs with pinned `Day Labor` and rotating `Baba G`.
2. `TW-011`
Lane: `TestWriter`
Status: `DONE`
Priority: `P0`
Depends On: `BLD-011`
Exit Evidence: deterministic tests cover trade-skill mapping, board guarantees, grouped contract UI rendering, top-level content shape with `babaJobs`, and legacy skill assertions were replaced with trade-skill assertions.
3. `VF-011`
Lane: `Verifier`
Status: `DONE`
Priority: `P0`
Depends On: `TW-011`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` all pass on `main`.
4. `DOC-011`
Lane: `Documenter`
Status: `DONE`
Priority: `P1`
Depends On: `VF-011`
Exit Evidence: vault planning artifacts updated to reflect the trade-overhaul baseline, replaced board lane chain, and archived superseded handoff cards.

## Next Pull
1. Planner: define the next post-overhaul balancing and readability chain after `PLN-011`.

## Planner Chain `PLN-011`
### Goals
1. Expand AI competitors from `2` to exactly `10` bots.
2. Replace the legacy skill model with the locked 19-trade skill set.
3. Rewrite trade content to exactly `95` jobs (`19 skills x 5 jobs`).
4. Keep Baba G in a separate fallback pool and rotate it as slot `#2`.
5. Guarantee one trade offer per skill on full board generation.
6. Raise visible contract offers to `21` total: `Day Labor + Baba G + 19 trades`.
7. Replace the long contracts carousel with grouped mobile trade tabs.

### Constraints
1. Preserve deterministic seeded behavior for board generation and task resolution.
2. Keep gameplay-state changes inside core runtime modules under `src/core/**`.
3. Enforce content counts at schema/pipeline level rather than soft runtime assumptions.
4. Keep save migration explicit with a version bump and hard-reset compatibility handling.

### Deliverables
1. `SkillId` migration to 19 trades and `primarySkill` migration across job runtime paths.
2. New `content/baba_jobs.json` and `schemas/baba_jobs.schema.json`.
3. Strict content checks for exactly `95` trade jobs and exactly `10` bots.
4. Board generation and offer assembly updates for `Day Labor` first and `Baba G` second.
5. Grouped trade-tab contracts UI for mobile readability.
6. Regression gate clean across validate/compile/test/build.

### Superseded Cards
1. `BLD-010`
Lane: `Builder`
Status: `SUPERSEDED`
Priority: `P0`
Depends On: `PLN-010`
Exit Evidence: archived to `BLD-011` scope replacement.
Archive Row: `BLD-010 -> BLD-011`
2. `TW-010`
Lane: `TestWriter`
Status: `SUPERSEDED`
Priority: `P0`
Depends On: `BLD-010`
Exit Evidence: archived to `TW-011` scope replacement.
Archive Row: `TW-010 -> TW-011`
3. `VF-010`
Lane: `Verifier`
Status: `SUPERSEDED`
Priority: `P0`
Depends On: `TW-010`
Exit Evidence: archived to `VF-011` verification replacement.
Archive Row: `VF-010 -> VF-011`
4. `DOC-010`
Lane: `Documenter`
Status: `SUPERSEDED`
Priority: `P1`
Depends On: `VF-010`
Exit Evidence: archived to `DOC-011` documentation replacement.
Archive Row: `DOC-010 -> DOC-011`

## Recent Closeouts
1. `PLN-011 -> BLD-011 -> TW-011 -> VF-011 -> DOC-011`
Result: trade overhaul shipped with 19-skill guarantees, 95-job content set, 10 bots, grouped contracts UI, and full deterministic regression gate passing.
2. `PLN-010 -> BLD-010 -> TW-010 -> VF-010 -> DOC-010`
Result: superseded by `PLN-011` chain and archived as replaced scope.

## Archive
1. Closed lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Earlier task-history notes remain under [archive](/g:/ErrorHammer/obsidian_vault/archive).
