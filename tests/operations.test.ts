import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift } from "../src/core/resolver";
import { loadContentBundle } from "../src/core/content";

const bundle = loadContentBundle();

function logIncludes(lines: string[], fragment: string): boolean {
  return lines.some((line) => line.includes(fragment));
}

describe("monthly operations bills", () => {
  it("applies truck-life monthly components on cycle day 22", () => {
    const state = createInitialGameState(bundle, 9101);
    state.player.cash = 1000;
    state.operations.billingCycleDay = 21;

    const result = endShift(state, bundle);
    const messages = result.dayLog.map((entry) => entry.message);

    expect(logIncludes(messages, "Billing cycle day 22/22.")).toBe(true);
    expect(logIncludes(messages, "Bill truck payment: $450.")).toBe(true);
    expect(logIncludes(messages, "Bill insurance/admin: $160.")).toBe(true);
    expect(logIncludes(messages, "Monthly operations subtotal: $610.")).toBe(true);
    expect(logIncludes(messages, "Monthly operations paid in full: $610.")).toBe(true);
    expect(result.nextState.player.cash).toBe(390);
    expect(result.nextState.operations.missedBillStrikes).toBe(0);
  });

  it("applies accountant utility discount and salary in monthly due", () => {
    const state = createInitialGameState(bundle, 9102);
    state.player.cash = 5000;
    state.operations.billingCycleDay = 21;
    state.operations.accountantHired = true;
    state.operations.facilities.officeOwned = true;
    state.operations.facilities.yardOwned = true;
    state.operations.facilities.dumpsterEnabled = true;
    state.operations.businessTier = "yard";

    const result = endShift(state, bundle);
    const messages = result.dayLog.map((entry) => entry.message);

    expect(logIncludes(messages, "Bill electric: $86.")).toBe(true);
    expect(logIncludes(messages, "Bill water/sewage: $38.")).toBe(true);
    expect(logIncludes(messages, "Bill dumpster base: $63.")).toBe(true);
    expect(logIncludes(messages, "Bill accountant salary: $480.")).toBe(true);
    expect(logIncludes(messages, "Monthly operations subtotal: $2487.")).toBe(true);
    expect(result.nextState.player.cash).toBe(2513);
  });

  it("records unpaid balance, late fee, and strike on short payment", () => {
    const state = createInitialGameState(bundle, 9103);
    state.player.cash = 200;
    state.operations.billingCycleDay = 21;
    state.player.reputation = 4;

    const result = endShift(state, bundle);
    const messages = result.dayLog.map((entry) => entry.message);

    expect(logIncludes(messages, "Monthly operations subtotal: $610.")).toBe(true);
    expect(logIncludes(messages, "Monthly operations partially paid: $200 on $610.")).toBe(true);
    expect(logIncludes(messages, "Late fee applied: $35.")).toBe(true);
    expect(logIncludes(messages, "Unpaid balance carried: $445.")).toBe(true);
    expect(result.nextState.operations.unpaidBalance).toBe(445);
    expect(result.nextState.operations.missedBillStrikes).toBe(1);
    expect(result.nextState.player.cash).toBe(0);
    expect(result.nextState.player.reputation).toBe(4);
  });
});
