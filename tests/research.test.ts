import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { DAY_LABOR_CONTRACT_ID, getAvailableContractOffers, startResearch } from "../src/core/playerFlow";
import { createInitialGameState, endShift } from "../src/core/resolver";

const bundle = loadContentBundle();

describe("research facilities flow", () => {
  it("starts with Day Labor + Baba visible and trade tracks locked", () => {
    const state = createInitialGameState(bundle, 19001);
    const offers = getAvailableContractOffers(state, bundle);
    const tradeOffers = offers.filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));

    expect(offers[0]?.contract.contractId).toBe(DAY_LABOR_CONTRACT_ID);
    expect(offers[1]?.job.tags.includes("baba-g")).toBe(true);
    expect(tradeOffers.length).toBe(0);
    expect(Object.values(state.tradeProgress.unlocked).every((value) => value === false)).toBe(true);
  });

  it("only supports facility research projects", () => {
    const state = createInitialGameState(bundle, 19002);
    const blocked = startResearch(state, "rd-skill-electrician");
    expect(blocked.nextState).toBe(state);
    expect(blocked.notice).toMatch(/unknown research project/i);
  });

  it("completes office facility research in one day", () => {
    const state = createInitialGameState(bundle, 19003);
    state.player.cash = Math.max(state.player.cash, 200);
    const started = startResearch(state, "rd-facility-office");
    expect(started.notice).toContain("Research started");

    const rolled = endShift(started.nextState, bundle);
    expect(rolled.nextState.research.completedProjectIds).toContain("rd-facility-office");
    expect(rolled.nextState.research.activeProject).toBeNull();
  });
});
