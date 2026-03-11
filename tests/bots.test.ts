import { describe, expect, it } from "vitest";
import { evaluateBotPlan, simulateBotCareerDay } from "../src/core/bots";
import { acceptContract } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { BotCareerState, GameState } from "../src/core/types";
import { makeScenarioBundle } from "./scenario_helpers";

function careerToGameState(career: BotCareerState, world: GameState): GameState {
  return {
    saveVersion: world.saveVersion,
    day: world.day,
    seed: world.seed,
    player: {
      ...career.actor,
      districtUnlocks: [...career.actor.districtUnlocks],
      skills: { ...career.actor.skills },
      tools: Object.fromEntries(Object.entries(career.actor.tools).map(([toolId, tool]) => [toolId, { ...tool }])),
      crews: career.actor.crews.map((crew) => ({ ...crew }))
    },
    bots: [],
    botCareers: [],
    contractBoard: career.contractBoard.map((entry) => ({ ...entry })),
    activeEventIds: [...world.activeEventIds],
    log: career.log.map((entry) => ({ ...entry })),
    activeJob: career.activeJob
      ? {
          ...career.activeJob,
          estimateAtAccept: { ...career.activeJob.estimateAtAccept },
          reservedMaterials: { ...career.activeJob.reservedMaterials },
          siteSupplies: { ...career.activeJob.siteSupplies },
          supplierCart: { ...career.activeJob.supplierCart },
          tasks: career.activeJob.tasks.map((task) => ({ ...task }))
        }
      : null,
    shopSupplies: { ...career.shopSupplies },
    truckSupplies: { ...career.truckSupplies },
    workday: {
      ...career.workday,
      fatigue: { ...career.workday.fatigue }
    },
    research: {
      ...career.research,
      unlockedCategories: { ...career.research.unlockedCategories },
      unlockedSkills: { ...career.research.unlockedSkills },
      activeProject: career.research.activeProject ? { ...career.research.activeProject } : null,
      completedProjectIds: [...career.research.completedProjectIds]
    },
    tradeProgress: {
      unlocked: { ...career.tradeProgress.unlocked },
      unlockedDay: { ...career.tradeProgress.unlockedDay }
    },
    officeSkills: { ...career.officeSkills },
    yard: { ...career.yard },
    operations: {
      ...career.operations,
      monthlyDueByCategory: { ...career.operations.monthlyDueByCategory },
      facilities: { ...career.operations.facilities }
    },
    perks: {
      ...career.perks,
      corePerks: { ...career.perks.corePerks },
      unlockedPerkTrees: { ...career.perks.unlockedPerkTrees }
    },
    selfEsteem: { ...career.selfEsteem },
    deferredJobs: career.deferredJobs.map((entry) => ({ ...entry })),
    contractFiles: career.contractFiles.map((entry) => ({ ...entry })),
    dayLaborHiddenUntilEndDay: world.dayLaborHiddenUntilEndDay
  };
}

function stateToCareer(state: GameState): BotCareerState {
  return {
    actor: {
      ...state.player,
      districtUnlocks: [...state.player.districtUnlocks],
      skills: { ...state.player.skills },
      tools: Object.fromEntries(Object.entries(state.player.tools).map(([toolId, tool]) => [toolId, { ...tool }])),
      crews: state.player.crews.map((crew) => ({ ...crew }))
    },
    activeJob: state.activeJob
      ? {
          ...state.activeJob,
          estimateAtAccept: { ...state.activeJob.estimateAtAccept },
          reservedMaterials: { ...state.activeJob.reservedMaterials },
          siteSupplies: { ...state.activeJob.siteSupplies },
          supplierCart: { ...state.activeJob.supplierCart },
          tasks: state.activeJob.tasks.map((task) => ({ ...task }))
        }
      : null,
    contractBoard: state.contractBoard.map((entry) => ({ ...entry })),
    log: state.log.map((entry) => ({ ...entry })),
    shopSupplies: { ...state.shopSupplies },
    truckSupplies: { ...state.truckSupplies },
    workday: {
      ...state.workday,
      fatigue: { ...state.workday.fatigue }
    },
    research: {
      ...state.research,
      unlockedCategories: { ...state.research.unlockedCategories },
      unlockedSkills: { ...state.research.unlockedSkills },
      activeProject: state.research.activeProject ? { ...state.research.activeProject } : null,
      completedProjectIds: [...state.research.completedProjectIds]
    },
    tradeProgress: {
      unlocked: { ...state.tradeProgress.unlocked },
      unlockedDay: { ...state.tradeProgress.unlockedDay }
    },
    officeSkills: { ...state.officeSkills },
    yard: { ...state.yard },
    operations: {
      ...state.operations,
      monthlyDueByCategory: { ...state.operations.monthlyDueByCategory },
      facilities: { ...state.operations.facilities }
    },
    perks: {
      ...state.perks,
      corePerks: { ...state.perks.corePerks },
      unlockedPerkTrees: { ...state.perks.unlockedPerkTrees }
    },
    selfEsteem: { ...state.selfEsteem },
    deferredJobs: state.deferredJobs.map((entry) => ({ ...entry })),
    contractFiles: state.contractFiles.map((entry) => ({ ...entry }))
  };
}

describe("competitor parity engine", () => {
  it("runs deterministic one-contract-per-day execution", () => {
    const bundle = makeScenarioBundle();
    const world = createInitialGameState(bundle, 1101);
    const profile = bundle.bots[0]!;
    const career = stateToCareer(careerToGameState(world.botCareers[0]!, world));
    career.actor.cash = 1200;
    career.actor.tools.hammer = { toolId: "hammer", durability: 6 };
    career.tradeProgress.unlocked.carpenter = true;
    career.tradeProgress.unlockedDay.carpenter = world.day;

    const first = simulateBotCareerDay(career, profile, world, bundle, {
      completedDay: world.day,
      sharedEventIds: world.activeEventIds,
      daySeed: 991
    });
    const second = simulateBotCareerDay(career, profile, world, bundle, {
      completedDay: world.day,
      sharedEventIds: world.activeEventIds,
      daySeed: 991
    });

    expect(first.career.actor.cash).toBe(second.career.actor.cash);
    expect(first.career.actor.reputation).toBe(second.career.actor.reputation);
    expect(first.dayLog).toEqual(second.dayLog);

    const acceptedCount = first.dayLog.filter((entry) => /^Accepted\s+/i.test(entry.message)).length;
    const dayLaborCount = first.dayLog.filter((entry) => /worked a day-labor shift/i.test(entry.message)).length;
    expect(acceptedCount + dayLaborCount).toBeLessThanOrEqual(1);
  });

  it("falls back to day labor when no viable unlocked trade can be accepted", () => {
    const bundle = makeScenarioBundle();
    const world = createInitialGameState(bundle, 1102);
    const profile = bundle.bots[0]!;
    const career = world.botCareers[0]!;
    career.actor.cash = 0;

    const plan = evaluateBotPlan(career, profile, world, bundle, 1001, { tieNoise: false });
    const simulated = simulateBotCareerDay(career, profile, world, bundle, {
      completedDay: world.day,
      sharedEventIds: world.activeEventIds,
      daySeed: 1001
    });

    expect(plan.usedDayLaborFallback).toBe(true);
    expect(simulated.plan?.usedDayLaborFallback).toBe(true);
    expect(simulated.dayLog.some((entry) => /day-labor shift/i.test(entry.message))).toBe(true);
    expect(simulated.career.contractFiles.length).toBe(0);
  });

  it("preserves active jobs across rollover and continues them the next day", () => {
    const bundle = makeScenarioBundle();
    const world = createInitialGameState(bundle, 1103);
    const profile = bundle.bots[0]!;
    let career = world.botCareers[0]!;
    career.actor.cash = 2000;
    career.actor.tools.hammer = { toolId: "hammer", durability: 6 };
    career.tradeProgress.unlocked.carpenter = true;
    career.tradeProgress.unlockedDay.carpenter = world.day;
    career.contractBoard = [
      {
        contractId: "bot-alpha-contract",
        jobId: "job-alpha",
        districtId: "residential",
        payoutMult: 1,
        expiresDay: world.day
      }
    ];

    const asState = careerToGameState(career, world);
    const accepted = acceptContract(asState, bundle, "bot-alpha-contract");
    expect(accepted.nextState.activeJob).not.toBeNull();
    const activeJob = accepted.nextState.activeJob!;
    const doWorkTask = activeJob.tasks.find((task) => task.taskId === "do_work");
    if (!doWorkTask) {
      throw new Error("Expected do_work task for active bot job.");
    }
    doWorkTask.requiredUnits += 30;
    const beforeUnits = doWorkTask.completedUnits;
    career = stateToCareer(accepted.nextState);

    const simulated = simulateBotCareerDay(career, profile, world, bundle, {
      completedDay: world.day,
      sharedEventIds: world.activeEventIds,
      daySeed: 1002
    });

    expect(simulated.career.activeJob).not.toBeNull();
    const progressedDoWork = simulated.career.activeJob?.tasks.find((task) => task.taskId === "do_work");
    expect((progressedDoWork?.completedUnits ?? 0) > beforeUnits || (simulated.career.activeJob?.actualTicksSpent ?? 0) > 0).toBe(true);
  });

  it("runs proactive manual gas-station top-up when active job fuel is low", () => {
    const bundle = makeScenarioBundle();
    const world = createInitialGameState(bundle, 1105);
    const profile = bundle.bots[0]!;
    let career = world.botCareers[0]!;
    career.actor.cash = 300;
    career.actor.fuel = 2;
    career.actor.oshaCanOwned = true;
    career.actor.tools.hammer = { toolId: "hammer", durability: 6 };
    career.tradeProgress.unlocked.carpenter = true;
    career.tradeProgress.unlockedDay.carpenter = world.day;
    career.contractBoard = [
      {
        contractId: "bot-alpha-contract",
        jobId: "job-alpha",
        districtId: "residential",
        payoutMult: 1,
        expiresDay: world.day
      }
    ];

    const asState = careerToGameState(career, world);
    const accepted = acceptContract(asState, bundle, "bot-alpha-contract");
    career = stateToCareer(accepted.nextState);

    const simulated = simulateBotCareerDay(career, profile, world, bundle, {
      completedDay: world.day,
      sharedEventIds: world.activeEventIds,
      daySeed: 1004
    });

    expect(simulated.dayLog.some((entry) => /Manual gas station run/i.test(entry.message))).toBe(true);
  });

  it("keeps zero-fuel bot recovery on rescue/day-labor path (no manual station at 0 fuel)", () => {
    const bundle = makeScenarioBundle();
    const world = createInitialGameState(bundle, 1106);
    const profile = bundle.bots[0]!;
    let career = world.botCareers[0]!;
    career.actor.cash = 0;
    career.actor.fuel = 1;
    career.actor.oshaCanOwned = false;
    career.actor.tools.hammer = { toolId: "hammer", durability: 6 };
    career.tradeProgress.unlocked.carpenter = true;
    career.tradeProgress.unlockedDay.carpenter = world.day;
    career.contractBoard = [
      {
        contractId: "bot-alpha-contract",
        jobId: "job-alpha",
        districtId: "residential",
        payoutMult: 1,
        expiresDay: world.day
      }
    ];

    const asState = careerToGameState(career, world);
    const accepted = acceptContract(asState, bundle, "bot-alpha-contract");
    if (!accepted.nextState.activeJob) {
      throw new Error("Expected bot active job for zero-fuel fallback test.");
    }
    const forcedZeroFuel = accepted.nextState;
    forcedZeroFuel.player.fuel = 0;
    forcedZeroFuel.player.cash = 0;
    const forcedActiveJob = forcedZeroFuel.activeJob;
    if (!forcedActiveJob) {
      throw new Error("Expected active job before forcing zero-fuel route.");
    }
    forcedZeroFuel.activeJob = {
      ...forcedActiveJob,
      location: "shop",
      tasks: forcedActiveJob.tasks.map((task) =>
        task.taskId === "load_from_shop" || task.taskId === "refuel_at_station"
          ? { ...task, completedUnits: task.requiredUnits || 1 }
          : task.taskId === "travel_to_supplier"
            ? { ...task, requiredUnits: 1, completedUnits: 0 }
            : task
      )
    };
    career = stateToCareer(forcedZeroFuel);

    const simulated = simulateBotCareerDay(career, profile, world, bundle, {
      completedDay: world.day,
      sharedEventIds: world.activeEventIds,
      daySeed: 1005
    });

    expect(simulated.dayLog.some((entry) => /day-labor shift/i.test(entry.message))).toBe(true);
    expect(simulated.dayLog.some((entry) => /Manual gas station run/i.test(entry.message))).toBe(false);
  });

  it("applies deterministic facility, research, and perk progression policies", () => {
    const bundle = makeScenarioBundle();
    const world = createInitialGameState(bundle, 1104);
    const profile = bundle.bots[0]!;
    const career = world.botCareers[0]!;
    career.actor.cash = 8000;
    career.actor.oshaCanOwned = true;
    career.perks.corePerkPoints = 2;

    const simulated = simulateBotCareerDay(career, profile, world, bundle, {
      completedDay: world.day,
      sharedEventIds: world.activeEventIds,
      daySeed: 1003
    });

    const facilities = simulated.career.operations.facilities;
    expect(facilities.storageOwned).toBe(true);
    expect(facilities.officeOwned).toBe(true);
    expect(facilities.yardOwned).toBe(true);
    expect(facilities.dumpsterEnabled).toBe(true);

    const openStorageIndex = simulated.dayLog.findIndex((entry) => /Opened storage/i.test(entry.message));
    const openOfficeIndex = simulated.dayLog.findIndex((entry) => /Opened office/i.test(entry.message));
    const openYardIndex = simulated.dayLog.findIndex((entry) => /Opened yard/i.test(entry.message));
    const enableDumpsterIndex = simulated.dayLog.findIndex((entry) => /Enabled dumpster service/i.test(entry.message));
    expect(openStorageIndex).toBeGreaterThanOrEqual(0);
    expect(openOfficeIndex).toBeGreaterThan(openStorageIndex);
    expect(openYardIndex).toBeGreaterThan(openOfficeIndex);
    expect(enableDumpsterIndex).toBeGreaterThan(openYardIndex);

    expect(simulated.career.research.activeProject?.projectId).toBe("rd-facility-office");
    expect(simulated.career.perks.corePerks.estimating).toBeGreaterThanOrEqual(2);
    expect(simulated.career.perks.corePerkPoints).toBe(0);
  });
});
