import { create } from "zustand";
import { getActionDurationMs } from "../core/actionTiming";
import { loadContentBundle } from "../core/content";
import {
  BASE_DAY_TICKS,
  buyFuel as buyFuelFlow,
  closeOfficeManually as closeOfficeManuallyFlow,
  closeYardManually as closeYardManuallyFlow,
  DAY_LABOR_CONTRACT_ID,
  enableDumpsterService as enableDumpsterServiceFlow,
  emptyDumpsterAtYard as emptyDumpsterAtYardFlow,
  formatSkillLabel,
  getLevelForXp,
  getAvailableContractOffers,
  getCurrentTask,
  getJobProfitRecap,
  getOutOfGasRescuePlan,
  getOperatorLevel,
  getManualGasStationPlan,
  getSkillRank,
  getTaskSkillMapping,
  getVisibleTaskActions,
  quickBuyMissingTools as quickBuyMissingToolsFlow,
  resolveDayLaborMinigameResult as resolveDayLaborMinigameResultFlow,
  formatHours,
  ticksToHours,
  performTaskUnit as performTaskUnitFlow,
  returnToShopForTools as returnToShopForToolsFlow,
  runManualGasStation as runManualGasStationFlow,
  runOutOfGasRescue as runOutOfGasRescueFlow,
  setSupplierCartQuantity as setSupplierCartQuantityFlow,
  startResearch as startResearchFlow,
  openStorage as openStorageFlow,
  spendPerkPoint as spendPerkPointFlow,
  acceptContract as acceptContractFlow,
  upgradeBusinessTier as upgradeBusinessTierFlow,
  hireCrew as hireCrewFlow,
  setActiveJobAssignee as setActiveJobAssigneeFlow,
  runRecoveryAction as runRecoveryActionFlow,
  resumeDeferredJob as resumeDeferredJobFlow
} from "../core/playerFlow";
import { awardOfficeSkillXp } from "../core/operations";
import { hasIncompatibleLegacySave, load as loadGame, save as saveGame } from "../core/save";
import { buyTool, createInitialGameState, endShift, repairTool } from "../core/resolver";
import {
  BusinessTier,
  ContractFilterId,
  CorePerkId,
  EncounterPayload,
  DayLaborMinigameResult,
  DigMinigameConfig,
  GameState,
  JobProfitRecap,
  RecoveryActionId,
  SkillId,
  SupplyQuality,
  TaskId,
  TaskStance,
  TaskUnitResult
} from "../core/types";
import { DEFAULT_DIG_MINIGAME_CONFIG } from "../features/dayLaborDig/DigTypes";

export type ScreenId = "title" | "game";
export type GameTabId = "work" | "office" | "contracts" | "store" | "company";
export type OfficeSectionId = "contracts" | "facilities" | "accounting";
export type TutorialMode = "fresh-guided" | "current-save";
export type TutorialStepId =
  | "open-contracts"
  | "select-day-labor"
  | "complete-day-labor"
  | "continue-day-labor-results"
  | "end-day"
  | "select-baba-g"
  | "accept-baba-g"
  | "continue-baba-accept-results"
  | "complete-baba-task"
  | "continue-baba-task-results"
  | "done";
export type OfficeCategoryId = "operations" | "finance";
export interface OfficeCategorySectionsState {
  operations: "contracts" | "facilities";
  finance: "accounting";
}
export type WorkPanelId = "task" | "job-details" | "supplies" | "inventory" | "field-log";
export type StoreSectionId = "tools" | "stock";
export type ActiveModalId =
  | null
  | "job-details"
  | "inventory"
  | "store"
  | "supplies"
  | "skills"
  | "perks"
  | "field-log"
  | "active-events"
  | "districts"
  | "crews"
  | "news"
  | "settings";
export type ActiveSheetId = null | "supplies";
export type UiTextScale = "xsmall" | "default" | "large" | "xlarge";
export type UiColorMode = "classic" | "neon";
export type UiFxMode = "full" | "reduced";
const DAY_LABOR_CELEBRATION_MS = 5_000;
const JOB_COMPLETION_FX_MS = 1_600;
let dayLaborCelebrationTimer: ReturnType<typeof setTimeout> | null = null;
let timedTaskActionTimer: ReturnType<typeof setTimeout> | null = null;
let jobCompletionFxTimer: ReturnType<typeof setTimeout> | null = null;
const TUTORIAL_GUIDED_SEED = 424242;

export interface ActionSummary {
  title: string;
  lines: string[];
  digest: string;
}

export type ResultsSection = "Money" | "Stats" | "Inventory/Tools" | "Operations/Office" | "Progress/Other";
export type ResultsTone = "positive" | "negative" | "warning" | "neutral";

export interface ResultsRow {
  section: ResultsSection;
  label: string;
  before: string;
  after: string;
  delta: string;
  tone: ResultsTone;
}

export interface ResultsScreenState {
  title: string;
  digest: string;
  rows: ResultsRow[];
  detailLines: string[];
  openedAtMs: number;
  blocksGameplay: boolean;
}

export type ProgressPopupKind = "xp" | "skill-level" | "operator-level";
export type ProgressPopupSeverity = "small" | "medium" | "large";

export interface ProgressPopup {
  id: string;
  kind: ProgressPopupKind;
  title: string;
  lines: string[];
  severity: ProgressPopupSeverity;
  createdAtDigest: string;
}

export interface TimedTaskActionState {
  id: string;
  stance: TaskStance;
  allowOvertime: boolean;
  label: string;
  taskId: TaskId;
  startedAtMs: number;
  durationMs: number;
  endsAtMs: number;
}

export interface JobCompletionFxState {
  startedAtMs: number;
  durationMs: number;
  outcome: "success" | "neutral" | "fail";
  net: number;
}

export interface EncounterPopupState {
  id: string;
  speaker: string;
  line: string;
  startedAtMs: number;
  durationMs: number;
}

const UI_PREFS_KEY = "error-hammer-ui-prefs-v1";
const DEFAULT_OFFICE_CATEGORY_SECTIONS: OfficeCategorySectionsState = {
  operations: "contracts",
  finance: "accounting"
};

function getOfficeCategoryForSection(section: OfficeSectionId): OfficeCategoryId {
  return section === "accounting" ? "finance" : "operations";
}

export interface ActiveDayLaborMinigameState {
  sessionId: number;
  launchedAtMs: number;
  config: DigMinigameConfig;
}

function rememberOfficeSectionByCategory(current: OfficeCategorySectionsState, section: OfficeSectionId): OfficeCategorySectionsState {
  if (section === "contracts" || section === "facilities") {
    return { ...current, operations: section };
  }
  return { ...current, finance: section };
}

function getOfficeSectionForLegacyTab(tab: Extract<GameTabId, "contracts" | "store" | "company">): OfficeSectionId {
  if (tab === "contracts") {
    return "contracts";
  }
  if (tab === "store") {
    return "facilities";
  }
  return "contracts";
}

function isUiTextScale(value: unknown): value is UiTextScale {
  return value === "xsmall" || value === "default" || value === "large" || value === "xlarge";
}

function isUiColorMode(value: unknown): value is UiColorMode {
  return value === "classic" || value === "neon";
}

function isTutorialMode(value: unknown): value is TutorialMode {
  return value === "fresh-guided" || value === "current-save";
}

function isTutorialStepId(value: unknown): value is TutorialStepId {
  return (
    value === "open-contracts" ||
    value === "select-day-labor" ||
    value === "complete-day-labor" ||
    value === "continue-day-labor-results" ||
    value === "end-day" ||
    value === "select-baba-g" ||
    value === "accept-baba-g" ||
    value === "continue-baba-accept-results" ||
    value === "complete-baba-task" ||
    value === "continue-baba-task-results" ||
    value === "done"
  );
}

function isContractFilterId(value: unknown): value is ContractFilterId {
  return value === "profitable" || value === "low-risk" || value === "near-route" || value === "no-new-tools";
}

function normalizeContractFilters(value: unknown): ContractFilterId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value.filter((entry) => isContractFilterId(entry));
  return [...new Set(normalized)];
}

interface UiPrefsPayload {
  uiTextScale: UiTextScale;
  uiColorMode: UiColorMode;
  contractFilters: ContractFilterId[];
  uiFxMode: UiFxMode;
  tutorialCompleted: boolean;
  tutorialInProgress: boolean;
  tutorialStepId: TutorialStepId;
  tutorialMode: TutorialMode | null;
  tutorialStartDay: number | null;
}

function loadUiPreferences(): UiPrefsPayload {
  if (typeof localStorage === "undefined") {
    return {
      uiTextScale: "default",
      uiColorMode: "neon",
      contractFilters: [],
      uiFxMode: "full",
      tutorialCompleted: false,
      tutorialInProgress: false,
      tutorialStepId: "open-contracts",
      tutorialMode: null,
      tutorialStartDay: null
    };
  }
  const raw = localStorage.getItem(UI_PREFS_KEY);
  if (!raw) {
    return {
      uiTextScale: "default",
      uiColorMode: "neon",
      contractFilters: [],
      uiFxMode: "full",
      tutorialCompleted: false,
      tutorialInProgress: false,
      tutorialStepId: "open-contracts",
      tutorialMode: null,
      tutorialStartDay: null
    };
  }
  try {
    const parsed = JSON.parse(raw) as {
      uiTextScale?: unknown;
      uiColorMode?: unknown;
      contractFilters?: unknown;
      uiFxMode?: unknown;
      tutorialCompleted?: unknown;
      tutorialInProgress?: unknown;
      tutorialStepId?: unknown;
      tutorialMode?: unknown;
      tutorialStartDay?: unknown;
    };
    return {
      uiTextScale: isUiTextScale(parsed.uiTextScale) ? parsed.uiTextScale : "default",
      uiColorMode: isUiColorMode(parsed.uiColorMode) ? parsed.uiColorMode : "neon",
      contractFilters: normalizeContractFilters(parsed.contractFilters),
      uiFxMode: parsed.uiFxMode === "reduced" ? "reduced" : "full",
      tutorialCompleted: parsed.tutorialCompleted === true,
      tutorialInProgress: parsed.tutorialInProgress === true,
      tutorialStepId: isTutorialStepId(parsed.tutorialStepId) ? parsed.tutorialStepId : "open-contracts",
      tutorialMode: isTutorialMode(parsed.tutorialMode) ? parsed.tutorialMode : null,
      tutorialStartDay:
        typeof parsed.tutorialStartDay === "number" && Number.isFinite(parsed.tutorialStartDay) && parsed.tutorialStartDay >= 1
          ? Math.floor(parsed.tutorialStartDay)
          : null
    };
  } catch {
    return {
      uiTextScale: "default",
      uiColorMode: "neon",
      contractFilters: [],
      uiFxMode: "full",
      tutorialCompleted: false,
      tutorialInProgress: false,
      tutorialStepId: "open-contracts",
      tutorialMode: null,
      tutorialStartDay: null
    };
  }
}

function saveUiPreferences(prefs: UiPrefsPayload): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
}

interface UiState {
  screen: ScreenId;
  activeTab: GameTabId;
  officeCategory: OfficeCategoryId;
  officeSection: OfficeSectionId;
  officeCategorySections: OfficeCategorySectionsState;
  storeSection: StoreSectionId;
  activeModal: ActiveModalId;
  activeSheet: ActiveSheetId;
  selectedContractId: string | null;
  game: GameState | null;
  lastAction: ActionSummary | null;
  notice: string;
  timedTaskAction: TimedTaskActionState | null;
  jobCompletionFx: JobCompletionFxState | null;
  activeEncounterPopup: EncounterPopupState | null;
  activeTaskResultPopup: ActionSummary | null;
  activeResultsScreen: ResultsScreenState | null;
  gameplayMutationLocked: boolean;
  activeDayLaborMinigame: ActiveDayLaborMinigameState | null;
  uiTextScale: UiTextScale;
  uiColorMode: UiColorMode;
  uiFxMode: UiFxMode;
  contractFilters: ContractFilterId[];
  tutorialCompleted: boolean;
  tutorialInProgress: boolean;
  tutorialStepId: TutorialStepId;
  tutorialMode: TutorialMode | null;
  tutorialStartDay: number | null;
  dayLaborCelebrationActive: boolean;
  activeJobProfitRecap: JobProfitRecap | null;
  activeProgressPopup: ProgressPopup | null;
  progressQueue: ProgressPopup[];
  titlePlayerName: string;
  titleCompanyName: string;
  hydrateUiPrefs: () => void;
  setUiTextScale: (scale: UiTextScale) => void;
  setUiColorMode: (mode: UiColorMode) => void;
  setUiFxMode: (mode: UiFxMode) => void;
  setContractFilter: (filterId: ContractFilterId, enabled: boolean) => void;
  clearContractFilters: () => void;
  dismissJobProfitRecap: () => void;
  dismissJobCompletionFx: () => void;
  dismissResultsScreen: () => void;
  dismissTaskResultPopup: () => void;
  dismissEncounterPopup: () => void;
  setTitlePlayerName: (name: string) => void;
  setTitleCompanyName: (name: string) => void;
  startTutorial: (mode: TutorialMode) => void;
  resumeTutorial: () => void;
  skipTutorial: () => void;
  syncTutorialProgress: () => void;
  completeTutorial: () => void;
  newGame: (playerName?: string, companyName?: string, seed?: number) => void;
  continueGame: () => void;
  returnToTitle: () => void;
  goToTab: (tab: GameTabId) => void;
  setOfficeCategory: (category: OfficeCategoryId) => void;
  setOfficeSection: (section: OfficeSectionId) => void;
  openModal: (modal: Exclude<ActiveModalId, null>) => void;
  closeModal: () => void;
  openSheet: (sheet: Exclude<ActiveSheetId, null>) => void;
  closeSheet: () => void;
  setStoreSection: (section: StoreSectionId) => void;
  selectContract: (contractId: string | null) => void;
  clearNotice: () => void;
  dismissProgressPopup: () => void;
  launchDayLaborMinigame: () => void;
  restartDayLaborMinigame: () => void;
  submitDayLaborMinigameResult: (result: DayLaborMinigameResult) => void;
  forfeitDayLaborMinigame: () => void;
  acceptContract: (contractId: string) => void;
  setCartQuantity: (supplyId: string, quality: SupplyQuality, quantity: number) => void;
  performTaskUnit: (stance: TaskStance, allowOvertime?: boolean) => void;
  returnToShopForTools: () => void;
  endShift: () => void;
  buyFuel: (units?: number) => void;
  runManualGasStation: (mode?: "single" | "fill") => void;
  runOutOfGasRescue: () => void;
  buyTool: (toolId: string) => void;
  repairTool: (toolId: string) => void;
  quickBuyTools: (contractId: string) => void;
  hireCrew: () => void;
  setJobAssignee: (assignee: "self" | string) => void;
  runRecoveryAction: (action: RecoveryActionId) => void;
  resumeDeferredJob: (deferredJobId: string) => void;
  startResearch: (projectId: string) => void;
  spendPerkPoint: (perkId: CorePerkId) => void;
  openStorage: () => void;
  upgradeBusinessTier: (target: BusinessTier) => void;
  enableDumpsterService: () => void;
  closeOfficeManually: () => void;
  closeYardManually: () => void;
  hireAccountant: () => void;
  emptyDumpster: () => void;
}

function persistUiPrefsFromState(
  state: Pick<
    UiState,
    | "uiTextScale"
    | "uiColorMode"
    | "contractFilters"
    | "uiFxMode"
    | "tutorialCompleted"
    | "tutorialInProgress"
    | "tutorialStepId"
    | "tutorialMode"
    | "tutorialStartDay"
  >
) {
  saveUiPreferences({
    uiTextScale: state.uiTextScale,
    uiColorMode: state.uiColorMode,
    contractFilters: state.contractFilters,
    uiFxMode: state.uiFxMode,
    tutorialCompleted: state.tutorialCompleted,
    tutorialInProgress: state.tutorialInProgress,
    tutorialStepId: state.tutorialStepId,
    tutorialMode: state.tutorialMode,
    tutorialStartDay: state.tutorialStartDay
  });
}

const bundle = loadContentBundle();
const TOOL_NAME_BY_ID = new Map(bundle.tools.map((tool) => [tool.id, tool.name]));
const JOB_BY_ID = new Map([...bundle.jobs, ...bundle.babaJobs].map((job) => [job.id, job]));
const JOB_NAME_BY_ID = new Map([...bundle.jobs, ...bundle.babaJobs].map((job) => [job.id, job.name]));
const RESULTS_SECTION_ORDER: ResultsSection[] = ["Money", "Stats", "Inventory/Tools", "Operations/Office", "Progress/Other"];

function toSummary(title: string, lines: string[], digest: string): ActionSummary {
  return {
    title,
    lines,
    digest
  };
}

function ensureSummary(
  summary: ActionSummary | null | undefined,
  fallbackTitle: string,
  fallbackLines: string[],
  digest: string
): ActionSummary {
  return summary ?? toSummary(fallbackTitle, fallbackLines, digest);
}

function formatAcceptedContractLine(jobId: string): string {
  const jobName = JOB_NAME_BY_ID.get(jobId) ?? "the selected job";
  return `Accepted ${jobName}.`;
}

function isBabaJobId(jobId: string | null | undefined): boolean {
  if (!jobId) {
    return false;
  }
  return Boolean(JOB_BY_ID.get(jobId)?.tags.includes("baba-g"));
}

function isSelectedContractBaba(game: GameState, contractId: string | null): boolean {
  if (!contractId) {
    return false;
  }
  const offer = getAvailableContractOffers(game, bundle).find((entry) => entry.contract.contractId === contractId);
  if (offer) {
    return offer.job.tags.includes("baba-g");
  }
  const contract = game.contractBoard.find((entry) => entry.contractId === contractId);
  return isBabaJobId(contract?.jobId);
}

function formatSignedNumber(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return "0";
  }
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatSignedCurrency(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return "$0";
  }
  return rounded > 0 ? `+$${rounded}` : `-$${Math.abs(rounded)}`;
}

function formatHoursByTicks(value: number): string {
  return `${ticksToHours(value).toFixed(1)}h`;
}

function formatBool(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatTier(value: BusinessTier): string {
  if (value === "truck") {
    return "Truck";
  }
  if (value === "office") {
    return "Office";
  }
  return "Yard";
}

function getSupplyInventoryUnits(inventory: Record<string, Partial<Record<SupplyQuality, number>>>): number {
  let units = 0;
  for (const stack of Object.values(inventory)) {
    for (const quantity of Object.values(stack)) {
      units += Math.max(0, quantity ?? 0);
    }
  }
  return units;
}

function getUsableToolCount(game: GameState): number {
  return Object.values(game.player.tools).filter((tool) => tool.durability > 0).length;
}

function pushNumericRow(
  rows: ResultsRow[],
  section: ResultsSection,
  label: string,
  before: number,
  after: number,
  options?: {
    beforeLabel?: string;
    afterLabel?: string;
    deltaLabel?: string;
    polarity?: "higher-better" | "lower-better" | "neutral";
    formatter?: (value: number) => string;
    deltaFormatter?: (value: number) => string;
  }
) {
  if (before === after) {
    return;
  }
  const delta = after - before;
  const polarity = options?.polarity ?? "higher-better";
  let tone: ResultsTone = "neutral";
  if (polarity === "higher-better") {
    tone = delta > 0 ? "positive" : "negative";
  } else if (polarity === "lower-better") {
    tone = delta < 0 ? "positive" : "warning";
  } else {
    tone = delta > 0 ? "warning" : "neutral";
  }
  const formatter = options?.formatter ?? ((value: number) => `${Math.round(value)}`);
  const deltaFormatter = options?.deltaFormatter ?? formatSignedNumber;
  rows.push({
    section,
    label,
    before: options?.beforeLabel ?? formatter(before),
    after: options?.afterLabel ?? formatter(after),
    delta: options?.deltaLabel ?? deltaFormatter(delta),
    tone
  });
}

function pushTextRow(
  rows: ResultsRow[],
  section: ResultsSection,
  label: string,
  before: string,
  after: string,
  tone: ResultsTone
) {
  if (before === after) {
    return;
  }
  rows.push({
    section,
    label,
    before,
    after,
    delta: `${before} -> ${after}`,
    tone
  });
}

function pushBoolRow(
  rows: ResultsRow[],
  section: ResultsSection,
  label: string,
  before: boolean,
  after: boolean,
  options?: {
    toneWhenEnabled?: ResultsTone;
    toneWhenDisabled?: ResultsTone;
  }
) {
  if (before === after) {
    return;
  }
  const toneWhenEnabled = options?.toneWhenEnabled ?? "positive";
  const toneWhenDisabled = options?.toneWhenDisabled ?? "warning";
  const tone = after ? toneWhenEnabled : toneWhenDisabled;
  rows.push({
    section,
    label,
    before: formatBool(before),
    after: formatBool(after),
    delta: after ? "Enabled" : "Disabled",
    tone
  });
}

function buildResultsRows(previous: GameState, next: GameState): ResultsRow[] {
  const rows: ResultsRow[] = [];

  pushNumericRow(rows, "Money", "Cash", previous.player.cash, next.player.cash, {
    polarity: "higher-better",
    formatter: (value) => `$${Math.round(value)}`,
    deltaFormatter: formatSignedCurrency
  });
  pushNumericRow(rows, "Money", "Unpaid Balance", previous.operations.unpaidBalance, next.operations.unpaidBalance, {
    polarity: "lower-better",
    formatter: (value) => `$${Math.round(value)}`,
    deltaFormatter: formatSignedCurrency
  });
  pushNumericRow(
    rows,
    "Money",
    "Agreed Payout",
    previous.activeJob?.lockedPayout ?? 0,
    next.activeJob?.lockedPayout ?? 0,
    {
      polarity: "higher-better",
      formatter: (value) => `$${Math.round(value)}`,
      deltaFormatter: formatSignedCurrency
    }
  );

  pushNumericRow(rows, "Stats", "Reputation", previous.player.reputation, next.player.reputation, { polarity: "higher-better" });
  pushNumericRow(rows, "Stats", "Self Esteem", previous.selfEsteem.currentSelfEsteem, next.selfEsteem.currentSelfEsteem, {
    polarity: "higher-better"
  });
  pushNumericRow(rows, "Stats", "Fuel", previous.player.fuel, next.player.fuel, { polarity: "higher-better" });
  pushNumericRow(rows, "Stats", "Stamina", previous.player.stamina, next.player.stamina, { polarity: "higher-better" });
  pushNumericRow(rows, "Stats", "Fatigue Debt", previous.workday.fatigue.debt, next.workday.fatigue.debt, { polarity: "lower-better" });
  pushNumericRow(
    rows,
    "Stats",
    "Hours Remaining",
    previous.workday.availableTicks - previous.workday.ticksSpent,
    next.workday.availableTicks - next.workday.ticksSpent,
    {
      polarity: "higher-better",
      formatter: formatHoursByTicks,
      deltaFormatter: (value) => formatHoursByTicks(value)
    }
  );

  pushNumericRow(rows, "Inventory/Tools", "Usable Tools", getUsableToolCount(previous), getUsableToolCount(next), {
    polarity: "higher-better"
  });
  const changedToolIds = new Set([...Object.keys(previous.player.tools), ...Object.keys(next.player.tools)]);
  for (const toolId of [...changedToolIds].sort((left, right) => left.localeCompare(right))) {
    const beforeDurability = previous.player.tools[toolId]?.durability ?? 0;
    const afterDurability = next.player.tools[toolId]?.durability ?? 0;
    if (beforeDurability === afterDurability) {
      continue;
    }
    const toolName = TOOL_NAME_BY_ID.get(toolId) ?? toolId;
    pushNumericRow(rows, "Inventory/Tools", `${toolName} Durability`, beforeDurability, afterDurability, {
      polarity: "higher-better",
      formatter: (value) => `${Math.round(value)}`
    });
  }
  pushNumericRow(rows, "Inventory/Tools", "Truck Supplies", getSupplyInventoryUnits(previous.truckSupplies), getSupplyInventoryUnits(next.truckSupplies), {
    polarity: "neutral",
    formatter: (value) => `${Math.round(value)} units`,
    deltaFormatter: (value) => `${formatSignedNumber(value)} units`
  });
  pushNumericRow(rows, "Inventory/Tools", "Shop Supplies", getSupplyInventoryUnits(previous.shopSupplies), getSupplyInventoryUnits(next.shopSupplies), {
    polarity: "neutral",
    formatter: (value) => `${Math.round(value)} units`,
    deltaFormatter: (value) => `${formatSignedNumber(value)} units`
  });
  pushNumericRow(
    rows,
    "Inventory/Tools",
    "Site Supplies",
    getSupplyInventoryUnits(previous.activeJob?.siteSupplies ?? {}),
    getSupplyInventoryUnits(next.activeJob?.siteSupplies ?? {}),
    {
      polarity: "neutral",
      formatter: (value) => `${Math.round(value)} units`,
      deltaFormatter: (value) => `${formatSignedNumber(value)} units`
    }
  );

  pushTextRow(
    rows,
    "Operations/Office",
    "Business Tier",
    formatTier(previous.operations.businessTier),
    formatTier(next.operations.businessTier),
    "neutral"
  );
  pushBoolRow(rows, "Operations/Office", "Storage", previous.operations.facilities.storageOwned, next.operations.facilities.storageOwned);
  pushBoolRow(rows, "Operations/Office", "Office", previous.operations.facilities.officeOwned, next.operations.facilities.officeOwned);
  pushBoolRow(rows, "Operations/Office", "Yard", previous.operations.facilities.yardOwned, next.operations.facilities.yardOwned);
  pushBoolRow(
    rows,
    "Operations/Office",
    "Dumpster Service",
    previous.operations.facilities.dumpsterEnabled,
    next.operations.facilities.dumpsterEnabled
  );
  pushBoolRow(rows, "Operations/Office", "Accountant", previous.operations.accountantHired, next.operations.accountantHired);
  pushNumericRow(rows, "Operations/Office", "Dumpster Load", previous.yard.dumpsterUnits, next.yard.dumpsterUnits, { polarity: "lower-better" });

  pushNumericRow(rows, "Progress/Other", "Day", previous.day, next.day, { polarity: "higher-better" });
  pushTextRow(rows, "Progress/Other", "Weekday", previous.workday.weekday, next.workday.weekday, "neutral");
  pushNumericRow(rows, "Progress/Other", "Operator Level", getOperatorLevel(previous.player).level, getOperatorLevel(next.player).level, {
    polarity: "higher-better"
  });
  pushNumericRow(rows, "Progress/Other", "Perk Points", previous.perks.corePerkPoints, next.perks.corePerkPoints, {
    polarity: "higher-better"
  });
  pushNumericRow(rows, "Progress/Other", "Reading XP", previous.officeSkills.readingXp, next.officeSkills.readingXp, {
    polarity: "higher-better"
  });
  pushNumericRow(rows, "Progress/Other", "Accounting XP", previous.officeSkills.accountingXp, next.officeSkills.accountingXp, {
    polarity: "higher-better"
  });
  pushTextRow(
    rows,
    "Progress/Other",
    "Research",
    previous.research.activeProject ? `${previous.research.activeProject.label} (${previous.research.activeProject.daysProgress}/${previous.research.activeProject.daysRequired})` : "None",
    next.research.activeProject ? `${next.research.activeProject.label} (${next.research.activeProject.daysProgress}/${next.research.activeProject.daysRequired})` : "None",
    "neutral"
  );

  rows.sort((left, right) => {
    const sectionDelta = RESULTS_SECTION_ORDER.indexOf(left.section) - RESULTS_SECTION_ORDER.indexOf(right.section);
    if (sectionDelta !== 0) {
      return sectionDelta;
    }
    return left.label.localeCompare(right.label);
  });

  return rows;
}

function mergeDetailLines(...groups: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const lines of groups) {
    if (!lines) {
      continue;
    }
    for (const line of lines) {
      const normalized = line.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      merged.push(normalized);
    }
  }
  return merged;
}

export function buildResultsScreenState(
  previous: GameState,
  next: GameState,
  title: string,
  digest: string,
  detailLines: string[],
  options?: {
    blocksGameplay?: boolean;
  }
): ResultsScreenState | null {
  if (previous === next) {
    return null;
  }
  const rows = buildResultsRows(previous, next);
  const details = mergeDetailLines(detailLines);
  if (rows.length === 0 && details.length === 0) {
    return null;
  }
  return {
    title,
    digest,
    rows,
    detailLines: details,
    openedAtMs: Date.now(),
    blocksGameplay: options?.blocksGameplay ?? true
  };
}

function buildActionResults(
  previous: GameState,
  next: GameState,
  options: {
    title: string;
    digest: string;
    summaryLines?: string[];
    notice?: string;
    extraLines?: string[];
    blocksGameplay?: boolean;
  }
): ResultsScreenState | null {
  return buildResultsScreenState(
    previous,
    next,
    options.title,
    options.digest,
    mergeDetailLines(options.summaryLines, options.extraLines, options.notice ? [options.notice] : undefined),
    {
      blocksGameplay: options.blocksGameplay
    }
  );
}

function getDefaultContractId(game: GameState | null): string | null {
  if (!game) {
    return null;
  }
  return getAvailableContractOffers(game, bundle)[0]?.contract.contractId ?? null;
}

export function buildProgressPopups(previous: GameState, next: GameState, payload?: TaskUnitResult): ProgressPopup[] {
  if (!payload) {
    return [];
  }
  const xpEntries = Object.entries(payload.skillXpDelta)
    .filter(([, delta]) => (delta ?? 0) > 0)
    .sort(([left], [right]) => left.localeCompare(right)) as Array<[SkillId, number]>;

  if (xpEntries.length === 0) {
    return [];
  }

  const popups: ProgressPopup[] = [];

  for (const [skillId] of xpEntries) {
    const previousLevel = getLevelForXp(previous.player.skills[skillId] ?? 0);
    const nextLevel = getLevelForXp(next.player.skills[skillId] ?? 0);
    if (nextLevel > previousLevel) {
      popups.push({
        id: `${payload.digest}:skill:${skillId}:${nextLevel}`,
        kind: "skill-level",
        title: "Skill Leveled Up",
        lines: [`${formatSkillLabel(skillId)} reached Lv ${nextLevel}`],
        severity: "medium",
        createdAtDigest: payload.digest
      });
    }
  }

  const previousOperatorLevel = getOperatorLevel(previous.player).level;
  const nextOperatorLevel = getOperatorLevel(next.player).level;
  if (nextOperatorLevel > previousOperatorLevel) {
    popups.push({
      id: `${payload.digest}:operator:${nextOperatorLevel}`,
      kind: "operator-level",
      title: "Operator Leveled Up!",
      lines: [`Operator reached Lv ${nextOperatorLevel}`],
      severity: "large",
      createdAtDigest: payload.digest
    });
  }

  return popups;
}

function buildTaskResultLines(payload: TaskUnitResult): string[] {
  const lines = [
    ...payload.logLines,
    `Task Hours: Est ${ticksToHours(payload.taskEstimatedTicksTotal).toFixed(1)}h | Actual ${ticksToHours(payload.taskActualTicksTotal).toFixed(1)}h (this action)`
  ];
  if (payload.taskId === "collect_payment") {
    const estimatedHours = ticksToHours(payload.jobEstimatedTicksTotal);
    const actualHours = ticksToHours(payload.jobActualTicksTotal);
    const varianceHours = actualHours - estimatedHours;
    const varianceLabel = varianceHours >= 0 ? `+${varianceHours.toFixed(1)}h` : `${varianceHours.toFixed(1)}h`;
    lines.push(`Job Hours: Est ${estimatedHours.toFixed(1)}h | Actual ${actualHours.toFixed(1)}h`);
    lines.push(`Variance: ${varianceLabel}`);
  }
  const xpEntries = Object.entries(payload.skillXpDelta)
    .filter(([, delta]) => (delta ?? 0) > 0)
    .sort(([left], [right]) => left.localeCompare(right)) as Array<[SkillId, number]>;
  if (xpEntries.length === 0) {
    return lines;
  }
  const xpLine = `XP Earned: ${xpEntries.map(([skillId, delta]) => `${formatSkillLabel(skillId)} +${delta}`).join(" | ")}`;
  return [...lines, xpLine];
}

function enqueueProgressPopups(current: Pick<UiState, "activeProgressPopup" | "progressQueue">, incoming: ProgressPopup[]) {
  if (incoming.length === 0) {
    return {
      activeProgressPopup: current.activeProgressPopup,
      progressQueue: current.progressQueue
    };
  }
  if (!current.activeProgressPopup) {
    return {
      activeProgressPopup: incoming[0] ?? null,
      progressQueue: incoming.slice(1)
    };
  }
  return {
    activeProgressPopup: current.activeProgressPopup,
    progressQueue: [...current.progressQueue, ...incoming]
  };
}

function clearDayLaborCelebrationTimer() {
  if (dayLaborCelebrationTimer !== null) {
    clearTimeout(dayLaborCelebrationTimer);
    dayLaborCelebrationTimer = null;
  }
}

function clearTimedTaskActionTimer() {
  if (timedTaskActionTimer !== null) {
    clearTimeout(timedTaskActionTimer);
    timedTaskActionTimer = null;
  }
}

function clearJobCompletionFxTimer() {
  if (jobCompletionFxTimer !== null) {
    clearTimeout(jobCompletionFxTimer);
    jobCompletionFxTimer = null;
  }
}

function clearEncounterPopupTimer() {
  // Encounter popup is manual-dismiss only.
}

function doesResultsScreenBlockGameplay(activeResultsScreen: ResultsScreenState | null): boolean {
  if (!activeResultsScreen) {
    return false;
  }
  return activeResultsScreen.blocksGameplay ?? true;
}

function isGameplayMutationBlocked(state: Pick<UiState, "timedTaskAction" | "activeResultsScreen" | "activeDayLaborMinigame">): boolean {
  return Boolean(state.timedTaskAction || doesResultsScreenBlockGameplay(state.activeResultsScreen) || state.activeDayLaborMinigame);
}

function formatTimedActionLabel(game: GameState, taskId: TaskId): string {
  const activeJob = game.activeJob;
  if (!activeJob) {
    return "Task";
  }
  const job = bundle.jobs.find((entry) => entry.id === activeJob.jobId) ?? bundle.babaJobs.find((entry) => entry.id === activeJob.jobId) ?? null;
  if (!job) {
    return "Task";
  }
  const mapping = getTaskSkillMapping(job, taskId);
  return formatSkillLabel(mapping.primary);
}

function labelForStance(stance: TaskStance): string {
  if (stance === "rush") {
    return "Rush";
  }
  if (stance === "careful") {
    return "Careful";
  }
  return "Standard";
}

function labelForRefuelAction(stance: TaskStance): string {
  if (stance === "rush") {
    return "Skip Refuel";
  }
  if (stance === "careful") {
    return "Fill Tank";
  }
  return "Buy 1 Fuel";
}

function getGameplayLockNotice(): string {
  return "Action locked. Finish the current result screen, timer, or Day Labor run first.";
}

export const useUiStore = create<UiState>((set, get) => ({
  screen: "title",
  activeTab: "work",
  officeCategory: "operations",
  officeSection: "contracts",
  officeCategorySections: { ...DEFAULT_OFFICE_CATEGORY_SECTIONS },
  storeSection: "tools",
  activeModal: null,
  activeSheet: null,
  selectedContractId: null,
  game: null,
  lastAction: null,
  notice: "",
  timedTaskAction: null,
  activeDayLaborMinigame: null,
  jobCompletionFx: null,
  activeEncounterPopup: null,
  activeTaskResultPopup: null,
  activeResultsScreen: null,
  gameplayMutationLocked: false,
  uiTextScale: loadUiPreferences().uiTextScale,
  uiColorMode: loadUiPreferences().uiColorMode,
  uiFxMode: loadUiPreferences().uiFxMode,
  contractFilters: loadUiPreferences().contractFilters,
  tutorialCompleted: loadUiPreferences().tutorialCompleted,
  tutorialInProgress: loadUiPreferences().tutorialInProgress,
  tutorialStepId: loadUiPreferences().tutorialStepId,
  tutorialMode: loadUiPreferences().tutorialMode,
  tutorialStartDay: loadUiPreferences().tutorialStartDay,
  dayLaborCelebrationActive: false,
  activeJobProfitRecap: null,
  activeProgressPopup: null,
  progressQueue: [],
  titlePlayerName: "",
  titleCompanyName: "",
  hydrateUiPrefs: () => {
    const prefs = loadUiPreferences();
    set({
      uiTextScale: prefs.uiTextScale,
      uiColorMode: prefs.uiColorMode,
      uiFxMode: prefs.uiFxMode,
      contractFilters: prefs.contractFilters,
      tutorialCompleted: prefs.tutorialCompleted,
      tutorialInProgress: prefs.tutorialInProgress,
      tutorialStepId: prefs.tutorialStepId,
      tutorialMode: prefs.tutorialMode,
      tutorialStartDay: prefs.tutorialStartDay
    });
  },
  setUiTextScale: (scale) => {
    const current = get();
    persistUiPrefsFromState({ ...current, uiTextScale: scale });
    set({ uiTextScale: scale });
  },
  setUiColorMode: (mode) => {
    const current = get();
    persistUiPrefsFromState({ ...current, uiColorMode: mode });
    set({ uiColorMode: mode });
  },
  setUiFxMode: (mode) => {
    const current = get();
    persistUiPrefsFromState({ ...current, uiFxMode: mode });
    set({ uiFxMode: mode });
  },
  setContractFilter: (filterId, enabled) => {
    const current = get();
    const nextFilters = enabled ? [...new Set([...current.contractFilters, filterId])] : current.contractFilters.filter((entry) => entry !== filterId);
    persistUiPrefsFromState({ ...current, contractFilters: nextFilters });
    set({ contractFilters: nextFilters });
  },
  clearContractFilters: () => {
    const current = get();
    persistUiPrefsFromState({ ...current, contractFilters: [] });
    set({ contractFilters: [] });
  },
  dismissJobProfitRecap: () => {
    set({ activeJobProfitRecap: null });
  },
  dismissJobCompletionFx: () => {
    clearJobCompletionFxTimer();
    set((state) => ({
      jobCompletionFx: null,
      gameplayMutationLocked: Boolean(
        state.timedTaskAction || doesResultsScreenBlockGameplay(state.activeResultsScreen) || state.activeDayLaborMinigame
      )
    }));
  },
  dismissResultsScreen: () => {
    set((state) => ({
      activeResultsScreen: null,
      gameplayMutationLocked: Boolean(state.timedTaskAction || state.activeDayLaborMinigame)
    }));
  },
  dismissTaskResultPopup: () => {
    set({ activeTaskResultPopup: null });
  },
  dismissEncounterPopup: () => {
    set({ activeEncounterPopup: null });
  },

  newGame: (playerName?: string, companyName?: string, seed?: number) => {
    clearDayLaborCelebrationTimer();
    clearTimedTaskActionTimer();
    clearJobCompletionFxTimer();
    clearEncounterPopupTimer();
    const nextSeed = seed ?? Math.floor(Date.now() % 1_000_000_000);
    const resolvedPlayerName = playerName ?? bundle.strings.defaultPlayerName ?? "You";
    const resolvedCompanyName = companyName ?? bundle.strings.defaultCompanyName ?? "Field Ops";
    const game = createInitialGameState(bundle, nextSeed, resolvedPlayerName, resolvedCompanyName);
    saveGame(game);
    set({
      screen: "game",
      activeTab: "work",
      officeCategory: "operations",
      officeSection: "contracts",
      officeCategorySections: { ...DEFAULT_OFFICE_CATEGORY_SECTIONS },
      storeSection: "tools",
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(game),
      game,
      lastAction: null,
      notice: "",
      timedTaskAction: null,
      activeDayLaborMinigame: null,
      jobCompletionFx: null,
      activeEncounterPopup: null,
      activeTaskResultPopup: null,
      activeResultsScreen: null,
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
      activeJobProfitRecap: null,
      activeProgressPopup: null,
      progressQueue: [],
      titlePlayerName: resolvedPlayerName,
      titleCompanyName: resolvedCompanyName
    });
  },

  continueGame: () => {
    clearDayLaborCelebrationTimer();
    clearTimedTaskActionTimer();
    clearJobCompletionFxTimer();
    clearEncounterPopupTimer();
    const loaded = loadGame();
    if (!loaded) {
      set({ notice: hasIncompatibleLegacySave() ? bundle.strings.continueIncompatible : bundle.strings.continueMissing });
      return;
    }
    set({
      screen: "game",
      activeTab: "work",
      officeCategory: "operations",
      officeSection: "contracts",
      officeCategorySections: { ...DEFAULT_OFFICE_CATEGORY_SECTIONS },
      storeSection: "tools",
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(loaded),
      game: loaded,
      notice: "",
      timedTaskAction: null,
      activeDayLaborMinigame: null,
      jobCompletionFx: null,
      activeEncounterPopup: null,
      activeTaskResultPopup: null,
      activeResultsScreen: null,
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
      activeJobProfitRecap: null,
      activeProgressPopup: null,
      progressQueue: [],
      titlePlayerName: loaded.player.name,
      titleCompanyName: loaded.player.companyName
    });
  },

  returnToTitle: () =>
    (clearDayLaborCelebrationTimer(),
    clearTimedTaskActionTimer(),
    clearJobCompletionFxTimer(),
    clearEncounterPopupTimer(),
    set({
      screen: "title",
      activeModal: null,
      activeSheet: null,
      officeCategory: "operations",
      officeSection: "contracts",
      officeCategorySections: { ...DEFAULT_OFFICE_CATEGORY_SECTIONS },
      notice: "",
      timedTaskAction: null,
      activeDayLaborMinigame: null,
      jobCompletionFx: null,
      activeEncounterPopup: null,
      activeTaskResultPopup: null,
      activeResultsScreen: null,
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
      activeJobProfitRecap: null,
      activeProgressPopup: null,
      progressQueue: []
    })),

  goToTab: (tab) =>
    set((state) => {
      if (tab === "contracts" || tab === "store" || tab === "company") {
        const section = getOfficeSectionForLegacyTab(tab);
        const category = getOfficeCategoryForSection(section);
        return {
          activeTab: "office",
          officeCategory: category,
          officeSection: section,
          officeCategorySections: rememberOfficeSectionByCategory(state.officeCategorySections, section),
          activeModal: null,
          activeSheet: null
        };
      }
      if (tab === "office") {
        return { activeTab: "office", activeModal: null, activeSheet: null };
      }
      return { activeTab: tab, activeModal: null, activeSheet: null };
    }),
  setOfficeCategory: (category) =>
    set((state) => ({
      officeCategory: category,
      officeSection: state.officeCategorySections[category]
    })),
  setOfficeSection: (section) =>
    set((state) => {
      const category = getOfficeCategoryForSection(section);
      const officeCategorySections = rememberOfficeSectionByCategory(state.officeCategorySections, section);
      if (section !== "accounting" || !state.game) {
        return {
          officeCategory: category,
          officeSection: section,
          officeCategorySections
        };
      }
      const nextGame: GameState = {
        ...state.game,
        player: { ...state.game.player, skills: { ...state.game.player.skills }, tools: { ...state.game.player.tools }, crews: [...state.game.player.crews] },
        bots: [...state.game.bots],
        botCareers: state.game.botCareers.map((career) => ({
          ...career,
          actor: { ...career.actor, skills: { ...career.actor.skills }, tools: { ...career.actor.tools }, crews: [...career.actor.crews] },
          activeJob: career.activeJob ? { ...career.activeJob, tasks: [...career.activeJob.tasks] } : null,
          contractBoard: [...career.contractBoard],
          log: [...career.log],
          shopSupplies: { ...career.shopSupplies },
          truckSupplies: { ...career.truckSupplies },
          workday: { ...career.workday, fatigue: { ...career.workday.fatigue } },
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
          operations: { ...career.operations, monthlyDueByCategory: { ...career.operations.monthlyDueByCategory }, facilities: { ...career.operations.facilities } },
          perks: {
            ...career.perks,
            corePerks: { ...career.perks.corePerks },
            unlockedPerkTrees: { ...career.perks.unlockedPerkTrees }
          },
          selfEsteem: { ...career.selfEsteem },
          deferredJobs: career.deferredJobs.map((entry) => ({ ...entry, activeJob: { ...entry.activeJob, tasks: [...entry.activeJob.tasks] } })),
          contractFiles: [...career.contractFiles]
        })),
        contractBoard: [...state.game.contractBoard],
        activeEventIds: [...state.game.activeEventIds],
        log: [...state.game.log],
        activeJob: state.game.activeJob ? { ...state.game.activeJob, tasks: [...state.game.activeJob.tasks] } : null,
        shopSupplies: { ...state.game.shopSupplies },
        truckSupplies: { ...state.game.truckSupplies },
        workday: { ...state.game.workday, fatigue: { ...state.game.workday.fatigue } },
        research: {
          ...state.game.research,
          unlockedCategories: { ...state.game.research.unlockedCategories },
          unlockedSkills: { ...state.game.research.unlockedSkills },
          activeProject: state.game.research.activeProject ? { ...state.game.research.activeProject } : null,
          completedProjectIds: [...state.game.research.completedProjectIds]
        },
        officeSkills: { ...state.game.officeSkills },
        yard: { ...state.game.yard },
        operations: { ...state.game.operations }
      };
      awardOfficeSkillXp(nextGame, { accounting: 2 });
      saveGame(nextGame);
      return {
        officeCategory: category,
        officeSection: section,
        officeCategorySections,
        game: nextGame
      };
    }),

  openModal: (modal) => set({ activeModal: modal, activeSheet: null }),

  closeModal: () => set({ activeModal: null }),

  openSheet: (sheet) => set({ activeSheet: sheet, activeModal: null }),

  closeSheet: () => set({ activeSheet: null }),

  setStoreSection: (section) => set({ storeSection: section }),


  selectContract: (contractId) => set({ selectedContractId: contractId }),

  clearNotice: () => set({ notice: "" }),
  dismissProgressPopup: () =>
    set((state) => ({
      activeProgressPopup: state.progressQueue[0] ?? null,
      progressQueue: state.progressQueue.slice(1)
    })),
  setTitlePlayerName: (name) => set({ titlePlayerName: name }),
  setTitleCompanyName: (name) => set({ titleCompanyName: name }),
  startTutorial: (mode) => {
    if (mode === "fresh-guided") {
      const current = get();
      const sourcePlayerName = current.game?.player.name ?? current.titlePlayerName;
      const sourceCompanyName = current.game?.player.companyName ?? current.titleCompanyName;
      const resolvedPlayerName = sourcePlayerName.trim() || bundle.strings.defaultPlayerName || "You";
      const resolvedCompanyName = sourceCompanyName.trim() || bundle.strings.defaultCompanyName || "Field Ops";
      get().newGame(resolvedPlayerName, resolvedCompanyName, TUTORIAL_GUIDED_SEED);
      const started = get();
      const startDay = started.game?.day ?? 1;
      set({
        tutorialInProgress: true,
        tutorialStepId: "open-contracts",
        tutorialMode: mode,
        tutorialStartDay: startDay,
        activeModal: null,
        activeSheet: null,
        notice: ""
      });
      persistUiPrefsFromState(get());
      return;
    }

    if (!get().game) {
      get().continueGame();
    }
    const loaded = get();
    if (!loaded.game) {
      return;
    }
    set({
      screen: "game",
      tutorialInProgress: true,
      tutorialStepId: "open-contracts",
      tutorialMode: mode,
      tutorialStartDay: loaded.game.day,
      activeModal: null,
      activeSheet: null
    });
    persistUiPrefsFromState(get());
  },
  resumeTutorial: () => {
    const current = get();
    if (current.tutorialStepId === "done") {
      set({ tutorialCompleted: true, tutorialInProgress: false });
      persistUiPrefsFromState(get());
      return;
    }
    if (!current.game) {
      get().continueGame();
    }
    const loaded = get();
    if (!loaded.game) {
      return;
    }
    set({
      screen: "game",
      tutorialInProgress: true,
      tutorialMode: loaded.tutorialMode ?? "current-save",
      tutorialStartDay: loaded.tutorialStartDay ?? loaded.game.day,
      activeModal: null,
      activeSheet: null
    });
    persistUiPrefsFromState(get());
  },
  skipTutorial: () => {
    set({ tutorialInProgress: false, activeModal: null, activeSheet: null });
    persistUiPrefsFromState(get());
  },
  syncTutorialProgress: () => {
    const state = get();
    if (!state.tutorialInProgress || !state.game) {
      return;
    }
    let nextStep = state.tutorialStepId;
    if (state.tutorialStepId === "open-contracts") {
      if (state.activeTab === "office" && state.officeSection === "contracts") {
        nextStep = "select-day-labor";
      }
    } else if (state.tutorialStepId === "select-day-labor") {
      if (state.selectedContractId === DAY_LABOR_CONTRACT_ID) {
        nextStep = "complete-day-labor";
      }
    } else if (state.tutorialStepId === "complete-day-labor") {
      const hasDayLaborResults = Boolean(state.activeResultsScreen && state.lastAction?.title === "Day Laborer");
      if (hasDayLaborResults) {
        nextStep = "continue-day-labor-results";
      }
    } else if (state.tutorialStepId === "continue-day-labor-results") {
      if (!state.activeResultsScreen) {
        nextStep = "end-day";
      }
    } else if (state.tutorialStepId === "end-day") {
      const startDay = state.tutorialStartDay ?? state.game.day;
      if (state.game.day >= startDay + 1) {
        nextStep = "select-baba-g";
      }
    } else if (state.tutorialStepId === "select-baba-g") {
      if (isSelectedContractBaba(state.game, state.selectedContractId)) {
        nextStep = "accept-baba-g";
      }
    } else if (state.tutorialStepId === "accept-baba-g") {
      const babaAcceptedWithResults = Boolean(state.activeResultsScreen && state.lastAction?.title === "Contract Accepted");
      if (babaAcceptedWithResults) {
        nextStep = "continue-baba-accept-results";
      }
    } else if (state.tutorialStepId === "continue-baba-accept-results") {
      if (!state.activeResultsScreen) {
        nextStep = "complete-baba-task";
      }
    } else if (state.tutorialStepId === "complete-baba-task") {
      const babaTaskResultOpen = Boolean(state.activeResultsScreen && state.lastAction?.title === "Task Result");
      if (babaTaskResultOpen) {
        nextStep = "continue-baba-task-results";
      }
    } else if (state.tutorialStepId === "continue-baba-task-results") {
      if (!state.activeResultsScreen) {
        nextStep = "done";
      }
    }

    if (nextStep === state.tutorialStepId) {
      return;
    }
    set({ tutorialStepId: nextStep });
    persistUiPrefsFromState(get());
  },
  completeTutorial: () => {
    set({ tutorialCompleted: true, tutorialInProgress: false, tutorialStepId: "done" });
    persistUiPrefsFromState(get());
  },

  launchDayLaborMinigame: () => {
    const currentState = get();
    const current = currentState.game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(currentState)) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    if (currentState.dayLaborCelebrationActive) {
      set({ notice: "Celebration cooldown active. Day Labor resumes in a few seconds." });
      return;
    }
    if (current.workday.ticksSpent >= current.workday.availableTicks) {
      set({ notice: "No shift hours remain for day labor." });
      return;
    }
    set({
      activeDayLaborMinigame: {
        sessionId: Date.now(),
        launchedAtMs: Date.now(),
        config: { ...DEFAULT_DIG_MINIGAME_CONFIG }
      },
      gameplayMutationLocked: true,
      activeModal: null,
      activeSheet: null,
      notice: ""
    });
  },

  restartDayLaborMinigame: () => {
    const session = get().activeDayLaborMinigame;
    if (!session) {
      return;
    }
    set({
      activeDayLaborMinigame: {
        ...session,
        sessionId: session.sessionId + 1,
        launchedAtMs: Date.now()
      },
      gameplayMutationLocked: true,
      notice: ""
    });
  },

  submitDayLaborMinigameResult: (minigameResult) => {
    const currentState = get();
    const current = currentState.game;
    if (!current || !currentState.activeDayLaborMinigame) {
      return;
    }

    const result = resolveDayLaborMinigameResultFlow(current, bundle, minigameResult);
    const startedDayLaborCelebration = minigameResult.success && result.nextState !== current;
    const summaryLines = [result.notice ?? "Worked a day-labor shift."];
    const detailLines = [
      `Mini-game score ${Math.max(0, Math.round(minigameResult.score))}`,
      `Excavate ${Math.round(Math.max(0, Math.min(1, minigameResult.excavationAccuracy)) * 100)}%`,
      `Backfill ${Math.round(Math.max(0, Math.min(1, minigameResult.backfillAccuracy)) * 100)}%`,
      `Time ${(Math.max(0, minigameResult.timeUsedMs) / 1000).toFixed(1)}s`
    ];
    if (minigameResult.failureReason) {
      detailLines.push(`Failure: ${minigameResult.failureReason}`);
    }
    const nextActionSummary = toSummary("Day Laborer", summaryLines, result.digest);
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice,
      extraLines: detailLines
    });

    if (startedDayLaborCelebration) {
      clearDayLaborCelebrationTimer();
      dayLaborCelebrationTimer = setTimeout(() => {
        useUiStore.setState({ dayLaborCelebrationActive: false });
      }, DAY_LABOR_CELEBRATION_MS);
    }

    saveGame(result.nextState);
    set({
      game: result.nextState,
      activeDayLaborMinigame: null,
      activeTab: result.notice ? currentState.activeTab : "work",
      selectedContractId: getDefaultContractId(result.nextState),
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      dayLaborCelebrationActive: startedDayLaborCelebration ? true : currentState.dayLaborCelebrationActive,
      activeJobProfitRecap: null,
      activeTaskResultPopup: null,
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen),
      activeModal: null,
      activeSheet: null
    });
  },

  forfeitDayLaborMinigame: () => {
    get().submitDayLaborMinigameResult({
      success: false,
      score: 0,
      excavationAccuracy: 0,
      backfillAccuracy: 0,
      timeUsedMs: 0,
      failureReason: "Shift forfeited."
    });
  },

  acceptContract: (contractId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    if (contractId === DAY_LABOR_CONTRACT_ID && get().dayLaborCelebrationActive) {
      set({ notice: "Celebration cooldown active. Day Labor resumes in a few seconds." });
      return;
    }
    if (contractId === DAY_LABOR_CONTRACT_ID) {
      get().launchDayLaborMinigame();
      return;
    }
    const result = acceptContractFlow(current, bundle, contractId);
    const nextActionSummary =
      result.payload
        ? toSummary("Contract Accepted", [formatAcceptedContractLine(result.payload.jobId)], result.digest)
        : get().lastAction;
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary?.title ?? "Action Result",
      digest: nextActionSummary?.digest ?? result.digest,
      summaryLines: nextActionSummary?.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      activeTab: result.notice ? get().activeTab : "work",
      selectedContractId: getDefaultContractId(result.nextState),
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeJobProfitRecap: null,
      activeTaskResultPopup: null,
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen),
      activeModal: null,
      activeSheet: null
    });
  },

  setCartQuantity: (supplyId, quality, quantity) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = setSupplierCartQuantityFlow(current, supplyId, quality, quantity);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      notice: result.notice ?? ""
    });
  },

  performTaskUnit: (stance, allowOvertime = false) => {
    const currentState = get();
    const current = currentState.game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(currentState)) {
      set({ notice: getGameplayLockNotice() });
      return;
    }

    const activeTask = getCurrentTask(current);
    if (!activeTask) {
      set({ notice: "There is no task to advance." });
      return;
    }

    const availableActions = getVisibleTaskActions(current, bundle);
    const selectedAction = availableActions.find((action) => action.stance === stance && Boolean(action.allowOvertime) === allowOvertime);
    if (!selectedAction) {
      set({ notice: "This action is not available right now." });
      return;
    }

    const activeJobDef = current.activeJob
      ? bundle.jobs.find((entry) => entry.id === current.activeJob?.jobId) ?? bundle.babaJobs.find((entry) => entry.id === current.activeJob?.jobId) ?? null
      : null;
    const skillRank = activeJobDef ? getSkillRank(current.player, getTaskSkillMapping(activeJobDef, activeTask.taskId).primary) : 1;
    const startedAtMs = Date.now();
    const durationMs = getActionDurationMs(stance, allowOvertime, skillRank);
    const timedTaskAction: TimedTaskActionState = {
      id: `${current.day}:${activeTask.taskId}:${stance}:${allowOvertime ? "ot" : "std"}:${startedAtMs}`,
      stance,
      allowOvertime,
      label: formatTimedActionLabel(current, activeTask.taskId),
      taskId: activeTask.taskId,
      startedAtMs,
      durationMs,
      endsAtMs: startedAtMs + durationMs
    };

    clearTimedTaskActionTimer();
    set({
      timedTaskAction,
      gameplayMutationLocked: true,
      notice: "",
      activeSheet: null,
      activeEncounterPopup: null,
      activeTaskResultPopup: null,
      activeResultsScreen: null
    });

    timedTaskActionTimer = setTimeout(() => {
      timedTaskActionTimer = null;
      const latest = get();
      const pending = latest.timedTaskAction;
      if (!pending || pending.id !== timedTaskAction.id) {
        return;
      }

      const latestGame = latest.game;
      if (!latestGame) {
        set({
          timedTaskAction: null,
          gameplayMutationLocked: false
        });
        return;
      }

      const latestTask = getCurrentTask(latestGame);
      const actionStillAvailable = getVisibleTaskActions(latestGame, bundle).some(
        (action) => action.stance === pending.stance && Boolean(action.allowOvertime) === pending.allowOvertime
      );
      if (!latestTask || !actionStillAvailable) {
        set({
          timedTaskAction: null,
          gameplayMutationLocked: false,
          notice: "Action canceled because task state changed."
        });
        return;
      }

      const result = performTaskUnitFlow(latestGame, bundle, pending.stance, pending.allowOvertime);
      const progressUpdates = buildProgressPopups(latestGame, result.nextState, result.payload);
      const taskResultSummary = result.payload ? toSummary("Task Result", buildTaskResultLines(result.payload), result.payload.digest) : null;
      const hasEncounter = Boolean(result.payload?.encounter);
      const encounterPopup = result.payload?.encounter ? createEncounterPopupState(result.payload.encounter, result.digest) : null;
      const resultsScreen = taskResultSummary
        ? buildActionResults(latestGame, result.nextState, {
            title: taskResultSummary.title,
            digest: taskResultSummary.digest,
            summaryLines: taskResultSummary.lines,
            notice: result.notice,
            blocksGameplay: !hasEncounter
          })
        : null;
      const shouldShowCompletionFx =
        latest.uiFxMode !== "reduced" &&
        Boolean(result.payload && result.payload.taskId === "collect_payment" && result.nextState.activeJob?.contractId !== DAY_LABOR_CONTRACT_ID);
      const recap =
        result.payload && result.payload.taskId === "collect_payment" && result.nextState.activeJob?.contractId
          ? getJobProfitRecap(result.nextState, result.nextState.activeJob.contractId)
          : null;
      const completionFxState: JobCompletionFxState | null =
        shouldShowCompletionFx && result.nextState.activeJob?.outcome
          ? {
              startedAtMs: Date.now(),
              durationMs: JOB_COMPLETION_FX_MS,
              outcome: result.nextState.activeJob.outcome === "fail" ? "fail" : result.nextState.activeJob.outcome === "neutral" ? "neutral" : "success",
              net: recap?.actual.net ?? 0
            }
          : null;
      if (completionFxState) {
        clearJobCompletionFxTimer();
        jobCompletionFxTimer = setTimeout(() => {
          jobCompletionFxTimer = null;
          useUiStore.setState((state) => ({
            jobCompletionFx: null,
            gameplayMutationLocked: Boolean(
              state.timedTaskAction || doesResultsScreenBlockGameplay(state.activeResultsScreen) || state.activeDayLaborMinigame
            )
          }));
        }, completionFxState.durationMs);
      }
      saveGame(result.nextState);
      set({
        game: result.nextState,
        lastAction: taskResultSummary ?? latest.lastAction,
        notice: result.notice ?? "",
        activeSheet: null,
        selectedContractId: getDefaultContractId(result.nextState),
        timedTaskAction: null,
        activeJobProfitRecap: recap,
        activeEncounterPopup: encounterPopup,
        activeTaskResultPopup: null,
        activeResultsScreen: resultsScreen,
        jobCompletionFx: completionFxState ?? latest.jobCompletionFx,
        gameplayMutationLocked: Boolean(resultsScreen?.blocksGameplay),
        ...enqueueProgressPopups(latest, progressUpdates)
      });
    }, durationMs);
  },

  returnToShopForTools: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = returnToShopForToolsFlow(current, bundle);
    const nextActionSummary = result.payload
      ? toSummary(
          "Route Update",
          [
            `Returned to shop for tools (${formatHours(result.payload.ticksSpent)}, fuel -${result.payload.fuelSpent}).`,
            result.payload.usedOvertime ? "Overtime was used for the return trip." : "Used regular shift time for the return trip."
          ],
          result.digest
        )
      : get().lastAction;
    const resultsScreen = nextActionSummary
      ? buildActionResults(current, result.nextState, {
          title: nextActionSummary.title,
          digest: nextActionSummary.digest,
          summaryLines: nextActionSummary.lines,
          notice: result.notice
        })
      : null;
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  endShift: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = endShift(current, bundle);
    const nextActionSummary = toSummary(
      "Day Ended",
      result.dayLog.length > 0 ? result.dayLog.map((entry) => entry.message) : [`Advanced to ${result.nextState.workday.weekday}.`],
      result.digest
    );
    const fatigueNotice =
      result.nextState.workday.fatigue.debt > 0 && result.nextState.workday.availableTicks < BASE_DAY_TICKS
        ? `Fatigue is cutting this shift to ${(result.nextState.workday.availableTicks * 0.5).toFixed(1)} hours after heavy overtime. Fatigue debt only shortens how long you can work.`
        : "";
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: fatigueNotice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: fatigueNotice,
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(result.nextState),
      activeJobProfitRecap: null,
      activeTaskResultPopup: null,
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  buyFuel: (units = 1) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = buyFuelFlow(current, units);
    const nextActionSummary = toSummary("Fuel", [`Fuel now at ${result.nextState.player.fuel}/${result.nextState.player.fuelMax}.`], result.digest);
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  runManualGasStation: (mode = "single") => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const planBefore = getManualGasStationPlan(current, mode);
    const result = runManualGasStationFlow(current, mode);
    const nextActionSummary =
      result.payload ?? planBefore
        ? toSummary(
            "Travel To Gas Station",
            [
              `Fuel now at ${result.nextState.player.fuel}/${result.nextState.player.fuelMax}.`,
              `Cash now at $${result.nextState.player.cash}.`
            ],
            result.digest
          )
        : get().lastAction;
    const resultsScreen = nextActionSummary
      ? buildActionResults(current, result.nextState, {
          title: nextActionSummary.title,
          digest: nextActionSummary.digest,
          summaryLines: nextActionSummary.lines,
          notice: result.notice
        })
      : null;
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  runOutOfGasRescue: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const planBefore = getOutOfGasRescuePlan(current, bundle);
    const result = runOutOfGasRescueFlow(current, bundle);
    const nextActionSummary =
      result.payload ?? planBefore
        ? toSummary(
            "Out-Of-Gas Rescue",
            [
              `Fuel now at ${result.nextState.player.fuel}/${result.nextState.player.fuelMax}.`,
              `Cash now at $${result.nextState.player.cash}.`
            ],
            result.digest
          )
        : get().lastAction;
    const resultsScreen = nextActionSummary
      ? buildActionResults(current, result.nextState, {
          title: nextActionSummary.title,
          digest: nextActionSummary.digest,
          summaryLines: nextActionSummary.lines,
          notice: result.notice
        })
      : null;
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  buyTool: (toolId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }

    const nextState = buyTool(current, bundle, toolId);
    awardOfficeSkillXp(nextState, { reading: 1 });
    const summaryDigest = `${nextState.day}:buy-tool:${toolId}:${nextState.player.cash}:${nextState.player.tools[toolId]?.durability ?? 0}`;
    const nextActionSummary = toSummary("Tool Purchase", [`Checked the tool rack for ${toolId}.`], summaryDigest);
    const resultsScreen = buildActionResults(current, nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines
    });
    saveGame(nextState);
    set({
      game: nextState,
      lastAction: nextActionSummary,
      notice: "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  repairTool: (toolId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }

    const nextState = repairTool(current, bundle, toolId);
    awardOfficeSkillXp(nextState, { reading: 1 });
    const summaryDigest = `${nextState.day}:repair-tool:${toolId}:${nextState.player.cash}:${nextState.player.tools[toolId]?.durability ?? 0}`;
    const nextActionSummary = toSummary("Tool Repair", [`Ran a repair cycle for ${toolId}.`], summaryDigest);
    const resultsScreen = buildActionResults(current, nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines
    });
    saveGame(nextState);
    set({
      game: nextState,
      lastAction: nextActionSummary,
      notice: "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  quickBuyTools: (contractId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = quickBuyMissingToolsFlow(current, bundle, contractId);
    const nextActionSummary = result.payload
      ? toSummary(
          "Quick Buy",
          [`Tools bought: ${result.payload.missingTools.map((line) => line.toolName).join(", ")}`, `Time ${formatHours(result.payload.requiredTicks)}`],
          result.digest
        )
      : get().lastAction;
    const resultsScreen = nextActionSummary
      ? buildActionResults(current, result.nextState, {
          title: nextActionSummary.title,
          digest: nextActionSummary.digest,
          summaryLines: nextActionSummary.lines,
          notice: result.notice
        })
      : null;
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  hireCrew: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = hireCrewFlow(current);
    const nextActionSummary = result.payload ? toSummary("Crew Hire", [`${result.payload.name} is now on the roster.`], result.digest) : get().lastAction;
    const resultsScreen = nextActionSummary
      ? buildActionResults(current, result.nextState, {
          title: nextActionSummary.title,
          digest: nextActionSummary.digest,
          summaryLines: nextActionSummary.lines,
          notice: result.notice
        })
      : null;
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  setJobAssignee: (assignee) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = setActiveJobAssigneeFlow(current, assignee);
    const assigneeLabel = assignee === "self" ? current.player.name : assignee;
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Assignment Updated", [`Assigned active job to ${assigneeLabel}.`], result.digest) : get().lastAction,
      "Assignment Updated",
      [`Assigned active job to ${assigneeLabel}.`],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  runRecoveryAction: (action) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = runRecoveryActionFlow(current, bundle, action);
    const actionLabel =
      action === "finish_cheap" ? "Finish Cheap" : action === "defer" ? "Deferred Job" : action === "abandon" ? "Abandoned Job" : "Recovery Action";
    const summaryLine =
      action === "finish_cheap"
        ? "Switched the contract to cheap-finish mode."
        : action === "defer"
          ? "Deferred the active job for later."
          : "Abandoned the active job.";
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary(actionLabel, [summaryLine], result.digest) : get().lastAction,
      actionLabel,
      [summaryLine],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      selectedContractId: getDefaultContractId(result.nextState),
      activeTab: result.nextState.activeJob ? "work" : get().activeTab,
      activeJobProfitRecap: action === "abandon" || action === "defer" ? null : get().activeJobProfitRecap,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  resumeDeferredJob: (deferredJobId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = resumeDeferredJobFlow(current, deferredJobId);
    const resumedJobId = result.payload?.jobId ?? deferredJobId;
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Deferred Job Resumed", [`Resumed deferred contract ${resumedJobId}.`], result.digest) : get().lastAction,
      "Deferred Job Resumed",
      [`Resumed deferred contract ${resumedJobId}.`],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      activeTab: result.notice ? get().activeTab : "work",
      selectedContractId: getDefaultContractId(result.nextState),
      notice: result.notice ?? "",
      activeJobProfitRecap: null,
      lastAction: nextActionSummary,
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  startResearch: (projectId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = startResearchFlow(current, projectId);
    const projectLabel = result.payload?.label ?? projectId;
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Research Started", [`Started research: ${projectLabel}.`], result.digest) : get().lastAction,
      "Research Started",
      [`Started research: ${projectLabel}.`],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  spendPerkPoint: (perkId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = spendPerkPointFlow(current, perkId);
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Perk Purchased", [`Spent a perk point on ${perkId}.`], result.digest) : get().lastAction,
      "Perk Purchased",
      [`Spent a perk point on ${perkId}.`],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  upgradeBusinessTier: (target) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = upgradeBusinessTierFlow(current, target);
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Business Tier", [`Business tier request: ${target}.`], result.digest) : get().lastAction,
      "Business Tier",
      [`Business tier request: ${target}.`],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  openStorage: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = openStorageFlow(current, bundle);
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Storage", ["Attempted to open storage."], result.digest) : get().lastAction,
      "Storage",
      ["Attempted to open storage."],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  enableDumpsterService: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = enableDumpsterServiceFlow(current);
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Dumpster Service", ["Toggled dumpster service state."], result.digest) : get().lastAction,
      "Dumpster Service",
      ["Toggled dumpster service state."],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  closeOfficeManually: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = closeOfficeManuallyFlow(current);
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Office Closed", ["Closed office lease manually."], result.digest) : get().lastAction,
      "Office Closed",
      ["Closed office lease manually."],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  closeYardManually: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = closeYardManuallyFlow(current);
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Yard Closed", ["Closed yard lease manually."], result.digest) : get().lastAction,
      "Yard Closed",
      ["Closed yard lease manually."],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  },

  hireAccountant: () => {
    set({ notice: "Hiring accountant is currently disabled." });
  },

  emptyDumpster: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = emptyDumpsterAtYardFlow(current);
    const nextActionSummary = ensureSummary(
      result.nextState !== current ? toSummary("Dumpster Emptied", ["Processed yard dumpster emptying."], result.digest) : get().lastAction,
      "Dumpster Emptied",
      ["Processed yard dumpster emptying."],
      result.digest
    );
    const resultsScreen = buildActionResults(current, result.nextState, {
      title: nextActionSummary.title,
      digest: nextActionSummary.digest,
      summaryLines: nextActionSummary.lines,
      notice: result.notice
    });
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: nextActionSummary,
      notice: result.notice ?? "",
      activeResultsScreen: resultsScreen,
      gameplayMutationLocked: Boolean(resultsScreen)
    });
  }
}));

function createEncounterPopupState(encounter: EncounterPayload, digest: string): EncounterPopupState {
  return {
    id: `${digest}:${encounter.id}`,
    speaker: encounter.speaker,
    line: encounter.line,
    startedAtMs: Date.now(),
    durationMs: 0
  };
}

export { bundle };


