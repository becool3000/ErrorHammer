Original prompt: show reading and accounting skills first, make sure all skill start with 0 xp and 0 lvl only show skills that are unlocked

- Updated defaults: player trade skills now initialize at 0 XP; office reading/accounting now initialize at 0 XP.
- Updated Skills modal: Reading and Accounting rows are rendered first, then only trade skills mapped to unlocked core tracks.
- Updated UI test EH-TW-054 to assert new ordering/visibility/level behavior.
- Pending: run tests and verify no regressions.
- Verification complete: `npm.cmd test` passed (241/241), `npm.cmd run build` passed.
- Test updates required due 0-XP baseline: scenario helpers now normalize pre-fast-forward skill baseline to Lv0->Lv1 floor for deterministic reachability, and recovery settlement assertion now reads contract file outcome.
- TODOs for next pass: if desired, expose explicit unlock badges in Skills modal for newly unlocked trade tracks.

- Implemented competitor parity refactor: added persistent `botCareers` to `GameState` and created full per-competitor career runtime state (`BotCareerState`) with player-equivalent slices.
- Replaced lightweight competitor simulation with parity engine in `src/core/bots.ts` that uses player flow APIs (offer evaluation, quick-buy, accept, task loop, recovery, facilities, research, perks, day rollover).
- Updated `endShift` to simulate competitors through the parity engine and sync `state.bots` from `state.botCareers` snapshots.
- Kept `applyBotPurchasesForNextDay` as legacy no-op compatibility path to avoid divergent purchase-only logic.
- Bumped save format to v7 (`src/core/save.ts`) and added tests for v6 rejection + v7 load behavior with `botCareers`.
- Updated resolver/playerFlow/UI state cloning/normalization to persist and deep-copy `botCareers` safely.
- Updated bot/resolver/scenario tests to assert one-contract-per-day behavior, day-labor fallback, active-job carryover, facility/research/perk deterministic policies, and snapshot sync.
- Verification complete:
  - `npm.cmd test -- tests/bots.test.ts tests/resolver.test.ts tests/tw_scenarios.test.ts` passed.
  - `npm.cmd test -- tests/ui_shell.test.tsx tests/release_ui.test.tsx` passed.
  - `npm.cmd test` full suite passed (39 files, 252 tests).
  - `npm.cmd run build` passed.
