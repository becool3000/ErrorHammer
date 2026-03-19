import { describe, expect, it } from "vitest";
import {
  acceptContract,
  buyFuel,
  DAY_LABOR_CONTRACT_ID,
  MINIMUM_WAGE_PER_HOUR,
  createInitialShopSupplies,
  createInitialWorkday,
  formatSupplyQuality,
  getManualGasStationPlan,
  getOutOfGasRescuePlan,
  getAvailableContractOffers,
  getContractAutoBidPreview,
  getContractEconomyPreview,
  getSettlementPreview,
  getCurrentTask,
  getCurrentTaskGuidance,
  getSkillRank,
  getRemainingShiftTicks,
  getSupplyQuantity,
  getTaskTimeChances,
  hireCrew,
  performTaskUnit,
  quickBuyMissingTools,
  returnToShopForTools,
  runDayLaborShift,
  runManualGasStation,
  runOutOfGasRescue,
  setActiveJobAssignee,
  setSupplierCartQuantity,
  prepareForNextDay
} from "../src/core/playerFlow";
import { clear as clearSave, hasIncompatibleLegacySave, load as loadSave, save as saveState } from "../src/core/save";
import { createInitialGameState, endShift, repairTool, buyTool } from "../src/core/resolver";
import { GameState } from "../src/core/types";
import { loadRawContent, loadSchemas, normalizeBundle, validateContent } from "../scripts/content_pipeline";
import { eventById, makeScenarioBundle, unlockAllCoreTradeTracks } from "./scenario_helpers";

function unlockTradeResearch(state: GameState) {
  state.research.babaUnlocked = true;
  unlockAllCoreTradeTracks(state);
}

function acceptJob(seed: number, contractId: string, options?: { storageOwned?: boolean }) {
  const bundle = makeScenarioBundle();
  let state = createInitialGameState(bundle, seed);
  if (typeof options?.storageOwned === "boolean") {
    state.operations.facilities.storageOwned = options.storageOwned;
  }
  unlockTradeResearch(state);
  state.activeEventIds = [];
  state.contractBoard = [
    { contractId: "job-alpha-contract", jobId: "job-alpha", districtId: "residential", payoutMult: 1, expiresDay: 1 },
    { contractId: "job-beta-contract", jobId: "job-beta", districtId: "residential", payoutMult: 1, expiresDay: 1 },
    { contractId: "job-gamma-contract", jobId: "job-gamma", districtId: "residential", payoutMult: 1, expiresDay: 1 }
  ];
  state.player.tools.hammer = { toolId: "hammer", durability: 6 };
  state.player.tools.drill = { toolId: "drill", durability: 8 };
  state.player.tools.saw = { toolId: "saw", durability: 7 };
  state.player.cash = 500;
  state.shopSupplies = createInitialShopSupplies();
  state.truckSupplies = {};
  const bidPreview = getContractAutoBidPreview(state, bundle, contractId);
  const accepted = acceptContract(state, bundle, contractId);
  if (!accepted.nextState.activeJob) {
    throw new Error(accepted.notice ?? `Could not accept ${contractId}`);
  }
  return { bundle, state: accepted.nextState, acceptedPayout: bidPreview?.acceptedPayout ?? 0 };
}

function getResolvedContractOutcome(state: GameState, contractId: string | null): GameState["contractFiles"][number]["outcome"] | null {
  if (!contractId) {
    return null;
  }
  return state.activeJob?.outcome ?? state.contractFiles.find((entry) => entry.contractId === contractId)?.outcome ?? null;
}

function seedMediumSupplierCart(state: ReturnType<typeof acceptJob>["state"], bundle: ReturnType<typeof acceptJob>["bundle"]) {
  const activeJob = state.activeJob;
  const job = bundle.jobs.find((entry) => entry.id === activeJob?.jobId);
  if (!activeJob || !job) {
    return;
  }
  for (const material of job.materialNeeds) {
    const onTruck = getSupplyQuantity(state.truckSupplies, material.supplyId);
    const shortfall = Math.max(0, material.quantity - onTruck);
    if (shortfall > 0) {
      activeJob.supplierCart[material.supplyId] = { medium: shortfall };
    }
  }
}

function fastForwardToTask(seed: number, contractId: string, targetTaskId: string) {
  const setup = acceptJob(seed, contractId);
  let state = setup.state;
  for (const skillId of Object.keys(state.player.skills) as Array<keyof typeof state.player.skills>) {
    state.player.skills[skillId] = Math.max(100, state.player.skills[skillId]);
  }
  let guard = 0;
  while (getCurrentTask(state)?.taskId !== targetTaskId) {
    if (getCurrentTask(state)?.taskId === "checkout_supplies" && targetTaskId !== "checkout_supplies") {
      seedMediumSupplierCart(state, setup.bundle);
    }
    guard += 1;
    if (guard > 600) {
      throw new Error(`Could not reach task ${targetTaskId} for seed ${seed}. Current task: ${getCurrentTask(state)?.taskId ?? "none"}`);
    }
    const result = performTaskUnit(state, setup.bundle, "standard", true);
    state = result.nextState;
  }
  return { bundle: setup.bundle, state };
}

function finishCurrentTaskUntilOutcome(state: ReturnType<typeof acceptJob>["state"], bundle: ReturnType<typeof acceptJob>["bundle"], stance: "rush" | "standard" | "careful") {
  const contractId = state.activeJob?.contractId ?? null;
  let currentState = state;
  let lastResult = performTaskUnit(currentState, bundle, stance, true);
  let guard = 0;

  while (!getResolvedContractOutcome(lastResult.nextState, contractId)) {
    currentState = lastResult.nextState;
    guard += 1;
    if (guard > 120) {
      throw new Error(`Could not settle ${getCurrentTask(currentState)?.taskId ?? "unknown"} within 120 attempts.`);
    }
    lastResult = performTaskUnit(currentState, bundle, stance, true);
  }

  return lastResult;
}

const quickBuyContract = {
  contractId: "quick-buy-contract",
  jobId: "job-beta",
  districtId: "residential",
  payoutMult: 1,
  expiresDay: 1
};

function setupQuickBuyState(seed: number, cash = 500, playerName?: string, companyName?: string) {
  const scenarioBundle = makeScenarioBundle();
  const state = createInitialGameState(scenarioBundle, seed, playerName, companyName);
  unlockTradeResearch(state);
  state.player.tools = {
    hammer: { toolId: "hammer", durability: 20 }
  };
  state.player.cash = cash;
  state.contractBoard = [{ ...quickBuyContract }];
  state.workday = { ...state.workday, ticksSpent: 0 };
  return { state, bundle: scenarioBundle };
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
    const { state, acceptedPayout } = acceptJob(502, "job-alpha-contract");
    expect(state.activeJob?.lockedPayout).toBe(acceptedPayout);
    expect(state.activeJob?.tasks.length).toBeGreaterThan(0);
    expect(state.contractBoard).toEqual([]);
  });

  it("EH-TW-129: jobs without material needs skip load-from-shop and supplier tasks", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 5600);
    unlockTradeResearch(state);
    state.activeEventIds = [];
    const baseJob = bundle.jobs.find((entry) => entry.id === "job-alpha");
    if (!baseJob) {
      throw new Error("Expected job-alpha in scenario bundle.");
    }
    const noMaterialsJob = { ...baseJob, id: "job-alpha-no-materials", materialNeeds: [] };
    bundle.jobs = bundle.jobs.filter((entry) => entry.id !== noMaterialsJob.id).concat(noMaterialsJob);
    state.contractBoard = [{ contractId: "job-no-materials-contract", jobId: noMaterialsJob.id, districtId: "residential", payoutMult: 1, expiresDay: 1 }];
    state.player.tools.hammer = { toolId: "hammer", durability: 8 };
    state.player.tools.drill = { toolId: "drill", durability: 8 };
    state.player.tools.saw = { toolId: "saw", durability: 8 };

    const accepted = acceptContract(state, bundle, "job-no-materials-contract");
    const loadTask = accepted.nextState.activeJob?.tasks.find((task) => task.taskId === "load_from_shop");
    const supplierTravel = accepted.nextState.activeJob?.tasks.find((task) => task.taskId === "travel_to_supplier");
    const supplierCheckout = accepted.nextState.activeJob?.tasks.find((task) => task.taskId === "checkout_supplies");

    expect(loadTask?.requiredUnits).toBe(0);
    expect(supplierTravel?.requiredUnits).toBe(0);
    expect(supplierCheckout?.requiredUnits).toBe(0);
  });

  it("EH-TW-063: Day Labor hides after non-day-labor acceptance and returns after end day", () => {
    const initial = createInitialGameState(makeScenarioBundle(), 5601);
    unlockTradeResearch(initial);
    const dayLaborOffer = getAvailableContractOffers(initial, makeScenarioBundle()).find(
      (offer) => offer.contract.contractId === DAY_LABOR_CONTRACT_ID
    );
    const initialDayLaborTicks = Math.max(0, initial.workday.availableTicks - initial.workday.ticksSpent);
    expect(dayLaborOffer).toBeTruthy();
    expect(dayLaborOffer?.job.basePayout).toBe(Math.round((initialDayLaborTicks * 0.5) * MINIMUM_WAGE_PER_HOUR));
    expect(dayLaborOffer?.job.flavor.client_quote).toContain(`${(initialDayLaborTicks * 0.5).toFixed(1)} hours`);

    const accepted = acceptJob(5602, "job-alpha-contract");
    expect(accepted.state.dayLaborHiddenUntilEndDay).toBe(true);
    expect(getAvailableContractOffers(accepted.state, accepted.bundle).some((offer) => offer.contract.contractId === DAY_LABOR_CONTRACT_ID)).toBe(false);

    const blockedDayLabor = acceptContract(accepted.state, accepted.bundle, DAY_LABOR_CONTRACT_ID);
    expect(blockedDayLabor.notice).toContain("unavailable until end day");

    const nextDay = endShift(accepted.state, accepted.bundle).nextState;
    expect(nextDay.dayLaborHiddenUntilEndDay).toBe(false);
    expect(getAvailableContractOffers(nextDay, accepted.bundle).some((offer) => offer.contract.contractId === DAY_LABOR_CONTRACT_ID)).toBe(true);
  });

  it("EH-TW-064: Day Laborer uses only regular shift hours when fatigue compresses the workday", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 5603);
    unlockTradeResearch(state);
    state.workday = createInitialWorkday(state.day, 8);

    const dayLaborOffer = getAvailableContractOffers(state, bundle).find((offer) => offer.contract.contractId === DAY_LABOR_CONTRACT_ID);
    const remainingRegularTicks = Math.max(0, state.workday.availableTicks - state.workday.ticksSpent);

    expect(dayLaborOffer?.job.basePayout).toBe(Math.round((remainingRegularTicks * 0.5) * MINIMUM_WAGE_PER_HOUR));
    expect(dayLaborOffer?.job.flavor.client_quote).toContain("4.0 hours");
  });

  it("EH-TW-072: available offers are ordered as Day Labor first, then Baba G jobs", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 5604);
    unlockTradeResearch(state);
    state.contractBoard = [
      { contractId: "c-standard", jobId: "job-alpha", districtId: "residential", payoutMult: 1, expiresDay: 1 },
      { contractId: "c-baba", jobId: "job-baba-g", districtId: "residential", payoutMult: 1, expiresDay: 1 }
    ];
    const babaJob = {
      ...bundle.jobs[0]!,
      id: "job-baba-g",
      name: "Baba G Infinite Leak Relay",
      tags: ["baba-g", "commercial", "absurd"]
    };
    bundle.jobs = [...bundle.jobs, babaJob];

    const offers = getAvailableContractOffers(state, bundle);
    expect(offers[0]?.contract.contractId).toBe(DAY_LABOR_CONTRACT_ID);
    expect(offers[1]?.job.tags.includes("baba-g")).toBe(true);
  });

  it("EH-TW-098: second offer rotates Baba G contract by day", () => {
    const bundle = makeScenarioBundle();
    const babaJobA = {
      ...bundle.jobs[0]!,
      id: "job-baba-rotate-a",
      name: "Baba G Pig Head Removal Initiative",
      tags: ["baba-g", "commercial", "absurd"]
    };
    const babaJobB = {
      ...bundle.jobs[1]!,
      id: "job-baba-rotate-b",
      name: "Baba G Grease Trap Replacement Parade",
      tags: ["baba-g", "commercial", "absurd"]
    };
    bundle.jobs = [...bundle.jobs, babaJobA, babaJobB];
    const stateDayOne = createInitialGameState(bundle, 5611);
    const stateDayTwo = createInitialGameState(bundle, 5611);
    unlockTradeResearch(stateDayOne);
    unlockTradeResearch(stateDayTwo);
    stateDayTwo.day = 2;

    const dayOneOffers = getAvailableContractOffers(stateDayOne, bundle);
    const dayTwoOffers = getAvailableContractOffers(stateDayTwo, bundle);

    expect(dayOneOffers[0]?.contract.contractId).toBe(DAY_LABOR_CONTRACT_ID);
    expect(dayTwoOffers[0]?.contract.contractId).toBe(DAY_LABOR_CONTRACT_ID);
    expect(dayOneOffers[1]?.job.tags.includes("baba-g")).toBe(true);
    expect(dayTwoOffers[1]?.job.tags.includes("baba-g")).toBe(true);
    expect(dayOneOffers[1]?.contract.contractId).not.toBe(dayTwoOffers[1]?.contract.contractId);
    expect(dayOneOffers[1]?.job.id).not.toBe(dayTwoOffers[1]?.job.id);
  });

  it("EH-TW-024: supplier checkout deducts cash, adds supplies, advances checkout, and grants trade skill XP", () => {
    const { bundle, state } = fastForwardToTask(503, "job-beta-contract", "checkout_supplies");
    seedMediumSupplierCart(state, bundle);
    const beforeCash = state.player.cash;
    const beforeXp = state.player.skills.electrician;
    const expectedCartCost = Object.entries(state.activeJob?.supplierCart ?? {}).reduce((sum, [supplyId, stack]) => {
      const supply = bundle.supplies.find((entry) => entry.id === supplyId);
      if (!supply) {
        return sum;
      }
      const stackCost = Object.entries(stack ?? {}).reduce((tierSum, [quality, qty]) => {
        const quantity = qty ?? 0;
        if (quantity <= 0) {
          return tierSum;
        }
        return tierSum + supply.prices[quality as "low" | "medium" | "high"] * quantity;
      }, 0);
      return sum + stackCost;
    }, 0);
    const result = performTaskUnit(state, bundle, "standard");

    expect(result.nextState.player.cash).toBe(beforeCash - expectedCartCost);
    expect(getSupplyQuantity(result.nextState.truckSupplies, "wire-spool", "medium")).toBe(2);
    expect(getSupplyQuantity(result.nextState.truckSupplies, "junction-box", "medium")).toBe(1);
    expect(result.nextState.player.skills.electrician).toBeGreaterThan(beforeXp);
    expect(result.payload?.taskId).toBe("checkout_supplies");
  });

  it("EH-TW-082: checkout passes with empty supplier cart when truck stock already covers material needs", () => {
    const { bundle, state } = fastForwardToTask(503, "job-beta-contract", "checkout_supplies");
    const job = bundle.jobs.find((entry) => entry.id === state.activeJob?.jobId)!;

    for (const material of job.materialNeeds) {
      const onTruck = getSupplyQuantity(state.truckSupplies, material.supplyId);
      const missing = Math.max(0, material.quantity - onTruck);
      if (missing <= 0) {
        continue;
      }
      const stack = state.truckSupplies[material.supplyId] ?? {};
      state.truckSupplies[material.supplyId] = {
        ...stack,
        medium: (stack.medium ?? 0) + missing
      };
    }
    state.activeJob!.supplierCart = {};

    const beforeCash = state.player.cash;
    const result = performTaskUnit(state, bundle, "standard");
    const checkoutTask = result.nextState.activeJob?.tasks.find((task) => task.taskId === "checkout_supplies");

    expect(result.payload?.taskId).toBe("checkout_supplies");
    expect(result.nextState.player.cash).toBe(beforeCash);
    expect(checkoutTask?.completedUnits).toBeGreaterThanOrEqual(checkoutTask?.requiredUnits ?? 0);
    expect(result.payload?.logLines.some((line) => line.includes("already cover the job"))).toBe(true);
  });

  it("EH-TW-104: checkout with insufficient cash returns a balance-declined notice and clear shortfall", () => {
    const { bundle, state } = fastForwardToTask(503, "job-beta-contract", "checkout_supplies");
    seedMediumSupplierCart(state, bundle);
    state.player.cash = 0;

    const result = performTaskUnit(state, bundle, "standard");

    expect(result.notice).toContain("Balance declined");
    expect(result.payload?.logLines.some((line) => line.includes("Balance declined at supplier checkout"))).toBe(true);
    expect(result.nextState.player.cash).toBe(0);
  });

  it("EH-TW-025: travel blocks when fuel is insufficient", () => {
    const { bundle, state } = fastForwardToTask(504, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 0;
    const blocked = performTaskUnit(state, bundle, "standard");

    expect(blocked.notice).toContain("fuel");
    expect(blocked.nextState.player.fuel).toBe(0);
  });

  it("EH-TW-103: load-from-shop guidance calls out extra in-stock required supplies", () => {
    const { bundle, state } = acceptJob(6201, "job-alpha-contract");
    expect(getCurrentTask(state)?.taskId).toBe("load_from_shop");
    state.shopSupplies["anchor-set"] = { medium: 3 };
    state.shopSupplies["fastener-box"] = { medium: 2 };

    const guidance = getCurrentTaskGuidance(state, bundle);
    expect(guidance).toContain("Next step: Load required supplies from storage.");
    expect(guidance).toMatch(/extra stock/i);
    expect(guidance).toContain("Anchor Set +2");
  });

  it("EH-TW-062: zero-fuel rescue succeeds with first-time OSHA can purchase", () => {
    const { bundle, state } = fastForwardToTask(3301, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 0;
    state.player.cash = 150;
    state.player.oshaCanOwned = false;

    const plan = getOutOfGasRescuePlan(state, bundle);
    expect(plan).not.toBeNull();
    expect(plan?.canCost).toBe(25);
    expect(plan?.fuelCost).toBe(5);
    expect(plan?.totalCost).toBe(30);
    expect(plan?.requiredTicks).toBe(2);

    const beforeTicks = state.workday.ticksSpent;
    const beforeCash = state.player.cash;
    const beforeAccountingXp = state.officeSkills.accountingXp;
    const rescued = runOutOfGasRescue(state, bundle);

    expect(rescued.notice).toContain("bought OSHA can");
    expect(rescued.nextState.player.oshaCanOwned).toBe(true);
    expect(rescued.nextState.player.fuel).toBe(1);
    expect(rescued.nextState.player.cash).toBe(beforeCash - 30);
    expect(rescued.nextState.workday.ticksSpent).toBe(beforeTicks + 2);
    expect(rescued.nextState.officeSkills.accountingXp).toBe(beforeAccountingXp + 10);
  });

  it("EH-TW-126: zero-fuel rescue charges fuel-only once OSHA can is already owned", () => {
    const { bundle, state } = fastForwardToTask(3302, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 0;
    state.player.cash = 120;
    state.player.oshaCanOwned = true;

    const plan = getOutOfGasRescuePlan(state, bundle);
    expect(plan).not.toBeNull();
    expect(plan?.canCost).toBe(0);
    expect(plan?.fuelCost).toBe(5);
    expect(plan?.totalCost).toBe(5);

    const beforeCash = state.player.cash;
    const rescued = runOutOfGasRescue(state, bundle);
    expect(rescued.notice).toContain("Walked to nearest gas station");
    expect(rescued.notice).not.toContain("bought OSHA can");
    expect(rescued.nextState.player.oshaCanOwned).toBe(true);
    expect(rescued.nextState.player.fuel).toBe(1);
    expect(rescued.nextState.player.cash).toBe(beforeCash - 5);
  });

  it("EH-TW-243: zero-fuel rescue blocks on low cash, then end-day board refresh enables Day Labor rescue retry", () => {
    const { bundle, state } = fastForwardToTask(3304, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 0;
    state.player.cash = 0;
    state.player.oshaCanOwned = false;

    const blockedPlan = getOutOfGasRescuePlan(state, bundle);
    expect(blockedPlan).not.toBeNull();
    expect(blockedPlan?.cashShortfall).toBe(30);

    const blocked = runOutOfGasRescue(state, bundle);
    expect(blocked.notice).toContain("unavailable until end day");
    expect(blocked.nextState.player.fuel).toBe(0);
    expect(blocked.nextState.player.cash).toBe(0);

    const sameDayLabor = runDayLaborShift(blocked.nextState, bundle);
    expect(sameDayLabor.notice).toContain("unavailable until end day");

    const refreshedBoardState = prepareForNextDay(blocked.nextState);
    const dayLabor = runDayLaborShift(refreshedBoardState, bundle);
    expect(dayLabor.nextState.player.cash).toBeGreaterThanOrEqual(30);
    const nextDay = prepareForNextDay(dayLabor.nextState);
    const beforeCash = nextDay.player.cash;
    const rescued = runOutOfGasRescue(nextDay, bundle);

    expect(rescued.notice).toContain("bought OSHA can");
    expect(rescued.nextState.player.fuel).toBe(1);
    expect(rescued.nextState.player.cash).toBe(beforeCash - 30);
    expect(rescued.nextState.player.oshaCanOwned).toBe(true);
  });

  it("EH-TW-257: manual gas station +1 run buys first OSHA can, adds fuel, and spends travel time", () => {
    const { state } = fastForwardToTask(3310, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 2;
    state.player.cash = 120;
    state.player.oshaCanOwned = false;

    const plan = getManualGasStationPlan(state, "single");
    expect(plan).not.toBeNull();
    expect(plan?.canCost).toBe(25);
    expect(plan?.fuelCost).toBe(5);
    expect(plan?.totalCost).toBe(30);
    expect(plan?.requiredTicks).toBe(2);

    const beforeTicks = state.workday.ticksSpent;
    const beforeTaskTicks = state.activeJob?.actualTicksSpent ?? 0;
    const beforeLocation = state.activeJob?.location;
    const beforeCash = state.player.cash;

    const fueled = runManualGasStation(state, "single");
    expect(fueled.notice).toContain("bought OSHA can");
    expect(fueled.nextState.player.oshaCanOwned).toBe(true);
    expect(fueled.nextState.player.fuel).toBe(3);
    expect(fueled.nextState.player.cash).toBe(beforeCash - 30);
    expect(fueled.nextState.workday.ticksSpent).toBe(beforeTicks + 2);
    expect(fueled.nextState.activeJob?.actualTicksSpent).toBe(beforeTaskTicks + 2);
    expect(fueled.nextState.activeJob?.location).toBe(beforeLocation);
  });

  it("EH-TW-258: manual gas station charges fuel-only once OSHA can is owned", () => {
    const { state } = fastForwardToTask(3311, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 2;
    state.player.cash = 90;
    state.player.oshaCanOwned = true;

    const plan = getManualGasStationPlan(state, "single");
    expect(plan).not.toBeNull();
    expect(plan?.canCost).toBe(0);
    expect(plan?.fuelCost).toBe(5);
    expect(plan?.totalCost).toBe(5);

    const beforeCash = state.player.cash;
    const fueled = runManualGasStation(state, "single");
    expect(fueled.notice).not.toContain("OSHA can");
    expect(fueled.nextState.player.fuel).toBe(3);
    expect(fueled.nextState.player.cash).toBe(beforeCash - 5);
  });

  it("EH-TW-259: manual fill run respects tank max and blocks when cash is short", () => {
    const { state } = fastForwardToTask(3312, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 35;
    state.player.cash = 20;
    state.player.oshaCanOwned = true;

    const blockedPlan = getManualGasStationPlan(state, "fill");
    expect(blockedPlan).not.toBeNull();
    expect(blockedPlan?.fuelAdded).toBe(5);
    expect(blockedPlan?.totalCost).toBe(25);
    expect(blockedPlan?.cashShortfall).toBe(5);

    const blocked = runManualGasStation(state, "fill");
    expect(blocked.notice).toContain("Need $5 more");
    expect(blocked.nextState.player.fuel).toBe(35);

    blocked.nextState.player.cash = 50;
    const filled = runManualGasStation(blocked.nextState, "fill");
    expect(filled.nextState.player.fuel).toBe(40);
    expect(filled.nextState.player.cash).toBe(25);
  });

  it("EH-TW-260: manual station is unavailable at zero fuel while rescue remains available", () => {
    const { bundle, state } = fastForwardToTask(3313, "job-beta-contract", "travel_to_supplier");
    state.player.fuel = 0;
    state.player.cash = 120;
    state.player.oshaCanOwned = false;

    expect(getManualGasStationPlan(state, "single")).toBeNull();
    const manual = runManualGasStation(state, "single");
    expect(manual.notice).toContain("Need at least 1 fuel");
    expect(manual.nextState.player.fuel).toBe(0);

    const rescuePlan = getOutOfGasRescuePlan(state, bundle);
    expect(rescuePlan).not.toBeNull();
  });

  it("EH-TW-261: manual station run returns to the same active-job location after travel", () => {
    const { state } = fastForwardToTask(3314, "job-beta-contract", "checkout_supplies");
    state.player.fuel = 3;
    state.player.cash = 120;
    state.player.oshaCanOwned = true;
    const beforeLocation = state.activeJob?.location;

    const fueled = runManualGasStation(state, "single");
    expect(beforeLocation).toBe("supplier");
    expect(fueled.nextState.activeJob?.location).toBe(beforeLocation);
  });

  it("EH-TW-127: accepted jobs keep refuel task id for compatibility but never require refuel units", () => {
    const { bundle } = acceptJob(3303, "job-beta-contract");
    const state = createInitialGameState(bundle, 3303);
    unlockTradeResearch(state);
    state.player.fuel = state.player.fuelMax;
    state.player.tools.hammer = { toolId: "hammer", durability: 8 };
    state.player.tools.drill = { toolId: "drill", durability: 8 };
    state.player.tools.saw = { toolId: "saw", durability: 8 };
    state.contractBoard = [{ contractId: "job-beta-contract", jobId: "job-beta", districtId: "residential", payoutMult: 1, expiresDay: 1 }];

    const accepted = acceptContract(state, bundle, "job-beta-contract");
    const refuelTask = accepted.nextState.activeJob?.tasks.find((task) => task.taskId === "refuel_at_station");
    expect(refuelTask?.requiredUnits).toBe(0);
    expect(getCurrentTask(accepted.nextState)?.taskId).not.toBe("refuel_at_station");
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
      "anchor-set": { medium: 1 },
      "fastener-box": { medium: 1 }
    };
    state.workday = createInitialWorkday(state.day, state.workday.fatigue.debt);
    const resumed = performTaskUnit(state, bundle, "standard");
    expect(resumed.notice).toBeFalsy();
    expect(resumed.payload?.taskId).toBe("do_work");
  });

  it("EH-TW-069: pickup-site-supplies cannot hard-block when site inventory is empty", () => {
    const { bundle, state } = acceptJob(3601, "job-beta-contract");
    const activeJob = state.activeJob!;
    state.workday = { ...state.workday, ticksSpent: 0, availableTicks: 99, overtimeUsed: 0 };
    activeJob.location = "job-site";
    activeJob.tasks = activeJob.tasks.map((task) => {
      if (
        task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" ||
        task.taskId === "travel_to_supplier" ||
        task.taskId === "checkout_supplies" ||
        task.taskId === "travel_to_job_site"
      ) {
        return { ...task, completedUnits: task.requiredUnits };
      }
      if (task.taskId === "pickup_site_supplies") {
        return { ...task, requiredUnits: 2, completedUnits: 1 };
      }
      return task;
    });
    activeJob.siteSupplies = {};

    let currentState = state;
    let advanced = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = performTaskUnit(currentState, bundle, "standard", true);
      expect(result.notice).toBeFalsy();
      currentState = result.nextState;
      if (getCurrentTask(currentState)?.taskId === "do_work") {
        advanced = true;
        break;
      }
    }

    const pickupTask = currentState.activeJob?.tasks.find((task) => task.taskId === "pickup_site_supplies");
    expect(advanced).toBe(true);
    expect(pickupTask?.completedUnits).toBe(pickupTask?.requiredUnits);
    expect(getCurrentTask(currentState)?.taskId).toBe("do_work");
  });

  it("EH-TW-030: unfinished jobs persist across rollovers and keep the board hidden", () => {
    const { bundle, state } = fastForwardToTask(1301, "job-beta-contract", "travel_to_job_site");
    const atSite = performTaskUnit(state, bundle, "standard").nextState;
    atSite.truckSupplies["wire-spool"] = { medium: 1 };
    const nextDay = endShift(atSite, bundle);

    expect(nextDay.nextState.activeJob).not.toBeNull();
    expect(nextDay.nextState.contractBoard).toEqual([]);
    expect(getSupplyQuantity(nextDay.nextState.activeJob?.siteSupplies ?? {}, "wire-spool", "medium")).toBe(1);
    expect(nextDay.nextState.activeJob?.location).toBe("shop");
    expect(getCurrentTask(nextDay.nextState)?.taskId).toBe("travel_to_job_site");
    expect(nextDay.nextState.day).toBe(2);
  });

  it("EH-TW-073: supplier-stage rollover returns to shop and requires travel-to-supplier before checkout", () => {
    const { bundle, state } = acceptJob(3701, "job-beta-contract");
    const activeJob = state.activeJob!;
    activeJob.location = "supplier";
    activeJob.tasks = activeJob.tasks.map((task) => {
      if (task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" || task.taskId === "travel_to_supplier") {
        return { ...task, completedUnits: task.requiredUnits };
      }
      if (task.taskId === "checkout_supplies") {
        return { ...task, completedUnits: 0, requiredUnits: 1 };
      }
      return task;
    });

    const nextDay = endShift(state, bundle);
    const currentTask = getCurrentTask(nextDay.nextState);
    const travelToSupplier = nextDay.nextState.activeJob?.tasks.find((task) => task.taskId === "travel_to_supplier");
    const checkoutSupplies = nextDay.nextState.activeJob?.tasks.find((task) => task.taskId === "checkout_supplies");

    expect(nextDay.nextState.activeJob?.location).toBe("shop");
    expect(currentTask?.taskId).toBe("travel_to_supplier");
    expect((travelToSupplier?.requiredUnits ?? 0) - (travelToSupplier?.completedUnits ?? 0)).toBe(1);
    expect((checkoutSupplies?.requiredUnits ?? 0) - (checkoutSupplies?.completedUnits ?? 0)).toBe(1);
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
    success.state.player.skills.framer = 1000;
    success.state.activeJob!.qualityPoints = 4;
    success.state.activeJob!.reworkCount = 0;
    success.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;
    const successRun = finishCurrentTaskUntilOutcome(success.state, success.bundle, "careful");
    expect(getResolvedContractOutcome(successRun.nextState, success.state.activeJob?.contractId ?? null)).toBe("success");

    const neutral = fastForwardToTask(1502, "job-alpha-contract", "collect_payment");
    neutral.state.workday = createInitialWorkday(neutral.state.day, 0);
    neutral.state.player.skills.framer = 1000;
    neutral.state.activeJob!.qualityPoints = -4;
    neutral.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;
    const neutralRun = finishCurrentTaskUntilOutcome(neutral.state, neutral.bundle, "standard");
    expect(getResolvedContractOutcome(neutralRun.nextState, neutral.state.activeJob?.contractId ?? null)).toBe("neutral");

    const fail = fastForwardToTask(1500, "job-alpha-contract", "collect_payment");
    fail.state.workday = createInitialWorkday(fail.state.day, 0);
    fail.state.player.skills.framer = 1000;
    fail.state.activeJob!.qualityPoints = 0;
    fail.state.activeJob!.reworkCount = 10;
    fail.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0.95;
    const failRun = finishCurrentTaskUntilOutcome(fail.state, fail.bundle, "rush");
    expect(getResolvedContractOutcome(failRun.nextState, fail.state.activeJob?.contractId ?? null)).toBe("fail");
  });

  it("EH-TW-268: settlement fail floor blocks failure at skill rank 2 or negotiation level 1", () => {
    const skillFloor = fastForwardToTask(1510, "job-alpha-contract", "collect_payment");
    const skillFloorJob = skillFloor.bundle.jobs.find((job) => job.id === "job-alpha");
    if (!skillFloorJob) {
      throw new Error("Expected job-alpha for fail-floor test.");
    }
    skillFloor.state.activeEventIds = [];
    skillFloor.state.activeJob!.qualityPoints = 6;
    skillFloor.state.activeJob!.reworkCount = 10;
    skillFloor.state.perks.corePerks.negotiation = 0;
    skillFloor.state.player.skills[skillFloorJob.primarySkill] = 260;
    skillFloorJob.risk = 0.95;
    expect(getSkillRank(skillFloor.state.player, skillFloorJob.primarySkill)).toBeGreaterThanOrEqual(2);
    const skillFloorRun = finishCurrentTaskUntilOutcome(skillFloor.state, skillFloor.bundle, "rush");
    expect(getResolvedContractOutcome(skillFloorRun.nextState, skillFloor.state.activeJob?.contractId ?? null)).not.toBe("fail");

    const negotiationFloor = fastForwardToTask(1511, "job-alpha-contract", "collect_payment");
    const negotiationFloorJob = negotiationFloor.bundle.jobs.find((job) => job.id === "job-alpha");
    if (!negotiationFloorJob) {
      throw new Error("Expected job-alpha for negotiation fail-floor test.");
    }
    negotiationFloor.state.activeEventIds = [];
    negotiationFloor.state.activeJob!.qualityPoints = 6;
    negotiationFloor.state.activeJob!.reworkCount = 10;
    negotiationFloor.state.perks.corePerks.negotiation = 1;
    negotiationFloor.state.player.skills[negotiationFloorJob.primarySkill] = 100;
    negotiationFloorJob.risk = 0.95;
    const negotiationFloorRun = finishCurrentTaskUntilOutcome(negotiationFloor.state, negotiationFloor.bundle, "rush");
    expect(getResolvedContractOutcome(negotiationFloorRun.nextState, negotiationFloor.state.activeJob?.contractId ?? null)).not.toBe("fail");

    const control = fastForwardToTask(1500, "job-alpha-contract", "collect_payment");
    control.state.activeEventIds = [];
    control.state.activeJob!.qualityPoints = 0;
    control.state.activeJob!.reworkCount = 10;
    control.state.perks.corePerks.negotiation = 0;
    control.state.player.skills.carpenter = 100;
    control.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0.95;
    const controlRun = finishCurrentTaskUntilOutcome(control.state, control.bundle, "rush");
    expect(getResolvedContractOutcome(controlRun.nextState, control.state.activeJob?.contractId ?? null)).toBe("fail");
  });

  it("EH-TW-269: negotiation add-on injects extra work once and pays scope bonus at settlement", () => {
    let trigger:
      | {
          bundle: ReturnType<typeof fastForwardToTask>["bundle"];
          contractId: string;
          stateAfterAddOn: ReturnType<typeof performTaskUnit>["nextState"];
          result: ReturnType<typeof performTaskUnit>;
        }
      | null = null;

    for (let seed = 4600; seed < 4760; seed += 1) {
      const setup = fastForwardToTask(seed, "job-alpha-contract", "collect_payment");
      setup.state.activeEventIds = [];
      setup.state.perks.corePerks.negotiation = 6;
      setup.state.perks.corePerks.estimating = 8;
      setup.state.activeJob!.qualityPoints = 6;
      setup.state.activeJob!.reworkCount = 0;
      setup.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;

      const result = performTaskUnit(setup.state, setup.bundle, "standard", true);
      if (result.payload?.logLines.some((line) => line.includes("Change order approved"))) {
        trigger = {
          bundle: setup.bundle,
          contractId: setup.state.activeJob?.contractId ?? "unknown",
          stateAfterAddOn: result.nextState,
          result
        };
        break;
      }
    }

    expect(trigger).not.toBeNull();
    if (!trigger) {
      return;
    }

    expect(trigger.stateAfterAddOn.activeJob?.hasTriggeredAddOn).toBe(true);
    expect(trigger.stateAfterAddOn.activeJob?.pendingAddOnBonus ?? 0).toBeGreaterThanOrEqual(200);
    expect(getCurrentTask(trigger.stateAfterAddOn)?.taskId).toBe("do_work");

    let settledState = {
      ...trigger.stateAfterAddOn,
      workday: createInitialWorkday(trigger.stateAfterAddOn.day, 0)
    };
    let settledResult = trigger.result;
    let guard = 0;
    while (!getResolvedContractOutcome(settledState, trigger.contractId)) {
      settledResult = performTaskUnit(settledState, trigger.bundle, "careful", true);
      settledState = settledResult.nextState;
      guard += 1;
      if (guard > 600) {
        throw new Error(`Add-on settlement did not close. Current task: ${getCurrentTask(settledState)?.taskId ?? "none"}`);
      }
    }
    const outcome = getResolvedContractOutcome(settledState, trigger.contractId);
    expect(outcome === "success" || outcome === "neutral").toBe(true);
    expect(settledResult.payload?.logLines.some((line) => line.includes("paid out: +$"))).toBe(true);
    const tipLine = settledResult.payload?.logLines.find((line) => line.includes("Client tip for extra effort"));
    if (tipLine) {
      expect(tipLine).toMatch(/\+\$[0-9]+/);
    }
    const changeOrderCount = settledState.log.filter(
      (entry) => entry.contractId === trigger.contractId && entry.message.includes("Change order approved")
    ).length;
    expect(changeOrderCount).toBe(1);
  });

  it("EH-TW-128: return-to-shop allows a final standard action with 0.5h left", () => {
    const { bundle, state } = acceptJob(3304, "job-beta-contract", { storageOwned: true });
    const activeJob = state.activeJob!;
    activeJob.location = "job-site";
    activeJob.tasks = activeJob.tasks.map((task) => {
      if (
        task.taskId === "load_from_shop" ||
        task.taskId === "refuel_at_station" ||
        task.taskId === "travel_to_supplier" ||
        task.taskId === "checkout_supplies" ||
        task.taskId === "travel_to_job_site" ||
        task.taskId === "pickup_site_supplies" ||
        task.taskId === "do_work" ||
        task.taskId === "collect_payment"
      ) {
        return { ...task, completedUnits: task.requiredUnits };
      }
      if (task.taskId === "return_to_shop") {
        return { ...task, requiredUnits: 1, completedUnits: 0 };
      }
      return task;
    });
    state.workday.ticksSpent = state.workday.availableTicks - 1;
    state.workday.overtimeUsed = 0;

    const result = performTaskUnit(state, bundle, "standard", false);
    expect(result.notice).toBeFalsy();
    expect(result.payload?.taskId).toBe("return_to_shop");
    expect(result.payload?.ticksSpent).toBe(1);
    if (result.nextState.activeJob) {
      expect(result.nextState.activeJob.location).toBe("shop");
      expect(getCurrentTask(result.nextState)?.taskId).toBe("store_leftovers");
    } else {
      // Jobs with no leftovers can close immediately after return-to-shop.
      expect(getCurrentTask(result.nextState)).toBeNull();
    }
  });

  it("EH-TW-241: truck-only jobs close after collect payment without return/store tasks", () => {
    const { bundle, state } = acceptJob(3305, "job-beta-contract");
    const acceptedTasks = state.activeJob?.tasks ?? [];
    expect(acceptedTasks.some((task) => task.taskId === "return_to_shop")).toBe(false);
    expect(acceptedTasks.some((task) => task.taskId === "store_leftovers")).toBe(false);
    for (const skillId of Object.keys(state.player.skills) as Array<keyof typeof state.player.skills>) {
      state.player.skills[skillId] = Math.max(100, state.player.skills[skillId]);
    }

    let current = state;
    let guard = 0;
    while (getCurrentTask(current)?.taskId !== "collect_payment") {
      if (getCurrentTask(current)?.taskId === "checkout_supplies") {
        seedMediumSupplierCart(current, bundle);
      }
      guard += 1;
      if (guard > 600) {
        throw new Error(`Could not reach collect_payment for seed 3305. Current task: ${getCurrentTask(current)?.taskId ?? "none"}`);
      }
      current = performTaskUnit(current, bundle, "standard", true).nextState;
    }

    for (let i = 0; i < 12; i += 1) {
      const step = performTaskUnit(current, bundle, "careful", true);
      current = step.nextState;
      if (!current.activeJob) {
        break;
      }
    }

    expect(current.activeJob).toBeNull();
    expect(getCurrentTask(current)).toBeNull();
  });

  it("EH-TW-074: quality at -1 does not auto-trigger neutral when risk checks pass", () => {
    const almostNeutral = fastForwardToTask(1501, "job-alpha-contract", "collect_payment");
    almostNeutral.state.workday = createInitialWorkday(almostNeutral.state.day, 0);
    almostNeutral.state.player.skills.framer = 1000;
    almostNeutral.state.activeJob!.qualityPoints = -1;
    almostNeutral.state.activeJob!.reworkCount = 0;
    almostNeutral.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;

    const result = finishCurrentTaskUntilOutcome(almostNeutral.state, almostNeutral.bundle, "careful");
    expect(getResolvedContractOutcome(result.nextState, almostNeutral.state.activeJob?.contractId ?? null)).toBe("success");
  });

  it("EH-TW-075: quality at -4 triggers neutral even when fail risk is zero", () => {
    const neutralThreshold = fastForwardToTask(1502, "job-alpha-contract", "collect_payment");
    neutralThreshold.state.workday = createInitialWorkday(neutralThreshold.state.day, 0);
    neutralThreshold.state.activeJob!.qualityPoints = -4;
    neutralThreshold.state.activeJob!.reworkCount = 0;
    neutralThreshold.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;

    const result = finishCurrentTaskUntilOutcome(neutralThreshold.state, neutralThreshold.bundle, "standard");
    expect(getResolvedContractOutcome(result.nextState, neutralThreshold.state.activeJob?.contractId ?? null)).toBe("neutral");
  });

  it("EH-TW-076: rework-heavy settlements follow the softened fail-pressure coefficient", () => {
    const setup = acceptJob(5, "job-alpha-contract");
    setup.state.workday = createInitialWorkday(setup.state.day, 0);
    setup.state.player.skills.carpenter = 1000;
    if (setup.state.activeJob) {
      setup.state.activeJob.location = "job-site";
      setup.state.activeJob.tasks = setup.state.activeJob.tasks.map((task) =>
        task.taskId === "collect_payment"
          ? { ...task, requiredUnits: 1, completedUnits: 0 }
          : { ...task, completedUnits: task.requiredUnits }
      );
      setup.state.activeJob.qualityPoints = 0;
      setup.state.activeJob.reworkCount = 4;
    }
    setup.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0.3;

    const result = finishCurrentTaskUntilOutcome(setup.state, setup.bundle, "standard");
    expect(getResolvedContractOutcome(result.nextState, setup.state.activeJob?.contractId ?? null)).toBe("success");
  });

  it("EH-TW-077: settlement preview exposes payout snapshot and risk band for active jobs", () => {
    const previewTarget = fastForwardToTask(1501, "job-alpha-contract", "collect_payment");
    previewTarget.state.activeJob!.lockedPayout = 220;
    previewTarget.state.activeJob!.qualityPoints = 0;
    previewTarget.state.activeJob!.reworkCount = 0;

    const preview = getSettlementPreview(previewTarget.state, previewTarget.bundle);
    expect(preview).not.toBeNull();
    expect(preview?.successCash).toBe(220);
    expect(preview?.neutralCash).toBe(110);
    expect(preview?.failCash).toBe(0);
    expect(["low", "medium", "high"]).toContain(preview?.riskBand);
  });

  it("EH-TW-221: contract economy preview shows gross, cost buckets, and projected net before acceptance", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 3403);
    unlockTradeResearch(state);
    state.shopSupplies = {};
    state.truckSupplies = {};
    state.contractBoard = [{ contractId: "job-beta-contract", jobId: "job-beta", districtId: "residential", payoutMult: 1, expiresDay: 1 }];

    const bidPreview = getContractAutoBidPreview(state, bundle, "job-beta-contract");
    const preview = getContractEconomyPreview(state, bundle, "job-beta-contract");

    expect(preview).not.toBeNull();
    expect(preview?.grossPayout).toBe(bidPreview?.acceptedPayout);
    expect(preview?.materialsCost).toBeGreaterThan(0);
    expect(preview?.fuelCost).toBeGreaterThan(0);
    expect(preview?.trashCost).toBeGreaterThan(0);
    expect(preview?.estimatedTotalCost).toBe((preview?.materialsCost ?? 0) + (preview?.fuelCost ?? 0) + (preview?.trashCost ?? 0));
    expect(preview?.projectedNetOnSuccess).toBe((preview?.grossPayout ?? 0) - (preview?.estimatedTotalCost ?? 0));
  });

  it("EH-TW-222: collect payment appends an explicit payout-cost-net receipt line", () => {
    const scenario = fastForwardToTask(1501, "job-alpha-contract", "collect_payment");
    scenario.state.workday = createInitialWorkday(scenario.state.day, 0);
    scenario.state.player.skills.framer = 1000;
    scenario.state.activeJob!.qualityPoints = 4;
    scenario.state.activeJob!.reworkCount = 0;
    scenario.bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;

    const settled = finishCurrentTaskUntilOutcome(scenario.state, scenario.bundle, "careful");
    const receiptLine = settled.payload?.logLines.find((line) => line.includes("Job receipt:"));

    expect(receiptLine).toBeTruthy();
    expect(receiptLine ?? "").toMatch(/Job receipt: Payout \$\d+ - Costs \$\d+ = Net [+-]\$\d+\./);
  });

  it("EH-TW-033: final reputation delta includes quality and schedule modifiers", () => {
    const { bundle, state } = fastForwardToTask(1601, "job-alpha-contract", "collect_payment");
    bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;
    state.workday = createInitialWorkday(state.day, 0);
    state.player.skills.framer = 1000;
    state.activeJob!.qualityPoints = 11;
    state.activeJob!.reworkCount = 0;
    state.activeJob!.plannedTicks = 10;
    state.activeJob!.actualTicksSpent = 7;
    const repBefore = state.player.reputation;
    const result = performTaskUnit(state, bundle, "careful");

    expect(result.nextState.player.reputation - repBefore).toBe(7);
  });

  it("EH-TW-063: reserved parts quality is calculated from the actual materials used and affects settlement", () => {
    const { bundle, state } = fastForwardToTask(3401, "job-alpha-contract", "do_work");
    state.truckSupplies = {
      "anchor-set": { high: 1 },
      "fastener-box": { high: 1 }
    };
    state.player.skills.framer = 1000;

    const worked = performTaskUnit(state, bundle, "careful", true);
    expect(worked.nextState.activeJob?.partsQuality).toBe("high");
    expect(worked.nextState.activeJob?.partsQualityModifier).toBe(2);
    expect(worked.payload?.logLines.some((line) => line.includes("High quality"))).toBe(true);

    const collectState = fastForwardToTask(3402, "job-alpha-contract", "collect_payment").state;
    collectState.player.skills.carpenter = 1000;
    collectState.activeJob!.qualityPoints = -2;
    collectState.activeJob!.reworkCount = 0;
    collectState.activeJob!.partsQuality = "low";
    collectState.activeJob!.partsQualityScore = 0;
    collectState.activeJob!.partsQualityModifier = -2;
    bundle.jobs.find((job) => job.id === "job-alpha")!.risk = 0;

    const lowPartsSettlement = performTaskUnit(collectState, bundle, "standard", true);
    expect(lowPartsSettlement.payload?.logLines.some((line) => line.includes("(-2 quality)"))).toBe(true);
  });

  it("EH-TW-034: skill XP grows from task use and can increase derived rank", () => {
    const { bundle, state } = acceptJob(1701, "job-alpha-contract");
    state.player.skills.carpenter = 95;
    const beforeRank = getSkillRank(state.player, "carpenter");
    const result = performTaskUnit(state, bundle, "careful");
    const afterRank = getSkillRank(result.nextState.player, "carpenter");

    expect(beforeRank).toBe(0);
    expect(afterRank).toBeGreaterThan(beforeRank);
    expect(result.payload?.skillXpDelta.carpenter).toBeGreaterThan(0);
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
      seedMediumSupplierCart(state, bundle);
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

  it("EH-TW-037: background competitor parity simulation is deterministic and keeps snapshots synced", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 1901);
    const first = endShift(state, bundle);
    const second = endShift(state, bundle);

    expect(first.digest).toBe(second.digest);
    expect(first.dayLog).toEqual(second.dayLog);
    expect(first.nextState.botCareers.length).toBe(first.nextState.bots.length);
    expect(first.nextState.bots[0]!.cash).toBe(first.nextState.botCareers[0]!.actor.cash);
    const contractStartLines = first.dayLog.filter(
      (entry) => entry.actorId === first.nextState.bots[0]!.actorId && (/^Accepted\s+/i.test(entry.message) || /day-labor shift/i.test(entry.message))
    );
    expect(contractStartLines.length).toBeLessThanOrEqual(1);
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

  it("EH-TW-118: broken on-site tools can route back to shop before the job is complete", () => {
    const { bundle, state } = fastForwardToTask(2101, "job-alpha-contract", "do_work");
    const job = bundle.jobs.find((entry) => entry.id === state.activeJob?.jobId)!;
    const requiredToolId = job.requiredTools[0]!;

    state.player.tools[requiredToolId] = { toolId: requiredToolId, durability: 0 };
    const blocked = performTaskUnit(state, bundle, "standard", true);
    expect(blocked.notice).toContain("Missing usable tools");

    const reroute = returnToShopForTools(state, bundle);
    expect(reroute.nextState.activeJob?.location).toBe("shop");
    expect(getCurrentTask(reroute.nextState)?.taskId).toBe("travel_to_job_site");
    expect(reroute.notice).toContain("Returned to storage for tools");
  });

  it("EH-TW-040: quick buy uses player/company names in logs", () => {
    const { state, bundle } = setupQuickBuyState(2500, 500, "Margo", "Margo Metalworks");
    const result = quickBuyMissingTools(state, bundle, quickBuyContract.contractId);

    expect(result.payload?.missingTools.map((line) => line.toolName)).toEqual(["Drill"]);
    expect(result.nextState.player.name).toBe("Margo");
    expect(result.nextState.player.companyName).toBe("Margo Metalworks");
    expect(result.nextState.log.some((entry) => entry.message.includes("Margo Metalworks"))).toBe(true);
  });

  it("EH-TW-041: quick buy spends hours, deducts cash, and keeps the board unchanged", () => {
    const { state, bundle } = setupQuickBuyState(2600, 600);
    const initialCash = state.player.cash;
    const initialTicks = state.workday.ticksSpent;
    const initialBoard = [...state.contractBoard];
    const result = quickBuyMissingTools(state, bundle, quickBuyContract.contractId);

    expect(result.payload?.requiredTicks).toBe(2);
    expect(result.nextState.workday.ticksSpent - initialTicks).toBe(result.payload?.requiredTicks);
    expect(result.nextState.player.cash).toBe(initialCash - (result.payload?.totalCost ?? 0));
    expect(result.nextState.contractBoard).toEqual(initialBoard);
  });

  it("EH-TW-042: quick buy fails when cash or hours are insufficient", () => {
    const { state: lowCash, bundle: cashBundle } = setupQuickBuyState(2700, 1);
    const cashResult = quickBuyMissingTools(lowCash, cashBundle, quickBuyContract.contractId);
    expect(cashResult.notice).toContain("cash");
    expect(cashResult.nextState).toBe(lowCash);

    const { state: lowTime, bundle: timeBundle } = setupQuickBuyState(2800, 1000);
    lowTime.workday = { ...lowTime.workday, availableTicks: 0, maxOvertime: 0 };
    const timeResult = quickBuyMissingTools(lowTime, timeBundle, quickBuyContract.contractId);
    expect(timeResult.notice).toContain("hours");
    expect(timeResult.nextState).toBe(lowTime);
  });

  it("EH-TW-044: crew controls are frozen with a deterministic coming-soon notice", () => {
    const bundle = makeScenarioBundle();
    const state = createInitialGameState(bundle, 2900);
    const result = hireCrew(state);
    expect(result.notice).toContain("Crew: Coming Soon");
    expect(result.nextState).toBe(state);
    expect(result.payload).toBeUndefined();
  });

  it("EH-TW-045: assignee changes are frozen and work logs stay on self-assignment", () => {
    const { bundle, state } = fastForwardToTask(3000, "job-alpha-contract", "do_work");
    const assigned = setActiveJobAssignee(state, "crew-1");
    const result = performTaskUnit(assigned.nextState, bundle, "standard", true);

    expect(assigned.notice).toContain("Crew: Coming Soon");
    expect(assigned.nextState.activeJob?.assignee).toBe("self");
    expect(result.nextState.activeJob?.staminaCommitted).toBe(true);
    expect(result.payload?.logLines.some((line) => line.includes(`${state.player.name}:`))).toBe(true);
  });

  it("EH-TW-046: loaded v4 saves default the active job assignee to self", () => {
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
      const { state } = acceptJob(3100, "job-alpha-contract");
      const legacyShape = {
        ...state,
        activeJob: state.activeJob
          ? {
              ...state.activeJob,
              assignee: undefined,
              staminaCommitted: undefined
            }
          : null
      };
      store.set("error-hammer-save-v2", JSON.stringify(legacyShape));
      const loaded = loadSave();

      expect(loaded?.activeJob?.assignee).toBe("self");
      expect(loaded?.activeJob?.staminaCommitted).toBe(false);
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

  it("EH-TW-049: assignee changes remain disabled after work starts", () => {
    const { bundle, state } = fastForwardToTask(3200, "job-alpha-contract", "do_work");
    const assigned = setActiveJobAssignee(state, "crew-1");
    const first = performTaskUnit(assigned.nextState, bundle, "standard", true);
    const second = performTaskUnit(first.nextState, bundle, "standard", true);
    const reassigned = setActiveJobAssignee(second.nextState, "self");

    expect(reassigned.notice).toContain("Crew: Coming Soon");
    expect(reassigned.nextState.activeJob?.assignee).toBe("self");
  });

  it("EH-TW-013: normalized content bundle has expected keys and stable ordering", async () => {
    const [content, schemas] = await Promise.all([loadRawContent(), loadSchemas()]);
    const result = validateContent(content, schemas);

    expect(result.ok).toBe(true);

    const normalized = normalizeBundle(result.bundle!);
    expect(Object.keys(normalized).sort()).toEqual(["babaJobs", "bots", "districts", "events", "jobs", "strings", "supplies", "tools"]);
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



