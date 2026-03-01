import { create } from "zustand";
import { loadContentBundle } from "../core/content";
import {
  buyFuel,
  quickBuyMissingTools,
  formatHours,
  performTaskUnit,
  setSupplierCartQuantity,
  acceptContract,
  hireCrew as hireCrewFlow,
  setActiveJobAssignee
} from "../core/playerFlow";
import { hasIncompatibleLegacySave, load as loadGame, save as saveGame } from "../core/save";
import { buyTool, createInitialGameState, endShift, repairTool } from "../core/resolver";
import { GameState, TaskStance } from "../core/types";

export type ScreenId = "title" | "game";
export type GameTabId = "work" | "contracts" | "store" | "company";
export type WorkPanelId = "task" | "job-details" | "supplies" | "inventory" | "field-log";
export type StoreSectionId = "fuel" | "tools" | "stock";
export type ActiveModalId = null | "job-details" | "inventory" | "field-log" | "active-events" | "districts" | "crews" | "news";
export type ActiveSheetId = null | "supplies";

export interface ActionSummary {
  title: string;
  lines: string[];
  digest: string;
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
  acceptContract: (contractId: string) => void;
  setCartQuantity: (supplyId: string, quantity: number) => void;
  performTaskUnit: (stance: TaskStance, allowOvertime?: boolean) => void;
  endShift: () => void;
  buyFuel: (units?: number) => void;
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
      titlePlayerName: loaded.player.name,
      titleCompanyName: loaded.player.companyName
    });
  },

  returnToTitle: () => set({ screen: "title", activeModal: null, activeSheet: null, notice: "" }),

  goToTab: (tab) => set({ activeTab: tab, activeModal: null, activeSheet: null }),

  openModal: (modal) => set({ activeModal: modal, activeSheet: null }),

  closeModal: () => set({ activeModal: null }),

  openSheet: (sheet) => set({ activeSheet: sheet, activeModal: null }),

  closeSheet: () => set({ activeSheet: null }),

  setStoreSection: (section) => set({ storeSection: section }),


  selectContract: (contractId) => set({ selectedContractId: contractId }),

  clearNotice: () => set({ notice: "" }),
  setTitlePlayerName: (name) => set({ titlePlayerName: name }),
  setTitleCompanyName: (name) => set({ titleCompanyName: name }),

  acceptContract: (contractId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    const result = acceptContract(current, bundle, contractId);
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

  setCartQuantity: (supplyId, quantity) => {
    const current = get().game;
    if (!current) {
      return;
    }
    const result = setSupplierCartQuantity(current, supplyId, quantity);
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
    const result = performTaskUnit(current, bundle, stance, allowOvertime);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: result.payload ? toSummary("Task Result", result.payload.logLines, result.payload.digest) : get().lastAction,
      notice: result.notice ?? "",
      activeSheet: null,
      selectedContractId: getDefaultContractId(result.nextState)
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
    const result = buyFuel(current, units);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: toSummary("Fuel", [`Fuel now at ${result.nextState.player.fuel}/${result.nextState.player.fuelMax}.`], result.digest),
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
    const result = quickBuyMissingTools(current, bundle, contractId);
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
    const result = setActiveJobAssignee(current, assignee);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      notice: result.notice ?? ""
    });
  }
}));

export { bundle };
