import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import {
  acceptContract,
  DAY_LABOR_CONTRACT_ID,
  getAvailableContractOffers,
  getCurrentTask,
  getSelfEsteemBand,
  getSelfEsteemStatusWord,
  normalizeGameState,
  performTaskUnit,
  prepareForNextDay,
  runRecoveryAction,
  shouldIgnoreLikelyLossWarning,
  resumeDeferredJob
} from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { TRADE_SKILLS } from "../src/core/types";

const bundle = loadContentBundle();

const QUALITY_DELTA = {
  excellent: 4,
  solid: 1,
  sloppy: -2,
  botched: -5
} as const;

function clampSelfEsteem(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function unlockAndEquip(state: ReturnType<typeof createInitialGameState>): void {
  state.research.babaUnlocked = true;
  for (const skillId of TRADE_SKILLS) {
    state.research.unlockedSkills[skillId] = true;
  }
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
}

function buildAcceptedDoWorkState(seed: number) {
  const state = createInitialGameState(bundle, seed, "Self", "Esteem Co");
  unlockAndEquip(state);
  const offer = getAvailableContractOffers(state, bundle).find((entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID);
  if (!offer) {
    throw new Error("Expected a non-day-labor contract.");
  }
  const accepted = acceptContract(state, bundle, offer.contract.contractId).nextState;
  if (!accepted.activeJob) {
    throw new Error("Expected active job after contract acceptance.");
  }
  const acceptedJob = bundle.jobs.find((job) => job.id === accepted.activeJob?.jobId) ?? bundle.babaJobs.find((job) => job.id === accepted.activeJob?.jobId);
  if (!acceptedJob) {
    throw new Error("Expected accepted job definition.");
  }
  accepted.activeJob.location = "job-site";
  accepted.activeJob.tasks = accepted.activeJob.tasks.map((task) => {
    if (
      task.taskId === "load_from_shop" ||
      task.taskId === "refuel_at_station" ||
      task.taskId === "travel_to_supplier" ||
      task.taskId === "checkout_supplies" ||
      task.taskId === "travel_to_job_site" ||
      task.taskId === "pickup_site_supplies"
    ) {
      return { ...task, completedUnits: task.requiredUnits };
    }
    if (task.taskId === "do_work") {
      return { ...task, completedUnits: 0 };
    }
    return task;
  });
  accepted.truckSupplies = {};
  for (const material of acceptedJob.materialNeeds) {
    accepted.truckSupplies[material.supplyId] = { medium: Math.max(material.quantity, 1) };
  }
  accepted.workday.availableTicks = 16;
  accepted.workday.ticksSpent = 0;
  return accepted;
}

describe("self esteem subsystem", () => {
  it("maps band boundaries and status words", () => {
    expect(getSelfEsteemBand(19)).toBe("shaken");
    expect(getSelfEsteemBand(20)).toBe("low");
    expect(getSelfEsteemBand(39)).toBe("low");
    expect(getSelfEsteemBand(40)).toBe("solid");
    expect(getSelfEsteemBand(69)).toBe("solid");
    expect(getSelfEsteemBand(70)).toBe("cocky");
    expect(getSelfEsteemBand(84)).toBe("cocky");
    expect(getSelfEsteemBand(85)).toBe("reckless");
    expect(getSelfEsteemStatusWord(12)).toBe("Shaken");
    expect(getSelfEsteemStatusWord(30)).toBe("Low");
    expect(getSelfEsteemStatusWord(55)).toBe("Solid");
    expect(getSelfEsteemStatusWord(74)).toBe("Cocky");
    expect(getSelfEsteemStatusWord(95)).toBe("Reckless");
  });

  it("initializes defaults and backfills legacy states missing self-esteem", () => {
    const state = createInitialGameState(bundle, 8101);
    expect(state.selfEsteem.currentSelfEsteem).toBe(50);
    expect(state.selfEsteem.dailySelfEsteemDrift).toBe(4);
    expect(state.selfEsteem.hasGrizzled).toBe(false);

    const legacy = { ...state } as Partial<typeof state>;
    delete (legacy as Record<string, unknown>).selfEsteem;
    const normalized = normalizeGameState(legacy);
    expect(normalized.selfEsteem.currentSelfEsteem).toBe(50);
    expect(normalized.selfEsteem.dailySelfEsteemDrift).toBe(4);
    expect(normalized.selfEsteem.lifetimeTimesAtZero).toBe(0);
    expect(normalized.selfEsteem.lifetimeTimesAtHundred).toBe(0);
    expect(normalized.selfEsteem.fullExtremeSwings).toBe(0);
    expect(normalized.selfEsteem.hasGrizzled).toBe(false);
  });

  it("applies deterministic task delta based on quality, rework, and fast do_work", () => {
    const state = buildAcceptedDoWorkState(8102);
    const before = state.selfEsteem.currentSelfEsteem;
    const result = performTaskUnit(state, bundle, "standard", false);
    const payload = result.payload;
    expect(payload).toBeTruthy();
    let expectedDelta = 0;
    if (payload?.timeOutcome === "rework") {
      expectedDelta += QUALITY_DELTA.botched - 3;
    } else {
      if (payload?.qualityOutcome) {
        expectedDelta += QUALITY_DELTA[payload.qualityOutcome];
      }
      if (payload?.taskId === "do_work" && payload.timeOutcome === "fast") {
        expectedDelta += 2;
      }
    }
    expect(result.nextState.selfEsteem.currentSelfEsteem).toBe(clampSelfEsteem(before + expectedDelta));
  });

  it("applies settlement, recovery, resume, and day-labor deltas", () => {
    const finishCheapState = buildAcceptedDoWorkState(8103);
    const finishCheapBefore = finishCheapState.selfEsteem.currentSelfEsteem;
    const armed = runRecoveryAction(finishCheapState, bundle, "finish_cheap");
    const settled = performTaskUnit(armed.nextState, bundle, "standard", false);
    const settlePayload = settled.payload;
    expect(settlePayload).toBeTruthy();
    let expectedSettleDelta = 0;
    if (settlePayload?.timeOutcome === "rework") {
      expectedSettleDelta += QUALITY_DELTA.botched - 3;
    } else {
      if (settlePayload?.qualityOutcome) {
        expectedSettleDelta += QUALITY_DELTA[settlePayload.qualityOutcome];
      }
      if (settlePayload?.taskId === "do_work" && settlePayload.timeOutcome === "fast") {
        expectedSettleDelta += 2;
      }
      if (settlePayload?.taskId === "collect_payment") {
        expectedSettleDelta += -2;
      }
    }
    expect(settled.nextState.selfEsteem.currentSelfEsteem).toBe(clampSelfEsteem(finishCheapBefore + expectedSettleDelta));

    const deferState = buildAcceptedDoWorkState(8104);
    const deferBefore = deferState.selfEsteem.currentSelfEsteem;
    const deferred = runRecoveryAction(deferState, bundle, "defer");
    expect(deferred.nextState.selfEsteem.currentSelfEsteem).toBe(clampSelfEsteem(deferBefore - 6));
    const deferredId = deferred.nextState.deferredJobs[0]?.deferredJobId;
    expect(deferredId).toBeTruthy();
    const resumed = resumeDeferredJob(deferred.nextState, deferredId!);
    expect(resumed.nextState.selfEsteem.currentSelfEsteem).toBe(clampSelfEsteem(deferred.nextState.selfEsteem.currentSelfEsteem + 3));

    const abandonState = buildAcceptedDoWorkState(8105);
    const abandonBefore = abandonState.selfEsteem.currentSelfEsteem;
    const abandoned = runRecoveryAction(abandonState, bundle, "abandon");
    expect(abandoned.nextState.selfEsteem.currentSelfEsteem).toBe(clampSelfEsteem(abandonBefore - 10));

    const dayLaborState = createInitialGameState(bundle, 8106);
    const dayLaborBefore = dayLaborState.selfEsteem.currentSelfEsteem;
    const dayLaborResult = acceptContract(dayLaborState, bundle, DAY_LABOR_CONTRACT_ID);
    expect(dayLaborResult.nextState.selfEsteem.currentSelfEsteem).toBe(clampSelfEsteem(dayLaborBefore + 5));
  });

  it("applies deterministic daily drift/event behavior and keeps Grizzled steadier", () => {
    const base = createInitialGameState(bundle, 8107);
    base.selfEsteem.currentSelfEsteem = 88;

    const first = prepareForNextDay(base);
    const second = prepareForNextDay(base);
    expect(first.selfEsteem.currentSelfEsteem).toBe(second.selfEsteem.currentSelfEsteem);
    expect(first.selfEsteem.lifetimeTimesAtZero).toBe(second.selfEsteem.lifetimeTimesAtZero);
    expect(first.selfEsteem.lifetimeTimesAtHundred).toBe(second.selfEsteem.lifetimeTimesAtHundred);

    const grizzled = createInitialGameState(bundle, 8107);
    grizzled.selfEsteem.currentSelfEsteem = 88;
    grizzled.selfEsteem.hasGrizzled = true;
    grizzled.selfEsteem.lifetimeTimesAtZero = 10;
    grizzled.selfEsteem.lifetimeTimesAtHundred = 10;
    const nextGrizzled = prepareForNextDay(grizzled);

    expect(Math.abs(nextGrizzled.selfEsteem.currentSelfEsteem - 50)).toBeLessThanOrEqual(Math.abs(first.selfEsteem.currentSelfEsteem - 50));
  });

  it("unlocks Grizzled from either trigger path during normalization", () => {
    const byExtremes = createInitialGameState(bundle, 8108);
    byExtremes.selfEsteem.lifetimeTimesAtZero = 10;
    byExtremes.selfEsteem.lifetimeTimesAtHundred = 10;
    byExtremes.selfEsteem.fullExtremeSwings = 0;
    byExtremes.selfEsteem.hasGrizzled = false;
    expect(normalizeGameState(byExtremes).selfEsteem.hasGrizzled).toBe(true);

    const bySwings = createInitialGameState(bundle, 8109);
    bySwings.selfEsteem.lifetimeTimesAtZero = 1;
    bySwings.selfEsteem.lifetimeTimesAtHundred = 1;
    bySwings.selfEsteem.fullExtremeSwings = 10;
    bySwings.selfEsteem.hasGrizzled = false;
    expect(normalizeGameState(bySwings).selfEsteem.hasGrizzled).toBe(true);
  });

  it("only allows likely-loss caution bypass in high self-esteem bands", () => {
    const low = createInitialGameState(bundle, 8110);
    low.selfEsteem.currentSelfEsteem = 35;
    expect(shouldIgnoreLikelyLossWarning(low, "loss-check-contract")).toBe(false);

    const solid = createInitialGameState(bundle, 8111);
    solid.selfEsteem.currentSelfEsteem = 55;
    expect(shouldIgnoreLikelyLossWarning(solid, "loss-check-contract")).toBe(false);

    let bypassSeen = false;
    for (let seed = 1; seed <= 300; seed += 1) {
      const reckless = createInitialGameState(bundle, seed);
      reckless.selfEsteem.currentSelfEsteem = 90;
      if (shouldIgnoreLikelyLossWarning(reckless, "loss-check-contract")) {
        bypassSeen = true;
        break;
      }
    }
    expect(bypassSeen).toBe(true);
  });

  it("retains current task readability after esteem changes", () => {
    const state = buildAcceptedDoWorkState(8112);
    const beforeTask = getCurrentTask(state);
    const next = performTaskUnit(state, bundle, "standard", false).nextState;
    expect(beforeTask?.taskId).toBe("do_work");
    expect(getCurrentTask(next)).toBeTruthy();
  });
});
