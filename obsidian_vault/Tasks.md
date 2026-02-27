# Tasks
## Current Focus
1. `PLN-002` planning lock is complete for `Spec.md` MVP bootstrap execution.
2. Execute `BLD-002` as the active Builder full-scope bootstrap pass.
3. Keep `TW-002`, `VF-002`, and `DOC-002` blocked until preceding lane exit evidence is recorded.
4. Preserve lane scope discipline while implementing the first runnable stack.
5. Keep deterministic architecture constraints active from day one.
6. Treat `obsidian_vault/Tasks.md` `Active Lane Board (Kanban)` as the handoff source of truth.

## Active Lane Board (Kanban)
Snapshot date: 2026-02-27.

### Pull Order Rules
1. Priority order is `P0` then `P1` then `P2`.
2. Pull top-to-bottom within the same priority.
3. WIP limit is one `IN_PROGRESS` card per lane.
4. Every lane updates this board at start and completion.

### Lane Cards
| Card ID | Lane | Status | Priority | Depends On | Source Task | Exit Evidence |
| ------- | ---- | ------ | -------- | ---------- | ----------- | ------------- |
| PLN-001 | Planner | DONE | P0 | N/A | `Error Hammer workflow + vault reset planning` | `Agents.md` and active vault docs rewritten for Error Hammer baseline; legacy source project carryover archived to one migration note. |
| PLN-002 | Planner | DONE | P0 | PLN-001 | `Spec.md MVP implementation planning lock + chain supersession` | `Vision.md`, `Decisions.md`, `Tasks.md`, `Testing.md`, `README.md`, and `Agents.md` updated with decision-complete `BLD-002` handoff and acceptance gates. |
| BLD-001 | Builder | SUPERSEDED | P0 | PLN-001 | `Error Hammer MVP bootstrap implementation (legacy baseline chain)` | Superseded by `BLD-002` per `PLN-002` (see `Supersession Archive`). |
| TW-001 | TestWriter | SUPERSEDED | P0 | BLD-001 | `Deterministic bootstrap scenarios and assertions (legacy baseline chain)` | Superseded by `TW-002` per `PLN-002` (see `Supersession Archive`). |
| VF-001 | Verifier | SUPERSEDED | P0 | TW-001 | `Bootstrap verification and bug-fix patching (legacy baseline chain)` | Superseded by `VF-002` per `PLN-002` (see `Supersession Archive`). |
| DOC-001 | Documenter | SUPERSEDED | P0 | VF-001 | `Bootstrap documentation closeout (legacy baseline chain)` | Superseded by `DOC-002` per `PLN-002` (see `Supersession Archive`). |
| BLD-002 | Builder | READY | P0 | PLN-002 | `Spec.md full MVP bootstrap implementation` | Implement full scaffold, deterministic core modules, schema/content pipeline, baseline UI shell, CI workflow, and command pass summary. |
| TW-002 | TestWriter | BLOCKED | P0 | BLD-002 | `Deterministic full-spec scenarios and assertions` | Implement `EH-TW-001..EH-TW-016` with explicit pass/fail criteria and evidence references. |
| VF-002 | Verifier | BLOCKED | P0 | TW-002 | `Full bootstrap verification and validated bug-fix patching` | Run command checklist, replay determinism check, and patch only validated defects. |
| DOC-002 | Documenter | BLOCKED | P0 | VF-002 | `Bootstrap documentation closeout` | Sync README and vault summaries with verified behavior and final board state. |

### Supersession Archive
| Superseded Card | Replacement Card | Date | Reason |
| --------------- | ---------------- | ---- | ------ |
| BLD-001 | BLD-002 | 2026-02-27 | `PLN-002` replaced baseline bootstrap chain with full `Spec.md` decision-complete implementation scope. |
| TW-001 | TW-002 | 2026-02-27 | `PLN-002` expanded deterministic scenario contract to `EH-TW-001..EH-TW-016`. |
| VF-001 | VF-002 | 2026-02-27 | `PLN-002` aligned verifier checklist and evidence expectations to the new Builder/TestWriter chain. |
| DOC-001 | DOC-002 | 2026-02-27 | `PLN-002` moved documentation closeout dependency to the new verification chain. |

## [TASK] Spec.md MVP Bootstrap Chain (`PLN-002`)
Status: Planner complete (`PLN-002` done); `BLD-002` is `READY`; `TW-002`, `VF-002`, and `DOC-002` are `BLOCKED`.

### Problem Statement
1. The repository currently contains planning artifacts only and no runnable MVP scaffold.
2. `Spec.md` requires a complete deterministic bootstrap baseline across runtime, content, validation, testing, and CI.
3. Prior chain (`BLD-001`..`DOC-001`) was scoped as generic bootstrap and did not lock all `Spec.md` decisions.

### Goals
1. Bootstrap a runnable React + TypeScript + Vite app with deterministic day-resolution core modules.
2. Enforce content-driven gameplay via JSON content, JSON Schema validation, and content bundle compile pipeline.
3. Deliver minimum MVP content counts and baseline UI shells from `Spec.md`.
4. Establish local and CI quality gates that fail on schema, test, or build regressions.

### Constraints
1. No gameplay logic may live in UI components; UI submits intents and consumes resolver results.
2. All randomness must flow through `src/core/rng.ts`.
3. Tool durability and stamina floors are hard invariants (`>= 0`).
4. Contract conflict priority is reputation-first, seeded tie-break second.
5. MVP scope excludes realtime multiplayer and platform wrappers.
6. Root path remains `g:\ErrorHammer`; do not rename or nest the repository.

### Risks
1. UI-first shortcuts can leak gameplay mutations into components and break determinism.
2. Schema under-specification can allow invalid content that fails at runtime.
3. Non-stable compile ordering can break deterministic replay and diffability.
4. Full-scope bootstrap in one card can sprawl without strict module boundaries.

### Deliverables
1. Planner deliverable: updated vault docs, board supersession records, and decision-complete lane handoffs.
2. Builder deliverable: complete MVP bootstrap implementation plus CI workflow.
3. TestWriter deliverable: deterministic scenario assertions and expected outcomes.
4. Verifier deliverable: command checklist evidence and minimal validated bug fixes only.
5. Documenter deliverable: README and vault summaries synced to verified behavior.

### Public Interfaces and Types To Lock
1. `src/core/types.ts` must define: `ToolDef`, `JobDef`, `EventDef`, `DistrictDef`, `BotProfile`, and `StringsDef`.
2. `src/core/types.ts` must define runtime state/types: `ToolInstance`, `CrewState`, `ActorState`, `ContractInstance`, `AssignmentIntent`, `Intent`, `Resolution`, `DayLog`, `GameState`, and `ContentBundle`.
3. `src/core/rng.ts` must export deterministic seeded RNG utilities consumed by all core modules.
4. `src/core/economy.ts` must export contract-board generation and payout/event modifier helpers.
5. `src/core/bots.ts` must export bot intent generation using profile weights with player-equivalent rule gates.
6. `src/core/resolver.ts` must export a pure day-resolution entrypoint taking `GameState`, intents, content bundle, and day seed, returning next state, resolutions, and logs.
7. `src/core/save.ts` must export localStorage single-slot helpers (`save`, `load`, `clear`).
8. `src/core/content.ts` must export runtime bundle loading and shape checks.
9. `scripts/content_validate.ts` must validate all content against schemas and exit non-zero on failure.
10. `scripts/content_compile.ts` must validate, normalize, and emit stable `src/generated/content.bundle.json`.

### Builder Handoff (`BLD-002`)
1. Initialize project files: `package.json`, `tsconfig.json`, `vite.config.ts`, React entry files, Vitest wiring, and npm scripts (`dev`, `build`, `preview`, `test`, `content:validate`, `content:compile`).
2. Create required folder/file roots: `content/`, `schemas/`, `scripts/`, `src/generated/`, `src/core/`, `src/ui/screens/`, `src/ui/components/`, and `tests/`.
3. Implement schema set (`tools`, `jobs`, `events`, `districts`, `bots`, `strings`) including required flavor-line constraints.
4. Add starter content minimums: `10` tools, `30` jobs, `12` events, `3` districts, `2` bots, and global strings content.
5. Implement `src/core/**` modules with deterministic seeded flow and invariant guards.
6. Implement minimal UI screens/components (`Title`, `Main`, `Store`, `Company`, `ContractList`, `AssignmentPanel`, `DayReport`, `StatsPanel`) with resolver-driven orchestration only.
7. Implement local save/continue flow using single-slot localStorage persistence.
8. Generate and commit `src/generated/content.bundle.json` via compile script.
9. Add CI workflow `.github/workflows/ci.yml` running `npm ci`, `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
10. Update this board with Builder exit evidence containing changed module list and command-pass summary.

### Builder Acceptance Criteria (`BLD-002` Exit Evidence)
1. Required commands exist and pass locally: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
2. Deterministic parity evidence proves same seed plus same intents yields identical resolver digest/output.
3. Content bundle compile output is reproducible with stable ordering.
4. Runtime logic does not live inside `src/ui/**` beyond orchestration/state wiring.
5. `BLD-002` card is marked `DONE` and `TW-002` is unblocked with explicit evidence links.

### TestWriter Handoff (`TW-002`, blocked until `BLD-002` exit)
1. Implement deterministic and guard coverage for scenarios `EH-TW-001..EH-TW-016` in automated tests.
2. Define explicit pass/fail criteria in `obsidian_vault/Testing.md` using day-resolution fields.
3. Add schema-failure assertions demonstrating missing required flavor lines are rejected.
4. Add content-compile shape assertions for normalized bundle output.
5. Record evidence summary and update board status to unblock `VF-002`.

### Verifier Handoff (`VF-002`, blocked until `TW-002` exit)
1. Run and record: `npm run content:validate`, `npm run content:compile`, `npm test`, and `npm run build`.
2. Execute deterministic replay smoke at least twice with the same seed and intent set.
3. Patch only validated defects found by the checklist and record rationale.
4. Record PASS/FAIL evidence in `obsidian_vault/Testing.md` and update board statuses.

### Documenter Handoff (`DOC-002`, blocked until `VF-002` exit)
1. Sync README usage/testing/workflow sections with verified behavior.
2. Update `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` with closeout evidence.
3. Mark lane cards complete and keep supersession archive rows intact for replaced cards.

### Exit Evidence
1. Planner: complete (`PLN-002`) in current workspace docs.
2. Builder: pending (`BLD-002`).
3. TestWriter: pending (`TW-002`).
4. Verifier: pending (`VF-002`).
5. Documenter: pending (`DOC-002`).
