# Process Workflow

## Canonical Contract
1. This file and `README.md` are canonical for process behavior.
2. Active board source of truth is `docs/process/tasks.md`.
3. `obsidian_vault/` is archive/journal only.

## Lanes
1. `Plan`
- Define smallest viable slice.
- Lock acceptance criteria and dependencies.
2. `Build`
- Implement slice behavior.
- Add or update deterministic tests with the behavior change.
3. `Verify`
- Validate targeted behavior.
- Run full gate sequence before card close.

## Iteration Loop (Required)
1. Plan slice and acceptance checks.
2. Implement.
3. Act: run targeted checks for touched behavior.
4. Pause: inspect outputs/logs/failures.
5. Observe: confirm behavior and risk.
6. Adjust: apply minimal corrections.
7. Close with full gates.

## Board Schema
Every active card in `docs/process/tasks.md` must include:
1. `Lane`
2. `Status`
3. `Priority`
4. `Depends On`
5. `Exit Evidence`

Allowed status values:
1. `READY`
2. `BLOCKED`
3. `IN_PROGRESS`
4. `DONE`
5. `SUPERSEDED`

## WIP Limits
1. Maximum one `IN_PROGRESS` card per lane.
2. Do not pull new `Build` work while another `Build` card is `IN_PROGRESS` unless reprioritized in `Plan`.

## Commit Tags
1. `[Plan]`
2. `[Build]`
3. `[Verify]`

Commit format:
1. `[LaneTag] <short description>`

## Gate Order For Closeout
1. `npm run content:validate`
2. `npm run content:compile`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
