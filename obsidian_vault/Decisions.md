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
50. Name + Hour flow planning chain `PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006` captures the title-screen name/company prompts, hours terminology, quick-buy gating, and modal-only company details while obeying the established lane and handoff rules.
51. Crew hiring unlock is gated by the first progression milestone (`companyLevel >= 2`), and crews live in `ActorState.crews` (max three); they share the same stamina and job-eligibility constraints as the player so they feel like deterministic help rather than extra randomness.
52. `PLN-007` crew play is anchored to the shipped active-job shell: accepted jobs carry an explicit assignee (`self` or `crewId`), the compact shell exposes that choice without adding a new screen, and `playerFlow.ts` remains the player-facing execution path for crew work.
53. Resolver support for non-`self` assignees remains part of the deterministic core contract; Builder may extend or harden that support, but `BLD-007` must not depend on a full return to the legacy board-intent UI.
54. Title inputs on the title screen must persist trimmed player/company strings in UI state, enforce that `New Game` stays disabled until both fields contain trimmed values, and repopulate those strings whenever control returns to the title screen so the compact shell always reuses the chosen names.
55. Name + Hour lane closeout status as of 2026-03-01 is `DONE` for `BLD-006`, `TW-006`, `VF-006`, and `DOC-006`.
56. Verified behavior source of truth for the Name + Hour closeout is `obsidian_vault/Testing.md` command, scenario, and manual smoke evidence.
57. Crew hiring is deterministic and non-random: the player fills the lowest open crew slot from a fixed three-slot roster/order, and any initial crew stats or labels must come from static data rather than new runtime RNG calls.
58. Crew work in the compact shell reuses the player's shared tool inventory; `BLD-007` must not introduce crew-specific tool ownership, extra stores, or a second economy path.
59. Active events continue to drive payout/risk modifiers, but the `Work` hero must surface each live event's `headline`, `impact_line`, and derived tag cue chips so players can plan quick buys and contract choices without digging through logs; the UI remains read-only over existing event defs/modifiers.
60. `PLN-007` must preserve save/continue continuity on `main`: any new crew or active-job assignee fields need safe defaults for existing saves or an explicit compatibility guard rather than silent corruption.
61. Gameplay depth planning chain `PLN-007 -> BLD-007 -> TW-007 -> VF-007 -> DOC-007` is the active post-`DOC-006` lane chain for `main`.
62. `BLD-007` is verified closed: active jobs default to `assignee = "self"`, crew hires follow the fixed roster order `crew-1 -> crew-2 -> crew-3`, and assignee stamina is committed once on first work execution rather than per later task step.
63. `TW-007`, `VF-007`, and `DOC-007` are complete as of 2026-03-01, and their verification/documentation source of truth remains `obsidian_vault/Testing.md` plus README usage/testing sections.
64. `PLN-008` opens a rolling Builder session for iterative UI/UX work on `main` using a single active Builder card (`BLD-008`) instead of repeated Planner handoffs for each small batch.
65. `BLD-008` uses small frequent `[Builder]` commits, remains `IN_PROGRESS` until the user explicitly ends the session, and defers `TW-008`, `VF-008`, and `DOC-008` until that explicit close command.
66. Builder may ship UI/UX improvements and directly supporting refinements during `BLD-008`, but must pause for Planner input before introducing new gameplay systems, economy/progression rule changes, material content expansion, or broader product redesign.

## Superseded Decisions
1. Legacy source project runtime, scenario, and pack decisions are superseded for this repository.
2. Prior bootstrap execution chain `PLN-001 -> BLD-001 -> TW-001 -> VF-001 -> DOC-001` is superseded by decision `19`.

## Archive
1. Migration note: `obsidian_vault/archive/Migration-Legacy-2026-02-27.md`.
