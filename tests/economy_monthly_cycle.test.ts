import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift } from "../src/core/resolver";
import { loadContentBundle } from "../src/core/content";

const bundle = loadContentBundle();

describe("economy monthly cycle", () => {
  it("charges lump-sum due on cycle day 22 and clears strikes on full payment", () => {
    const state = createInitialGameState(bundle, 9801);
    state.player.cash = 1200;
    state.operations.billingCycleDay = 21;
    state.operations.unpaidBalance = 100;
    state.operations.missedBillStrikes = 1;

    const result = endShift(state, bundle);

    expect(result.nextState.operations.billingCycleDay).toBe(22);
    expect(result.nextState.operations.unpaidBalance).toBe(0);
    expect(result.nextState.operations.missedBillStrikes).toBe(0);
    expect(result.nextState.player.cash).toBe(490);
  });

  it("carries unpaid with late fee when payment is short", () => {
    const state = createInitialGameState(bundle, 9802);
    state.player.cash = 150;
    state.operations.billingCycleDay = 21;

    const result = endShift(state, bundle);

    expect(result.nextState.player.cash).toBe(0);
    expect(result.nextState.operations.unpaidBalance).toBe(495);
    expect(result.nextState.operations.missedBillStrikes).toBe(1);
    expect(result.dayLog.some((entry) => entry.message.includes("Late fee applied: $35."))).toBe(true);
  });
});
