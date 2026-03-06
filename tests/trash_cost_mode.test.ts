import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/core/resolver";
import {
  DAY_LABOR_CONTRACT_ID,
  acceptContract,
  getAvailableContractOffers,
  performTaskUnit
} from "../src/core/playerFlow";
import { getDumpsterServiceCost, getPremiumHaulCost } from "../src/core/operations";
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

describe("trash cost modes", () => {
  it("uses deterministic premium and dumpster formulas", () => {
    expect(getPremiumHaulCost(0)).toBe(18);
    expect(getPremiumHaulCost(4)).toBe(30);
    expect(getDumpsterServiceCost(0)).toBe(95);
    expect(getDumpsterServiceCost(9)).toBe(122);
  });

  it("charges premium haul when dumpster service is not enabled", () => {
    const state = makeAcceptedTradeState(9821);
    const activeJob = state.activeJob!;

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
        return { ...task, completedUnits: task.requiredUnits };
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

    expect(current.log.some((entry) => entry.message.includes("Premium haul-off charged"))).toBe(true);
    expect(current.activeJob?.trashUnitsPending ?? 0).toBe(0);
  });
});
