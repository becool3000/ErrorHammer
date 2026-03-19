import { generateContractBoard } from "./economy";
import { applyEndDayOperations, createInitialOfficeSkillsState, createInitialOperationsState, createInitialYardState } from "./operations";
import {
  acceptContract,
  createInitialSelfEsteemState,
  createInitialShopSupplies,
  createInitialSkills,
  createInitialWorkday,
  DAY_LABOR_CONTRACT_ID,
  digestState,
  enableDumpsterService,
  getAvailableContractOffers,
  getContractEconomyPreview,
  getCurrentTask,
  getOutOfGasRescuePlan,
  getQuickBuyPlan,
  getSkillRank,
  openStorage,
  performTaskUnit,
  prepareForNextDay,
  quickBuyMissingTools,
  returnToShopForTools,
  runDayLaborShift,
  runManualGasStation,
  runOutOfGasRescue,
  runRecoveryAction,
  spendPerkPoint,
  startResearch,
  upgradeBusinessTier
} from "./playerFlow";
import { CORE_PERK_IDS, createInitialPerksState } from "./perks";
import { getResearchProjectsWithStatus, createResearchStateLocked } from "./research";
import { createRng, hashSeed } from "./rng";
import { createTradeProgressState, getUnlockedTradeOfferSkills } from "./tradeProgress";
import {
  ActiveJobState,
  ActorState,
  BotCareerState,
  BotProfile,
  ContentBundle,
  ContractFileSnapshot,
  ContractInstance,
  CorePerkId,
  DayLog,
  DeferredJobState,
  GameState,
  Intent,
  TaskStance
} from "./types";

interface ScoredOffer {
  contractId: string;
  score: number;
}

export interface EvaluateBotPlanOptions {
  tieNoise?: boolean;
}

export interface EvaluatedBotPlan {
  assignments: Intent["assignments"];
  totalScore: number;
  selectedContractId: string | null;
  usedDayLaborFallback: boolean;
}

export interface SimulateBotCareerDayOptions {
  completedDay: number;
  sharedEventIds: string[];
  daySeed?: number;
}

export interface SimulateBotCareerDayResult {
  career: BotCareerState;
  snapshot: ActorState;
  dayLog: DayLog[];
  plan: EvaluatedBotPlan | null;
}

export function createInitialBotCareer(profile: BotProfile, bundle: ContentBundle): BotCareerState {
  return {
    actor: {
      actorId: profile.id,
      name: profile.name,
      companyName: profile.name,
      cash: 300,
      reputation: 0,
      companyLevel: 1,
      districtUnlocks: unlockDistricts(bundle, 1),
      staminaMax: 4,
      stamina: 4,
      fuel: 8,
      fuelMax: 40,
      oshaCanOwned: false,
      skills: createInitialSkills(),
      tools: {},
      crews: []
    },
    activeJob: null,
    contractBoard: [],
    log: [],
    shopSupplies: createInitialShopSupplies(),
    truckSupplies: {},
    workday: createInitialWorkday(1, 0),
    research: createResearchStateLocked(),
    tradeProgress: createTradeProgressState(true),
    officeSkills: createInitialOfficeSkillsState(),
    yard: createInitialYardState(),
    operations: createInitialOperationsState(),
    perks: createInitialPerksState(),
    selfEsteem: createInitialSelfEsteemState(),
    deferredJobs: [],
    contractFiles: []
  };
}

export function syncBotSnapshotsFromCareers(careers: BotCareerState[]): ActorState[] {
  return careers.map((career) => cloneActor(career.actor));
}

export function evaluateBotPlan(
  career: BotCareerState,
  profile: BotProfile,
  worldState: GameState,
  bundle: ContentBundle,
  daySeed: number,
  options: EvaluateBotPlanOptions = {}
): EvaluatedBotPlan {
  const tieNoise = options.tieNoise ?? true;
  const state = toCareerGameState(career, worldState, worldState.day);
  const offers = getAvailableContractOffers(state, bundle);
  const dayLaborOffer = offers.find((offer) => offer.contract.contractId === DAY_LABOR_CONTRACT_ID) ?? null;
  const rng = tieNoise ? createRng(hashSeed(daySeed, "bot-plan", career.actor.actorId, worldState.day)) : null;

  const scoredOffers: ScoredOffer[] = offers
    .filter((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID)
    .map((offer) => {
      if (!isOfferViable(state, bundle, offer.contract.contractId)) {
        return null;
      }
      const economy = getContractEconomyPreview(state, bundle, offer.contract.contractId);
      const projectedNet = economy?.projectedNetOnSuccess ?? offer.job.basePayout;
      const riskPenalty = offer.job.risk * 180 * profile.weights.wRiskAvoid;
      const repValue = offer.job.repGainSuccess * 35 * profile.weights.wRep;
      const skillValue = getSkillRank(state.player, offer.job.primarySkill) * 12;
      const quickPlan = getQuickBuyPlan(state, bundle, offer.contract.contractId);
      const buyPenalty = (quickPlan?.totalCost ?? 0) * profile.weights.wToolBuy * 0.65;
      const timePenalty = (quickPlan?.requiredTicks ?? 0) * 3;
      let score = projectedNet * profile.weights.wCash + repValue + skillValue - riskPenalty - buyPenalty - timePenalty;
      if (rng) {
        score += rng.next() * 0.01;
      }
      return {
        contractId: offer.contract.contractId,
        score
      };
    })
    .filter((entry): entry is ScoredOffer => Boolean(entry))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.contractId.localeCompare(right.contractId);
    });

  const selectedTrade = scoredOffers[0] ?? null;
  if (selectedTrade) {
    return {
      assignments: [{ assignee: "self", contractId: selectedTrade.contractId }],
      totalScore: selectedTrade.score,
      selectedContractId: selectedTrade.contractId,
      usedDayLaborFallback: false
    };
  }

  const canFallbackToDayLabor =
    Boolean(dayLaborOffer) && Math.max(0, state.workday.availableTicks - state.workday.ticksSpent) > 0;
  if (!canFallbackToDayLabor || !dayLaborOffer) {
    return {
      assignments: [],
      totalScore: 0,
      selectedContractId: null,
      usedDayLaborFallback: false
    };
  }

  const dayLaborScore = dayLaborOffer.job.basePayout * profile.weights.wCash;
  return {
    assignments: [{ assignee: "self", contractId: dayLaborOffer.contract.contractId }],
    totalScore: dayLaborScore,
    selectedContractId: dayLaborOffer.contract.contractId,
    usedDayLaborFallback: true
  };
}

export function generateBotIntent(
  career: BotCareerState,
  profile: BotProfile,
  worldState: GameState,
  bundle: ContentBundle,
  daySeed: number
): Intent {
  const plan = evaluateBotPlan(career, profile, worldState, bundle, daySeed, { tieNoise: true });
  return {
    actorId: career.actor.actorId,
    day: worldState.day,
    assignments: plan.assignments
  };
}

export function getBotPreferredStance(profile: BotProfile): TaskStance {
  if (profile.weights.wCash > profile.weights.wRep) {
    return "rush";
  }
  if (profile.weights.wRep > profile.weights.wCash) {
    return "careful";
  }
  return "standard";
}

export function simulateBotCareerDay(
  career: BotCareerState,
  profile: BotProfile,
  worldState: GameState,
  bundle: ContentBundle,
  options: SimulateBotCareerDayOptions
): SimulateBotCareerDayResult {
  const daySeed = options.daySeed ?? hashSeed(worldState.seed, "bot-career-day", options.completedDay, career.actor.actorId);
  const originalLogLength = career.log.length;

  let state = toCareerGameState(career, worldState, options.completedDay);
  state = prepareForNextDay(state);
  const operations = applyEndDayOperations(state);
  if (operations.dayLog.length > 0) {
    state.log = [...state.log, ...operations.dayLog.map((entry) => ({ ...entry }))].slice(-300);
  }
  state.activeEventIds = [...options.sharedEventIds];

  let plan: EvaluatedBotPlan | null = null;
  const alreadyWorkingContract = Boolean(state.activeJob);

  if (alreadyWorkingContract) {
    state = runContractLoop(state, bundle, profile);
  } else {
    state = refreshCareerBoard(state, bundle, career.actor.actorId);
    plan = evaluateBotPlan(fromCareerGameState(state), profile, state, bundle, daySeed, { tieNoise: true });
    const selectedContractId = plan.selectedContractId;
    if (selectedContractId) {
      const accepted = tryAcceptContract(state, bundle, selectedContractId);
      state = accepted.nextState;
      if (accepted.accepted && state.activeJob) {
        state = runContractLoop(state, bundle, profile);
      }
    }
  }

  state = applyProgressionPolicies(state, bundle, profile);

  const nextCareer = fromCareerGameState(state);
  const nextSnapshot = cloneActor(nextCareer.actor);
  const dayLog = nextCareer.log.slice(originalLogLength);

  return {
    career: nextCareer,
    snapshot: nextSnapshot,
    dayLog,
    plan
  };
}

function tryAcceptContract(
  state: GameState,
  bundle: ContentBundle,
  contractId: string
): { nextState: GameState; accepted: boolean } {
  let nextState = state;
  if (contractId !== DAY_LABOR_CONTRACT_ID) {
    const quickPlan = getQuickBuyPlan(nextState, bundle, contractId);
    if (quickPlan?.missingTools.length) {
      const quick = quickBuyMissingTools(nextState, bundle, contractId);
      if (quick.nextState === nextState) {
        return { nextState, accepted: false };
      }
      nextState = quick.nextState;
    }
  }

  const accepted = acceptContract(nextState, bundle, contractId);
  if (accepted.nextState === nextState) {
    return { nextState, accepted: false };
  }

  return {
    nextState: accepted.nextState,
    accepted: true
  };
}

function runContractLoop(state: GameState, bundle: ContentBundle, profile: BotProfile): GameState {
  let nextState = state;
  let guard = 0;

  while (nextState.activeJob && guard < 220) {
    guard += 1;
    const beforeDigest = digestState(nextState);
    const fueled = attemptProactiveFuelTopUp(nextState);
    if (digestState(fueled) !== beforeDigest) {
      nextState = fueled;
      continue;
    }
    const action = performTaskUnit(nextState, bundle, getBotPreferredStance(profile), true);
    if (action.digest !== beforeDigest) {
      nextState = action.nextState;
      continue;
    }

    const recovered = handleBlockedTask(nextState, bundle);
    if (digestState(recovered) !== beforeDigest) {
      nextState = recovered;
      continue;
    }

    break;
  }

  return nextState;
}

function attemptProactiveFuelTopUp(state: GameState): GameState {
  if (!state.activeJob) {
    return state;
  }
  if (state.player.fuel <= 0 || state.player.fuel > 3) {
    return state;
  }

  const fillRun = runManualGasStation(state, "fill");
  if (fillRun.nextState !== state) {
    return fillRun.nextState;
  }

  const singleRun = runManualGasStation(state, "single");
  if (singleRun.nextState !== state) {
    return singleRun.nextState;
  }

  return state;
}

function handleBlockedTask(state: GameState, bundle: ContentBundle): GameState {
  if (!state.activeJob) {
    return state;
  }

  const rescuePlan = getOutOfGasRescuePlan(state, bundle);
  if (rescuePlan) {
    const rescued = runOutOfGasRescue(state, bundle);
    if (rescued.nextState !== state) {
      return rescued.nextState;
    }
    const labor = runDayLaborShift(state, bundle);
    if (labor.nextState !== state) {
      return labor.nextState;
    }
  }

  const currentTask = getCurrentTask(state);
  if (state.activeJob.location === "job-site") {
    const reroute = returnToShopForTools(state, bundle);
    if (reroute.nextState !== state) {
      return reroute.nextState;
    }
  }

  if (state.activeJob.location === "shop") {
    const quick = quickBuyMissingTools(state, bundle, state.activeJob.contractId);
    if (quick.nextState !== state) {
      return quick.nextState;
    }
  }

  if (currentTask?.taskId === "do_work") {
    const recover = runRecoveryAction(state, bundle, "finish_cheap");
    if (recover.nextState !== state) {
      return recover.nextState;
    }
  }

  return state;
}

function isOfferViable(state: GameState, bundle: ContentBundle, contractId: string): boolean {
  if (contractId === DAY_LABOR_CONTRACT_ID) {
    return Math.max(0, state.workday.availableTicks - state.workday.ticksSpent) > 0;
  }
  const quickPlan = getQuickBuyPlan(state, bundle, contractId);
  if (!quickPlan) {
    return false;
  }
  if (!quickPlan.allowed || quickPlan.starterGateBlocked) {
    return false;
  }
  if (!quickPlan.enoughCash || !quickPlan.enoughTime) {
    return false;
  }
  return true;
}

function applyProgressionPolicies(state: GameState, bundle: ContentBundle, profile: BotProfile): GameState {
  let nextState = state;
  nextState = applyFacilityPolicy(nextState, bundle);
  nextState = applyResearchPolicy(nextState);
  nextState = applyPerkPolicy(nextState, profile);
  return nextState;
}

function applyFacilityPolicy(state: GameState, bundle: ContentBundle): GameState {
  let nextState = state;

  if (!nextState.operations.facilities.storageOwned) {
    const opened = openStorage(nextState, bundle);
    nextState = opened.nextState;
  }
  if (nextState.operations.facilities.storageOwned && !nextState.operations.facilities.officeOwned) {
    const opened = upgradeBusinessTier(nextState, "office");
    nextState = opened.nextState;
  }
  if (nextState.operations.facilities.officeOwned && !nextState.operations.facilities.yardOwned) {
    const opened = upgradeBusinessTier(nextState, "yard");
    nextState = opened.nextState;
  }
  if (nextState.operations.facilities.yardOwned && !nextState.operations.facilities.dumpsterEnabled) {
    const enabled = enableDumpsterService(nextState);
    nextState = enabled.nextState;
  }

  return nextState;
}

function applyResearchPolicy(state: GameState): GameState {
  if (state.research.activeProject) {
    return state;
  }

  const available = getResearchProjectsWithStatus(state)
    .filter((project) => project.status === "available")
    .sort((left, right) => left.projectId.localeCompare(right.projectId));
  const nextProject = available[0];
  if (!nextProject) {
    return state;
  }

  return startResearch(state, nextProject.projectId).nextState;
}

function applyPerkPolicy(state: GameState, profile: BotProfile): GameState {
  const priority = getPerkPriorityOrder(profile);
  let nextState = state;
  let safety = 24;

  while (nextState.perks.corePerkPoints > 0 && safety > 0) {
    let spent = false;
    for (const perkId of priority) {
      const attempt = spendPerkPoint(nextState, perkId);
      if (attempt.nextState !== nextState) {
        nextState = attempt.nextState;
        spent = true;
        break;
      }
    }
    if (!spent) {
      break;
    }
    safety -= 1;
  }

  return nextState;
}

function getPerkPriorityOrder(profile: BotProfile): CorePerkId[] {
  const weights = profile.weights;
  const safetyDominant = weights.wRiskAvoid >= Math.max(weights.wCash, weights.wRep, weights.wToolBuy);
  const cashDominant = !safetyDominant && weights.wCash >= weights.wRep;

  if (safetyDominant) {
    return [
      "safety_awareness",
      "physical_endurance",
      "problem_solving",
      "precision",
      "tool_mastery",
      "project_management",
      "estimating",
      "negotiation",
      "diagnostics",
      "blueprint_reading"
    ];
  }

  if (cashDominant) {
    return [
      "estimating",
      "negotiation",
      "project_management",
      "tool_mastery",
      "precision",
      "diagnostics",
      "problem_solving",
      "blueprint_reading",
      "physical_endurance",
      "safety_awareness"
    ];
  }

  return [
    "precision",
    "blueprint_reading",
    "tool_mastery",
    "project_management",
    "diagnostics",
    "safety_awareness",
    "physical_endurance",
    "estimating",
    "negotiation",
    "problem_solving"
  ];
}

function refreshCareerBoard(state: GameState, bundle: ContentBundle, actorId: string): GameState {
  if (state.activeJob) {
    return {
      ...state,
      contractBoard: []
    };
  }
  const unlockedSkills = getUnlockedTradeOfferSkills(state);

  return {
    ...state,
    contractBoard: generateContractBoard(bundle, state.day, hashSeed(state.seed, "bot-board", state.day, actorId), {
      districtIds: state.player.districtUnlocks,
      maxTier: state.player.companyLevel + 1,
      ...(unlockedSkills.length > 0 ? { skillIds: unlockedSkills } : {})
    })
  };
}

function toCareerGameState(career: BotCareerState, worldState: GameState, day: number): GameState {
  return {
    saveVersion: worldState.saveVersion,
    day,
    seed: hashSeed(worldState.seed, "bot-career-seed", career.actor.actorId),
    player: cloneActor(career.actor),
    bots: [],
    botCareers: [],
    contractBoard: career.contractBoard.map((entry) => ({ ...entry })),
    activeEventIds: [...worldState.activeEventIds],
    log: career.log.map((entry) => ({ ...entry })),
    activeJob: cloneActiveJob(career.activeJob),
    shopSupplies: cloneSupplyInventory(career.shopSupplies),
    truckSupplies: cloneSupplyInventory(career.truckSupplies),
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
    deferredJobs: career.deferredJobs.map((entry) => ({
      deferredJobId: entry.deferredJobId,
      deferredAtDay: entry.deferredAtDay,
      activeJob: cloneActiveJob(entry.activeJob)!
    })),
    contractFiles: career.contractFiles.map((entry) => ({ ...entry })),
    dayLaborHiddenUntilEndDay: worldState.dayLaborHiddenUntilEndDay
  };
}

function fromCareerGameState(state: GameState): BotCareerState {
  return {
    actor: cloneActor(state.player),
    activeJob: cloneActiveJob(state.activeJob),
    contractBoard: state.contractBoard.map((entry) => ({ ...entry })),
    log: state.log.map((entry) => ({ ...entry })),
    shopSupplies: cloneSupplyInventory(state.shopSupplies),
    truckSupplies: cloneSupplyInventory(state.truckSupplies),
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
    deferredJobs: state.deferredJobs.map((entry) => ({
      deferredJobId: entry.deferredJobId,
      deferredAtDay: entry.deferredAtDay,
      activeJob: cloneActiveJob(entry.activeJob)!
    })),
    contractFiles: state.contractFiles.map((entry) => ({ ...entry }))
  };
}

function unlockDistricts(bundle: ContentBundle, companyLevel: number): string[] {
  return [...bundle.districts]
    .sort((left, right) => left.tier - right.tier || left.id.localeCompare(right.id))
    .filter((district) => district.tier <= companyLevel + 1)
    .map((district) => district.id);
}

function cloneActor(actor: ActorState): ActorState {
  return {
    ...actor,
    districtUnlocks: [...actor.districtUnlocks],
    skills: { ...actor.skills },
    tools: Object.fromEntries(
      Object.entries(actor.tools).map(([toolId, tool]) => [toolId, { toolId: tool.toolId, durability: tool.durability }])
    ),
    crews: actor.crews.map((crew) => ({ ...crew }))
  };
}

function cloneActiveJob(activeJob: ActiveJobState | null): ActiveJobState | null {
  if (!activeJob) {
    return null;
  }
  return {
    ...activeJob,
    estimateAtAccept: { ...activeJob.estimateAtAccept },
    reservedMaterials: cloneSupplyInventory(activeJob.reservedMaterials),
    siteSupplies: cloneSupplyInventory(activeJob.siteSupplies),
    supplierCart: cloneSupplyInventory(activeJob.supplierCart),
    tasks: activeJob.tasks.map((task) => ({ ...task }))
  };
}

function cloneSupplyInventory(
  inventory: Record<string, { low?: number; medium?: number; high?: number }> | undefined
): Record<string, { low?: number; medium?: number; high?: number }> {
  return Object.fromEntries(
    Object.entries(inventory ?? {}).map(([supplyId, stack]) => [
      supplyId,
      {
        low: stack.low ?? 0,
        medium: stack.medium ?? 0,
        high: stack.high ?? 0
      }
    ])
  );
}
