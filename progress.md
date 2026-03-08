Original prompt: show reading and accounting skills first, make sure all skill start with 0 xp and 0 lvl only show skills that are unlocked

- Updated defaults: player trade skills now initialize at 0 XP; office reading/accounting now initialize at 0 XP.
- Updated Skills modal: Reading and Accounting rows are rendered first, then only trade skills mapped to unlocked core tracks.
- Updated UI test EH-TW-054 to assert new ordering/visibility/level behavior.
- Pending: run tests and verify no regressions.
- Verification complete: `npm.cmd test` passed (241/241), `npm.cmd run build` passed.
- Test updates required due 0-XP baseline: scenario helpers now normalize pre-fast-forward skill baseline to Lv0->Lv1 floor for deterministic reachability, and recovery settlement assertion now reads contract file outcome.
- TODOs for next pass: if desired, expose explicit unlock badges in Skills modal for newly unlocked trade tracks.
