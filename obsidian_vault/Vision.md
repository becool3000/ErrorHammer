# Vision
## Product Direction
1. Ship Error Hammer as a text-first construction ladder sim with dark humor and mobile-first readability.
2. Keep the shift loop deterministic and fast: accept work, run tasks, settle outcome, end day.
3. Keep gameplay logic pure in `src/core/**` and content-driven via validated JSON plus generated bundle.
4. Keep UI interactions compact and touch-friendly for Android-class mobile devices.
5. Maintain fallback accessibility: `Day Labor` is always available and `Baba G` provides a rotating high-risk backup offer.

## Current Verified Baseline (`main`, 2026-03-02)
1. Skill model is fully migrated to 19 trade skills with a per-job `primarySkill`.
2. Content pack now enforces exactly `95` trade jobs and exactly `10` bots.
3. Baba fallback content is separated into `babaJobs` and rotates daily as the second visible offer.
4. Contract surface now shows `21` visible offers on full board: `Day Labor`, `Baba G`, and one trade offer per skill.
5. Contracts UI is grouped for mobile by trade families instead of long horizontal carousel scanning.
6. Runtime/save compatibility is handled through save-version bump and incompatible-save guardrails.
7. Regression gate is green for validation, compile, test, and production build.

## Next Focus
1. Tune economy pacing and progression clarity now that trade-content scope is locked.
2. Improve post-overhaul explainability (risk, cost drivers, and settlement outcomes) without widening core systems.
3. Keep further changes scoped as additive planner chains rather than expanding `PLN-011`.

## Archive
1. Closed-chain and verbose board history remains in [Tasks-Lane-Board-2026-03-01.md](/g:/ErrorHammer/obsidian_vault/archive/Tasks-Lane-Board-2026-03-01.md).
2. Historical migration context remains in [Migration-Legacy-2026-02-27.md](/g:/ErrorHammer/obsidian_vault/archive/Migration-Legacy-2026-02-27.md).
