import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { applyEndDayOperations } from "../src/core/operations";
import { createInitialGameState } from "../src/core/resolver";
import {
  DAY_LABOR_CONTRACT_ID,
  acceptContract,
  getContractActualSnapshot,
  getAvailableContractOffers,
  getCurrentTask,
  performTaskUnit,
  runRecoveryAction,
  resumeDeferredJob
} from "../src/core/playerFlow";
import { TRADE_SKILLS } from "../src/core/types";

const bundle = loadContentBundle();

function buildAcceptedDoWorkState(seed: number) {
  const game = createInitialGameState(bundle, seed, "James", "The Company");
  game.research.babaUnlocked = true;
  for (const skillId of TRADE_SKILLS) {
    game.research.unlockedSkills[skillId] = true;
  }
  for (const tool of bundle.tools) {
    game.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }

  const offer = getAvailableContractOffers(game, bundle).find((entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID);
  if (!offer) {
    throw new Error("Expected a non-day-labor offer.");
  }
  const accepted = acceptContract(game, bundle, offer.contract.contractId).nextState;
  if (!accepted.activeJob) {
    throw new Error("Expected active job after contract accept.");
  }

  accepted.workday.availableTicks = 16;
  accepted.workday.ticksSpent = 0;
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
      return { ...task, requiredUnits: Math.max(1, task.requiredUnits), completedUnits: 0 };
    }
    return task;
  });

  return accepted;
}

describe("recovery actions", () => {
  it("finish cheap forces neutral settlement at 70% payout with rep -1", () => {
    const state = buildAcceptedDoWorkState(5501);
    const beforeRep = state.player.reputation;
    const lockedPayout = state.activeJob?.lockedPayout ?? 0;
    const contractId = state.activeJob?.contractId ?? "";

    const armed = runRecoveryAction(state, bundle, "finish_cheap");
    expect(armed.nextState.activeJob?.recoveryMode).toBe("finish_cheap");
    expect(getCurrentTask(armed.nextState)?.taskId).toBe("collect_payment");

    const settled = performTaskUnit(armed.nextState, bundle, "standard", false);
    expect(settled.nextState.activeJob?.outcome).toBe("neutral");
    const actual = getContractActualSnapshot(settled.nextState, contractId);
    expect(actual?.payout).toBe(Math.round(lockedPayout * 0.7));
    expect(settled.nextState.player.reputation).toBe(Math.max(0, beforeRep - 1));
    expect(settled.nextState.log.some((entry) => entry.message.includes("Finish Cheap"))).toBe(true);
  });

  it("defer enqueues job with fee and resume restores exact active job", () => {
    const state = buildAcceptedDoWorkState(5502);
    const beforeCash = state.player.cash;
    const beforeContractId = state.activeJob?.contractId;

    const deferred = runRecoveryAction(state, bundle, "defer");
    expect(deferred.nextState.activeJob).toBeNull();
    expect(deferred.nextState.deferredJobs.length).toBe(1);
    expect(deferred.nextState.player.cash).toBe(beforeCash - 20);

    const deferredId = deferred.nextState.deferredJobs[0]?.deferredJobId;
    expect(deferredId).toBeTruthy();

    const resumed = resumeDeferredJob(deferred.nextState, deferredId!);
    expect(resumed.nextState.deferredJobs.length).toBe(0);
    expect(resumed.nextState.activeJob?.contractId).toBe(beforeContractId);
  });

  it("deferred jobs charge daily carry and expire after 7 days", () => {
    const state = buildAcceptedDoWorkState(5503);
    const deferred = runRecoveryAction(state, bundle, "defer").nextState;
    const cashAfterDefer = deferred.player.cash;
    const repBefore = deferred.player.reputation;

    const withCarry = { ...deferred, day: deferred.day + 1 };
    const carryResult = applyEndDayOperations(withCarry);
    expect(withCarry.player.cash).toBe(cashAfterDefer - 5);
    expect(carryResult.dayLog.some((entry) => entry.message.includes("Deferred carrying fees"))).toBe(true);

    const withExpiry = {
      ...deferred,
      day: deferred.deferredJobs[0]!.deferredAtDay + 7,
      player: { ...deferred.player, skills: { ...deferred.player.skills }, tools: { ...deferred.player.tools }, crews: [...deferred.player.crews] },
      deferredJobs: deferred.deferredJobs.map((entry) => ({ ...entry, activeJob: { ...entry.activeJob } }))
    };
    const expiryResult = applyEndDayOperations(withExpiry);

    expect(withExpiry.deferredJobs.length).toBe(0);
    expect(withExpiry.player.reputation).toBe(Math.max(0, repBefore - 1));
    expect(expiryResult.dayLog.some((entry) => entry.message.includes("Deferred job expired"))).toBe(true);
  });

  it("abandon clears active job with balanced penalties", () => {
    const state = buildAcceptedDoWorkState(5504);
    const beforeCash = state.player.cash;
    const beforeRep = state.player.reputation;

    const abandoned = runRecoveryAction(state, bundle, "abandon").nextState;
    expect(abandoned.activeJob).toBeNull();
    expect(abandoned.player.cash).toBe(beforeCash - 40);
    expect(abandoned.player.reputation).toBe(Math.max(0, beforeRep - 2));
  });
});
