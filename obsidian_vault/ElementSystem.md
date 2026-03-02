# Resolver System
## Scope
1. Error Hammer gameplay resolution is pure-function first and UI-agnostic.
2. Runtime composes deterministic modules under `src/core/**`.
3. No direct gameplay mutation from React components.

## Core Modules
1. `rng.ts`: seeded RNG utilities and deterministic tie-break helpers.
2. `types.ts`: canonical TypeScript interfaces for content and runtime state.
3. `economy.ts`: contract board generation and payout/risk modifiers.
4. `bots.ts`: bot intent scoring and assignment selection.
5. `resolver.ts`: authoritative day-resolution pipeline.
6. `save.ts`: serialization/deserialization and save-slot helpers.
7. `content.ts`: content bundle loading and runtime lookup helpers.

## Day Resolution Order
1. Load day state and active event modifiers.
2. Build actor intents for player, crews, and bots.
3. Validate intents against stamina and tool requirements.
4. Resolve contract conflicts by reputation, then seeded tie-break.
5. Roll outcomes (`success`, `fail`, `neutral`, `lost`) with seeded RNG.
6. Apply deltas (`cash`, `reputation`, `durability`, `stamina`) with floor/ceiling guards.
7. Append structured day log lines.
8. Advance day and persist updated `GameState`.

## Determinism Rules
1. All stochastic behavior must route through `rng.ts`.
2. Resolver inputs must be explicit: `seed`, `day`, `content bundle`, `intents`, and prior `GameState`.
3. For the same inputs, resolver outputs must be byte-identical.
4. Tests should compare stable digests of outcome payloads and actor states.

## Runtime State Contract
1. Core entity types: `GameState`, `ActorState`, `CrewState`, `ContractInstance`, `Intent`, and `Resolution`.
2. Mandatory mutable actor fields: `cash`, `reputation`, `staminaMax`, `stamina`, and tool durability map.
3. Tool durability values are clamped to `0..maxDurability`.
4. Stamina values are clamped to `0..staminaMax`.

## Guardrails
1. Resolver functions must avoid side effects except through returned state.
2. UI should dispatch intents and render outputs only.
3. Content definitions must be validated before simulation use.
4. New mechanics should be introduced by extending core modules and schemas, not component-level patches.
