# Tasks
## Current Focus
1. Bootstrap chain `PLN-002 -> BLD-002 -> TW-002 -> VF-002 -> DOC-002` is fully closed on `main`.
2. Lane cards `BLD-002`, `TW-002`, `VF-002`, and `DOC-002` are complete with recorded exit evidence.
3. New implementation work requires a new Planner card before additional runtime changes.
4. `obsidian_vault/Tasks.md` `Active Lane Board (Kanban)` remains the handoff source of truth.

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
| BLD-002 | Builder | DONE | P0 | PLN-002 | `Spec.md full MVP bootstrap implementation` | Implemented runtime/core/ui/content/schema/scripts/tests scaffold, emitted `src/generated/content.bundle.json`, and added command-gate CI in `.github/workflows/ci.yml`. |
| TW-002 | TestWriter | DONE | P0 | BLD-002 | `Deterministic full-spec scenarios and assertions` | Implemented deterministic scenarios `EH-TW-001..EH-TW-016` in `tests/tw_scenarios.test.ts` with explicit day-resolution pass/fail assertions. |
| VF-002 | Verifier | DONE | P0 | TW-002 | `Full bootstrap verification and validated bug-fix patching` | Checklist PASS for validate/compile/test/build, deterministic replay parity PASS, and headless manual smoke PASS (see `obsidian_vault/Testing.md`). |
| DOC-002 | Documenter | DONE | P0 | VF-002 | `Bootstrap documentation closeout` | Synced `README.md`, `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` to final verified behavior and board state. |

### Supersession Archive
| Superseded Card | Replacement Card | Date | Reason |
| --------------- | ---------------- | ---- | ------ |
| BLD-001 | BLD-002 | 2026-02-27 | `PLN-002` replaced baseline bootstrap chain with full `Spec.md` decision-complete implementation scope. |
| TW-001 | TW-002 | 2026-02-27 | `PLN-002` expanded deterministic scenario contract to `EH-TW-001..EH-TW-016`. |
| VF-001 | VF-002 | 2026-02-27 | `PLN-002` aligned verifier checklist and evidence expectations to the new Builder/TestWriter chain. |
| DOC-001 | DOC-002 | 2026-02-27 | `PLN-002` moved documentation closeout dependency to the new verification chain. |

## [TASK] Spec.md MVP Bootstrap Chain (`PLN-002`)
Status: Completed on 2026-02-27 with all lane cards in `DONE` state.

### Problem Statement
1. The repository needed a complete runnable MVP scaffold instead of planning-only artifacts.
2. `Spec.md` required deterministic runtime behavior plus content validation, compile, testing, and CI gates.
3. Legacy chain `BLD-001..DOC-001` did not lock full `Spec.md` scope and was superseded.

### Goals
1. Bootstrap a runnable React + TypeScript + Vite app with deterministic day-resolution core modules.
2. Enforce content-driven gameplay through JSON content, JSON Schema validation, and normalized bundle compile.
3. Deliver baseline UI screens and MVP content minimums from `Spec.md`.
4. Establish local and CI quality gates that fail on schema, test, or build regressions.

### Constraints
1. No gameplay logic in UI components; UI submits intents and consumes resolver results.
2. All randomness flows through `src/core/rng.ts`.
3. Tool durability and stamina floors are hard invariants (`>= 0`).
4. Conflict priority is reputation-first, seeded tie-break second.
5. MVP scope excludes realtime multiplayer and platform wrappers.
6. Root path remains `g:\ErrorHammer`.

### Completion Evidence
#### Builder (`BLD-002`)
1. Implemented runtime scaffold (`src/core/**`, `src/ui/**`, app entry files, project config, npm scripts).
2. Implemented content/schema/pipeline stack (`content/**`, `schemas/**`, `scripts/content_validate.ts`, `scripts/content_compile.ts`).
3. Generated and committed `src/generated/content.bundle.json` with stable normalization.
4. Added CI command-gate workflow in `.github/workflows/ci.yml`.

#### TestWriter (`TW-002`)
1. Implemented deterministic suite `EH-TW-001..EH-TW-016` in `tests/tw_scenarios.test.ts`.
2. Documented explicit scenario pass/fail criteria and day-resolution assertion fields in `obsidian_vault/Testing.md`.
3. Covered schema failure, normalization behavior, save/load round-trip, bot gating, and flavor-line day logs.

#### Verifier (`VF-002`)
1. Verified `npm run content:validate` PASS.
2. Verified `npm run content:compile` PASS with emitted bundle path.
3. Verified `npm test` PASS (`5` files, `27` tests).
4. Verified `npm run build` PASS with generated dist assets.
5. Verified deterministic replay parity PASS for fixed-seed reruns.
6. Verified headless manual smoke PASS for title/main/store/company/save-continue flow.

#### Documenter (`DOC-002`)
1. Synced README usage/testing/workflow sections to verifier-approved runtime behavior.
2. Synced `Vision.md`, `Decisions.md`, `Tasks.md`, and `Testing.md` with final bootstrap status.
3. Preserved supersession archive rows and final board traceability.

### Exit Evidence
1. Planner: complete (`PLN-002`).
2. Builder: complete (`BLD-002`).
3. TestWriter: complete (`TW-002`).
4. Verifier: complete (`VF-002`).
5. Documenter: complete (`DOC-002`).
