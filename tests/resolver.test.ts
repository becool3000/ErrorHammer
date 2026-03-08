import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift, applyBotPurchasesForNextDay, buyTool, repairTool } from "../src/core/resolver";
import { load as loadSave, save as saveState } from "../src/core/save";
import { ActorState, ContractInstance } from "../src/core/types";
import { eventById, makeScenarioBundle } from "./scenario_helpers";

describe("resolver", () => {
  it("creates a v7 initial state with bot careers and parity baseline", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 99);

    expect(state.saveVersion).toBe(7);
    expect(state.activeJob).toBeNull();
    expect(state.workday.weekday).toBe("Monday");
    expect(state.player.fuel).toBeGreaterThan(0);
    expect(state.botCareers.length).toBe(state.bots.length);
    expect(state.botCareers[0]?.actor.cash).toBe(state.player.cash);
    expect(state.botCareers[0]?.actor.reputation).toBe(state.player.reputation);
    expect(Object.values(state.botCareers[0]?.actor.skills ?? {}).every((xp) => xp === 0)).toBe(true);
    expect(Object.keys(state.botCareers[0]?.actor.tools ?? {})).toHaveLength(0);
  });

  it("advances to the next day deterministically and syncs actor snapshots from careers", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 99);

    const first = endShift(state, bundle);
    const second = endShift(state, bundle);

    expect(first.digest).toBe(second.digest);
    expect(first.nextState.day).toBe(2);
    expect(first.nextState.workday.weekday).toBe("Tuesday");
    expect(first.nextState.botCareers.length).toBe(first.nextState.bots.length);
    expect(first.nextState.bots[0]?.cash).toBe(first.nextState.botCareers[0]?.actor.cash);
    expect(first.nextState.bots[0]?.reputation).toBe(first.nextState.botCareers[0]?.actor.reputation);
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

  it("legacy bot purchase helper remains deterministic and side-effect free", () => {
    const bundle = makeScenarioBundle();
    const bot: ActorState = {
      actorId: "doug",
      name: "Doug",
      companyName: "Doug",
      cash: 200,
      reputation: 0,
      companyLevel: 1,
      districtUnlocks: ["residential"],
      staminaMax: 2,
      stamina: 2,
      fuel: 8,
      fuelMax: 40,
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
    expect(result.purchaseLogs).toEqual([]);
    expect(result.bots[0]).toBeDefined();
    expect(result.bots[0]).toEqual(bot);
  });

  it("applies one-time stagnation recovery after three flat rep days", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 102);
    state.day = 3;
    state.player.reputation = 0;
    state.log = [
      { day: 1, actorId: state.player.actorId, message: "Collected fail payment: cash +0, rep -2." },
      { day: 2, actorId: state.player.actorId, message: "Collected neutral payment: cash +10, rep 0." },
      { day: 3, actorId: state.player.actorId, message: "Collected fail payment: cash +0, rep -1." }
    ];

    const first = endShift(state, bundle);
    expect(first.nextState.player.reputation).toBe(3);
    expect(first.nextState.log.some((entry) => entry.message.includes("Stagnation recovery applied"))).toBe(true);

    const second = endShift(first.nextState, bundle);
    expect(second.nextState.player.reputation).toBeGreaterThanOrEqual(3);
    expect(second.nextState.log.filter((entry) => entry.message.includes("Stagnation recovery applied")).length).toBe(1);
  });

  it("rejects v6 saves and loads v7 saves with bot careers", () => {
    const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;
    const store = new Map<string, string>();

    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key)
      },
      configurable: true
    });

    try {
      const bundle = makeScenarioBundle();
      const state = createInitialGameState(bundle, 103);
      store.set("error-hammer-save-v2", JSON.stringify({ ...state, saveVersion: 6 }));
      expect(loadSave()).toBeNull();

      saveState(state);
      const loaded = loadSave();
      expect(loaded?.saveVersion).toBe(7);
      expect(loaded?.botCareers.length).toBe(state.botCareers.length);
    } finally {
      if (originalLocalStorage === undefined) {
        Reflect.deleteProperty(globalThis, "localStorage");
      } else {
        Object.defineProperty(globalThis, "localStorage", {
          value: originalLocalStorage,
          configurable: true
        });
      }
    }
  });
});
