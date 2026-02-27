# Vision
## Product Direction
1. Ship Error Hammer as a text-first construction ladder sim with dry, wholesome humor.
2. Keep the core loop fast and readable: pick contracts, resolve day, review logs, repeat.
3. Keep content scalable through JSON packs plus schema validation so new jobs/events/tools can be added safely.
4. Keep resolution deterministic from seeded RNG so test runs and bug reports are reproducible.
5. Keep architecture server-ready by using pure intent-resolution modules with no UI-owned gameplay state mutations.
6. Keep MVP single-player with AI competitors; multiplayer remains explicitly out of scope.
7. Treat `Spec.md` as the implementation source of truth for bootstrap scope and acceptance gates.

## Current Runtime Baseline (`main` workspace, 2026-02-27)
1. Error Hammer MVP bootstrap is implemented and runnable with React + TypeScript + Vite.
2. Deterministic runtime modules are active in `src/core/**`: `rng.ts`, `economy.ts`, `bots.ts`, `resolver.ts`, `save.ts`, and `content.ts`.
3. UI orchestration shell is active in `src/ui/**` with `Title`, `Main`, `Store`, and `Company` screens plus resolver-fed components.
4. Content pipeline is active across `content/**`, `schemas/**`, and `scripts/content_validate.ts` + `scripts/content_compile.ts`.
5. Generated runtime bundle `src/generated/content.bundle.json` is present and tracked for bootstrap baseline reproducibility.
6. CI workflow `.github/workflows/ci.yml` runs `npm ci`, `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
7. Verified MVP content minimums are met: `tools=10`, `jobs=30`, `events=12`, `districts=3`, `bots=2`.
8. Save/continue path uses single-slot `localStorage` helpers in `src/core/save.ts`.

## Verification State (2026-02-27)
1. `TW-002` deterministic scenario suite `EH-TW-001..EH-TW-016` is complete and passing.
2. `VF-002` checklist is complete with PASS results for content validation, content compile, tests, and production build.
3. Deterministic replay checks passed for both generated-bundle and in-memory positive-path seeds.
4. Manual smoke checks passed for new game flow, day resolve/report rendering, Store/Company navigation, and refresh/continue restore.
5. Evidence details are recorded in `obsidian_vault/Testing.md`.

## Next Focus
1. Open a new Planner card (`PLN-003`) before any post-bootstrap runtime feature work.
2. Keep this documented baseline as the handoff anchor for future lane chains.
3. Preserve deterministic resolver and content-pipeline constraints in all follow-on scope.

## Archive
1. Migration snapshot: `obsidian_vault/archive/Migration-Legacy-2026-02-27.md`.
