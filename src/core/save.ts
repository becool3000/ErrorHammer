import { GameState } from "./types";

const SAVE_KEY = "error-hammer-save-v1";

export function save(state: GameState): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function load(): GameState | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clear(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(SAVE_KEY);
}