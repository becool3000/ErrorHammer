# Vision
## Product Direction
1. Ship Error Hammer as a mobile-first construction ops sim with deterministic outcomes and readable tactical choices.
2. Keep the field loop fast and consistent: accept work, run tasks, settle, return/store, end day.
3. Expand management depth through Office systems without destabilizing core field gameplay.
4. Preserve dark visual identity while keeping action-critical UI readable on small devices.

## Current Verified Baseline (`main`, 2026-03-06)
1. Trade baseline remains expanded: 50 supported trade skills, 188 trade jobs, 10 bots, and compact rotating mobile contracts.
2. Business progression is storage-first: `truck -> storage -> office -> yard` with cash-only facility unlocks.
3. Economy remains monthly-lump (22-shift cycle) with unpaid carry, late fees, strike tracking, and tiered collapse behavior.
4. Core Perks remain deterministic modifiers layered on trade-skill rolls.
5. ReleaseOps baseline remains implemented with build IDs, changelog gates, platform manifests, and runtime build metadata surfaces.
6. Planner reset governance remains active, and storage-first Company flow chain `PLN-024` is now the active implementation focus.

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
1. Live board contains active replacement chains (`PLN-020`, `PLN-022`, `PLN-023`) plus supersession references for replaced chain cards.
2. Legacy `DONE` and parked unfinished cards are moved to a dated archive ledger.
3. Every superseded legacy card has one explicit `legacy -> replacement` mapping row.
4. `Vision.md`, `Decisions.md`, and `Tasks.md` consistently reference active chain IDs `PLN-019`, `PLN-020`, `PLN-022`, `PLN-023`, and `PLN-024`.

## Planner Chain `PLN-024` (Storage-First Company Flow)
### Goal
1. Shift facilities to cash-only progression with explicit `Truck -> Storage -> Office -> Yard` unlock order.
2. Gate pre-storage play behind a strict 6-tool starter kit and truck-limited inventory model.
3. Keep Company hub routing compatibility while making `R&D` render Company-only content.

### Constraints
1. Preserve deterministic gameplay outcomes and internal compatibility ids (`office`, `shop`, `load_from_shop`).
2. Keep facility research engine code available for future use, but remove facility-program UX from active Company flow.
3. Enforce lane handoffs through `Tasks.md` Kanban cards with explicit supersession mapping from `023` to `024`.

### Acceptance Criteria
1. Storage unlock exists at `$250`; office unlock is `$1800` and requires storage ownership.
2. Starter kit (`work boots`, `tool belt`, `hammer`, `level`, `square`, `skill saw`) is required before `Open Storage`.
3. Truck/storage caps (`8`/`40`) are enforced with deterministic overflow behavior.
4. Company UI surfaces show Storage-first facilities flow and `R&D` renders Company-only content.

## Next Focus
1. Complete `BLD-024` + `TW-024` + `VF-024` + `DOC-024` for storage-first Company flow closeout.
2. Keep `BLD-022` as next Builder pull after 024 chain verification closeout unless Planner explicitly reorders.
3. Keep ReleaseOps continuation (`020` chain) queued and documented under current lane dependencies.
4. Continue archiving closed/superseded history outside the live board to maintain clean lane execution.

## Archive
1. Closed-chain and verbose board history remains in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. `PLN-019` clean-slate reset archive is tracked in [Tasks-Lane-Board-Reset-2026-03-06.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-Reset-2026-03-06.md).
3. Historical migration context remains in [Migration-Legacy-2026-02-27.md](/g:/ErrorHammer/obsidian_vault/archive/Migration-Legacy-2026-02-27.md).
