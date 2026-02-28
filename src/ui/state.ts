import { create } from "zustand";
import { loadContentBundle } from "../core/content";
import { buyFuel, performTaskUnit, setSupplierCartQuantity, acceptContract } from "../core/playerFlow";
import { hasIncompatibleLegacySave, load as loadGame, save as saveGame } from "../core/save";
import { buyTool, createInitialGameState, endShift, repairTool } from "../core/resolver";
import { GameState, TaskStance } from "../core/types";

export type ScreenId = "title" | "main" | "store" | "company";

export interface ActionSummary {
  title: string;
  lines: string[];
  digest: string;
}

interface UiState {
  screen: ScreenId;
  game: GameState | null;
  lastAction: ActionSummary | null;
  notice: string;
  newGame: (seed?: number) => void;
  continueGame: () => void;
  goTo: (screen: ScreenId) => void;
  acceptContract: (contractId: string) => void;
  setCartQuantity: (supplyId: string, quantity: number) => void;
  performTaskUnit: (stance: TaskStance, allowOvertime?: boolean) => void;
  endShift: () => void;
  buyFuel: (units?: number) => void;
  buyTool: (toolId: string) => void;
  repairTool: (toolId: string) => void;
  hireCrew: () => void;
}

const bundle = loadContentBundle();

function toSummary(title: string, lines: string[], digest: string): ActionSummary {
  return {
    title,
    lines,
    digest
  };
}

export const useUiStore = create<UiState>((set, get) => ({
  screen: "title",
  game: null,
  lastAction: null,
  notice: "",

  newGame: (seed?: number) => {
    const nextSeed = seed ?? Math.floor(Date.now() % 1_000_000_000);
    const game = createInitialGameState(bundle, nextSeed);
    saveGame(game);
    set({
      screen: "main",
      game,
      lastAction: null,
      notice: ""
    });
  },

  continueGame: () => {
    const loaded = loadGame();
    if (!loaded) {
      set({ notice: hasIncompatibleLegacySave() ? bundle.strings.continueIncompatible : bundle.strings.continueMissing });
      return;
    }
    set({ screen: "main", game: loaded, notice: "" });
  },

  goTo: (screen) => set({ screen }),

  acceptContract: (contractId) => {
    const current = get().game;
    if (!current) {
      return;
    }
    const result = acceptContract(current, bundle, contractId);
    saveGame(result.nextState);
    set({
      game: result.nextState,
      lastAction: result.payload
        ? toSummary("Contract Accepted", [`Accepted ${result.payload.jobId} for the field loop.`], result.digest)
        : get().lastAction,
      notice: result.notice ?? ""
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
      notice: result.notice ?? ""
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
      notice: ""
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

  hireCrew: () => {
    set({ notice: bundle.strings.crewDeferred });
  }
}));

export { bundle };
