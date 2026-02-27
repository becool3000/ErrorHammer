import { create } from "zustand";
import { generateBotIntents } from "../core/bots";
import { loadContentBundle } from "../core/content";
import { hashSeed } from "../core/rng";
import { load as loadGame, save as saveGame } from "../core/save";
import { buyTool, createInitialGameState, hireCrew, repairTool, resolveDay } from "../core/resolver";
import { AssignmentIntent, GameState, ResolverResult } from "../core/types";

export type ScreenId = "title" | "main" | "store" | "company";

interface UiState {
  screen: ScreenId;
  game: GameState | null;
  pendingAssignments: AssignmentIntent[];
  lastResult: ResolverResult | null;
  notice: string;
  newGame: (seed?: number) => void;
  continueGame: () => void;
  goTo: (screen: ScreenId) => void;
  toggleAssignment: (contractId: string, assignee?: AssignmentIntent["assignee"]) => void;
  clearAssignments: () => void;
  confirmDay: () => void;
  buyTool: (toolId: string) => void;
  repairTool: (toolId: string) => void;
  hireCrew: () => void;
}

const bundle = loadContentBundle();

export const useUiStore = create<UiState>((set, get) => ({
  screen: "title",
  game: null,
  pendingAssignments: [],
  lastResult: null,
  notice: "",

  newGame: (seed?: number) => {
    const nextSeed = seed ?? Math.floor(Date.now() % 1_000_000_000);
    const game = createInitialGameState(bundle, nextSeed);
    saveGame(game);
    set({
      screen: "main",
      game,
      pendingAssignments: [],
      lastResult: null,
      notice: ""
    });
  },

  continueGame: () => {
    const loaded = loadGame();
    if (!loaded) {
      set({ notice: bundle.strings.continueMissing });
      return;
    }
    set({ screen: "main", game: loaded, notice: "" });
  },

  goTo: (screen) => set({ screen }),

  toggleAssignment: (contractId, assignee = "self") => {
    const existing = get().pendingAssignments;
    const idx = existing.findIndex((item) => item.contractId === contractId && item.assignee === assignee);
    if (idx >= 0) {
      set({ pendingAssignments: existing.filter((_, i) => i !== idx) });
      return;
    }

    set({
      pendingAssignments: [...existing, { contractId, assignee }]
    });
  },

  clearAssignments: () => set({ pendingAssignments: [] }),

  confirmDay: () => {
    const current = get().game;
    if (!current) {
      return;
    }

    const daySeed = hashSeed(current.seed, current.day);
    const playerIntent = {
      actorId: current.player.actorId,
      day: current.day,
      assignments: [...get().pendingAssignments]
    };
    const botIntents = generateBotIntents(current, bundle, daySeed);

    const result = resolveDay(current, [playerIntent, ...botIntents], bundle, daySeed);
    saveGame(result.nextState);

    set({
      game: result.nextState,
      pendingAssignments: [],
      lastResult: result,
      notice: ""
    });
  },

  buyTool: (toolId) => {
    const current = get().game;
    if (!current) {
      return;
    }

    const nextState = buyTool(current, bundle, toolId);
    saveGame(nextState);
    set({ game: nextState });
  },

  repairTool: (toolId) => {
    const current = get().game;
    if (!current) {
      return;
    }

    const nextState = repairTool(current, bundle, toolId);
    saveGame(nextState);
    set({ game: nextState });
  },

  hireCrew: () => {
    const current = get().game;
    if (!current) {
      return;
    }

    const nextState = hireCrew(current);
    saveGame(nextState);
    set({ game: nextState });
  }
}));

export { bundle };