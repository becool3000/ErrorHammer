import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift } from "../src/core/resolver";
import { DAY_LABOR_CONTRACT_ID, getAvailableContractOffers, startResearch } from "../src/core/playerFlow";
import { TRADE_SKILLS } from "../src/core/types";
import { loadContentBundle } from "../src/core/content";

const bundle = loadContentBundle();

describe("research unlock flow", () => {
  it("starts with day labor only and all trade locks closed", () => {
    const state = createInitialGameState(bundle, 9001);
    const offers = getAvailableContractOffers(state, bundle);

    expect(state.research.babaUnlocked).toBe(false);
    expect(Object.values(state.research.unlockedCategories).every((value) => value === false)).toBe(true);
    expect(Object.values(state.research.unlockedSkills).every((value) => value === false)).toBe(true);
    expect(offers.length).toBe(1);
    expect(offers[0]?.contract.contractId).toBe(DAY_LABOR_CONTRACT_ID);
  });

  it("completes Baba research in one end-day and reveals Baba pinned offer", () => {
    const state = createInitialGameState(bundle, 9002);
    const started = startResearch(state, "rd-baba-network");
    expect(started.notice).toContain("Research started");

    const rolled = endShift(started.nextState, bundle);
    expect(rolled.nextState.research.babaUnlocked).toBe(true);

    const offers = getAvailableContractOffers(rolled.nextState, bundle);
    expect(offers[0]?.contract.contractId).toBe(DAY_LABOR_CONTRACT_ID);
    expect(offers[1]?.job.tags.includes("baba-g")).toBe(true);
  });

  it("blocks skill research until the parent category is unlocked", () => {
    const state = createInitialGameState(bundle, 9003);
    const blocked = startResearch(state, "rd-skill-electrician");

    expect(blocked.nextState).toBe(state);
    expect(blocked.notice).toMatch(/parent trade category/i);
  });

  it("restores full one-per-skill offer mix after all trade skills are unlocked", () => {
    const state = createInitialGameState(bundle, 9004);
    state.research.babaUnlocked = true;
    for (const skillId of TRADE_SKILLS) {
      state.research.unlockedSkills[skillId] = true;
    }

    const offers = getAvailableContractOffers(state, bundle);
    const tradeOffers = offers.filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));
    const distinctSkills = new Set(tradeOffers.map((offer) => offer.job.primarySkill));

    expect(tradeOffers.length).toBe(TRADE_SKILLS.length);
    expect(distinctSkills.size).toBe(TRADE_SKILLS.length);
  });
});
