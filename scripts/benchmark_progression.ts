import { loadContentBundle } from "../src/core/content";
import { buyTool, createInitialGameState, endShift } from "../src/core/resolver";
import {
  acceptContract,
  DAY_LABOR_CONTRACT_ID,
  getAvailableContractOffers,
  getCurrentTask,
  getQuickBuyPlan,
  getSupplyQuantity,
  performTaskUnit,
  quickBuyMissingTools,
  runManualGasStation,
  runOutOfGasRescue,
  setSupplierCartQuantity
} from "../src/core/playerFlow";
import type { GameState, TaskStance } from "../src/core/types";

interface ProgressionPolicy {
  name: string;
  stance: TaskStance;
  allowOvertime: boolean;
}

interface SimRow {
  seed: number;
  reached: boolean;
  daysToLevel2: number;
  jobsCompleted: number;
  interactions: number;
  quickBuys: number;
  gasRuns: number;
  toolBuys: number;
}

interface BenchmarkSummary {
  policy: string;
  reached: number;
  total: number;
  daysToLevel2: { avg: number; median: number; p90: number };
  jobsToLevel2: { avg: number; median: number; p90: number };
  interactionsToLevel2: {
    avg: number;
    median: number;
    p90: number;
    minutesAt4sPerAction: number;
    minutesAt5sPerAction: number;
    minutesAt6sPerAction: number;
  };
  avgQuickBuys: number;
  avgGasRuns: number;
  avgToolBuys: number;
}

const bundle = loadContentBundle();
const LEVEL_2_REPUTATION = 18;
const DEFAULT_SEED_COUNT = 32;
const MAX_DAYS_PER_RUN = 90;
const MAX_STEPS_PER_RUN = 16000;

function scoreOffer(state: GameState, contractId: string): number {
  const offer = getAvailableContractOffers(state, bundle).find((entry) => entry.contract.contractId === contractId);
  if (!offer) {
    return -999;
  }
  return offer.job.repGainSuccess * 12 + Math.round(offer.job.basePayout / 35) - Math.round(offer.job.risk * 10);
}

function pickBestContract(state: GameState): string {
  const offers = getAvailableContractOffers(state, bundle);
  const ranked = offers
    .map((offer) => {
      const hasTools =
        offer.contract.contractId === DAY_LABOR_CONTRACT_ID ||
        offer.job.requiredTools.every((toolId) => (state.player.tools[toolId]?.durability ?? 0) > 0);
      const quickBuyPlan =
        offer.contract.contractId === DAY_LABOR_CONTRACT_ID ? null : getQuickBuyPlan(state, bundle, offer.contract.contractId);
      const canQuickBuy = Boolean(
        quickBuyPlan &&
          quickBuyPlan.missingTools.length > 0 &&
          quickBuyPlan.allowed &&
          quickBuyPlan.enoughCash &&
          quickBuyPlan.enoughTime
      );
      const feasible = hasTools || canQuickBuy || offer.contract.contractId === DAY_LABOR_CONTRACT_ID;
      const fallbackPenalty = offer.contract.contractId === DAY_LABOR_CONTRACT_ID ? 20 : 0;
      const quickBuyPenalty = hasTools ? 0 : 4;
      const score =
        offer.job.repGainSuccess * 12 +
        Math.round(offer.job.basePayout / 35) -
        Math.round(offer.job.risk * 10) -
        fallbackPenalty -
        quickBuyPenalty;
      return { contractId: offer.contract.contractId, feasible, score };
    })
    .filter((row) => row.feasible)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.contractId ?? DAY_LABOR_CONTRACT_ID;
}

function attemptToolBuy(state: GameState): { state: GameState; bought: boolean } {
  const offers = getAvailableContractOffers(state, bundle).filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID);
  let best: { toolId: string; score: number } | null = null;

  for (const offer of offers) {
    const offerScore = scoreOffer(state, offer.contract.contractId);
    for (const toolId of offer.job.requiredTools) {
      if ((state.player.tools[toolId]?.durability ?? 0) > 0) {
        continue;
      }
      const tool = bundle.tools.find((entry) => entry.id === toolId);
      if (!tool || state.player.cash < tool.price) {
        continue;
      }
      const score = offerScore - Math.round(tool.price / 24);
      if (!best || score > best.score) {
        best = { toolId, score };
      }
    }
  }

  if (!best) {
    return { state, bought: false };
  }
  const nextState = buyTool(state, bundle, best.toolId);
  return { state: nextState, bought: nextState !== state };
}

function allocateSupplierCart(state: GameState): { state: GameState; interactions: number } {
  const activeJob = state.activeJob;
  if (!activeJob) {
    return { state, interactions: 0 };
  }
  const job = bundle.jobs.find((entry) => entry.id === activeJob.jobId);
  if (!job) {
    return { state, interactions: 0 };
  }

  let nextState = state;
  let interactions = 0;

  for (const need of job.materialNeeds) {
    const onTruck = getSupplyQuantity(nextState.truckSupplies, need.supplyId);
    const needed = Math.max(0, need.quantity - onTruck);
    const existing = getSupplyQuantity(nextState.activeJob?.supplierCart ?? {}, need.supplyId, "medium");
    if (existing !== needed) {
      nextState = setSupplierCartQuantity(nextState, need.supplyId, "medium", needed).nextState;
      interactions += 1;
    }
  }

  return { state: nextState, interactions };
}

function isSettlementLog(message: string): boolean {
  return /Collected (success|neutral|fail) payment/i.test(message) || /Job completed at low quality\\. Client approved half pay/i.test(message);
}

function runSeed(seed: number, policy: ProgressionPolicy): SimRow {
  let state = createInitialGameState(bundle, seed, "Bench", "BenchCo");
  let jobsCompleted = 0;
  let interactions = 0;
  let quickBuys = 0;
  let gasRuns = 0;
  let toolBuys = 0;

  for (let guard = 0; guard < MAX_STEPS_PER_RUN && state.day <= MAX_DAYS_PER_RUN && state.player.reputation < LEVEL_2_REPUTATION; guard += 1) {
    if (!state.activeJob) {
      let contractId = pickBestContract(state);
      if (contractId !== DAY_LABOR_CONTRACT_ID) {
        const plan = getQuickBuyPlan(state, bundle, contractId);
        if (plan && plan.missingTools.length > 0 && plan.allowed && plan.enoughCash && plan.enoughTime) {
          state = quickBuyMissingTools(state, bundle, contractId).nextState;
          interactions += 1;
          quickBuys += 1;
        }
      }

      let accepted = acceptContract(state, bundle, contractId);
      if (accepted.notice?.includes("Missing usable tools")) {
        const purchase = attemptToolBuy(state);
        if (purchase.bought) {
          state = purchase.state;
          interactions += 1;
          toolBuys += 1;
          contractId = pickBestContract(state);
          accepted = acceptContract(state, bundle, contractId);
        }
      }

      if (accepted.notice && /Missing usable tools|no longer available/i.test(accepted.notice)) {
        state = endShift(state, bundle).nextState;
        interactions += 1;
        continue;
      }

      state = accepted.nextState;
      interactions += 1;
      continue;
    }

    const currentTask = getCurrentTask(state);
    if (currentTask?.taskId === "checkout_supplies" && state.activeJob.location === "supplier") {
      const allocation = allocateSupplierCart(state);
      state = allocation.state;
      interactions += allocation.interactions;
    }

    const logsBefore = state.log.length;
    const step = performTaskUnit(state, bundle, policy.stance, policy.allowOvertime);

    if (step.notice && /fuel/i.test(step.notice)) {
      const rescued = runOutOfGasRescue(state, bundle);
      if (rescued.nextState !== state) {
        state = rescued.nextState;
        interactions += 1;
        gasRuns += 1;
        continue;
      }
      const fueled = runManualGasStation(state, "single");
      if (fueled.nextState !== state) {
        state = fueled.nextState;
        interactions += 1;
        gasRuns += 1;
        continue;
      }
    }

    if (step.notice && /spills into overtime/i.test(step.notice)) {
      state = endShift(state, bundle).nextState;
      interactions += 1;
      continue;
    }

    if (step.nextState === state) {
      state = endShift(state, bundle).nextState;
      interactions += 1;
      continue;
    }

    state = step.nextState;
    interactions += 1;
    if (state.log.slice(logsBefore).some((entry) => isSettlementLog(entry.message))) {
      jobsCompleted += 1;
    }
  }

  return {
    seed,
    reached: state.player.reputation >= LEVEL_2_REPUTATION,
    daysToLevel2: state.day,
    jobsCompleted,
    interactions,
    quickBuys,
    gasRuns,
    toolBuys
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1] ?? 0;
}

function summarizePolicy(policy: ProgressionPolicy, rows: SimRow[]): BenchmarkSummary {
  const reachedRows = rows.filter((row) => row.reached);
  const days = reachedRows.map((row) => row.daysToLevel2);
  const jobs = reachedRows.map((row) => row.jobsCompleted);
  const interactions = reachedRows.map((row) => row.interactions);
  const avgInteractions = average(interactions);

  return {
    policy: policy.name,
    reached: reachedRows.length,
    total: rows.length,
    daysToLevel2: {
      avg: Number(average(days).toFixed(2)),
      median: median(days),
      p90: percentile(days, 0.9)
    },
    jobsToLevel2: {
      avg: Number(average(jobs).toFixed(2)),
      median: median(jobs),
      p90: percentile(jobs, 0.9)
    },
    interactionsToLevel2: {
      avg: Number(avgInteractions.toFixed(1)),
      median: median(interactions),
      p90: percentile(interactions, 0.9),
      minutesAt4sPerAction: Number(((avgInteractions * 4) / 60).toFixed(1)),
      minutesAt5sPerAction: Number(((avgInteractions * 5) / 60).toFixed(1)),
      minutesAt6sPerAction: Number(((avgInteractions * 6) / 60).toFixed(1))
    },
    avgQuickBuys: Number(average(reachedRows.map((row) => row.quickBuys)).toFixed(2)),
    avgGasRuns: Number(average(reachedRows.map((row) => row.gasRuns)).toFixed(2)),
    avgToolBuys: Number(average(reachedRows.map((row) => row.toolBuys)).toFixed(2))
  };
}

function getSeedCountFromArgs(): number {
  const seedArg = process.argv.find((arg) => arg.startsWith("--seeds="));
  if (!seedArg) {
    return DEFAULT_SEED_COUNT;
  }
  const parsed = Number.parseInt(seedArg.split("=")[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEED_COUNT;
}

function main(): void {
  const seedCount = getSeedCountFromArgs();
  const seedStart = 24000;
  const seeds = Array.from({ length: seedCount }, (_, index) => seedStart + index);
  const policies: ProgressionPolicy[] = [
    { name: "Careful / no OT", stance: "careful", allowOvertime: false },
    { name: "Standard / OT allowed", stance: "standard", allowOvertime: true },
    { name: "Rush / OT allowed", stance: "rush", allowOvertime: true }
  ];

  const summaries = policies.map((policy) => summarizePolicy(policy, seeds.map((seed) => runSeed(seed, policy))));
  console.log(JSON.stringify({ level2RepTarget: LEVEL_2_REPUTATION, seedCount, summaries }, null, 2));
}

main();
