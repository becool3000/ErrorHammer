# Decisions
## Active Decisions
1. Runtime target is a browser-first web app built with React, TypeScript, and Vite.
2. Gameplay resolution remains deterministic and seed-driven; randomness must route through `src/core/rng.ts`.
3. Gameplay logic stays in pure core modules under `src/core/**`; UI must not mutate gameplay state directly.
4. Content remains JSON-driven under `content/**`, validated by schemas, and compiled into `src/generated/content.bundle.json`.
5. The generated content bundle stays tracked in git for reproducible baselines.
6. Save/load remains a single-slot local `localStorage` path.
7. The compact mobile-first shell with bottom-tab navigation for `Work`, `Contracts`, `Store`, and `Company` remains the active UI model.
8. Secondary information stays in overlays instead of long primary-page stacks.
9. Store interactions remain visibly locked when the player is away from the shop.
10. Crew hiring remains deterministic: fixed three-slot roster order, unlock at `companyLevel >= 2`, shared player tools, and active-job assignee support.
11. Active events remain read-only gameplay inputs, but the `Work` view must surface their cues for planning.
12. Final rolling-session UI contract is locked: `Current Task` renders before `Active Job`, workday and active-job panels start collapsed, supplier-cart checkout guidance stays inline, and visible work actions collapse to overtime-only buttons when regular actions no longer fit.
13. Visible skill levels use the tiered cumulative curve `0, 100, 250, 450, 650, 850, +200...`.
14. Operator Level is derived from average raw XP across all tracked skills.
15. Progression popup order is deterministic: `XP Earned -> Skill Leveled Up -> Operator Leveled Up!`.
16. Progression popups do not auto-dismiss; the player advances the queue manually.
17. Player-facing skill labels must use readable names such as `AI Tools`, `HVAC`, `CAD`, and `Sheet Metal`.
18. `Tasks.md` is the live handoff board, and `Testing.md` is the live evidence summary.

## Archive
1. Closed-chain and lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Detailed testing contract history is archived in [Testing-Scenario-Map-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Testing-Scenario-Map-2026-03-01.md).
3. Earlier legacy decision history remains in [Decisions-History-2026-02-13.md](/g:/ErrorHammer/obsidian_vault/archive/Decisions-History-2026-02-13.md).
