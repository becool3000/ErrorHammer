# Error Hammer

## Status (2026-03-10)
1. Quality gates are enforced in CI: `content:validate`, `content:compile`, `typecheck`, `test`, `build`.
2. Save schema version is `SAVE_VERSION=7`.
3. Canonical process docs now live in `docs/`; vault is archive/journal only.

## Run Instructions
1. Install dependencies: `npm install`
2. Validate content: `npm run content:validate`
3. Compile generated bundle: `npm run content:compile`
4. Typecheck: `npm run typecheck`
5. Run tests: `npm test`
6. Build production bundle: `npm run build`
7. Start local dev server: `npm run dev`

## Canonical Docs
1. Process workflow: [docs/process/workflow.md](docs/process/workflow.md)
2. Active board: [docs/process/tasks.md](docs/process/tasks.md)
3. Testing contract: [docs/testing.md](docs/testing.md)
4. Architecture snapshot: [docs/architecture.md](docs/architecture.md)
5. Decisions (ADR index/template): [docs/adr/README.md](docs/adr/README.md)

## Current Verified Gate Snapshot (2026-03-10)
1. `npm run content:validate` PASS
2. `npm run content:compile` PASS
3. `npm run typecheck` PASS
4. `npm test` PASS (`40` files, `279` tests)
5. `npm run build` PASS

## Workflow Summary
1. Lanes are `Plan -> Build -> Verify`.
2. Required loop per slice: `plan -> implement -> targeted checks -> pause/observe -> adjust -> close`.
3. Active board source of truth is `docs/process/tasks.md`.
4. Commit prefixes are `[Plan]`, `[Build]`, `[Verify]`.

## Itch.io Publish
1. Run `npm run release:itch`.
2. If release notes are incomplete, fill `release/platforms/itch/releases/<releaseId>/CHANGELOG.md` and rerun.
3. Upload `error-hammer-vX.Y.Z+itch.YYYYMMDD.NN-itch.zip`.
4. Release manifests are written under `release/platforms/itch/releases/<releaseId>/`.
