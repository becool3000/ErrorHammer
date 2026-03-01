# Vision
## Product Direction
1. Ship Error Hammer as a text-first construction ladder sim with dry, wholesome humor.
2. Keep the core loop fast and readable: pick contracts, resolve day, review logs, repeat.
3. Keep content scalable through JSON packs plus schema validation so new jobs/events/tools can be added safely.
4. Keep resolution deterministic from seeded RNG so test runs and bug reports are reproducible.
5. Keep architecture server-ready by using pure intent-resolution modules with no UI-owned gameplay state mutations.
6. Keep MVP single-player with AI competitors; multiplayer remains explicitly out of scope.
7. Treat `Spec.md` as the implementation source of truth for bootstrap scope and acceptance gates.

## Current Runtime Baseline (`main` workspace, 2026-03-01)
1. Error Hammer MVP bootstrap is implemented and runnable with React + TypeScript + Vite.
2. Deterministic runtime modules are active in `src/core/**`: `rng.ts`, `economy.ts`, `bots.ts`, `resolver.ts`, `save.ts`, and `content.ts`.
3. UI orchestration shell is active in `src/ui/**` with a title screen plus a compact mobile-first game shell using `Work`, `Contracts`, `Store`, and `Company` tabs.
4. The active gameplay path is compact-first: task actions stay in the `Work` tab while job details, inventory, field log, district details, crew details, competitor news, and supplier cart details render in modals or a bottom sheet.
5. Content pipeline is active across `content/**`, `schemas/**`, and `scripts/content_validate.ts` + `scripts/content_compile.ts`.
6. Generated runtime bundle `src/generated/content.bundle.json` is present and tracked for bootstrap baseline reproducibility.
7. CI workflow `.github/workflows/ci.yml` runs `npm ci`, `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
8. Verified MVP content minimums are met: `tools=10`, `jobs=30`, `events=12`, `districts=3`, `bots=2`.
9. Save/continue path uses single-slot `localStorage` helpers in `src/core/save.ts`.
10. End-of-day resolver includes deterministic bot tool purchases (one max per bot/day) with purchase lines appended to day logs and reports.
11. Production builds use relative asset paths so HTML uploads load correctly from itch.io ZIP roots.

## Verification State (2026-03-01)
1. `TW-005` compact-shell scenarios `EH-TW-023..EH-TW-034` are complete and passing alongside the existing deterministic gameplay suites.
2. `VF-005` checklist is complete with PASS results for content validation, content compile, tests, production build, and mobile-width shell checks.
3. The runtime now uses a black-and-silver industrial dashboard aesthetic with compact cards, bottom navigation, segmented store views, contract carousel selection, and overlay-based detail views.
4. Evidence details are recorded in `obsidian_vault/Testing.md`.
5. `EH-TW-043` verifies that the title screen retains trimmed player/company names, disables `New Game` until both fields are populated, and repopulates the fields after returning to the title screen so the compact shell always reflects the chosen names.

## Next Focus
1. Continue planning `PLN-006` for the Name + Hour flow and keep the `PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006` chain aligned so the builder, test, verifier, and documenter lanes can deliver title-name prompts, hour terminology, quick-buy tooling, and modal-only company details.
2. Once `PLN-006` hands off, stage `PLN-007` to unlock the deferred crew workflow and surface event/opportunity cues so the loop gains meaningful progression depth plus actionable context before contracts are accepted.
3. Keep this documented baseline as the handoff anchor for future lane chains.
4. Preserve deterministic resolver, bot-buy ordering rules, content-pipeline constraints, compact-shell navigation model, and relative-path packaging requirement in follow-on scope.

## Archive
1. Migration snapshot: `obsidian_vault/archive/Migration-Legacy-2026-02-27.md`.
