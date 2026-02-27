import { describe, expect, it } from "vitest";
import { generateBotIntent } from "../src/core/bots";
import { ActorState, BotProfile, ContentBundle, ContractInstance } from "../src/core/types";

const bundle: ContentBundle = {
  tools: [
    {
      id: "hammer",
      name: "Hammer",
      tier: 1,
      price: 10,
      maxDurability: 5,
      tags: ["general"],
      flavor: { description: "d", quip_buy: "b", quip_break: "k" }
    }
  ],
  jobs: [
    {
      id: "job-fit",
      name: "Job Fit",
      tier: 1,
      districtId: "residential",
      requiredTools: ["hammer"],
      staminaCost: 2,
      basePayout: 100,
      risk: 0.2,
      repGainSuccess: 1,
      repLossFail: 1,
      durabilityCost: 1,
      tags: ["outdoor"],
      flavor: { client_quote: "q", success_line: "s", fail_line: "f", neutral_line: "n" }
    },
    {
      id: "job-miss",
      name: "Job Miss",
      tier: 1,
      districtId: "residential",
      requiredTools: ["drill"],
      staminaCost: 2,
      basePayout: 200,
      risk: 0.2,
      repGainSuccess: 1,
      repLossFail: 1,
      durabilityCost: 1,
      tags: ["outdoor"],
      flavor: { client_quote: "q", success_line: "s", fail_line: "f", neutral_line: "n" }
    }
  ],
  events: [],
  districts: [
    {
      id: "residential",
      name: "Residential",
      tier: 1,
      flavor: { description: "desc" }
    }
  ],
  bots: [],
  strings: {
    title: "a",
    subtitle: "b",
    continueMissing: "c",
    dayReportTitle: "d",
    storeTitle: "e",
    companyTitle: "f",
    assignmentHint: "g",
    noContracts: "h",
    neutralLogFallback: "i"
  }
};

const contracts: ContractInstance[] = [
  {
    contractId: "c1",
    jobId: "job-fit",
    districtId: "residential",
    payoutMult: 1,
    expiresDay: 1
  },
  {
    contractId: "c2",
    jobId: "job-miss",
    districtId: "residential",
    payoutMult: 1,
    expiresDay: 1
  }
];

const profile: BotProfile = {
  id: "doug",
  name: "Doug",
  weights: {
    wCash: 1,
    wRep: 1,
    wRiskAvoid: 1,
    wToolBuy: 1
  },
  flavorLines: ["line"]
};

describe("bots", () => {
  it("obeys same tool and stamina gates", () => {
    const actor: ActorState = {
      actorId: "doug",
      name: "Doug",
      cash: 100,
      reputation: 0,
      companyLevel: 1,
      districtUnlocks: ["residential"],
      staminaMax: 2,
      stamina: 2,
      tools: {
        hammer: {
          toolId: "hammer",
          durability: 2
        }
      },
      crews: []
    };

    const intent = generateBotIntent(actor, profile, contracts, bundle, 1, 99);

    expect(intent.assignments.length).toBe(1);
    expect(intent.assignments[0]?.contractId).toBe("c1");
  });
});