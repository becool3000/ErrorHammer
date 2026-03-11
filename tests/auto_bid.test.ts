import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { createInitialGameState } from "../src/core/resolver";
import { DAY_LABOR_CONTRACT_ID, getAvailableContractOffers, getContractAutoBidPreview } from "../src/core/playerFlow";
import { CORE_TRADE_SKILLS } from "../src/core/tradeProgress";

const bundle = loadContentBundle();

function buildBidState(seed: number) {
  const state = createInitialGameState(bundle, seed, "James", "The Company");
  for (const track of CORE_TRADE_SKILLS) {
    state.tradeProgress.unlocked[track] = true;
  }
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
  return state;
}

describe("auto bid", () => {
  it("is deterministic for the same seed/state/contract", () => {
    const state = buildBidState(8101);
    const contractId = getAvailableContractOffers(state, bundle).find(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g")
    )?.contract.contractId;
    if (!contractId) {
      throw new Error("Expected a non-Baba contract offer.");
    }

    const first = getContractAutoBidPreview(state, bundle, contractId);
    const second = getContractAutoBidPreview(state, bundle, contractId);
    expect(first).toEqual(second);
    expect(first?.acceptedPayout ?? 0).toBeGreaterThan(0);
  });

  it("higher estimating level narrows bid band and reduces average drift", () => {
    let lowDriftTotal = 0;
    let highDriftTotal = 0;
    let samples = 0;

    for (let seed = 8110; seed < 8210; seed += 1) {
      const lowState = buildBidState(seed);
      const contractId = getAvailableContractOffers(lowState, bundle).find(
        (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g")
      )?.contract.contractId;
      if (!contractId) {
        continue;
      }

      const highState = buildBidState(seed);
      lowState.perks.corePerks.estimating = 0;
      highState.perks.corePerks.estimating = 8;

      const low = getContractAutoBidPreview(lowState, bundle, contractId);
      const high = getContractAutoBidPreview(highState, bundle, contractId);
      if (!low || !high) {
        continue;
      }

      expect(high.bidAccuracyBandPct).toBeLessThan(low.bidAccuracyBandPct);

      lowDriftTotal += Math.abs(low.autoBid - low.baseQuote) / Math.max(1, low.baseQuote);
      highDriftTotal += Math.abs(high.autoBid - high.baseQuote) / Math.max(1, high.baseQuote);
      samples += 1;
    }

    expect(samples).toBeGreaterThan(40);
    expect(highDriftTotal / samples).toBeLessThan(lowDriftTotal / samples);
  });

  it("higher negotiation level raises non-Baba base quote", () => {
    const lowState = buildBidState(8215);
    const contractId = getAvailableContractOffers(lowState, bundle).find(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g")
    )?.contract.contractId;
    if (!contractId) {
      throw new Error("Expected a non-Baba contract offer.");
    }

    const highState = buildBidState(8215);
    lowState.perks.corePerks.negotiation = 0;
    highState.perks.corePerks.negotiation = 6;

    const low = getContractAutoBidPreview(lowState, bundle, contractId);
    const high = getContractAutoBidPreview(highState, bundle, contractId);
    expect(low).toBeTruthy();
    expect(high).toBeTruthy();
    expect(high?.baseQuote ?? 0).toBeGreaterThan(low?.baseQuote ?? 0);
    expect(high?.negotiationLevel).toBe(6);
  });

  it("Baba contracts bypass auto-bid randomness and keep fixed quote path", () => {
    const state = buildBidState(8220);
    const baba = getAvailableContractOffers(state, bundle).find((offer) => offer.job.tags.includes("baba-g"));
    if (!baba) {
      throw new Error("Expected a Baba offer.");
    }

    const preview = getContractAutoBidPreview(state, bundle, baba.contract.contractId);
    expect(preview).toBeTruthy();
    expect(preview?.isBaba).toBe(true);
    expect(preview?.acceptedPayout).toBe(preview?.baseQuote);
    expect(preview?.autoBid).toBe(preview?.baseQuote);
    expect(preview?.bidAccuracyBandPct).toBe(0);
    expect(preview?.bidNoise).toBe(0);
  });
});
