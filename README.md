# Error Hammer
## Planning Status (2026-02-27)
1. Active lane chain is `PLN-002 -> BLD-002 -> TW-002 -> VF-002 -> DOC-002`.
2. Current board state is `PLN-002` done, `BLD-002` ready, and downstream cards blocked by dependency.
3. Superseded chain `BLD-001/TW-001/VF-001/DOC-001` remains archived in `obsidian_vault/Tasks.md` for traceability.

## Planner Gates For Bootstrap
1. Builder must deliver full `Spec.md` MVP bootstrap scope in one pass under `BLD-002`.
2. Required quality-gate commands are `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
3. CI must run the same four command gates in `.github/workflows/ci.yml`.
4. Deterministic architecture constraints remain mandatory: pure core resolver flow, seeded RNG path, and UI orchestration-only state interactions.

## Run Instructions
1. Install dependencies: `npm install`
2. Validate content: `npm run content:validate`
3. Compile generated bundle: `npm run content:compile`
4. Run tests: `npm test`
5. Build production bundle: `npm run build`
6. Start local dev server: `npm run dev`

## Testing
1. Execute deterministic automated scenarios: `npm test`
2. Execute schema/content gates: `npm run content:validate` then `npm run content:compile`
3. `TW-002` deterministic scenarios `EH-TW-001..EH-TW-016` are implemented in `tests/tw_scenarios.test.ts`
4. Scenario assertions use day-resolution fields: `outcome`, `cashDelta`, `repDelta`, `staminaBefore`, `staminaAfter`, `toolDurabilityBefore`, `toolDurabilityAfter`, and `logLine`
5. Latest verifier evidence for `VF-002` is recorded in `obsidian_vault/Testing.md` (run date: `2026-02-27`).

## Lane Ownership Snapshot
1. Planner owns scope, constraints, acceptance criteria, and handoff cards.
2. Builder owns implementation under approved file scope plus CI workflow exception (`PLN-002`).
3. TestWriter owns deterministic behavior assertions and scenario evidence.
4. Verifier owns command checklist execution and validated bug-fix patches only.
5. Documenter owns final README and vault closeout updates after verification.
