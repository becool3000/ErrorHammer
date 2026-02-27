import { describe, expect, it } from "vitest";
import { generateContractBoard, getPayoutMultiplier, getRiskValue } from "../src/core/economy";
import { ContentBundle, EventDef, JobDef } from "../src/core/types";

const bundle: ContentBundle = {
  tools: [],
  jobs: [
    {
      id: "job-1",
      name: "Job 1",
      tier: 1,
      districtId: "residential",
      requiredTools: ["hammer"],
      staminaCost: 1,
      basePayout: 100,
      risk: 0.2,
      repGainSuccess: 1,
      repLossFail: 1,
      durabilityCost: 1,
      tags: ["outdoor"],
      flavor: {
        client_quote: "q",
        success_line: "s",
        fail_line: "f",
        neutral_line: "n"
      }
    },
    {
      id: "job-2",
      name: "Job 2",
      tier: 1,
      districtId: "residential",
      requiredTools: ["hammer"],
      staminaCost: 1,
      basePayout: 120,
      risk: 0.3,
      repGainSuccess: 1,
      repLossFail: 1,
      durabilityCost: 1,
      tags: ["outdoor"],
      flavor: {
        client_quote: "q",
        success_line: "s",
        fail_line: "f",
        neutral_line: "n"
      }
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

describe("economy", () => {
  it("generates deterministic contract boards", () => {
    const first = generateContractBoard(bundle, 1, 999, { count: 2 });
    const second = generateContractBoard(bundle, 1, 999, { count: 2 });
    expect(first).toEqual(second);
  });

  it("applies payout and risk modifiers from events", () => {
    const event: EventDef = {
      id: "rain",
      name: "Rain",
      weight: 1,
      mods: {
        payoutMultByTag: { outdoor: 0.9 },
        riskDeltaByTag: { outdoor: 0.1 }
      },
      flavor: {
        headline: "h",
        detail: "d",
        impact_line: "i",
        success_line: "s",
        fail_line: "f",
        neutral_line: "n"
      }
    };

    const job = bundle.jobs[0] as JobDef;
    expect(getPayoutMultiplier(job, [event])).toBeCloseTo(0.9, 3);
    expect(getRiskValue(job, [event])).toBeCloseTo(0.3, 3);
  });
});