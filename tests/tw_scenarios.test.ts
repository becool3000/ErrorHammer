import { describe, expect, it } from "vitest";
import { generateBotIntent } from "../src/core/bots";
import { getPayoutMultiplier, getRiskValue } from "../src/core/economy";
import { createInitialGameState, resolveDay } from "../src/core/resolver";
import { clear as clearSave, load as loadSave, save as saveState } from "../src/core/save";
import { ActorState, BotProfile, ContentBundle, GameState, Intent, Resolution } from "../src/core/types";
import { loadRawContent, loadSchemas, normalizeBundle, validateContent } from "../scripts/content_pipeline";

function makeTwBundle(): ContentBundle {
  return {
    tools: [
      {
        id: "hammer",
        name: "Hammer",
        tier: 1,
        price: 30,
        maxDurability: 6,
        tags: ["general"],
        flavor: {
          description: "Reliable impact.",
          quip_buy: "Purchased confidence.",
          quip_break: "Retired by physics."
        }
      },
      {
        id: "saw",
        name: "Saw",
        tier: 1,
        price: 40,
        maxDurability: 6,
        tags: ["general"],
        flavor: {
          description: "Straight cuts.",
          quip_buy: "Purchased sawdust.",
          quip_break: "Teeth are optional now."
        }
      },
      {
        id: "drill",
        name: "Drill",
        tier: 2,
        price: 80,
        maxDurability: 8,
        tags: ["electrical"],
        flavor: {
          description: "Very loud certainty.",
          quip_buy: "Purchased speed.",
          quip_break: "Only hums nostalgically."
        }
      }
    ],
    jobs: [
      {
        id: "job-alpha",
        name: "Porch Anchor",
        tier: 1,
        districtId: "residential",
        requiredTools: ["hammer"],
        staminaCost: 2,
        basePayout: 200,
        risk: 0,
        repGainSuccess: 4,
        repLossFail: 2,
        durabilityCost: 2,
        tags: ["outdoor", "general"],
        flavor: {
          client_quote: "Please make it less dramatic.",
          success_line: "The porch now trusts gravity.",
          fail_line: "The porch remains interpretive.",
          neutral_line: "The porch improved in committee-approved ways."
        }
      },
      {
        id: "job-beta",
        name: "Interior Trim",
        tier: 1,
        districtId: "residential",
        requiredTools: ["saw"],
        staminaCost: 2,
        basePayout: 140,
        risk: 0,
        repGainSuccess: 3,
        repLossFail: 1,
        durabilityCost: 2,
        tags: ["indoor", "finish"],
        flavor: {
          client_quote: "A straight line would be lovely.",
          success_line: "Trim achieved right angles.",
          fail_line: "Trim embraced modernism.",
          neutral_line: "Trim looked acceptable from the doorway."
        }
      }
    ],
    events: [
      {
        id: "event-mod",
        name: "Stormfront",
        weight: 1,
        mods: {
          payoutMultByTag: { outdoor: 0.5 },
          riskDeltaByTag: { outdoor: 0.25 }
        },
        flavor: {
          headline: "Weather Has Notes",
          detail: "Wind is participating.",
          impact_line: "Outdoor work is harder and pays less.",
          success_line: "Stormfront softened gracefully.",
          fail_line: "Stormfront did not negotiate.",
          neutral_line: "Stormfront happened and everyone adjusted."
        }
      },
      {
        id: "event-neutral",
        name: "Fog Belt",
        weight: 1,
        mods: {
          forceNeutralTags: ["outdoor"]
        },
        flavor: {
          headline: "Visibility Optional",
          detail: "Distance is now theoretical.",
          impact_line: "Outdoor jobs skew neutral.",
          success_line: "Fog was surprisingly kind.",
          fail_line: "Fog won this round.",
          neutral_line: "Fog encouraged modest expectations."
        }
      }
    ],
    districts: [
      {
        id: "residential",
        name: "Residential",
        tier: 1,
        flavor: {
          description: "Starter district."
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
        flavorLines: ["Doug bought two identical hammers to avoid favoritism."]
      }
    ],
    strings: {
      title: "Error Hammer",
      subtitle: "You did the work. The work happened.",
      continueMissing: "No save file.",
      dayReportTitle: "End of Day Report",
      storeTitle: "Store",
      companyTitle: "Company",
      assignmentHint: "Assign contracts.",
      noContracts: "No contracts.",
      neutralLogFallback: "The day resolved in a shrug."
    }
  };
}

function withSingleContract(state: GameState, jobId: string): GameState {
  return {
    ...state,
    contractBoard: [
      {
        contractId: `D${state.day}-C1-${jobId}`,
        jobId,
        districtId: "residential",
        payoutMult: 1,
        expiresDay: state.day
      }
    ],
    activeEventIds: []
  };
}

function singleContractId(state: GameState): string {
  return state.contractBoard[0]!.contractId;
}

function playerIntentFor(state: GameState): Intent {
  return {
    actorId: "player",
    day: state.day,
    assignments: [{ assignee: "self", contractId: singleContractId(state) }]
  };
}

function botIntentFor(state: GameState): Intent {
  return {
    actorId: "doug",
    day: state.day,
    assignments: [{ assignee: "self", contractId: singleContractId(state) }]
  };
}

function playerResolution(resolutions: Resolution[]): Resolution | undefined {
  return resolutions.find((resolution) => resolution.actorId === "player");
}

describe("TW-002 deterministic scenario suite", () => {
  it("EH-TW-001: same seed + same intents + same bundle yields identical digest and resolution fields", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 91), "job-alpha");
    const intents = [playerIntentFor(state)];

    const first = resolveDay(state, intents, bundle, 501);
    const second = resolveDay(state, intents, bundle, 501);

    expect(first.digest).toBe(second.digest);
    expect(first.resolutions).toEqual(second.resolutions);
    expect(first.dayLog).toEqual(second.dayLog);

    const resolution = playerResolution(first.resolutions)!;
    expect(resolution).toMatchObject({
      day: state.day,
      actorId: "player",
      contractId: singleContractId(state),
      outcome: "success",
      cashDelta: 200,
      repDelta: 4,
      staminaBefore: 4,
      staminaAfter: 2,
      toolDurabilityBefore: { hammer: 6 },
      toolDurabilityAfter: { hammer: 4 },
      logLine: "The porch now trusts gravity."
    });
  });

  it("EH-TW-002: different day seeds produce deterministic but potentially different valid outcomes", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 92), "job-alpha");
    state.player.reputation = 10;
    state.bots[0]!.reputation = 10;
    const intents = [playerIntentFor(state), botIntentFor(state)];

    const base = resolveDay(state, intents, bundle, 700);

    let differentSeed: number | null = null;
    for (let seed = 701; seed <= 850; seed += 1) {
      const candidate = resolveDay(state, intents, bundle, seed);
      if (candidate.digest !== base.digest) {
        differentSeed = seed;
        break;
      }
    }

    expect(differentSeed).not.toBeNull();
    const variant = resolveDay(state, intents, bundle, differentSeed!);
    const variantRepeat = resolveDay(state, intents, bundle, differentSeed!);

    expect(variant.digest).toBe(variantRepeat.digest);
    expect(variant.resolutions).toEqual(variantRepeat.resolutions);
    expect(variant.digest).not.toBe(base.digest);
    expect(variant.resolutions.every((entry) => ["success", "fail", "neutral", "lost"].includes(entry.outcome))).toBe(true);
  });

  it("EH-TW-003: assignment is rejected when stamina is insufficient", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 93), "job-alpha");
    state.player.stamina = 1;

    const result = resolveDay(state, [playerIntentFor(state)], bundle, 800);

    expect(playerResolution(result.resolutions)).toBeUndefined();
    expect(result.nextState.player.cash).toBe(state.player.cash);
    expect(result.dayLog.some((line) => line.actorId === "player" && line.message.includes("stamina was short"))).toBe(true);
  });

  it("EH-TW-004: assignment is rejected when required tool is missing", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 94), "job-beta");

    const result = resolveDay(state, [playerIntentFor(state)], bundle, 801);

    expect(playerResolution(result.resolutions)).toBeUndefined();
    expect(result.dayLog.some((line) => line.actorId === "player" && line.message.includes("missing usable tools"))).toBe(true);
  });

  it("EH-TW-005: tool durability decreases on successful tool use", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 95), "job-alpha");

    const result = resolveDay(state, [playerIntentFor(state)], bundle, 802);
    const resolution = playerResolution(result.resolutions)!;

    expect(resolution.outcome).toBe("success");
    expect(resolution.toolDurabilityBefore.hammer).toBe(6);
    expect(resolution.toolDurabilityAfter.hammer).toBe(4);
    expect(resolution.staminaBefore).toBe(4);
    expect(resolution.staminaAfter).toBe(2);
  });

  it("EH-TW-006: durability cannot drop below 0", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 96), "job-alpha");
    state.player.tools.hammer!.durability = 1;

    const result = resolveDay(state, [playerIntentFor(state)], bundle, 803);
    const resolution = playerResolution(result.resolutions)!;

    expect(resolution.toolDurabilityBefore.hammer).toBe(1);
    expect(resolution.toolDurabilityAfter.hammer).toBe(0);
    expect(resolution.toolDurabilityAfter.hammer).toBeGreaterThanOrEqual(0);
  });

  it("EH-TW-007: broken tools (durability 0) cannot satisfy job requirements", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 97), "job-alpha");
    state.player.tools.hammer!.durability = 0;

    const result = resolveDay(state, [playerIntentFor(state)], bundle, 804);

    expect(playerResolution(result.resolutions)).toBeUndefined();
    expect(result.dayLog.some((line) => line.actorId === "player" && line.message.includes("missing usable tools"))).toBe(true);
  });

  it("EH-TW-008: higher reputation wins contract conflicts", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 98), "job-alpha");
    state.player.reputation = 22;
    state.bots[0]!.reputation = 5;

    const result = resolveDay(state, [playerIntentFor(state), botIntentFor(state)], bundle, 900);
    const win = result.resolutions.find((entry) => entry.actorId === "player")!;
    const loss = result.resolutions.find((entry) => entry.actorId === "doug")!;

    expect(win.outcome).toBe("success");
    expect(win.winnerActorId).toBe("player");
    expect(win.cashDelta).toBe(200);
    expect(loss.outcome).toBe("lost");
    expect(loss.winnerActorId).toBe("player");
  });

  it("EH-TW-009: equal-reputation ties resolve deterministically for a fixed tie-break seed", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 99), "job-alpha");
    state.player.reputation = 11;
    state.bots[0]!.reputation = 11;
    const intents = [playerIntentFor(state), botIntentFor(state)];

    const first = resolveDay(state, intents, bundle, 901);
    const second = resolveDay(state, intents, bundle, 901);

    expect(first.resolutions).toEqual(second.resolutions);
    expect(first.resolutions.filter((entry) => entry.outcome === "lost")).toHaveLength(1);
    expect(first.resolutions.filter((entry) => entry.outcome !== "lost")).toHaveLength(1);
  });

  it("EH-TW-010: conflict loser spends no stamina and gets no cash or rep delta", () => {
    const bundle = makeTwBundle();
    const state = withSingleContract(createInitialGameState(bundle, 100), "job-alpha");
    state.player.reputation = 30;
    state.bots[0]!.reputation = 1;

    const result = resolveDay(state, [playerIntentFor(state), botIntentFor(state)], bundle, 902);
    const loser = result.resolutions.find((entry) => entry.actorId === "doug")!;

    expect(loser.outcome).toBe("lost");
    expect(loser.cashDelta).toBe(0);
    expect(loser.repDelta).toBe(0);
    expect(loser.staminaBefore).toBe(loser.staminaAfter);
    expect(loser.toolDurabilityBefore).toEqual(loser.toolDurabilityAfter);
  });

  it("EH-TW-011: event modifiers change payout multiplier and risk as defined", () => {
    const bundle = makeTwBundle();
    const job = bundle.jobs.find((entry) => entry.id === "job-alpha")!;
    const modEvent = bundle.events.find((entry) => entry.id === "event-mod")!;

    expect(getPayoutMultiplier(job, [modEvent])).toBe(0.5);
    expect(getRiskValue(job, [modEvent])).toBe(0.25);

    const state = withSingleContract(createInitialGameState(bundle, 101), "job-alpha");
    state.activeEventIds = ["event-mod"];

    let winningSeed = 903;
    let modded = resolveDay(state, [playerIntentFor(state)], bundle, winningSeed);
    let resolution = playerResolution(modded.resolutions)!;
    while (resolution.outcome !== "success" && winningSeed < 980) {
      winningSeed += 1;
      modded = resolveDay(state, [playerIntentFor(state)], bundle, winningSeed);
      resolution = playerResolution(modded.resolutions)!;
    }

    expect(resolution.outcome).toBe("success");
    expect(resolution.cashDelta).toBe(100);

    const noEventState = withSingleContract(createInitialGameState(bundle, 101), "job-alpha");
    const baseline = resolveDay(noEventState, [playerIntentFor(noEventState)], bundle, winningSeed);
    expect(playerResolution(baseline.resolutions)!.cashDelta).toBe(200);
  });

  it("EH-TW-012: schema validation fails when required flavor lines are missing", async () => {
    const [content, schemas] = await Promise.all([loadRawContent(), loadSchemas()]);
    const jobs = (content.jobs as Array<Record<string, unknown>>).map((job) => ({
      ...job,
      flavor: { ...((job.flavor as Record<string, unknown>) ?? {}) }
    }));
    delete (jobs[0]!.flavor as Record<string, unknown>).success_line;

    const result = validateContent({ ...content, jobs }, schemas);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("success_line"))).toBe(true);
  });

  it("EH-TW-013: normalized content bundle has expected keys and stable ordering", async () => {
    const [content, schemas] = await Promise.all([loadRawContent(), loadSchemas()]);
    const result = validateContent(content, schemas);

    expect(result.ok).toBe(true);

    const normalized = normalizeBundle(result.bundle!);
    expect(Object.keys(normalized).sort()).toEqual(["bots", "districts", "events", "jobs", "strings", "tools"]);

    const toolIds = normalized.tools.map((tool) => tool.id);
    const jobIds = normalized.jobs.map((job) => job.id);
    expect(toolIds).toEqual([...toolIds].sort((a, b) => a.localeCompare(b)));
    expect(jobIds).toEqual([...jobIds].sort((a, b) => a.localeCompare(b)));
    expect(normalizeBundle(normalized)).toEqual(normalized);
  });

  it("EH-TW-014: save/load round-trip preserves state", () => {
    const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;
    const store = new Map<string, string>();

    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      }
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true
    });

    try {
      const bundle = makeTwBundle();
      const state = withSingleContract(createInitialGameState(bundle, 102), "job-alpha");
      state.player.cash = 777;
      state.player.reputation = 33;

      saveState(state);
      const loaded = loadSave();
      expect(loaded).toEqual(state);

      clearSave();
      expect(loadSave()).toBeNull();
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

  it("EH-TW-015: bot intents obey stamina and tool availability gates", () => {
    const bundle = makeTwBundle();
    const profile: BotProfile = bundle.bots[0]!;

    const contracts = [
      {
        contractId: "C-fit",
        jobId: "job-alpha",
        districtId: "residential",
        payoutMult: 1,
        expiresDay: 1
      },
      {
        contractId: "C-miss",
        jobId: "job-beta",
        districtId: "residential",
        payoutMult: 1,
        expiresDay: 1
      }
    ];

    const brokenToolActor: ActorState = {
      actorId: "doug",
      name: "Doug",
      cash: 100,
      reputation: 0,
      companyLevel: 1,
      districtUnlocks: ["residential"],
      staminaMax: 4,
      stamina: 4,
      tools: {
        hammer: {
          toolId: "hammer",
          durability: 0
        }
      },
      crews: []
    };

    const lowStaminaActor: ActorState = {
      ...brokenToolActor,
      stamina: 1,
      tools: {
        hammer: {
          toolId: "hammer",
          durability: 3
        }
      }
    };

    const validActor: ActorState = {
      ...brokenToolActor,
      stamina: 2,
      tools: {
        hammer: {
          toolId: "hammer",
          durability: 3
        }
      }
    };

    expect(generateBotIntent(brokenToolActor, profile, contracts, bundle, 1, 10).assignments).toHaveLength(0);
    expect(generateBotIntent(lowStaminaActor, profile, contracts, bundle, 1, 10).assignments).toHaveLength(0);

    const valid = generateBotIntent(validActor, profile, contracts, bundle, 1, 10);
    expect(valid.assignments).toHaveLength(1);
    expect(valid.assignments[0]!.contractId).toBe("C-fit");
  });

  it("EH-TW-016: day report lines use required success/fail/neutral flavor text fields", () => {
    const baseBundle = makeTwBundle();

    const successState = withSingleContract(createInitialGameState(baseBundle, 103), "job-alpha");
    const successRun = resolveDay(successState, [playerIntentFor(successState)], baseBundle, 1001);
    const successResolution = playerResolution(successRun.resolutions)!;

    expect(successResolution.outcome).toBe("success");
    expect(successResolution.logLine).toBe("The porch now trusts gravity.");
    expect(successRun.dayLog.some((entry) => entry.message === "The porch now trusts gravity.")).toBe(true);

    const failBundle = makeTwBundle();
    const failJob = failBundle.jobs.find((entry) => entry.id === "job-alpha")!;
    failJob.risk = 0.95;

    const failState = withSingleContract(createInitialGameState(failBundle, 104), "job-alpha");
    let failRun = resolveDay(failState, [playerIntentFor(failState)], failBundle, 1002);
    let failResolution = playerResolution(failRun.resolutions)!;
    let failSeed = 1002;

    while (failResolution.outcome !== "fail" && failSeed < 1100) {
      failSeed += 1;
      failRun = resolveDay(failState, [playerIntentFor(failState)], failBundle, failSeed);
      failResolution = playerResolution(failRun.resolutions)!;
    }

    expect(failResolution.outcome).toBe("fail");
    expect(failResolution.logLine).toBe("The porch remains interpretive.");
    expect(failRun.dayLog.some((entry) => entry.message === "The porch remains interpretive.")).toBe(true);

    const neutralBundle = makeTwBundle();
    const neutralState = withSingleContract(createInitialGameState(neutralBundle, 105), "job-alpha");
    neutralState.activeEventIds = ["event-neutral"];

    const neutralRun = resolveDay(neutralState, [playerIntentFor(neutralState)], neutralBundle, 1101);
    const neutralResolution = playerResolution(neutralRun.resolutions)!;

    expect(neutralResolution.outcome).toBe("neutral");
    expect(neutralResolution.logLine).toBe("The porch improved in committee-approved ways.");
    expect(neutralRun.dayLog.some((entry) => entry.message === "The porch improved in committee-approved ways.")).toBe(true);
  });
});
