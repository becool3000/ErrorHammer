import type { DayLaborMinigameResult, DigMinigameConfig, DigMinigameState, DigPhase } from "../../core/types";

export type DigCell = 0 | 1;

export const DIG_EMPTY: DigCell = 0;
export const DIG_DIRT: DigCell = 1;

export interface DigRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DigGrid {
  width: number;
  height: number;
  cells: Uint8Array;
}

export interface DigLevelLayout {
  surfaceY: number;
  trenchRegion: DigRect;
  spoilRegion: DigRect;
  targetFillRegion: DigRect;
}

export interface DigRuntimeMetrics {
  excavationClear: number;
  backfillCoverage: number;
  overfillRatio: number;
  overdigCount: number;
}

export interface DigScoreBreakdown {
  score: number;
  excavationAccuracy: number;
  backfillAccuracy: number;
}

export interface DayLaborDigSessionState {
  runtime: DigMinigameState;
  metrics: DigRuntimeMetrics;
  result: DayLaborMinigameResult | null;
}

export const DEFAULT_DIG_MINIGAME_CONFIG: DigMinigameConfig = {
  gridWidth: 48,
  gridHeight: 30,
  maxLoad: 900,
  digRadius: 2,
  dumpRadius: 2,
  simStepIntervalMs: 60,
  excavationClearThreshold: 0.995,
  backfillTargetThreshold: 0.9,
  overfillTolerance: 0.6,
  timeLimitMs: 90_000
};

export function createInitialDigRuntimeState(): DigMinigameState {
  return {
    phase: "excavate",
    currentLoad: 0,
    elapsedMs: 0,
    score: 0,
    isPointerDown: false
  };
}

export function isTerminalDigPhase(phase: DigPhase): boolean {
  return phase === "complete" || phase === "failed";
}
