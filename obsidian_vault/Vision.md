# Vision
## Product Direction
1. Ship Error Hammer as a text-first construction ladder sim with dry, wholesome humor.
2. Keep the core loop fast and readable: pick contracts, resolve day, review logs, repeat.
3. Keep content scalable through JSON packs plus schema validation so new jobs/events/tools can be added safely.
4. Keep resolution deterministic from seeded RNG so test runs and bug reports are reproducible.
5. Keep architecture server-ready by using pure intent-resolution modules with no UI-owned gameplay state mutations.
6. Keep MVP single-player with AI competitors; multiplayer remains explicitly out of scope.
7. Treat `Spec.md` as the current implementation source of truth for bootstrap scope and acceptance gates.

## Current Runtime Baseline (`main` workspace, 2026-02-27)
1. Repository is planning-only at this snapshot (`Agents.md`, `Spec.md`, and vault notes); runtime scaffold is not created yet.
2. Canonical target stack is React + TypeScript + Vite with Zustand as the UI state orchestration layer.
3. Planned gameplay/content roots are `src/core/**`, `src/ui/**`, `content/**`, `schemas/**`, `scripts/**`, and `tests/**`.
4. Planned generated content artifact is `src/generated/content.bundle.json` and it will be tracked in git for bootstrap baseline.
5. Planned canonical quality-gate commands are `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
6. Planned resolver modules are `rng.ts`, `economy.ts`, `bots.ts`, `resolver.ts`, `save.ts`, and `content.ts`.

## Verification State
1. No implementation verification has been executed yet in this repo baseline.
2. No deterministic scenario evidence exists yet; initial deterministic range is defined in `obsidian_vault/Testing.md` for `TW-002`.
3. Initial quality gate for the first implementation chain remains: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
4. CI target for bootstrap is `.github/workflows/ci.yml` running the same command gates.

## Next Focus
1. Execute `BLD-002` to deliver full `Spec.md` MVP bootstrap implementation.
2. Execute `TW-002` deterministic scenario suite (`EH-TW-001..EH-TW-016`) after Builder exit evidence is recorded.
3. Execute `VF-002` verification checklist and patch only validated defects.
4. Execute `DOC-002` documentation closeout after verification evidence is complete.

## Archive
1. Migration snapshot: `obsidian_vault/archive/Migration-Legacy-2026-02-27.md`.
