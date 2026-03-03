import { describe, expect, it } from "vitest";
import { evaluateBotPlan, generateBotIntent, getBotPreferredStance, simulateBotDay } from "../src/core/bots";
import { createInitialSkills } from "../src/core/playerFlow";
import { ActorState, BotProfile, ContractInstance } from "../src/core/types";
import { eventById, makeScenarioBundle } from "./scenario_helpers";

const bundle = makeScenarioBundle();
const contracts: ContractInstance[] = [
  {
    contractId: "c1",
    jobId: "job-alpha",
    districtId: "residential",
    payoutMult: 1,
    expiresDay: 1
  },
  {
    contractId: "c2",
    jobId: "job-beta",
    districtId: "residential",
    payoutMult: 1,
    expiresDay: 1
  }
];

const profile: BotProfile = bundle.bots[0]!;

function makeActor(): ActorState {
  return {
    actorId: "doug",
    name: "Doug",
    cash: 100,
    reputation: 0,
    companyLevel: 1,
    districtUnlocks: ["residential"],
    staminaMax: 4,
    stamina: 4,
    fuel: 8,
    fuelMax: 12,
    skills: {
      ...createInitialSkills(),
      electrician: 200,
      framer: 100
    },
    tools: {
      hammer: {
        toolId: "hammer",
        durability: 2
      },
      drill: {
        toolId: "drill",
        durability: 5
      }
    },
    crews: []
  };
}

describe("bots", () => {
  it("obeys tool gates and no longer limits assignments by stamina", () => {
    const actor = makeActor();
    actor.stamina = 2;

    const intent = generateBotIntent(actor, profile, contracts, bundle, 1, 99);

    expect(intent.assignments.length).toBe(2);
    expect(intent.assignments.map((entry) => entry.contractId)).toEqual(["c2", "c1"]);
  });

  it("evaluateBotPlan tie-noise off is deterministic and uses contract id tie-breaks", () => {
    const actor = makeActor();
    actor.skills.framer = 100;
    actor.skills.electrician = 100;
    actor.tools = {
      hammer: { toolId: "hammer", durability: 2 }
    };

    const tiedContracts: ContractInstance[] = [
      { contractId: "c-b", jobId: "job-alpha", districtId: "residential", payoutMult: 1, expiresDay: 1 },
      { contractId: "c-a", jobId: "job-alpha", districtId: "residential", payoutMult: 1, expiresDay: 1 }
    ];

    const first = evaluateBotPlan(actor, profile, tiedContracts, bundle, 1, 123, { tieNoise: false });
    const second = evaluateBotPlan(actor, profile, tiedContracts, bundle, 1, 999, { tieNoise: false });

    expect(first).toEqual(second);
    expect(first.assignments.map((item) => item.contractId)).toEqual(["c-a", "c-b"]);
  });

  it("simulates a deterministic background day and derives stance from bot weights", () => {
    const actor = makeActor();
    const event = eventById(bundle, "event-rain");

    const first = simulateBotDay(actor, profile, contracts, bundle, [event], 2, 700);
    const second = simulateBotDay(actor, profile, contracts, bundle, [event], 2, 700);

    expect(first.bot.cash).toBe(second.bot.cash);
    expect(first.bot.reputation).toBe(second.bot.reputation);
    expect(first.logLines).toEqual(second.logLines);
    expect(getBotPreferredStance(profile)).toBe("rush");
  });
});
