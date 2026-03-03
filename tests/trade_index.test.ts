import { describe, expect, it } from "vitest";
import { getTradeIndexSnapshot } from "../src/core/tradeIndex";
import { createInitialGameState } from "../src/core/resolver";
import { ActorState, TRADE_SKILLS } from "../src/core/types";
import { makeScenarioBundle } from "./scenario_helpers";

function uniformSkills(xp: number): ActorState["skills"] {
  return Object.fromEntries(TRADE_SKILLS.map((skillId) => [skillId, xp])) as ActorState["skills"];
}

function cloneActor(base: ActorState, overrides: Partial<ActorState> & Pick<ActorState, "actorId" | "name">): ActorState {
  return {
    ...base,
    ...overrides,
    districtUnlocks: overrides.districtUnlocks ?? [...base.districtUnlocks],
    skills: overrides.skills ?? { ...base.skills },
    tools: overrides.tools ?? Object.fromEntries(Object.entries(base.tools).map(([toolId, tool]) => [toolId, { ...tool }])),
    crews: overrides.crews ?? base.crews.map((crew) => ({ ...crew }))
  };
}

describe("trade index snapshot", () => {
  it("builds deterministic ranking from composite score with tie-breakers", () => {
    const state = createInitialGameState(makeScenarioBundle(), 8101);
    const base = state.player;
    state.player = cloneActor(base, {
      actorId: "player",
      name: "Player",
      companyName: "Player Co",
      reputation: 20,
      cash: 200,
      skills: uniformSkills(150)
    });
    state.bots = [
      cloneActor(base, {
        actorId: "bot-a",
        name: "Bot A",
        companyName: "Bot A Co",
        reputation: 30,
        cash: 100,
        skills: uniformSkills(140)
      }),
      cloneActor(base, {
        actorId: "bot-b",
        name: "Bot B",
        companyName: "Bot B Co",
        reputation: 10,
        cash: 400,
        skills: uniformSkills(200)
      })
    ];

    const snapshot = getTradeIndexSnapshot(state);
    expect(snapshot.entries.map((entry) => entry.actorId)).toEqual(["bot-a", "player", "bot-b"]);
    expect(snapshot.entries.map((entry) => entry.compositeScore)).toEqual([50, 50, 50]);
    expect(snapshot.playerRank).toBe(2);
  });

  it("applies weighted composite scoring and preserves stable ordering for tied composites", () => {
    const state = createInitialGameState(makeScenarioBundle(), 8102);
    const base = state.player;
    state.player = cloneActor(base, {
      actorId: "player",
      name: "Player",
      companyName: "Player Co",
      reputation: 30,
      cash: 300,
      skills: uniformSkills(300)
    });
    state.bots = [
      cloneActor(base, {
        actorId: "rep-first",
        name: "Rep First",
        companyName: "Rep Co",
        reputation: 40,
        cash: 100,
        skills: uniformSkills(100)
      }),
      cloneActor(base, {
        actorId: "cash-first",
        name: "Cash First",
        companyName: "Cash Co",
        reputation: 10,
        cash: 400,
        skills: uniformSkills(400)
      }),
      cloneActor(base, {
        actorId: "middle",
        name: "Middle",
        companyName: "Middle Co",
        reputation: 20,
        cash: 200,
        skills: uniformSkills(200)
      })
    ];

    const snapshot = getTradeIndexSnapshot(state);
    expect(snapshot.entries.map((entry) => entry.actorId)).toEqual(["player", "rep-first", "cash-first", "middle"]);
    expect(snapshot.entries.map((entry) => entry.compositeScore)).toEqual([66.7, 50, 50, 33.3]);
  });

  it("uses actorId as deterministic fallback when all ranking metrics tie", () => {
    const state = createInitialGameState(makeScenarioBundle(), 8103);
    const base = state.player;
    state.player = cloneActor(base, {
      actorId: "player",
      name: "Player",
      reputation: 10,
      cash: 100,
      skills: uniformSkills(100)
    });
    state.bots = [
      cloneActor(base, {
        actorId: "alpha",
        name: "Alpha",
        reputation: 10,
        cash: 100,
        skills: uniformSkills(100)
      }),
      cloneActor(base, {
        actorId: "beta",
        name: "Beta",
        reputation: 10,
        cash: 100,
        skills: uniformSkills(100)
      })
    ];

    const snapshot = getTradeIndexSnapshot(state);
    expect(snapshot.entries.map((entry) => entry.actorId)).toEqual(["alpha", "beta", "player"]);
  });

  it("always returns a valid player rank inside the actor count bounds", () => {
    const state = createInitialGameState(makeScenarioBundle(), 8104);
    const snapshot = getTradeIndexSnapshot(state);
    expect(snapshot.totalActors).toBe(1 + state.bots.length);
    expect(snapshot.playerRank).toBeGreaterThanOrEqual(1);
    expect(snapshot.playerRank).toBeLessThanOrEqual(snapshot.totalActors);
  });

  it("handles negative cash values without crashing", () => {
    const state = createInitialGameState(makeScenarioBundle(), 8105);
    const base = state.player;
    state.player.cash = -50;
    state.bots = [
      cloneActor(base, {
        actorId: "debt-bot",
        name: "Debt Bot",
        companyName: "Debt Co",
        cash: -250,
        reputation: 8,
        skills: uniformSkills(120)
      })
    ];

    const snapshot = getTradeIndexSnapshot(state);
    const debtEntry = snapshot.entries.find((entry) => entry.actorId === "debt-bot");
    expect(debtEntry?.metrics.cash).toBe(-250);
    expect(Number.isFinite(debtEntry?.compositeScore)).toBe(true);
  });
});

