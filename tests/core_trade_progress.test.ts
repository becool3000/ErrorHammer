import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { acceptContract, DAY_LABOR_CONTRACT_ID, getAvailableContractOffers, performTaskUnit } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { CORE_TRADE_SKILLS, mapSkillToCoreTrack } from "../src/core/tradeProgress";

const bundle = loadContentBundle();

function grantAllTools(state: ReturnType<typeof createInitialGameState>): void {
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
}

describe("core trade progression", () => {
  it("starts with Day Labor + Baba only", () => {
    const state = createInitialGameState(bundle, 22001);
    const offers = getAvailableContractOffers(state, bundle);
    const tradeOffers = offers.filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));

    expect(offers[0]?.contract.contractId).toBe(DAY_LABOR_CONTRACT_ID);
    expect(offers[1]?.job.tags.includes("baba-g")).toBe(true);
    expect(tradeOffers.length).toBe(0);
  });

  it("unlocks a mapped core track on Baba neutral completion", () => {
    const state = createInitialGameState(bundle, 22002);
    grantAllTools(state);
    const offers = getAvailableContractOffers(state, bundle);
    const babaOffer = offers.find((offer) => offer.job.tags.includes("baba-g"));
    expect(babaOffer).toBeTruthy();

    const accepted = acceptContract(state, bundle, babaOffer!.contract.contractId);
    expect(accepted.nextState.activeJob).toBeTruthy();
    const activeJob = accepted.nextState.activeJob!;
    const track = mapSkillToCoreTrack(babaOffer!.job.primarySkill);
    expect(track).toBeTruthy();

    for (const task of activeJob.tasks) {
      if (task.taskId === "collect_payment") {
        task.completedUnits = 0;
        task.requiredUnits = Math.max(1, task.requiredUnits);
      } else {
        task.completedUnits = task.requiredUnits;
      }
    }
    activeJob.location = "job-site";
    activeJob.recoveryMode = "finish_cheap";

    const resolved = performTaskUnit(accepted.nextState, bundle, "standard", true);
    expect(track ? resolved.nextState.tradeProgress.unlocked[track] : false).toBe(true);
    expect(resolved.payload?.logLines.some((line) => line.includes("Unlocked trade track"))).toBe(true);
  });

  it("blocks locked non-Baba contracts", () => {
    const state = createInitialGameState(bundle, 22003);
    grantAllTools(state);
    const lockedContract = state.contractBoard.find((contract) => {
      const job = bundle.jobs.find((entry) => entry.id === contract.jobId);
      return Boolean(job && mapSkillToCoreTrack(job.primarySkill));
    });
    expect(lockedContract).toBeTruthy();

    const result = acceptContract(state, bundle, lockedContract!.contractId);
    expect(result.nextState).toBe(state);
    expect(result.notice).toMatch(/still locked/i);
  });

  it("maps cabinet/millworker into finish carpentry", () => {
    expect(mapSkillToCoreTrack("cabinet_maker")).toBe("finish_carpentry");
    expect(mapSkillToCoreTrack("millworker")).toBe("finish_carpentry");
  });

  it("Baba selection is deterministic for same seed/day", () => {
    const first = createInitialGameState(bundle, 22004);
    const second = createInitialGameState(bundle, 22004);
    first.day = 5;
    second.day = 5;

    const firstBaba = getAvailableContractOffers(first, bundle).find((offer) => offer.job.tags.includes("baba-g"));
    const secondBaba = getAvailableContractOffers(second, bundle).find((offer) => offer.job.tags.includes("baba-g"));
    expect(firstBaba?.contract.contractId).toBe(secondBaba?.contract.contractId);
  });

  it("trade offers only include core-mapped skills", () => {
    const state = createInitialGameState(bundle, 22005);
    grantAllTools(state);
    for (const track of CORE_TRADE_SKILLS) {
      state.tradeProgress.unlocked[track] = true;
    }

    const offers = getAvailableContractOffers(state, bundle);
    const tradeOffers = offers.filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));
    expect(tradeOffers.length).toBeGreaterThan(0);
    expect(tradeOffers.every((offer) => mapSkillToCoreTrack(offer.job.primarySkill) !== null)).toBe(true);
  });
});
