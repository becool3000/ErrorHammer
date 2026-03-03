import { create } from "zustand";
import { getActionDurationMs } from "../core/actionTiming";
import { loadContentBundle } from "../core/content";
import {
  BASE_DAY_TICKS,
  buyFuel as buyFuelFlow,
  DAY_LABOR_CONTRACT_ID,
  emptyDumpsterAtYard as emptyDumpsterAtYardFlow,
  formatSkillLabel,
  getLevelForXp,
  getAvailableContractOffers,
  getCurrentTask,
  getGasStationStopPlan,
  getOperatorLevel,
  getVisibleTaskActions,
  quickBuyMissingTools as quickBuyMissingToolsFlow,
  formatHours,
  performTaskUnit as performTaskUnitFlow,
  returnToShopForTools as returnToShopForToolsFlow,
  runGasStationStop as runGasStationStopFlow,
  setSupplierCartQuantity as setSupplierCartQuantityFlow,
  startResearch as startResearchFlow,
  acceptContract as acceptContractFlow,
  hireAccountantStaff as hireAccountantStaffFlow,
  hireCrew as hireCrewFlow,
  setActiveJobAssignee as setActiveJobAssigneeFlow
} from "../core/playerFlow";
import { awardOfficeSkillXp } from "../core/operations";
import { hasIncompatibleLegacySave, load as loadGame, save as saveGame } from "../core/save";
import { buyTool, createInitialGameState, endShift, repairTool } from "../core/resolver";
import { GameState, SkillId, SupplyQuality, TaskId, TaskStance, TaskUnitResult } from "../core/types";

export type ScreenId = "title" | "game";
export type GameTabId = "work" | "office" | "contracts" | "store" | "company";
export type OfficeSectionId = "contracts" | "store" | "company" | "trade-index" | "accounting" | "research" | "yard";
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
const DAY_LABOR_CELEBRATION_MS = 5_000;
let dayLaborCelebrationTimer: ReturnType<typeof setTimeout> | null = null;
let timedTaskActionTimer: ReturnType<typeof setTimeout> | null = null;

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

const UI_PREFS_KEY = "error-hammer-ui-prefs-v1";

function isUiTextScale(value: unknown): value is UiTextScale {
  return value === "xsmall" || value === "default" || value === "large" || value === "xlarge";
}

function isUiColorMode(value: unknown): value is UiColorMode {
  return value === "classic" || value === "neon";
}

interface UiPrefsPayload {
  uiTextScale: UiTextScale;
  uiColorMode: UiColorMode;
}

function loadUiPreferences(): UiPrefsPayload {
  if (typeof localStorage === "undefined") {
    return { uiTextScale: "default", uiColorMode: "neon" };
  }
  const raw = localStorage.getItem(UI_PREFS_KEY);
  if (!raw) {
    return { uiTextScale: "default", uiColorMode: "neon" };
  }
  try {
    const parsed = JSON.parse(raw) as { uiTextScale?: unknown; uiColorMode?: unknown };
    return {
      uiTextScale: isUiTextScale(parsed.uiTextScale) ? parsed.uiTextScale : "default",
      uiColorMode: isUiColorMode(parsed.uiColorMode) ? parsed.uiColorMode : "neon"
    };
  } catch {
    return { uiTextScale: "default", uiColorMode: "neon" };
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
  gameplayMutationLocked: boolean;
  uiTextScale: UiTextScale;
  uiColorMode: UiColorMode;
  dayLaborCelebrationActive: boolean;
  sessionTelemetry: SessionTelemetry;
  activeProgressPopup: ProgressPopup | null;
  progressQueue: ProgressPopup[];
  titlePlayerName: string;
  titleCompanyName: string;
  hydrateUiPrefs: () => void;
  setUiTextScale: (scale: UiTextScale) => void;
  setUiColorMode: (mode: UiColorMode) => void;
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
  startResearch: (projectId: string) => void;
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
  const xpEntries = Object.entries(payload.skillXpDelta)
    .filter(([, delta]) => (delta ?? 0) > 0)
    .sort(([left], [right]) => left.localeCompare(right)) as Array<[SkillId, number]>;
  if (xpEntries.length === 0) {
    return payload.logLines;
  }
  const xpLine = `XP Earned: ${xpEntries.map(([skillId, delta]) => `${formatSkillLabel(skillId)} +${delta}`).join(" | ")}`;
  return [...payload.logLines, xpLine];
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

function formatTimedActionLabel(taskId: TaskId, stance: TaskStance, allowOvertime: boolean): string {
  const baseLabel = taskId === "refuel_at_station" ? labelForRefuelAction(stance) : labelForStance(stance);
  return allowOvertime ? `${baseLabel} + OT` : baseLabel;
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
    return "Buy 1 Fuel";
  }
  if (stance === "careful") {
    return "Fill Tank";
  }
  return "Recommended Fill";
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
  gameplayMutationLocked: false,
  uiTextScale: loadUiPreferences().uiTextScale,
  uiColorMode: loadUiPreferences().uiColorMode,
  dayLaborCelebrationActive: false,
  sessionTelemetry: createSessionTelemetry(null),
  activeProgressPopup: null,
  progressQueue: [],
  titlePlayerName: "",
  titleCompanyName: "",
  hydrateUiPrefs: () => {
    const prefs = loadUiPreferences();
    set({ uiTextScale: prefs.uiTextScale, uiColorMode: prefs.uiColorMode });
  },
  setUiTextScale: (scale) => {
    const currentColorMode = get().uiColorMode;
    saveUiPreferences({ uiTextScale: scale, uiColorMode: currentColorMode });
    set({ uiTextScale: scale });
  },
  setUiColorMode: (mode) => {
    const currentTextScale = get().uiTextScale;
    saveUiPreferences({ uiTextScale: currentTextScale, uiColorMode: mode });
    set({ uiColorMode: mode });
  },

  newGame: (playerName?: string, companyName?: string, seed?: number) => {
    clearDayLaborCelebrationTimer();
    clearTimedTaskActionTimer();
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
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
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
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
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
    set({
      screen: "title",
      activeModal: null,
      activeSheet: null,
      notice: "",
      timedTaskAction: null,
      gameplayMutationLocked: false,
      dayLaborCelebrationActive: false,
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
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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
    if (currentState.timedTaskAction) {
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

    const startedAtMs = Date.now();
    const durationMs = getActionDurationMs(stance, allowOvertime);
    const timedTaskAction: TimedTaskActionState = {
      id: `${current.day}:${activeTask.taskId}:${stance}:${allowOvertime ? "ot" : "std"}:${startedAtMs}`,
      stance,
      allowOvertime,
      label: formatTimedActionLabel(activeTask.taskId, stance, allowOvertime),
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
      activeSheet: null
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
      saveGame(result.nextState);
      set({
        game: result.nextState,
        lastAction: result.payload ? toSummary("Task Result", buildTaskResultLines(result.payload), result.payload.digest) : latest.lastAction,
        notice: result.notice ?? "",
        sessionTelemetry: bumpSessionTelemetry(latest.sessionTelemetry),
        activeSheet: null,
        selectedContractId: getDefaultContractId(result.nextState),
        timedTaskAction: null,
        gameplayMutationLocked: false,
        ...enqueueProgressPopups(latest, progressUpdates)
      });
    }, durationMs);
  },

  returnToShopForTools: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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
      selectedContractId: getDefaultContractId(result.nextState)
    });
  },

  buyFuel: (units = 1) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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

  startResearch: (projectId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (get().timedTaskAction) {
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

  hireAccountant: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    if (get().timedTaskAction) {
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
    if (get().timedTaskAction) {
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

export { bundle };


