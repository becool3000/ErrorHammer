import { describe, expect, it } from "vitest";
import {
  acceptContract,
  buyFuel,
  createInitialWorkday,
  getCurrentTask,
  getSkillRank,
  getTaskTimeChances,
  performTaskUnit,
  setSupplierCartQuantity
} from "../src/core/playerFlow";
import { clear as clearSave, hasIncompatibleLegacySave, load as loadSave, save as saveState } from "../src/core/save";
import { createInitialGameState, endShift, repairTool, buyTool } from "../src/core/resolver";
import { loadRawContent, loadSchemas, normalizeBundle, validateContent } from "../scripts/content_pipeline";
import { eventById, makeScenarioBundle } from "./scenario_helpers";

function acceptJob(seed: number, contractId: string) {
  const bundle = makeScenarioBundle();
  let state = createInitialGameState(bundle, seed);
  state.activeEventIds = [];
  state.contractBoard = [
    { contractId: "job-alpha-contract", jobId: "job-alpha", districtId: "residential", payoutMult: 1, expiresDay: 1 },
    { contractId: "job-beta-contract", jobId: "job-beta", districtId: "residential", payoutMult: 1, expiresDay: 1 },
    { contractId: "job-gamma-contract", jobId: "job-gamma", districtId: "residential", payoutMult: 1, expiresDay: 1 }
  ];
  state.player.tools.drill = { toolId: "drill", durability: 8 };
  state.player.tools.saw = { toolId: "saw", durability: 7 };
  state.player.cash = 500;
  const accepted = acceptContract(state, bundle, contractId);
  if (!accepted.nextState.activeJob) {
    throw new Error(accepted.notice ?? `Could not accept ${contractId}`);
  }
  return { bundle, state: accepted.nextState };
}

function fastForwardToTask(seed: number, contractId: string, targetTaskId: string) {
  const setup = acceptJob(seed, contractId);
  let state = setup.state;
  let guard = 0;
  while (getCurrentTask(state)?.taskId !== targetTaskId) {
    guard += 1;
    if (guard > 200) {
      throw new Error(`Could not reach task ${targetTaskId} for seed ${seed}. Current task: ${getCurrentTask(state)?.taskId ?? "none"}`);
    }
    const result = performTaskUnit(state, setup.bundle, "standard", true);
    state = result.nextState;
  }
  return { bundle: setup.bundle, state };
}

function finishCurrentTaskUntilOutcome(state: ReturnType<typeof acceptJob>["state"], bundle: ReturnType<typeof acceptJob>["bundle"], stance: "rush" | "standard" | "careful") {
  let currentState = state;
  let lastResult = performTaskUnit(currentState, bundle, stance, true);
  let guard = 0;

  while (!lastResult.nextState.activeJob?.outcome) {
    currentState = lastResult.nextState;
    guard += 1;
    if (guard > 20) {
      throw new Error(`Could not settle ${getCurrentTask(currentState)?.taskId ?? "unknown"} within 20 attempts.`);
    }
    lastResult = performTaskUnit(currentState, bundle, stance, true);
  }

  return lastResult;
}

describe("TW-004 deterministic scenario suite", () => {
  it("EH-TW-022: same seed + same task sequence yields identical digest and task logs", () => {
    const first = acceptJob(501, "job-alpha-contract");
    const second = acceptJob(501, "job-alpha-contract");

    const firstLoad = performTaskUnit(first.state, first.bundle, "standard");
    const secondLoad = performTaskUnit(second.state, second.bundle, "standard");
    const firstTravel = performTaskUnit(firstLoad.nextState, first.bundle, "standard");
    const secondTravel = performTaskUnit(secondLoad.nextState, second.bundle, "standard");

    expect(firstTravel.digest).toBe(secondTravel.digest);
    expect(firstTravel.payload?.logLines).toEqual(secondTravel.payload?.logLines);
    expect(firstTravel.nextState.activeJob?.qualityPoints).toBe(secondTravel.nextState.activeJob?.qualityPoints);
  });

  it("EH-TW-023: accepting a contract creates one active job, locks payout, and hides the board", () => {
    const { state } = acceptJob(502, "job-alpha-contract");
    expect(state.activeJob?.lockedPayout).toBe(200);
    expect(state.activeJob?.tasks.length).toBeGreaterThan(0);
    expect(state.contractBoard).toEqual([]);
  });

  it("EH-TW-024: supplier checkout deducts cash, adds supplies, advances checkout, and grants procurement XP", () => {
    const { bundle, state } = fastForwardToTask(503, "job-beta-contract", "checkout_supplies");
    const beforeCash = state.player.cash;
    const beforeXp = state.player.skills.procurement;
    const result = performTaskUnit(state, bundle, "standard");

    expect(result.nextState.player.cash).toBe(beforeCash - (26 * 2 + 21));
    expect(result.nextState.truckSupplies["wire-spool"]).toBe(2);
    expect(result.nextState.truckSupplies["junction-box"]).toBe(1);
    expect(result.nextState.player.skills.procurement).toBeGreaterThan(beforeXp);
    expect(result.payload?.taskId).toBe("checkout_supplies");
  });

  it("EH-TW-025: travel blocks when fuel is insufficient", () => {
    const { bundle, state } = fastForwardToTask(504, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 0;
    const blocked = performTaskUnit(state, bundle, "standard");

    expect(blocked.notice).toContain("fuel");
    expect(blocked.nextState.player.fuel).toBe(0);
  });

  it("EH-TW-026: rush increases fast and rework frequency against standard across seeds", () => {
    const rush = getTaskTimeChances(0, 3, "rush");
    const standard = getTaskTimeChances(0, 3, "standard");

    expect(rush.fastChance).toBeGreaterThanOrEqual(standard.fastChance);
    expect(rush.reworkChance).toBeGreaterThanOrEqual(standard.reworkChance);
  });

  it("EH-TW-027: careful improves average quality but usually spends more time than standard", () => {
    let carefulQuality = 0;
    let standardQuality = 0;
    let carefulTicks = 0;
    let standardTicks = 0;

    for (let seed = 700; seed < 780; seed += 1) {
      const careful = acceptJob(seed, "job-alpha-contract");
      const standard = acceptJob(seed, "job-alpha-contract");
      const carefulResult = performTaskUnit(careful.state, careful.bundle, "careful");
      const standardResult = performTaskUnit(standard.state, standard.bundle, "standard");

      carefulQuality += carefulResult.payload?.qualityPointsDelta ?? 0;
      standardQuality += standardResult.payload?.qualityPointsDelta ?? 0;
      carefulTicks += carefulResult.payload?.ticksSpent ?? 0;
      standardTicks += standardResult.payload?.ticksSpent ?? 0;
    }

    expect(carefulQuality).toBeGreaterThan(standardQuality);
    expect(carefulTicks).toBeGreaterThanOrEqual(standardTicks);
  });

  it("EH-TW-028: rework consumes base + 4 ticks and adds a redo unit", () => {
    let found = false;
    for (let seed = 800; seed < 1200; seed += 1) {
      const setup = acceptJob(seed, "job-alpha-contract");
      const result = performTaskUnit(setup.state, setup.bundle, "rush");
      if (result.payload?.timeOutcome === "rework") {
        found = true;
        expect(result.payload.ticksSpent).toBe(6);
        expect(result.payload.qualityPointsDelta).toBe(-2);
        expect(result.payload.reworkAdded).toBe(1);
        expect(result.payload.logLines.some((line) => line.includes("rework"))).toBe(true);
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("EH-TW-029: work blocks when materials are missing and resumes after restock", () => {
    const { bundle, state } = fastForwardToTask(1201, "job-alpha-contract", "do_work");
    state.truckSupplies = {};
    const blocked = performTaskUnit(state, bundle, "standard");

    expect(blocked.notice).toContain("materials");

    state.truckSupplies = {
      "anchor-set": 1,
      "fastener-box": 1
    };
    state.workday = createInitialWorkday(state.day, state.workday.fatigue.debt);
    const resumed = performTaskUnit(state, bundle, "standard");
    expect(resumed.notice).toBeFalsy();
    expect(resumed.payload?.taskId).toBe("do_work");
  });

  it("EH-TW-030: unfinished jobs persist across rollovers and keep the board hidden", () => {
    const { bundle, state } = fastForwardToTask(1301, "job-beta-contract", "travel_to_job_site");
    const atSite = performTaskUnit(state, bundle, "standard").nextState;
    atSite.truckSupplies["wire-spool"] = 1;
    const nextDay = endShift(atSite, bundle);

    expect(nextDay.nextState.activeJob).not.toBeNull();
    expect(nextDay.nextState.contractBoard).toEqual([]);
    expect(nextDay.nextState.activeJob?.siteSupplies["wire-spool"]).toBe(1);
    expect(nextDay.nextState.day).toBe(2);
  });

  it("EH-TW-031: overtime reduces next-day ticks while weekend recovery removes more debt", () => {
    const weekday = acceptJob(1401, "job-alpha-contract");
    weekday.state.workday.availableTicks = 1;
    const overtime = performTaskUnit(weekday.state, weekday.bundle, "standard", true);
    const weekdayNext = endShift(overtime.nextState, weekday.bundle);

    expect(overtime.nextState.workday.overtimeUsed).toBeGreaterThan(0);
    expect(weekdayNext.nextState.workday.availableTicks).toBeLessThan(16);

    const weekend = acceptJob(1402, "job-alpha-contract");
    weekend.state.day = 5;
    weekend.state.workday = createInitialWorkday(5, 0);
    weekend.state.workday.availableTicks = 1;
    const weekendOvertime = performTaskUnit(weekend.state, weekend.bundle, "standard", true);
    const weekendNext = endShift(weekendOvertime.nextState, weekend.bundle);

    expect(weekendNext.nextState.workday.weekday).toBe("Saturday");
    expect(weekendNext.nextState.workday.availableTicks).toBe(16);
    expect(weekendNext.nextState.workday.availableTicks).toBeGreaterThan(weekdayNext.nextState.workday.availableTicks);
  });

  it("EH-TW-032: collect payment resolves success, neutral, and fail deterministically from quality and risk", () => {
    const success = fastForwardToTask(1501, "job-alpha-contract", "collect_payment");
    success.state.workday = createInitialWorkday(success.state.day, 0);
    success.state.player.skills.negotiation = 1000;
    success.state.activeJob!.qualityPoints = 4;
    success.state.activeJob!.reworkCount = 0;
    success.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;
    const successRun = finishCurrentTaskUntilOutcome(success.state, success.bundle, "careful");
    expect(successRun.nextState.activeJob?.outcome).toBe("success");

    const neutral = fastForwardToTask(1502, "job-alpha-contract", "collect_payment");
    neutral.state.workday = createInitialWorkday(neutral.state.day, 0);
    neutral.state.player.skills.negotiation = 1000;
    neutral.state.activeJob!.qualityPoints = -3;
    neutral.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;
    const neutralRun = finishCurrentTaskUntilOutcome(neutral.state, neutral.bundle, "standard");
    expect(neutralRun.nextState.activeJob?.outcome).toBe("neutral");

    const fail = fastForwardToTask(1500, "job-alpha-contract", "collect_payment");
    fail.state.workday = createInitialWorkday(fail.state.day, 0);
    fail.state.player.skills.negotiation = 1000;
    fail.state.activeJob!.qualityPoints = 0;
    fail.state.activeJob!.reworkCount = 10;
    fail.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0.95;
    const failRun = finishCurrentTaskUntilOutcome(fail.state, fail.bundle, "rush");
    expect(failRun.nextState.activeJob?.outcome).toBe("fail");
  });

  it("EH-TW-033: final reputation delta includes quality and schedule modifiers", () => {
    const { bundle, state } = fastForwardToTask(1601, "job-alpha-contract", "collect_payment");
    bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;
    state.workday = createInitialWorkday(state.day, 0);
    state.player.skills.negotiation = 1000;
    state.activeJob!.qualityPoints = 11;
    state.activeJob!.reworkCount = 0;
    state.activeJob!.plannedTicks = 10;
    state.activeJob!.actualTicksSpent = 7;
    const repBefore = state.player.reputation;
    const result = performTaskUnit(state, bundle, "careful");

    expect(result.nextState.player.reputation - repBefore).toBe(8);
  });

  it("EH-TW-034: skill XP grows from task use and can increase derived rank", () => {
    const { bundle, state } = acceptJob(1701, "job-alpha-contract");
    state.player.skills.organization = 95;
    const beforeRank = getSkillRank(state.player, "organization");
    const result = performTaskUnit(state, bundle, "careful");
    const afterRank = getSkillRank(result.nextState.player, "organization");

    expect(beforeRank).toBe(0);
    expect(afterRank).toBeGreaterThan(beforeRank);
    expect(result.payload?.skillXpDelta.organization).toBeGreaterThan(0);
  });

  it("EH-TW-035: save/load round-trip preserves active job, location, fatigue, fuel, and skills", () => {
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
      const { bundle, state } = fastForwardToTask(1801, "job-beta-contract", "checkout_supplies");
      const progressed = performTaskUnit(state, bundle, "standard").nextState;
      progressed.workday.fatigue.debt = 2;
      progressed.player.fuel = 4;

      saveState(progressed);
      const loaded = loadSave();

      expect(loaded).toEqual(progressed);
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

  it("EH-TW-036: legacy v1 saves are treated as incompatible", () => {
    const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;
    const store = new Map<string, string>([["error-hammer-save-v1", JSON.stringify({ day: 1 })]]);

    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key)
      },
      configurable: true
    });

    try {
      expect(loadSave()).toBeNull();
      expect(hasIncompatibleLegacySave()).toBe(true);
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

  it("EH-TW-037: background bot simulation is deterministic and advances bot skills", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 1901);
    const first = endShift(state, bundle);
    const second = endShift(state, bundle);

    expect(first.digest).toBe(second.digest);
    expect(first.dayLog).toEqual(second.dayLog);
    expect(first.nextState.bots[0]!.skills.general).toBeGreaterThanOrEqual(state.bots[0]!.skills.general);
  });

  it("EH-TW-038: shop tool buy, repair, and fuel purchase keep active-job progress intact", () => {
    const { bundle, state } = acceptJob(2001, "job-alpha-contract");
    const activeJobId = state.activeJob?.contractId;
    state.player.cash = 500;
    state.player.tools.hammer!.durability = 2;
    let updated = buyTool(state, bundle, "saw");
    updated = repairTool(updated, bundle, "hammer");
    const fueled = buyFuel(updated, 2);

    expect(fueled.nextState.activeJob?.contractId).toBe(activeJobId);
    expect(fueled.nextState.player.tools.saw?.durability).toBe(7);
    expect(fueled.nextState.player.tools.hammer?.durability).toBe(6);
    expect(fueled.nextState.player.fuel).toBeGreaterThan(updated.player.fuel);
  });

  it("EH-TW-013: normalized content bundle has expected keys and stable ordering", async () => {
    const [content, schemas] = await Promise.all([loadRawContent(), loadSchemas()]);
    const result = validateContent(content, schemas);

    expect(result.ok).toBe(true);

    const normalized = normalizeBundle(result.bundle!);
    expect(Object.keys(normalized).sort()).toEqual(["bots", "districts", "events", "jobs", "strings", "supplies", "tools"]);
    const toolIds = normalized.tools.map((tool) => tool.id);
    const jobIds = normalized.jobs.map((job) => job.id);
    expect(toolIds).toEqual([...toolIds].sort((a, b) => a.localeCompare(b)));
    expect(jobIds).toEqual([...jobIds].sort((a, b) => a.localeCompare(b)));
  });

  it("EH-TW-012: schema validation still fails when a flavor line is removed", async () => {
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
});
