# Testing
## Scope
1. Runtime target is the Error Hammer web app across `src/main.tsx`, `src/ui/**`, and `src/core/**`.
2. Canonical command checklist is:
   1. `npm run content:validate`
   2. `npm run content:compile`
   3. `npm test`
   4. `npm run build`
3. Current automated baseline is `8` test files and `62` tests.

## Current Deterministic Contract
1. `tests/tw_scenarios.test.ts`
Coverage: `EH-TW-001..EH-TW-049`
Focus: resolver behavior, quick-buy flows, crew gating, assignee stamina/lock behavior, and save-safe defaults.
2. `tests/ui_shell.test.tsx`
Coverage: `EH-TW-023..EH-TW-034`, `EH-TW-043`, `EH-TW-047..EH-TW-056`
Focus: compact-shell routing, overlays, supplier cart flow, event/assignee cues, collapsed work panels, overtime-only action visibility, and persistent progression popups.
3. `tests/progression.test.ts`
Coverage: `EH-TW-057..EH-TW-061`
Focus: level thresholds, progress math, Operator Level averaging, popup ordering, and readable skill labels.
4. Supporting suites remain `tests/resolver.test.ts`, `tests/economy.test.ts`, `tests/content_validation.test.ts`, `tests/bots.test.ts`, and `tests/vite_config.test.ts`.

## Latest Verified Evidence
1. `VF-008` PASS
Evidence: final rolling-session UI contract is verified for collapsible work panels, inline supplier-cart guidance, and overtime-only visible actions.
2. `VF-009` PASS
Evidence: progression visibility is verified for visible levels, Operator Level, expanded readable labels, and manual-dismiss popup queue behavior.
3. No validated defect was found in the latest `VF-008` or `VF-009` closeouts.

## Manual Smoke Baseline
1. Start a new game, confirm trimmed player/company name gating, and verify compact-shell launch.
2. Accept a contract, check `Work`, expand/collapse the workday and active-job panels, and verify state is preserved.
3. Trigger a supplier-state path and confirm inline supplier-cart checkout guidance plus supplier overlay behavior.
4. Force a near-end-of-day work step and confirm only `+ OT` action buttons remain when regular actions no longer fit.
5. Trigger an XP-granting task and confirm popup order plus manual dismissal behavior.

## Archive
1. Detailed scenario map and historical contract text is archived in [Testing-Scenario-Map-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Testing-Scenario-Map-2026-03-01.md).
2. Historical evidence logs remain available in git history and prior archive notes.
