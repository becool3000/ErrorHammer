import {
  ActiveRecoveryMode,
  ActiveJobState,
  ActiveTaskState,
  ActorState,
  BotCareerState,
  BusinessTier,
  ContractActualSnapshot,
  ContractFileSnapshot,
  ContractFileStatus,
  ContractEstimateSnapshot,
  ContractFilterId,
  ContentBundle,
  ContractInstance,
  CoreTradeSkillId,
  CorePerkId,
  CrewState,
  DayLog,
  DeferredJobState,
  DayLaborMinigameResult,
  DistrictDef,
  EventDef,
  GameState,
  JobProfitRecap,
  JobDef,
  LocationId,
  Outcome,
  RecoveryActionId,
  SkillId,
  SupplyInventory,
  SupplyQuality,
  SupplyStack,
  SelfEsteemBand,
  TaskId,
  TaskQualityOutcome,
  TaskSkillMapping,
  TaskStance,
  TaskTimeOutcome,
  TaskUnitResult,
  ResearchProjectState,
  Weekday,
  WorkdayState,
  TRADE_SKILLS
} from "./types";
import { applyToolPriceModifiers, deriveCompanyLevel, generateContractBoard, getPayoutMultiplier, getRiskValue, isForcedNeutral } from "./economy";
import { createRng, hashSeed } from "./rng";
import {
  closeOfficeManually as closeOfficeManuallyOperation,
  closeYardManually as closeYardManuallyOperation,
  enableDumpsterService as enableDumpsterServiceOperation,
  getPremiumHaulCost,
  openStorage as openStorageOperation,
  upgradeBusinessTier as upgradeBusinessTierOperation,
  awardOfficeSkillXp,
  emptyDumpster as emptyDumpsterOperation,
  hireAccountant as hireAccountantOperation,
  normalizeOfficeSkillsState,
  normalizeOperationsState,
  normalizeYardState,
  resetOfficeSkillDailyCaps
} from "./operations";
import {
  normalizeResearchState,
  startResearchProject
} from "./research";
import {
  awardPerkXp,
  consumeRerollToken,
  getTaskPerkModifiers,
  normalizePerksState,
  resetJobRerollTokens,
  spendPerkPoint as spendPerkPointCore
} from "./perks";
import { formatEncounterMarker, rollRebarBobEncounter } from "./encounters";
import {
  CORE_TRADE_SKILLS,
  formatCoreTrackLabel,
  isCoreTrackUnlocked,
  mapSkillToCoreTrack,
  normalizeTradeProgressState,
  unlockCoreTrack
} from "./tradeProgress";

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
  starterGateBlocked: boolean;
}

export interface OutOfGasRescuePlan {
  warning: string;
  fuelBlockedTaskId: TaskId;
  canCost: number;
  fuelCost: number;
  totalCost: number;
  requiredTicks: number;
  fuelAdded: number;
  canOwnedAfter: boolean;
  cashShortfall: number;
}

export type ManualGasStationMode = "single" | "fill";

export interface ManualGasStationPlan {
  mode: ManualGasStationMode;
  warning: string;
  requestedFuel: number;
  fuelAdded: number;
  canCost: number;
  fuelCost: number;
  totalCost: number;
  requiredTicks: number;
  cashShortfall: number;
  timeBlocked: boolean;
}

export interface ReturnToShopForToolsPayload {
  ticksSpent: number;
  fuelSpent: number;
  usedOvertime: boolean;
}

export interface MaterialQualityResult {
  quality: SupplyQuality;
  score: number;
  modifier: number;
}

export interface ContractOffer {
  contract: ContractInstance;
  job: JobDef;
  alwaysAvailable?: boolean;
}

export type RiskBand = "low" | "medium" | "high";

export interface SettlementPreview {
  successCash: number;
  neutralCash: number;
  failCash: number;
  riskBand: RiskBand;
  neutralWarning: string;
}

export interface ContractEconomyPreview extends ContractEstimateSnapshot {}

export interface ContractAutoBidPreview {
  baseQuote: number;
  autoBid: number;
  acceptedPayout: number;
  estimatingLevel: number;
  bidAccuracyBandPct: number;
  bidNoise: number;
  isBaba: boolean;
}

export interface ActiveJobSpendPreview extends ContractEconomyPreview {
  spentSoFar: number;
  estimatedRemainingCost: number;
}

interface SupplierCheckoutStatus {
  ok: boolean;
  notice?: string;
}

const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SKILL_IDS: SkillId[] = [...TRADE_SKILLS];

const TASK_LABELS: Record<TaskId, string> = {
  load_from_shop: "Load From Storage",
  refuel_at_station: "Refuel At Gas Station",
  travel_to_supplier: "Travel To Supplier",
  checkout_supplies: "Checkout Supplies",
  travel_to_job_site: "Travel To Job Site",
  pickup_site_supplies: "Pick Up Site Supplies",
  do_work: "Do The Job",
  collect_payment: "Collect Payment",
  return_to_shop: "Return To Storage",
  store_leftovers: "Store Leftovers"
};

const TEMPLATE_DIFFICULTY: Record<TaskId, number> = {
  load_from_shop: 1,
  refuel_at_station: 1,
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

const QUALITY_SELF_ESTEEM_DELTA: Record<TaskQualityOutcome, number> = {
  excellent: 4,
  solid: 1,
  sloppy: -2,
  botched: -5
};

const TASK_ORDER: TaskId[] = [
  "load_from_shop",
  "refuel_at_station",
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
export const SHOP_SUPPLIER_TICKS = 1;
export const SHOP_SUPPLIER_FUEL = 1;
export const FUEL_PRICE = 5;
export const FUEL_TANK_MAX = 40;
export const MANUAL_GAS_STATION_TICKS = 2;
export const OUT_OF_GAS_RESCUE_TICKS = 2;
export const OUT_OF_GAS_RESCUE_FUEL = 1;
export const OSHA_CAN_PRICE = 25;
export const TRUCK_SUPPLY_CAPACITY = 8;
export const STORAGE_SUPPLY_CAPACITY = 40;
export const SUPPLY_QUALITIES: SupplyQuality[] = ["low", "medium", "high"];
export const DAY_LABOR_CONTRACT_ID = "day-labor-contract";
export const DAY_LABOR_JOB_ID = "job-day-laborer";
export const MINIMUM_WAGE_PER_HOUR = 10.5;
export const MIN_CONTRACT_RATE_PER_HOUR = 50;
export const MIN_BABA_CONTRACT_RATE_PER_HOUR = 25;
export const STARTER_TOOL_IDS = ["work-boots", "tool-belt", "hammer", "level", "square", "saw"] as const;
export const STARTER_OSHA_CAN_ID = "osha-can";
export const STARTER_OSHA_CAN_LABEL = "OSHA Gas Can";
const BABA_G_ROTATING_CONTRACT_PREFIX = "baba-g-rotating-contract";
const UNLOCKED_FALLBACK_CONTRACT_PREFIX = "unlocked-fallback-contract";
const STARTER_TOOL_ID_SET = new Set<string>(STARTER_TOOL_IDS);

const QUALITY_LABELS: Record<SupplyQuality, string> = {
  low: "Low",
  medium: "Medium",
  high: "High"
};

interface SelfEsteemBandEffects {
  qualityRoll: number;
  fastChance: number;
  reworkChance: number;
  delayChance: number;
  settlementFailChance: number;
  ignoreLikelyLossPrompt: number;
}

const SELF_ESTEEM_TOOLTIP =
  "How you’re feeling about yourself on the job. Too low and you freeze up. Too high and you start acting stupid.";
const SELF_ESTEEM_CENTER = 50;
const SELF_ESTEEM_MIN = 0;
const SELF_ESTEEM_MAX = 100;
const SELF_ESTEEM_EXTREME_PENALTY_SCALE = 0.6;
const SELF_ESTEEM_GRIZZLED_IGNORE_REDUCTION = 0.65;

const SELF_ESTEEM_BAND_EFFECTS: Record<SelfEsteemBand, SelfEsteemBandEffects> = {
  shaken: {
    qualityRoll: -16,
    fastChance: -8,
    reworkChance: 10,
    delayChance: 8,
    settlementFailChance: 0.12,
    ignoreLikelyLossPrompt: 0
  },
  low: {
    qualityRoll: -8,
    fastChance: -4,
    reworkChance: 5,
    delayChance: 4,
    settlementFailChance: 0.06,
    ignoreLikelyLossPrompt: 0
  },
  solid: {
    qualityRoll: 8,
    fastChance: 4,
    reworkChance: -4,
    delayChance: -3,
    settlementFailChance: -0.06,
    ignoreLikelyLossPrompt: 0
  },
  cocky: {
    qualityRoll: -4,
    fastChance: 10,
    reworkChance: 6,
    delayChance: -4,
    settlementFailChance: 0.05,
    ignoreLikelyLossPrompt: 0.22
  },
  reckless: {
    qualityRoll: -12,
    fastChance: 15,
    reworkChance: 12,
    delayChance: -6,
    settlementFailChance: 0.14,
    ignoreLikelyLossPrompt: 0.48
  }
};

export function isStarterToolId(toolId: string): boolean {
  return STARTER_TOOL_ID_SET.has(toolId);
}

export function createInitialSelfEsteemState(): GameState["selfEsteem"] {
  return {
    currentSelfEsteem: 50,
    dailySelfEsteemDrift: 4,
    lifetimeTimesAtZero: 0,
    lifetimeTimesAtHundred: 0,
    fullExtremeSwings: 0,
    hasGrizzled: false
  };
}

export function getSelfEsteemBand(value: number): SelfEsteemBand {
  const clamped = clamp(Math.round(value), SELF_ESTEEM_MIN, SELF_ESTEEM_MAX);
  if (clamped <= 19) {
    return "shaken";
  }
  if (clamped <= 39) {
    return "low";
  }
  if (clamped <= 69) {
    return "solid";
  }
  if (clamped <= 84) {
    return "cocky";
  }
  return "reckless";
}

export function getSelfEsteemStatusWord(value: number): "Shaken" | "Low" | "Solid" | "Cocky" | "Reckless" {
  const band = getSelfEsteemBand(value);
  if (band === "shaken") {
    return "Shaken";
  }
  if (band === "low") {
    return "Low";
  }
  if (band === "solid") {
    return "Solid";
  }
  if (band === "cocky") {
    return "Cocky";
  }
  return "Reckless";
}

export function getSelfEsteemTooltip(): string {
  return SELF_ESTEEM_TOOLTIP;
}

export function shouldIgnoreLikelyLossWarning(state: GameState, contractId: string): boolean {
  if (contractId === DAY_LABOR_CONTRACT_ID) {
    return false;
  }
  const chance = clamp(getSelfEsteemBandEffects(state).ignoreLikelyLossPrompt, 0, 0.99);
  if (chance <= 0) {
    return false;
  }
  return createRng(hashSeed(state.seed, state.day, contractId, "self-esteem-ignore-warning", state.selfEsteem.currentSelfEsteem)).bool(chance);
}

export function shouldEnforceStarterToolGate(bundle: ContentBundle): boolean {
  return STARTER_TOOL_IDS.every((toolId) => bundle.tools.some((tool) => tool.id === toolId));
}

export function getStarterKitProgress(actor: ActorState): {
  owned: number;
  total: number;
  allOwned: boolean;
  missingToolIds: string[];
  missingOshaCan: boolean;
} {
  const missingToolIds = STARTER_TOOL_IDS.filter((toolId) => !actor.tools[toolId]);
  const missingOshaCan = !Boolean(actor.oshaCanOwned);
  const total = STARTER_TOOL_IDS.length + 1;
  const owned = total - missingToolIds.length - (missingOshaCan ? 1 : 0);
  return {
    owned,
    total,
    allOwned: missingToolIds.length === 0 && !missingOshaCan,
    missingToolIds,
    missingOshaCan
  };
}

export function getSupplyInventoryUnits(inventory: SupplyInventory): number {
  return listInventoryEntries(inventory).reduce((sum, [, , quantity]) => sum + quantity, 0);
}

export function createInitialSkills(): Record<SkillId, number> {
  return Object.fromEntries(SKILL_IDS.map((skillId) => [skillId, 0])) as Record<SkillId, number>;
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
    "board-pack": { medium: 2 },
    "fastener-box": { medium: 3 },
    "pipe-kit": { medium: 1 },
    "wire-spool": { medium: 1 },
    "paint-bucket": { medium: 1 },
    "drywall-sheet-stack": { medium: 1 },
    "roof-shingle-bundle": { medium: 1 },
    "tile-box": { medium: 1 },
    "duct-kit": { medium: 1 },
    "concrete-mix": { medium: 1 },
    "trim-kit": { medium: 1 },
    "anchor-set": { medium: 1 }
  };
}

export function getWeekday(day: number): Weekday {
  return WEEKDAYS[(Math.max(1, day) - 1) % WEEKDAYS.length]!;
}

function findJobInBundle(bundle: ContentBundle, jobId: string): JobDef | null {
  return bundle.jobs.find((entry) => entry.id === jobId) ?? bundle.babaJobs.find((entry) => entry.id === jobId) ?? null;
}

export function formatSkillLabel(skillId: SkillId): string {
  return skillId
    .split("_")
    .map((word) => {
      if (word === "hvac") {
        return "HVAC";
      }
      if (word === "cnc") {
        return "CNC";
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function formatSkillCompactLabel(skillId: SkillId): string {
  const full = formatSkillLabel(skillId);
  if (full.length <= 12) {
    return full;
  }
  return full
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function formatSupplyQuality(quality: SupplyQuality): string {
  return QUALITY_LABELS[quality];
}

export function getSupplyUnitPrice(supply: ContentBundle["supplies"][number], quality: SupplyQuality, events: EventDef[] = []): number {
  return applyToolPriceModifiers(supply.prices[quality], events);
}

export function getSupplyQuantity(inventory: SupplyInventory, supplyId: string, quality?: SupplyQuality): number {
  const stack = inventory[supplyId];
  if (!stack) {
    return 0;
  }
  if (quality) {
    return Math.max(0, stack[quality] ?? 0);
  }
  return SUPPLY_QUALITIES.reduce((sum, tier) => sum + Math.max(0, stack[tier] ?? 0), 0);
}

export function getXpFloorForLevel(level: number): number {
  const normalizedLevel = Math.max(0, Math.floor(level));
  if (normalizedLevel <= 0) {
    return 0;
  }
  if (normalizedLevel === 1) {
    return 100;
  }
  if (normalizedLevel === 2) {
    return 250;
  }
  return 250 + (normalizedLevel - 2) * 200;
}

export function getXpCeilingForLevel(level: number): number | null {
  return getXpFloorForLevel(Math.max(0, Math.floor(level)) + 1);
}

export function getLevelForXp(xp: number): number {
  const normalizedXp = Math.max(0, xp);
  let level = 0;
  while (normalizedXp >= getXpFloorForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function getLevelProgress(xp: number): { level: number; current: number; needed: number | null; progress: number } {
  const normalizedXp = Math.max(0, xp);
  const level = getLevelForXp(normalizedXp);
  const floor = getXpFloorForLevel(level);
  const ceiling = getXpCeilingForLevel(level);
  const current = normalizedXp - floor;
  const needed = ceiling === null ? null : Math.max(0, ceiling - floor);
  return {
    level,
    current,
    needed,
    progress: needed && needed > 0 ? clamp(current / needed, 0, 1) : 1
  };
}

export function getOperatorLevel(actor: ActorState): {
  avgXp: number;
  level: number;
  current: number;
  needed: number | null;
  progress: number;
} {
  const totalXp = SKILL_IDS.reduce((sum, skillId) => sum + (actor.skills?.[skillId] ?? 0), 0);
  const avgXp = totalXp / SKILL_IDS.length;
  const progress = getLevelProgress(avgXp);
  return {
    avgXp,
    ...progress
  };
}

export function getSkillRank(actor: ActorState, skillId: SkillId): number {
  return getLevelForXp(actor.skills?.[skillId] ?? 0);
}

export function getCoreTrackRank(actor: ActorState, track: CoreTradeSkillId): number {
  if (track === "finish_carpentry") {
    return Math.max(getSkillRank(actor, "cabinet_maker"), getSkillRank(actor, "millworker"));
  }
  return getSkillRank(actor, track as SkillId);
}

export function getSkillDisplayRows(actor: ActorState): Array<{
  skillId: SkillId;
  level: number;
  xp: number;
  current: number;
  needed: number | null;
  progress: number;
}> {
  return SKILL_IDS.map((skillId) => ({
    skillId,
    xp: actor.skills[skillId] ?? 0,
    ...getLevelProgress(actor.skills[skillId] ?? 0)
  })).sort((a, b) => b.level - a.level || b.xp - a.xp || a.skillId.localeCompare(b.skillId));
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

export function getVisibleTaskActions(
  state: GameState,
  bundle: ContentBundle
): Array<{ stance: TaskStance; allowOvertime: boolean }> {
  if (!state.activeJob) {
    return [];
  }

  const activeTask = getCurrentTask(state);
  if (!activeTask) {
    return [];
  }

  const job = findJobInBundle(bundle, state.activeJob?.jobId ?? "");
  const district = bundle.districts.find((entry) => entry.id === state.activeJob?.districtId);
  if (!job || !district) {
    return [];
  }

  const mapping = getTaskSkillMapping(job, activeTask.taskId);
  const skillRank = getTaskSkillRank(state.player, mapping);
  const difficulty = getTaskDifficulty(activeTask.taskId, job, district, getActiveEvents(bundle, state.activeEventIds));
  const regularTicksLeft = getRemainingRegularTicks(state.workday);

  const actions = activeTask.availableStances.flatMap((stance) => {
    const effectiveStance = activeTask.qualityBearing || activeTask.taskId === "refuel_at_station" ? stance : "standard";
    const timing =
      activeTask.taskId === "refuel_at_station"
        ? { timeOutcome: "standard" as const, ticksSpent: getRefuelTaskTicks(effectiveStance) }
        : resolveTiming(state, job, activeTask, effectiveStance, skillRank, difficulty);
    if (canSpendTicks(state.workday, timing.ticksSpent, false)) {
      return [{ stance, allowOvertime: false }];
    }
    if (canSpendTicks(state.workday, timing.ticksSpent, true)) {
      return [{ stance, allowOvertime: true }];
    }
    return [];
  });

  if (actions.length === 0 && activeTask.taskId === "return_to_shop" && regularTicksLeft > 0) {
    return [{ stance: "standard", allowOvertime: false }];
  }

  return actions;
}

export function getSettlementPreview(state: GameState, bundle: ContentBundle): SettlementPreview | null {
  const activeJob = state.activeJob;
  if (!activeJob) {
    return null;
  }

  const job = findJobInBundle(bundle, activeJob.jobId);
  if (!job) {
    return null;
  }

  const events = getActiveEvents(bundle, state.activeEventIds);
  const effectiveQualityPoints = activeJob.qualityPoints + activeJob.partsQualityModifier;
  const failChance = getSettlementFailChance(state, activeJob, job, events, effectiveQualityPoints, state.day);
  const neutralWarning = isForcedNeutral(job, events)
    ? "Current event conditions can force a low-quality half-pay result."
    : effectiveQualityPoints <= -2
      ? "Current quality is low enough to trigger half pay."
      : "Low quality can still reduce payment to half.";

  return {
    successCash: Math.max(0, activeJob.lockedPayout),
    neutralCash: Math.max(0, Math.round(activeJob.lockedPayout * 0.5)),
    failCash: 0,
    riskBand: getRiskBandFromFailChance(failChance),
    neutralWarning
  };
}

export function getContractEconomyPreview(state: GameState, bundle: ContentBundle, contractId: string): ContractEconomyPreview | null {
  const picked = getJobByContract(state, bundle, contractId);
  if (!picked) {
    return null;
  }

  const events = getActiveEvents(bundle, state.activeEventIds);
  const district = getDistrict(bundle, picked.job.districtId);
  const grossPayout = getContractAutoBidPreview(state, bundle, contractId)?.acceptedPayout ?? getQuotedPayoutForOffer(state, bundle, picked, events);
  if (contractId === DAY_LABOR_CONTRACT_ID) {
    return {
      grossPayout,
      materialsCost: 0,
      fuelCost: 0,
      trashCost: 0,
      estimatedTotalCost: 0,
      projectedNetOnSuccess: grossPayout,
      biggestCostDriver: "none"
    };
  }
  const materialRouting = getJobMaterialRoutingPlan(picked.job, state.shopSupplies, state.truckSupplies);
  const needsSupplier = materialRouting.needsSupplier;
  const materialsCost = estimateMaterialPurchaseCost(state, bundle, picked.job, events);
  const fuelCost = estimateContractRouteFuelCost(district, needsSupplier, state.operations.facilities.storageOwned);
  const trashCost = estimateTrashHandlingCost(state, picked.job);
  const estimatedTotalCost = materialsCost + fuelCost + trashCost;

  return {
    grossPayout,
    materialsCost,
    fuelCost,
    trashCost,
    estimatedTotalCost,
    projectedNetOnSuccess: grossPayout - estimatedTotalCost,
    biggestCostDriver: getLargestEstimatedCostDriver(materialsCost, fuelCost, trashCost)
  };
}

export function getContractEstimateSnapshot(state: GameState, bundle: ContentBundle, contractId: string): ContractEstimateSnapshot | null {
  return getContractEconomyPreview(state, bundle, contractId);
}

export function getContractQuotedPayout(state: GameState, bundle: ContentBundle, contractId: string): number | null {
  const picked = getJobByContract(state, bundle, contractId);
  if (!picked) {
    return null;
  }
  const events = getActiveEvents(bundle, state.activeEventIds);
  return getContractAutoBidPreview(state, bundle, contractId)?.acceptedPayout ?? getQuotedPayoutForOffer(state, bundle, picked, events);
}

export function getContractAutoBidPreview(state: GameState, bundle: ContentBundle, contractId: string): ContractAutoBidPreview | null {
  const picked = getJobByContract(state, bundle, contractId);
  if (!picked) {
    return null;
  }
  const events = getActiveEvents(bundle, state.activeEventIds);
  const quotedBase = getQuotedPayoutForOffer(state, bundle, picked, events);
  const isBaba = picked.job.tags.includes("baba-g");
  if (isBaba || contractId === DAY_LABOR_CONTRACT_ID) {
    return {
      baseQuote: quotedBase,
      autoBid: quotedBase,
      acceptedPayout: quotedBase,
      estimatingLevel: state.perks.corePerks.estimating ?? 0,
      bidAccuracyBandPct: 0,
      bidNoise: 0,
      isBaba
    };
  }

  const estimatingLevel = Math.max(0, state.perks.corePerks.estimating ?? 0);
  const track = mapSkillToCoreTrack(picked.job.primarySkill);
  const coreTrackRank = track ? getCoreTrackRank(state.player, track) : 0;
  const quoteBoostPct =
    Math.min(0.2, coreTrackRank * 0.02) + Math.min(0.15, estimatingLevel * 0.015) + Math.min(0.12, state.player.reputation / 600);
  const baseQuote = Math.max(0, Math.round(quotedBase * (1 + quoteBoostPct)));
  const bidAccuracyBandPct = clamp(0.30 - estimatingLevel * 0.03, 0.06, 0.30);
  const rng = createRng(hashSeed(state.seed, state.day, contractId, "auto-bid", estimatingLevel));
  const bidNoise = rng.next() * 2 - 1;
  const multiplier = clamp(1 + bidNoise * bidAccuracyBandPct, 0.75, 1.25);
  const autoBid = Math.max(0, Math.round(baseQuote * multiplier));
  const minimumPayout = getMinimumContractPayout(state, bundle, picked.job);
  return {
    baseQuote,
    autoBid,
    acceptedPayout: Math.max(autoBid, minimumPayout),
    estimatingLevel,
    bidAccuracyBandPct,
    bidNoise,
    isBaba: false
  };
}

export function getActiveJobSpendPreview(state: GameState, bundle: ContentBundle): ActiveJobSpendPreview | null {
  const activeJob = state.activeJob;
  if (!activeJob) {
    return null;
  }

  const job = findJobInBundle(bundle, activeJob.jobId);
  if (!job) {
    return null;
  }

  const events = getActiveEvents(bundle, state.activeEventIds);
  const district = getDistrict(bundle, activeJob.districtId);
  const materialsCost = estimateMaterialPurchaseCost(state, bundle, job, events, activeJob);
  const fuelCost = getRemainingTravelFuelUnits(activeJob, district) * FUEL_PRICE;
  const trashCost = estimateTrashHandlingCost(state, job, activeJob);
  const spentSoFar = getContractExpenseTotalFromLog(state, activeJob.contractId);
  const estimatedRemainingCost = materialsCost + fuelCost + trashCost;
  const estimatedTotalCost = spentSoFar + estimatedRemainingCost;
  const grossPayout = Math.max(0, activeJob.lockedPayout);

  return {
    grossPayout,
    materialsCost,
    fuelCost,
    trashCost,
    estimatedTotalCost,
    projectedNetOnSuccess: grossPayout - estimatedTotalCost,
    spentSoFar,
    estimatedRemainingCost
  };
}

export function getContractActualSnapshot(state: GameState, contractId: string): ContractActualSnapshot | null {
  const contractLines = state.log.filter((entry) => entry.actorId === state.player.actorId && entry.contractId === contractId);
  if (contractLines.length === 0) {
    return null;
  }

  let payout = 0;
  let materialsCost = 0;
  let fuelCost = 0;
  let trashCost = 0;
  let otherCost = 0;

  for (const entry of contractLines) {
    const message = entry.message;
    const payoutMatch = message.match(/Collected (?:success|neutral|fail) payment: cash ([+-]?[0-9]+)/i);
    if (payoutMatch) {
      payout += parseSignedInt(payoutMatch[1]);
      continue;
    }
    const halfPayMatch = message.match(/half pay: cash \+([0-9]+)/i);
    if (halfPayMatch) {
      payout += parseSignedInt(halfPayMatch[1]);
      continue;
    }

    const breakdown = parseContractCostBreakdown(message);
    materialsCost += breakdown.materials;
    fuelCost += breakdown.fuel;
    trashCost += breakdown.trash;
    otherCost += breakdown.other;
  }

  const totalCost = Math.max(0, materialsCost + fuelCost + trashCost + otherCost);
  if (payout === 0 && totalCost === 0) {
    return null;
  }

  return {
    payout,
    materialsCost,
    fuelCost,
    trashCost,
    otherCost,
    totalCost,
    net: payout - totalCost,
    biggestCostDriver: getLargestActualCostDriver(materialsCost, fuelCost, trashCost, otherCost)
  };
}

export function getJobProfitRecap(state: GameState, contractId: string): JobProfitRecap | null {
  const actual = getContractActualSnapshot(state, contractId);
  if (!actual) {
    return null;
  }

  const estimate = getStoredEstimateAtAccept(state, contractId) ?? {
    grossPayout: actual.payout,
    materialsCost: 0,
    fuelCost: 0,
    trashCost: 0,
    estimatedTotalCost: 0,
    projectedNetOnSuccess: actual.payout,
    biggestCostDriver: "none"
  };

  const latestLine = [...state.log].reverse().find((entry) => entry.actorId === state.player.actorId && entry.contractId === contractId);
  const acceptedLine = state.log.find(
    (entry) => entry.actorId === state.player.actorId && entry.contractId === contractId && /^Accepted (.+) for \$([0-9]+)/i.test(entry.message)
  );
  const acceptedMatch = acceptedLine?.message.match(/^Accepted (.+) for \$([0-9]+)/i);
  const deferred = state.deferredJobs.find((entry) => entry.activeJob.contractId === contractId);
  const fallbackJobName =
    (state.activeJob?.contractId === contractId ? state.activeJob.jobId : null) ??
    (deferred ? deferred.activeJob.jobId : null) ??
    contractId;
  const jobName = acceptedMatch?.[1] ?? fallbackJobName;
  const deltaNet = actual.net - estimate.projectedNetOnSuccess;
  const contractFile = state.contractFiles.find((entry) => entry.contractId === contractId) ?? null;
  const estimatedHoursAtAccept =
    contractFile?.estimatedHoursAtAccept ??
    ticksToHours(
      (state.activeJob?.contractId === contractId ? state.activeJob.plannedTicks : 0) ||
        (deferred ? deferred.activeJob.plannedTicks : 0)
    );
  const actualHoursAtClose =
    contractFile?.actualHoursAtClose ??
    ticksToHours(
      (state.activeJob?.contractId === contractId ? state.activeJob.actualTicksSpent : 0) ||
        (deferred ? deferred.activeJob.actualTicksSpent : 0)
    );
  const summaryLine =
    actual.payout < estimate.grossPayout
      ? "Quality payout reduction"
      : actual.totalCost > estimate.estimatedTotalCost + 15
        ? `Cost overrun: ${formatCostDriverLabel(actual.biggestCostDriver)}`
        : "Estimate held within expected variance";

  return {
    contractId,
    jobName,
    estimate,
    actual,
    deltaNet,
    summaryLine,
    day: latestLine?.day ?? state.day,
    estimatedHoursAtAccept,
    actualHoursAtClose
  };
}

export function getCurrentTaskGuidance(state: GameState, bundle: ContentBundle): string | null {
  if (!state.activeJob) {
    return null;
  }

  const activeTask = getCurrentTask(state);
  if (!activeTask) {
    return "Next step: Close out the active job.";
  }

  const job = findJobInBundle(bundle, state.activeJob?.jobId ?? "");
  if (!job) {
    return getDefaultTaskGuidance(activeTask.taskId);
  }

  const blockedReason = getTaskBlockedReason(state, bundle, activeTask, job);
  if (blockedReason) {
    return getBlockedTaskGuidance(activeTask.taskId, blockedReason, state.activeJob);
  }

  if (activeTask.taskId === "load_from_shop") {
    return getLoadFromShopGuidance(state, bundle, job);
  }

  return getDefaultTaskGuidance(activeTask.taskId);
}

export function getJobByContract(state: GameState, bundle: ContentBundle, contractId: string): { contract: ContractInstance; job: JobDef } | null {
  if (contractId === DAY_LABOR_CONTRACT_ID) {
    return getDayLaborOffer(state, bundle);
  }
  if (isBabaRotatingContractId(contractId)) {
    const rotatingOffer = getRotatingBabaOffer(state, bundle);
    if (!rotatingOffer || rotatingOffer.contract.contractId !== contractId) {
      return null;
    }
    return rotatingOffer;
  }
  if (isUnlockedFallbackContractId(contractId)) {
    const fallbackOffer = getUnlockedFallbackTradeOffer(state, bundle);
    if (!fallbackOffer || fallbackOffer.contract.contractId !== contractId) {
      return null;
    }
    return fallbackOffer;
  }
  const contract = state.contractBoard.find((entry) => entry.contractId === contractId);
  if (!contract) {
    return null;
  }
  const job = findJobInBundle(bundle, contract.jobId);
  if (!job) {
    return null;
  }
  return { contract, job };
}

export function getAvailableContractOffers(state: GameState, bundle: ContentBundle): ContractOffer[] {
  const boardOffers = state.contractBoard
    .map((contract) => getJobByContract(state, bundle, contract.contractId))
    .filter((offer): offer is ContractOffer => Boolean(offer));
  const standardOffers = boardOffers.filter((offer) => {
    if (offer.job.tags.includes("baba-g")) {
      return false;
    }
    const track = mapSkillToCoreTrack(offer.job.primarySkill);
    return Boolean(track && isCoreTrackUnlocked(state, track));
  });
  const rotatingBabaOffer = getRotatingBabaOffer(state, bundle);
  const unlockedFallbackOffer = !state.activeJob && standardOffers.length === 0 ? getUnlockedFallbackTradeOffer(state, bundle) : null;
  return [getDayLaborOffer(state, bundle), ...(rotatingBabaOffer ? [rotatingBabaOffer] : []), ...standardOffers, ...(unlockedFallbackOffer ? [unlockedFallbackOffer] : [])];
}

export function getFilteredContractOffers(state: GameState, bundle: ContentBundle, filters: ContractFilterId[]): ContractOffer[] {
  const activeFilters = [...new Set(filters)];
  if (activeFilters.length === 0) {
    return getAvailableContractOffers(state, bundle);
  }

  const offers = getAvailableContractOffers(state, bundle);
  return offers.filter((offer) => {
    if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID) {
      return true;
    }

    const preview = getContractEstimateSnapshot(state, bundle, offer.contract.contractId);
    if (!preview) {
      return false;
    }

    const checks = {
      profitable: preview.projectedNetOnSuccess >= 0,
      "low-risk": offer.job.risk <= 0.25,
      "near-route": preview.fuelCost <= FUEL_PRICE * 2,
      "no-new-tools": hasUsableTools(state.player, offer.job.requiredTools)
    } as const;

    return activeFilters.every((filterId) => checks[filterId]);
  });
}

function getDayLaborOffer(state: GameState, bundle: ContentBundle): ContractOffer {
  const remainingTicks = getRemainingDayLaborTicks(state.workday);
  const hours = ticksToHours(remainingTicks);
  const payout = Math.max(0, Math.round(hours * MINIMUM_WAGE_PER_HOUR));
  const fallbackDistrictId = state.activeJob?.districtId ?? state.player.districtUnlocks[0] ?? bundle.districts[0]?.id ?? "residential";

  return {
    contract: {
      contractId: DAY_LABOR_CONTRACT_ID,
      jobId: DAY_LABOR_JOB_ID,
      districtId: fallbackDistrictId,
      payoutMult: 1,
      expiresDay: state.day
    },
    job: {
      id: DAY_LABOR_JOB_ID,
      name: "Day Laborer",
      primarySkill: "carpenter",
      tier: 0,
      districtId: fallbackDistrictId,
      requiredTools: [],
      trashUnits: 0,
      staminaCost: 0,
      basePayout: payout,
      risk: 0,
      repGainSuccess: 0,
      repLossFail: 0,
      durabilityCost: 0,
      workUnits: Math.max(1, remainingTicks),
      materialNeeds: [],
      tags: ["fallback", "cashflow"],
      flavor: {
        client_quote: `Take whatever field labor is on offer for ${hours.toFixed(1)} hours at minimum wage.`,
        success_line: "The shift paid enough to keep the truck moving.",
        fail_line: "The labor pool sent you home early.",
        neutral_line: "The shift was forgettable, but the cash cleared."
      }
    },
    alwaysAvailable: true
  };
}

export function setSupplierCartQuantity(
  state: GameState,
  supplyId: string,
  quality: SupplyQuality,
  quantity: number
): StateTransitionResult<SupplyInventory> {
  if (!state.activeJob) {
    return { nextState: state, notice: "No active job.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  setInventoryQuantity(nextState.activeJob!.supplierCart, supplyId, quality, quantity);
  awardOfficeSkillXp(nextState, { reading: 1 });
  awardPerkXp(nextState, 1);

  return {
    nextState,
    payload: cloneSupplyInventory(nextState.activeJob!.supplierCart),
    digest: digestState(nextState)
  };
}

export function acceptContract(state: GameState, bundle: ContentBundle, contractId: string): StateTransitionResult<ActiveJobState> {
  if (contractId === DAY_LABOR_CONTRACT_ID) {
    return runDayLaborShift(state, bundle);
  }

  if (state.activeJob) {
    return { nextState: state, notice: "Finish the current job first.", digest: digestState(state) };
  }

  if (state.operations.facilities.dumpsterEnabled && state.yard.dumpsterUnits >= state.yard.dumpsterCapacity) {
    return { nextState: state, notice: "Dumpster is full. Empty it in Office > Yard before taking another job.", digest: digestState(state) };
  }

  const picked = getJobByContract(state, bundle, contractId);
  if (!picked) {
    return { nextState: state, notice: "That contract is no longer available.", digest: digestState(state) };
  }

  if (!picked.job.tags.includes("baba-g")) {
    const track = mapSkillToCoreTrack(picked.job.primarySkill);
    if (!track || !isCoreTrackUnlocked(state, track)) {
      return { nextState: state, notice: "That trade is still locked. Unlock it by finishing Baba G jobs.", digest: digestState(state) };
    }
  }

  if (!hasUsableTools(state.player, picked.job.requiredTools)) {
    return { nextState: state, notice: "Missing usable tools for that contract.", digest: digestState(state) };
  }

  if (!canStageJobMaterialsWithCurrentTruckLoad(picked.job, state.truckSupplies)) {
    return {
      nextState: state,
      notice: "Truck storage is too full to stage required materials. Clear truck/storage inventory first.",
      digest: digestState(state)
    };
  }

  const district = bundle.districts.find((entry) => entry.id === picked.job.districtId);
  if (!district) {
    return { nextState: state, notice: "Unknown district.", digest: digestState(state) };
  }

  const events = getActiveEvents(bundle, state.activeEventIds);
  const bidPreview = getContractAutoBidPreview(state, bundle, contractId);
  const lockedPayout = bidPreview?.acceptedPayout ?? getQuotedPayoutForOffer(state, bundle, picked, events);
  const materialRouting = getJobMaterialRoutingPlan(picked.job, state.shopSupplies, state.truckSupplies);
  const needsSupplier = materialRouting.needsSupplier;
  const requiresShopLoad = materialRouting.requiresShopLoad;
  const tasks = createTaskTemplate(
    picked.job,
    district,
    needsSupplier,
    requiresShopLoad,
    state.operations.facilities.storageOwned
  );
  const estimateAtAccept =
    getContractEstimateSnapshot(state, bundle, contractId) ?? {
      grossPayout: lockedPayout,
      materialsCost: 0,
      fuelCost: 0,
      trashCost: 0,
      estimatedTotalCost: 0,
      projectedNetOnSuccess: lockedPayout,
      biggestCostDriver: "none"
    };

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
    reservedMaterials: {},
    partsQuality: null,
    partsQualityScore: 1,
    partsQualityModifier: 0,
    estimateAtAccept,
    recoveryMode: "none",
    deferredAtDay: null,
    trashUnitsPending: 0,
    siteSupplies: {},
    supplierCart: {},
    tasks
  };
  resetJobRerollTokens(nextState);
  const plannedHoursAtAccept = ticksToHours(tasks.reduce((sum, task) => sum + task.requiredUnits * task.baseTicks, 0));
  const contractFile: ContractFileSnapshot = {
    contractId: picked.contract.contractId,
    jobId: picked.job.id,
    jobName: picked.job.name,
    dayAccepted: state.day,
    dayClosed: null,
    isBaba: picked.job.tags.includes("baba-g"),
    baseQuote: bidPreview?.baseQuote ?? lockedPayout,
    autoBid: bidPreview?.autoBid ?? lockedPayout,
    acceptedPayout: lockedPayout,
    estimatingLevelAtBid: bidPreview?.estimatingLevel ?? Math.max(0, state.perks.corePerks.estimating ?? 0),
    bidAccuracyBandPct: bidPreview?.bidAccuracyBandPct ?? 0,
    bidNoise: bidPreview?.bidNoise ?? 0,
    estimatedHoursAtAccept: plannedHoursAtAccept,
    actualHoursAtClose: 0,
    estimatedNetAtAccept: estimateAtAccept.projectedNetOnSuccess,
    actualNetAtClose: 0,
    outcome: null,
    status: "active"
  };
  nextState.contractFiles = upsertContractFile(nextState.contractFiles, contractFile);
  awardOfficeSkillXp(nextState, { reading: 1 });
  awardPerkXp(nextState, 1);
  nextState.contractBoard = [];
  if (!contractFile.isBaba) {
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId,
      message: `Auto-bid submitted: $${contractFile.autoBid} (Estimating Lv ${contractFile.estimatingLevelAtBid}, band ±${Math.round(
        contractFile.bidAccuracyBandPct * 100
      )}%).`
    });
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId,
      message: `Client accepted bid at $${contractFile.acceptedPayout}.`
    });
  }
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId,
    message: `Accepted ${picked.job.name} for $${lockedPayout}.`
  });
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId,
    message: `Estimate at accept: Gross $${estimateAtAccept.grossPayout}, Costs $${estimateAtAccept.estimatedTotalCost}, Net ${formatSignedCurrency(
      estimateAtAccept.projectedNetOnSuccess
    )}, Driver ${estimateAtAccept.biggestCostDriver}.`
  });

  return {
    nextState,
    payload: cloneActiveJob(nextState.activeJob),
    digest: digestState(nextState)
  };
}

export function runDayLaborShift(state: GameState, bundle: ContentBundle): StateTransitionResult {
  return settleDayLaborShift(state, bundle, { success: true, payout: getDayLaborOffer(state, bundle).job.basePayout });
}

export function resolveDayLaborMinigameResult(
  state: GameState,
  bundle: ContentBundle,
  result: DayLaborMinigameResult
): StateTransitionResult {
  const detailLine = [
    `Mini-game ${result.success ? "success" : "failed"}`,
    `Score ${Math.max(0, Math.round(result.score))}`,
    `Excavate ${Math.round(clamp(result.excavationAccuracy, 0, 1) * 100)}%`,
    `Backfill Accuracy ${Math.round(clamp(result.backfillAccuracy, 0, 1) * 100)}%`,
    `Time ${(Math.max(0, result.timeUsedMs) / 1000).toFixed(1)}s`
  ]
    .concat(result.failureReason ? [result.failureReason] : [])
    .join(" | ");

  const payout = result.success ? getDayLaborOffer(state, bundle).job.basePayout : 0;
  return settleDayLaborShift(state, bundle, {
    success: result.success,
    payout,
    detailLines: [detailLine]
  });
}

function settleDayLaborShift(
  state: GameState,
  bundle: ContentBundle,
  options: {
    success: boolean;
    payout: number;
    detailLines?: string[];
  }
): StateTransitionResult {
  const offer = getDayLaborOffer(state, bundle);
  const requiredTicks = getRemainingDayLaborTicks(state.workday);
  if (requiredTicks <= 0) {
    return { nextState: state, notice: "No shift hours remain for day labor.", digest: digestState(state) };
  }
  if (!canSpendTicks(state.workday, requiredTicks, false)) {
    return { nextState: state, notice: "No shift hours remain for day labor.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  spendTicks(nextState.workday, requiredTicks);
  const payout = Math.max(0, Math.round(options.payout));
  nextState.player.cash += payout;
  if (options.success) {
    awardOfficeSkillXp(nextState, { reading: 1 });
    awardPerkXp(nextState, 2);
    applySelfEsteemDelta(nextState, 5);
  } else {
    applySelfEsteemDelta(nextState, -3);
  }

  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId: DAY_LABOR_CONTRACT_ID,
    message: `${nextState.player.name} worked a day-labor shift for ${formatHours(requiredTicks)} and earned $${payout}.`
  });
  for (const detailLine of options.detailLines ?? []) {
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId: DAY_LABOR_CONTRACT_ID,
      message: detailLine
    });
  }

  return {
    nextState,
    notice: options.success
      ? `Day Laborer paid $${offer.job.basePayout} for ${formatHours(requiredTicks)} at minimum wage.`
      : `Day Laborer shift failed for ${formatHours(requiredTicks)} and earned $0.`,
    digest: digestState(nextState)
  };
}

export function getCrewCapacity(): number {
  return CREW_TEMPLATES.length;
}

function normalizeSelfEsteemState(state: Partial<GameState["selfEsteem"]> | null | undefined): GameState["selfEsteem"] {
  const base = createInitialSelfEsteemState();
  const normalized: GameState["selfEsteem"] = {
    currentSelfEsteem: clamp(Math.round(state?.currentSelfEsteem ?? base.currentSelfEsteem), SELF_ESTEEM_MIN, SELF_ESTEEM_MAX),
    dailySelfEsteemDrift: Math.max(1, Math.floor(state?.dailySelfEsteemDrift ?? base.dailySelfEsteemDrift)),
    lifetimeTimesAtZero: Math.max(0, Math.floor(state?.lifetimeTimesAtZero ?? base.lifetimeTimesAtZero)),
    lifetimeTimesAtHundred: Math.max(0, Math.floor(state?.lifetimeTimesAtHundred ?? base.lifetimeTimesAtHundred)),
    fullExtremeSwings: Math.max(0, Math.floor(state?.fullExtremeSwings ?? base.fullExtremeSwings)),
    hasGrizzled: Boolean(state?.hasGrizzled ?? base.hasGrizzled)
  };
  if (hasUnlockedGrizzled(normalized)) {
    normalized.hasGrizzled = true;
  }
  return normalized;
}

function hasUnlockedGrizzled(selfEsteem: GameState["selfEsteem"]): boolean {
  return (
    (selfEsteem.lifetimeTimesAtZero >= 10 && selfEsteem.lifetimeTimesAtHundred >= 10) ||
    selfEsteem.fullExtremeSwings >= 10
  );
}

function scaleTowardZero(value: number, factor: number): number {
  if (value > 0) {
    return Math.floor(value * factor);
  }
  if (value < 0) {
    return Math.ceil(value * factor);
  }
  return 0;
}

function getSelfEsteemBandEffects(state: GameState): SelfEsteemBandEffects {
  const band = getSelfEsteemBand(state.selfEsteem.currentSelfEsteem);
  const base = SELF_ESTEEM_BAND_EFFECTS[band];
  const ignoreChance = state.selfEsteem.hasGrizzled
    ? base.ignoreLikelyLossPrompt * SELF_ESTEEM_GRIZZLED_IGNORE_REDUCTION
    : base.ignoreLikelyLossPrompt;

  if (!state.selfEsteem.hasGrizzled || (band !== "shaken" && band !== "reckless")) {
    return {
      ...base,
      ignoreLikelyLossPrompt: ignoreChance
    };
  }

  return {
    qualityRoll: base.qualityRoll < 0 ? scaleTowardZero(base.qualityRoll, SELF_ESTEEM_EXTREME_PENALTY_SCALE) : base.qualityRoll,
    fastChance: base.fastChance < 0 ? scaleTowardZero(base.fastChance, SELF_ESTEEM_EXTREME_PENALTY_SCALE) : base.fastChance,
    reworkChance: base.reworkChance > 0 ? scaleTowardZero(base.reworkChance, SELF_ESTEEM_EXTREME_PENALTY_SCALE) : base.reworkChance,
    delayChance: base.delayChance > 0 ? scaleTowardZero(base.delayChance, SELF_ESTEEM_EXTREME_PENALTY_SCALE) : base.delayChance,
    settlementFailChance:
      base.settlementFailChance > 0
        ? base.settlementFailChance * SELF_ESTEEM_EXTREME_PENALTY_SCALE
        : base.settlementFailChance,
    ignoreLikelyLossPrompt: ignoreChance
  };
}

function noteSelfEsteemExtremeIfReached(selfEsteem: GameState["selfEsteem"], previousValue: number, nextValue: number): void {
  const hitZero = previousValue !== 0 && nextValue === 0;
  if (hitZero) {
    selfEsteem.lifetimeTimesAtZero += 1;
    if (selfEsteem.lifetimeTimesAtHundred > selfEsteem.fullExtremeSwings) {
      selfEsteem.fullExtremeSwings += 1;
    }
  }
  const hitHundred = previousValue !== 100 && nextValue === 100;
  if (hitHundred) {
    selfEsteem.lifetimeTimesAtHundred += 1;
    if (selfEsteem.lifetimeTimesAtZero > selfEsteem.fullExtremeSwings) {
      selfEsteem.fullExtremeSwings += 1;
    }
  }
  if (hasUnlockedGrizzled(selfEsteem)) {
    selfEsteem.hasGrizzled = true;
  }
}

function applySelfEsteemDelta(state: GameState, delta: number): void {
  const step = Math.round(delta);
  if (step === 0) {
    return;
  }
  const previousValue = clamp(Math.round(state.selfEsteem.currentSelfEsteem), SELF_ESTEEM_MIN, SELF_ESTEEM_MAX);
  const nextValue = clamp(previousValue + step, SELF_ESTEEM_MIN, SELF_ESTEEM_MAX);
  state.selfEsteem.currentSelfEsteem = nextValue;
  noteSelfEsteemExtremeIfReached(state.selfEsteem, previousValue, nextValue);
}

function applyDailySelfEsteemUpdate(state: GameState): void {
  const sortedEventIds = [...state.activeEventIds].sort((left, right) => left.localeCompare(right));
  let eventSwing = createRng(hashSeed(state.seed, state.day, ...sortedEventIds, "self-esteem-event-swing")).nextInt(7) - 3;
  if (state.selfEsteem.hasGrizzled) {
    eventSwing = scaleTowardZero(eventSwing, 0.5);
  }
  applySelfEsteemDelta(state, eventSwing);

  const driftBudget = state.selfEsteem.dailySelfEsteemDrift + (state.selfEsteem.hasGrizzled ? 1 : 0);
  const toCenter = SELF_ESTEEM_CENTER - state.selfEsteem.currentSelfEsteem;
  const towardCenter = Math.sign(toCenter) * Math.min(Math.abs(toCenter), Math.max(0, driftBudget));
  applySelfEsteemDelta(state, towardCenter);
}

export function normalizeGameState(state: Partial<GameState>): GameState {
  const legacyDefaults =
    state.research === undefined &&
    state.officeSkills === undefined &&
    state.yard === undefined &&
    state.operations === undefined &&
    state.perks === undefined;
  const normalizedPlayer = {
    ...state.player!,
    crews: (state.player?.crews ?? []).map((crew) => ({
      ...crew,
      stamina: crew.stamina ?? crew.staminaMax
    }))
  };
  const normalizeActiveJobState = (activeJob: Partial<ActiveJobState> | null | undefined): ActiveJobState | null => {
    if (!activeJob) {
      return null;
    }
    return {
      ...(activeJob as ActiveJobState),
      assignee: "self",
      staminaCommitted: activeJob.staminaCommitted ?? false,
      reservedMaterials: normalizeSupplyInventory(activeJob.reservedMaterials),
      partsQuality: activeJob.partsQuality ?? null,
      partsQualityScore: activeJob.partsQualityScore ?? 1,
      partsQualityModifier: activeJob.partsQualityModifier ?? 0,
      estimateAtAccept: {
        grossPayout: Math.max(0, activeJob.estimateAtAccept?.grossPayout ?? activeJob.lockedPayout ?? 0),
        materialsCost: Math.max(0, activeJob.estimateAtAccept?.materialsCost ?? 0),
        fuelCost: Math.max(0, activeJob.estimateAtAccept?.fuelCost ?? 0),
        trashCost: Math.max(0, activeJob.estimateAtAccept?.trashCost ?? 0),
        estimatedTotalCost: Math.max(0, activeJob.estimateAtAccept?.estimatedTotalCost ?? 0),
        projectedNetOnSuccess: activeJob.estimateAtAccept?.projectedNetOnSuccess ?? (activeJob.lockedPayout ?? 0),
        biggestCostDriver:
          activeJob.estimateAtAccept?.biggestCostDriver === "materials" ||
          activeJob.estimateAtAccept?.biggestCostDriver === "fuel" ||
          activeJob.estimateAtAccept?.biggestCostDriver === "trash"
            ? activeJob.estimateAtAccept.biggestCostDriver
            : "none"
      },
      recoveryMode: (activeJob.recoveryMode as ActiveRecoveryMode | undefined) ?? "none",
      deferredAtDay: activeJob.deferredAtDay ?? null,
      trashUnitsPending: Math.max(0, Math.floor(activeJob.trashUnitsPending ?? 0)),
      siteSupplies: normalizeSupplyInventory(activeJob.siteSupplies),
      supplierCart: normalizeSupplyInventory(activeJob.supplierCart),
      tasks: (activeJob.tasks ?? []).map((task) =>
        task.taskId === "refuel_at_station"
          ? {
              ...task,
              requiredUnits: 0,
              completedUnits: 0
            }
          : { ...task }
      )
    };
  };
  const normalizeActorState = (actor: Partial<ActorState> | null | undefined, fallbackId: string): ActorState => {
    const normalizedFuelMax = Math.max(FUEL_TANK_MAX, Math.floor(actor?.fuelMax ?? FUEL_TANK_MAX));
    const normalizedFuel = Math.max(0, Math.min(normalizedFuelMax, Math.floor(actor?.fuel ?? 0)));
    return {
      ...(actor as ActorState),
      actorId: actor?.actorId ?? fallbackId,
      name: actor?.name ?? fallbackId,
      companyName: actor?.companyName ?? actor?.name ?? fallbackId,
      cash: Math.max(0, Math.floor(actor?.cash ?? 0)),
      reputation: Math.max(0, Math.floor(actor?.reputation ?? 0)),
      companyLevel: Math.max(1, Math.floor(actor?.companyLevel ?? 1)),
      districtUnlocks: Array.isArray(actor?.districtUnlocks) ? [...actor!.districtUnlocks] : [],
      staminaMax: Math.max(1, Math.floor(actor?.staminaMax ?? 4)),
      stamina: Math.max(0, Math.floor(actor?.stamina ?? actor?.staminaMax ?? 4)),
      fuel: normalizedFuel,
      fuelMax: normalizedFuelMax,
      oshaCanOwned: Boolean(actor?.oshaCanOwned ?? false),
      skills: { ...createEmptySkills(), ...(actor?.skills ?? {}) },
      tools: Object.fromEntries(
        Object.entries(actor?.tools ?? {}).map(([toolId, tool]) => [
          toolId,
          {
            toolId: tool?.toolId ?? toolId,
            durability: Math.max(0, Math.floor(tool?.durability ?? 0))
          }
        ])
      ),
      crews: (actor?.crews ?? []).map((crew) => ({
        ...crew,
        stamina: crew.stamina ?? crew.staminaMax
      }))
    };
  };
  const normalizeBotCareerState = (career: Partial<BotCareerState> | null | undefined, index: number): BotCareerState | null => {
    if (!career?.actor) {
      return null;
    }
    const actor = normalizeActorState(career.actor, `bot-${index + 1}`);
    const normalizedActiveJob = normalizeActiveJobState(career.activeJob);
    return {
      actor,
      activeJob: normalizedActiveJob,
      contractBoard: Array.isArray(career.contractBoard) ? career.contractBoard.map((entry) => ({ ...entry })) : [],
      log: Array.isArray(career.log) ? career.log.map((entry) => ({ ...entry })) : [],
      shopSupplies: normalizeSupplyInventory(career.shopSupplies),
      truckSupplies: normalizeSupplyInventory(career.truckSupplies),
      workday: {
        ...(career.workday ?? createInitialWorkday(state.day ?? 1, 0)),
        fatigue: { ...(career.workday?.fatigue ?? { debt: 0 }) }
      },
      research: normalizeResearchState(career.research, legacyDefaults),
      tradeProgress: normalizeTradeProgressState(career.tradeProgress, {
        legacyUnlockedByDefault: legacyDefaults,
        legacyUnlockedSkills: career.research?.unlockedSkills
      }),
      officeSkills: normalizeOfficeSkillsState(career.officeSkills, legacyDefaults),
      yard: normalizeYardState(career.yard, legacyDefaults),
      operations: normalizeOperationsState(career.operations, state.day ?? 1, legacyDefaults),
      perks: normalizePerksState(career.perks, legacyDefaults),
      selfEsteem: normalizeSelfEsteemState(career.selfEsteem),
      deferredJobs: Array.isArray(career.deferredJobs)
        ? career.deferredJobs
            .map((entry) => {
              if (!entry?.activeJob) {
                return null;
              }
              const normalizedDeferredActiveJob = normalizeActiveJobState(entry.activeJob);
              if (!normalizedDeferredActiveJob) {
                return null;
              }
              return {
                deferredJobId: entry.deferredJobId ?? `${normalizedDeferredActiveJob.contractId}:legacy`,
                deferredAtDay: Math.max(1, entry.deferredAtDay ?? normalizedDeferredActiveJob.acceptedDay ?? (state.day ?? 1)),
                activeJob: normalizedDeferredActiveJob
              };
            })
            .filter((entry): entry is DeferredJobState => Boolean(entry))
        : [],
      contractFiles: Array.isArray(career.contractFiles)
        ? career.contractFiles
            .map((entry) => normalizeContractFile(entry))
            .filter((entry): entry is ContractFileSnapshot => Boolean(entry))
        : []
    };
  };
  const normalizedBotCareers = Array.isArray(state.botCareers)
    ? state.botCareers.map((career, index) => normalizeBotCareerState(career, index)).filter((career): career is BotCareerState => Boolean(career))
    : [];
  const normalizedBots =
    Array.isArray(state.bots) && state.bots.length > 0
      ? state.bots.map((bot, index) => normalizeActorState(bot, `bot-${index + 1}`))
      : normalizedBotCareers.map((career) => normalizeActorState(career.actor, career.actor.actorId));
  const hydratedBotCareers =
    normalizedBotCareers.length > 0
      ? normalizedBotCareers
      : normalizedBots.map((bot) => ({
          actor: normalizeActorState(bot, bot.actorId),
          activeJob: null,
          contractBoard: [],
          log: [],
          shopSupplies: createInitialShopSupplies(),
          truckSupplies: {},
          workday: createInitialWorkday(state.day ?? 1, 0),
          research: createResearchStateLocked(),
          tradeProgress: createTradeProgressState(true),
          officeSkills: createInitialOfficeSkillsState(),
          yard: createInitialYardState(),
          operations: createInitialOperationsState(),
          perks: createInitialPerksState(),
          selfEsteem: createInitialSelfEsteemState(),
          deferredJobs: [],
          contractFiles: []
        }));

  const normalizedState: GameState = {
    ...(state as GameState),
    player: normalizedPlayer,
    bots: normalizedBots,
    botCareers: hydratedBotCareers,
    shopSupplies: normalizeSupplyInventory(state.shopSupplies),
    truckSupplies: normalizeSupplyInventory(state.truckSupplies),
    activeJob: normalizeActiveJobState(state.activeJob),
    research: normalizeResearchState(state.research, legacyDefaults),
    tradeProgress: normalizeTradeProgressState(state.tradeProgress, {
      legacyUnlockedByDefault: legacyDefaults,
      legacyUnlockedSkills: state.research?.unlockedSkills
    }),
    officeSkills: normalizeOfficeSkillsState(state.officeSkills, legacyDefaults),
    yard: normalizeYardState(state.yard, legacyDefaults),
    operations: normalizeOperationsState(state.operations, state.day ?? 1, legacyDefaults),
    perks: normalizePerksState(state.perks, legacyDefaults),
    selfEsteem: normalizeSelfEsteemState(state.selfEsteem),
    deferredJobs: Array.isArray(state.deferredJobs)
      ? state.deferredJobs
          .map((entry) => {
            if (!entry?.activeJob) {
              return null;
            }
            const normalizedActiveJob = normalizeActiveJobState(entry.activeJob);
            if (!normalizedActiveJob) {
              return null;
            }
            return {
              deferredJobId: entry.deferredJobId ?? `${normalizedActiveJob.contractId}:legacy`,
              deferredAtDay: Math.max(1, entry.deferredAtDay ?? normalizedActiveJob.acceptedDay ?? (state.day ?? 1)),
              activeJob: normalizedActiveJob
            };
          })
          .filter((entry): entry is DeferredJobState => Boolean(entry))
      : [],
    contractFiles: Array.isArray(state.contractFiles)
      ? state.contractFiles
          .map((entry) => normalizeContractFile(entry))
          .filter((entry): entry is ContractFileSnapshot => Boolean(entry))
      : []
  };
  if (normalizedState.activeJob) {
    repairActiveJobRouting(normalizedState.activeJob);
  }
  return normalizedState;
}

function getRotatingBabaOffer(state: GameState, bundle: ContentBundle): ContractOffer | null {
  const babaJobs = [...bundle.babaJobs].sort((a, b) => a.id.localeCompare(b.id));
  if (babaJobs.length === 0) {
    return null;
  }
  const rng = createRng(hashSeed(state.seed, state.day, "baba-rotation"));
  const rotationIndex = rng.nextInt(babaJobs.length);
  const job = babaJobs[rotationIndex]!;
  const payoutMult = Number((0.95 + ((state.day + rotationIndex) % 16) * 0.01).toFixed(2));
  return {
    contract: {
      contractId: `${BABA_G_ROTATING_CONTRACT_PREFIX}-D${state.day}-${job.id}`,
      jobId: job.id,
      districtId: job.districtId,
      payoutMult,
      expiresDay: state.day
    },
    job
  };
}

function getQuotedPayoutForOffer(
  state: GameState,
  bundle: ContentBundle,
  picked: { contract: ContractInstance; job: JobDef },
  events: EventDef[]
): number {
  if (picked.contract.contractId === DAY_LABOR_CONTRACT_ID) {
    return Math.max(0, picked.job.basePayout);
  }
  const basePayout = Math.max(0, Math.round(picked.job.basePayout * picked.contract.payoutMult * getPayoutMultiplier(picked.job, events)));
  const floorPayout = getMinimumContractPayout(state, bundle, picked.job);
  return Math.max(basePayout, floorPayout);
}

function getMinimumContractPayout(state: GameState, bundle: ContentBundle, job: JobDef): number {
  if (job.id === DAY_LABOR_JOB_ID) {
    return 0;
  }
  const district = getDistrict(bundle, job.districtId);
  if (!district) {
    return 0;
  }
  const materialRouting = getJobMaterialRoutingPlan(job, state.shopSupplies, state.truckSupplies);
  const needsSupplier = materialRouting.needsSupplier;
  const requiresShopLoad = materialRouting.requiresShopLoad;
  const tasks = createTaskTemplate(job, district, needsSupplier, requiresShopLoad, state.operations.facilities.storageOwned);
  const plannedTicks = tasks.reduce((sum, task) => sum + task.requiredUnits * task.baseTicks, 0);
  const plannedHours = ticksToHours(plannedTicks);
  const hourlyRate = job.tags.includes("baba-g") ? MIN_BABA_CONTRACT_RATE_PER_HOUR : MIN_CONTRACT_RATE_PER_HOUR;
  return Math.max(0, Math.round(plannedHours * hourlyRate));
}

function isBabaRotatingContractId(contractId: string): boolean {
  return contractId.startsWith(BABA_G_ROTATING_CONTRACT_PREFIX);
}

function getUnlockedFallbackTradeOffer(state: GameState, bundle: ContentBundle): ContractOffer | null {
  const unlockedTracks = CORE_TRADE_SKILLS.filter((track) => isCoreTrackUnlocked(state, track));
  if (unlockedTracks.length === 0) {
    return null;
  }

  const rng = createRng(hashSeed(state.seed, state.day, "unlocked-fallback"));
  const selectedTrack = unlockedTracks[rng.nextInt(unlockedTracks.length)]!;
  const maxTier = state.player.companyLevel + 1;
  const districtAllowList = new Set(state.player.districtUnlocks);
  const bySkill = bundle.jobs
    .filter((job) => mapSkillToCoreTrack(job.primarySkill) === selectedTrack)
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  if (bySkill.length === 0) {
    return null;
  }

  const eligible = bySkill.filter((job) => districtAllowList.has(job.districtId) && job.tier <= maxTier);
  const pool = eligible.length > 0 ? eligible : bySkill;
  const job = pool[rng.nextInt(pool.length)]!;
  const payoutMult = Number((0.95 + rng.next() * 0.2).toFixed(2));

  return {
    contract: {
      contractId: `${UNLOCKED_FALLBACK_CONTRACT_PREFIX}-D${state.day}-${job.id}`,
      jobId: job.id,
      districtId: job.districtId,
      payoutMult,
      expiresDay: state.day
    },
    job
  };
}

function isUnlockedFallbackContractId(contractId: string): boolean {
  return contractId.startsWith(UNLOCKED_FALLBACK_CONTRACT_PREFIX);
}

export function startResearch(state: GameState, projectId: string): StateTransitionResult<ResearchProjectState> {
  const nextState = cloneState(state);
  const result = startResearchProject(nextState, projectId);
  if (!result.ok || !result.startedProject) {
    return {
      nextState: state,
      notice: result.notice ?? "Unable to start research.",
      digest: digestState(state)
    };
  }

  awardOfficeSkillXp(nextState, { reading: 1, accounting: 2 });
  awardPerkXp(nextState, 2);
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: `Research started: ${result.startedProject.label} for $${result.startedProject.cost}.`
  });

  return {
    nextState,
    payload: { ...result.startedProject },
    notice: `Research started: ${result.startedProject.label}.`,
    digest: digestState(nextState)
  };
}

export function hireAccountantStaff(state: GameState): StateTransitionResult {
  const nextState = cloneState(state);
  const result = hireAccountantOperation(nextState);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }

  awardOfficeSkillXp(nextState, { reading: 1, accounting: 2 });
  awardPerkXp(nextState, 2);
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });

  return {
    nextState,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function emptyDumpsterAtYard(state: GameState): StateTransitionResult<number> {
  const nextState = cloneState(state);
  const result = emptyDumpsterOperation(nextState);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }

  awardOfficeSkillXp(nextState, { reading: 1, accounting: 2 });
  awardPerkXp(nextState, 2);
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });

  return {
    nextState,
    payload: result.cost,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function upgradeBusinessTier(state: GameState, target: BusinessTier): StateTransitionResult {
  const nextState = cloneState(state);
  const result = upgradeBusinessTierOperation(nextState, target);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }

  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });
  awardOfficeSkillXp(nextState, { accounting: 2 });
  awardPerkXp(nextState, 2);

  return {
    nextState,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function openStorage(state: GameState, bundle: ContentBundle): StateTransitionResult {
  if (shouldEnforceStarterToolGate(bundle) && !getStarterKitProgress(state.player).allOwned) {
    return {
      nextState: state,
      notice: "Buy the full starter kit (including the OSHA gas can) before opening storage.",
      digest: digestState(state)
    };
  }

  const nextState = cloneState(state);
  const result = openStorageOperation(nextState);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }

  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });
  awardOfficeSkillXp(nextState, { accounting: 2 });
  awardPerkXp(nextState, 2);

  return {
    nextState,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function enableDumpsterService(state: GameState): StateTransitionResult {
  const nextState = cloneState(state);
  const result = enableDumpsterServiceOperation(nextState);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });
  awardOfficeSkillXp(nextState, { accounting: 2 });
  awardPerkXp(nextState, 2);
  return {
    nextState,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function closeOfficeManually(state: GameState): StateTransitionResult {
  const nextState = cloneState(state);
  const result = closeOfficeManuallyOperation(nextState);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });
  return {
    nextState,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function closeYardManually(state: GameState): StateTransitionResult {
  const nextState = cloneState(state);
  const result = closeYardManuallyOperation(nextState);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });
  return {
    nextState,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function spendPerkPoint(state: GameState, perkId: CorePerkId): StateTransitionResult {
  const nextState = cloneState(state);
  const result = spendPerkPointCore(nextState, perkId);
  if (!result.ok) {
    return {
      nextState: state,
      notice: result.notice,
      digest: digestState(state)
    };
  }
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    message: result.notice
  });
  return {
    nextState,
    notice: result.notice,
    digest: digestState(nextState)
  };
}

export function hireCrew(state: GameState): StateTransitionResult<CrewState> {
  return { nextState: state, notice: "Crew: Coming Soon", digest: digestState(state) };
}

export function setActiveJobAssignee(state: GameState, assignee: "self" | string): StateTransitionResult<ActiveJobState> {
  if (!state.activeJob) {
    return { nextState: state, notice: "No active job to assign.", digest: digestState(state) };
  }
  return {
    nextState: state,
    payload: cloneActiveJob(state.activeJob),
    notice: "Crew: Coming Soon",
    digest: digestState(state)
  };
}

export function buyFuel(state: GameState, units = 1): StateTransitionResult<number> {
  if (units <= 0) {
    return { nextState: state, payload: state.player.fuel, digest: digestState(state) };
  }
  if (state.player.fuel <= 0) {
    return { nextState: state, payload: state.player.fuel, notice: "Need at least 1 fuel to travel to the gas station.", digest: digestState(state) };
  }
  const normalizedUnits = Math.max(1, Math.floor(units));
  const fallbackMode: ManualGasStationMode = normalizedUnits > 1 ? "fill" : "single";
  const plan = buildManualGasStationPlan(state, fallbackMode, normalizedUnits);
  const result = executeManualGasStationRun(state, plan);
  return {
    nextState: result.nextState,
    payload: result.nextState.player.fuel,
    notice: result.notice,
    digest: result.digest
  };
}

export function getManualGasStationPlan(state: GameState, mode: ManualGasStationMode): ManualGasStationPlan | null {
  if (state.player.fuel <= 0) {
    return null;
  }
  return buildManualGasStationPlan(state, mode);
}

export function runManualGasStation(state: GameState, mode: ManualGasStationMode): StateTransitionResult<ManualGasStationPlan> {
  const plan = getManualGasStationPlan(state, mode);
  if (!plan) {
    return { nextState: state, notice: "Need at least 1 fuel to travel to the gas station.", digest: digestState(state) };
  }
  return executeManualGasStationRun(state, plan);
}

export function getOutOfGasRescuePlan(state: GameState, bundle: ContentBundle): OutOfGasRescuePlan | null {
  const activeJob = state.activeJob;
  if (!activeJob || state.player.fuel !== 0) {
    return null;
  }

  const currentTask = getCurrentTask(state);
  const job = findJobInBundle(bundle, activeJob.jobId);
  if (!currentTask || !job) {
    return null;
  }

  const blockedReason = getTaskBlockedReason(state, bundle, currentTask, job);
  if (!blockedReason || !blockedReason.toLowerCase().includes("fuel")) {
    return null;
  }

  const canCost = state.player.oshaCanOwned ? 0 : OSHA_CAN_PRICE;
  const fuelCost = OUT_OF_GAS_RESCUE_FUEL * FUEL_PRICE;
  const totalCost = canCost + fuelCost;
  const cashShortfall = Math.max(0, totalCost - state.player.cash);
  const nextDriveLabel = TASK_LABELS[currentTask.taskId].toLowerCase();
  const warning =
    cashShortfall > 0
      ? `Truck is out of fuel for ${nextDriveLabel}. Need $${cashShortfall} more and work a Day Labor shift first.`
      : `Truck is out of fuel for ${nextDriveLabel}. Walk to the nearest gas station for an emergency can refill.`;

  return {
    warning,
    fuelBlockedTaskId: currentTask.taskId,
    canCost,
    fuelCost,
    totalCost,
    requiredTicks: OUT_OF_GAS_RESCUE_TICKS,
    fuelAdded: OUT_OF_GAS_RESCUE_FUEL,
    canOwnedAfter: true,
    cashShortfall
  };
}

function buildManualGasStationPlan(
  state: GameState,
  mode: ManualGasStationMode,
  requestedFuelOverride?: number
): ManualGasStationPlan {
  const room = Math.max(0, state.player.fuelMax - state.player.fuel);
  const requestedFuel =
    typeof requestedFuelOverride === "number"
      ? Math.max(1, Math.floor(requestedFuelOverride))
      : mode === "fill"
        ? Math.max(1, room)
        : 1;
  const fuelAdded = Math.max(0, Math.min(room, requestedFuel));
  const canCost = !state.player.oshaCanOwned && fuelAdded > 0 ? OSHA_CAN_PRICE : 0;
  const fuelCost = fuelAdded * FUEL_PRICE;
  const totalCost = canCost + fuelCost;
  const cashShortfall = Math.max(0, totalCost - state.player.cash);
  const timeBlocked = !canSpendTicks(state.workday, MANUAL_GAS_STATION_TICKS, true);

  let warning = "Travel to the nearest gas station for a manual refill.";
  if (fuelAdded <= 0) {
    warning = "Tank already full.";
  } else if (cashShortfall > 0) {
    warning = `Need $${cashShortfall} more for a gas station run. Work a Day Labor shift first.`;
  } else if (timeBlocked) {
    warning = "No time is left for a gas station run.";
  }

  return {
    mode,
    warning,
    requestedFuel,
    fuelAdded,
    canCost,
    fuelCost,
    totalCost,
    requiredTicks: MANUAL_GAS_STATION_TICKS,
    cashShortfall,
    timeBlocked
  };
}

function executeManualGasStationRun(state: GameState, plan: ManualGasStationPlan): StateTransitionResult<ManualGasStationPlan> {
  if (plan.fuelAdded <= 0) {
    return { nextState: state, payload: plan, notice: "Tank already full.", digest: digestState(state) };
  }
  if (plan.cashShortfall > 0) {
    return {
      nextState: state,
      payload: plan,
      notice: `Need $${plan.cashShortfall} more. Work Day Laborer Shift in Contracts to earn gas money.`,
      digest: digestState(state)
    };
  }
  if (plan.timeBlocked) {
    return {
      nextState: state,
      payload: plan,
      notice: "No time is left for a gas station run.",
      digest: digestState(state)
    };
  }

  const nextState = cloneState(state);
  const activeJob = nextState.activeJob;

  spendTicks(nextState.workday, plan.requiredTicks);
  if (activeJob) {
    activeJob.actualTicksSpent += plan.requiredTicks;
  }

  nextState.player.cash -= plan.totalCost;
  nextState.player.fuel = Math.min(nextState.player.fuelMax, nextState.player.fuel + plan.fuelAdded);

  if (!nextState.player.oshaCanOwned && plan.canCost > 0) {
    nextState.player.oshaCanOwned = true;
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId: activeJob?.contractId,
      message: `Bought OSHA-approved gas can for $${OSHA_CAN_PRICE}.`
    });
  }

  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId: activeJob?.contractId,
    message: `Bought ${plan.fuelAdded} fuel for $${plan.fuelCost}.`
  });
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId: activeJob?.contractId,
    message: `Manual gas station run: traveled to the nearest gas station and returned (${formatHours(plan.requiredTicks)}).`
  });

  awardOfficeSkillXp(nextState, { reading: 1, accounting: 2 });

  const firstPurchase = plan.canCost > 0;
  const fillLabel = plan.mode === "fill" ? "filled the tank" : `added ${plan.fuelAdded} fuel`;
  return {
    nextState,
    payload: plan,
    notice: firstPurchase
      ? `Traveled to nearest gas station, bought OSHA can, and ${fillLabel} for $${plan.totalCost}.`
      : `Traveled to nearest gas station and ${fillLabel} for $${plan.totalCost}.`,
    digest: digestState(nextState)
  };
}

export function runOutOfGasRescue(state: GameState, bundle: ContentBundle): StateTransitionResult<OutOfGasRescuePlan> {
  const plan = getOutOfGasRescuePlan(state, bundle);
  if (!plan) {
    return { nextState: state, notice: "No out-of-gas rescue is needed right now.", digest: digestState(state) };
  }
  if (plan.cashShortfall > 0) {
    return {
      nextState: state,
      payload: plan,
      notice: `Need $${plan.cashShortfall} more. Work Day Laborer Shift in Contracts to earn gas money.`,
      digest: digestState(state)
    };
  }
  if (!canSpendTicks(state.workday, plan.requiredTicks, true)) {
    return { nextState: state, payload: plan, notice: "No time is left for an out-of-gas rescue.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  const activeJob = nextState.activeJob!;
  spendTicks(nextState.workday, plan.requiredTicks);
  activeJob.actualTicksSpent += plan.requiredTicks;
  nextState.player.cash -= plan.totalCost;
  nextState.player.fuel = Math.min(nextState.player.fuelMax, nextState.player.fuel + plan.fuelAdded);

  if (!nextState.player.oshaCanOwned) {
    nextState.player.oshaCanOwned = true;
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId: activeJob.contractId,
      message: `Bought OSHA-approved gas can for $${OSHA_CAN_PRICE}.`
    });
  }

  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId: activeJob.contractId,
    message: `Bought ${plan.fuelAdded} fuel for $${plan.fuelCost}.`
  });
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId: activeJob.contractId,
    message: `Out-of-gas rescue: walked to the nearest gas station (${formatHours(plan.requiredTicks)}).`
  });

  awardOfficeSkillXp(nextState, { accounting: 10 });
  awardPerkXp(nextState, 2);

  const firstRescue = plan.canCost > 0;
  return {
    nextState,
    payload: plan,
    notice: firstRescue
      ? `Walked to nearest gas station, bought OSHA can, and added ${plan.fuelAdded} fuel for $${plan.totalCost}.`
      : `Walked to nearest gas station and added ${plan.fuelAdded} fuel for $${plan.totalCost}.`,
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

  const preparedState = cloneState(state);
  repairActiveJobRouting(preparedState.activeJob);

  const activeTask = getCurrentTask(preparedState);
  if (!activeTask) {
    return { nextState: preparedState, notice: "There is no task to advance.", digest: digestState(preparedState) };
  }

  const job = findJobInBundle(bundle, preparedState.activeJob?.jobId ?? "");
  const district = bundle.districts.find((entry) => entry.id === preparedState.activeJob?.districtId);
  if (!job || !district) {
    return { nextState: preparedState, notice: "Active job data is incomplete.", digest: digestState(preparedState) };
  }

  const assignee = getJobAssignee(preparedState.player, preparedState.activeJob!.assignee);
  if (!assignee) {
    return { nextState: preparedState, notice: "Assigned crew is unavailable.", digest: digestState(preparedState) };
  }

  const effectiveStance = activeTask.qualityBearing || activeTask.taskId === "refuel_at_station" ? stance : "standard";
  const blockedReason = getTaskBlockedReason(preparedState, bundle, activeTask, job);
  if (blockedReason) {
    return { nextState: preparedState, notice: blockedReason, digest: digestState(preparedState) };
  }

  const mapping = getTaskSkillMapping(job, activeTask.taskId);
  const baseSkillRank = getTaskSkillRank(preparedState.player, mapping);
  const baseDifficulty = getTaskDifficulty(activeTask.taskId, job, district, getActiveEvents(bundle, preparedState.activeEventIds));
  const perkModifiers = getTaskPerkModifiers(preparedState, job, activeTask.taskId, activeTask.completedUnits === 0);
  const safetyReduction = Math.min(1, preparedState.perks.corePerks.safety_awareness ?? 0);
  const effectiveSkillRank = baseSkillRank + perkModifiers.skillBonus + perkModifiers.blueprintFirstTaskBonus;
  const effectiveDifficulty = Math.max(1, baseDifficulty - safetyReduction);
  let timing =
    activeTask.taskId === "refuel_at_station"
      ? { timeOutcome: "standard" as const, ticksSpent: getRefuelTaskTicks(effectiveStance) }
      : resolveTiming(preparedState, job, activeTask, effectiveStance, effectiveSkillRank, effectiveDifficulty);
  if (timing.timeOutcome === "rework" && activeTask.taskId === "do_work" && consumeRerollToken(preparedState)) {
    timing = { timeOutcome: "standard", ticksSpent: getTaskBaseTicks(activeTask, job) };
  }
  const regularTicksLeft = getRemainingRegularTicks(preparedState.workday);
  if (
    activeTask.taskId === "return_to_shop" &&
    !allowOvertime &&
    !canSpendTicks(preparedState.workday, timing.ticksSpent, false) &&
    regularTicksLeft > 0
  ) {
    timing = { timeOutcome: "standard", ticksSpent: regularTicksLeft };
  }
  if (!canSpendTicks(preparedState.workday, timing.ticksSpent, allowOvertime)) {
    return { nextState: preparedState, notice: "This action spills into overtime.", digest: digestState(preparedState) };
  }

  const nextState = cloneState(preparedState);
  const nextActiveTask = getCurrentTask(nextState);
  if (!nextActiveTask) {
    return { nextState: preparedState, notice: "There is no task to advance.", digest: digestState(preparedState) };
  }
  const contractId = preparedState.activeJob!.contractId;

  const logLines: string[] = [];
  const skillXpDelta: Partial<Record<SkillId, number>> = {};
  let taskNotice: string | undefined;
  let qualityOutcome: TaskQualityOutcome | undefined;
  let qualityPointsDelta = 0;
  let unitsCompleted = timing.timeOutcome === "rework" ? 0 : 1;
  let reworkAdded = timing.timeOutcome === "rework" ? 1 : 0;
  let selfEsteemDelta = 0;

  spendTicks(nextState.workday, timing.ticksSpent, perkModifiers.overtimeFatigueReduction);
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
    selfEsteemDelta += QUALITY_SELF_ESTEEM_DELTA.botched - 3;
    logLines.push(`${TASK_LABELS[nextActiveTask.taskId]} went sideways and needs another pass.`);
  } else {
    nextActiveTask.completedUnits += 1;
    if (nextActiveTask.qualityBearing) {
      qualityOutcome = resolveQuality(
        preparedState,
        job,
        nextActiveTask,
        effectiveStance,
        effectiveSkillRank,
        effectiveDifficulty,
        timing.timeOutcome,
        perkModifiers.qualityBonus
      );
      if (qualityOutcome === "botched" && nextActiveTask.taskId === "do_work" && consumeRerollToken(nextState)) {
        qualityOutcome = "sloppy";
        logLines.push("Problem Solving perk recovered a botched pass.");
      }
      qualityPointsDelta = QUALITY_POINT_DELTA[qualityOutcome];
      nextState.activeJob!.qualityPoints += qualityPointsDelta;
      selfEsteemDelta += QUALITY_SELF_ESTEEM_DELTA[qualityOutcome];
      logLines.push(`${TASK_LABELS[nextActiveTask.taskId]} landed ${qualityOutcome}.`);
    }
  }

  if (nextActiveTask.taskId === "do_work" && timing.timeOutcome === "fast") {
    selfEsteemDelta += 2;
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
      if (timing.timeOutcome !== "rework") {
        const checkoutStatus = applySupplierCheckout(nextState, bundle, job, logLines, perkModifiers.supplyDiscountPct);
        if (!checkoutStatus.ok) {
          nextActiveTask.requiredUnits += 1;
          unitsCompleted = 0;
          taskNotice = checkoutStatus.notice;
        } else {
          awardOfficeSkillXp(nextState, { accounting: 2 });
        }
      }
      break;
    case "refuel_at_station":
      if (timing.timeOutcome !== "rework") {
        const requestedFuel = getRefuelPurchaseUnits(nextState, bundle, effectiveStance);
        const fuelPurchased = Math.max(0, Math.min(requestedFuel, nextState.player.fuelMax - nextState.player.fuel));
        const fuelCost = fuelPurchased * FUEL_PRICE;
        const onAccount = fuelPurchased > 0 && nextState.player.cash < fuelCost;
        nextState.player.fuel += fuelPurchased;
        nextState.player.cash -= fuelCost;
        nextActiveTask.completedUnits = nextActiveTask.requiredUnits;
        if (effectiveStance === "standard") {
          logLines.push("Skipped refuel at the gas station.");
        } else if (fuelPurchased > 0) {
          logLines.push(
            onAccount
              ? `Refueled ${fuelPurchased} at the gas station on account ($${fuelCost}).`
              : `Refueled ${fuelPurchased} at the gas station for $${fuelCost}.`
          );
        } else {
          logLines.push("Tank already full at the gas station.");
        }
        awardOfficeSkillXp(nextState, { accounting: 2 });
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
        // Pickup is a one-time transfer; clear any rework-inflated remaining units to prevent dead-end states.
        nextActiveTask.completedUnits = nextActiveTask.requiredUnits;
      }
      break;
    case "do_work":
      if (!nextState.activeJob!.staminaCommitted) {
        commitActiveJobStamina(nextState, job, logLines);
      }
      if (timing.timeOutcome !== "rework" && !nextState.activeJob!.materialsReserved) {
        const reservedMaterials = reserveMaterials(nextState.truckSupplies, job.materialNeeds);
        if (!reservedMaterials) {
          return { nextState: state, notice: "The truck is short on materials.", digest: digestState(state) };
        }
        const materialQuality = calculateMaterialQuality(reservedMaterials);
        nextState.activeJob!.materialsReserved = true;
        nextState.activeJob!.reservedMaterials = reservedMaterials;
        nextState.activeJob!.partsQuality = materialQuality.quality;
        nextState.activeJob!.partsQualityScore = materialQuality.score;
        nextState.activeJob!.partsQualityModifier = materialQuality.modifier;
        logLines.push(
          `Reserved the job materials at ${formatSupplyQuality(materialQuality.quality)} quality (${materialQuality.modifier >= 0 ? "+" : ""}${materialQuality.modifier} quality).`
        );
      }
      if (timing.timeOutcome !== "rework") {
        applyToolWear(nextState.player, job, nextActiveTask);
      }
      break;
    case "collect_payment":
      if (timing.timeOutcome !== "rework") {
        const outcome = settleActiveJob(nextState, bundle, job);
        if (job.tags.includes("baba-g") && (outcome.outcome === "success" || outcome.outcome === "neutral")) {
          const coreTrack = mapSkillToCoreTrack(job.primarySkill);
          if (coreTrack) {
            const unlocked = unlockCoreTrack(nextState, coreTrack);
            if (unlocked.unlockedNow) {
              logLines.push(`Unlocked trade track: ${formatCoreTrackLabel(coreTrack)} via Baba G contract.`);
            }
          }
        }
        const pendingTrash = Math.max(0, Math.floor(job.trashUnits ?? 0));
        const canRouteTrashToDumpster = nextState.operations.facilities.storageOwned && nextState.operations.facilities.dumpsterEnabled;
        if (pendingTrash > 0 && !canRouteTrashToDumpster) {
          const premiumHaul = getPremiumHaulCost(pendingTrash);
          nextState.player.cash -= premiumHaul;
          nextState.activeJob!.trashUnitsPending = 0;
          logLines.push(`Premium haul-off charged $${premiumHaul} for ${pendingTrash} trash units.`);
        } else {
          nextState.activeJob!.trashUnitsPending = pendingTrash;
        }
        logLines.push(...outcome.logLines);
        const historicalCosts = getContractExpenseTotalFromLog(nextState, nextState.activeJob!.contractId);
        const taskCosts = getContractExpenseTotalFromMessages(logLines);
        const totalCosts = historicalCosts + taskCosts;
        const netCash = outcome.cashDelta - totalCosts;
        logLines.push(`Job receipt: Payout $${outcome.cashDelta} - Costs $${totalCosts} = Net ${formatSignedCurrency(netCash)}.`);
        const activeJobSnapshot = nextState.activeJob!;
        updateContractFile(nextState, contractId, {
          status: "completed",
          dayClosed: nextState.day,
          outcome: outcome.outcome,
          actualHoursAtClose: ticksToHours(activeJobSnapshot.actualTicksSpent),
          actualNetAtClose: netCash,
          estimatedHoursAtAccept: ticksToHours(activeJobSnapshot.plannedTicks),
          estimatedNetAtAccept: activeJobSnapshot.estimateAtAccept.projectedNetOnSuccess
        });
        if (!nextState.operations.facilities.storageOwned) {
          nextState.activeJob = null;
          logLines.push("Truck-only closeout: kept leftovers on the truck and closed the job folder.");
        }
      }
      break;
    case "return_to_shop":
      if (timing.timeOutcome !== "rework") {
        nextActiveTask.completedUnits = nextActiveTask.requiredUnits;
        nextState.activeJob!.location = "shop";
        const storeTask = nextState.activeJob!.tasks.find((task) => task.taskId === "store_leftovers");
        const hasTruckLeftovers = !isInventoryEmpty(nextState.truckSupplies);
        if (!hasTruckLeftovers && storeTask) {
          const pendingTrash = Math.max(0, nextState.activeJob!.trashUnitsPending);
          if (pendingTrash > 0 && nextState.operations.facilities.dumpsterEnabled) {
            nextState.yard.dumpsterUnits += pendingTrash;
            nextState.activeJob!.trashUnitsPending = 0;
            logLines.push(`Dumped ${pendingTrash} trash units into the yard dumpster.`);
          } else if (pendingTrash > 0) {
            nextState.activeJob!.trashUnitsPending = 0;
          }
          storeTask.completedUnits = storeTask.requiredUnits;
          logLines.push("No leftover supplies to store. Job folder closed.");
          nextState.activeJob = null;
        }
      }
      break;
    case "store_leftovers":
      if (timing.timeOutcome !== "rework") {
        const pendingTrash = Math.max(0, nextState.activeJob!.trashUnitsPending);
        if (pendingTrash > 0 && nextState.operations.facilities.dumpsterEnabled) {
          nextState.yard.dumpsterUnits += pendingTrash;
          nextState.activeJob!.trashUnitsPending = 0;
          logLines.push(`Dumped ${pendingTrash} trash units into the yard dumpster.`);
        } else if (pendingTrash > 0) {
          nextState.activeJob!.trashUnitsPending = 0;
        }
        const storageTransfer = moveTruckSuppliesIntoStorage(nextState.truckSupplies, nextState.shopSupplies);
        if (storageTransfer.overflowUnits > 0) {
          logLines.push(
            `Storage full: moved ${storageTransfer.movedUnits} supply units, ${storageTransfer.overflowUnits} units remain in truck.`
          );
        } else {
          logLines.push("Stored the leftovers in storage and closed the job folder with deliberate calm.");
        }
        nextState.activeJob = null;
      }
      break;
  }

  const encounter = rollRebarBobEncounter(nextState, nextActiveTask.taskId, effectiveStance);
  if (encounter) {
    logLines.push(`${encounter.speaker}: "${encounter.line}"`);
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId: preparedState.activeJob!.contractId,
      taskId: nextActiveTask.taskId,
      message: formatEncounterMarker(encounter)
    });
  }

  awardOfficeSkillXp(nextState, { reading: 3 });
  awardPerkXp(nextState, 3);
  applySelfEsteemDelta(nextState, selfEsteemDelta);

  const taskLogLines = logLines.map((line) => formatAssigneeLogLine(assignee.name, line.trim())).filter(Boolean);
  for (const line of taskLogLines) {
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId: preparedState.activeJob!.contractId,
      taskId: nextActiveTask.taskId,
      message: line
    });
  }

  const digest = digestState(nextState);
  const taskEstimatedTicksTotal = Math.max(0, getPlannedTaskTicksForAction(nextActiveTask, job, effectiveStance));
  const taskActualTicksTotal = Math.max(0, timing.ticksSpent);
  const jobEstimatedTicksTotal = Math.max(0, nextState.activeJob?.plannedTicks ?? preparedState.activeJob?.plannedTicks ?? 0);
  const jobActualTicksTotal = Math.max(0, nextState.activeJob?.actualTicksSpent ?? preparedState.activeJob!.actualTicksSpent + timing.ticksSpent);
  const payload: TaskUnitResult = {
    day: preparedState.day,
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
    taskEstimatedTicksTotal,
    taskActualTicksTotal,
    jobEstimatedTicksTotal,
    jobActualTicksTotal,
    encounter,
    logLines: taskLogLines,
    digest
  };

  return {
    nextState,
    payload,
    notice: taskNotice,
    digest
  };
}

export function returnToShopForTools(
  state: GameState,
  bundle: ContentBundle
): StateTransitionResult<ReturnToShopForToolsPayload> {
  const activeJob = state.activeJob;
  if (!activeJob) {
    return { nextState: state, notice: "No active job.", digest: digestState(state) };
  }

  const currentTask = getCurrentTask(state);
  if (!currentTask || currentTask.taskId !== "do_work") {
    return { nextState: state, notice: "Return-to-storage for tools is only available during on-site work.", digest: digestState(state) };
  }
  if (activeJob.location !== "job-site") {
    return { nextState: state, notice: "You must be at the job site to route back for tools.", digest: digestState(state) };
  }

  const job = findJobInBundle(bundle, activeJob.jobId);
  if (!job) {
    return { nextState: state, notice: "Active job data is incomplete.", digest: digestState(state) };
  }
  if (hasUsableTools(state.player, job.requiredTools)) {
    return { nextState: state, notice: "Usable tools are already available.", digest: digestState(state) };
  }

  const district = getDistrict(bundle, activeJob.districtId);
  const travelTicks = district.travel.shopToSiteTicks;
  const fuelCost = district.travel.shopToSiteFuel;
  if (state.player.fuel < fuelCost) {
    return { nextState: state, notice: "Not enough fuel to get back to storage.", digest: digestState(state) };
  }

  const canUseRegularTime = canSpendTicks(state.workday, travelTicks, false);
  const canUseOvertime = canSpendTicks(state.workday, travelTicks, true);
  if (!canUseRegularTime && !canUseOvertime) {
    return { nextState: state, notice: "No time remains to return to storage.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  spendTicks(nextState.workday, travelTicks);
  nextState.activeJob!.actualTicksSpent += travelTicks;
  nextState.player.fuel = Math.max(0, nextState.player.fuel - fuelCost);
  nextState.activeJob!.location = "shop";
  const travelToSiteTask = nextState.activeJob!.tasks.find((task) => task.taskId === "travel_to_job_site");
  if (travelToSiteTask) {
    travelToSiteTask.requiredUnits = Math.max(travelToSiteTask.requiredUnits, travelToSiteTask.completedUnits + 1);
  }

  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId: nextState.activeJob?.contractId,
    taskId: "return_to_shop",
    message: `Returned to storage to repair or replace broken tools (${formatHours(travelTicks)} travel, fuel -${fuelCost}).`
  });

  const usedOvertime = !canUseRegularTime && canUseOvertime;
  return {
    nextState,
    payload: {
      ticksSpent: travelTicks,
      fuelSpent: fuelCost,
      usedOvertime
    },
    notice: usedOvertime
      ? "Returned to storage for tools using overtime. Repair or buy tools, then head back to site."
      : "Returned to storage for tools. Repair or buy tools, then head back to site.",
    digest: digestState(nextState)
  };
}

export function runRecoveryAction(
  state: GameState,
  bundle: ContentBundle,
  action: RecoveryActionId
): StateTransitionResult {
  if (!state.activeJob) {
    return { nextState: state, notice: "No active job to recover.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  const activeJob = nextState.activeJob!;
  const currentTask = getCurrentTask(nextState);
  const contractId = activeJob.contractId;

  if (action === "finish_cheap") {
    if (!currentTask || currentTask.taskId !== "do_work") {
      return { nextState: state, notice: "Finish Cheap is only available while doing the job.", digest: digestState(state) };
    }
    const doWorkTask = activeJob.tasks.find((task) => task.taskId === "do_work");
    if (!doWorkTask) {
      return { nextState: state, notice: "Work task is unavailable.", digest: digestState(state) };
    }
    doWorkTask.completedUnits = doWorkTask.requiredUnits;
    activeJob.recoveryMode = "finish_cheap";
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId,
      taskId: "do_work",
      message: "Cut Losses: Finish Cheap selected (forced low-quality closeout, reduced payout, rep -1)."
    });
    return {
      nextState,
      notice: "Finish Cheap armed. Collect payment to close at reduced payout.",
      digest: digestState(nextState)
    };
  }

  if (action === "defer") {
    if (nextState.deferredJobs.length >= 3) {
      return { nextState: state, notice: "Deferred queue is full (3 max).", digest: digestState(state) };
    }
    const deferFee = 20;
    nextState.player.cash -= deferFee;
    const deferredAtDay = nextState.day;
    const deferredJobId = `${contractId}:defer:${nextState.day}:${nextState.log.length}`;
    activeJob.deferredAtDay = deferredAtDay;
    nextState.deferredJobs = sortDeferredJobs([
      ...nextState.deferredJobs,
      {
        deferredJobId,
        deferredAtDay,
        activeJob: cloneActiveJob(activeJob)!
      }
    ]);
    updateContractFile(nextState, contractId, {
      status: "deferred",
      dayClosed: null,
      outcome: null
    });
    nextState.activeJob = null;
    nextState.contractBoard = generateContractBoard(bundle, nextState.day, hashSeed(nextState.seed, nextState.day), {
      districtIds: nextState.player.districtUnlocks,
      maxTier: nextState.player.companyLevel + 1
    });
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId,
      message: `Cut Losses: Deferred job for $${deferFee}. Resume anytime from Work queue.`
    });
    applySelfEsteemDelta(nextState, -6);
    return {
      nextState,
      notice: "Job deferred. You can resume it later from Work.",
      digest: digestState(nextState)
    };
  }

  const abandonPenalty = 40;
  let abandonmentCosts = abandonPenalty;
  nextState.player.cash -= abandonPenalty;
  nextState.player.reputation = Math.max(0, nextState.player.reputation - 2);
  const pendingTrash = Math.max(0, activeJob.trashUnitsPending);
  if (pendingTrash > 0 && !nextState.operations.facilities.dumpsterEnabled) {
    const premiumHaul = getPremiumHaulCost(pendingTrash);
    abandonmentCosts += premiumHaul;
    nextState.player.cash -= premiumHaul;
    appendLog(nextState, {
      day: nextState.day,
      actorId: nextState.player.actorId,
      contractId,
      message: `Premium haul-off charged $${premiumHaul} for ${pendingTrash} trash units.`
    });
  }
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId,
    message: `Cut Losses: Abandoned job (cash -$${abandonPenalty}, rep -2).`
  });
  updateContractFile(nextState, contractId, {
    status: "abandoned",
    dayClosed: nextState.day,
    outcome: "lost",
    actualHoursAtClose: ticksToHours(activeJob.actualTicksSpent),
    estimatedHoursAtAccept: ticksToHours(activeJob.plannedTicks),
    estimatedNetAtAccept: activeJob.estimateAtAccept.projectedNetOnSuccess,
    actualNetAtClose: -abandonmentCosts
  });
  applySelfEsteemDelta(nextState, -10);
  nextState.activeJob = null;
  nextState.contractBoard = generateContractBoard(bundle, nextState.day, hashSeed(nextState.seed, nextState.day), {
    districtIds: nextState.player.districtUnlocks,
    maxTier: nextState.player.companyLevel + 1
  });
  return {
    nextState,
    notice: "Job abandoned with penalties applied.",
    digest: digestState(nextState)
  };
}

export function resumeDeferredJob(state: GameState, deferredJobId: string): StateTransitionResult<ActiveJobState> {
  if (state.activeJob) {
    return { nextState: state, notice: "Finish the current job first.", digest: digestState(state) };
  }
  const index = state.deferredJobs.findIndex((entry) => entry.deferredJobId === deferredJobId);
  if (index < 0) {
    return { nextState: state, notice: "Deferred job is unavailable.", digest: digestState(state) };
  }

  const nextState = cloneState(state);
  const picked = nextState.deferredJobs[index]!;
  nextState.deferredJobs = nextState.deferredJobs.filter((entry) => entry.deferredJobId !== deferredJobId);
  nextState.activeJob = cloneActiveJob(picked.activeJob);
  if (nextState.activeJob) {
    nextState.activeJob.deferredAtDay = null;
  }
  updateContractFile(nextState, picked.activeJob.contractId, {
    status: "active",
    dayClosed: null,
    outcome: null
  });
  nextState.contractBoard = [];
  appendLog(nextState, {
    day: nextState.day,
    actorId: nextState.player.actorId,
    contractId: picked.activeJob.contractId,
    message: `Resumed deferred job ${picked.activeJob.jobId}.`
  });
  applySelfEsteemDelta(nextState, 3);

  return {
    nextState,
    payload: cloneActiveJob(nextState.activeJob)!,
    notice: "Deferred job resumed.",
    digest: digestState(nextState)
  };
}

export function prepareForNextDay(state: GameState): GameState {
  const nextState = cloneState(state);
  applyDailySelfEsteemUpdate(nextState);
  nextState.day += 1;
  resetOfficeSkillDailyCaps(nextState);
  const recovery = getRecoveryForWeekday(getWeekday(nextState.day));
  nextState.workday.fatigue.debt = Math.max(0, nextState.workday.fatigue.debt - recovery);
  nextState.workday = createInitialWorkday(nextState.day, nextState.workday.fatigue.debt);
  nextState.player.stamina = nextState.player.staminaMax;
  nextState.player.crews = nextState.player.crews.map((crew) => ({
    ...crew,
    stamina: crew.staminaMax
  }));

  if (nextState.activeJob && nextState.activeJob.location !== "shop") {
    const supplierStopOutstanding = hasOutstandingSupplierStop(nextState.activeJob);

    if (!isInventoryEmpty(nextState.truckSupplies)) {
      moveAllSupplies(nextState.truckSupplies, nextState.activeJob.siteSupplies);
      nextState.truckSupplies = {};
      const pickupTask = nextState.activeJob.tasks.find((task) => task.taskId === "pickup_site_supplies");
      if (pickupTask) {
        pickupTask.requiredUnits = Math.max(pickupTask.requiredUnits, pickupTask.completedUnits + 1);
      }
    }

    if (supplierStopOutstanding) {
      const travelToSupplierTask = nextState.activeJob.tasks.find((task) => task.taskId === "travel_to_supplier");
      if (travelToSupplierTask) {
        travelToSupplierTask.requiredUnits = Math.max(travelToSupplierTask.requiredUnits, travelToSupplierTask.completedUnits + 1);
      }
    } else {
      const travelToSiteTask = nextState.activeJob.tasks.find((task) => task.taskId === "travel_to_job_site");
      if (travelToSiteTask) {
        travelToSiteTask.requiredUnits = Math.max(travelToSiteTask.requiredUnits, travelToSiteTask.completedUnits + 1);
      }
    }
    nextState.activeJob.location = "shop";
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
    case "refuel_at_station":
    case "checkout_supplies":
    case "travel_to_supplier":
    case "travel_to_job_site":
    case "return_to_shop":
    case "collect_payment":
      return { primary: job.primarySkill };
    case "do_work":
      return { primary: job.primarySkill };
  }
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
  const baseChances = getTaskTimeChances(skillRank, difficulty, stance);
  const selfEsteemEffects = getSelfEsteemBandEffects(state);
  let fastChance = clamp(baseChances.fastChance + selfEsteemEffects.fastChance, 0, 95);
  let reworkChance = clamp(baseChances.reworkChance + selfEsteemEffects.reworkChance, 0, 95);
  let delayChance = clamp(baseChances.delayChance + selfEsteemEffects.delayChance, 0, 95);
  let overflow = fastChance + reworkChance + delayChance - 100;
  if (overflow > 0) {
    const cutDelay = Math.min(delayChance, overflow);
    delayChance -= cutDelay;
    overflow -= cutDelay;
  }
  if (overflow > 0) {
    const cutRework = Math.min(reworkChance, overflow);
    reworkChance -= cutRework;
    overflow -= cutRework;
  }
  if (overflow > 0) {
    const cutFast = Math.min(fastChance, overflow);
    fastChance -= cutFast;
    overflow -= cutFast;
  }
  const standardChance = Math.max(0, 100 - fastChance - reworkChance - delayChance);
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

  if (task.taskId === "travel_to_supplier" || task.taskId === "travel_to_job_site") {
    return { timeOutcome: "standard", ticksSpent: 1 };
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
  timeOutcome: TaskTimeOutcome,
  qualityBonus = 0
): TaskQualityOutcome {
  const stanceQualityMod = stance === "rush" ? -15 : stance === "careful" ? 15 : 0;
  const timeQualityMod = timeOutcome === "fast" ? -10 : timeOutcome === "delayed" ? 5 : timeOutcome === "rework" ? -25 : 0;
  const selfEsteemQualityMod = getSelfEsteemBandEffects(state).qualityRoll;
  const roll = createRng(
    hashSeed(state.seed, state.day, state.activeJob?.contractId ?? "none", task.taskId, task.completedUnits, task.requiredUnits, stance, "quality")
  ).nextInt(100);
  const qualityRoll = roll + skillRank * 8 + stanceQualityMod + timeQualityMod + qualityBonus + selfEsteemQualityMod - difficulty * 12;
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

function createTaskTemplate(
  job: JobDef,
  district: DistrictDef,
  needsSupplier: boolean,
  requiresShopLoad: boolean,
  storageOwned: boolean
): ActiveTaskState[] {
  const tasks: ActiveTaskState[] = [
    createTask("load_from_shop", 2, requiresShopLoad ? 1 : 0, true),
    createTask("refuel_at_station", 1, 0, false),
    createTask("travel_to_supplier", SHOP_SUPPLIER_TICKS, needsSupplier ? 1 : 0, false),
    createTask("checkout_supplies", 2, needsSupplier ? 1 : 0, true),
    createTask("travel_to_job_site", 1, 1, false),
    createTask("pickup_site_supplies", 2, 0, true),
    createTask("do_work", 2, job.workUnits, true),
    createTask("collect_payment", 2, 1, true)
  ];
  if (storageOwned) {
    tasks.push(createTask("return_to_shop", district.travel.shopToSiteTicks, 1, false), createTask("store_leftovers", 2, 1, true));
  }
  return tasks;
}

function createTask(taskId: TaskId, baseTicks: number, requiredUnits: number, qualityBearing: boolean): ActiveTaskState {
  const availableStances: TaskStance[] =
    taskId === "refuel_at_station" ? ["rush", "standard", "careful"] : qualityBearing ? ["rush", "standard", "careful"] : ["standard"];
  return {
    taskId,
    label: TASK_LABELS[taskId],
    location: getTaskLocation(taskId),
    baseTicks,
    requiredUnits,
    completedUnits: 0,
    qualityBearing,
    availableStances
  };
}

function getTaskLocation(taskId: TaskId): LocationId {
  switch (taskId) {
    case "refuel_at_station":
      return "gas-station";
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

function applySupplierCheckout(
  state: GameState,
  bundle: ContentBundle,
  job: JobDef,
  logLines: string[],
  supplyDiscountPct = 0
): SupplierCheckoutStatus {
  const activeJob = state.activeJob!;
  const cartEntries = listInventoryEntries(activeJob.supplierCart);
  const hasRequiredAllocation = hasRequiredSupplierAllocation(job, state.truckSupplies, activeJob.supplierCart);
  if (cartEntries.length === 0) {
    if (hasRequiredAllocation) {
      logLines.push("Supplier stop confirmed: truck supplies already cover the job.");
      return { ok: true };
    }
    logLines.push("The cart was empty, which impressed nobody.");
    return { ok: false };
  }
  if (!hasRequiredAllocation) {
    logLines.push("The cart still needs explicit quality picks for the required materials.");
    return { ok: false };
  }

  const cartUnitTotal = cartEntries.reduce((sum, [, , quantity]) => sum + quantity, 0);
  const truckUnits = getSupplyInventoryUnits(state.truckSupplies);
  const availableTruckRoom = Math.max(0, TRUCK_SUPPLY_CAPACITY - truckUnits);
  if (cartUnitTotal > availableTruckRoom) {
    const overflowUnits = cartUnitTotal - availableTruckRoom;
    logLines.push(
      `Truck capacity exceeded at supplier checkout: ${cartUnitTotal} units requested with ${availableTruckRoom} units free (overflow ${overflowUnits}).`
    );
    return {
      ok: false,
      notice: `Truck capacity is ${TRUCK_SUPPLY_CAPACITY} units. Clear ${overflowUnits} units before supplier checkout.`
    };
  }

  let total = 0;
  for (const [supplyId, quality, quantity] of cartEntries) {
    const supply = bundle.supplies.find((entry) => entry.id === supplyId);
    if (!supply) {
      continue;
    }
    total += getSupplyUnitPrice(supply, quality, getActiveEvents(bundle, state.activeEventIds)) * quantity;
  }
  const discountedTotal = Math.max(0, Math.round(total * (1 - Math.max(0, Math.min(0.2, supplyDiscountPct)))));
  if (state.player.cash < discountedTotal) {
    const shortfall = discountedTotal - state.player.cash;
    const declineMessage = `Balance declined at supplier checkout. Need $${shortfall} more (total $${discountedTotal}).`;
    logLines.push(declineMessage);
    return {
      ok: false,
      notice: `Balance declined. Need $${shortfall} more for supplier checkout.`
    };
  }

  state.player.cash -= discountedTotal;
  for (const [supplyId, quality, quantity] of cartEntries) {
    addSupplyQuantity(state.truckSupplies, supplyId, quality, quantity);
  }
  activeJob.supplierCart = {};
  if (discountedTotal < total) {
    logLines.push(`Estimating perk discount: -$${total - discountedTotal}.`);
  }
  logLines.push(`Checked out supplies for $${discountedTotal}.`);
  return { ok: true };
}

function reserveMaterials(truckSupplies: SupplyInventory, materialNeeds: JobDef["materialNeeds"]): SupplyInventory | null {
  for (const material of materialNeeds) {
    if (getSupplyQuantity(truckSupplies, material.supplyId) < material.quantity) {
      return null;
    }
  }
  const reserved: SupplyInventory = {};
  for (const material of materialNeeds) {
    let remaining = material.quantity;
    for (const quality of ["high", "medium", "low"] as SupplyQuality[]) {
      const available = getSupplyQuantity(truckSupplies, material.supplyId, quality);
      const take = Math.min(available, remaining);
      if (take <= 0) {
        continue;
      }
      addSupplyQuantity(reserved, material.supplyId, quality, take);
      addSupplyQuantity(truckSupplies, material.supplyId, quality, -take);
      remaining -= take;
      if (remaining <= 0) {
        break;
      }
    }
  }
  return reserved;
}

function settleActiveJob(state: GameState, bundle: ContentBundle, job: JobDef): { outcome: Outcome; cashDelta: number; logLines: string[] } {
  const activeJob = state.activeJob!;
  if (activeJob.recoveryMode === "finish_cheap") {
    const cashDelta = Math.max(0, Math.round(activeJob.lockedPayout * 0.7));
    const reputationBefore = state.player.reputation;
    state.player.cash += cashDelta;
    state.player.reputation = Math.max(0, state.player.reputation - 1);
    const appliedRepDelta = state.player.reputation - reputationBefore;
    state.player.companyLevel = deriveCompanyLevel(state.player.reputation);
    state.player.districtUnlocks = unlockDistricts(bundle, state.player.companyLevel);
    activeJob.outcome = "neutral";
    applySelfEsteemDelta(state, -2);
    return {
      outcome: "neutral",
      cashDelta,
      logLines: [
        `Parts quality settled at ${formatSupplyQuality(activeJob.partsQuality ?? "low")} (${activeJob.partsQualityModifier >= 0 ? "+" : ""}${activeJob.partsQualityModifier} quality).`,
        "Cut Losses: Finish Cheap closed the job at reduced quality.",
        `Collected neutral payment: cash +${cashDelta}, rep ${appliedRepDelta}.`
      ]
    };
  }

  const events = getActiveEvents(bundle, state.activeEventIds);
  const effectiveQualityPoints = activeJob.qualityPoints + activeJob.partsQualityModifier;
  const perkModifiers = getTaskPerkModifiers(state, job, "collect_payment", false);
  const failChance = getSettlementFailChance(state, activeJob, job, events, effectiveQualityPoints, state.day);
  let outcome: Outcome = "success";
  if (isForcedNeutral(job, events)) {
    outcome = "neutral";
  } else if (createRng(hashSeed(state.seed, state.day, activeJob.contractId, "collect")).bool(failChance)) {
    outcome = "fail";
  } else if (effectiveQualityPoints <= -3) {
    outcome = "neutral";
  }

  const qualityRepMod = clamp(Math.floor(effectiveQualityPoints / 3), -3, 3);
  const scheduleRepMod =
    activeJob.actualTicksSpent <= activeJob.plannedTicks - 2
      ? 1
      : activeJob.actualTicksSpent >= activeJob.plannedTicks + 4
        ? -1
        : 0;

  let cashDelta = 0;
  let repDelta = 0;
  let flavorLine = job.flavor.neutral_line;
  let payoutBonusLine: string | null = null;
  if (outcome === "success") {
    const payoutBonus = getSettlementPayoutBonus(activeJob, effectiveQualityPoints);
    cashDelta = Math.max(0, Math.round(activeJob.lockedPayout * (1 + payoutBonus.totalPct) * perkModifiers.payoutMultiplier));
    repDelta = job.repGainSuccess;
    flavorLine = job.flavor.success_line;
    payoutBonusLine = `Payout bonus: Time ${formatSignedPercent(payoutBonus.timeBonusPct)} + Quality ${formatSignedPercent(
      payoutBonus.qualityBonusPct
    )} = ${formatSignedPercent(payoutBonus.totalPct)}.`;
  } else if (outcome === "neutral") {
    cashDelta = Math.max(0, Math.round(activeJob.lockedPayout * 0.5 * (1 + Math.max(0, state.perks.corePerks.negotiation ?? 0) * 0.01)));
    repDelta = 0;
    flavorLine = job.flavor.neutral_line || bundle.strings.neutralLogFallback;
  } else {
    cashDelta = 0;
    repDelta = -Math.abs(job.repLossFail);
    flavorLine = job.flavor.fail_line;
  }

  const reputationBefore = state.player.reputation;
  let requestedRepDelta = repDelta + qualityRepMod + scheduleRepMod;
  if (outcome === "success") {
    requestedRepDelta = Math.max(2, requestedRepDelta);
  } else if (outcome === "neutral") {
    requestedRepDelta = Math.max(1, requestedRepDelta);
  }
  state.player.cash += cashDelta;
  state.player.reputation = Math.max(0, reputationBefore + requestedRepDelta);
  const appliedRepDelta = state.player.reputation - reputationBefore;
  state.player.companyLevel = deriveCompanyLevel(state.player.reputation);
  state.player.districtUnlocks = unlockDistricts(bundle, state.player.companyLevel);
  activeJob.outcome = outcome;
  let selfEsteemDelta = outcome === "success" ? 8 : outcome === "neutral" ? 2 : -10;
  if (outcome === "success" && cashDelta >= activeJob.lockedPayout * 1.15) {
    selfEsteemDelta += 2;
  }
  applySelfEsteemDelta(state, selfEsteemDelta);

  return {
    outcome,
    cashDelta,
    logLines: [
      `Parts quality settled at ${formatSupplyQuality(activeJob.partsQuality ?? "medium")} (${activeJob.partsQualityModifier >= 0 ? "+" : ""}${activeJob.partsQualityModifier} quality).`,
      flavorLine,
      outcome === "neutral"
        ? `Job completed at low quality. Client approved half pay: cash +${cashDelta}, rep ${appliedRepDelta}.`
        : `Collected ${outcome} payment: cash ${cashDelta >= 0 ? "+" : ""}${cashDelta}, rep ${appliedRepDelta}.`,
      ...(payoutBonusLine ? [payoutBonusLine] : [])
    ]
  };
}

function getSettlementPayoutBonus(
  activeJob: ActiveJobState,
  effectiveQualityPoints: number
): { timeBonusPct: number; qualityBonusPct: number; totalPct: number } {
  const ticksDelta = activeJob.plannedTicks - activeJob.actualTicksSpent;
  let timeBonusPct = 0;
  if (ticksDelta >= 4) {
    timeBonusPct = 0.15;
  } else if (ticksDelta >= 2) {
    timeBonusPct = 0.08;
  } else if (ticksDelta >= 0) {
    timeBonusPct = 0.03;
  } else if (ticksDelta <= -5) {
    timeBonusPct = -0.1;
  } else {
    timeBonusPct = -0.04;
  }

  let qualityBonusPct = 0;
  if (effectiveQualityPoints >= 6) {
    qualityBonusPct = 0.12;
  } else if (effectiveQualityPoints >= 2) {
    qualityBonusPct = 0.06;
  } else if (effectiveQualityPoints < -1) {
    qualityBonusPct = -0.08;
  }

  return {
    timeBonusPct,
    qualityBonusPct,
    totalPct: clamp(timeBonusPct + qualityBonusPct, -0.15, 0.3)
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
      return activeJob.location === "shop" ? null : "Return to storage before loading supplies.";
    case "refuel_at_station":
      return activeJob.location === "shop" ? null : "Return to storage before refueling at the gas station.";
    case "travel_to_supplier":
      if (activeJob.location !== "shop") {
        return "Supplier runs start from storage.";
      }
      return state.player.fuel < SHOP_SUPPLIER_FUEL ? "Not enough fuel for the supplier run." : null;
    case "checkout_supplies":
      if (activeJob.location !== "supplier") {
        return "Travel to the supplier first.";
      }
      return hasRequiredSupplierAllocation(job, state.truckSupplies, activeJob.supplierCart)
        ? null
        : describeSupplierCartNeed(bundle, job, state.truckSupplies, activeJob.supplierCart);
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
      return null;
    case "do_work":
      if (activeJob.location !== "job-site") {
        return "Travel to the job site first.";
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
        ? "Not enough fuel to get back to storage."
        : null;
    case "store_leftovers":
      return activeJob.location === "shop" ? null : "Return to storage before storing leftovers.";
  }
}

function commitActiveJobStamina(state: GameState, job: JobDef, logLines: string[]): void {
  const activeJob = state.activeJob!;
  const assignee = getJobAssignee(state.player, activeJob.assignee);
  if (!assignee || activeJob.staminaCommitted) {
    return;
  }
  activeJob.staminaCommitted = true;
  logLines.push(`${assignee.name} started work on ${job.name}.`);
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

function repairActiveJobRouting(activeJob: ActiveJobState | null): void {
  if (!activeJob) {
    return;
  }

  const travelToSupplierTask = activeJob.tasks.find((task) => task.taskId === "travel_to_supplier");
  const checkoutTask = activeJob.tasks.find((task) => task.taskId === "checkout_supplies");
  if (!travelToSupplierTask || !checkoutTask) {
    return;
  }

  const checkoutOutstanding = checkoutTask.requiredUnits > checkoutTask.completedUnits;
  const travelToSupplierComplete = travelToSupplierTask.completedUnits >= travelToSupplierTask.requiredUnits;
  if (activeJob.location === "shop" && checkoutOutstanding && travelToSupplierComplete) {
    travelToSupplierTask.requiredUnits = travelToSupplierTask.completedUnits + 1;
  }
}

function hasOutstandingSupplierStop(activeJob: ActiveJobState): boolean {
  const checkoutTask = activeJob.tasks.find((task) => task.taskId === "checkout_supplies");
  return Boolean(checkoutTask && checkoutTask.requiredUnits > checkoutTask.completedUnits);
}

function getDefaultTaskGuidance(taskId: TaskId): string {
  switch (taskId) {
    case "load_from_shop":
      return "Next step: Load required supplies from storage.";
    case "refuel_at_station":
      return "Next step: Continue route tasks. Refuel stops are optional unless you hit zero fuel.";
    case "travel_to_supplier":
      return "Next step: Travel to Supplier.";
    case "checkout_supplies":
      return "Next step: Allocate materials in Supplier Cart.";
    case "travel_to_job_site":
      return "Next step: Travel to Job Site.";
    case "pickup_site_supplies":
      return "Next step: Pick up site supplies.";
    case "do_work":
      return "Next step: Take action on the job or end day.";
    case "collect_payment":
      return "Next step: Collect payment.";
    case "return_to_shop":
      return "Next step: Return to Storage.";
    case "store_leftovers":
      return "Next step: Store leftovers in storage.";
  }
}

function getLoadFromShopGuidance(state: GameState, bundle: ContentBundle, job: JobDef): string {
  const base = "Next step: Load required supplies from storage.";
  const extras = job.materialNeeds
    .map((material) => {
      const extraQuantity = getSupplyQuantity(state.shopSupplies, material.supplyId) - material.quantity;
      if (extraQuantity <= 0) {
        return null;
      }
      const supplyName = bundle.supplies.find((entry) => entry.id === material.supplyId)?.name ?? material.supplyId;
      return `${supplyName} +${extraQuantity}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (extras.length === 0) {
    return base;
  }

  const topExtras = extras.slice(0, 2);
  const extraTail = extras.length > 2 ? `, +${extras.length - 2} more` : "";
  return `${base} You have extra stock for this job: ${topExtras.join(", ")}${extraTail}.`;
}

function getBlockedTaskGuidance(taskId: TaskId, blockedReason: string, activeJob: ActiveJobState): string {
  const normalizedReason = blockedReason.toLowerCase();
  if (normalizedReason.includes("fuel")) {
    return "Next step: Walk to the nearest gas station for rescue fuel (or run Day Labor for gas money).";
  }
  if (normalizedReason.includes("missing usable tools")) {
    return "Next step: Return to Storage for tool repair or replacement.";
  }
  if (normalizedReason.includes("supplier cart") || normalizedReason.includes("quality before checkout")) {
    return "Next step: Allocate materials in Supplier Cart.";
  }
  if (normalizedReason.includes("supplier checkout")) {
    return "Next step: Allocate materials in Supplier Cart.";
  }
  if (taskId === "checkout_supplies" && activeJob.location !== "supplier") {
    return "Next step: Travel to Supplier.";
  }
  if (normalizedReason.includes("supplier")) {
    return "Next step: Travel to Supplier.";
  }
  if (normalizedReason.includes("job site")) {
    return "Next step: Travel to Job Site.";
  }
  if (normalizedReason.includes("materials")) {
    return "Next step: Load or buy required materials.";
  }
  return getDefaultTaskGuidance(taskId);
}

function getSettlementFailChance(
  state: GameState,
  activeJob: ActiveJobState,
  job: JobDef,
  events: EventDef[],
  effectiveQualityPoints: number,
  day: number
): number {
  const onboardingFailBuffer = day <= 5 ? 0.1 : 0;
  const selfEsteemRiskDelta = getSelfEsteemBandEffects(state).settlementFailChance;
  return clamp(
    getRiskValue(job, events) +
      activeJob.reworkCount * 0.04 -
      Math.max(0, effectiveQualityPoints) * 0.02 -
      onboardingFailBuffer +
      selfEsteemRiskDelta,
    0,
    0.95
  );
}

function getRiskBandFromFailChance(failChance: number): RiskBand {
  if (failChance < 0.25) {
    return "low";
  }
  if (failChance < 0.55) {
    return "medium";
  }
  return "high";
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

function getMinimumFuelNeededAfterRefuel(activeJob: ActiveJobState, district: DistrictDef): number {
  if (hasOutstandingSupplierStop(activeJob)) {
    return SHOP_SUPPLIER_FUEL;
  }

  if (getTaskUnitsRemaining(activeJob.tasks, "travel_to_job_site") > 0) {
    return activeJob.location === "supplier" ? district.travel.supplierToSiteFuel : district.travel.shopToSiteFuel;
  }

  if (getTaskUnitsRemaining(activeJob.tasks, "return_to_shop") > 0) {
    return district.travel.shopToSiteFuel;
  }

  return 0;
}

function estimateContractRouteFuelCost(district: DistrictDef, needsSupplier: boolean, storageOwned: boolean): number {
  const routeFuelUnits =
    (needsSupplier ? SHOP_SUPPLIER_FUEL + district.travel.supplierToSiteFuel : district.travel.shopToSiteFuel) +
    (storageOwned ? district.travel.shopToSiteFuel : 0);
  return routeFuelUnits * FUEL_PRICE;
}

function getRemainingTravelFuelUnits(activeJob: ActiveJobState, district: DistrictDef): number {
  const supplierUnits = getTaskUnitsRemaining(activeJob.tasks, "travel_to_supplier");
  const toSiteUnits = getTaskUnitsRemaining(activeJob.tasks, "travel_to_job_site");
  const returnUnits = getTaskUnitsRemaining(activeJob.tasks, "return_to_shop");
  const toSiteFuelPerUnit = hasOutstandingSupplierStop(activeJob) ? district.travel.supplierToSiteFuel : district.travel.shopToSiteFuel;
  return Math.max(0, supplierUnits * SHOP_SUPPLIER_FUEL + toSiteUnits * toSiteFuelPerUnit + returnUnits * district.travel.shopToSiteFuel);
}

function getTaskUnitsRemaining(tasks: ActiveTaskState[], taskId: TaskId): number {
  const task = tasks.find((entry) => entry.taskId === taskId);
  if (!task) {
    return 0;
  }
  return Math.max(0, task.requiredUnits - task.completedUnits);
}

function estimateMaterialPurchaseCost(
  state: GameState,
  bundle: ContentBundle,
  job: JobDef,
  events: EventDef[],
  activeJob: ActiveJobState | null = null
): number {
  if (job.materialNeeds.length === 0) {
    return 0;
  }
  if (activeJob?.materialsReserved) {
    return 0;
  }

  const available = mergeSupplyInventories(cloneSupplyInventory(state.shopSupplies), state.truckSupplies);
  if (activeJob) {
    mergeSupplyInventories(available, activeJob.siteSupplies);
    mergeSupplyInventories(available, activeJob.supplierCart);
  }

  const shortfall = getMaterialShortfall(job.materialNeeds, available);
  return Object.entries(shortfall).reduce((sum, [supplyId, quantity]) => {
    const supply = bundle.supplies.find((entry) => entry.id === supplyId);
    if (!supply || quantity <= 0) {
      return sum;
    }
    return sum + getSupplyUnitPrice(supply, "medium", events) * quantity;
  }, 0);
}

function estimateTrashHandlingCost(state: GameState, job: JobDef, activeJob: ActiveJobState | null = null): number {
  if (job.id === DAY_LABOR_JOB_ID) {
    return 0;
  }
  const trashUnits = Math.max(0, Math.floor(job.trashUnits ?? 0));
  if (trashUnits <= 0) {
    return 0;
  }
  if (activeJob && isTaskComplete(activeJob.tasks, "collect_payment")) {
    return 0;
  }
  if (!state.operations.facilities.dumpsterEnabled) {
    return getPremiumHaulCost(trashUnits);
  }
  return trashUnits * 4;
}

function getContractExpenseTotalFromLog(state: GameState, contractId: string): number {
  return state.log.reduce((sum, entry) => {
    if (entry.actorId !== state.player.actorId || entry.contractId !== contractId) {
      return sum;
    }
    return sum + parseContractExpenseFromMessage(entry.message);
  }, 0);
}

function getContractExpenseTotalFromMessages(messages: string[]): number {
  return messages.reduce((sum, message) => sum + parseContractExpenseFromMessage(message), 0);
}

function parseContractExpenseFromMessage(message: string): number {
  const breakdown = parseContractCostBreakdown(message);
  return breakdown.materials + breakdown.fuel + breakdown.trash + breakdown.other;
}

function parseContractCostBreakdown(message: string): { materials: number; fuel: number; trash: number; other: number } {
  const normalize = (value: string | undefined): number => {
    const amount = Number.parseInt(value ?? "0", 10);
    return Number.isFinite(amount) ? Math.max(0, amount) : 0;
  };

  const materials = normalize(message.match(/Checked out supplies for \$([0-9]+)\./i)?.[1]);
  const fuel =
    normalize(message.match(/Bought [0-9]+ fuel for \$([0-9]+)\./i)?.[1]) +
    normalize(message.match(/Ran a gas-station stop for [0-9]+ fuel(?: on account)? \(\$([0-9]+)\)\./i)?.[1]) +
    normalize(message.match(/Refueled [0-9]+ at the gas station(?: on account)? \(\$([0-9]+)\)\./i)?.[1]) +
    normalize(message.match(/Refueled [0-9]+ at the gas station for \$([0-9]+)\./i)?.[1]);
  const trash = normalize(message.match(/Premium haul-off charged \$([0-9]+) for [0-9]+ trash units\./i)?.[1]);
  const toolRepair = normalize(message.match(/Returned to (?:the )?(?:shop|storage) to repair or replace broken tools .* fuel -([0-9]+)\./i)?.[1]);
  const canCost = normalize(message.match(/Bought OSHA-approved gas can for \$([0-9]+)\./i)?.[1]);
  const other = toolRepair + canCost;
  return { materials, fuel, trash, other };
}

function formatSignedCurrency(amount: number): string {
  const normalized = Number.isFinite(amount) ? Math.round(amount) : 0;
  return normalized >= 0 ? `+$${normalized}` : `-$${Math.abs(normalized)}`;
}

function formatSignedPercent(value: number): string {
  const normalized = Number.isFinite(value) ? value : 0;
  const percent = Math.round(normalized * 100);
  return percent >= 0 ? `+${percent}%` : `${percent}%`;
}

function getRecommendedFieldFuelReserve(state: GameState, bundle: ContentBundle): number {
  const activeJob = state.activeJob;
  if (!activeJob || activeJob.location === "shop") {
    return 0;
  }
  const district = getDistrict(bundle, activeJob.districtId);
  if (activeJob.location === "supplier") {
    return district.travel.supplierToSiteFuel;
  }
  return district.travel.shopToSiteFuel;
}

function getTaskBaseTicks(task: ActiveTaskState, job: JobDef): number {
  if (task.taskId === "do_work") {
    return 2;
  }
  return task.baseTicks;
}

function getPlannedTaskTicksForAction(task: ActiveTaskState, job: JobDef, stance: TaskStance): number {
  if (task.taskId === "refuel_at_station") {
    return getRefuelTaskTicks(stance);
  }
  return getTaskBaseTicks(task, job);
}

function getRefuelTaskTicks(taskStance: TaskStance): number {
  return 1;
}

function getRefuelPurchaseUnits(state: GameState, bundle: ContentBundle, taskStance: TaskStance): number {
  const room = Math.max(0, state.player.fuelMax - state.player.fuel);
  if (room <= 0) {
    return 0;
  }
  if (taskStance === "rush") {
    return 1;
  }
  if (taskStance === "careful") {
    const affordableUnits = Math.max(0, Math.floor(state.player.cash / FUEL_PRICE));
    return affordableUnits >= room ? room : Math.max(0, Math.min(room, Math.max(1, affordableUnits)));
  }
  if (taskStance === "standard") {
    return 0;
  }
  const activeJob = state.activeJob;
  const district = activeJob ? getDistrict(bundle, activeJob.districtId) : null;
  const supplierOutstanding = activeJob ? hasOutstandingSupplierStop(activeJob) : false;
  const immediateNeed = district
    ? supplierOutstanding
      ? SHOP_SUPPLIER_FUEL
      : getTravelFuelCost("travel_to_job_site", district, "shop")
    : 1;
  const reserve = district ? Math.max(district.travel.shopToSiteFuel, district.travel.supplierToSiteFuel) : 1;
  const targetFuel = Math.min(state.player.fuelMax, immediateNeed + reserve);
  return clamp(Math.max(1, targetFuel - state.player.fuel), 1, room);
}

function getRemainingRegularTicks(workday: WorkdayState): number {
  return Math.max(0, workday.availableTicks - workday.ticksSpent);
}

function getJobMaterialRoutingPlan(
  job: JobDef,
  shopSupplies: SupplyInventory,
  truckSupplies: SupplyInventory
): { requiresShopLoad: boolean; needsSupplier: boolean } {
  if (job.materialNeeds.length === 0) {
    return { requiresShopLoad: false, needsSupplier: false };
  }

  const missingFromTruck = getMaterialShortfall(job.materialNeeds, truckSupplies);
  const requiresShopLoad = Object.entries(missingFromTruck).some(
    ([supplyId, quantity]) => quantity > 0 && getSupplyQuantity(shopSupplies, supplyId) > 0
  );

  const combinedSupplies = mergeSupplyInventories(cloneSupplyInventory(shopSupplies), truckSupplies);
  const missingAfterShopAndTruck = getMaterialShortfall(job.materialNeeds, combinedSupplies);
  const needsSupplier = Object.values(missingAfterShopAndTruck).some((quantity) => quantity > 0);

  return { requiresShopLoad, needsSupplier };
}

function canStageJobMaterialsWithCurrentTruckLoad(job: JobDef, truckSupplies: SupplyInventory): boolean {
  if (job.materialNeeds.length === 0) {
    return true;
  }
  const truckUnits = getSupplyInventoryUnits(truckSupplies);
  if (truckUnits > TRUCK_SUPPLY_CAPACITY) {
    return false;
  }
  const availableRoom = Math.max(0, TRUCK_SUPPLY_CAPACITY - truckUnits);
  const additionalUnitsNeeded = job.materialNeeds.reduce((sum, material) => {
    const onTruck = getSupplyQuantity(truckSupplies, material.supplyId);
    return sum + Math.max(0, material.quantity - onTruck);
  }, 0);
  return additionalUnitsNeeded <= availableRoom;
}

function moveSuppliesForJob(shopSupplies: SupplyInventory, truckSupplies: SupplyInventory, materialNeeds: JobDef["materialNeeds"]): void {
  for (const material of materialNeeds) {
    let remaining = Math.max(0, material.quantity - getSupplyQuantity(truckSupplies, material.supplyId));
    for (const quality of ["high", "medium", "low"] as SupplyQuality[]) {
      const availableTruckRoom = Math.max(0, TRUCK_SUPPLY_CAPACITY - getSupplyInventoryUnits(truckSupplies));
      if (availableTruckRoom <= 0) {
        return;
      }
      const available = getSupplyQuantity(shopSupplies, material.supplyId, quality);
      const loadQuantity = Math.min(available, remaining, availableTruckRoom);
      if (loadQuantity <= 0) {
        continue;
      }
      addSupplyQuantity(shopSupplies, material.supplyId, quality, -loadQuantity);
      addSupplyQuantity(truckSupplies, material.supplyId, quality, loadQuantity);
      remaining -= loadQuantity;
      if (remaining <= 0) {
        break;
      }
    }
  }
}

function moveTruckSuppliesIntoStorage(truckSupplies: SupplyInventory, storageSupplies: SupplyInventory): { movedUnits: number; overflowUnits: number } {
  const storageRoom = Math.max(0, STORAGE_SUPPLY_CAPACITY - getSupplyInventoryUnits(storageSupplies));
  return moveAllSupplies(truckSupplies, storageSupplies, storageRoom);
}

function moveAllSupplies(from: SupplyInventory, to: SupplyInventory, maxUnits = Number.MAX_SAFE_INTEGER): { movedUnits: number; overflowUnits: number } {
  let remainingCapacity = Number.isFinite(maxUnits) ? Math.max(0, Math.floor(maxUnits)) : Number.MAX_SAFE_INTEGER;
  let movedUnits = 0;
  for (const [supplyId, quality, quantity] of listInventoryEntries(from)) {
    if (remainingCapacity <= 0) {
      break;
    }
    const transferQuantity = Math.min(quantity, remainingCapacity);
    if (transferQuantity <= 0) {
      continue;
    }
    addSupplyQuantity(from, supplyId, quality, -transferQuantity);
    addSupplyQuantity(to, supplyId, quality, transferQuantity);
    movedUnits += transferQuantity;
    remainingCapacity -= transferQuantity;
  }
  return { movedUnits, overflowUnits: getSupplyInventoryUnits(from) };
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
    const remaining = material.quantity - getSupplyQuantity(inventory, material.supplyId);
    if (remaining > 0) {
      shortfall[material.supplyId] = remaining;
    }
  }
  return shortfall;
}

function describeSupplierCartNeed(bundle: ContentBundle, job: JobDef, inventory: SupplyInventory, cart: SupplyInventory): string {
  const shortfall = getMaterialShortfall(job.materialNeeds, mergeSupplyInventories(cloneSupplyInventory(inventory), cart));
  const lines = Object.entries(shortfall)
    .map(([supplyId, quantity]) => {
      const supplyName = bundle.supplies.find((entry) => entry.id === supplyId)?.name ?? supplyId;
      return `${quantity}x ${supplyName}`;
    })
    .slice(0, 4);
  if (lines.length === 0) {
    return "Required supplies are already covered. Proceed with checkout.";
  }
  return `Allocate the needed items by quality before checkout: ${lines.join(", ")}.`;
}

function hasRequiredSupplierAllocation(job: JobDef, inventory: SupplyInventory, cart: SupplyInventory): boolean {
  return !Object.values(getMaterialShortfall(job.materialNeeds, mergeSupplyInventories(cloneSupplyInventory(inventory), cart))).some((quantity) => quantity > 0);
}

function calculateMaterialQuality(inventory: SupplyInventory): MaterialQualityResult {
  let totalUnits = 0;
  let totalScore = 0;
  for (const [, quality, quantity] of listInventoryEntries(inventory)) {
    totalUnits += quantity;
    totalScore += quantity * getMaterialTierScore(quality);
  }
  const score = totalUnits > 0 ? totalScore / totalUnits : 1;
  const quality = score < 0.75 ? "low" : score < 1.5 ? "medium" : "high";
  const modifier = quality === "low" ? -2 : quality === "high" ? 2 : 0;
  return { quality, score, modifier };
}

function getMaterialTierScore(quality: SupplyQuality): number {
  if (quality === "low") {
    return 0;
  }
  if (quality === "high") {
    return 2;
  }
  return 1;
}

function mergeSupplyInventories(target: SupplyInventory, incoming: SupplyInventory): SupplyInventory {
  for (const [supplyId, quality, quantity] of listInventoryEntries(incoming)) {
    addSupplyQuantity(target, supplyId, quality, quantity);
  }
  return target;
}

function listInventoryEntries(inventory: SupplyInventory): Array<[string, SupplyQuality, number]> {
  const entries: Array<[string, SupplyQuality, number]> = [];
  for (const [supplyId, stack] of Object.entries(inventory)) {
    for (const quality of SUPPLY_QUALITIES) {
      const quantity = Math.max(0, stack?.[quality] ?? 0);
      if (quantity > 0) {
        entries.push([supplyId, quality, quantity]);
      }
    }
  }
  return entries;
}

function isInventoryEmpty(inventory: SupplyInventory): boolean {
  return listInventoryEntries(inventory).length === 0;
}

function setInventoryQuantity(inventory: SupplyInventory, supplyId: string, quality: SupplyQuality, quantity: number): void {
  const normalized = Math.max(0, Math.floor(quantity));
  if (normalized <= 0) {
    addSupplyQuantity(inventory, supplyId, quality, -(getSupplyQuantity(inventory, supplyId, quality)));
    return;
  }
  const stack = inventory[supplyId] ?? {};
  stack[quality] = normalized;
  inventory[supplyId] = stack;
}

function addSupplyQuantity(inventory: SupplyInventory, supplyId: string, quality: SupplyQuality, delta: number): void {
  if (delta === 0) {
    return;
  }
  const stack = inventory[supplyId] ?? {};
  const nextQuantity = Math.max(0, (stack[quality] ?? 0) + delta);
  if (nextQuantity > 0) {
    stack[quality] = nextQuantity;
    inventory[supplyId] = stack;
    return;
  }
  delete stack[quality];
  if (SUPPLY_QUALITIES.every((tier) => !stack[tier])) {
    delete inventory[supplyId];
  } else {
    inventory[supplyId] = stack;
  }
}

function cloneSupplyInventory(inventory: SupplyInventory | undefined): SupplyInventory {
  return Object.fromEntries(
    Object.entries(inventory ?? {}).map(([supplyId, stack]) => [
      supplyId,
      Object.fromEntries(
        SUPPLY_QUALITIES.map((quality) => [quality, Math.max(0, stack?.[quality] ?? 0)]).filter(([, quantity]) => quantity > 0)
      ) as SupplyStack
    ])
  );
}

function normalizeSupplyInventory(inventory: unknown): SupplyInventory {
  if (!inventory || typeof inventory !== "object") {
    return {};
  }

  const normalized: SupplyInventory = {};
  for (const [supplyId, raw] of Object.entries(inventory as Record<string, unknown>)) {
    if (typeof raw === "number") {
      if (raw > 0) {
        normalized[supplyId] = { medium: Math.floor(raw) };
      }
      continue;
    }
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const stack: SupplyStack = {};
    for (const quality of SUPPLY_QUALITIES) {
      const value = (raw as Record<string, unknown>)[quality];
      if (typeof value === "number" && value > 0) {
        stack[quality] = Math.floor(value);
      }
    }
    if (SUPPLY_QUALITIES.some((quality) => (stack[quality] ?? 0) > 0)) {
      normalized[supplyId] = stack;
    }
  }
  return normalized;
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

function spendTicks(workday: WorkdayState, ticks: number, overtimeFatigueReduction = 0): void {
  const before = workday.ticksSpent;
  workday.ticksSpent += ticks;
  const overflowStart = Math.max(0, before - workday.availableTicks);
  const overflowEnd = Math.max(0, workday.ticksSpent - workday.availableTicks);
  const overflowDelta = Math.max(0, overflowEnd - overflowStart);
  workday.overtimeUsed += overflowDelta;
  const reducedFatigue = Math.max(0, overflowDelta - Math.max(0, overtimeFatigueReduction));
  workday.fatigue.debt += reducedFatigue;
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
    botCareers: state.botCareers.map((career) => cloneBotCareer(career)),
    contractBoard: state.contractBoard.map((contract) => ({ ...contract })),
    activeEventIds: [...state.activeEventIds],
    log: state.log.map((entry) => ({ ...entry })),
    activeJob: cloneActiveJob(state.activeJob),
    shopSupplies: cloneSupplyInventory(state.shopSupplies),
    truckSupplies: cloneSupplyInventory(state.truckSupplies),
    research: cloneResearchState(state.research),
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
    contractFiles: state.contractFiles.map((entry) => ({ ...entry })),
    workday: {
      ...state.workday,
      fatigue: { ...state.workday.fatigue }
    }
  };
}

function cloneBotCareer(career: BotCareerState): BotCareerState {
  return {
    actor: cloneActor(career.actor),
    activeJob: cloneActiveJob(career.activeJob),
    contractBoard: career.contractBoard.map((contract) => ({ ...contract })),
    log: career.log.map((entry) => ({ ...entry })),
    shopSupplies: cloneSupplyInventory(career.shopSupplies),
    truckSupplies: cloneSupplyInventory(career.truckSupplies),
    workday: {
      ...career.workday,
      fatigue: { ...career.workday.fatigue }
    },
    research: cloneResearchState(career.research),
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
    contractFiles: career.contractFiles.map((entry) => ({ ...entry }))
  };
}

function cloneResearchState(state: GameState["research"]): GameState["research"] {
  return {
    babaUnlocked: state.babaUnlocked,
    unlockedCategories: { ...state.unlockedCategories },
    unlockedSkills: { ...state.unlockedSkills },
    activeProject: state.activeProject ? { ...state.activeProject } : null,
    completedProjectIds: [...state.completedProjectIds]
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
    estimateAtAccept: { ...activeJob.estimateAtAccept },
    reservedMaterials: cloneSupplyInventory(activeJob.reservedMaterials),
    siteSupplies: cloneSupplyInventory(activeJob.siteSupplies),
    supplierCart: cloneSupplyInventory(activeJob.supplierCart),
    tasks: activeJob.tasks.map((task) => ({ ...task }))
  };
}

function getLargestEstimatedCostDriver(
  materialsCost: number,
  fuelCost: number,
  trashCost: number
): ContractEstimateSnapshot["biggestCostDriver"] {
  const options: Array<{ key: ContractEstimateSnapshot["biggestCostDriver"]; value: number }> = [
    { key: "materials", value: materialsCost },
    { key: "fuel", value: fuelCost },
    { key: "trash", value: trashCost }
  ];
  options.sort((left, right) => right.value - left.value);
  return (options[0]?.value ?? 0) > 0 ? options[0]!.key : "none";
}

function getLargestActualCostDriver(
  materialsCost: number,
  fuelCost: number,
  trashCost: number,
  otherCost: number
): ContractActualSnapshot["biggestCostDriver"] {
  const options: Array<{ key: ContractActualSnapshot["biggestCostDriver"]; value: number }> = [
    { key: "materials", value: materialsCost },
    { key: "fuel", value: fuelCost },
    { key: "trash", value: trashCost },
    { key: "other", value: otherCost }
  ];
  options.sort((left, right) => right.value - left.value);
  return (options[0]?.value ?? 0) > 0 ? options[0]!.key : "none";
}

function formatCostDriverLabel(driver: ContractActualSnapshot["biggestCostDriver"]): string {
  if (driver === "materials") {
    return "materials";
  }
  if (driver === "fuel") {
    return "fuel";
  }
  if (driver === "trash") {
    return "premium haul / trash";
  }
  if (driver === "other") {
    return "other costs";
  }
  return "costs";
}

function parseSignedInt(value: string | undefined): number {
  const amount = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(amount) ? amount : 0;
}

function parseSignedCurrencyToken(token: string): number {
  const normalized = token.replace("$", "").trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeContractFile(entry: Partial<ContractFileSnapshot> | null | undefined): ContractFileSnapshot | null {
  if (!entry || !entry.contractId || !entry.jobId) {
    return null;
  }
  const status: ContractFileStatus =
    entry.status === "active" || entry.status === "completed" || entry.status === "deferred" || entry.status === "abandoned" || entry.status === "lost"
      ? entry.status
      : "completed";
  return {
    contractId: entry.contractId,
    jobId: entry.jobId,
    jobName: entry.jobName ?? entry.jobId,
    dayAccepted: Math.max(1, Math.floor(entry.dayAccepted ?? 1)),
    dayClosed: entry.dayClosed === null || entry.dayClosed === undefined ? null : Math.max(1, Math.floor(entry.dayClosed)),
    isBaba: Boolean(entry.isBaba),
    baseQuote: Math.max(0, Math.round(entry.baseQuote ?? 0)),
    autoBid: Math.max(0, Math.round(entry.autoBid ?? entry.baseQuote ?? 0)),
    acceptedPayout: Math.max(0, Math.round(entry.acceptedPayout ?? entry.autoBid ?? entry.baseQuote ?? 0)),
    estimatingLevelAtBid: Math.max(0, Math.floor(entry.estimatingLevelAtBid ?? 0)),
    bidAccuracyBandPct: clamp(entry.bidAccuracyBandPct ?? 0, 0, 1),
    bidNoise: clamp(entry.bidNoise ?? 0, -1, 1),
    estimatedHoursAtAccept: Math.max(0, entry.estimatedHoursAtAccept ?? 0),
    actualHoursAtClose: Math.max(0, entry.actualHoursAtClose ?? 0),
    estimatedNetAtAccept: Math.round(entry.estimatedNetAtAccept ?? 0),
    actualNetAtClose: Math.round(entry.actualNetAtClose ?? 0),
    outcome: entry.outcome ?? null,
    status
  };
}

function upsertContractFile(existing: ContractFileSnapshot[], next: ContractFileSnapshot): ContractFileSnapshot[] {
  const withoutCurrent = existing.filter((entry) => entry.contractId !== next.contractId);
  return [...withoutCurrent, { ...next }];
}

function updateContractFile(state: GameState, contractId: string, patch: Partial<ContractFileSnapshot>): void {
  const index = state.contractFiles.findIndex((entry) => entry.contractId === contractId);
  if (index < 0) {
    return;
  }
  const current = state.contractFiles[index]!;
  const next: ContractFileSnapshot = normalizeContractFile({
    ...current,
    ...patch
  })!;
  state.contractFiles = state.contractFiles.map((entry, entryIndex) => (entryIndex === index ? next : entry));
}

function getStoredEstimateAtAccept(state: GameState, contractId: string): ContractEstimateSnapshot | null {
  if (state.activeJob?.contractId === contractId) {
    return { ...state.activeJob.estimateAtAccept };
  }
  const deferred = state.deferredJobs.find((entry) => entry.activeJob.contractId === contractId);
  if (deferred) {
    return { ...deferred.activeJob.estimateAtAccept };
  }
  const contractFile = state.contractFiles.find((entry) => entry.contractId === contractId);
  if (contractFile) {
    const estimatedTotalCost = Math.max(0, contractFile.acceptedPayout - contractFile.estimatedNetAtAccept);
    return {
      grossPayout: Math.max(0, contractFile.acceptedPayout),
      materialsCost: 0,
      fuelCost: 0,
      trashCost: 0,
      estimatedTotalCost,
      projectedNetOnSuccess: contractFile.estimatedNetAtAccept,
      biggestCostDriver: "none"
    };
  }

  const estimateLine = [...state.log]
    .reverse()
    .find((entry) => entry.actorId === state.player.actorId && entry.contractId === contractId && entry.message.startsWith("Estimate at accept:"));
  if (!estimateLine) {
    return null;
  }
  const match = estimateLine.message.match(
    /^Estimate at accept: Gross \$([0-9]+), Costs \$([0-9]+), Net ([+-]\$?[0-9]+), Driver (materials|fuel|trash|none)\./i
  );
  if (!match) {
    return null;
  }
  const grossPayout = Math.max(0, parseSignedInt(match[1]));
  const estimatedTotalCost = Math.max(0, parseSignedInt(match[2]));
  const projectedNetOnSuccess = parseSignedCurrencyToken(match[3] ?? "0");
  const driverRaw = (match[4] ?? "none").toLowerCase();
  const biggestCostDriver: ContractEstimateSnapshot["biggestCostDriver"] =
    driverRaw === "materials" || driverRaw === "fuel" || driverRaw === "trash" ? driverRaw : "none";
  const materialsCost = biggestCostDriver === "materials" ? estimatedTotalCost : 0;
  const fuelCost = biggestCostDriver === "fuel" ? estimatedTotalCost : 0;
  const trashCost = biggestCostDriver === "trash" ? estimatedTotalCost : 0;
  return {
    grossPayout,
    materialsCost,
    fuelCost,
    trashCost,
    estimatedTotalCost,
    projectedNetOnSuccess,
    biggestCostDriver
  };
}

function sortDeferredJobs(entries: DeferredJobState[]): DeferredJobState[] {
  return [...entries].sort((left, right) => {
    if (left.deferredAtDay !== right.deferredAtDay) {
      return left.deferredAtDay - right.deferredAtDay;
    }
    return left.deferredJobId.localeCompare(right.deferredJobId);
  });
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

export function getRemainingShiftTicks(workday: WorkdayState): number {
  return Math.max(0, workday.availableTicks + (workday.maxOvertime - workday.overtimeUsed) - workday.ticksSpent);
}

function getRemainingDayLaborTicks(workday: WorkdayState): number {
  return Math.max(0, workday.availableTicks - workday.ticksSpent);
}

export function getQuickBuyPlan(
  state: GameState,
  bundle: ContentBundle,
  contractId: string
): QuickBuyPlan | null {
  const picked = getJobByContract(state, bundle, contractId);
  if (!picked) {
    return null;
  }
  const { job } = picked;
  const events = getActiveEvents(bundle, state.activeEventIds);
  const missingTools: QuickBuyToolLine[] = [];
  const starterGateActive = shouldEnforceStarterToolGate(bundle) && !state.operations.facilities.storageOwned;
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
  const starterGateBlocked = starterGateActive && missingTools.some((entry) => !isStarterToolId(entry.toolId));
  const totalCost = missingTools.reduce((sum, entry) => sum + entry.price, 0);
  const requiredTicks = missingTools.length * 2;
  const allowed = !state.activeJob || state.activeJob.location === "shop" || !state.operations.facilities.storageOwned;
  const enoughCash = state.player.cash >= totalCost;
  const enoughTime = requiredTicks === 0 ? true : canSpendTicks(state.workday, requiredTicks, true);
  return {
    contractId,
    missingTools,
    totalCost,
    requiredTicks,
    enoughCash,
    enoughTime,
    allowed,
    starterGateBlocked
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
  if (plan.starterGateBlocked) {
    const blockedToolNames = plan.missingTools.filter((entry) => !isStarterToolId(entry.toolId)).map((entry) => entry.toolName);
    const blockedToolLabel = formatQuickBuyToolList(blockedToolNames);
    const storageNotice =
      blockedToolNames.length <= 1
        ? `${blockedToolLabel} needs storage unlocked before quick buy because non-starter tools need storage space.`
        : `${blockedToolLabel} need storage unlocked before quick buy because non-starter tools need storage space.`;
    return {
      nextState: state,
      payload: plan,
      notice: storageNotice,
      digest: digestState(state)
    };
  }
  if (!plan.allowed) {
    return { nextState: state, payload: plan, notice: "Return to storage before quick buying tools.", digest: digestState(state) };
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
  awardOfficeSkillXp(nextState, { reading: 1 });
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

function formatQuickBuyToolList(toolNames: string[]): string {
  if (toolNames.length === 0) {
    return "This tool";
  }
  if (toolNames.length === 1) {
    return toolNames[0]!;
  }
  if (toolNames.length === 2) {
    return `${toolNames[0]} and ${toolNames[1]}`;
  }
  return `${toolNames.slice(0, -1).join(", ")}, and ${toolNames[toolNames.length - 1]}`;
}
