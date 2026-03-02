# Vision
## Product Direction
1. Ship Error Hammer as a text-first construction ladder sim with dry, wholesome humor.
2. Keep the core loop fast and readable: pick contracts, work the day, review the log, repeat.
3. Keep gameplay deterministic through seeded RNG and pure core modules under `src/core/**`.
4. Keep content scalable through JSON packs, schema validation, and a generated runtime bundle.
5. Keep the UI compact-first: dense mobile shell, clear overlays, minimal navigation friction.
6. Keep MVP single-player with AI competitors; multiplayer remains out of scope.

## Current Verified Baseline (`main`, 2026-03-01)
1. The browser app is live with a compact shell for `Work`, `Contracts`, `Store`, and `Company`.
2. Secondary views stay in overlays: job details, inventory, skills, field log, district details, crew details, competitor news, and supplier cart details.
3. Core runtime remains deterministic: seeded RNG, pure resolver/player-flow logic, tracked generated content bundle, and single-slot save/load.
4. Crew play is verified: deterministic hire order, level-2 unlock, active-job assignee support, shared tools, and first-commit stamina spend.
5. Final rolling UI session behavior is verified: `Current Task` before `Active Job`, workday and active-job panels collapsed by default, inline supplier-cart guidance, and overtime-only visible stance buttons when regular-hour actions no longer fit.
6. Progression visibility is verified: visible skill levels, derived Operator Level, expanded readable skill labels, and manual-dismiss progression popups.
7. Command-gate and scenario evidence lives in [Testing.md](/g:/ErrorHammer/obsidian_vault/Testing.md).

## Next Focus
1. No lane card is currently `IN_PROGRESS`.
2. The next pull should start with Planner defining a new scoped chain in [Tasks.md](/g:/ErrorHammer/obsidian_vault/Tasks.md).
3. Preserve the current deterministic core, compact-shell model, content-pipeline constraints, and save/continue behavior in future work.

## Archive
1. Closed-chain and verbose board history now lives in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Historical migration context remains in [Migration-Legacy-2026-02-27.md](/g:/ErrorHammer/obsidian_vault/archive/Migration-Legacy-2026-02-27.md).
