import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift } from "../src/core/resolver";
import {
  DAY_LABOR_CONTRACT_ID,
  acceptContract,
  getAvailableContractOffers,
  getContractEstimateSnapshot,
  getCurrentTask,
  performTaskUnit
} from "../src/core/playerFlow";
import { loadContentBundle } from "../src/core/content";
import { GameState } from "../src/core/types";
import { CORE_TRADE_SKILLS } from "../src/core/tradeProgress";

const bundle = loadContentBundle();

function unlockAllTradeResearch(state: GameState): void {
  for (const track of CORE_TRADE_SKILLS) {
    state.tradeProgress.unlocked[track] = true;
  }
}

describe("stability + balance", () => {
  it("keeps low-risk trade previews mostly profitable in 30/60/100-day windows", () => {
    const windows = [30, 60, 100] as const;
    const seeds = [7101, 7102, 7103];

    for (const days of windows) {
      let totalLowRiskOffers = 0;
      let profitableLowRiskOffers = 0;
      let projectedNetTotal = 0;

      for (const seed of seeds) {
        let state = createInitialGameState(bundle, seed);
        unlockAllTradeResearch(state);

        for (let day = 1; day <= days; day += 1) {
          const lowRiskTradeOffers = getAvailableContractOffers(state, bundle).filter(
            (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g") && offer.job.risk <= 0.25
          );

          for (const offer of lowRiskTradeOffers) {
            const preview = getContractEstimateSnapshot(state, bundle, offer.contract.contractId);
            if (!preview) {
              continue;
            }
            totalLowRiskOffers += 1;
            projectedNetTotal += preview.projectedNetOnSuccess;
            if (preview.projectedNetOnSuccess >= 0) {
              profitableLowRiskOffers += 1;
            }
          }

          state = endShift(state, bundle).nextState;
        }
      }

      const profitableRate = profitableLowRiskOffers / Math.max(1, totalLowRiskOffers);
      const avgProjectedNet = projectedNetTotal / Math.max(1, totalLowRiskOffers);

      expect(totalLowRiskOffers).toBeGreaterThan(0);
      expect(profitableRate).toBeGreaterThanOrEqual(0.72);
      expect(avgProjectedNet).toBeGreaterThanOrEqual(15);
    }
  });

  it("does not allow zero-fuel refuel skip to complete the gas-station task", () => {
    const state = createInitialGameState(bundle, 7201);
    unlockAllTradeResearch(state);
    for (const tool of bundle.tools) {
      state.player.tools[tool.id] = {
        toolId: tool.id,
        durability: tool.maxDurability
      };
    }

    const tradeOffer = getAvailableContractOffers(state, bundle).find(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g") && offer.job.materialNeeds.length > 0
    );

    if (!tradeOffer) {
      throw new Error("Expected a trade offer with materials.");
    }

    state.player.fuel = 0;
    const accepted = acceptContract(state, bundle, tradeOffer.contract.contractId).nextState;
    const afterLoad = performTaskUnit(accepted, bundle, "standard", false).nextState;

    expect(getCurrentTask(afterLoad)?.taskId).toBe("refuel_at_station");
    expect(afterLoad.player.fuel).toBe(0);

    const skipAttempt = performTaskUnit(afterLoad, bundle, "standard", false);
    expect(skipAttempt.notice).toContain("Need at least 1 fuel before skipping refuel.");
    expect(skipAttempt.nextState).toBe(afterLoad);

    const rushAttempt = performTaskUnit(afterLoad, bundle, "rush", false);
    expect(rushAttempt.nextState).not.toBe(afterLoad);
    expect(getCurrentTask(rushAttempt.nextState)?.taskId).toBe("travel_to_supplier");
    expect(rushAttempt.nextState.player.fuel).toBeGreaterThanOrEqual(1);
  });
});
