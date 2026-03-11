# Architecture Snapshot

## Runtime Stack
1. Frontend: React 18 + TypeScript + Vite.
2. State: Zustand store in `src/ui/state.ts`.
3. Simulation and rules: deterministic core modules in `src/core/**`.
4. Content pipeline: JSON content validated/compiled into `src/generated/content.bundle.json`.

## Entry Points
1. App entry: `src/main.tsx`.
2. Root app shell: `src/ui/App.tsx`.
3. Active game shell: `src/ui/screens/GameShell.tsx`.

## Core System Boundaries
1. `src/core/**`: game rules, economy, operations, save/load, progression, encounters, accounting.
2. `src/ui/**`: rendering and user interaction dispatch to state actions.
3. `tests/**`: deterministic behavior and UI verification suites.
4. `scripts/**`: content/release tooling and operational checks.

## Data and Control Flow
1. User action in UI triggers a store action.
2. Store action calls deterministic core transition functions.
3. Transition result updates state and persists save.
4. UI re-renders from state snapshot and optional result overlays.

## Compatibility Notes
1. Bottom-nav label is `Company`, while internal primary tab identity remains `office` for compatibility.
2. Save schema is versioned (`SAVE_VERSION=7`).
3. Legacy/retired screens removed from runtime path remain archived in git history.
