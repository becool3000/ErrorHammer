import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { createInitialGameState } from "../src/core/resolver";
import { getContractActualSnapshot, getContractEstimateSnapshot, getJobProfitRecap } from "../src/core/playerFlow";

const bundle = loadContentBundle();

describe("profit recap snapshots", () => {
  it("computes deterministic actual snapshot and biggest cost driver from logs", () => {
    const state = createInitialGameState(bundle, 5701, "James", "The Company");
    const contractId = "recap-contract-001";

    state.log.push(
      { day: 3, actorId: state.player.actorId, contractId, message: "Accepted Mason Facade Patch for $180." },
      { day: 3, actorId: state.player.actorId, contractId, message: "Estimate at accept: Gross $180, Costs $90, Net +$90, Driver materials." },
      { day: 3, actorId: state.player.actorId, contractId, message: "Checked out supplies for $70." },
      { day: 3, actorId: state.player.actorId, contractId, message: "Refueled 2 at the gas station for $12." },
      { day: 3, actorId: state.player.actorId, contractId, message: "Premium haul-off charged $98 for 6 trash units." },
      { day: 3, actorId: state.player.actorId, contractId, message: "Collected success payment: cash +180, rep +2." }
    );

    const actual = getContractActualSnapshot(state, contractId);
    expect(actual).toMatchObject({
      payout: 180,
      materialsCost: 70,
      fuelCost: 12,
      trashCost: 98,
      totalCost: 180,
      net: 0,
      biggestCostDriver: "trash"
    });

    const recap = getJobProfitRecap(state, contractId);
    expect(recap).toBeTruthy();
    expect(recap?.jobName).toBe("Mason Facade Patch");
    expect(recap?.estimate.projectedNetOnSuccess).toBe(90);
    expect(recap?.summaryLine).toMatch(/Cost overrun: premium haul \/ trash/i);
    expect(recap?.deltaNet).toBe(-90);
    expect(recap?.estimatedHoursAtAccept ?? -1).toBeGreaterThanOrEqual(0);
    expect(recap?.actualHoursAtClose ?? -1).toBeGreaterThanOrEqual(0);
  });

  it("returns estimate snapshot for active contracts and null for missing contract", () => {
    const state = createInitialGameState(bundle, 5702, "James", "The Company");
    const offer = state.contractBoard[0];
    expect(offer).toBeTruthy();
    if (!offer) {
      throw new Error("Expected initial contract board offer.");
    }

    const snapshot = getContractEstimateSnapshot(state, bundle, offer.contractId);
    expect(snapshot).toBeTruthy();
    expect(snapshot?.grossPayout).toBeGreaterThanOrEqual(0);
    expect(getContractEstimateSnapshot(state, bundle, "missing-contract")).toBeNull();
  });
});
