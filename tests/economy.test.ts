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
      workUnits: 4,
      materialNeeds: [{ supplyId: "anchor-set", quantity: 1 }],
      tags: ["outdoor", "general"],
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
      workUnits: 4,
      materialNeeds: [{ supplyId: "anchor-set", quantity: 1 }],
      tags: ["outdoor", "general"],
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
      travel: {
        shopToSiteTicks: 2,
        shopToSiteFuel: 1,
        supplierToSiteTicks: 2,
        supplierToSiteFuel: 1
      },
      flavor: { description: "desc" }
    }
  ],
  bots: [],
  supplies: [
    {
      id: "anchor-set",
      name: "Anchor Set",
      prices: { low: 8, medium: 10, high: 14 },
      tags: ["general"],
      flavor: { description: "d", quip_buy: "b" }
    }
  ],
  strings: {
    title: "a",
    subtitle: "b",
    continueMissing: "c",
    continueIncompatible: "d",
    dayReportTitle: "e",
    storeTitle: "f",
    companyTitle: "g",
    supplierTitle: "h",
    workdayTitle: "i",
    assignmentHint: "j",
    noContracts: "k",
    neutralLogFallback: "l",
    crewDeferred: "m",
    fuelLabel: "n",
    homeSuppliesTitle: "o",
    truckSuppliesTitle: "p",
    siteSuppliesTitle: "q",
    skillsTitle: "r",
    activeJobTitle: "s",
    boardTitle: "t",
    overtimeLabel: "u"
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
