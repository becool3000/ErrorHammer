# Itch Release v0.1.1+itch.20260305.01

## Added
- Added ReleaseOps command chain (`release:prepare`, `release:verify`, `release:finalize`, `release:itch`) for one-command itch publishing.
- Added tracked release manifests and indexes under `release/platforms/itch` plus global `release/index.json`.
- Added in-game build info panel in Settings with version, build ID, release label, commit, and build timestamp.

## Changed
- Changed itch artifact naming to include release label: `error-hammer-vX.Y.Z+itch.YYYYMMDD.NN-itch.zip`.
- Changed title screen metadata from version-only to `Version`, `Build`, and `Release`.
- Changed packaging workflow to enforce notes preflight before running verification/build gates.

## Fixed
- Fixed release traceability gap by generating runtime release metadata (`appVersion`, `buildId`, `releaseLabel`, `gitCommit`, `builtAtUtc`) for each shipping build.
- Fixed release process drift by appending vault release records automatically at finalize.

## Balance
- Balanced release discipline toward safer shipping by requiring changelog sections to be filled before publish.

## Content
- Added release template scaffold with required sections: Added, Changed, Fixed, Balance, Content, UX/Mobile, Technical, and Known Issues.

## UX/Mobile
- Added compact build metadata visibility in Settings while keeping existing mobile card density.
- Added title build metadata lines for easy support screenshot verification.

## Technical
- Added script helpers for build-id formatting, patch bumping, changelog validation, and release index updates.
- Added tests for release helper logic and release metadata UI surfaces.
- Added schemas for release manifest/index contracts and zip ignore rules for local artifacts.

## Known Issues
- Existing uncommitted workspace changes from prior feature passes remain and should be reviewed before tagging/pushing upstream.
