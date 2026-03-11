# Testing Contract

## Scope
1. Runtime target is the Error Hammer web app across `src/main.tsx`, `src/ui/**`, and `src/core/**`.
2. Canonical gate order is:
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
Evidence: production bundle emitted with existing large-asset warnings.

## Suite Notes
1. `tests/ui_shell.test.tsx` is the primary compact-shell interaction suite.
2. `tests/tw_scenarios.test.ts` remains the deterministic scenario suite.
3. Long-running pacing/stability suites are part of default `npm test`.

## Manual Smoke Baseline
1. Start new game and verify title gating for both names.
2. Accept and execute a contract across Work/Company surfaces.
3. Verify out-of-gas rescue plus day-labor fallback behavior.
4. Verify Facilities unlock actions and Finance clarity masking behavior.

## Evidence Ownership
1. `Build` lane records targeted check outcomes for the touched slice.
2. `Verify` lane records full gate results tied to exit evidence in `docs/process/tasks.md`.
