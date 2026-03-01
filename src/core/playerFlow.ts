import {
  ActiveJobState,
  ActiveTaskState,
  ActorState,
  ContentBundle,
  ContractInstance,
  CrewState,
  DayLog,
  DistrictDef,
  EventDef,
  GameState,
  JobDef,
  LocationId,
  Outcome,
  SkillId,
  SupplyInventory,
  TaskId,
  TaskQualityOutcome,
  TaskSkillMapping,
  TaskStance,
  TaskTimeOutcome,
  TaskUnitResult,
  Weekday,
  WorkdayState
} from "./types";
import { applyToolPriceModifiers, deriveCompanyLevel, getPayoutMultiplier, getRiskValue, isForcedNeutral } from "./economy";
import { createRng, hashSeed } from "./rng";

export interface StateTransitionResult<T = undefined> {
  nextState: GameState;
  payload?: T;
  notice?: string;
  digest: string;
}

export interface QuickBuyToolLine {
  toolId: string;
  toolName: string;
  price: number;
}

export interface QuickBuyPlan {
  contractId: string;
  missingTools: QuickBuyToolLine[];
  totalCost: number;
  requiredTicks: number;
  enoughCash: boolean;
  enoughTime: boolean;
  allowed: boolean;
}

const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SKILL_IDS: SkillId[] = [
  "travel",
  "procurement",
  "organization",
  "negotiation",
  "general",
  "fastener",
  "framing",
  "finish",
  "plumbing",
  "electrical",
  "mechanical",
  "roof",
  "seal",
  "inspection"
];

const TASK_LABELS: Record<TaskId, string> = {
  load_from_shop: "Load From Shop",
  travel_to_supplier: "Travel To Supplier",
  checkout_supplies: "Checkout Supplies",
  travel_to_job_site: "Travel To Job Site",
  pickup_site_supplies: "Pick Up Site Supplies",
  do_work: "Do The Job",
  collect_payment: "Collect Payment",
  return_to_shop: "Return To Shop",
  store_leftovers: "Store Leftovers"
};

const TEMPLATE_DIFFICULTY: Record<TaskId, number> = {
  load_from_shop: 1,
  travel_to_supplier: 1,
  checkout_supplies: 1,
  travel_to_job_site: 1,
  pickup_site_supplies: 1,
  do_work: 1,
  collect_payment: 1,
  return_to_shop: 1,
  store_leftovers: 1
};

const QUALITY_POINT_DELTA: Record<TaskQualityOutcome, number> = {
  excellent: 2,
  solid: 1,
  sloppy: -1,
  botched: -2
};

const QUALITY_XP_BONUS: Record<TaskQualityOutcome, number> = {
  excellent: 6,
  solid: 3,
  sloppy: 1,
  botched: 1
};

const TASK_ORDER: TaskId[] = [
  "load_from_shop",
  "travel_to_supplier",
  "checkout_supplies",
  "travel_to_job_site",
  "pickup_site_supplies",
  "do_work",
  "collect_payment",
  "return_to_shop",
  "store_leftovers"
];

const CREW_TEMPLATES: Array<{
  crewId: string;
  name: string;
  staminaMax: number;
  efficiency: number;
  reliability: number;
  morale: number;
}> = [
  {
    crewId: "crew-1",
    name: "June",
    staminaMax: 6,
    efficiency: 1,
    reliability: 1,
    morale: 2
  },
  {
    crewId: "crew-2",
    name: "Mina",
    staminaMax: 6,
    efficiency: 2,
    reliability: 1,
    morale: 1
  },
  {
    crewId: "crew-3",
    name: "Ivo",
    staminaMax: 7,
    efficiency: 1,
    reliability: 2,
    morale: 1
  }
];

export const BASE_DAY_TICKS = 16;
export const MAX_OVERTIME_TICKS = 4;
export const SHOP_SUPPLIER_TICKS = 2;
export const SHOP_SUPPLIER_FUEL = 1;
export const FUEL_PRICE = 6;

export function createInitialSkills(): Record<SkillId, number> {
  const skills = createEmptySkills();
  skills.travel = 100;
  skills.procurement = 100;
  skills.organization = 100;
  skills.negotiation = 100;
  skills.general = 100;
  return skills;
}

export function createBotSkills(starterSkillIds: SkillId[]): Record<SkillId, number> {
  const skills = createInitialSkills();
  for (const skillId of starterSkillIds.slice(0, 2)) {
    skills[skillId] = Math.max(skills[skillId], 100);
  }
  return skills;
}

export function createInitialWorkday(day: number, fatigueDebt = 0): WorkdayState {
  return {
    ticksPerDay: BASE_DAY_TICKS,
    availableTicks: Math.max(8, BASE_DAY_TICKS - fatigueDebt),
    ticksSpent: 0,
    overtimeUsed: 0,
    maxOvertime: MAX_OVERTIME_TICKS,
    weekday: getWeekday(day),
    fatigue: {
      debt: fatigueDebt
    }
  };
}

export function createInitialShopSupplies(): SupplyInventory {
  return {
    "anchor-set": 2,
    "board-pack": 1,
    "fastener-box": 3,
    "paint-sleeve": 1,
    "safety-kit": 1,
    "sealant-tube": 2,
    "trim-kit": 1
  };
}

export function getWeekday(day: number): Weekday {
  return WEEKDAYS[(Math.max(1, day) - 1) % WEEKDAYS.length]!;
}

export function getSkillRank(actor: ActorState, skillId: SkillId): number {
  return clamp(Math.floor((actor.skills?.[skillId] ?? 0) / 100), 0, 10);
}

export function getSkillDisplayRows(actor: ActorState): Array<{ skillId: SkillId; rank: number; xp: number }> {
  return SKILL_IDS.map((skillId) => ({
    skillId,
    rank: getSkillRank(actor, skillId),
    xp: actor.skills[skillId] ?? 0
  })).sort((a, b) => b.rank - a.rank || a.skillId.localeCompare(b.skillId));
}

export function getCurrentTask(state: GameState): ActiveTaskState | null {
  const tasks = state.activeJob?.tasks ?? [];
  for (const taskId of TASK_ORDER) {
    const task = tasks.find((entry) => entry.taskId === taskId);
    if (task && task.requiredUnits > task.completedUnits) {
      return task;
    }
  }
  return null;
}

export function getJobByContract(state: GameState, bundle: ContentBundle, contractId: string): { contract: ContractInstance; job: JobDef } | null {
  const contract = state.contractBoard.find((entry) => entry.contractId === contractId);
  if (!contract) {
    return null;
  }
  const job = bundle.jobs.find((entry) => entry.id === contract.jobId);
  if (!job) {
    return null;
  }
  return { contract, job };
}

export function setSupplierCartQuantity(
  state: GameState,
  supplyId: string,
  quantity: number
): StateTransitionResult<Record<string, number>> {
  if (!state.activeJob) {
    return { nextState: state, notice: "No active job.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  if (quantity <= 0) {
    delete nextState.activeJob!.supplierCart[supplyId];
  } else {
    nextState.activeJob!.supplierCart[supplyId] = quantity;
  }

  return {
    nextState,
    payload: { ...nextState.activeJob!.supplierCart },
    digest: digestState(nextState)
  };
}

export function acceptContract(state: GameState, bundle: ContentBundle, contractId: string): StateTransitionResult<ActiveJobState> {
  if (state.activeJob) {
    return { nextState: state, notice: "Finish the current job first.", digest: digestState(state) };
  }

  const picked = getJobByContract(state, bundle, contractId);
  if (!picked) {
    return { nextState: state, notice: "That contract is no longer available.", digest: digestState(state) };
  }

  if (!hasUsableTools(state.player, picked.job.requiredTools)) {
    return { nextState: state, notice: "Missing usable tools for that contract.", digest: digestState(state) };
  }

  const district = bundle.districts.find((entry) => entry.id === picked.job.districtId);
  if (!district) {
    return { nextState: state, notice: "Unknown district.", digest: digestState(state) };
  }

  const events = getActiveEvents(bundle, state.activeEventIds);
  const lockedPayout = Math.max(
    0,
    Math.round(picked.job.basePayout * picked.contract.payoutMult * getPayoutMultiplier(picked.job, events))
  );
  const shortfall = getMaterialShortfall(picked.job.materialNeeds, state.shopSupplies);
  const needsSupplier = Object.values(shortfall).some((quantity) => quantity > 0);
  const tasks = createTaskTemplate(picked.job, district, needsSupplier);

  const nextState = cloneState(state);
  nextState.activeJob = {
    contractId: picked.contract.contractId,
    jobId: picked.job.id,
    districtId: picked.job.districtId,
    acceptedDay: state.day,
    assignee: "self",
    staminaCommitted: false,
    lockedPayout,
    location: "shop",
    qualityPoints: 0,
    reworkCount: 0,
    plannedTicks: tasks.reduce((sum, task) => sum + task.requiredUnits * task.baseTicks, 0),
    actualTicksSpent: 0,
    materialsReserved: false,
    siteSupplies: {},
    supplierCart: { ...shortfall },
    tasks
  };
  nextState.contractBoard = [];
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId,
    message: `Accepted ${picked.job.name} for $${lockedPayout}.`
  });

  return {
    nextState,
    payload: cloneActiveJob(nextState.activeJob),
    digest: digestState(nextState)
  };
}

export function getCrewCapacity(): number {
  return CREW_TEMPLATES.length;
}

export function normalizeGameState(state: Partial<GameState>): GameState {
  const normalizedPlayer = {
    ...state.player!,
    crews: (state.player?.crews ?? []).map((crew) => ({
      ...crew,
      stamina: crew.stamina ?? crew.staminaMax
    }))
  };

  return {
    ...(state as GameState),
    player: normalizedPlayer,
    activeJob: state.activeJob
      ? {
          ...state.activeJob,
          assignee: state.activeJob.assignee ?? "self",
          staminaCommitted: state.activeJob.staminaCommitted ?? false
        }
      : null
  };
}

export function hireCrew(state: GameState): StateTransitionResult<CrewState> {
  if (state.player.companyLevel < 2) {
    return { nextState: state, notice: "Reach company level 2 before hiring a crew.", digest: digestState(state) };
  }

  if (state.player.crews.length >= CREW_TEMPLATES.length) {
    return { nextState: state, notice: "All crew slots are already filled.", digest: digestState(state) };
  }

  const openTemplate = CREW_TEMPLATES.find((template) => !state.player.crews.some((crew) => crew.crewId === template.crewId));
  if (!openTemplate) {
    return { nextState: state, notice: "All crew slots are already filled.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  const nextCrew: CrewState = {
    crewId: openTemplate.crewId,
    name: openTemplate.name,
    staminaMax: openTemplate.staminaMax,
    stamina: openTemplate.staminaMax,
    efficiency: openTemplate.efficiency,
    reliability: openTemplate.reliability,
    morale: openTemplate.morale
  };
  nextState.player.crews = [...nextState.player.crews, nextCrew];

  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: `${nextCrew.name} joined the company roster.`
  });

  return {
    nextState,
    payload: { ...nextCrew },
    notice: `${nextCrew.name} joined the crew roster.`,
    digest: digestState(nextState)
  };
}

export function setActiveJobAssignee(state: GameState, assignee: "self" | string): StateTransitionResult<ActiveJobState> {
  if (!state.activeJob) {
    return { nextState: state, notice: "No active job to assign.", digest: digestState(state) };
  }

  if (assignee !== "self" && !state.player.crews.some((crew) => crew.crewId === assignee)) {
    return { nextState: state, notice: "That crew is unavailable.", digest: digestState(state) };
  }

  const workTask = state.activeJob.tasks.find((task) => task.taskId === "do_work");
  if (state.activeJob.staminaCommitted || (workTask?.completedUnits ?? 0) > 0) {
    return { nextState: state, notice: "The assignee is locked once work starts.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  nextState.activeJob!.assignee = assignee;

  return {
    nextState,
    payload: cloneActiveJob(nextState.activeJob),
    notice: `${getAssigneeDisplayName(nextState.player, assignee)} is set for this job.`,
    digest: digestState(nextState)
  };
}

export function buyFuel(state: GameState, units = 1): StateTransitionResult<number> {
  if (units <= 0) {
    return { nextState: state, payload: state.player.fuel, digest: digestState(state) };
  }
  if (state.activeJob && state.activeJob.location !== "shop") {
    return { nextState: state, notice: "Fuel is only sold at the home shop.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  const room = Math.max(0, nextState.player.fuelMax - nextState.player.fuel);
  const purchasedUnits = Math.min(room, units);
  const cost = purchasedUnits * FUEL_PRICE;
  if (purchasedUnits <= 0) {
    return { nextState, payload: nextState.player.fuel, digest: digestState(nextState) };
  }
  if (nextState.player.cash < cost) {
    return { nextState: state, notice: "Not enough cash for fuel.", digest: digestState(state) };
  }

  nextState.player.cash -= cost;
  nextState.player.fuel += purchasedUnits;
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: `Bought ${purchasedUnits} fuel for $${cost}.`
  });
  return {
    nextState,
    payload: nextState.player.fuel,
    digest: digestState(nextState)
  };
}

export function performTaskUnit(
  state: GameState,
  bundle: ContentBundle,
  stance: TaskStance,
  allowOvertime = false
): StateTransitionResult<TaskUnitResult> {
  if (!state.activeJob) {
    return { nextState: state, notice: "No active job.", digest: digestState(state) };
  }

  const activeTask = getCurrentTask(state);
  if (!activeTask) {
    return { nextState: state, notice: "There is no task to advance.", digest: digestState(state) };
  }

  const job = bundle.jobs.find((entry) => entry.id === state.activeJob?.jobId);
  const district = bundle.districts.find((entry) => entry.id === state.activeJob?.districtId);
  if (!job || !district) {
    return { nextState: state, notice: "Active job data is incomplete.", digest: digestState(state) };
  }

  const assignee = getJobAssignee(state.player, state.activeJob.assignee);
  if (!assignee) {
    return { nextState: state, notice: "Assigned crew is unavailable.", digest: digestState(state) };
  }

  const effectiveStance = activeTask.qualityBearing ? stance : "standard";
  const blockedReason = getTaskBlockedReason(state, bundle, activeTask, job);
  if (blockedReason) {
    return { nextState: state, notice: blockedReason, digest: digestState(state) };
  }

  const mapping = getTaskSkillMapping(job, activeTask.taskId);
  const skillRank = getTaskSkillRank(state.player, mapping);
  const difficulty = getTaskDifficulty(activeTask.taskId, job, district, getActiveEvents(bundle, state.activeEventIds));
  const timing = resolveTiming(state, job, activeTask, effectiveStance, skillRank, difficulty);
  if (!canSpendTicks(state.workday, timing.ticksSpent, allowOvertime)) {
    return { nextState: state, notice: "This action spills into overtime.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  const nextActiveTask = getCurrentTask(nextState);
  if (!nextActiveTask) {
    return { nextState: state, notice: "There is no task to advance.", digest: digestState(state) };
  }

  const logLines: string[] = [];
  const skillXpDelta: Partial<Record<SkillId, number>> = {};
  let qualityOutcome: TaskQualityOutcome | undefined;
  let qualityPointsDelta = 0;
  let unitsCompleted = timing.timeOutcome === "rework" ? 0 : 1;
  let reworkAdded = timing.timeOutcome === "rework" ? 1 : 0;

  spendTicks(nextState.workday, timing.ticksSpent);
  nextState.activeJob!.actualTicksSpent += timing.ticksSpent;

  if (isTravelTask(nextActiveTask.taskId)) {
    const fuelCost = getTravelFuelCost(nextActiveTask.taskId, district, nextState.activeJob!.location);
    nextState.player.fuel = Math.max(0, nextState.player.fuel - fuelCost);
  }

  if (timing.timeOutcome === "rework") {
    nextActiveTask.requiredUnits += 1;
    nextState.activeJob!.reworkCount += 1;
    qualityOutcome = "botched";
    qualityPointsDelta = QUALITY_POINT_DELTA.botched;
    nextState.activeJob!.qualityPoints += qualityPointsDelta;
    logLines.push(`${TASK_LABELS[nextActiveTask.taskId]} went sideways and needs another pass.`);
  } else {
    nextActiveTask.completedUnits += 1;
    if (nextActiveTask.qualityBearing) {
      qualityOutcome = resolveQuality(state, job, nextActiveTask, effectiveStance, skillRank, difficulty, timing.timeOutcome);
      qualityPointsDelta = QUALITY_POINT_DELTA[qualityOutcome];
      nextState.activeJob!.qualityPoints += qualityPointsDelta;
      logLines.push(`${TASK_LABELS[nextActiveTask.taskId]} landed ${qualityOutcome}.`);
    }
  }

  applySkillXp(
    nextState.player,
    mapping,
    nextActiveTask.qualityBearing || timing.timeOutcome === "rework" ? qualityOutcome ?? "botched" : undefined,
    nextActiveTask.taskId,
    skillXpDelta
  );
  logLines.push(describeTiming(nextActiveTask.taskId, timing.timeOutcome, timing.ticksSpent));

  switch (nextActiveTask.taskId) {
    case "load_from_shop":
      if (timing.timeOutcome !== "rework") {
        moveSuppliesForJob(nextState.shopSupplies, nextState.truckSupplies, job.materialNeeds);
      }
      break;
    case "travel_to_supplier":
      if (timing.timeOutcome !== "rework") {
        nextActiveTask.completedUnits = nextActiveTask.requiredUnits;
        nextState.activeJob!.location = "supplier";
      }
      break;
    case "checkout_supplies":
      if (timing.timeOutcome !== "rework" && !applySupplierCheckout(nextState, bundle, job, logLines)) {
        nextActiveTask.requiredUnits += 1;
        unitsCompleted = 0;
      }
      break;
    case "travel_to_job_site":
      if (timing.timeOutcome !== "rework") {
        nextActiveTask.completedUnits = nextActiveTask.requiredUnits;
        nextState.activeJob!.location = "job-site";
      }
      break;
    case "pickup_site_supplies":
      if (timing.timeOutcome !== "rework") {
        moveAllSupplies(nextState.activeJob!.siteSupplies, nextState.truckSupplies);
        nextState.activeJob!.siteSupplies = {};
      }
      break;
    case "do_work":
      if (!nextState.activeJob!.staminaCommitted) {
        commitActiveJobStamina(nextState, job, logLines);
      }
      if (timing.timeOutcome !== "rework" && !nextState.activeJob!.materialsReserved) {
        if (!reserveMaterials(nextState.truckSupplies, job.materialNeeds)) {
          return { nextState: state, notice: "The truck is short on materials.", digest: digestState(state) };
        }
        nextState.activeJob!.materialsReserved = true;
        logLines.push("Reserved the job materials and finally made the mess official.");
      }
      if (timing.timeOutcome !== "rework") {
        applyToolWear(nextState.player, job, nextActiveTask);
      }
      break;
    case "collect_payment":
      if (timing.timeOutcome !== "rework") {
        const outcome = settleActiveJob(nextState, bundle, job);
        logLines.push(...outcome.logLines);
      }
      break;
    case "return_to_shop":
      if (timing.timeOutcome !== "rework") {
        nextActiveTask.completedUnits = nextActiveTask.requiredUnits;
        nextState.activeJob!.location = "shop";
      }
      break;
    case "store_leftovers":
      if (timing.timeOutcome !== "rework") {
        moveAllSupplies(nextState.truckSupplies, nextState.shopSupplies);
        logLines.push("Stored the leftovers and closed the job folder with deliberate calm.");
        nextState.activeJob = null;
      }
      break;
  }

  const taskLogLines = logLines.map((line) => formatAssigneeLogLine(assignee.name, line.trim())).filter(Boolean);
  for (const line of taskLogLines) {
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId: state.activeJob.contractId,
      taskId: nextActiveTask.taskId,
      message: line
    });
  }

  const digest = digestState(nextState);
  const payload: TaskUnitResult = {
    day: state.day,
    taskId: nextActiveTask.taskId,
    stance: effectiveStance,
    timeOutcome: timing.timeOutcome,
    qualityOutcome,
    ticksSpent: timing.ticksSpent,
    unitsCompleted,
    qualityPointsDelta,
    skillXpDelta,
    reworkAdded,
    location: nextState.activeJob?.location ?? "shop",
    logLines: taskLogLines,
    digest
  };

  return {
    nextState,
    payload,
    digest
  };
}

export function prepareForNextDay(state: GameState): GameState {
  const nextState = cloneState(state);
  nextState.day += 1;
  const recovery = getRecoveryForWeekday(getWeekday(nextState.day));
  nextState.workday.fatigue.debt = Math.max(0, nextState.workday.fatigue.debt - recovery);
  nextState.workday = createInitialWorkday(nextState.day, nextState.workday.fatigue.debt);
  nextState.player.stamina = nextState.player.staminaMax;
  nextState.player.crews = nextState.player.crews.map((crew) => ({
    ...crew,
    stamina: crew.staminaMax
  }));

  if (nextState.activeJob && nextState.activeJob.location !== "shop" && Object.keys(nextState.truckSupplies).length > 0) {
    moveAllSupplies(nextState.truckSupplies, nextState.activeJob.siteSupplies);
    nextState.truckSupplies = {};
    const pickupTask = nextState.activeJob.tasks.find((task) => task.taskId === "pickup_site_supplies");
    if (pickupTask) {
      pickupTask.requiredUnits += 1;
    }
  }

  return nextState;
}

export function digestState(state: GameState): string {
  return hashSeed(stableStringify(state)).toString(16);
}

export function hasUsableTools(actor: ActorState, requiredToolIds: string[]): boolean {
  return requiredToolIds.every((toolId) => {
    const tool = actor.tools[toolId];
    return Boolean(tool && tool.durability > 0);
  });
}

export function getTaskSkillMapping(job: JobDef, taskId: TaskId): TaskSkillMapping {
  switch (taskId) {
    case "load_from_shop":
    case "pickup_site_supplies":
    case "store_leftovers":
      return { primary: "organization" };
    case "checkout_supplies":
      return { primary: "procurement" };
    case "travel_to_supplier":
    case "travel_to_job_site":
    case "return_to_shop":
      return { primary: "travel" };
    case "collect_payment":
      return { primary: "negotiation" };
    case "do_work":
      return getWorkSkillMapping(job);
  }
}

function getWorkSkillMapping(job: JobDef): TaskSkillMapping {
  const priority: SkillId[] = [
    "electrical",
    "plumbing",
    "roof",
    "mechanical",
    "framing",
    "finish",
    "seal",
    "inspection",
    "fastener",
    "general"
  ];

  const matches = priority.filter((skillId) => job.tags.includes(skillId));
  if (matches.length >= 2) {
    return { primary: matches[0]!, secondary: matches[1]! };
  }
  if (matches.length === 1) {
    return { primary: matches[0]! };
  }
  return { primary: "general" };
}

function getTaskSkillRank(actor: ActorState, mapping: TaskSkillMapping): number {
  const primary = getSkillRank(actor, mapping.primary);
  if (!mapping.secondary) {
    return primary;
  }
  return Math.floor((primary + getSkillRank(actor, mapping.secondary)) / 2);
}

function getTaskDifficulty(taskId: TaskId, job: JobDef, district: DistrictDef, events: EventDef[]): number {
  let difficulty = TEMPLATE_DIFFICULTY[taskId];
  if (taskId === "travel_to_job_site" || taskId === "return_to_shop") {
    difficulty = district.tier;
  }
  if (taskId === "do_work" || taskId === "collect_payment") {
    difficulty += job.tier;
  }
  if (taskId === "do_work") {
    if (job.tags.includes("commercial") || job.tags.includes("civic")) {
      difficulty += 1;
    }
    if (job.tags.includes("outdoor") && events.some((event) => event.mods.payoutMultByTag?.outdoor !== undefined)) {
      difficulty += 1;
    }
  }
  return difficulty;
}

function resolveTiming(
  state: GameState,
  job: JobDef,
  task: ActiveTaskState,
  stance: TaskStance,
  skillRank: number,
  difficulty: number
): { timeOutcome: TaskTimeOutcome; ticksSpent: number } {
  const { fastChance, reworkChance, delayChance, standardChance } = getTaskTimeChances(skillRank, difficulty, stance);
  const roll = createRng(hashSeed(state.seed, state.day, state.activeJob?.contractId ?? "none", task.taskId, task.completedUnits, task.requiredUnits, stance)).nextInt(100);

  let timeOutcome: TaskTimeOutcome = "standard";
  if (roll < fastChance) {
    timeOutcome = "fast";
  } else if (roll < fastChance + reworkChance) {
    timeOutcome = "rework";
  } else if (roll < fastChance + reworkChance + delayChance) {
    timeOutcome = "delayed";
  } else if (standardChance <= 0) {
    timeOutcome = "delayed";
  }

  const baseTicks = getTaskBaseTicks(task, job);
  switch (timeOutcome) {
    case "fast":
      return { timeOutcome, ticksSpent: Math.max(1, baseTicks - 1) };
    case "delayed":
      return { timeOutcome, ticksSpent: baseTicks + 2 };
    case "rework":
      return { timeOutcome, ticksSpent: baseTicks + 4 };
    default:
      return { timeOutcome, ticksSpent: baseTicks };
  }
}

export function getTaskTimeChances(skillRank: number, difficulty: number, stance: TaskStance): {
  fastChance: number;
  reworkChance: number;
  delayChance: number;
  standardChance: number;
} {
  const delta = clamp(skillRank - difficulty, -3, 3);
  const stanceMods = getTimeMods(stance);
  const fastChance = clamp(10 + 6 * delta + stanceMods.fast, 2, 30);
  const reworkChance = clamp(10 - 4 * delta + stanceMods.rework, 2, 20);
  const delayChance = clamp(28 - 4 * delta + stanceMods.delay, 10, 40);
  const standardChance = Math.max(0, 100 - fastChance - reworkChance - delayChance);
  return { fastChance, reworkChance, delayChance, standardChance };
}

function resolveQuality(
  state: GameState,
  job: JobDef,
  task: ActiveTaskState,
  stance: TaskStance,
  skillRank: number,
  difficulty: number,
  timeOutcome: TaskTimeOutcome
): TaskQualityOutcome {
  const stanceQualityMod = stance === "rush" ? -15 : stance === "careful" ? 15 : 0;
  const timeQualityMod = timeOutcome === "fast" ? -10 : timeOutcome === "delayed" ? 5 : timeOutcome === "rework" ? -25 : 0;
  const roll = createRng(
    hashSeed(state.seed, state.day, state.activeJob?.contractId ?? "none", task.taskId, task.completedUnits, task.requiredUnits, stance, "quality")
  ).nextInt(100);
  const qualityRoll = roll + skillRank * 8 + stanceQualityMod + timeQualityMod - difficulty * 12;
  if (qualityRoll >= 90) {
    return "excellent";
  }
  if (qualityRoll >= 55) {
    return "solid";
  }
  if (qualityRoll >= 25) {
    return "sloppy";
  }
  return "botched";
}

function applySkillXp(
  actor: ActorState,
  mapping: TaskSkillMapping,
  qualityOutcome: TaskQualityOutcome | undefined,
  taskId: TaskId,
  delta: Partial<Record<SkillId, number>>
): void {
  const primaryGain = 10 + (qualityOutcome ? QUALITY_XP_BONUS[qualityOutcome] : 0);
  actor.skills[mapping.primary] += primaryGain;
  delta[mapping.primary] = (delta[mapping.primary] ?? 0) + primaryGain;
  if (taskId === "do_work" && mapping.secondary) {
    const secondaryGain = 5;
    actor.skills[mapping.secondary] += secondaryGain;
    delta[mapping.secondary] = (delta[mapping.secondary] ?? 0) + secondaryGain;
  }
}

function createTaskTemplate(job: JobDef, district: DistrictDef, needsSupplier: boolean): ActiveTaskState[] {
  return [
    createTask("load_from_shop", 2, 1, true),
    createTask("travel_to_supplier", SHOP_SUPPLIER_TICKS, needsSupplier ? 1 : 0, false),
    createTask("checkout_supplies", 2, needsSupplier ? 1 : 0, true),
    createTask("travel_to_job_site", needsSupplier ? district.travel.supplierToSiteTicks : district.travel.shopToSiteTicks, 1, false),
    createTask("pickup_site_supplies", 2, 0, true),
    createTask("do_work", 2, job.workUnits, true),
    createTask("collect_payment", 2, 1, true),
    createTask("return_to_shop", district.travel.shopToSiteTicks, 1, false),
    createTask("store_leftovers", 2, 1, true)
  ];
}

function createTask(taskId: TaskId, baseTicks: number, requiredUnits: number, qualityBearing: boolean): ActiveTaskState {
  return {
    taskId,
    label: TASK_LABELS[taskId],
    location: getTaskLocation(taskId),
    baseTicks,
    requiredUnits,
    completedUnits: 0,
    qualityBearing,
    availableStances: qualityBearing ? ["rush", "standard", "careful"] : ["standard"]
  };
}

function getTaskLocation(taskId: TaskId): LocationId {
  switch (taskId) {
    case "travel_to_supplier":
      return "shop";
    case "checkout_supplies":
      return "supplier";
    case "travel_to_job_site":
    case "pickup_site_supplies":
    case "do_work":
    case "collect_payment":
      return "job-site";
    case "return_to_shop":
      return "job-site";
    default:
      return "shop";
  }
}

function applySupplierCheckout(state: GameState, bundle: ContentBundle, job: JobDef, logLines: string[]): boolean {
  const activeJob = state.activeJob!;
  const cartEntries = Object.entries(activeJob.supplierCart).filter(([, quantity]) => quantity > 0);
  if (cartEntries.length === 0) {
    logLines.push("The cart was empty, which impressed nobody.");
    return false;
  }

  let total = 0;
  for (const [supplyId, quantity] of cartEntries) {
    const supply = bundle.supplies.find((entry) => entry.id === supplyId);
    if (!supply) {
      continue;
    }
    total += applyToolPriceModifiers(supply.price, getActiveEvents(bundle, state.activeEventIds)) * quantity;
  }
  if (state.player.cash < total) {
    logLines.push("The supplier admired your taste and declined your balance.");
    return false;
  }

  state.player.cash -= total;
  for (const [supplyId, quantity] of cartEntries) {
    state.truckSupplies[supplyId] = (state.truckSupplies[supplyId] ?? 0) + quantity;
  }
  const remainingShortfall = getMaterialShortfall(job.materialNeeds, state.truckSupplies);
  activeJob.supplierCart = remainingShortfall;
  logLines.push(`Checked out supplies for $${total}.`);
  return !Object.values(remainingShortfall).some((quantity) => quantity > 0);
}

function reserveMaterials(truckSupplies: SupplyInventory, materialNeeds: JobDef["materialNeeds"]): boolean {
  for (const material of materialNeeds) {
    if ((truckSupplies[material.supplyId] ?? 0) < material.quantity) {
      return false;
    }
  }
  for (const material of materialNeeds) {
    truckSupplies[material.supplyId] -= material.quantity;
    if (truckSupplies[material.supplyId] <= 0) {
      delete truckSupplies[material.supplyId];
    }
  }
  return true;
}

function settleActiveJob(state: GameState, bundle: ContentBundle, job: JobDef): { outcome: Outcome; logLines: string[] } {
  const activeJob = state.activeJob!;
  const events = getActiveEvents(bundle, state.activeEventIds);
  const failChance = clamp(
    getRiskValue(job, events) + activeJob.reworkCount * 0.08 - Math.max(0, activeJob.qualityPoints) * 0.02,
    0,
    0.95
  );
  let outcome: Outcome = "success";
  if (isForcedNeutral(job, events)) {
    outcome = "neutral";
  } else if (createRng(hashSeed(state.seed, state.day, activeJob.contractId, "collect")).bool(failChance)) {
    outcome = "fail";
  } else if (activeJob.qualityPoints < 0) {
    outcome = "neutral";
  }

  const qualityRepMod = clamp(Math.floor(activeJob.qualityPoints / 3), -3, 3);
  const scheduleRepMod =
    activeJob.actualTicksSpent <= activeJob.plannedTicks - 2
      ? 1
      : activeJob.actualTicksSpent >= activeJob.plannedTicks + 4
        ? -1
        : 0;

  let cashDelta = 0;
  let repDelta = 0;
  let flavorLine = job.flavor.neutral_line;
  if (outcome === "success") {
    cashDelta = activeJob.lockedPayout;
    repDelta = job.repGainSuccess;
    flavorLine = job.flavor.success_line;
  } else if (outcome === "neutral") {
    cashDelta = Math.round(activeJob.lockedPayout * 0.5);
    repDelta = 0;
    flavorLine = job.flavor.neutral_line || bundle.strings.neutralLogFallback;
  } else {
    cashDelta = 0;
    repDelta = -Math.abs(job.repLossFail);
    flavorLine = job.flavor.fail_line;
  }

  state.player.cash += cashDelta;
  state.player.reputation += repDelta + qualityRepMod + scheduleRepMod;
  state.player.companyLevel = deriveCompanyLevel(state.player.reputation);
  state.player.districtUnlocks = unlockDistricts(bundle, state.player.companyLevel);
  activeJob.outcome = outcome;

  return {
    outcome,
    logLines: [
      flavorLine,
      `Collected ${outcome} payment: cash ${cashDelta >= 0 ? "+" : ""}${cashDelta}, rep ${repDelta + qualityRepMod + scheduleRepMod}.`
    ]
  };
}

function getTaskBlockedReason(state: GameState, bundle: ContentBundle, task: ActiveTaskState, job: JobDef): string | null {
  const activeJob = state.activeJob!;
  const assignee = getJobAssignee(state.player, activeJob.assignee);
  if (!assignee) {
    return "The assigned crew is unavailable.";
  }
  switch (task.taskId) {
    case "load_from_shop":
      return activeJob.location === "shop" ? null : "Return to the shop before loading supplies.";
    case "travel_to_supplier":
      if (activeJob.location !== "shop") {
        return "Supplier runs start from the shop.";
      }
      return state.player.fuel < SHOP_SUPPLIER_FUEL ? "Not enough fuel for the supplier run." : null;
    case "checkout_supplies":
      if (activeJob.location !== "supplier") {
        return "Travel to the supplier first.";
      }
      return Object.values(activeJob.supplierCart).every((quantity) => quantity <= 0) ? "Add items to the cart first." : null;
    case "travel_to_job_site":
      if (activeJob.location === "job-site") {
        return "Already at the job site.";
      }
      if (hasOutstandingSupplierStop(activeJob)) {
        return "Finish the supplier checkout before heading to the site.";
      }
      return state.player.fuel < getTravelFuelCost(task.taskId, getDistrict(bundle, job.districtId), activeJob.location)
        ? "Not enough fuel for the job-site drive."
        : null;
    case "pickup_site_supplies":
      if (activeJob.location !== "job-site") {
        return "Get back to the job site first.";
      }
      return Object.keys(activeJob.siteSupplies).length === 0 ? "There is nothing waiting on site." : null;
    case "do_work":
      if (activeJob.location !== "job-site") {
        return "Travel to the job site first.";
      }
      if (!activeJob.staminaCommitted && assignee.stamina < job.staminaCost) {
        return `${assignee.name} does not have enough stamina for the work.`;
      }
      if (!hasUsableTools(state.player, job.requiredTools)) {
        return "Missing usable tools for the work.";
      }
      if (!activeJob.materialsReserved) {
        const shortfall = getMaterialShortfall(job.materialNeeds, state.truckSupplies);
        if (Object.values(shortfall).some((quantity) => quantity > 0)) {
          return "The truck is short on materials.";
        }
      }
      return null;
    case "collect_payment":
      return isTaskComplete(activeJob.tasks, "do_work") ? null : "Finish the work first.";
    case "return_to_shop":
      if (!isTaskComplete(activeJob.tasks, "collect_payment")) {
        return "Collect payment before heading home.";
      }
      return state.player.fuel < getTravelFuelCost(task.taskId, getDistrict(bundle, job.districtId), activeJob.location)
        ? "Not enough fuel to get back to the shop."
        : null;
    case "store_leftovers":
      return activeJob.location === "shop" ? null : "Return to the shop before storing leftovers.";
  }
}

function commitActiveJobStamina(state: GameState, job: JobDef, logLines: string[]): void {
  const activeJob = state.activeJob!;
  const assignee = getJobAssignee(state.player, activeJob.assignee);
  if (!assignee || activeJob.staminaCommitted) {
    return;
  }
  assignee.stamina = Math.max(0, assignee.stamina - job.staminaCost);
  activeJob.staminaCommitted = true;
  logLines.push(`${assignee.name} committed ${job.staminaCost} stamina to ${job.name}.`);
}

function getJobAssignee(actor: ActorState, assignee: "self" | string): { name: string; stamina: number } | ActorState | CrewState | null {
  if (assignee === "self") {
    return actor;
  }
  return actor.crews.find((crew) => crew.crewId === assignee) ?? null;
}

function getAssigneeDisplayName(actor: ActorState, assignee: "self" | string): string {
  if (assignee === "self") {
    return actor.name;
  }
  return actor.crews.find((crew) => crew.crewId === assignee)?.name ?? assignee;
}

function formatAssigneeLogLine(assigneeName: string, line: string): string {
  if (!line) {
    return line;
  }
  return `${assigneeName}: ${line}`;
}

function hasOutstandingSupplierStop(activeJob: ActiveJobState): boolean {
  const checkoutTask = activeJob.tasks.find((task) => task.taskId === "checkout_supplies");
  return Boolean(checkoutTask && checkoutTask.requiredUnits > checkoutTask.completedUnits);
}

function getDistrict(bundle: ContentBundle, districtId: string): DistrictDef {
  return bundle.districts.find((entry) => entry.id === districtId) ?? bundle.districts[0]!;
}

function getTravelFuelCost(taskId: TaskId, district: DistrictDef, location: LocationId): number {
  if (taskId === "travel_to_supplier") {
    return SHOP_SUPPLIER_FUEL;
  }
  if (taskId === "travel_to_job_site") {
    return location === "supplier" ? district.travel.supplierToSiteFuel : district.travel.shopToSiteFuel;
  }
  return district.travel.shopToSiteFuel;
}

function getTaskBaseTicks(task: ActiveTaskState, job: JobDef): number {
  if (task.taskId === "do_work") {
    return 2;
  }
  return task.baseTicks;
}

function moveSuppliesForJob(shopSupplies: SupplyInventory, truckSupplies: SupplyInventory, materialNeeds: JobDef["materialNeeds"]): void {
  for (const material of materialNeeds) {
    const available = shopSupplies[material.supplyId] ?? 0;
    const loadQuantity = Math.min(available, material.quantity);
    if (loadQuantity <= 0) {
      continue;
    }
    shopSupplies[material.supplyId] -= loadQuantity;
    if (shopSupplies[material.supplyId] <= 0) {
      delete shopSupplies[material.supplyId];
    }
    truckSupplies[material.supplyId] = (truckSupplies[material.supplyId] ?? 0) + loadQuantity;
  }
}

function moveAllSupplies(from: SupplyInventory, to: SupplyInventory): void {
  for (const [supplyId, quantity] of Object.entries(from)) {
    if (quantity <= 0) {
      continue;
    }
    to[supplyId] = (to[supplyId] ?? 0) + quantity;
  }
}

function applyToolWear(actor: ActorState, job: JobDef, task: ActiveTaskState): void {
  const previousSpend = Math.floor(((task.completedUnits - 1) * job.durabilityCost) / Math.max(1, task.requiredUnits));
  const nextSpend = Math.floor((task.completedUnits * job.durabilityCost) / Math.max(1, task.requiredUnits));
  const wearDelta = Math.max(0, nextSpend - previousSpend);
  if (wearDelta <= 0) {
    return;
  }
  for (const toolId of job.requiredTools) {
    const tool = actor.tools[toolId];
    if (!tool) {
      continue;
    }
    tool.durability = Math.max(0, tool.durability - wearDelta);
  }
}

function getMaterialShortfall(materialNeeds: JobDef["materialNeeds"], inventory: SupplyInventory): Record<string, number> {
  const shortfall: Record<string, number> = {};
  for (const material of materialNeeds) {
    const remaining = material.quantity - (inventory[material.supplyId] ?? 0);
    if (remaining > 0) {
      shortfall[material.supplyId] = remaining;
    }
  }
  return shortfall;
}

function getTimeMods(stance: TaskStance): { fast: number; rework: number; delay: number } {
  if (stance === "rush") {
    return { fast: 10, rework: 6, delay: -4 };
  }
  if (stance === "careful") {
    return { fast: -6, rework: -6, delay: 8 };
  }
  return { fast: 0, rework: 0, delay: 0 };
}

function spendTicks(workday: WorkdayState, ticks: number): void {
  const before = workday.ticksSpent;
  workday.ticksSpent += ticks;
  const overflowStart = Math.max(0, before - workday.availableTicks);
  const overflowEnd = Math.max(0, workday.ticksSpent - workday.availableTicks);
  const overflowDelta = Math.max(0, overflowEnd - overflowStart);
  workday.overtimeUsed += overflowDelta;
  workday.fatigue.debt += overflowDelta;
}

function canSpendTicks(workday: WorkdayState, ticks: number, allowOvertime: boolean): boolean {
  const nextSpent = workday.ticksSpent + ticks;
  if (nextSpent <= workday.availableTicks) {
    return true;
  }
  if (!allowOvertime) {
    return false;
  }
  return nextSpent <= workday.availableTicks + (workday.maxOvertime - workday.overtimeUsed);
}

function getRecoveryForWeekday(weekday: Weekday): number {
  return weekday === "Saturday" || weekday === "Sunday" ? 3 : 1;
}

function describeTiming(taskId: TaskId, outcome: TaskTimeOutcome, ticksSpent: number): string {
  const hours = formatHours(ticksSpent);
  if (outcome === "fast") {
    return `${TASK_LABELS[taskId]} moved fast and spent ${hours}.`;
  }
  if (outcome === "delayed") {
    return `${TASK_LABELS[taskId]} dragged out to ${hours}.`;
  }
  if (outcome === "rework") {
    return `${TASK_LABELS[taskId]} burned ${hours} and created rework.`;
  }
  return `${TASK_LABELS[taskId]} spent ${hours}.`;
}

function isTravelTask(taskId: TaskId): boolean {
  return taskId === "travel_to_supplier" || taskId === "travel_to_job_site" || taskId === "return_to_shop";
}

function getActiveEvents(bundle: ContentBundle, activeEventIds: string[]): EventDef[] {
  return activeEventIds
    .map((eventId) => bundle.events.find((event) => event.id === eventId))
    .filter((event): event is EventDef => Boolean(event));
}

function unlockDistricts(bundle: ContentBundle, companyLevel: number): string[] {
  return [...bundle.districts]
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))
    .filter((district) => district.tier <= companyLevel + 1)
    .map((district) => district.id);
}

function createEmptySkills(): Record<SkillId, number> {
  return Object.fromEntries(SKILL_IDS.map((skillId) => [skillId, 0])) as Record<SkillId, number>;
}

function appendLog(state: GameState, entry: DayLog): void {
  state.log = [...state.log, entry].slice(-300);
}

function isTaskComplete(tasks: ActiveTaskState[], taskId: TaskId): boolean {
  const task = tasks.find((entry) => entry.taskId === taskId);
  return Boolean(task && task.completedUnits >= task.requiredUnits);
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    player: cloneActor(state.player),
    bots: state.bots.map((bot) => cloneActor(bot)),
    contractBoard: state.contractBoard.map((contract) => ({ ...contract })),
    activeEventIds: [...state.activeEventIds],
    log: state.log.map((entry) => ({ ...entry })),
    activeJob: cloneActiveJob(state.activeJob),
    shopSupplies: { ...state.shopSupplies },
    truckSupplies: { ...state.truckSupplies },
    workday: {
      ...state.workday,
      fatigue: { ...state.workday.fatigue }
    }
  };
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
    siteSupplies: { ...activeJob.siteSupplies },
    supplierCart: { ...activeJob.supplierCart },
    tasks: activeJob.tasks.map((task) => ({ ...task }))
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, entry]) => [key, sortValue(entry)]));
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function ticksToHours(ticks: number): number {
  return ticks * 0.5;
}

export function formatHours(ticks: number): string {
  return `${ticksToHours(ticks).toFixed(1)} hours`;
}

export function getQuickBuyPlan(
  state: GameState,
  bundle: ContentBundle,
  contractId: string
): QuickBuyPlan | null {
  const contract = state.contractBoard.find((entry) => entry.contractId === contractId);
  if (!contract) {
    return null;
  }
  const job = bundle.jobs.find((entry) => entry.id === contract.jobId);
  if (!job) {
    return null;
  }
  const events = getActiveEvents(bundle, state.activeEventIds);
  const missingTools: QuickBuyToolLine[] = [];
  for (const toolId of job.requiredTools) {
    const toolDef = bundle.tools.find((tool) => tool.id === toolId);
    if (!toolDef) {
      continue;
    }
    const owned = state.player.tools[toolId];
    if (owned && owned.durability > 0) {
      continue;
    }
    const price = applyToolPriceModifiers(toolDef.price, events);
    missingTools.push({
      toolId: toolDef.id,
      toolName: toolDef.name,
      price
    });
  }
  const totalCost = missingTools.reduce((sum, entry) => sum + entry.price, 0);
  const requiredTicks = missingTools.length * 2;
  const allowed = !state.activeJob || state.activeJob.location === "shop";
  const enoughCash = state.player.cash >= totalCost;
  const enoughTime = requiredTicks === 0 ? true : canSpendTicks(state.workday, requiredTicks, true);
  return {
    contractId,
    missingTools,
    totalCost,
    requiredTicks,
    enoughCash,
    enoughTime,
    allowed
  };
}

export function quickBuyMissingTools(
  state: GameState,
  bundle: ContentBundle,
  contractId: string
): StateTransitionResult<QuickBuyPlan> {
  const plan = getQuickBuyPlan(state, bundle, contractId);
  if (!plan) {
    return { nextState: state, notice: "Selected contract is unavailable.", digest: digestState(state) };
  }
  if (plan.missingTools.length === 0) {
    return { nextState: state, payload: plan, notice: "Tools already stocked.", digest: digestState(state) };
  }
  if (!plan.allowed) {
    return { nextState: state, payload: plan, notice: "Return to the shop before quick buying tools.", digest: digestState(state) };
  }
  if (!plan.enoughCash) {
    return { nextState: state, payload: plan, notice: "Not enough cash for the quick-buy list.", digest: digestState(state) };
  }
  if (!plan.enoughTime) {
    return { nextState: state, payload: plan, notice: "Not enough hours left for the quick buy.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  nextState.player.cash -= plan.totalCost;
  for (const entry of plan.missingTools) {
    const toolDef = bundle.tools.find((tool) => tool.id === entry.toolId);
    if (!toolDef) {
      continue;
    }
    nextState.player.tools[entry.toolId] = {
      toolId: toolDef.id,
      durability: toolDef.maxDurability
    };
  }

  spendTicks(nextState.workday, plan.requiredTicks);
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: `${nextState.player.name} (${nextState.player.companyName}) quick bought ${plan.missingTools
      .map((entry) => entry.toolName)
      .join(", ")} for $${plan.totalCost}.`
  });

  const hoursLabel = plan.requiredTicks > 0 ? ` over ${formatHours(plan.requiredTicks)}` : "";
  const notice = `Quick bought ${plan.missingTools.length} tool${plan.missingTools.length === 1 ? "" : "s"} for $${plan.totalCost}${hoursLabel}.`;

  return {
    nextState,
    payload: plan,
    notice,
    digest: digestState(nextState)
  };
}
