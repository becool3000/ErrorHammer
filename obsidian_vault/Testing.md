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
10. Name + Hour verification chain status is complete for `TW-006` and `VF-006` (2026-03-01); deterministic coverage for title prompts and quick-buy tooling is tracked through `EH-TW-039..EH-TW-043`.
11. Crew + event TestWriter coverage for `TW-007` is complete; deterministic coverage now extends through `EH-TW-061` for crew hire gating, assignee spend/lock behavior, save-safe assignee defaults, crew-modal hire flow, collapsible work-shell panels, supplier-cart guidance, overtime-only action visibility, visible progression math, expanded skill labels, and persistent progress-popups in the compact shell.
12. Progression + persistent-popup verification chain status is complete for `TW-009` and `VF-009` (2026-03-01).
13. Rolling UI/UX session closeout coverage for `TW-008` is complete; the compact-shell UI contract now explicitly includes the final `BLD-008` collapse, supplier-cart, and overtime-only action behaviors.

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
4. New scenarios `EH-TW-039..EH-TW-061` expand the deterministic contract to cover quick-buy discovery, title-name persistence, crew hire gating, assignee spend/lock behavior, save-safe assignee defaults, crew-modal hire flow, collapsible work-shell behavior, supplier-cart guidance, overtime-only action visibility, visible progression math, expanded skill-label rendering, and event cue plus progress-popup visibility in the compact shell.

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
13. `EH-TW-039`
Sequence: Seed the compact shell with a contract that needs a missing tool, visit `Contracts`, and quick-buy the tool.
Pass criteria: the Quick Tool Buy card lists the missing tool, the `Quick Buy Tools` button is visible and enabled, the quick-buy notice appears after purchase, and the Accept button becomes actionable without opening a new board.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-039`.
14. `EH-TW-040`
Sequence: Use `quickBuyMissingTools` with a player/company name pair and a contract that requests a tool not in the kit.
Pass criteria: the returned payload acknowledges the missing tool list, the resulting GameState keeps the provided name/company values, and the log contains the company string.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-040`.
15. `EH-TW-041`
Sequence: Quick buy a missing tool with sufficient cash/time.
Pass criteria: cash decreases by the computed cost, ticks spent increases by two per tool, and the contract board remains locked.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-041`.
16. `EH-TW-042`
Sequence: Attempt the same quick buy with insufficient cash and insufficient hours.
Pass criteria: the action returns a notice about cash or hours and leaves the GameState untouched.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-042`.
17. `EH-TW-043`
Sequence: Enter the title screen, type both player and company names, start a new game, then return to the title screen.
Pass criteria: the UI store captures each trimmed value (title inputs stay non-empty) and the title inputs re-render with those names when control returns to the title screen, keeping `New Game` disabled until both fields are non-empty.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-043`.
18. `EH-TW-044`
Sequence: Call `hireCrew` below level 2, then raise `companyLevel` to `2` and call it again.
Pass criteria: the first call returns a level-gating notice and leaves state untouched; the second call creates `crew-1` (`June`) in the first open slot and appends a roster log entry.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-044`.
19. `EH-TW-045`
Sequence: Hire `crew-1`, assign the active job to that crew, and execute the first `do_work` task step.
Pass criteria: crew stamina drops by the job stamina cost once, `activeJob.staminaCommitted` becomes `true`, and task log lines are prefixed with the crew name.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-045`.
20. `EH-TW-046`
Sequence: Persist a v4 save that lacks `activeJob.assignee` and `activeJob.staminaCommitted`, then load it through the save helpers.
Pass criteria: load succeeds, `assignee` defaults to `"self"`, and `staminaCommitted` defaults to `false`.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-046`.
21. `EH-TW-047`
Sequence: Open the company crew modal in a level-2 shell state and press `Hire Crew`.
Pass criteria: the modal shows the new roster entry for `June`, the hire notice renders, and the store state remains inside the same shell session.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-047`.
22. `EH-TW-048`
Sequence: Seed an accepted-job shell state with an active event and one hired crew, then inspect the `Work` tab and switch the assignee.
Pass criteria: the `Work` tab renders the event headline plus impact line, and selecting the crew updates `activeJob.assignee` to that `crewId`.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-048`.
23. `EH-TW-049`
Sequence: Assign a job to `crew-1`, execute two `do_work` steps, and then attempt to switch the assignee back to `self`.
Pass criteria: crew stamina is charged only on the first work commit, the second work step preserves the same stamina, and reassignment returns a lock notice while keeping the crew assignee.
Evidence: `tests/tw_scenarios.test.ts` test id `EH-TW-049`.
24. `EH-TW-050`
Sequence: Accept a contract, inspect the `Work` tab card order, then toggle the active-job summary row open and closed.
Pass criteria: `Current Task` renders before `Active Job`, the task carousel shows explicit left/right controls, and the active-job detail panel flips `aria-expanded` plus hidden/open state without mutating gameplay state.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-050`.
25. `EH-TW-051`
Sequence: Render `Work` with no active job and toggle the workday header summary row.
Pass criteria: the workday status panel starts collapsed, opens on click with `aria-expanded=true`, surfaces the day stat chips, and closes again without changing game state.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-051`.
26. `EH-TW-052`
Sequence: Force an accepted job into the supplier checkout step with an empty supplier cart, then attempt a standard checkout action.
Pass criteria: the blocking copy renders once inside `Current Task`, uses the supplier-cart wording, and does not duplicate as a second detached banner.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-052`.
27. `EH-TW-053`
Sequence: Force an accepted job into a near-end-of-day job-site step where visible actions require overtime.
Pass criteria: regular stance buttons are hidden, only `+ OT` stance buttons remain for actions that still fit, and no non-overtime duplicate buttons render for those same stances.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-053`.
28. `EH-TW-054`
Sequence: Open the `Work` operator card modals from a fresh shell state.
Pass criteria: `Inventory` opens stock-only content, `Skills` opens the progression ledger, and the ledger renders explicit level rows plus readable labels including `AI Tools`, `HVAC`, and `CAD`.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-054`.
29. `EH-TW-055`
Sequence: Force an XP-granting `do_work` step from the shell with near-threshold skills.
Pass criteria: the shell surfaces an `XP Earned` popup first, the UI store records queued follow-on popups, and dismissing the first popup reveals a later `Skill Leveled Up` popup.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-055`.
30. `EH-TW-056`
Sequence: Trigger a progression popup, advance fake time, then inspect the shell before manual dismissal.
Pass criteria: the active popup remains visible after simulated elapsed time and only advances when the player dismisses it explicitly.
Evidence: `tests/ui_shell.test.tsx` test id `EH-TW-056`.
31. `EH-TW-057`
Sequence: Evaluate tier thresholds in the progression helpers with fixed XP values.
Pass criteria: `0 -> Lv 0`, `99 -> Lv 0`, `100 -> Lv 1`, `249 -> Lv 1`, `250 -> Lv 2`, and `450 -> Lv 3`.
Evidence: `tests/progression.test.ts` test id `EH-TW-057`.
32. `EH-TW-058`
Sequence: Evaluate level-progress math inside a mid-tier XP bucket.
Pass criteria: `175 XP` reports `Lv 1`, `current = 75`, and `needed = 150`.
Evidence: `tests/progression.test.ts` test id `EH-TW-058`.
33. `EH-TW-059`
Sequence: Seed uneven raw XP across a broad skill set and derive Operator Level.
Pass criteria: Operator Level uses average raw XP across all tracked skills, not the highest skill, and therefore lands below the strongest specialization.
Evidence: `tests/progression.test.ts` test id `EH-TW-059`.
34. `EH-TW-060`
Sequence: Build progression popups from a fixed previous/next state pair with two leveled skills.
Pass criteria: popup helper emits kinds in deterministic order `xp -> skill-level -> skill-level -> operator-level`.
Evidence: `tests/progression.test.ts` test id `EH-TW-060`.
35. `EH-TW-061`
Sequence: Format acronym-heavy and multiword skill ids through the shared skill-label helper.
Pass criteria: labels render as `AI Tools`, `HVAC`, `CAD`, and `Sheet Metal` rather than raw snake_case ids.
Evidence: `tests/progression.test.ts` test id `EH-TW-061`.

## Automated Execution Steps (`TW-002` through `TW-005`)
1. Run `npm test`.
2. Run `npm run content:validate`.
3. Run `npm run content:compile`.

## Manual Smoke Steps (current verifier baseline)
1. Start app with `npm run dev` and open the local URL.
2. At the title screen, enter both Player and Company names, ensure `New Game` enables, and confirm the shell header/log reflect the written names plus hour metrics.
3. Accept a contract that needs a missing tool, use the Quick Tool Buy card, and verify the notice reports the purchased tools, hours drop by 0.5 increments per tool, and the board remains hidden while Accept becomes available.
4. After a contract acceptance, confirm `Work` displays the current task block and shows time in hours (not ticks) on the hero and assignment panels.
5. Visit `Store` and `Company` via bottom tabs to confirm store locks when off-site and the company tab keeps only a hero ledger plus modal-trigger buttons for districts, crews, and news.
6. Trigger a supplier-state path and confirm the supplier sheet opens.
7. Refresh and use `Continue` to verify the save/load path.
8. Return to the title screen (via the UI store or by reloading), verify both name inputs keep the last trimmed values, and confirm `New Game` remains disabled until both fields are non-empty so the fields gate the compact shell launch.
9. Reach company level 2, open `Crew Status`, hire the first crew, assign that crew to an accepted job from `Work`, and confirm the `Work` hero keeps the event cue copy visible while the crew stamina line drops on first work commit only.
10. Toggle the collapsed `Work` summary row and the collapsed `Active Job` summary row, and confirm each panel opens and closes without changing the underlying game state.
11. Trigger a supplier-state path, confirm `Supplier Cart` opens from `Current Task`, and verify the blocking supplier-cart guidance appears inline only when checkout is attempted without the needed items.
12. Force a low-hours job-site state near shift end and confirm only visible `+ OT` actions remain for stances that still fit.
13. Trigger an XP-granting task from `Work`, confirm the progress popup stays on screen without auto-closing, and verify the next queued popup appears only after pressing `Close`.

## Evidence Log
1. `VF-005` evidence date: 2026-03-01.
2. `VF-005` command evidence: `npm run content:validate` PASS (`tools=10 jobs=30 events=12 districts=3 bots=2 supplies=13`), `npm run content:compile` PASS (bundle emitted at `src/generated/content.bundle.json`), `npm test` PASS (`7` files, `44` tests), `npm run build` PASS (Vite build completed with `dist/index.html`, `dist/assets/index-De6LOkjX.css`, `dist/assets/index-CBn5CYlm.js`).
3. `VF-005` compact-shell evidence: title start path PASS, continue path PASS, work-to-contracts CTA PASS, contract accept-to-work PASS, store segmentation PASS, off-shop lock-state PASS, company modal PASS, supplier sheet PASS.
4. `EH-TW-043` evidence: automated UI shell scenario verifies title inputs retain typed names between returns to the title screen, new-game gating honors trimmed input presence, and the compact shell header/log shows the stored names (`tests/ui_shell.test.tsx`).
5. `DOC-005` evidence date: 2026-03-01.
6. `DOC-005` documentation evidence: `README.md`, `obsidian_vault/Vision.md`, `obsidian_vault/Decisions.md`, `obsidian_vault/Tasks.md`, and `obsidian_vault/Testing.md` synced to verified compact-shell behavior and board state.
7. `VF-006` evidence date: 2026-03-01; command gates stayed PASS, quick-buy/title-name/company-modal smoke steps passed, and the closeout evidence remained deterministic.
8. `DOC-006` evidence date: 2026-03-01.
9. `DOC-006` documentation evidence: `README.md`, `obsidian_vault/Vision.md`, `obsidian_vault/Decisions.md`, `obsidian_vault/Tasks.md`, and `obsidian_vault/Testing.md` synced to the verified Name + Hour flow and archived in `obsidian_vault/archive/DOC-006-Closeout-2026-03-01.md`.
10. `VF-007` evidence date: 2026-03-01.
11. `VF-007` command evidence: `npm run content:validate` PASS (`tools=10 jobs=30 events=12 districts=3 bots=2 supplies=13`), `npm run content:compile` PASS (bundle emitted at `src/generated/content.bundle.json`), `npm test` PASS (`7` files, `50` tests), `npm run build` PASS (Vite build completed with `dist/index.html`, `dist/assets/index-De6LOkjX.css`, `dist/assets/index-Du6nEY1t.js`).
12. `VF-007` deterministic scenario evidence: `EH-TW-044` PASS for level gating plus deterministic first-slot hire, `EH-TW-045` PASS for first-commit crew stamina spend and assignee-prefixed logs, `EH-TW-046` PASS for save-safe `assignee="self"` and `staminaCommitted=false` defaults, `EH-TW-047` PASS for company-modal hire flow, `EH-TW-048` PASS for work-tab event cue visibility plus assignee selection, and `EH-TW-049` PASS for assignee lockout with no double stamina spend.
13. `VF-007` smoke note: verification relied on deterministic unit/UI-shell coverage and command-gate passes in this terminal session; no validated defect required a follow-on core or script patch.
14. `VF-009` evidence date: 2026-03-01.
15. `VF-009` command evidence: `npm run content:validate` PASS (`tools=10 jobs=30 events=12 districts=3 bots=2 supplies=13`), `npm run content:compile` PASS (bundle emitted at `src/generated/content.bundle.json`), `npm test` PASS (`8` files, `62` tests), `npm run build` PASS (Vite build completed with `dist/index.html`, `dist/assets/index-DjJcFGTe.css`, `dist/assets/index-CIVj3gH1.js`).
16. `VF-009` deterministic scenario evidence: `EH-TW-054` PASS for operator-card inventory/skills modal separation plus readable skill labels, `EH-TW-055` PASS for ordered progression popup queueing after XP gain, `EH-TW-056` PASS for manual-dismiss popup persistence, `EH-TW-057` PASS for tiered XP threshold boundaries, `EH-TW-058` PASS for mid-tier progress math, `EH-TW-059` PASS for average-XP Operator Level derivation across the expanded skill pool, `EH-TW-060` PASS for popup helper ordering `xp -> skill-level -> skill-level -> operator-level`, and `EH-TW-061` PASS for acronym-heavy labels including `AI Tools`, `HVAC`, `CAD`, and `Sheet Metal`.
17. `VF-009` manual smoke evidence: user-confirmed manual verification covered progression popup persistence and explicit manual dismissal behavior in the shell.
18. `VF-009` bug-fix note: no validated defect was found during verification, so no patch was applied to `src/core/**` or `scripts/**`.
19. `DOC-009` evidence date: 2026-03-01.
20. `DOC-009` documentation evidence: `README.md`, `obsidian_vault/Vision.md`, `obsidian_vault/Decisions.md`, and `obsidian_vault/Tasks.md` synced to the verified progression system, expanded skill set, manual-dismiss popup behavior, and current lane-board state.
