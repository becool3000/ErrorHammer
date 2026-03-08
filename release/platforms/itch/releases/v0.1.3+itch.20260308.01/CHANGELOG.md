# Itch Release v0.1.3+itch.20260308.01

## Added
- Added end-to-end Tutorial onboarding with launchers in Title and Settings, plus skip/resume/replay support.
- Added a guided Baba G tutorial segment after the safe Day Labor walkthrough.
- Added persistent competitor career runtime state (`botCareers`) to keep full bot progression data across days.

## Changed
- Refactored competitor bots to run on player-equivalent rules (offers, quick buy, acceptance, task actions, recovery, facilities, research, perks, and rollover effects).
- Changed competitor contract selection to deterministic one-contract-per-day behavior with Day Labor fallback when no viable trade contract can be accepted.
- Updated save compatibility policy to require the new v7 save format for this release.

## Fixed
- Fixed competitor simulation divergence between background paths by routing day simulation through one parity engine.
- Fixed snapshot drift by syncing `state.bots` actor snapshots from the underlying `state.botCareers` data each day.
- Fixed load behavior for outdated saves by rejecting v6 data under the new format gate.

## Balance
- Removed competitor compensation-style shortcuts so bot progression now follows the same pace constraints as player systems.
- Ensured competitors use the same unlock gates and progression order, including facilities and tool-access constraints.

## Content
- Expanded onboarding coverage and contract flow messaging for the early-game Day Labor -> Baba G learning path.
- Updated release notes and release manifest metadata for the new Itch package cycle.

## UX/Mobile
- Kept mobile shell tutorial flows and progression UI behavior stable while adding the new onboarding path.
- Preserved compact HUD interactions and coach-card behavior during tutorial start/resume from both Title and Settings.

## Technical
- Added deterministic parity-engine tests for competitor day simulation, fallback behavior, active-job carryover, and progression policies.
- Added save/version verification coverage for v6 rejection and v7 load/save behavior.
- Verified build and test pipeline for the new release candidate (`npm test`, `npm run build`).

## Known Issues
- Full test suite runtime is long on slower machines due heavy pacing and UI verification scenarios.
- Existing legacy saves from prior schema versions must start a new run under this release.
