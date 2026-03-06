# Tasks
## Current Focus
1. `PLN-015` Player Confidence + Flow Speed Pass is active on `main`.
2. Implementation scope: profit recap loop, contract triage filters, recovery actions, archetype identity, and non-day-labor completion juice.
3. Next planner pull is final balance polish after `PLN-015` verification gates close.
4. `PLN-016` Random Heckler Encounter (Rebar Bob) is approved for additive deterministic implementation.
5. Itch publish artifact naming is versioned: `error-hammer-v<package.json version>-itch.zip` via `npm run build:itch`.
6. `PLN-018` ReleaseOps system is approved: per-release build IDs, changelog gating, platform manifests, and vault release records.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-03.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Add cards here only when they are active or next-up work.

### Lane Cards
1. `BLD-018`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-018`
Exit Evidence: `release:itch` command chain, build-id runtime metadata, version/build display in title+settings, platform manifests/indexes, and vault release logs scaffolded.
2. `TW-018`
Lane: `TestWriter`
Status: `READY`
Priority: `P0`
Depends On: `BLD-018`
Exit Evidence: deterministic tests for build-id formatting, semver patch bump helper, changelog validation, and release metadata UI rendering.
3. `VF-018`
Lane: `Verifier`
Status: `READY`
Priority: `P0`
Depends On: `TW-018`
Exit Evidence: `npm run release:prepare` (expected scaffold fail/pass behavior), `npm run release:verify`, `npm run build`, and targeted test suites pass.
4. `DOC-018`
Lane: `Documenter`
Status: `READY`
Priority: `P1`
Depends On: `VF-018`
Exit Evidence: README/vault docs updated for release command workflow, artifact naming, and per-platform manifest structure.
5. `BLD-015`
Lane: `Builder`
Status: `IN_PROGRESS`
Priority: `P0`
Depends On: `PLN-015`
Exit Evidence: recovery/defer/abandon loop in Work, profit recap surfaces, filters+best-pick in Contracts, archetype visibility, completion FX, reduced-FX setting.
6. `TW-015`
Lane: `TestWriter`
Status: `READY`
Priority: `P0`
Depends On: `BLD-015`
Exit Evidence: deterministic suites for filters/recovery/recap/archetypes and UI-shell coverage for confirm/defer/resume/FX lock behavior.
7. `VF-015`
Lane: `Verifier`
Status: `READY`
Priority: `P0`
Depends On: `TW-015`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main` with PLN-015 changes.
8. `DOC-015`
Lane: `Documenter`
Status: `READY`
Priority: `P1`
Depends On: `VF-015`
Exit Evidence: README and vault summaries updated to explain triage filters, recovery options, recap loop, and completion FX behavior.
9. `BLD-016`
Lane: `Builder`
Status: `READY`
Priority: `P1`
Depends On: `PLN-016`
Exit Evidence: deterministic Rebar Bob encounter module, task-resolution wiring, non-blocking popup in shell, and tone-highlighted task-result lines.
10. `TW-016`
Lane: `TestWriter`
Status: `READY`
Priority: `P1`
Depends On: `BLD-016`
Exit Evidence: encounter deterministic tests plus UI-shell assertions for popup visibility, non-locking behavior, and task-result line inclusion.
11. `VF-016`
Lane: `Verifier`
Status: `READY`
Priority: `P1`
Depends On: `TW-016`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main` with encounter changes.
12. `DOC-016`
Lane: `Documenter`
Status: `READY`
Priority: `P2`
Depends On: `VF-016`
Exit Evidence: README and vault summary call out Rebar Bob encounter behavior, cadence cap, and flavor-only scope.
13. `BLD-014`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-014`
Exit Evidence: economy architecture moved to truck/office/yard tiers with monthly 22-shift billing, strike/downgrade chain, expanded skill taxonomy (50), 188 jobs, perk modifiers, facilities actions, and compact rotating contracts.
14. `TW-014`
Lane: `TestWriter`
Status: `DONE`
Priority: `P0`
Depends On: `BLD-014`
Exit Evidence: added deterministic suites for monthly billing cycle, eviction/downgrade, trash-cost modes, perk modifiers, and trade-expansion catalog; updated legacy tests for new model.
15. `VF-014`
Lane: `Verifier`
Status: `DONE`
Priority: `P0`
Depends On: `TW-014`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main` after PLN-014 changes.
16. `DOC-014`
Lane: `Documenter`
Status: `DONE`
Priority: `P1`
Depends On: `VF-014`
Exit Evidence: vault planning/decision docs updated to reflect monthly-lump economy, two-strike collapse, expanded trade catalog, and perks-as-modifiers architecture.
17. `BLD-012`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-012`
Exit Evidence: core systems added for research queue unlocks, daily operations bills/late fees, dumpster yard mechanics, accountant hire, readability/accounting helpers, and Office `Research` + `Yard` surfaces.
18. `TW-012`
Lane: `TestWriter`
Status: `DONE`
Priority: `P0`
Depends On: `BLD-012`
Exit Evidence: deterministic suites added for research, operations, dumpster, and readability; UI shell assertions updated for Office sections and accounting clarity/hire flow.
19. `VF-012`
Lane: `Verifier`
Status: `DONE`
Priority: `P0`
Depends On: `TW-012`
Exit Evidence: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build` pass on `main`.
20. `DOC-012`
Lane: `Documenter`
Status: `DONE`
Priority: `P1`
Depends On: `VF-012`
Exit Evidence: vault artifacts updated to reflect `PLN-012` direction, decisions, and lane-board status.
21. `BLD-011`
Lane: `Builder`
Status: `DONE`
Priority: `P0`
Depends On: `PLN-011`
Exit Evidence: trade-skill overhaul baseline shipped (19 skills, 95 jobs, 10 bots, grouped contracts).
22. `TW-011`
Lane: `TestWriter`
Status: `DONE`
Priority: `P0`
Depends On: `BLD-011`
Exit Evidence: deterministic trade-overhaul tests landed and replaced legacy skill assertions.
23. `VF-011`
Lane: `Verifier`
Status: `DONE`
Priority: `P0`
Depends On: `TW-011`
Exit Evidence: prior chain validation gates green on `main`.
24. `DOC-011`
Lane: `Documenter`
Status: `DONE`
Priority: `P1`
Depends On: `VF-011`
Exit Evidence: prior chain vault updates completed.

## Planner Chain `PLN-015`
### Goals
1. Reduce \"why did I lose money?\" confusion using estimate-vs-actual recap with explicit cost driver callouts.
2. Speed contract triage on mobile with persistent quick filters and a deterministic best-pick recommendation.
3. Add deterministic mid-job recovery options (`Finish Cheap`, `Defer`, `Abandon`) with explicit penalties.
4. Surface progression identity via perk-derived archetype badges in Research + compact Work HUD tags.
5. Add short non-day-labor completion feedback FX while preserving flow and mutation safety locks.

### Constraints
1. No new gameplay randomness; all new outcomes remain deterministic.
2. Save migration should remain compatible unless forced by schema conflict.
3. No third-party dependencies for FX, charts, or filters.
4. Mobile readability and tap-target minimums stay intact.

### Deliverables
1. Core helpers for estimate/actual snapshots, job recap, filtering, and recovery transitions.
2. Work UI for recovery controls, deferred queue resume flow, and post-settlement recap card.
3. Contracts UI for persistent filters + best-pick + always-visible estimate summary.
4. Research/Accounting/Settings visibility updates (archetypes, deferred carrying lines, reduced FX toggle).
5. Deterministic tests covering recovery actions, filters, recap extraction, and archetype scoring.

## Planner Chain `PLN-016`
### Goals
1. Add deterministic random heckler encounters during task flow featuring Rebar Bob.
2. Keep encounter flavor-only with no economy, pacing, risk, or settlement formula impact.
3. Surface encounter in both task-result copy and a short non-blocking in-shell popup.
4. Enforce a once-per-day cap to keep encounter cadence readable on mobile.

### Constraints
1. Use seeded deterministic RNG only.
2. No new save schema or migration.
3. No new content JSON file; encounter copy remains code-defined in this pass.
4. Maintain PG-13 tone while preserving canonical phrases (`beanpole arms`, `panty waist`).

### Deliverables
1. New `src/core/encounters.ts` with task eligibility, deterministic encounter roll, and log marker helper.
2. `performTaskUnit` integration to append encounter lines and day-log marker entries.
3. UI store + GameShell popup overlay with timed auto-dismiss and no mutation lock.
4. Test coverage for determinism, daily cap, eligibility, popup behavior, and task-result visibility.

## Planner Chain `PLN-018`
### Goals
1. Make every itch release traceable with semver + build ID + release label.
2. Enforce changelog quality gates before packaging.
3. Keep per-platform manifests/indexes so release history scales beyond itch.
4. Surface release metadata directly in-game (title + settings) for support/debugging.

### Constraints
1. Zip artifacts stay local and untracked.
2. Release metadata and notes stay tracked in repo/vault.
3. Release command must run strict validation gates before shipping.
4. Build ID format is fixed to `itch.YYYYMMDD.NN` using UTC date.

### Deliverables
1. `release:itch` command chain (`prepare -> verify -> finalize`).
2. Release metadata contract file `src/generated/release.meta.json`.
3. Platform manifest registry under `release/platforms/itch/...`.
4. Vault release ledgers in `obsidian_vault/Releases.md` and `obsidian_vault/releases/itch.md`.

## Planner Chain `PLN-014`
### Goals
1. Reframe progression around business tiers: start in Truck Life, expand to Office, then Yard.
2. Replace daily billing pressure with monthly lump-sum billing on a 22-shift cycle.
3. Add two-strike collapse behavior with forced downgrade chain and hard-reset asset loss on downgrade.
4. Expand trade taxonomy from 19 to 50 skills and grow contract content to 188 jobs.
5. Add Core Perks as deterministic roll modifiers, gated by research unlocks and point spend.

### Constraints
1. Keep core work loop intact; expand management systems additively.
2. Preserve deterministic behavior via seeded flows and explicit log lines.
3. Keep compact mobile contract browsing despite expanded trade catalog.
4. Mobile readability remains primary in new Office surfaces.

### Deliverables
1. `operations.ts` monthly cycle billing, unpaid balance carry, late fee, and downgrade chain logic.
2. Facility actions and UI path for office/yard open-close and dumpster enablement.
3. Trade content and schema expansion to 188 jobs with 50 supported skill IDs.
4. Perks system integration into work resolution (quality/skill/time/economy modifiers).
5. Deterministic coverage for monthly economy, eviction, trash mode routing, perk modifiers, and catalog integrity.

## Recent Closeouts
1. `PLN-014 -> BLD-014 -> TW-014 -> VF-014 -> DOC-014`
Result: monthly-tier economy, 50-skill trade expansion, 188-job catalog, compact rotating board behavior, and perks-as-modifiers shipped with green validation gates.
2. `PLN-012 -> BLD-012 -> TW-012 -> VF-012 -> DOC-012`
Result: Office ops expansion shipped with R&D gating, daily bills, dumpster logistics, readability/accounting clarity systems, and green regression gates.
3. `PLN-011 -> BLD-011 -> TW-011 -> VF-011 -> DOC-011`
Result: trade overhaul baseline (19 skills / 95 jobs / 10 bots) shipped and verified.

## Archive
1. Closed lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Earlier task-history notes remain under [archive](/g:/ErrorHammer/obsidian_vault/archive).
