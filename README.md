# Error Hammer

## Status (2026-03-10)
1. Quality-gate cleanup and UI migration cleanup are applied on `main`.
2. UI readability obfuscation is unchanged in runtime; UI tests were stabilized with selector-first assertions and durable selectors.
3. Legacy orphan screens were removed: `src/ui/screens/Main.tsx`, `Store.tsx`, `Company.tsx`, `ResearchTab.tsx`.
4. Typecheck is now a first-class command and CI gate.
5. Save schema version is `SAVE_VERSION=7` (`src/core/save.ts`).

## Run Instructions
1. Install dependencies: `npm install`
2. Validate content: `npm run content:validate`
3. Compile generated bundle: `npm run content:compile`
4. Typecheck: `npm run typecheck`
5. Run tests: `npm test`
6. Build production bundle: `npm run build`
7. Start local dev server: `npm run dev`

## Current Verified Gate Snapshot (2026-03-10)
1. `npm run content:validate` PASS
2. `npm run content:compile` PASS
3. `npm run typecheck` PASS
4. `npm test` PASS (`40` files, `279` tests)
5. `npm run build` PASS

## Usage
1. Start at title, enter both Player and Company names, then `New Game`.
2. Bottom nav is `Work`, `Company`, `End Day`, and `Settings`.
3. `Company` is internally the `office` tab and is split into `Contracts`, `Facilities`, and `Finance`.
4. `Work` keeps active task flow, gas-station controls, out-of-gas rescue, overlays, and action carousel behavior.
5. `Contracts` includes trade groups, Baba spotlight, quick-buy planning, likely-loss warning flow, and day-labor fallback.
6. `Facilities` handles progression actions (`open-storage`, `open-office`, `open-yard`, dumpster enable, manual close actions).
7. `Finance` renders accounting-ledger views with clarity-based masking/unmasking.
8. Crew and assignment systems are intentionally frozen in UI as `Crew: Coming Soon`.
9. Accountant hiring action is currently disabled in UI state (`src/ui/state.ts`).

## Testing
1. Deterministic scenario tests remain in `tests/tw_scenarios.test.ts`.
2. Shell/UI interaction coverage remains in `tests/ui_shell.test.tsx`.
3. Core/system suites include resolver, economy, progression, operations, contracts, bots, release, and readability tests.
4. `npm test` currently takes several minutes because long-running pacing/stability suites are included in the default run.

## Itch.io Publish
1. Run `npm run release:itch`.
2. If release notes are incomplete, fill `release/platforms/itch/releases/<releaseId>/CHANGELOG.md` and rerun.
3. Upload `error-hammer-vX.Y.Z+itch.YYYYMMDD.NN-itch.zip`.
4. Release manifests are written under `release/platforms/itch/releases/<releaseId>/`.

## Workflow
1. Lane order remains `Planner -> Builder -> TestWriter -> Verifier -> Documenter`.
2. Handoff source of truth is `obsidian_vault/Tasks.md` (`Active Lane Board`).
3. WIP limit remains one `IN_PROGRESS` card per lane.
4. Commit messages keep one lane tag prefix: `[Planner]`, `[Builder]`, `[TestWriter]`, `[Verifier]`, or `[Documenter]`.
