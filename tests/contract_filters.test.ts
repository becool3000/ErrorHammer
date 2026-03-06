import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { createInitialGameState } from "../src/core/resolver";
import {
  DAY_LABOR_CONTRACT_ID,
  FUEL_PRICE,
  getAvailableContractOffers,
  getContractEstimateSnapshot,
  getFilteredContractOffers
} from "../src/core/playerFlow";
import { CORE_TRADE_SKILLS } from "../src/core/tradeProgress";

const bundle = loadContentBundle();

function buildFilterState(seed: number) {
  const state = createInitialGameState(bundle, seed, "James", "The Company");
  for (const track of CORE_TRADE_SKILLS) {
    state.tradeProgress.unlocked[track] = true;
  }
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }

  const firstTrade = getAvailableContractOffers(state, bundle).find(
    (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && offer.job.requiredTools.length > 0
  );
  if (firstTrade) {
    const firstTool = firstTrade.job.requiredTools[0]!;
    state.player.tools[firstTool] = { toolId: firstTool, durability: 0 };
  }

  return state;
}

describe("contract filters", () => {
  it("each filter enforces expected inclusion rules", () => {
    const state = buildFilterState(5601);

    const profitable = getFilteredContractOffers(state, bundle, ["profitable"]);
    for (const offer of profitable) {
      if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID) {
        continue;
      }
      const preview = getContractEstimateSnapshot(state, bundle, offer.contract.contractId);
      expect(preview?.projectedNetOnSuccess ?? -1).toBeGreaterThanOrEqual(0);
    }

    const lowRisk = getFilteredContractOffers(state, bundle, ["low-risk"]);
    for (const offer of lowRisk) {
      if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID) {
        continue;
      }
      expect(offer.job.risk).toBeLessThanOrEqual(0.25);
    }

    const nearRoute = getFilteredContractOffers(state, bundle, ["near-route"]);
    for (const offer of nearRoute) {
      if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID) {
        continue;
      }
      const preview = getContractEstimateSnapshot(state, bundle, offer.contract.contractId);
      expect(preview?.fuelCost ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(FUEL_PRICE * 2);
    }

    const noNewTools = getFilteredContractOffers(state, bundle, ["no-new-tools"]);
    for (const offer of noNewTools) {
      if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID) {
        continue;
      }
      expect(offer.job.requiredTools.every((toolId) => (state.player.tools[toolId]?.durability ?? 0) > 0)).toBe(true);
    }
  });

  it("combined filters use AND semantics", () => {
    const state = buildFilterState(5602);
    const filtered = getFilteredContractOffers(state, bundle, ["profitable", "low-risk", "near-route"]);

    for (const offer of filtered) {
      if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID) {
        continue;
      }
      const preview = getContractEstimateSnapshot(state, bundle, offer.contract.contractId);
      expect(preview?.projectedNetOnSuccess ?? -1).toBeGreaterThanOrEqual(0);
      expect(offer.job.risk).toBeLessThanOrEqual(0.25);
      expect(preview?.fuelCost ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(FUEL_PRICE * 2);
    }
  });
});
