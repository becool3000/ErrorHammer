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
  getGasStationStopPlan,
  getOperatorLevel,
  getSkillRank,
  getTaskSkillMapping,
  getVisibleTaskActions,
  quickBuyMissingTools as quickBuyMissingToolsFlow,
  formatHours,
  ticksToHours,
  performTaskUnit as performTaskUnitFlow,
  returnToShopForTools as returnToShopForToolsFlow,
  runGasStationStop as runGasStationStopFlow,
  setSupplierCartQuantity as setSupplierCartQuantityFlow,
  startResearch as startResearchFlow,
  spendPerkPoint as spendPerkPointFlow,
  acceptContract as acceptContractFlow,
  upgradeBusinessTier as upgradeBusinessTierFlow,
  hireAccountantStaff as hireAccountantStaffFlow,
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
  GameState,
  JobProfitRecap,
  RecoveryActionId,
  SkillId,
  SupplyQuality,
  TaskId,
  TaskStance,
  TaskUnitResult
} from "../core/types";

export type ScreenId = "title" | "game";
export type GameTabId = "work" | "office" | "contracts" | "store" | "company";
export type OfficeSectionId =
  | "contracts"
  | "store"
  | "company"
  | "facilities"
  | "trade-index"
  | "accounting"
  | "research"
  | "yard";
export type WorkPanelId = "task" | "job-details" | "supplies" | "inventory" | "field-log";
export type StoreSectionId = "tools" | "stock";
export type ActiveModalId =
  | null
  | "job-details"
  | "inventory"
  | "skills"
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

export interface ActionSummary {
  title: string;
  lines: string[];
  digest: string;
}

export interface SessionTelemetry {
  startedAtMs: number;
  startDay: number;
  startReputation: number;
  interactions: number;
  endDayPresses: number;
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

function isUiTextScale(value: unknown): value is UiTextScale {
  return value === "xsmall" || value === "default" || value === "large" || value === "xlarge";
}

function isUiColorMode(value: unknown): value is UiColorMode {
  return value === "classic" || value === "neon";
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
}

function loadUiPreferences(): UiPrefsPayload {
  if (typeof localStorage === "undefined") {
    return { uiTextScale: "default", uiColorMode: "neon", contractFilters: [], uiFxMode: "full" };
  }
  const raw = localStorage.getItem(UI_PREFS_KEY);
  if (!raw) {
    return { uiTextScale: "default", uiColorMode: "neon", contractFilters: [], uiFxMode: "full" };
  }
  try {
    const parsed = JSON.parse(raw) as { uiTextScale?: unknown; uiColorMode?: unknown; contractFilters?: unknown; uiFxMode?: unknown };
    return {
      uiTextScale: isUiTextScale(parsed.uiTextScale) ? parsed.uiTextScale : "default",
      uiColorMode: isUiColorMode(parsed.uiColorMode) ? parsed.uiColorMode : "neon",
      contractFilters: normalizeContractFilters(parsed.contractFilters),
      uiFxMode: parsed.uiFxMode === "reduced" ? "reduced" : "full"
    };
  } catch {
    return { uiTextScale: "default", uiColorMode: "neon", contractFilters: [], uiFxMode: "full" };
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
  officeSection: OfficeSectionId;
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
  gameplayMutationLocked: boolean;
  uiTextScale: UiTextScale;
  uiColorMode: UiColorMode;
  uiFxMode: UiFxMode;
  contractFilters: ContractFilterId[];
  dayLaborCelebrationActive: boolean;
  activeJobProfitRecap: JobProfitRecap | null;
  sessionTelemetry: SessionTelemetry;
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
  dismissTaskResultPopup: () => void;
  dismissEncounterPopup: () => void;
  setTitlePlayerName: (name: string) => void;
  setTitleCompanyName: (name: string) => void;
  newGame: (playerName?: string, companyName?: string, seed?: number) => void;
  continueGame: () => void;
  returnToTitle: () => void;
  goToTab: (tab: GameTabId) => void;
  setOfficeSection: (section: OfficeSectionId) => void;
  openModal: (modal: Exclude<ActiveModalId, null>) => void;
  closeModal: () => void;
  openSheet: (sheet: Exclude<ActiveSheetId, null>) => void;
  closeSheet: () => void;
  setStoreSection: (section: StoreSectionId) => void;
  selectContract: (contractId: string | null) => void;
  clearNotice: () => void;
  dismissProgressPopup: () => void;
  acceptContract: (contractId: string) => void;
  setCartQuantity: (supplyId: string, quality: SupplyQuality, quantity: number) => void;
  performTaskUnit: (stance: TaskStance, allowOvertime?: boolean) => void;
  returnToShopForTools: () => void;
  endShift: () => void;
  buyFuel: (units?: number) => void;
  runGasStationStop: () => void;
  buyTool: (toolId: string) => void;
  repairTool: (toolId: string) => void;
  quickBuyTools: (contractId: string) => void;
  hireCrew: () => void;
  setJobAssignee: (assignee: "self" | string) => void;
  runRecoveryAction: (action: RecoveryActionId) => void;
  resumeDeferredJob: (deferredJobId: string) => void;
  startResearch: (projectId: string) => void;
  spendPerkPoint: (perkId: CorePerkId) => void;
  upgradeBusinessTier: (target: BusinessTier) => void;
  enableDumpsterService: () => void;
  closeOfficeManually: () => void;
  closeYardManually: () => void;
  hireAccountant: () => void;
  emptyDumpster: () => void;
}

const bundle = loadContentBundle();

function toSummary(title: string, lines: string[], digest: string): ActionSummary {
  return {
    title,
    lines,
    digest
  };
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

function createSessionTelemetry(game: GameState | null): SessionTelemetry {
  return {
    startedAtMs: Date.now(),
    startDay: game?.day ?? 1,
    startReputation: game?.player.reputation ?? 0,
    interactions: 0,
    endDayPresses: 0
  };
}

function bumpSessionTelemetry(current: SessionTelemetry, isEndDay = false): SessionTelemetry {
  return {
    ...current,
    interactions: current.interactions + 1,
    endDayPresses: current.endDayPresses + (isEndDay ? 1 : 0)
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

function isGameplayMutationBlocked(state: Pick<UiState, "timedTaskAction" | "jobCompletionFx">): boolean {
  return Boolean(state.timedTaskAction || state.jobCompletionFx);
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
  return "Action in progress. Wait for the timer to finish.";
}

export const useUiStore = create<UiState>((set, get) => ({
  screen: "title",
  activeTab: "work",
  officeSection: "contracts",
  storeSection: "tools",
  activeModal: null,
  activeSheet: null,
  selectedContractId: null,
  game: null,
  lastAction: null,
  notice: "",
  timedTaskAction: null,
  jobCompletionFx: null,
  activeEncounterPopup: null,
  activeTaskResultPopup: null,
  gameplayMutationLocked: false,
  uiTextScale: loadUiPreferences().uiTextScale,
  uiColorMode: loadUiPreferences().uiColorMode,
  uiFxMode: loadUiPreferences().uiFxMode,
  contractFilters: loadUiPreferences().contractFilters,
  dayLaborCelebrationActive: false,
  activeJobProfitRecap: null,
  sessionTelemetry: createSessionTelemetry(null),
  activeProgressPopup: null,
  progressQueue: [],
  titlePlayerName: "",
  titleCompanyName: "",
  hydrateUiPrefs: () => {
    const prefs = loadUiPreferences();
    set({ uiTextScale: prefs.uiTextScale, uiColorMode: prefs.uiColorMode, uiFxMode: prefs.uiFxMode, contractFilters: prefs.contractFilters });
  },
  setUiTextScale: (scale) => {
    const current = get();
    saveUiPreferences({
      uiTextScale: scale,
      uiColorMode: current.uiColorMode,
      contractFilters: current.contractFilters,
      uiFxMode: current.uiFxMode
    });
    set({ uiTextScale: scale });
  },
  setUiColorMode: (mode) => {
    const current = get();
    saveUiPreferences({
      uiTextScale: current.uiTextScale,
      uiColorMode: mode,
      contractFilters: current.contractFilters,
      uiFxMode: current.uiFxMode
    });
    set({ uiColorMode: mode });
  },
  setUiFxMode: (mode) => {
    const current = get();
    saveUiPreferences({
      uiTextScale: current.uiTextScale,
      uiColorMode: current.uiColorMode,
      contractFilters: current.contractFilters,
      uiFxMode: mode
    });
    set({ uiFxMode: mode });
  },
  setContractFilter: (filterId, enabled) => {
    const current = get();
    const nextFilters = enabled ? [...new Set([...current.contractFilters, filterId])] : current.contractFilters.filter((entry) => entry !== filterId);
    saveUiPreferences({
      uiTextScale: current.uiTextScale,
      uiColorMode: current.uiColorMode,
      contractFilters: nextFilters,
      uiFxMode: current.uiFxMode
    });
    set({ contractFilters: nextFilters });
  },
  clearContractFilters: () => {
    const current = get();
    saveUiPreferences({
      uiTextScale: current.uiTextScale,
      uiColorMode: current.uiColorMode,
      contractFilters: [],
      uiFxMode: current.uiFxMode
    });
    set({ contractFilters: [] });
  },
  dismissJobProfitRecap: () => {
    set({ activeJobProfitRecap: null });
  },
  dismissJobCompletionFx: () => {
    set((state) => ({
      jobCompletionFx: null,
      gameplayMutationLocked: Boolean(state.timedTaskAction)
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
      officeSection: "contracts",
      storeSection: "tools",
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(game),
      game,
      lastAction: null,
      notice: "",
      timedTaskAction: null,
      jobCompletionFx: null,
      activeEncounterPopup: null,
      activeTaskResultPopup: null,
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
      activeJobProfitRecap: null,
      sessionTelemetry: createSessionTelemetry(game),
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
      officeSection: "contracts",
      storeSection: "tools",
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(loaded),
      game: loaded,
      notice: "",
      timedTaskAction: null,
      jobCompletionFx: null,
      activeEncounterPopup: null,
      activeTaskResultPopup: null,
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
      activeJobProfitRecap: null,
      sessionTelemetry: createSessionTelemetry(loaded),
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
      notice: "",
      timedTaskAction: null,
      jobCompletionFx: null,
      activeEncounterPopup: null,
      activeTaskResultPopup: null,
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
      activeJobProfitRecap: null,
      sessionTelemetry: createSessionTelemetry(null),
      activeProgressPopup: null,
      progressQueue: []
    })),

  goToTab: (tab) =>
    set(() => {
      if (tab === "contracts" || tab === "store" || tab === "company") {
        return { activeTab: "office", officeSection: tab, activeModal: null, activeSheet: null };
      }
      if (tab === "office") {
        return { activeTab: "office", activeModal: null, activeSheet: null };
      }
      return { activeTab: tab, activeModal: null, activeSheet: null };
    }),
  setOfficeSection: (section) =>
    set((state) => {
      if (section !== "accounting" || !state.game) {
        return { officeSection: section };
      }
      const nextGame: GameState = {
        ...state.game,
        player: { ...state.game.player, skills: { ...state.game.player.skills }, tools: { ...state.game.player.tools }, crews: [...state.game.player.crews] },
        bots: [...state.game.bots],
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
        officeSection: section,
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
    const result = acceptContractFlow(current, bundle, contractId);
    const startedDayLaborCelebration = contractId === DAY_LABOR_CONTRACT_ID && result.nextState !== current;
    if (startedDayLaborCelebration) {
      clearDayLaborCelebrationTimer();
      dayLaborCelebrationTimer = setTimeout(() => {
        useUiStore.setState({ dayLaborCelebrationActive: false });
      }, DAY_LABOR_CELEBRATION_MS);
    }
    saveGame(result.nextState);
    set({
      game: result.nextState,
      activeTab: result.notice ? get().activeTab : "work",
      selectedContractId: getDefaultContractId(result.nextState),
      lastAction:
        contractId === DAY_LABOR_CONTRACT_ID
          ? toSummary("Day Laborer", [result.notice ?? "Worked a day-labor shift."], result.digest)
          : result.payload
            ? toSummary("Contract Accepted", [`Accepted ${result.payload.jobId} for the field loop.`], result.digest)
            : get().lastAction,
      notice: result.notice ?? "",
      dayLaborCelebrationActive: startedDayLaborCelebration ? true : get().dayLaborCelebrationActive,
      activeJobProfitRecap: null,
      activeTaskResultPopup: null,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
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
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
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
      activeTaskResultPopup: null
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
      let encounterPopup: EncounterPopupState | null = latest.activeEncounterPopup;
      if (result.payload?.encounter) {
        clearEncounterPopupTimer();
        encounterPopup = createEncounterPopupState(result.payload.encounter, result.payload.digest);
      }
      const shouldShowCompletionFx =
        latest.uiFxMode !== "reduced" &&
        Boolean(result.payload && result.payload.taskId === "collect_payment" && result.nextState.activeJob?.contractId !== DAY_LABOR_CONTRACT_ID);
      const recap =
        result.payload && result.payload.taskId === "collect_payment" && result.nextState.activeJob?.contractId
          ? getJobProfitRecap(result.nextState, result.nextState.activeJob.contractId)
          : null;
      if (shouldShowCompletionFx && result.nextState.activeJob?.outcome) {
        clearJobCompletionFxTimer();
      }
      saveGame(result.nextState);
      set({
        game: result.nextState,
        lastAction: taskResultSummary ?? latest.lastAction,
        notice: result.notice ?? "",
        sessionTelemetry: bumpSessionTelemetry(latest.sessionTelemetry),
        activeSheet: null,
        selectedContractId: getDefaultContractId(result.nextState),
        timedTaskAction: null,
        activeJobProfitRecap: recap,
        activeEncounterPopup: encounterPopup,
        activeTaskResultPopup: taskResultSummary ?? latest.activeTaskResultPopup,
        jobCompletionFx:
          shouldShowCompletionFx && result.nextState.activeJob?.outcome
            ? {
                startedAtMs: Date.now(),
                durationMs: JOB_COMPLETION_FX_MS,
                outcome: result.nextState.activeJob.outcome === "fail" ? "fail" : result.nextState.activeJob.outcome === "neutral" ? "neutral" : "success",
                net: recap?.actual.net ?? 0
              }
            : latest.jobCompletionFx,
        gameplayMutationLocked: shouldShowCompletionFx ? true : false,
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: result.payload
        ? toSummary(
            "Route Update",
            [
              `Returned to shop for tools (${formatHours(result.payload.ticksSpent)}, fuel -${result.payload.fuelSpent}).`,
              result.payload.usedOvertime ? "Overtime was used for the return trip." : "Used regular shift time for the return trip."
            ],
            result.digest
          )
        : get().lastAction,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: toSummary(
        "Shift Ended",
        result.dayLog.length > 0 ? result.dayLog.map((entry) => entry.message) : [`Advanced to ${result.nextState.workday.weekday}.`],
        result.digest
      ),
      notice:
        result.nextState.workday.fatigue.debt > 0 && result.nextState.workday.availableTicks < BASE_DAY_TICKS
          ? `Fatigue is cutting this shift to ${(result.nextState.workday.availableTicks * 0.5).toFixed(1)} hours after heavy overtime. Fatigue debt only shortens how long you can work.`
          : "",
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry, true),
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(result.nextState),
      activeJobProfitRecap: null,
      activeTaskResultPopup: null
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: toSummary("Fuel", [`Fuel now at ${result.nextState.player.fuel}/${result.nextState.player.fuelMax}.`], result.digest),
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
    });
  },

  runGasStationStop: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const planBefore = getGasStationStopPlan(current, bundle);
    const result = runGasStationStopFlow(current, bundle);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction:
        result.payload ?? planBefore
          ? toSummary(
              "Gas Station Run",
              [
                `Fuel now at ${result.nextState.player.fuel}/${result.nextState.player.fuelMax}.`,
                `Cash now at $${result.nextState.player.cash}.`
              ],
              result.digest
            )
          : get().lastAction,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(nextState);
    set({
      game: nextState,
      lastAction: toSummary("Tool Purchase", [`Checked the tool rack for ${toolId}.`], JSON.stringify(nextState.day)),
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: ""
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
    saveGame(nextState);
    set({
      game: nextState,
      lastAction: toSummary("Tool Repair", [`Ran a repair cycle for ${toolId}.`], JSON.stringify(nextState.day)),
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: result.payload
        ? toSummary(
            "Quick Buy",
            [
              `Tools bought: ${result.payload.missingTools.map((line) => line.toolName).join(", ")}`,
              `Time ${formatHours(result.payload.requiredTicks)}`
            ],
            result.digest
          )
        : get().lastAction,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: result.payload ? toSummary("Crew Hire", [`${result.payload.name} is now on the roster.`], result.digest) : get().lastAction,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      selectedContractId: getDefaultContractId(result.nextState),
      activeTab: result.nextState.activeJob ? "work" : get().activeTab,
      activeJobProfitRecap: action === "abandon" || action === "defer" ? null : get().activeJobProfitRecap,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      activeTab: result.notice ? get().activeTab : "work",
      selectedContractId: getDefaultContractId(result.nextState),
      notice: result.notice ?? "",
      activeJobProfitRecap: null,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry)
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
    });
  },

  hireAccountant: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (isGameplayMutationBlocked(get())) {
      set({ notice: getGameplayLockNotice() });
      return;
    }
    const result = hireAccountantStaffFlow(current);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
    });
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
    saveGame(result.nextState);
    set({
      game: result.nextState,
      sessionTelemetry: bumpSessionTelemetry(get().sessionTelemetry),
      notice: result.notice ?? ""
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


