export type Outcome = "success" | "fail" | "neutral" | "lost";

export const TRADE_SKILLS = [
  "electrician",
  "plumber",
  "carpenter",
  "mason",
  "concrete_finisher",
  "roofer",
  "hvac_technician",
  "drywall_installer",
  "painter",
  "flooring_installer",
  "glazier",
  "insulation_installer",
  "framer",
  "siding_installer",
  "fence_installer",
  "cabinet_maker",
  "millworker",
  "scaffolder",
  "solar_panel_installer",
  "heavy_equipment_operator",
  "demolition_specialist",
  "low_voltage_data_tech",
  "lineman",
  "pipefitter",
  "steamfitter",
  "sprinkler_fitter",
  "gas_fitter",
  "refrigeration_technician",
  "boiler_technician",
  "sheet_metal_worker",
  "welder",
  "metal_fabricator",
  "machinist",
  "cnc_operator",
  "blacksmith",
  "auto_mechanic",
  "diesel_mechanic",
  "small_engine_repair",
  "motorcycle_technician",
  "aircraft_mechanic",
  "landscaper",
  "arborist",
  "irrigation_technician",
  "well_driller",
  "industrial_maintenance",
  "millwright",
  "elevator_technician",
  "robotics_technician",
  "tile_setter",
  "upholsterer"
] as const;

export type SkillId =
  | "electrician"
  | "plumber"
  | "carpenter"
  | "mason"
  | "concrete_finisher"
  | "roofer"
  | "hvac_technician"
  | "drywall_installer"
  | "painter"
  | "flooring_installer"
  | "glazier"
  | "insulation_installer"
  | "framer"
  | "siding_installer"
  | "fence_installer"
  | "cabinet_maker"
  | "millworker"
  | "scaffolder"
  | "solar_panel_installer"
  | "heavy_equipment_operator"
  | "demolition_specialist"
  | "low_voltage_data_tech"
  | "lineman"
  | "pipefitter"
  | "steamfitter"
  | "sprinkler_fitter"
  | "gas_fitter"
  | "refrigeration_technician"
  | "boiler_technician"
  | "sheet_metal_worker"
  | "welder"
  | "metal_fabricator"
  | "machinist"
  | "cnc_operator"
  | "blacksmith"
  | "auto_mechanic"
  | "diesel_mechanic"
  | "small_engine_repair"
  | "motorcycle_technician"
  | "aircraft_mechanic"
  | "landscaper"
  | "arborist"
  | "irrigation_technician"
  | "well_driller"
  | "industrial_maintenance"
  | "millwright"
  | "elevator_technician"
  | "robotics_technician"
  | "tile_setter"
  | "upholsterer";

export type CoreTradeSkillId =
  | "carpenter"
  | "roofer"
  | "landscaper"
  | "welder"
  | "electrician"
  | "plumber"
  | "hvac_technician"
  | "drywall_installer"
  | "painter"
  | "flooring_installer"
  | "finish_carpentry";

export type TradeCategoryId =
  | "construction"
  | "electrical-utility-power"
  | "plumbing-pipe"
  | "hvac-mechanical"
  | "metal-fabrication"
  | "automotive-engine"
  | "outdoor-utility-ground"
  | "industrial-systems"
  | "finishing-specialty";

export type ResearchCategoryId = TradeCategoryId;

export type BusinessTier = "truck" | "office" | "yard";

export type PerkTreeId = "fundamentals" | "safety" | "finance" | "specialization";

export type CorePerkId =
  | "precision"
  | "blueprint_reading"
  | "safety_awareness"
  | "physical_endurance"
  | "problem_solving"
  | "estimating"
  | "tool_mastery"
  | "project_management"
  | "diagnostics"
  | "negotiation";

export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export type LocationId = "shop" | "supplier" | "job-site" | "gas-station";

export type TaskId =
  | "load_from_shop"
  | "refuel_at_station"
  | "travel_to_supplier"
  | "checkout_supplies"
  | "travel_to_job_site"
  | "pickup_site_supplies"
  | "do_work"
  | "collect_payment"
  | "return_to_shop"
  | "store_leftovers";

export type TaskStance = "rush" | "standard" | "careful";

export type RecoveryActionId = "finish_cheap" | "defer" | "abandon";
export type ActiveRecoveryMode = "none" | "finish_cheap";
export type ContractFilterId = "profitable" | "low-risk" | "near-route" | "no-new-tools";
export type PerkArchetypeId = "precision-shop" | "safety-first" | "margin-master" | "diagnostics-crew" | "field-closer";
export type ContractFileStatus = "active" | "completed" | "deferred" | "abandoned" | "lost";

export type TaskTimeOutcome = "fast" | "standard" | "delayed" | "rework";

export type TaskQualityOutcome = "excellent" | "solid" | "sloppy" | "botched";

export type SupplyQuality = "low" | "medium" | "high";

export type EncounterId = "rebar-bob";

export interface EncounterPayload {
  id: EncounterId;
  speaker: string;
  line: string;
}

export type SupplyTierValues = Record<SupplyQuality, number>;

export interface SupplyDef {
  id: string;
  name: string;
  prices: SupplyTierValues;
  tags: string[];
  flavor: {
    description: string;
    quip_buy: string;
  };
}

export interface ToolDef {
  id: string;
  name: string;
  tier: number;
  price: number;
  maxDurability: number;
  tags: string[];
  flavor: {
    description: string;
    quip_buy: string;
    quip_break: string;
  };
}

export interface JobMaterialNeed {
  supplyId: string;
  quantity: number;
}

export interface JobDef {
  id: string;
  name: string;
  primarySkill: SkillId;
  tier: number;
  districtId: string;
  requiredTools: string[];
  trashUnits: number;
  staminaCost: number;
  basePayout: number;
  risk: number;
  repGainSuccess: number;
  repLossFail: number;
  durabilityCost: number;
  workUnits: number;
  materialNeeds: JobMaterialNeed[];
  tags: string[];
  flavor: {
    client_quote: string;
    success_line: string;
    fail_line: string;
    neutral_line: string;
  };
}

export interface EventDef {
  id: string;
  name: string;
  weight: number;
  mods: {
    payoutMultByTag?: Record<string, number>;
    riskDeltaByTag?: Record<string, number>;
    forceNeutralTags?: string[];
    toolPriceMult?: number;
  };
  flavor: {
    headline: string;
    detail: string;
    impact_line: string;
    success_line: string;
    fail_line: string;
    neutral_line: string;
  };
}

export interface DistrictDef {
  id: string;
  name: string;
  tier: number;
  travel: {
    shopToSiteTicks: number;
    shopToSiteFuel: number;
    supplierToSiteTicks: number;
    supplierToSiteFuel: number;
  };
  flavor: {
    description: string;
  };
}

export interface BotProfile {
  id: string;
  name: string;
  weights: {
    wCash: number;
    wRep: number;
    wRiskAvoid: number;
    wToolBuy: number;
  };
  flavorLines: string[];
}

export interface StringsDef {
  title: string;
  subtitle: string;
  continueMissing: string;
  continueIncompatible: string;
  dayReportTitle: string;
  storeTitle: string;
  companyTitle: string;
  supplierTitle: string;
  workdayTitle: string;
  assignmentHint: string;
  noContracts: string;
  neutralLogFallback: string;
  crewDeferred: string;
  fuelLabel: string;
  homeSuppliesTitle: string;
  truckSuppliesTitle: string;
  siteSuppliesTitle: string;
  skillsTitle: string;
  activeJobTitle: string;
  boardTitle: string;
  overtimeLabel: string;
  hoursLabel: string;
  titlePlayerLabel: string;
  titlePlayerPlaceholder: string;
  titleCompanyLabel: string;
  titleCompanyPlaceholder: string;
  titleNameHint: string;
  quickBuyDescription: string;
  quickBuyButtonLabel: string;
  companyDistrictButton: string;
  companyCrewButton: string;
  companyNewsButton: string;
  defaultPlayerName: string;
  defaultCompanyName: string;
}

export interface ToolInstance {
  toolId: string;
  durability: number;
}

export interface CrewState {
  crewId: string;
  name: string;
  staminaMax: number;
  stamina: number;
  efficiency: number;
  reliability: number;
  morale: number;
}

export interface ActorState {
  actorId: string;
  name: string;
  companyName: string;
  cash: number;
  reputation: number;
  companyLevel: number;
  districtUnlocks: string[];
  staminaMax: number;
  stamina: number;
  fuel: number;
  fuelMax: number;
  skills: Record<SkillId, number>;
  tools: Record<string, ToolInstance>;
  crews: CrewState[];
}

export interface ContractInstance {
  contractId: string;
  jobId: string;
  districtId: string;
  payoutMult: number;
  expiresDay: number;
  claimedByActorId?: string;
}

export interface AssignmentIntent {
  assignee: "self" | string;
  contractId: string;
}

export interface Intent {
  actorId: string;
  day: number;
  assignments: AssignmentIntent[];
}

export interface Resolution {
  day: number;
  actorId: string;
  contractId: string;
  outcome: Outcome;
  winnerActorId?: string;
  cashDelta: number;
  repDelta: number;
  staminaBefore: number;
  staminaAfter: number;
  toolDurabilityBefore: Record<string, number>;
  toolDurabilityAfter: Record<string, number>;
  logLine: string;
}

export interface DayLog {
  day: number;
  actorId: string;
  contractId?: string;
  taskId?: TaskId;
  message: string;
}

export type SupplyStack = Partial<Record<SupplyQuality, number>>;

export type SupplyInventory = Record<string, SupplyStack>;

export interface CartLine {
  supplyId: string;
  quantity: number;
  unitPrice: number;
  quality: SupplyQuality;
}

export interface TaskSkillMapping {
  primary: SkillId;
  secondary?: SkillId;
}

export interface ActiveTaskState {
  taskId: TaskId;
  label: string;
  location: LocationId;
  baseTicks: number;
  requiredUnits: number;
  completedUnits: number;
  qualityBearing: boolean;
  availableStances: TaskStance[];
}

export interface FatigueState {
  debt: number;
}

export type SelfEsteemBand = "shaken" | "low" | "solid" | "cocky" | "reckless";

export interface SelfEsteemState {
  currentSelfEsteem: number;
  dailySelfEsteemDrift: number;
  lifetimeTimesAtZero: number;
  lifetimeTimesAtHundred: number;
  fullExtremeSwings: number;
  hasGrizzled: boolean;
}

export interface WorkdayState {
  ticksPerDay: number;
  availableTicks: number;
  ticksSpent: number;
  overtimeUsed: number;
  maxOvertime: number;
  weekday: Weekday;
  fatigue: FatigueState;
}

export interface ActiveJobState {
  contractId: string;
  jobId: string;
  districtId: string;
  acceptedDay: number;
  assignee: "self" | string;
  staminaCommitted: boolean;
  lockedPayout: number;
  location: LocationId;
  qualityPoints: number;
  reworkCount: number;
  plannedTicks: number;
  actualTicksSpent: number;
  materialsReserved: boolean;
  reservedMaterials: SupplyInventory;
  partsQuality: SupplyQuality | null;
  partsQualityScore: number;
  partsQualityModifier: number;
  estimateAtAccept: ContractEstimateSnapshot;
  recoveryMode: ActiveRecoveryMode;
  deferredAtDay: number | null;
  trashUnitsPending: number;
  siteSupplies: SupplyInventory;
  supplierCart: SupplyInventory;
  tasks: ActiveTaskState[];
  outcome?: Outcome;
}

export interface DeferredJobState {
  deferredJobId: string;
  activeJob: ActiveJobState;
  deferredAtDay: number;
}

export interface ContractEstimateSnapshot {
  grossPayout: number;
  materialsCost: number;
  fuelCost: number;
  trashCost: number;
  estimatedTotalCost: number;
  projectedNetOnSuccess: number;
  biggestCostDriver: "materials" | "fuel" | "trash" | "none";
}

export interface ContractActualSnapshot {
  payout: number;
  materialsCost: number;
  fuelCost: number;
  trashCost: number;
  otherCost: number;
  totalCost: number;
  net: number;
  biggestCostDriver: "materials" | "fuel" | "trash" | "other" | "none";
}

export interface JobProfitRecap {
  contractId: string;
  jobName: string;
  estimate: ContractEstimateSnapshot;
  actual: ContractActualSnapshot;
  deltaNet: number;
  summaryLine: string;
  day: number;
  estimatedHoursAtAccept: number;
  actualHoursAtClose: number;
}

export interface ContractFileSnapshot {
  contractId: string;
  jobId: string;
  jobName: string;
  dayAccepted: number;
  dayClosed: number | null;
  isBaba: boolean;
  baseQuote: number;
  autoBid: number;
  acceptedPayout: number;
  estimatingLevelAtBid: number;
  bidAccuracyBandPct: number;
  bidNoise: number;
  estimatedHoursAtAccept: number;
  actualHoursAtClose: number;
  estimatedNetAtAccept: number;
  actualNetAtClose: number;
  outcome: Outcome | null;
  status: ContractFileStatus;
}

export interface PerkArchetypeSnapshot {
  primary: PerkArchetypeId | null;
  secondary: PerkArchetypeId | null;
  scores: Record<PerkArchetypeId, number>;
  tags: string[];
}

export type ResearchProjectUnlockType = "baba" | "category" | "skill" | "facility" | "perk-tree";

export type FacilityUnlockId = "office" | "yard" | "dumpster";

export interface ResearchProjectState {
  projectId: string;
  label: string;
  cost: number;
  daysRequired: number;
  daysProgress: number;
  unlockType: ResearchProjectUnlockType;
  categoryId?: ResearchCategoryId;
  skillId?: SkillId;
  facilityId?: FacilityUnlockId;
  perkTreeId?: PerkTreeId;
  startedDay: number;
}

export interface ResearchState {
  babaUnlocked: boolean;
  unlockedCategories: Record<ResearchCategoryId, boolean>;
  unlockedSkills: Record<SkillId, boolean>;
  activeProject: ResearchProjectState | null;
  completedProjectIds: string[];
}

export interface TradeProgressState {
  unlocked: Record<CoreTradeSkillId, boolean>;
  unlockedDay: Partial<Record<CoreTradeSkillId, number>>;
}

export interface OfficeSkillsState {
  readingXp: number;
  accountingXp: number;
  readingXpToday: number;
  accountingXpToday: number;
}

export interface FacilitiesState {
  storageOwned: boolean;
  officeOwned: boolean;
  yardOwned: boolean;
  dumpsterEnabled: boolean;
}

export interface YardState {
  dumpsterUnits: number;
  dumpsterCapacity: number;
  emptiesPerformed: number;
}

export interface OperationsState {
  accountantHired: boolean;
  accountantHireDay: number | null;
  lastDailyBillsDay: number;
  billingCycleDay: number;
  monthlyDueByCategory: Record<string, number>;
  unpaidBalance: number;
  missedBillStrikes: number;
  lastDowngradeDay: number | null;
  businessTier: BusinessTier;
  facilities: FacilitiesState;
}

export interface PerksState {
  corePerks: Record<CorePerkId, number>;
  corePerkXp: number;
  corePerkPoints: number;
  unlockedPerkTrees: Record<PerkTreeId, boolean>;
  rerollTokens: number;
}

export interface TaskUnitResult {
  day: number;
  taskId: TaskId;
  stance: TaskStance;
  timeOutcome: TaskTimeOutcome;
  qualityOutcome?: TaskQualityOutcome;
  ticksSpent: number;
  unitsCompleted: number;
  qualityPointsDelta: number;
  skillXpDelta: Partial<Record<SkillId, number>>;
  reworkAdded: number;
  location: LocationId;
  taskEstimatedTicksTotal: number;
  taskActualTicksTotal: number;
  jobEstimatedTicksTotal: number;
  jobActualTicksTotal: number;
  encounter?: EncounterPayload;
  logLines: string[];
  digest: string;
}

export interface GameState {
  saveVersion: number;
  day: number;
  seed: number;
  player: ActorState;
  bots: ActorState[];
  contractBoard: ContractInstance[];
  activeEventIds: string[];
  log: DayLog[];
  activeJob: ActiveJobState | null;
  shopSupplies: SupplyInventory;
  truckSupplies: SupplyInventory;
  workday: WorkdayState;
  research: ResearchState;
  tradeProgress: TradeProgressState;
  officeSkills: OfficeSkillsState;
  yard: YardState;
  operations: OperationsState;
  perks: PerksState;
  selfEsteem: SelfEsteemState;
  deferredJobs: DeferredJobState[];
  contractFiles: ContractFileSnapshot[];
}

export interface ContentBundle {
  tools: ToolDef[];
  jobs: JobDef[];
  babaJobs: JobDef[];
  events: EventDef[];
  districts: DistrictDef[];
  bots: BotProfile[];
  supplies: SupplyDef[];
  strings: StringsDef;
}

export interface ResolverResult {
  nextState: GameState;
  resolutions: Resolution[];
  dayLog: DayLog[];
  digest: string;
}

export interface DayContext {
  events: EventDef[];
  daySeed: number;
}
