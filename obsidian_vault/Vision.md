# Vision
## Product Direction
1. Ship Error Hammer as a mobile-first construction ops sim with deterministic outcomes and readable tactical choices.
2. Keep the field loop fast and consistent: accept work, run tasks, settle, return/store, end day.
3. Expand management depth through Office systems without destabilizing core field gameplay.
4. Preserve dark visual identity while keeping action-critical UI readable on small devices.

## Current Verified Baseline (`main`, 2026-03-03)
1. Trade baseline is expanded: 50 supported trade skills, 188 trade jobs, 10 bots, compact rotating mobile contracts.
2. Business progression now starts in `Truck Life`, with expansion to `Office` and `Yard` through facility research + buy-in.
3. Economy is monthly-lump based: bills post every 22 shifts with unpaid carry, late fees, and strike tracking.
4. Two-strike collapse behavior is active: forced downgrades (`yard -> office -> truck`) and bankruptcy reset at truck tier.
5. Office now includes `Facilities`, `Research`, `Yard`, `Trade Index`, and `Accounting` sections.
6. Trash routing now has two cost modes: premium haul (no dumpster) vs yard dumpster service (enabled).
7. Core Perks are live as deterministic modifiers layered on top of trade skill rolls.
8. Save format is now `SAVE_VERSION=6` for this architecture change.
9. Confidence/flow layer is in progress (`PLN-015`): contract triage filters, recovery controls, estimate-vs-actual recap, and completion-feedback polish.
10. ReleaseOps baseline is now defined (`PLN-018`) to standardize itch build IDs, changelog gating, and per-platform release manifests.

## Next Focus
1. Finalize and verify `PLN-015` confidence loop UX (recap clarity, filter scan speed, defer/abandon ergonomics).
2. Calibrate monthly pressure and downgrade cadence so collapse/recovery loops feel fair.
3. Tune facility buy-ins and dumpster economics to keep mid-game expansion meaningful but attainable.
4. Close `PLN-018` verification and documentation chain so every itch ship is one-command and fully traceable.

## Archive
1. Closed-chain and verbose board history remains in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Historical migration context remains in [Migration-Legacy-2026-02-27.md](/g:/ErrorHammer/obsidian_vault/archive/Migration-Legacy-2026-02-27.md).
