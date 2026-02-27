# Error Hammer
## Status (2026-02-27)
1. Bootstrap lane chain `PLN-002 -> BLD-002 -> TW-002 -> VF-002 -> DOC-002` is complete on `main`.
2. Verified command gate snapshot (2026-02-27): `npm run content:validate`, `npm run content:compile`, `npm test` (`5` files, `27` tests), and `npm run build`.
3. Deterministic replay and manual smoke evidence are recorded in `obsidian_vault/Testing.md`.

## Run Instructions
1. Install dependencies: `npm install`
2. Validate content: `npm run content:validate`
3. Compile generated bundle: `npm run content:compile`
4. Run tests: `npm test`
5. Build production bundle: `npm run build`
6. Start local dev server: `npm run dev`

## Usage
1. Start at the title screen and choose `New Game` or `Continue` (single-slot localStorage save).
2. Use `Main` to select assignments, confirm day, and review deterministic `DayReport` results.
3. Use `Store` to buy tools or repair owned tools back to max durability.
4. Use `Company` to review progression and hire up to `3` crews (`$450` each).

## Testing
1. Deterministic scenario suite `EH-TW-001..EH-TW-016` is implemented in `tests/tw_scenarios.test.ts`.
2. Supporting suites are `tests/resolver.test.ts`, `tests/economy.test.ts`, `tests/content_validation.test.ts`, and `tests/bots.test.ts`.
3. Required verification commands are `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
4. Latest verifier run date is `2026-02-27` with evidence in `obsidian_vault/Testing.md`.

## Workflow
1. Lane order remains `Planner -> Builder -> TestWriter -> Verifier -> Documenter`.
2. Handoff source of truth is `obsidian_vault/Tasks.md` under `Active Lane Board (Kanban)`.
3. WIP limit remains one `IN_PROGRESS` card per lane.
4. Commit messages keep one lane tag prefix: `[Planner]`, `[Builder]`, `[TestWriter]`, `[Verifier]`, or `[Documenter]`.
