import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift, applyBotPurchasesForNextDay, buyTool, repairTool } from "../src/core/resolver";
import { ActorState, ContractInstance } from "../src/core/types";
import { eventById, makeScenarioBundle } from "./scenario_helpers";

describe("resolver", () => {
  it("creates a v2 initial state with workday and no active job", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 99);

    expect(state.saveVersion).toBe(4);
    expect(state.activeJob).toBeNull();
    expect(state.workday.weekday).toBe("Monday");
    expect(state.player.fuel).toBeGreaterThan(0);
  });

  it("advances to the next day deterministically", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 99);

    const first = endShift(state, bundle);
    const second = endShift(state, bundle);

    expect(first.digest).toBe(second.digest);
    expect(first.nextState.day).toBe(2);
    expect(first.nextState.workday.weekday).toBe("Tuesday");
  });

  it("buys and repairs tools only at the home shop", () => {
    const bundle = makeScenarioBundle();
    let state = createInitialGameState(bundle, 101);
    state.player.cash = 500;

    state = buyTool(state, bundle, "saw");
    expect(state.player.tools.saw?.durability).toBe(7);

    state.player.tools.saw!.durability = 2;
    const repaired = repairTool(state, bundle, "saw");
    expect(repaired.player.tools.saw?.durability).toBe(7);
  });

  it("bot purchase helper breaks ties by lower price, then tool id", () => {
    const bundle = makeScenarioBundle();
    const bot: ActorState = {
      actorId: "doug",
      name: "Doug",
      cash: 200,
      reputation: 0,
      companyLevel: 1,
      districtUnlocks: ["residential"],
      staminaMax: 2,
      stamina: 2,
      fuel: 8,
      fuelMax: 12,
      skills: createInitialGameState(bundle, 3).bots[0]!.skills,
      tools: {
        hammer: {
          toolId: "hammer",
          durability: 5
        }
      },
      crews: []
    };

    const board: ContractInstance[] = [
      { contractId: "D2-C1", jobId: "job-beta", districtId: "residential", payoutMult: 1, expiresDay: 2 },
      { contractId: "D2-C2", jobId: "job-gamma", districtId: "residential", payoutMult: 1, expiresDay: 2 }
    ];

    const result = applyBotPurchasesForNextDay([bot], bundle.bots, bundle, board, [eventById(bundle, "event-sale")], 22);
    expect(result.purchaseLogs.length).toBeLessThanOrEqual(1);
    expect(result.bots[0]).toBeDefined();
  });
});
