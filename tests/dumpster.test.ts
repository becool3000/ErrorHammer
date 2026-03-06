import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/core/resolver";
import {
  DAY_LABOR_CONTRACT_ID,
  acceptContract,
  emptyDumpsterAtYard,
  getAvailableContractOffers,
  performTaskUnit
} from "../src/core/playerFlow";
import { CORE_TRADE_SKILLS } from "../src/core/tradeProgress";
import { loadContentBundle } from "../src/core/content";

const bundle = loadContentBundle();

function makeAcceptedTradeState(seed: number) {
  const state = createInitialGameState(bundle, seed);
  for (const track of CORE_TRADE_SKILLS) {
    state.tradeProgress.unlocked[track] = true;
  }
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }

  const offer = getAvailableContractOffers(state, bundle).find(
    (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g")
  );
  if (!offer) {
    throw new Error("Expected at least one trade offer");
  }

  const accepted = acceptContract(state, bundle, offer.contract.contractId);
  if (!accepted.nextState.activeJob) {
    throw new Error(accepted.notice ?? "Could not accept trade offer");
  }
  return accepted.nextState;
}

describe("yard dumpster flow", () => {
  it("assigns trash units to active job when payment is collected", () => {
    const state = makeAcceptedTradeState(9201);
    state.operations.facilities.dumpsterEnabled = true;
    const activeJob = state.activeJob!;
    const job = bundle.jobs.find((entry) => entry.id === activeJob.jobId)!;

    state.activeJob = {
      ...activeJob,
      location: "job-site",
      tasks: activeJob.tasks.map((task) => {
        if (task.taskId === "do_work") {
          return { ...task, completedUnits: task.requiredUnits };
        }
        if (task.taskId === "collect_payment") {
          return { ...task, requiredUnits: 1, completedUnits: 0 };
        }
        if (task.taskId !== "collect_payment") {
          return { ...task, completedUnits: task.requiredUnits };
        }
        return task;
      })
    };

    let current = state;
    for (let i = 0; i < 10; i += 1) {
      const step = performTaskUnit(current, bundle, "careful", true);
      current = step.nextState;
      if (current.activeJob?.outcome) {
        break;
      }
    }

    expect(current.activeJob?.outcome).toBeTruthy();
    expect(current.activeJob?.trashUnitsPending).toBe(job.trashUnits);
  });

  it("moves pending trash into yard dumpster during store leftovers", () => {
    const state = makeAcceptedTradeState(9202);
    state.operations.facilities.dumpsterEnabled = true;
    const activeJob = state.activeJob!;

    state.activeJob = {
      ...activeJob,
      location: "shop",
      trashUnitsPending: 7,
      tasks: activeJob.tasks.map((task) => {
        if (task.taskId === "store_leftovers") {
          return { ...task, requiredUnits: 1, completedUnits: 0 };
        }
        return { ...task, completedUnits: task.requiredUnits };
      })
    };

    const beforeDumpster = state.yard.dumpsterUnits;
    let current = state;
    for (let i = 0; i < 10; i += 1) {
      const step = performTaskUnit(current, bundle, "standard", true);
      current = step.nextState;
      if (!current.activeJob) {
        break;
      }
    }

    expect(current.activeJob).toBeNull();
    expect(current.yard.dumpsterUnits).toBe(beforeDumpster + 7);
  });

  it("blocks non-day-labor acceptance when dumpster is full", () => {
    const state = createInitialGameState(bundle, 9203);
    for (const track of CORE_TRADE_SKILLS) {
      state.tradeProgress.unlocked[track] = true;
    }
    for (const tool of bundle.tools) {
      state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
    }
    state.yard.dumpsterUnits = state.yard.dumpsterCapacity;
    state.operations.facilities.dumpsterEnabled = true;

    const offer = getAvailableContractOffers(state, bundle).find(
      (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g")
    );
    if (!offer) {
      throw new Error("Expected at least one trade offer");
    }

    const blocked = acceptContract(state, bundle, offer.contract.contractId);
    expect(blocked.nextState.activeJob).toBeNull();
    expect(blocked.notice).toMatch(/dumpster is full/i);
  });

  it("empties dumpster for exact service cost", () => {
    const state = createInitialGameState(bundle, 9204);
    state.operations.facilities.dumpsterEnabled = true;
    state.yard.dumpsterUnits = 10;
    state.player.cash = 300;

    const result = emptyDumpsterAtYard(state);

    expect(result.payload).toBe(125);
    expect(result.nextState.yard.dumpsterUnits).toBe(0);
    expect(result.nextState.yard.emptiesPerformed).toBe(1);
    expect(result.nextState.player.cash).toBe(175);
  });
});
