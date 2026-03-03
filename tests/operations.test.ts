import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift } from "../src/core/resolver";
import { loadContentBundle } from "../src/core/content";

const bundle = loadContentBundle();

function logIncludes(lines: string[], fragment: string): boolean {
  return lines.some((line) => line.includes(fragment));
}

describe("daily operations bills", () => {
  it("applies fixed bill components with company-level scaling", () => {
    const state = createInitialGameState(bundle, 9101);
    state.player.companyLevel = 3;
    state.player.cash = 1000;

    const result = endShift(state, bundle);
    const messages = result.dayLog.map((entry) => entry.message);

    expect(logIncludes(messages, "Bill office rent: $22.")).toBe(true);
    expect(logIncludes(messages, "Bill truck payment: $24.")).toBe(true);
    expect(logIncludes(messages, "Bill electric: $7.")).toBe(true);
    expect(logIncludes(messages, "Bill water/sewage: $6.")).toBe(true);
    expect(logIncludes(messages, "Bill dumpster base: $5.")).toBe(true);
    expect(logIncludes(messages, "Daily bills total: $64.")).toBe(true);
    expect(result.nextState.player.cash).toBe(936);
  });

  it("applies accountant utility discount and salary line deterministically", () => {
    const state = createInitialGameState(bundle, 9102);
    state.player.cash = 1000;
    state.operations.accountantHired = true;

    const result = endShift(state, bundle);
    const messages = result.dayLog.map((entry) => entry.message);

    expect(logIncludes(messages, "Bill electric: $5.")).toBe(true);
    expect(logIncludes(messages, "Bill water/sewage: $4.")).toBe(true);
    expect(logIncludes(messages, "Bill dumpster base: $4.")).toBe(true);
    expect(logIncludes(messages, "Bill accountant salary: $12.")).toBe(true);
    expect(logIncludes(messages, "Accountant utility discount: -$2.")).toBe(true);
    expect(logIncludes(messages, "Daily bills total: $63.")).toBe(true);
    expect(result.nextState.player.cash).toBe(937);
  });

  it("charges late fee when cash is negative after bills and clamps rep at zero", () => {
    const state = createInitialGameState(bundle, 9103);
    state.player.cash = 0;
    state.player.reputation = 1;

    const result = endShift(state, bundle);
    const messages = result.dayLog.map((entry) => entry.message);

    expect(logIncludes(messages, "Daily bills total: $53.")).toBe(true);
    expect(logIncludes(messages, "Late fee applied: $6.")).toBe(true);
    expect(logIncludes(messages, "Credit strain rep -1.")).toBe(true);
    expect(result.nextState.player.cash).toBe(-59);
    expect(result.nextState.player.reputation).toBe(0);
  });
});
