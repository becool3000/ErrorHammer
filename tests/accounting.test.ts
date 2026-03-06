import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { getAccountingSnapshot } from "../src/core/accounting";
import { createInitialGameState } from "../src/core/resolver";

const bundle = loadContentBundle();

describe("accounting snapshot", () => {
  it("aggregates income and expenses by category and job profit", () => {
    const state = createInitialGameState(bundle, 2201, "James", "The Company");
    state.log = [
      { day: 1, actorId: state.player.actorId, message: "Bought Saw for $45." },
      { day: 1, actorId: state.player.actorId, message: "Repaired Hammer for $18." },
      { day: 2, actorId: state.player.actorId, message: "Accepted Cafe Counter Shim for $160." },
      { day: 2, actorId: state.player.actorId, message: "Checked out supplies for $90." },
      { day: 2, actorId: state.player.actorId, message: "Bought 2 fuel for $12." },
      { day: 2, actorId: state.player.actorId, message: "Parts quality settled at Medium (+0 quality)." },
      { day: 2, actorId: state.player.actorId, message: "Collected success payment: cash +160, rep 4." },
      { day: 3, actorId: state.player.actorId, message: "James worked a day-labor shift for 8.0 hours and earned $58." },
      { day: 3, actorId: state.player.actorId, message: "Bill office rent: $18." },
      { day: 3, actorId: state.player.actorId, message: "Bill truck payment: $20." },
      { day: 3, actorId: state.player.actorId, message: "Bill electric: $6." },
      { day: 3, actorId: state.player.actorId, message: "Bill water/sewage: $5." },
      { day: 3, actorId: state.player.actorId, message: "Bill dumpster base: $4." },
      { day: 3, actorId: state.player.actorId, message: "Late fee applied: $6." },
      { day: 3, actorId: state.player.actorId, message: "Dumpster emptied for $28." },
      { day: 3, actorId: state.player.actorId, message: "Deferred carrying fees: $10 (2 jobs)." }
    ];
    state.player.cash = 256;

    const snapshot = getAccountingSnapshot(state);

    expect(snapshot.categories.toolExpense).toBe(45);
    expect(snapshot.categories.repairExpense).toBe(18);
    expect(snapshot.categories.supplyExpense).toBe(90);
    expect(snapshot.categories.fuelExpense).toBe(12);
    expect(snapshot.categories.payoutIncome).toBe(160);
    expect(snapshot.categories.dayLaborIncome).toBe(58);
    expect(snapshot.categories.officeRentExpense).toBe(18);
    expect(snapshot.categories.truckPaymentExpense).toBe(20);
    expect(snapshot.categories.electricExpense).toBe(6);
    expect(snapshot.categories.waterSewageExpense).toBe(5);
    expect(snapshot.categories.dumpsterBaseExpense).toBe(4);
    expect(snapshot.categories.lateFeeExpense).toBe(6);
    expect(snapshot.categories.dumpsterServiceExpense).toBe(28);
    expect(snapshot.categories.deferredCarryExpense).toBe(10);
    expect(snapshot.totalIncome).toBe(218);
    expect(snapshot.totalExpenses).toBe(262);
    expect(snapshot.netFromLogs).toBe(-44);
    expect(snapshot.cashDrift).toBe(0);
    expect(snapshot.jobRows[0]).toMatchObject({
      jobName: "Day Laborer",
      payout: 58,
      costs: 0,
      profit: 58,
      outcome: "success"
    });
    expect(snapshot.jobRows[1]).toMatchObject({
      jobName: "Cafe Counter Shim",
      payout: 160,
      costs: 102,
      profit: 58,
      outcome: "success",
      quality: "medium"
    });
  });

  it("reports untracked cash drift when older logs miss expenses", () => {
    const state = createInitialGameState(bundle, 2202);
    state.log = [{ day: 1, actorId: state.player.actorId, message: "Collected success payment: cash +100, rep 2." }];
    state.player.cash = 360;

    const snapshot = getAccountingSnapshot(state);
    expect(snapshot.netFromLogs).toBe(100);
    expect(snapshot.cashDrift).toBe(-40);
  });

  it("rolls accountant salary into expenses", () => {
    const state = createInitialGameState(bundle, 2203);
    state.log = [
      { day: 4, actorId: state.player.actorId, message: "Bill accountant salary: $12." },
      { day: 4, actorId: state.player.actorId, message: "Bill electric: $5." },
      { day: 4, actorId: state.player.actorId, message: "Bill water/sewage: $4." },
      { day: 4, actorId: state.player.actorId, message: "Bill dumpster base: $4." }
    ];
    state.player.cash = 275;

    const snapshot = getAccountingSnapshot(state);
    expect(snapshot.categories.accountantSalaryExpense).toBe(12);
    expect(snapshot.totalExpenses).toBe(25);
    expect(snapshot.netFromLogs).toBe(-25);
  });
});
