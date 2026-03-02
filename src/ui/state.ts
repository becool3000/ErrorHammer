import { create } from "zustand";
import { loadContentBundle } from "../core/content";
import {
  buyFuel as buyFuelFlow,
  formatSkillLabel,
  getLevelForXp,
  getGasStationStopPlan,
  getOperatorLevel,
  quickBuyMissingTools as quickBuyMissingToolsFlow,
  formatHours,
  performTaskUnit as performTaskUnitFlow,
  runGasStationStop as runGasStationStopFlow,
  setSupplierCartQuantity as setSupplierCartQuantityFlow,
  acceptContract as acceptContractFlow,
  hireCrew as hireCrewFlow,
  setActiveJobAssignee as setActiveJobAssigneeFlow
} from "../core/playerFlow";
import { hasIncompatibleLegacySave, load as loadGame, save as saveGame } from "../core/save";
import { buyTool, createInitialGameState, endShift, repairTool } from "../core/resolver";
import { GameState, SkillId, SupplyQuality, TaskStance, TaskUnitResult } from "../core/types";

export type ScreenId = "title" | "game";
export type GameTabId = "work" | "contracts" | "store" | "company";
export type WorkPanelId = "task" | "job-details" | "supplies" | "inventory" | "field-log";
export type StoreSectionId = "fuel" | "tools" | "stock";
export type ActiveModalId = null | "job-details" | "inventory" | "skills" | "field-log" | "active-events" | "districts" | "crews" | "news";
export type ActiveSheetId = null | "supplies";

export interface ActionSummary {
  title: string;
  lines: string[];
  digest: string;
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

interface UiState {
  screen: ScreenId;
  activeTab: GameTabId;
  storeSection: StoreSectionId;
  activeModal: ActiveModalId;
  activeSheet: ActiveSheetId;
  selectedContractId: string | null;
  game: GameState | null;
  lastAction: ActionSummary | null;
  notice: string;
  activeProgressPopup: ProgressPopup | null;
  progressQueue: ProgressPopup[];
  titlePlayerName: string;
  titleCompanyName: string;
  setTitlePlayerName: (name: string) => void;
  setTitleCompanyName: (name: string) => void;
  newGame: (playerName?: string, companyName?: string, seed?: number) => void;
  continueGame: () => void;
  returnToTitle: () => void;
  goToTab: (tab: GameTabId) => void;
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
  endShift: () => void;
  buyFuel: (units?: number) => void;
  runGasStationStop: () => void;
  buyTool: (toolId: string) => void;
  repairTool: (toolId: string) => void;
  quickBuyTools: (contractId: string) => void;
  hireCrew: () => void;
  setJobAssignee: (assignee: "self" | string) => void;
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
  return game?.contractBoard[0]?.contractId ?? null;
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

  const popups: ProgressPopup[] = [
    {
      id: `${payload.digest}:xp`,
      kind: "xp",
      title: "XP Earned",
      lines: xpEntries.map(([skillId, delta]) => `${formatSkillLabel(skillId)} +${delta}`),
      severity: "small",
      createdAtDigest: payload.digest
    }
  ];

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

export const useUiStore = create<UiState>((set, get) => ({
  screen: "title",
  activeTab: "work",
  storeSection: "fuel",
  activeModal: null,
  activeSheet: null,
  selectedContractId: null,
  game: null,
  lastAction: null,
  notice: "",
  activeProgressPopup: null,
  progressQueue: [],
  titlePlayerName: "",
  titleCompanyName: "",

  newGame: (playerName?: string, companyName?: string, seed?: number) => {
    const nextSeed = seed ?? Math.floor(Date.now() % 1_000_000_000);
    const resolvedPlayerName = playerName ?? bundle.strings.defaultPlayerName ?? "You";
    const resolvedCompanyName = companyName ?? bundle.strings.defaultCompanyName ?? "Field Ops";
    const game = createInitialGameState(bundle, nextSeed, resolvedPlayerName, resolvedCompanyName);
    saveGame(game);
    set({
      screen: "game",
      activeTab: "work",
      storeSection: "fuel",
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(game),
      game,
      lastAction: null,
      notice: "",
      activeProgressPopup: null,
      progressQueue: [],
      titlePlayerName: resolvedPlayerName,
      titleCompanyName: resolvedCompanyName
    });
  },

  continueGame: () => {
    const loaded = loadGame();
    if (!loaded) {
      set({ notice: hasIncompatibleLegacySave() ? bundle.strings.continueIncompatible : bundle.strings.continueMissing });
      return;
    }
    set({
      screen: "game",
      activeTab: "work",
      storeSection: "fuel",
      activeModal: null,
      activeSheet: null,
      selectedContractId: getDefaultContractId(loaded),
      game: loaded,
      notice: "",
      activeProgressPopup: null,
      progressQueue: [],
      titlePlayerName: loaded.player.name,
      titleCompanyName: loaded.player.companyName
    });
  },

  returnToTitle: () => set({ screen: "title", activeModal: null, activeSheet: null, notice: "", activeProgressPopup: null, progressQueue: [] }),

  goToTab: (tab) => set({ activeTab: tab, activeModal: null, activeSheet: null }),

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
    const result = acceptContractFlow(current, bundle, contractId);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      activeTab: result.notice ? get().activeTab : "work",
      selectedContractId: getDefaultContractId(result.nextState),
      lastAction: result.payload
        ? toSummary("Contract Accepted", [`Accepted ${result.payload.jobId} for the field loop.`], result.digest)
        : get().lastAction,
      notice: result.notice ?? "",
      activeModal: null,
      activeSheet: null
    });
  },

  setCartQuantity: (supplyId, quality, quantity) => {
    const current = get().game;
    if (!current) {
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
    const current = get().game;
    if (!current) {
      return;
    }
    const result = performTaskUnitFlow(current, bundle, stance, allowOvertime);
    const progressUpdates = buildProgressPopups(current, result.nextState, result.payload);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: result.payload ? toSummary("Task Result", result.payload.logLines, result.payload.digest) : get().lastAction,
      notice: result.notice ?? "",
      activeSheet: null,
      selectedContractId: getDefaultContractId(result.nextState),
      ...enqueueProgressPopups(get(), progressUpdates)
    });
  },

  endShift: () => {
    const current = get().game;
    if (!current) {
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
      notice: "",
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
    const result = buyFuelFlow(current, units);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: toSummary("Fuel", [`Fuel now at ${result.nextState.player.fuel}/${result.nextState.player.fuelMax}.`], result.digest),
      notice: result.notice ?? ""
    });
  },

  runGasStationStop: () => {
    const current = get().game;
    if (!current) {
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
      notice: result.notice ?? ""
    });
  },

  buyTool: (toolId) => {
    const current = get().game;
    if (!current) {
      return;
    }

    const nextState = buyTool(current, bundle, toolId);
    saveGame(nextState);
    set({
      game: nextState,
      lastAction: toSummary("Tool Purchase", [`Checked the tool rack for ${toolId}.`], JSON.stringify(nextState.day)),
      notice: ""
    });
  },

  repairTool: (toolId) => {
    const current = get().game;
    if (!current) {
      return;
    }

    const nextState = repairTool(current, bundle, toolId);
    saveGame(nextState);
    set({
      game: nextState,
      lastAction: toSummary("Tool Repair", [`Ran a repair cycle for ${toolId}.`], JSON.stringify(nextState.day)),
      notice: ""
    });
  },

  quickBuyTools: (contractId) => {
    const current = get().game;
    if (!current) {
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
      notice: result.notice ?? ""
    });
  },

  hireCrew: () => {
    const current = get().game;
    if (!current) {
      return;
    }
    const result = hireCrewFlow(current);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: result.payload ? toSummary("Crew Hire", [`${result.payload.name} is now on the roster.`], result.digest) : get().lastAction,
      notice: result.notice ?? ""
    });
  },

  setJobAssignee: (assignee) => {
    const current = get().game;
    if (!current) {
      return;
    }
    const result = setActiveJobAssigneeFlow(current, assignee);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      notice: result.notice ?? ""
    });
  }
}));

export { bundle };
