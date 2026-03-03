# Decisions
## Active Decisions
1. Runtime target remains browser-first React + TypeScript + Vite on `main`.
2. Gameplay resolution remains deterministic; all random paths must use seeded RNG utilities in `src/core/rng.ts`.
3. Gameplay mutations stay in core modules under `src/core/**`; UI only dispatches core transitions.
4. Content remains JSON + schema validated + compiled into tracked `src/generated/content.bundle.json`.
5. Trade skill contract is locked to 19 skills and every job must declare exactly one `primarySkill`.
6. Trade job corpus is locked to exactly `95` jobs, with `5` jobs per trade skill.
7. Bot roster is locked to exactly `10` entries in `content/bots.json`.
8. Baba fallback jobs remain separate from trade jobs in `content/baba_jobs.json`.
9. Full contract board generation guarantees one trade offer per skill and deterministic selection by seed/day.
10. Visible offer order is locked: `Day Labor` first, rotating `Baba G` second, then trade offers.
11. Baba job risk floor remains high-risk (`>= 60%` effective policy via existing risk rules).
12. Contracts UI on mobile uses grouped trade tabs instead of a single long contract carousel.
13. Save compatibility for this migration is handled via version bump and hard-reset policy for incompatible legacy saves.
14. `Tasks.md` remains the live lane-board source of truth and `Testing.md` remains the evidence summary source.

## Archive
1. Closed-chain and lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Earlier decision-history notes remain in [Decisions-History-2026-02-13.md](/g:/ErrorHammer/obsidian_vault/archive/Decisions-History-2026-02-13.md).
