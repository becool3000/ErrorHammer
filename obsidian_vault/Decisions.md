# Decisions
## Active Decisions
1. Runtime target is a browser-first web app (`itch` HTML5 first), implemented with React + TypeScript + Vite.
2. Gameplay resolution is deterministic and seed-driven; gameplay randomness must flow only through `src/core/rng.ts`.
3. Gameplay logic is isolated in pure core modules under `src/core/**`; UI does not mutate gameplay state directly.
4. Core day loop contract is `board generation -> actor intents -> conflict resolution -> outcomes -> event application -> end-of-day report`.
5. Contract conflicts resolve by higher reputation; ties resolve with deterministic seeded tie-breakers.
6. Player and bots use the same actor model and rule constraints (no bot cheating).
7. Tool requirements are hard gates for assignment eligibility.
8. Tool durability cannot drop below `0`; tools at `0` are unusable until repaired/replaced.
9. Stamina cannot go negative and resets at day start.
10. Content is JSON-driven under `content/**` and validated by JSON Schemas under `schemas/**`.
11. Content validation must fail fast on schema violations in local and CI workflows.
12. Content compiler emits one normalized runtime bundle at `src/generated/content.bundle.json`.
13. Generated content bundle `src/generated/content.bundle.json` is tracked in git for bootstrap baseline.
14. Initial MVP save system uses local `localStorage` single-slot persistence.
15. MVP scope remains single-player with bots; no realtime or async multiplayer behavior in this phase.
16. Tone constraints are mandatory content requirements: each job and event includes `success_line`, `fail_line`, and `neutral_line`.
17. Zustand is the UI state layer; resolver/core modules remain gameplay source of truth.
18. Lane workflow source of truth remains `Planner -> Builder -> TestWriter -> Verifier -> Documenter`.
19. Bootstrap execution chain for this baseline is `PLN-002 -> BLD-002 -> TW-002 -> VF-002 -> DOC-002`.
20. Full `Spec.md` MVP bootstrap scope ships in one Builder card (`BLD-002`) unless superseded by a future Planner card.
21. TestWriter owns deterministic behavior tests; Builder provides harness wiring and only minimal smoke scaffolds.
22. WIP limit remains one `IN_PROGRESS` card per lane.
23. Any new lane-scoped file exceptions must be approved by a Planner card before implementation.
24. Planner-approved Builder lane exception for `BLD-002`: create `.github/workflows/ci.yml` for command-gate CI.
25. Root implementation path remains `g:\ErrorHammer`; `Spec.md` folder naming example does not require a repo rename.
26. Archive history from the prior legacy source project is retired for this repo and replaced by a single migration snapshot note.
27. Bootstrap lane closeout status as of 2026-02-27 is `DONE` for `BLD-002`, `TW-002`, `VF-002`, and `DOC-002`.
28. Verified behavior source of truth for bootstrap closeout is `obsidian_vault/Testing.md` command, replay, and smoke evidence.
29. Deterministic bot-buy economy execution chain is `PLN-003 -> BLD-003 -> TW-003 -> VF-003 -> DOC-003`.
30. Resolver order includes a post-resolution bot purchase phase after next-day board generation and before next state persistence.
31. Bot purchase candidates are tools that are missing or have `durability = 0`, and must be affordable with event-adjusted pricing (`applyToolPriceModifiers`).
32. Bot purchase scoring reuses `evaluateBotPlan` with `tieNoise=false` for baseline and simulated tool states.
33. Bot purchase threshold rule is `weightedGain = scoreGain * wToolBuy`, and purchase requires `weightedGain >= 20`.
34. Bot purchase tie-break order is `weightedGain desc`, then `price asc`, then `toolId asc`.
35. Bot purchase limit is one tool per bot per day.
36. Purchase visibility is mandatory via day log lines in format `"{botName} bought {toolName} for ${price}."`.
37. Bot-buy lane closeout status as of 2026-02-27 is `DONE` for `BLD-003`, `TW-003`, `VF-003`, and `DOC-003`.
38. Verified behavior source of truth for bot-buy closeout is `obsidian_vault/Testing.md` command, replay, and smoke evidence.
39. Itch publish packaging execution chain is `PLN-004 -> BLD-004 -> TW-004 -> VF-004 -> DOC-004`.
40. Vite production builds must use `base = "./"` so emitted asset URLs remain relative for static HTML hosts such as itch.io.
41. Itch.io upload artifact is a ZIP of `dist/` contents only; repo root files, `node_modules/`, and source files are excluded.
42. Itch packaging verification evidence must include both a relative-asset-path check in `dist/index.html` and a ZIP entry-count check.
43. Compact-shell redesign execution chain is `PLN-005 -> BLD-005 -> TW-005 -> VF-005 -> DOC-005`.
44. The game UI uses a compact mobile-first shell with bottom-tab navigation for `Work`, `Contracts`, `Store`, and `Company`.
45. `Work` is the default post-load destination and keeps the active job, current task, and primary task actions in the top-level mobile viewport.
46. Secondary information such as job details, inventory, field log, district details, crew status, competitor news, and supplier cart details must render in overlays instead of long primary-page stacks.
47. Store interaction uses segmented compact sections (`Fuel`, `Tools`, `Stock`) and must visibly lock transactional actions when the player is away from the shop.
48. The visual direction for the shell is a dark industrial palette: matte black and gunmetal surfaces, silver accents, restrained motion, and compact card density.
49. Compact-shell verification must include automated tab/overlay interaction coverage plus mobile-width smoke evidence.

## Superseded Decisions
1. Legacy source project runtime, scenario, and pack decisions are superseded for this repository.
2. Prior bootstrap execution chain `PLN-001 -> BLD-001 -> TW-001 -> VF-001 -> DOC-001` is superseded by decision `19`.

## Archive
1. Migration note: `obsidian_vault/archive/Migration-Legacy-2026-02-27.md`.
