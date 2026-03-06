# Itch Release v0.1.2+itch.20260306.01

## Added
- Added Baba-driven trade progression loop: Day Labor + Baba are always visible, and Baba completions unlock core trade tracks.
- Added random Rebar Bob encounter system with in-game popup, task-log line injection, and deterministic once-per-day encounter gating.
- Added full-screen Rebar Bob encounter sprite staging (`rebarbob2026.png`) with transparent background support.
- Added Contract Files section in Accounting with per-contract snapshots (bid, estimated vs actual hours, estimated vs actual net, outcome/state).

## Changed
- Changed Contracts flow to hide locked trade offers and only show unlocked core-track groups.
- Changed Work card structure to streamlined controls (`Current Job`, `Budget`, collapsible `Cut Losses`) and cleaner action-first order.
- Changed Office top section navigation to hamburger-driven segmented menu for tighter mobile layout.
- Changed release metadata for this build to `v0.1.2+itch.20260306.01` and aligned artifact naming to release label.

## Fixed
- Fixed Task Result and encounter popup behavior to remain manually dismissible until closed.
- Fixed UI stability regressions in contract acceptance and fallback selection paths covered by updated deterministic UI tests.
- Fixed stale deterministic scenario expectations in TW/UI suites so assertions match current shipped behavior.

## Balance
- Rebalanced core contract economics around active core tracks with Baba floor behavior preserved.
- Added deterministic non-Baba payout uplift/bonus paths tied to performance (time + quality), improving profit readability and growth pacing.
- Updated progression pacing test baselines to current Baba-gated unlock model while preserving deterministic guards.

## Content
- Expanded/maintained Baba pool coverage to support unlocking the active core trade tracks via Baba jobs.
- Retained legacy catalog data for compatibility but activated core-track filtering for the live loop.

## UX/Mobile
- Improved encounter presentation with full-screen menacing stage and compact glass-card text bubble.
- Improved current task readability with clearer labels, reduced clutter, and mobile-safe control density.
- Maintained persistent bottom-nav actions and compact Office navigation for one-hand play.

## Technical
- Added/updated deterministic coverage for encounters, progression, payout/contract files, UI shell flow, and pacing estimation.
- Updated generated release/runtime metadata paths and manifest/index records for this new itch build.
- Verified this release against full vitest suite before packaging.

## Known Issues
- Pacing estimation suite remains computationally heavy and can be slow in local CI runs.
- No new critical gameplay blockers identified in this release validation pass.
