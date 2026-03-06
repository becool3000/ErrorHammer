import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { createInitialGameState } from "../src/core/resolver";
import { formatArchetypeLabel, getPerkArchetypeSnapshot } from "../src/core/perks";

const bundle = loadContentBundle();

describe("perk archetype snapshot", () => {
  it("is deterministic and exposes primary/secondary labels", () => {
    const state = createInitialGameState(bundle, 5801, "James", "The Company");
    state.perks.corePerks.precision = 4;
    state.perks.corePerks.tool_mastery = 3;
    state.perks.corePerks.blueprint_reading = 2;
    state.perks.corePerks.estimating = 3;
    state.perks.corePerks.negotiation = 2;
    state.perks.corePerks.project_management = 2;

    const snapshot = getPerkArchetypeSnapshot(state);
    expect(snapshot.primary).toBe("precision-shop");
    expect(snapshot.secondary).toBe("margin-master");
    expect(snapshot.tags[0]).toBe(formatArchetypeLabel("precision-shop"));
    expect(snapshot.tags[1]).toBe(formatArchetypeLabel("margin-master"));

    const repeat = getPerkArchetypeSnapshot(state);
    expect(repeat).toEqual(snapshot);
  });

  it("returns null archetypes when no perk levels exist", () => {
    const state = createInitialGameState(bundle, 5802, "James", "The Company");
    const snapshot = getPerkArchetypeSnapshot(state);
    expect(snapshot.primary).toBeNull();
    expect(snapshot.secondary).toBeNull();
    expect(snapshot.tags).toEqual([]);
  });
});
