# Content Pack Spec
## Current Source Of Truth
1. Gameplay content definitions live in `content/*.json`.
2. Validation schemas live in `schemas/*.schema.json`.
3. Validation command is `npm run content:validate`.
4. Compile command is `npm run content:compile`.
5. Compiled runtime artifact is `src/generated/content.bundle.json`.

## Content Files
1. `content/tools.json`
2. `content/jobs.json`
3. `content/events.json`
4. `content/districts.json`
5. `content/bots.json`
6. `content/strings.json`

## Schema Rules
1. Every content file must have a schema with required-field checks.
2. Job and event flavor strings must include:
3. `success_line`
4. `fail_line`
5. `neutral_line`
6. ID fields must be unique and stable.
7. Numeric fields must define explicit min/max bounds where applicable.

## Validation + Compile Flow
1. Read all JSON source files.
2. Validate each file against its schema.
3. Stop on first validation error in local and CI flows.
4. Normalize cross-references (`job.requiredTools`, `job.districtId`, event mod targets, bot IDs).
5. Emit one compiled bundle for runtime consumption.

## Editing Guidance
1. Content additions should be JSON-only whenever possible.
2. Schema changes require matching test updates.
3. Any structural contract change must be documented in `obsidian_vault/Decisions.md` and `obsidian_vault/Testing.md`.
4. Keep naming and flavor tone aligned with Error Hammer style rules.

## Archive
1. Prior legacy source project element-pack docs were retired in `obsidian_vault/archive/Migration-Legacy-2026-02-27.md`.

