import { normalizeGameState } from "./playerFlow";
import { GameState } from "./types";

export const SAVE_VERSION = 6;
const SAVE_KEY_V2 = "error-hammer-save-v2";
const SAVE_KEY_V1 = "error-hammer-save-v1";

export function save(state: GameState): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(SAVE_KEY_V2, JSON.stringify(state));
}

export function load(): GameState | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(SAVE_KEY_V2);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (parsed.saveVersion !== SAVE_VERSION) {
      return null;
    }
    if (!parsed.player || typeof parsed.day !== "number" || typeof parsed.seed !== "number") {
      return null;
    }
    return normalizeGameState(parsed);
  } catch {
    return null;
  }
}

export function hasIncompatibleLegacySave(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return Boolean(localStorage.getItem(SAVE_KEY_V1)) && !localStorage.getItem(SAVE_KEY_V2);
}

export function clear(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(SAVE_KEY_V2);
}
