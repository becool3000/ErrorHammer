import { describe, expect, it } from "vitest";
import { createInitialGameState, resolveDay } from "../src/core/resolver";
import { ContentBundle, GameState, Intent } from "../src/core/types";

function makeBundle(): ContentBundle {
  return {
    tools: [
      {
        id: "hammer",
        name: "Hammer",
        tier: 1,
        price: 10,
        maxDurability: 5,
        tags: ["general"],
        flavor: {
          description: "desc",
          quip_buy: "buy",
          quip_break: "break"
        }
      },
      {
        id: "saw",
        name: "Saw",
        tier: 1,
        price: 10,
        maxDurability: 5,
        tags: ["general"],
        flavor: {
          description: "desc",
          quip_buy: "buy",
          quip_break: "break"
        }
      }
    ],
    jobs: [
      {
        id: "job-a",
        name: "Job A",
        tier: 1,
        districtId: "residential",
        requiredTools: ["hammer"],
        staminaCost: 2,
        basePayout: 120,
        risk: 0,
        repGainSuccess: 5,
        repLossFail: 1,
        durabilityCost: 2,
        tags: ["outdoor"],
        flavor: {
          client_quote: "quote",
          success_line: "success",
          fail_line: "fail",
          neutral_line: "neutral"
        }
      },
      {
        id: "job-b",
        name: "Job B",
        tier: 1,
        districtId: "residential",
        requiredTools: ["saw"],
        staminaCost: 2,
        basePayout: 130,
        risk: 0,
        repGainSuccess: 4,
        repLossFail: 2,
        durabilityCost: 3,
        tags: ["outdoor"],
        flavor: {
          client_quote: "quote",
          success_line: "success",
          fail_line: "fail",
          neutral_line: "neutral"
        }
      }
    ],
    events: [
      {
        id: "event-a",
        name: "Event A",
        weight: 1,
        mods: {},
        flavor: {
          headline: "h",
          detail: "d",
          impact_line: "i",
          success_line: "s",
          fail_line: "f",
          neutral_line: "n"
        }
      }
    ],
    districts: [
      {
        id: "residential",
        name: "Residential",
        tier: 1,
        flavor: {
          description: "desc"
        }
      }
    ],
    bots: [
      {
        id: "doug",
        name: "Doug",
        weights: {
          wCash: 1,
          wRep: 1,
          wRiskAvoid: 1,
          wToolBuy: 1
        },
        flavorLines: ["line"]
      }
    ],
    strings: {
      title: "Error Hammer",
      subtitle: "sub",
      continueMissing: "missing",
      dayReportTitle: "report",
      storeTitle: "store",
      companyTitle: "company",
      assignmentHint: "hint",
      noContracts: "none",
      neutralLogFallback: "fallback"
    }
  };
}

function withSingleContract(game: GameState, jobId: string): GameState {
  return {
    ...game,
    contractBoard: [
      {
        contractId: "D1-C1-1",
        jobId,
        districtId: "residential",
        payoutMult: 1,
        expiresDay: game.day
      }
    ],
    activeEventIds: []
  };
}

describe("resolver", () => {
  it("is deterministic for same seed + intents", () => {
    const bundle = makeBundle();
    const base = withSingleContract(createInitialGameState(bundle, 99), "job-a");
    const intents: Intent[] = [
      {
        actorId: "player",
        day: base.day,
        assignments: [{ assignee: "self", contractId: "D1-C1-1" }]
      }
    ];

    const first = resolveDay(base, intents, bundle, 123);
    const second = resolveDay(base, intents, bundle, 123);

    expect(first.digest).toBe(second.digest);
    expect(first.resolutions).toEqual(second.resolutions);
  });

  it("keeps stamina from going negative", () => {
    const bundle = makeBundle();
    const base = withSingleContract(createInitialGameState(bundle, 99), "job-a");
    base.player.stamina = 1;

    const result = resolveDay(
      base,
      [{ actorId: "player", day: base.day, assignments: [{ assignee: "self", contractId: "D1-C1-1" }] }],
      bundle,
      123
    );

    expect(result.resolutions.length).toBe(0);
    expect(result.nextState.player.stamina).toBeGreaterThanOrEqual(0);
  });

  it("enforces required tools", () => {
    const bundle = makeBundle();
    const base = withSingleContract(createInitialGameState(bundle, 99), "job-b");

    const result = resolveDay(
      base,
      [{ actorId: "player", day: base.day, assignments: [{ assignee: "self", contractId: "D1-C1-1" }] }],
      bundle,
      123
    );

    expect(result.resolutions.some((item) => item.actorId === "player" && item.outcome !== "lost")).toBe(false);
  });

  it("resolves conflicts by higher reputation", () => {
    const bundle = makeBundle();
    const base = withSingleContract(createInitialGameState(bundle, 99), "job-a");
    base.player.reputation = 20;
    base.bots[0]!.reputation = 5;

    const intents: Intent[] = [
      { actorId: "player", day: base.day, assignments: [{ assignee: "self", contractId: "D1-C1-1" }] },
      { actorId: "doug", day: base.day, assignments: [{ assignee: "self", contractId: "D1-C1-1" }] }
    ];

    const result = resolveDay(base, intents, bundle, 123);
    const playerResult = result.resolutions.find((item) => item.actorId === "player");
    const botResult = result.resolutions.find((item) => item.actorId === "doug");

    expect(playerResult?.outcome).toBe("success");
    expect(botResult?.outcome).toBe("lost");
  });

  it("resolves equal-reputation ties deterministically", () => {
    const bundle = makeBundle();
    const base = withSingleContract(createInitialGameState(bundle, 99), "job-a");
    base.player.reputation = 10;
    base.bots[0]!.reputation = 10;

    const intents: Intent[] = [
      { actorId: "player", day: base.day, assignments: [{ assignee: "self", contractId: "D1-C1-1" }] },
      { actorId: "doug", day: base.day, assignments: [{ assignee: "self", contractId: "D1-C1-1" }] }
    ];

    const first = resolveDay(base, intents, bundle, 777);
    const second = resolveDay(base, intents, bundle, 777);

    expect(first.resolutions).toEqual(second.resolutions);
  });

  it("does not reduce durability below zero", () => {
    const bundle = makeBundle();
    const base = withSingleContract(createInitialGameState(bundle, 99), "job-a");
    base.player.tools.hammer!.durability = 1;

    const result = resolveDay(
      base,
      [{ actorId: "player", day: base.day, assignments: [{ assignee: "self", contractId: "D1-C1-1" }] }],
      bundle,
      123
    );

    const resolution = result.resolutions.find((item) => item.actorId === "player");
    expect(resolution?.toolDurabilityAfter.hammer).toBeGreaterThanOrEqual(0);
  });
});