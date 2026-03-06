import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/core/resolver";
import { getTaskPerkModifiers } from "../src/core/perks";
import { loadContentBundle } from "../src/core/content";

const bundle = loadContentBundle();

describe("core perk modifiers", () => {
  it("applies deterministic bounded modifiers by trade/perk mix", () => {
    const state = createInitialGameState(bundle, 9831);
    state.perks.corePerks.precision = 5;
    state.perks.corePerks.diagnostics = 5;
    state.perks.corePerks.tool_mastery = 8;
    state.perks.corePerks.project_management = 6;
    state.perks.corePerks.negotiation = 10;
    state.perks.corePerks.estimating = 10;
    state.perks.corePerks.physical_endurance = 6;
    state.perks.corePerks.blueprint_reading = 4;

    const carpenterJob = bundle.jobs.find((job) => job.primarySkill === "carpenter");
    const electricianJob = bundle.jobs.find((job) => job.primarySkill === "electrician");
    if (!carpenterJob || !electricianJob) {
      throw new Error("Missing expected benchmark jobs");
    }

    const carpenterMods = getTaskPerkModifiers(state, carpenterJob, "do_work", true);
    const electricianMods = getTaskPerkModifiers(state, electricianJob, "do_work", true);

    expect(carpenterMods.skillBonus).toBe(6);
    expect(carpenterMods.qualityBonus).toBe(15);
    expect(carpenterMods.blueprintFirstTaskBonus).toBe(4);
    expect(carpenterMods.payoutMultiplier).toBe(1.12);
    expect(carpenterMods.supplyDiscountPct).toBe(0.2);
    expect(carpenterMods.overtimeFatigueReduction).toBe(2);

    expect(electricianMods.skillBonus).toBe(6);
    expect(electricianMods.qualityBonus).toBe(10);
    expect(electricianMods.payoutMultiplier).toBe(1.12);
  });
});
