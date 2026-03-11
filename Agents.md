# Agents

## Global Rules
- Branch: use only `main`.
- Workspace: single folder/repo, no worktrees.
- Canonical process docs live in `docs/` + `README.md`.
- `obsidian_vault/` is archive/journal only.

## Workflow
- Lane model: `Plan -> Build -> Verify`.
- Build in small slices and validate every change.
- Required iteration loop for each slice:
1. Plan slice and acceptance checks.
2. Implement the slice.
3. Run targeted checks.
4. Pause and observe evidence.
5. Adjust if needed.
6. Close with full gate sequence.

## Handoff Tracking Rules
- Source of truth: `docs/process/tasks.md` (`Active Board`).
- Allowed active card prefixes: `PLN-*`, `BLD-*`, `VF-*`.
- Retired for new work: `TW-*`, `DOC-*` (history only).
- Every active card must include:
1. `Lane`
2. `Status`
3. `Priority`
4. `Depends On`
5. `Exit Evidence`
- Allowed status values: `READY`, `BLOCKED`, `IN_PROGRESS`, `DONE`, `SUPERSEDED`.
- WIP limit: one `IN_PROGRESS` card per lane.

## Commit Tagging Rules
- Every commit message must begin with exactly one lane tag:
1. `[Plan]`
2. `[Build]`
3. `[Verify]`
- Tag must match the lane that produced the change.
- Format:
1. `[LaneTag] <short description>`
- Examples:
1. `[Plan] Define BLD-026 acceptance checks and dependencies`
2. `[Build] Implement rescue flow UI selectors and tests`
3. `[Verify] Confirm all five gates pass on main`

## Lanes
### Plan
- Role: define scope, constraints, acceptance criteria, and smallest viable slice.
- Allowed edits: `docs/**`, `README.md`, `Agents.md`, and board updates in `docs/process/tasks.md`.
- Forbidden edits: runtime logic in `src/**` except tiny clarifying comments if explicitly required.
- Output:
1. Decision-complete implementation notes.
2. Clear acceptance criteria.
3. Updated active board card state.

### Build
- Role: implement approved changes in small, testable increments.
- Allowed edits: runtime/tests/config/docs required by implementation.
- Responsibilities:
1. Keep slices small.
2. Add/update deterministic tests with each behavior change.
3. Record follow-up verification needs in active board evidence notes.

### Verify
- Role: validate behavior and quality gates; patch only validated defects.
- Allowed edits: verification docs and minimal bug fixes required to satisfy verified failures.
- Required closure gate order:
1. `npm run content:validate`
2. `npm run content:compile`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
- Output:
1. Gate outcomes and failure details.
2. Explicit pass/fail evidence tied to board card exit criteria.
