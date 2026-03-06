import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift } from "../src/core/resolver";
import { closeOfficeManually, closeYardManually } from "../src/core/operations";
import { loadContentBundle } from "../src/core/content";

const bundle = loadContentBundle();

describe("eviction and downgrade chain", () => {
  it("forces yard to office on second missed month", () => {
    const state = createInitialGameState(bundle, 9811);
    state.player.cash = 0;
    state.operations.billingCycleDay = 21;
    state.operations.missedBillStrikes = 1;
    state.operations.businessTier = "yard";
    state.operations.facilities.officeOwned = true;
    state.operations.facilities.yardOwned = true;
    state.operations.facilities.dumpsterEnabled = true;

    const result = endShift(state, bundle);

    expect(result.nextState.operations.businessTier).toBe("office");
    expect(result.nextState.operations.facilities.officeOwned).toBe(true);
    expect(result.nextState.operations.facilities.yardOwned).toBe(false);
    expect(result.nextState.operations.facilities.dumpsterEnabled).toBe(false);
    expect(result.nextState.yard.dumpsterUnits).toBe(0);
  });

  it("forces office to truck on second missed month", () => {
    const state = createInitialGameState(bundle, 9812);
    state.player.cash = 0;
    state.operations.billingCycleDay = 21;
    state.operations.missedBillStrikes = 1;
    state.operations.businessTier = "office";
    state.operations.facilities.officeOwned = true;
    state.operations.facilities.yardOwned = false;

    const result = endShift(state, bundle);

    expect(result.nextState.operations.businessTier).toBe("truck");
    expect(result.nextState.operations.facilities.officeOwned).toBe(false);
    expect(result.nextState.operations.facilities.yardOwned).toBe(false);
    expect(result.nextState.operations.facilities.dumpsterEnabled).toBe(false);
  });

  it("manual close uses the same hard reset behavior", () => {
    const yardState = createInitialGameState(bundle, 9813);
    yardState.operations.businessTier = "yard";
    yardState.operations.facilities.officeOwned = true;
    yardState.operations.facilities.yardOwned = true;
    yardState.operations.facilities.dumpsterEnabled = true;
    yardState.yard.dumpsterUnits = 22;

    const closeYard = closeYardManually(yardState);
    expect(closeYard.ok).toBe(true);
    expect(yardState.operations.businessTier).toBe("office");
    expect(yardState.operations.facilities.yardOwned).toBe(false);
    expect(yardState.operations.facilities.dumpsterEnabled).toBe(false);
    expect(yardState.yard.dumpsterUnits).toBe(0);

    const closeOffice = closeOfficeManually(yardState);
    expect(closeOffice.ok).toBe(true);
    expect(yardState.operations.businessTier).toBe("truck");
    expect(yardState.operations.facilities.officeOwned).toBe(false);
    expect(yardState.operations.facilities.yardOwned).toBe(false);
  });
});
