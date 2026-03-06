import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { createInitialGameState } from "../src/core/resolver";
import { DAY_LABOR_CONTRACT_ID, acceptContract, getAvailableContractOffers, performTaskUnit, resumeDeferredJob, runRecoveryAction } from "../src/core/playerFlow";
import { CORE_TRADE_SKILLS } from "../src/core/tradeProgress";

const bundle = loadContentBundle();

function buildState(seed: number) {
  const state = createInitialGameState(bundle, seed, "James", "The Company");
  for (const track of CORE_TRADE_SKILLS) {
    state.tradeProgress.unlocked[track] = true;
  }
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
  return state;
}

function getTradeContractId(seed: number): string {
  const state = buildState(seed);
  const offer = getAvailableContractOffers(state, bundle).find(
    (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g")
  );
  if (!offer) {
    throw new Error("Expected non-day-labor contract.");
  }
  return offer.contract.contractId;
}

describe("contract files lifecycle", () => {
  it("creates an active contract file on accept with bid snapshot", () => {
    const state = buildState(8301);
    const contractId = getTradeContractId(8301);

    const accepted = acceptContract(state, bundle, contractId).nextState;
    expect(accepted.activeJob?.contractId).toBe(contractId);
    const file = accepted.contractFiles.find((entry) => entry.contractId === contractId);
    expect(file).toBeTruthy();
    expect(file?.status).toBe("active");
    expect(file?.acceptedPayout).toBe(accepted.activeJob?.lockedPayout);
    expect(file?.estimatedHoursAtAccept ?? 0).toBeGreaterThan(0);
  });

  it("tracks defer and resume status transitions", () => {
    const state = buildState(8302);
    const contractId = getTradeContractId(8302);
    const accepted = acceptContract(state, bundle, contractId).nextState;

    const deferred = runRecoveryAction(accepted, bundle, "defer").nextState;
    expect(deferred.activeJob).toBeNull();
    expect(deferred.deferredJobs.length).toBe(1);
    expect(deferred.contractFiles.find((entry) => entry.contractId === contractId)?.status).toBe("deferred");

    const deferredId = deferred.deferredJobs[0]?.deferredJobId;
    if (!deferredId) {
      throw new Error("Expected deferred job id.");
    }
    const resumed = resumeDeferredJob(deferred, deferredId).nextState;
    expect(resumed.activeJob?.contractId).toBe(contractId);
    expect(resumed.contractFiles.find((entry) => entry.contractId === contractId)?.status).toBe("active");
  });

  it("completes and closes contract file on collect payment; abandon closes as lost", () => {
    const state = buildState(8303);
    const contractId = getTradeContractId(8303);
    const accepted = acceptContract(state, bundle, contractId).nextState;
    if (!accepted.activeJob) {
      throw new Error("Expected active job.");
    }

    accepted.activeJob.tasks = accepted.activeJob.tasks.map((task) => {
      if (task.taskId === "collect_payment") {
        return { ...task, requiredUnits: 1, completedUnits: 0 };
      }
      if (task.taskId === "do_work") {
        return { ...task, requiredUnits: 1, completedUnits: 1 };
      }
      return { ...task, completedUnits: task.requiredUnits };
    });

    let collected = accepted;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      collected = performTaskUnit(collected, bundle, "careful", true).nextState;
      const status = collected.contractFiles.find((entry) => entry.contractId === contractId)?.status;
      if (status === "completed") {
        break;
      }
    }
    const completedFile = collected.contractFiles.find((entry) => entry.contractId === contractId);
    expect(completedFile?.status).toBe("completed");
    expect(completedFile?.dayClosed).toBe(collected.day);
    expect(completedFile?.actualHoursAtClose ?? 0).toBeGreaterThan(0);

    const stateTwo = buildState(8304);
    const contractTwo = getTradeContractId(8304);
    const acceptedTwo = acceptContract(stateTwo, bundle, contractTwo).nextState;
    const abandoned = runRecoveryAction(acceptedTwo, bundle, "abandon").nextState;
    const abandonedFile = abandoned.contractFiles.find((entry) => entry.contractId === contractTwo);
    expect(abandonedFile?.status).toBe("abandoned");
    expect(abandonedFile?.outcome).toBe("lost");
    expect(abandonedFile?.dayClosed).toBe(abandoned.day);
  });
});
