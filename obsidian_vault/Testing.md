# Testing
## Scope
1. Runtime target is the Error Hammer web app (`src/main.tsx` + `src/ui/**` + `src/core/**`).
2. Canonical automated suite is `npm test` (Vitest).
3. Content quality gate is `npm run content:validate`.
4. Content bundle gate is `npm run content:compile`.
5. Determinism contract baseline is seeded resolver parity using fixed day seeds and identical intent sets.
6. Bootstrap verification chain status is complete for `TW-002` and `VF-002` (2026-02-27).
7. Bot-buy verification chain status is complete for `TW-003` and `VF-003` (2026-02-27).
8. Itch packaging verification chain status is complete for `TW-004` and `VF-004` (2026-02-28).
9. Compact-shell verification chain status is complete for `TW-005` and `VF-005` (2026-03-01).

## Required Verification Commands
1. `npm run content:validate`
2. `npm run content:compile`
3. `npm test`
4. `npm run build`
5. From `dist/`: `tar -a -c -f ..\error-hammer-itch.zip *`

## Deterministic Scenario Contract (`EH-TW-*`)
1. Scenario assertions are explicit and deterministic.
2. Assertions use day-resolution fields for resolver behavior and stable UI state transitions for compact-shell behavior.
3. UI-shell assertions verify active tab, visible compact controls, modal/sheet open state, and preserved gameplay state.

## Automated Scenario Definitions (`TW-005` additions)
1. `EH-TW-023`
Sequence: Render `App`, click `New Game`, and inspect the active shell state.
Pass criteria: compact shell opens on `Work` with Day 1 header visible and `Work` marked active in bottom navigation.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-023`.
2. `EH-TW-024`
Sequence: Seed a valid `localStorage` save, click `Continue`, and inspect the shell.
Pass criteria: save restores into the compact shell with `Work` active and the empty-work prompt visible when no job is active.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-024`.
3. `EH-TW-025`
Sequence: Render the shell with no active job and use the `Open Contract Board` CTA.
Pass criteria: the CTA switches the active tab to `Contracts` without mutating gameplay state.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-025`.
4. `EH-TW-026`
Sequence: Render `Contracts`, select an accept-ready contract state, and inspect the compact detail card.
Pass criteria: contract detail reflects the selected carousel card and exposes a valid acceptance action.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-026`.
5. `EH-TW-027`
Sequence: Accept a contract from `Contracts`.
Pass criteria: the shell returns to `Work` and the current-task block becomes visible.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-027`.
6. `EH-TW-028`
Sequence: Render an accepted supplier-state job and open the supplier sheet.
Pass criteria: the bottom sheet opens with supplier cart controls and does not replace the underlying gameplay state.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-034`.
7. `EH-TW-029`
Sequence: Open and close the field-log modal from `Work`.
Pass criteria: modal visibility toggles cleanly and the active tab remains `Work`.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-029`.
8. `EH-TW-030`
Sequence: Navigate to `Store` and switch segmented sections.
Pass criteria: segmented tabs switch between `Fuel`, `Tools`, and `Stock` content without clearing gameplay state.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-030`.
9. `EH-TW-031`
Sequence: Render `Store` while the accepted job location is away from the shop.
Pass criteria: the lock-state notice renders and buy buttons stay disabled.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-031`.
10. `EH-TW-032`
Sequence: Open a company detail modal from the compact overview.
Pass criteria: the expected modal renders from the overview card click target.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-032`.
11. `EH-TW-033`
Sequence: Change bottom-nav tabs after opening and closing a company detail modal.
Pass criteria: active tab changes without clearing the active `GameState` seed or shell state.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-033`.
12. `EH-TW-034`
Sequence: Render a supplier-state work view and open the supplier sheet from the sticky action bar.
Pass criteria: the contextual `Open Supplies` action is visible and opens the supplier dialog.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-034`.

## Automated Execution Steps (`TW-002` through `TW-005`)
1. Run `npm test`.
2. Run `npm run content:validate`.
3. Run `npm run content:compile`.

## Manual Smoke Steps (current verifier baseline)
1. Start app with `npm run dev` and open the local URL.
2. Start a new game and confirm the compact shell opens on `Work`.
3. Accept a contract from `Contracts` and confirm `Work` shows the current task block.
4. Visit `Store` and `Company` through bottom navigation and confirm segmented/detail navigation is stable.
5. Trigger a supplier-state path and confirm the supplier sheet opens.
6. Refresh and use `Continue` to verify the save/load path.

## Evidence Log
1. `VF-005` evidence date: 2026-03-01.
2. `VF-005` command evidence: `npm run content:validate` PASS (`tools=10 jobs=30 events=12 districts=3 bots=2 supplies=13`), `npm run content:compile` PASS (bundle emitted at `src/generated/content.bundle.json`), `npm test` PASS (`7` files, `39` tests), `npm run build` PASS (Vite build completed with `dist/index.html`, `dist/assets/index-naNfZNwA.css`, `dist/assets/index-DMSJvpJc.js`).
3. `VF-005` compact-shell evidence: title start path PASS, continue path PASS, work-to-contracts CTA PASS, contract accept-to-work PASS, store segmentation PASS, off-shop lock-state PASS, company modal PASS, supplier sheet PASS.
4. `DOC-005` evidence date: 2026-03-01.
5. `DOC-005` documentation evidence: `README.md`, `obsidian_vault/Vision.md`, `obsidian_vault/Decisions.md`, `obsidian_vault/Tasks.md`, and `obsidian_vault/Testing.md` synced to verified compact-shell behavior and board state.
