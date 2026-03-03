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
  "solar_panel_installer"
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
  | "solar_panel_installer";

export type ResearchCategoryId = "core-systems" | "structure" | "exterior" | "interior-finish";

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

export type TaskTimeOutcome = "fast" | "standard" | "delayed" | "rework";

export type TaskQualityOutcome = "excellent" | "solid" | "sloppy" | "botched";

export type SupplyQuality = "low" | "medium" | "high";

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
  trashUnitsPending: number;
  siteSupplies: SupplyInventory;
  supplierCart: SupplyInventory;
  tasks: ActiveTaskState[];
  outcome?: Outcome;
}

export type ResearchProjectUnlockType = "baba" | "category" | "skill";

export interface ResearchProjectState {
  projectId: string;
  label: string;
  cost: number;
  daysRequired: number;
  daysProgress: number;
  unlockType: ResearchProjectUnlockType;
  categoryId?: ResearchCategoryId;
  skillId?: SkillId;
  startedDay: number;
}

export interface ResearchState {
  babaUnlocked: boolean;
  unlockedCategories: Record<ResearchCategoryId, boolean>;
  unlockedSkills: Record<SkillId, boolean>;
  activeProject: ResearchProjectState | null;
  completedProjectIds: string[];
}

export interface OfficeSkillsState {
  readingXp: number;
  accountingXp: number;
  readingXpToday: number;
  accountingXpToday: number;
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
  officeSkills: OfficeSkillsState;
  yard: YardState;
  operations: OperationsState;
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
