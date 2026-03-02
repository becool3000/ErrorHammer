# Error Hammer
## Status (2026-03-01)
1. Mobile compact shell chain `PLN-005 -> BLD-005 -> TW-005 -> VF-005 -> DOC-005` is complete on `main`.
2. Verified command gate snapshot (2026-03-01): `npm run content:validate`, `npm run content:compile`, `npm test` (`8` files, `62` tests), and `npm run build`.
3. Name + Hour flow chain `PLN-006 -> BLD-006 -> TW-006 -> VF-006 -> DOC-006` is complete on `main`.
4. Crew + event depth chain `PLN-007 -> BLD-007 -> TW-007 -> VF-007 -> DOC-007` is complete on `main`.
5. `PLN-008` keeps the rolling UI/UX Builder session open on `main`; `PLN-009` is queued separately for visible skill levels, Operator Level, and progression popups.
6. Deterministic replay, mobile-shell UI evidence, and crew/event verification evidence are recorded in `obsidian_vault/Testing.md`.

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
1. Start at the title screen, fill both Player and Company name fields, and only then can `New Game` begin; the chosen names persist into the compact shell header, log, and quick-buy notices.
2. After load, the app opens a compact bottom-tab shell with `Work`, `Contracts`, `Store`, and `Company`.
3. `Work` keeps the active job, current task, assignee selection, active-event cues, operator summary, and primary task actions above the fold on mobile; `Job Details`, `Inventory`, `Skills`, `Field Log`, and supplier cart details open in overlays.
4. Time is reported in half-hour units, the header and work cards call them “Hours,” and quick buys charge one hour (two ticks) per tool before any contract acceptance.
5. `Contracts` shows a horizontal carousel, highlights missing tools, disables `Accept Job` until stocked, and offers a quick-buy step that summarizes hours plus cash before redirecting back to `Work`.
6. `Company` keeps a hero ledger plus buttons for `District Access`, `Crew Status`, and `Competitor News`; the crew modal now shows a three-slot roster, level gating, and deterministic `Hire Crew` behavior once company level reaches 2.
7. The `Skills` modal now shows each tracked skill with `Lv`, raw XP, and progress-to-next-level, while the operator card shows derived `Operator Lv` from average raw XP across the full skill pool.
8. Progression popups appear in deterministic `XP Earned -> Skill Leveled Up -> Operator Leveled Up!` order and stay visible until the player closes them.

## Testing
1. Deterministic scenario suite `EH-TW-001..EH-TW-049` remains in `tests/tw_scenarios.test.ts`, with `EH-TW-044..EH-TW-049` covering crew hire gating, assignee stamina/lock behavior, and save-safe assignee defaults.
2. Packaging assertion `EH-TW-022` remains in `tests/vite_config.test.ts`.
3. Compact-shell interaction scenarios `EH-TW-023..EH-TW-034` plus `EH-TW-043`, `EH-TW-047..EH-TW-056` are implemented in `tests/ui_shell.test.tsx` for title persistence, crew-modal hiring, event/assignee cues, collapsible work panels, supplier-cart guidance, overtime-only actions, visible skill labels, and persistent progression popups.
4. Progression helper coverage `EH-TW-057..EH-TW-061` is in `tests/progression.test.ts` for threshold math, Operator Level averaging, popup ordering, and acronym-heavy skill labels.
5. Supporting suites are `tests/resolver.test.ts`, `tests/economy.test.ts`, `tests/content_validation.test.ts`, and `tests/bots.test.ts`.
6. Required verification commands are `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
7. Current automated baseline is `8` test files and `62` tests after the latest progression and popup persistence additions.
8. Latest verifier closeout is `VF-009` on 2026-03-01 with evidence in `obsidian_vault/Testing.md`; that closeout locks the visible skill-level system, expanded skill labels, and manual-dismiss popup behavior.

## Workflow
1. Lane order remains `Planner -> Builder -> TestWriter -> Verifier -> Documenter`.
2. Handoff source of truth is `obsidian_vault/Tasks.md` under `Active Lane Board (Kanban)`.
3. WIP limit remains one `IN_PROGRESS` card per lane.
4. `PLN-008` opens a rolling Builder session for iterative UI/UX work: `BLD-008` stays active until the user explicitly ends it, and only then does the lane flow resume with `TW-008 -> VF-008 -> DOC-008`.
5. `PLN-009 -> BLD-009 -> TW-009 -> VF-009 -> DOC-009` is complete on `main`; it added visible skill levels, Operator Level, expanded skill labels, and persistent manual-dismiss progression popups.
6. Commit messages keep one lane tag prefix: `[Planner]`, `[Builder]`, `[TestWriter]`, `[Verifier]`, or `[Documenter]`.
