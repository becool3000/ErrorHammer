# Testing
## Scope
1. Runtime target is the Error Hammer web app (`src/main.tsx` + `src/ui/**` + `src/core/**`).
2. Canonical automated suite is `npm test` (Vitest).
3. Content quality gate is `npm run content:validate`.
4. Content bundle gate is `npm run content:compile`.
5. Determinism contract baseline is seeded resolver parity using fixed day seeds and identical intent sets.
6. Bootstrap verification chain status is complete for `TW-002` and `VF-002` (2026-02-27).

## Required Verification Commands
1. `npm run content:validate`
2. `npm run content:compile`
3. `npm test`
4. `npm run build`

## Deterministic Scenario Contract (`EH-TW-*`)
1. Scenario assertions are explicit and deterministic.
2. Assertions use day-resolution fields: `day`, `actorId`, `contractId`, `outcome`, `cashDelta`, `repDelta`, `staminaBefore`, `staminaAfter`, `toolDurabilityBefore`, `toolDurabilityAfter`, and `logLine`.

## Automated Scenario Definitions (`TW-002`)
1. `EH-TW-001`
Sequence: Run `resolveDay` twice with the same bundle, state, intents, and day seed.
Pass criteria: digest, resolutions, and day log arrays are identical, and the player resolution matches exact outcome/cash/rep/stamina/durability/log values.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-001`.
2. `EH-TW-002`
Sequence: Resolve equal-reputation conflict with one seed, then search alternate seed and resolve again.
Pass criteria: each seed is internally deterministic on repeat; at least one alternate seed yields a different digest while still producing only valid outcomes.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-002`.
3. `EH-TW-003`
Sequence: Set player stamina below job `staminaCost` and submit assignment intent.
Pass criteria: player has no resolution entry, cash is unchanged, and day log records stamina-short rejection.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-003`.
4. `EH-TW-004`
Sequence: Assign job requiring a tool the player does not own.
Pass criteria: player has no resolution entry and day log records missing usable tools.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-004`.
5. `EH-TW-005`
Sequence: Resolve successful job with required tool durability above cost.
Pass criteria: `toolDurabilityAfter` is strictly lower than `toolDurabilityBefore` by `durabilityCost` and stamina delta equals job `staminaCost`.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-005`.
6. `EH-TW-006`
Sequence: Set required tool durability to `1` and resolve job with `durabilityCost > 1`.
Pass criteria: `toolDurabilityAfter` equals `0` and never goes negative.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-006`.
7. `EH-TW-007`
Sequence: Set required tool durability to `0` and attempt assignment.
Pass criteria: player has no resolution entry and day log records missing usable tools.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-007`.
8. `EH-TW-008`
Sequence: Submit same contract from player and bot with player reputation higher.
Pass criteria: player resolution is winning outcome, bot resolution is `lost`, and `winnerActorId` is player.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-008`.
9. `EH-TW-009`
Sequence: Submit same contract from player and bot at equal reputation with fixed day seed.
Pass criteria: repeated runs with the same day seed produce identical tie-break winner and identical resolution array.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-009`.
10. `EH-TW-010`
Sequence: Force a losing bot conflict case.
Pass criteria: loser resolution has `cashDelta = 0`, `repDelta = 0`, identical stamina before/after, and unchanged tool durability.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-010`.
11. `EH-TW-011`
Sequence: Apply event with `payoutMultByTag` and `riskDeltaByTag`, resolve with event and without event.
Pass criteria: helper calculations produce expected multiplier/risk values, and successful event run payout reflects reduced multiplier compared with baseline.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-011`.
12. `EH-TW-012`
Sequence: Remove required `success_line` from one job flavor payload and run schema validation.
Pass criteria: validation fails and error set includes missing `success_line` evidence.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-012`.
13. `EH-TW-013`
Sequence: Validate runtime content, normalize bundle, and inspect keys/order.
Pass criteria: normalized bundle contains exactly `bots`, `districts`, `events`, `jobs`, `strings`, `tools`; tool/job ids are sorted; normalization is idempotent.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-013`.
14. `EH-TW-014`
Sequence: Mock `localStorage`, call `save`, `load`, and `clear`.
Pass criteria: loaded state deep-equals saved state and `load` returns `null` after clear.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-014`.
15. `EH-TW-015`
Sequence: Generate bot intents for broken-tool, low-stamina, and valid actors.
Pass criteria: broken-tool and low-stamina actors produce zero assignments; valid actor produces only feasible assignment.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-015`.
16. `EH-TW-016`
Sequence: Resolve success, fail, and neutral outcome variants.
Pass criteria: each resolution `logLine` and corresponding day log message match required flavor text fields (`success_line`, `fail_line`, `neutral_line`).
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-016`.

## Automated Execution Steps (`TW-002`)
1. Run `npm test`.
2. Run `npm run content:validate`.
3. Run `npm run content:compile`.

## Manual Smoke Steps (executed by `VF-002`)
1. Start app with `npm run dev` and open the local URL.
2. Start a new game and assign at least one valid contract.
3. Resolve a day and confirm report lines and ledger deltas render.
4. Visit Store and Company screens and confirm navigation is stable.
5. Refresh and use Continue to verify save/load path.

## Evidence Log
1. `PLN-001` date: 2026-02-27.
2. `PLN-002` date: 2026-02-27.
3. `TW-001` evidence: superseded by `TW-002`.
4. `TW-002` automated evidence date: 2026-02-27.
5. `TW-002` command evidence: `npm test` PASS (`27` tests), `npm run content:validate` PASS (`tools=10 jobs=30 events=12 districts=3 bots=2`), `npm run content:compile` PASS (bundle emitted at `src/generated/content.bundle.json`).
6. `VF-002` evidence date: 2026-02-27.
7. `VF-002` command evidence: `npm run content:validate` PASS (`tools=10 jobs=30 events=12 districts=3 bots=2`), `npm run content:compile` PASS (bundle emitted at `src/generated/content.bundle.json`), `npm test` PASS (`5` files, `27` tests), `npm run build` PASS (Vite build completed with `dist/index.html`, `dist/assets/index-D1mm2bDQ.css`, `dist/assets/index-CqLYUXQk.js`).
8. `VF-002` deterministic replay evidence A (generated bundle): `daySeed=424242`, `contractId=D1-C1-job-003`, `digestA=c26a700e`, `digestB=c26a700e`, `sameDigest=true`, `sameResolutions=true`, `sameDayLog=true`.
9. `VF-002` deterministic replay evidence B (positive-path in-memory bundle): `daySeed=123456`, `digestA=7bd317db`, `digestB=7bd317db`, `sameDigest=true`, `sameResolutions=true`, `sameDayLog=true`, `playerOutcome=success`.
10. `VF-002` manual smoke evidence (headless): dev server URL probe PASS (`http://127.0.0.1:4173` returned `200` with root mount), UI flow smoke via store actions PASS (`New Game` -> assign/confirm day -> report data present -> `Store`/`Company` navigation stable -> simulated refresh + `Continue` restored saved game with matching day).
11. `DOC-002` evidence date: 2026-02-27.
12. `DOC-002` documentation evidence: `README.md`, `obsidian_vault/Vision.md`, `obsidian_vault/Decisions.md`, `obsidian_vault/Tasks.md`, and `obsidian_vault/Testing.md` synced to final verified runtime and board state.
