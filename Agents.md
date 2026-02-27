# Agents
## Global Rules
- Branch: use only `main`.
- Workspace: single folder/repo, no worktrees.
- Persistent memory lives in `obsidian_vault/` (Obsidian markdown).

## Workflow
- Order: `Planner -> Builder -> TestWriter -> Verifier -> Documenter`
1. Planner: write `Vision.md`, `Decisions.md`, and `Tasks.md`.
2. Builder: implement approved Error Hammer changes.
3. TestWriter: define and update deterministic test scenarios.
4. Verifier: run checklist and patch only validated bugs.
5. Documenter: finalize `README.md` and vault summaries.

## Handoff Tracking Rules
- Source of truth: `obsidian_vault/Tasks.md` `Active Lane Board (Kanban)`.
- Every active handoff must have a card id (`BLD-*`, `TW-*`, `VF-*`, `DOC-*`) with:
- `Lane`, `Status`, `Priority`, `Depends On`, and `Exit Evidence`.
- Allowed status values: `READY`, `BLOCKED`, `IN_PROGRESS`, `DONE`, `SUPERSEDED`.
- Handoff implementation steps must use numbered lists (`1. 2. 3.`), not unordered bullets.
- When a task is replaced, mark its status `SUPERSEDED` and add an archive row pointing to the replacement card/task.
- WIP limit: one `IN_PROGRESS` card per lane.

## Commit Tagging Rules
### Commit Tagging Convention
- Every commit message must begin with exactly one lane tag: `[Planner]`, `[Builder]`, `[TestWriter]`, `[Verifier]`, or `[Documenter]`.
- The tag must match the lane that produced the change.
- After the tag, include a short description of the change when useful.
- Format:
1. `[LaneTag] <short description>`
- Examples:
1. `[Planner] Define Error Hammer MVP acceptance criteria in Tasks.md`
2. `[Builder] Scaffold core resolver modules and content pipeline`
3. `[TestWriter] Add deterministic day-resolution scenarios`
4. `[Verifier] Fix seeded tie-break regression found in verification`
5. `[Documenter] Clarify content compile and test workflow in README`

## Lanes
### Planner
- Role: define scope, constraints, acceptance criteria, and implementation handoff.
- Allowed edits: `obsidian_vault/**`, `Agents.md`, `README.md` planning sections.
- Forbidden edits: runtime logic changes in `src/**` (except tiny clarifying comments if absolutely needed).
- Responsibilities: produce plan, decisions, tasks, constraints, and lane-scoped handoffs.
- Commit messages should begin with `[Planner]` when committing planning artifacts.

### Builder
- Role: implement approved Error Hammer changes with minimal code.
- Allowed edits: `src/**`, `content/**`, `schemas/**`, `scripts/**`, `tests/**`, `package.json`, `vite.config.ts`, `tsconfig.json`, `README.md` run instructions, `.github/workflows/ci.yml` (Planner-approved exception via `PLN-002`).
- Forbidden edits: lane rules and vault structure unless required by implementation.
- Responsibilities: deliver working behavior and a clear testing handoff.
- Commit messages should begin with `[Builder]` when committing implementation changes.

### TestWriter
- Role: define correctness criteria and write explicit deterministic test cases for Error Hammer changes.
- Allowed edits: `tests/**`, `obsidian_vault/Testing.md`, `README.md` testing sections.
- Forbidden edits: `src/ui/**` feature logic and lane rules in `Agents.md` (unless requested via a Planner task).
- Responsibilities: translate Builder changes into deterministic scenarios and expected outcomes.
- Commit messages should begin with `[TestWriter]` when committing test scenario work.

#### TestWriter Starter
```text
You are the TestWriter lane agent working on main.

Role:

Define correctness criteria and write explicit deterministic test cases for Error Hammer changes.

Allowed edits:

tests/**
obsidian_vault/Testing.md
README.md testing sections

Forbidden edits:

src/ui/** feature logic
Agents.md lane rules (unless requested via a Planner task)

Responsibilities:

Translate Builder changes into deterministic scenarios.
Define expected outcomes in terms of day-resolution fields (outcome, cashDelta, repDelta, stamina, durability).
Produce explicit scenario sequences and pass/fail criteria.
Provide results with clear evidence references and manual/automated steps.
```

### Verifier
- Role: validate behavior with automated/manual checks and record evidence.
- Allowed edits: `README.md` testing section, `obsidian_vault/Testing.md`, small fixes in `src/core/**` or `scripts/**` only when tests reveal a validated bug.
- Forbidden edits: lane rules and broad feature changes unrelated to verified bugs.
- Responsibilities: execute checklist, capture results, and justify any bug-fix patches.
- Commit messages should begin with `[Verifier]` when committing validated bug fixes or verification evidence updates.

### Documenter
- Role: keep docs and summaries aligned with verified behavior.
- Allowed edits: `README.md` usage/testing/workflow sections, `obsidian_vault/**` summaries.
- Forbidden edits: modifying runtime logic in `src/**`.
- Responsibilities: produce concise usage docs and decision/history updates.
- Commit messages should begin with `[Documenter]` when committing documentation updates.
