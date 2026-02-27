# Testing
## Scope
1. Runtime target is the Error Hammer web app (`src/main.tsx` + `src/ui/**` + `src/core/**`).
2. Canonical automated suite is `npm test` (Vitest).
3. Content quality gate is `npm run content:validate` using JSON Schema validation.
4. Content bundle gate is `npm run content:compile` producing `src/generated/content.bundle.json`.
5. Build gate is `npm run build`.
6. Determinism contract baseline is seeded resolver parity using fixed day seeds and identical intent sets.

## Required Verification Commands
1. `npm run content:validate`
2. `npm run content:compile`
3. `npm test`
4. `npm run build`

## Deterministic Scenario Contract (`EH-TW-*`)
1. Scenario assertions must be explicit and deterministic.
2. Preferred assertion fields are `day`, `actorId`, `contractId`, `outcome`, `cashDelta`, `repDelta`, `staminaBefore`, `staminaAfter`, `toolDurabilityBefore`, `toolDurabilityAfter`, and `logLine`.

## Full Bootstrap Scenario Set (`TW-002` planned)
1. `EH-TW-001`: same seed + same intents + same content bundle yields identical resolution digest.
2. `EH-TW-002`: different seed with same intents can produce different but valid deterministic outcomes.
3. `EH-TW-003`: assignment fails when actor stamina is insufficient.
4. `EH-TW-004`: assignment fails when required tool is missing.
5. `EH-TW-005`: durability decreases on tool use.
6. `EH-TW-006`: durability never drops below `0`.
7. `EH-TW-007`: broken tools (`durability = 0`) cannot satisfy job requirements.
8. `EH-TW-008`: conflict winner is highest-reputation actor.
9. `EH-TW-009`: equal-reputation conflict resolves deterministically by seeded tie-break.
10. `EH-TW-010`: conflict loser spends no stamina and receives no payout.
11. `EH-TW-011`: event modifiers alter payout and risk as defined in event content.
12. `EH-TW-012`: schema validation fails when required flavor lines are missing.
13. `EH-TW-013`: content compiler emits normalized bundle with expected top-level keys.
14. `EH-TW-014`: save/load round-trip preserves state.
15. `EH-TW-015`: bots obey the same stamina and tool gates as player actors.
16. `EH-TW-016`: end-of-day report lines include required outcome text fields.

## Manual Smoke Checklist (`VF-002` planned)
1. New game flow loads and day `1` board renders without errors.
2. Player can assign at least one valid contract and resolve day.
3. End-of-day report shows ledger deltas and flavor lines.
4. Continue/load path restores saved game state.
5. Title, Main, Store, and Company screens are reachable.

## Evidence Log
1. `PLN-001` date: 2026-02-27.
2. `PLN-002` date: 2026-02-27.
3. `TW-001` evidence: superseded by `TW-002`.
4. `TW-002` evidence: pending.
5. `VF-002` evidence: pending.
