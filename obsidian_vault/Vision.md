# Vision
## Product Direction
1. Ship Error Hammer as a mobile-first construction ops sim with deterministic outcomes and readable tactical choices.
2. Keep the field loop fast and consistent: accept work, run tasks, settle, return/store, end day.
3. Expand management depth through Office systems without destabilizing core field gameplay.
4. Preserve dark visual identity while keeping action-critical UI readable on small devices.

## Current Verified Baseline (`main`, 2026-03-06)
1. Trade baseline remains expanded: 50 supported trade skills, 188 trade jobs, 10 bots, and compact rotating mobile contracts.
2. Business progression remains `truck -> office -> yard` with facility research + buy-in gates.
3. Economy remains monthly-lump (22-shift cycle) with unpaid carry, late fees, strike tracking, and tiered collapse behavior.
4. Core Perks remain deterministic modifiers layered on trade-skill rolls.
5. ReleaseOps baseline remains implemented with build IDs, changelog gates, platform manifests, and runtime build metadata surfaces.
6. Planner reset `PLN-019` is now active to restore lane discipline and clean board state before new feature execution.

## Planner Reset `PLN-019` (2026-03-06)
### Goal
1. Restore lane discipline and reduce board noise by keeping the live board active-only and moving closed or parked history to archive.

### Non-Goals
1. No runtime logic, balance, content, schema, or UI feature changes.
2. No new verification evidence generation in this Planner pass.

### Constraints
1. Preserve full task history through dated archive notes with explicit supersession mapping.
2. Enforce one `IN_PROGRESS` card maximum per lane in the live board.
3. Keep deterministic `Exit Evidence` requirements on every active handoff card.
4. Keep lane order strict: `Planner -> Builder -> TestWriter -> Verifier -> Documenter`.

### Acceptance Criteria
1. Live board contains only replacement chains `PLN-020`, `PLN-021`, and `PLN-022` plus active/next-up cards.
2. Legacy `DONE` and parked unfinished cards are moved to a dated archive ledger.
3. Every superseded legacy card has one explicit `legacy -> replacement` mapping row.
4. `Vision.md`, `Decisions.md`, and `Tasks.md` consistently reference chain IDs `PLN-019`, `PLN-020`, `PLN-021`, and `PLN-022`.

## Next Focus
1. Pull `BLD-020` first for ReleaseOps continuation.
2. Keep `BLD-021` queued as second priority after the 020 chain stabilizes.
3. Keep `BLD-022` queued as third priority unless Planner explicitly reorders.
4. Continue archiving closed history outside the live board to maintain clean lane execution.

## Archive
1. Closed-chain and verbose board history remains in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. `PLN-019` clean-slate reset archive is tracked in [Tasks-Lane-Board-Reset-2026-03-06.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-Reset-2026-03-06.md).
3. Historical migration context remains in [Migration-Legacy-2026-02-27.md](/g:/ErrorHammer/obsidian_vault/archive/Migration-Legacy-2026-02-27.md).
