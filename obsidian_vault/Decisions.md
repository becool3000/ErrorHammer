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
19. Active card chain for current bootstrap execution is `PLN-002 -> BLD-002 -> TW-002 -> VF-002 -> DOC-002`.
20. Full `Spec.md` MVP bootstrap scope ships in one Builder card (`BLD-002`) unless superseded by a future Planner card.
21. TestWriter owns deterministic behavior tests; Builder provides harness wiring and only minimal smoke scaffolds.
22. WIP limit remains one `IN_PROGRESS` card per lane.
23. Any new lane-scoped file exceptions must be approved by a Planner card before implementation.
24. Planner-approved Builder lane exception for `BLD-002`: create `.github/workflows/ci.yml` for command-gate CI.
25. Root implementation path remains `g:\ErrorHammer`; `Spec.md` folder naming example does not require a repo rename.
26. Archive history from the prior legacy source project is retired for this repo and replaced by a single migration snapshot note.

## Superseded Decisions
1. Legacy source project runtime, scenario, and pack decisions are superseded for this repository.
2. Prior bootstrap execution chain `PLN-001 -> BLD-001 -> TW-001 -> VF-001 -> DOC-001` is superseded by decision `19`.

## Archive
1. Migration note: `obsidian_vault/archive/Migration-Legacy-2026-02-27.md`.
