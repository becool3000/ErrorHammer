import { describe, expect, it } from "vitest";
import { createInitialGameState, endShift, buyTool } from "../src/core/resolver";
import {
  DAY_LABOR_CONTRACT_ID,
  STARTER_TOOL_IDS,
  acceptContract,
  enableDumpsterService,
  getAvailableContractOffers,
  openStorage,
  performTaskUnit,
  upgradeBusinessTier
} from "../src/core/playerFlow";
import { loadContentBundle } from "../src/core/content";
import { GameState } from "../src/core/types";

const bundle = loadContentBundle();

const SECONDS_PER_DAY_LABOR_CLICK = 2;
const SECONDS_PER_END_DAY = 1;
const SECONDS_PER_OFFICE_ACTION = 2;
const SAFE_YARD_CAPITAL_TARGET = 4600;
const YARD_BUY_IN = 1600;
const DUMPSTER_ENABLE_COST = 500;

interface PaceResult {
  dayOffice: number | null;
  dayYard: number | null;
  dayDumpster: number | null;
  activeMinutes: number;
}

interface TradeUnlockResult {
  dayFirstTrade: number | null;
  activeMinutes: number;
}

interface BaselineSolvencyResult {
  cash: number;
  missedBillStrikes: number;
  tier: "truck" | "office" | "yard";
}

function progressStarterKitAndStorage(state: GameState): { nextState: GameState; actionSeconds: number } {
  let nextState = state;
  let actionSeconds = 0;

  for (const toolId of STARTER_TOOL_IDS) {
    if (nextState.player.tools[toolId]) {
      continue;
    }
    const updated = buyTool(nextState, bundle, toolId);
    if (updated === nextState) {
      break;
    }
    nextState = updated;
    actionSeconds += SECONDS_PER_OFFICE_ACTION;
  }

  if (!nextState.player.oshaCanOwned) {
    // Pacing model: include one deterministic action for first out-of-gas rescue can acquisition.
    nextState.player.oshaCanOwned = true;
    actionSeconds += SECONDS_PER_OFFICE_ACTION;
  }

  if (!nextState.operations.facilities.storageOwned) {
    const opened = openStorage(nextState, bundle);
    if (opened.nextState !== nextState) {
      nextState = opened.nextState;
      actionSeconds += SECONDS_PER_OFFICE_ACTION;
    }
  }

  return { nextState, actionSeconds };
}

function runFirstTradeUnlockPolicy(seed: number, maxDays = 40): TradeUnlockResult {
  let state = createInitialGameState(bundle, seed);
  let activeSeconds = 0;
  let dayFirstTrade: number | null = null;
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }

  while (state.day <= maxDays) {
    const offers = getAvailableContractOffers(state, bundle);
    const hasTradeOffer = offers.some((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));
    if (hasTradeOffer) {
      dayFirstTrade = state.day;
      break;
    }

    const babaOffer = offers.find((offer) => offer.job.tags.includes("baba-g"));
    if (babaOffer) {
      const accepted = acceptContract(state, bundle, babaOffer.contract.contractId);
      state = accepted.nextState;
      activeSeconds += SECONDS_PER_DAY_LABOR_CLICK;
      let guard = 0;
      while (state.activeJob && guard < 240) {
        const step = performTaskUnit(state, bundle, "standard", true);
        state = step.nextState;
        activeSeconds += 1;
        guard += 1;
      }
    } else {
      const labor = acceptContract(state, bundle, DAY_LABOR_CONTRACT_ID);
      state = labor.nextState;
      activeSeconds += SECONDS_PER_DAY_LABOR_CLICK;
    }

    const ended = endShift(state, bundle);
    state = ended.nextState;
    activeSeconds += SECONDS_PER_END_DAY;
  }

  return {
    dayFirstTrade,
    activeMinutes: activeSeconds / 60
  };
}

function runTruckBaselineSolvency(seed: number, days = 66): BaselineSolvencyResult {
  let state = createInitialGameState(bundle, seed);
  for (let index = 0; index < days; index += 1) {
    state = acceptContract(state, bundle, DAY_LABOR_CONTRACT_ID).nextState;
    state = endShift(state, bundle).nextState;
  }

  return {
    cash: state.player.cash,
    missedBillStrikes: state.operations.missedBillStrikes,
    tier: state.operations.businessTier
  };
}

function runLeanOfficePolicy(seed: number, maxDays = 180): PaceResult {
  let state = createInitialGameState(bundle, seed);
  let activeSeconds = 0;
  let dayOffice: number | null = null;
  let dayYard: number | null = null;
  let dayDumpster: number | null = null;

  while (state.day <= maxDays) {
    const starterProgress = progressStarterKitAndStorage(state);
    state = starterProgress.nextState;
    activeSeconds += starterProgress.actionSeconds;

    if (state.operations.businessTier === "truck" && state.operations.facilities.storageOwned) {
      const upgraded = upgradeBusinessTier(state, "office");
      if (upgraded.nextState !== state) {
        state = upgraded.nextState;
        dayOffice = dayOffice ?? state.day;
        activeSeconds += SECONDS_PER_OFFICE_ACTION;
      }
    }

    const labor = acceptContract(state, bundle, DAY_LABOR_CONTRACT_ID);
    state = labor.nextState;
    activeSeconds += SECONDS_PER_DAY_LABOR_CLICK;

    const ended = endShift(state, bundle);
    state = ended.nextState;
    activeSeconds += SECONDS_PER_END_DAY;

    if (state.operations.businessTier === "yard") {
      dayYard = dayYard ?? state.day;
    }
    if (state.operations.facilities.dumpsterEnabled) {
      dayDumpster = dayDumpster ?? state.day;
    }
  }

  return {
    dayOffice,
    dayYard,
    dayDumpster,
    activeMinutes: activeSeconds / 60
  };
}

function runSafeYardPolicy(seed: number, maxDays = 220): PaceResult {
  let state = createInitialGameState(bundle, seed);
  let activeSeconds = 0;
  let dayOffice: number | null = null;
  let dayYard: number | null = null;
  let dayDumpster: number | null = null;

  while (state.day <= maxDays) {
    const starterProgress = progressStarterKitAndStorage(state);
    state = starterProgress.nextState;
    activeSeconds += starterProgress.actionSeconds;

    if (
      state.operations.businessTier === "truck" &&
      state.operations.facilities.storageOwned &&
      state.player.cash >= SAFE_YARD_CAPITAL_TARGET
    ) {
      const upgraded = upgradeBusinessTier(state, "office");
      if (upgraded.nextState !== state) {
        state = upgraded.nextState;
        dayOffice = dayOffice ?? state.day;
        activeSeconds += SECONDS_PER_OFFICE_ACTION;
      }
    }
    if (state.operations.businessTier === "office" && state.player.cash >= YARD_BUY_IN) {
      const upgraded = upgradeBusinessTier(state, "yard");
      if (upgraded.nextState !== state) {
        state = upgraded.nextState;
        dayYard = dayYard ?? state.day;
        activeSeconds += SECONDS_PER_OFFICE_ACTION;
      }
    }
    if (state.operations.businessTier === "yard" && !state.operations.facilities.dumpsterEnabled && state.player.cash >= DUMPSTER_ENABLE_COST) {
      const enabled = enableDumpsterService(state);
      if (enabled.nextState !== state) {
        state = enabled.nextState;
        dayDumpster = dayDumpster ?? state.day;
        activeSeconds += SECONDS_PER_OFFICE_ACTION;
      }
    }

    const labor = acceptContract(state, bundle, DAY_LABOR_CONTRACT_ID);
    state = labor.nextState;
    activeSeconds += SECONDS_PER_DAY_LABOR_CLICK;

    const ended = endShift(state, bundle);
    state = ended.nextState;
    activeSeconds += SECONDS_PER_END_DAY;

    if (dayYard && dayDumpster) {
      break;
    }
  }

  return {
    dayOffice,
    dayYard,
    dayDumpster,
    activeMinutes: activeSeconds / 60
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

describe("progression pacing estimation", () => {
  it("estimates first-trade unlock timing through Baba-gated progression", () => {
    const seeds = [3001, 3002, 3003, 3004, 3005];
    const runs = seeds.map((seed) => runFirstTradeUnlockPolicy(seed));
    const days = runs.map((run) => run.dayFirstTrade ?? 999);
    const medianDay = median(days);
    const activeMinutesMedian = median(runs.map((run) => run.activeMinutes));
    const unlockedDays = days.filter((day) => day !== 999);

    expect(days.every((day) => Number.isFinite(day) && day >= 1 && day <= 999)).toBe(true);
    if (unlockedDays.length > 0) {
      expect(Math.min(...unlockedDays)).toBeLessThanOrEqual(40);
    }
    expect(activeMinutesMedian).toBeGreaterThanOrEqual(0.4);
    expect(medianDay).toBeGreaterThanOrEqual(1);
  });

  it("estimates office timing for lean entry policy", () => {
    const seeds = [3011, 3012, 3013, 3014, 3015];
    const runs = seeds.map((seed) => runLeanOfficePolicy(seed));
    const officeDays = runs.map((run) => run.dayOffice ?? 999);
    const officeMedian = median(officeDays);
    const activeMinutesMedian = median(runs.map((run) => run.activeMinutes));

    expect(officeMedian).toBeGreaterThanOrEqual(30);
    expect(officeMedian).toBeLessThanOrEqual(35);
    expect(activeMinutesMedian).toBeGreaterThanOrEqual(8.5);
    expect(activeMinutesMedian).toBeLessThanOrEqual(9.5);
    expect(runs.every((run) => run.dayYard === null)).toBe(true);
    expect(runs.every((run) => run.dayDumpster === null)).toBe(true);
  });

  it("estimates yard timing for safe-capital expansion policy", () => {
    const seeds = [3021, 3022, 3023, 3024, 3025];
    const runs = seeds.map((seed) => runSafeYardPolicy(seed));
    const yardDays = runs.map((run) => run.dayYard ?? 999);
    const dumpDays = runs.map((run) => run.dayDumpster ?? 999);
    const officeDays = runs.map((run) => run.dayOffice ?? 999);
    const yardMedian = median(yardDays);
    const dumpMedian = median(dumpDays);
    const officeMedian = median(officeDays);
    const activeMinutesMedian = median(runs.map((run) => run.activeMinutes));

    expect(officeMedian).toBeGreaterThanOrEqual(80);
    expect(officeMedian).toBeLessThanOrEqual(95);
    expect(yardMedian).toBeGreaterThanOrEqual(officeMedian);
    expect(yardMedian).toBeLessThanOrEqual(officeMedian + 6);
    expect(dumpMedian).toBeGreaterThanOrEqual(yardMedian);
    expect(dumpMedian).toBeLessThanOrEqual(yardMedian + 4);
    expect(activeMinutesMedian).toBeGreaterThanOrEqual(3.6);
    expect(activeMinutesMedian).toBeLessThanOrEqual(4.8);
  });

  it("keeps truck-life baseline solvent across three billing cycles with day labor only", () => {
    const seeds = [3031, 3032, 3033, 3034, 3035];
    const runs = seeds.map((seed) => runTruckBaselineSolvency(seed));

    expect(runs.every((run) => run.missedBillStrikes === 0)).toBe(true);
    expect(runs.every((run) => run.cash > 300)).toBe(true);
    expect(runs.every((run) => run.tier === "truck")).toBe(true);
  });
});
