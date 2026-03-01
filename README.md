# Error Hammer
## Status (2026-03-01)
1. Mobile compact shell chain `PLN-005 -> BLD-005 -> TW-005 -> VF-005 -> DOC-005` is complete on `main`.
2. Verified command gate snapshot (2026-03-01): `npm run content:validate`, `npm run content:compile`, `npm test` (`7` files, `39` tests), and `npm run build`.
3. Deterministic replay, mobile-shell UI evidence, and itch packaging evidence are recorded in `obsidian_vault/Testing.md`.

## Run Instructions
1. Install dependencies: `npm install`
2. Validate content: `npm run content:validate`
3. Compile generated bundle: `npm run content:compile`
4. Run tests: `npm test`
5. Build production bundle: `npm run build`
6. Start local dev server: `npm run dev`

## Itch.io Publish
1. Run `npm run content:compile`.
2. Run `npm run build`.
3. In PowerShell, change to `dist/` and run `tar -a -c -f ..\error-hammer-itch.zip *`.
4. Upload `error-hammer-itch.zip` to itch.io.
5. Do not zip the repo root, `node_modules/`, or source files; the upload archive must contain only the built `dist/` contents.

## Usage
1. Start at the title screen and choose `New Game` or `Continue` (single-slot `localStorage` save).
2. After load, the app opens a compact bottom-tab shell with `Work`, `Contracts`, `Store`, and `Company`.
3. `Work` keeps the active job, current task, and primary task actions above the fold on mobile; `Job Details`, `Inventory`, `Field Log`, and supplier cart details open in overlays.
4. `Contracts` uses a horizontal selection carousel and returns you to `Work` after a successful accept.
5. `Store` uses segmented compact sections for `Fuel`, `Tools`, and `Stock` and blocks shop actions when the player is away from the shop.
6. `Company` shows compact overview cards with modal detail views for district access, crews, and competitor news.

## Testing
1. Deterministic scenario suite `EH-TW-001..EH-TW-021` remains in `tests/tw_scenarios.test.ts`.
2. Packaging assertion `EH-TW-022` remains in `tests/vite_config.test.ts`.
3. Compact-shell interaction scenarios `EH-TW-023..EH-TW-034` are implemented in `tests/ui_shell.test.tsx`.
4. Supporting suites are `tests/resolver.test.ts`, `tests/economy.test.ts`, `tests/content_validation.test.ts`, and `tests/bots.test.ts`.
5. Required verification commands are `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
6. Latest verifier run date is 2026-03-01 with evidence in `obsidian_vault/Testing.md`.

## Workflow
1. Lane order remains `Planner -> Builder -> TestWriter -> Verifier -> Documenter`.
2. Handoff source of truth is `obsidian_vault/Tasks.md` under `Active Lane Board (Kanban)`.
3. WIP limit remains one `IN_PROGRESS` card per lane.
4. Commit messages keep one lane tag prefix: `[Planner]`, `[Builder]`, `[TestWriter]`, `[Verifier]`, or `[Documenter]`.
