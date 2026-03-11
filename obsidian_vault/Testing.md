# Testing

## Scope
1. Runtime target is the Error Hammer web app across `src/main.tsx`, `src/ui/**`, and `src/core/**`.
2. Canonical verification checklist is:
1. `npm run content:validate`
2. `npm run content:compile`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

## Current Baseline (2026-03-10)
1. `npm run content:validate` PASS
Evidence: `[content:validate] OK tools=25 jobs=188 babaJobs=22 events=12 districts=3 bots=10 supplies=35`
2. `npm run content:compile` PASS
Evidence: generated bundle written to `src/generated/content.bundle.json`.
3. `npm run typecheck` PASS
Evidence: `tsc --noEmit` returns zero errors.
4. `npm test` PASS
Evidence: `40` test files and `279` tests passed.
5. `npm run build` PASS
Evidence: production bundle emitted; Vite still warns on large JS chunk and large rebarbob image asset.

## Coverage Notes
1. `tests/ui_shell.test.tsx` is the primary compact-shell interaction suite and now validates obfuscated UI via selector-first assertions.
2. `tests/tw_scenarios.test.ts` remains the deterministic scenario suite.
3. Long-running pacing/stability suites are in default `npm test` and drive total test duration.

## Manual Smoke Baseline
1. Start a new game and confirm title-gated name entry.
2. Accept contract flow from Company -> Contracts into Work task execution.
3. Verify out-of-gas rescue, manual gas station controls, and day-labor fallback.
4. Verify Company -> Facilities unlock actions and Company -> Finance clarity masking behavior.

## Archive
1. Detailed scenario map and historical contract text is archived in [Testing-Scenario-Map-2026-03-01.md](/obsidian_vault/archive/Testing-Scenario-Map-2026-03-01.md).
2. Historical evidence logs remain available in git history and prior archive notes.
