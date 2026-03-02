# Tasks
## Current Focus
1. No lane card is currently `IN_PROGRESS`.
2. Planner chain `PLN-010` defines supplier quality tiers and explicit supplier checkout selection on `main`.
3. `BLD-010` is the next pull.
4. The live board below should stay small: only active or immediately ready handoffs belong here.

## Active Lane Board (Kanban)
Snapshot date: 2026-03-02.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Add cards here only when they are active or next-up work.

### Lane Cards
1. `BLD-010`
Lane: `Builder`
Status: `READY`
Priority: `P0`
Depends On: `PLN-010`
Exit Evidence: supplier quality tiers are implemented in content/runtime/UI, checkout requires explicit quality selection, material quality is calculated from reserved parts, and Builder provides a deterministic testing handoff.
2. `TW-010`
Lane: `TestWriter`
Status: `BLOCKED`
Priority: `P0`
Depends On: `BLD-010`
Exit Evidence: deterministic scenarios cover tiered pricing, explicit checkout selection, inventory propagation by tier, part-quality aggregation, and completed-job quality effects.
3. `VF-010`
Lane: `Verifier`
Status: `BLOCKED`
Priority: `P0`
Depends On: `TW-010`
Exit Evidence: command checklist passes and verified evidence confirms supplier quality tiers behave deterministically without regressions in supplier flow or job settlement.
4. `DOC-010`
Lane: `Documenter`
Status: `BLOCKED`
Priority: `P1`
Depends On: `VF-010`
Exit Evidence: `README.md` and vault summaries reflect supplier quality selection, tier pricing, and verified material-quality behavior.

## Next Pull
1. Builder: implement `BLD-010` for supplier quality tiers, explicit checkout selection, and deterministic material-quality effects.

## Planner Chain `PLN-010`
### Goals
1. Add explicit supplier part quality choices so the player decides what grade of material to buy instead of only quantity.
2. Price every supply by `low`, `medium`, and `high` quality tiers in content.
3. Carry selected material quality through checkout, truck/site inventory, material reservation, and completed-job settlement.
4. Make material quality affect final completed-job quality without replacing task execution quality as the primary driver.

### Constraints
1. Preserve deterministic seeded behavior and keep all gameplay-state mutations in `src/core/**`.
2. Preserve the compact-shell supplier workflow and avoid introducing long-form store pages or non-deterministic UI state.
3. Keep content JSON-driven, schema-validated, and compiled into the tracked generated bundle.
4. Keep the live lane board small and scoped to the `PLN-010 -> BLD-010 -> TW-010 -> VF-010 -> DOC-010` chain.

### Risks
1. Inventory shape changes can ripple into save/load, scenario helpers, UI summaries, and material reservation code.
2. Tier pricing and part-quality modifiers can destabilize economy and job outcomes if not bounded tightly.
3. Supplier checkout can become noisy on mobile if the tier-selection UI is not constrained to required materials first.
4. Regression risk is highest around `checkout_supplies`, truck/site transfer, `do_work` material reservation, and `collect_payment`.

### Deliverables
1. Content/schema update for supply quality tiers with explicit per-tier pricing.
2. Runtime inventory/cart update that tracks material quantities by supply id and quality tier.
3. Supplier checkout UI flow that requires explicit quality selection for required parts before checkout can advance.
4. Deterministic material-quality calculation stored on the active job and applied during completed-job settlement.
5. Builder handoff, TestWriter scope, and verification targets aligned to the new data contract.

### Builder Handoff (`BLD-010`)
1. Update supply content and schema so each supply exposes three price entries: `low`, `medium`, and `high`. `medium` should replace the current baseline meaning; no runtime price derivation from a single `price` field should remain after migration.
2. Introduce a shared `SupplyQuality` type with exactly `low | medium | high` and replace flat quantity-only supplier/truck/site material state with a structure that can preserve quantities per quality tier through checkout, transport, reservation, and leftovers.
3. Replace quantity-only supplier-cart selection with explicit per-tier selection for required materials. `checkout_supplies` must stay blocked until each required supply quantity is fully allocated across chosen quality tiers.
4. Calculate a deterministic reserved-parts quality result from the actual materials consumed by the job using the following scoring contract: `low = 0`, `medium = 1`, `high = 2`, weighted average across reserved material units, displayed parts-quality label of `< 0.75 = low`, `< 1.5 = medium`, `>= 1.5 = high`, and a bounded completed-job modifier applied once during settlement of `low = -2 quality points`, `medium = 0`, `high = +2`.
5. Surface the selected and resulting material quality in the supplier/work UI where the player makes the decision and where the job outcome is reviewed. Keep the compact-shell model intact.
6. Preserve backward-compatible normalization where possible for saves created before tiered materials existed. If a legacy value cannot preserve exact quality, normalize it to `medium` rather than blocking load.
7. Do not broaden the feature into durability, warranty, random defects, or supplier reputation in this chain. Those would require a new Planner pass.

## Recent Closeouts
1. `PLN-008 -> BLD-008 -> TW-008 -> VF-008 -> DOC-008`
Result: rolling UI/UX session is closed with verified collapsible work panels, inline supplier-cart guidance, and overtime-only action visibility.
2. `PLN-009 -> BLD-009 -> TW-009 -> VF-009 -> DOC-009`
Result: visible skill levels, Operator Level, readable expanded skill labels, and manual-dismiss progression popups are verified and documented.
3. `PLN-007 -> BLD-007 -> TW-007 -> VF-007 -> DOC-007`
Result: deterministic crew hiring, active-job assignee support, and work-tab event cues are verified and documented.

## Archive
1. Closed lane-board history is archived in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Earlier task-history notes remain under [archive](/g:/ErrorHammer/obsidian_vault/archive).
