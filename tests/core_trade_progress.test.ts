import { describe, expect, it } from "vitest";
import { generateContractBoard } from "../src/core/economy";
import { loadContentBundle } from "../src/core/content";
import { acceptContract, DAY_LABOR_CONTRACT_ID, getAvailableContractOffers, performTaskUnit } from "../src/core/playerFlow";
import { hashSeed } from "../src/core/rng";
import { createInitialGameState } from "../src/core/resolver";
import { CORE_TRADE_SKILLS, getUnlockedTradeOfferSkills, mapSkillToCoreTrack } from "../src/core/tradeProgress";

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

  it("trade board can cover every unlocked trade offer skill", () => {
    const state = createInitialGameState(bundle, 22005);
    grantAllTools(state);
    for (const track of CORE_TRADE_SKILLS) {
      state.tradeProgress.unlocked[track] = true;
    }
    const unlockedSkills = getUnlockedTradeOfferSkills(state);
    state.contractBoard = generateContractBoard(bundle, state.day, hashSeed(state.seed, state.day, "all-unlocked"), {
      districtIds: state.player.districtUnlocks,
      maxTier: state.player.companyLevel + 1,
      skillIds: unlockedSkills
    });

    const offers = getAvailableContractOffers(state, bundle);
    const tradeOffers = offers.filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));
    const offeredSkills = new Set(tradeOffers.map((offer) => offer.job.primarySkill));

    expect(tradeOffers.length).toBeGreaterThan(0);
    expect(tradeOffers).toHaveLength(unlockedSkills.length);
    expect(tradeOffers.every((offer) => mapSkillToCoreTrack(offer.job.primarySkill) !== null)).toBe(true);
    expect(unlockedSkills.every((skillId) => offeredSkills.has(skillId))).toBe(true);
  });

  it("supplements stale boards with missing visible trades and hides locked stale trades", () => {
    const state = createInitialGameState(bundle, 22006);
    grantAllTools(state);
    for (const track of CORE_TRADE_SKILLS) {
      state.tradeProgress.unlocked[track] = false;
    }
    state.tradeProgress.unlocked.electrician = true;
    state.tradeProgress.unlocked.painter = true;
    const electricianJob = bundle.jobs.find((job) => job.primarySkill === "electrician");
    const painterJob = bundle.jobs.find((job) => job.primarySkill === "painter");
    const carpenterJob = bundle.jobs.find((job) => job.primarySkill === "carpenter");
    if (!electricianJob || !painterJob || !carpenterJob) {
      throw new Error("Expected electrician, painter, and carpenter jobs in bundle.");
    }
    state.contractBoard = [
      { contractId: "stored-electrician", jobId: electricianJob.id, districtId: electricianJob.districtId, payoutMult: 1, expiresDay: state.day },
      { contractId: "stale-carpenter", jobId: carpenterJob.id, districtId: carpenterJob.districtId, payoutMult: 1, expiresDay: state.day }
    ];

    const offers = getAvailableContractOffers(state, bundle);
    const tradeOffers = offers.filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));
    const offeredSkills = new Set(tradeOffers.map((offer) => offer.job.primarySkill));

    expect(offeredSkills.has("electrician")).toBe(true);
    expect(offeredSkills.has("painter")).toBe(true);
    expect(offeredSkills.has("carpenter")).toBe(false);
    expect(tradeOffers.filter((offer) => offer.job.primarySkill === "electrician")).toHaveLength(1);
  });

  it("adds newly unlocked visible trades immediately without rerolling stored offers", () => {
    const state = createInitialGameState(bundle, 22007);
    grantAllTools(state);
    for (const track of CORE_TRADE_SKILLS) {
      state.tradeProgress.unlocked[track] = false;
    }
    state.tradeProgress.unlocked.electrician = true;
    const electricianJob = bundle.jobs.find((job) => job.primarySkill === "electrician");
    if (!electricianJob) {
      throw new Error("Expected electrician job in bundle.");
    }
    state.contractBoard = [
      { contractId: "stored-electrician", jobId: electricianJob.id, districtId: electricianJob.districtId, payoutMult: 1, expiresDay: state.day }
    ];

    const beforeOffers = getAvailableContractOffers(state, bundle).filter(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g")
    );
    expect(beforeOffers.map((offer) => offer.job.primarySkill)).toEqual(["electrician"]);

    state.tradeProgress.unlocked.painter = true;

    const afterOffers = getAvailableContractOffers(state, bundle).filter(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g")
    );
    expect(afterOffers.some((offer) => offer.contract.contractId === "stored-electrician")).toBe(true);
    expect(afterOffers.some((offer) => offer.job.primarySkill === "painter")).toBe(true);
  });

  it("accepts a supplemental visible-trade contract by dynamic contract id", () => {
    const state = createInitialGameState(bundle, 22008);
    grantAllTools(state);
    for (const track of CORE_TRADE_SKILLS) {
      state.tradeProgress.unlocked[track] = false;
    }
    state.tradeProgress.unlocked.electrician = true;
    state.tradeProgress.unlocked.painter = true;
    const electricianJob = bundle.jobs.find((job) => job.primarySkill === "electrician");
    if (!electricianJob) {
      throw new Error("Expected electrician job in bundle.");
    }
    state.contractBoard = [
      { contractId: "stored-electrician", jobId: electricianJob.id, districtId: electricianJob.districtId, payoutMult: 1, expiresDay: state.day }
    ];

    const painterOffer = getAvailableContractOffers(state, bundle).find((offer) => offer.job.primarySkill === "painter");
    if (!painterOffer) {
      throw new Error("Expected supplemental painter offer.");
    }

    const accepted = acceptContract(state, bundle, painterOffer.contract.contractId);
    expect(accepted.notice).toBeUndefined();
    expect(accepted.nextState.activeJob?.jobId).toBe(painterOffer.job.id);
    expect(accepted.nextState.activeJob?.contractId).toBe(painterOffer.contract.contractId);
  });
});
