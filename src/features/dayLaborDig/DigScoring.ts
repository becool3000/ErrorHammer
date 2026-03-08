import { countCellsInRect, countDirtInRect, getDigCell } from "./DigGrid";
import { DigGrid, DigLevelLayout, DigRuntimeMetrics, DigScoreBreakdown } from "./DigTypes";
import { DigMinigameConfig, DigPhase } from "../../core/types";

export function calculateDigMetrics(grid: DigGrid, layout: DigLevelLayout, overdigCount: number): DigRuntimeMetrics {
  const trenchTotal = Math.max(1, countCellsInRect(layout.trenchRegion));
  const trenchDirt = countDirtInRect(grid, layout.trenchRegion);
  const excavationClear = clamp01((trenchTotal - trenchDirt) / trenchTotal);

  const lineCellTotal = Math.max(1, countCellsInRect(layout.targetFillRegion));
  const lineCellsFilled = countDirtInRect(grid, layout.targetFillRegion);
  const backfillCoverage = clamp01(lineCellsFilled / lineCellTotal);

  let overfillColumns = 0;
  const lineXMin = layout.targetFillRegion.x;
  const lineXMax = layout.targetFillRegion.x + layout.targetFillRegion.width;
  for (let x = lineXMin; x < lineXMax; x += 1) {
    let columnOverfilled = false;
    for (let y = 0; y < layout.surfaceY; y += 1) {
      if (getDigCell(grid, x, y) === 1) {
        columnOverfilled = true;
        break;
      }
    }
    if (columnOverfilled) {
      overfillColumns += 1;
    }
  }
  const overfillRatio = clamp01(overfillColumns / Math.max(1, layout.targetFillRegion.width));

  return {
    excavationClear,
    backfillCoverage,
    overfillRatio,
    overdigCount
  };
}

export function calculateDigScore(metrics: DigRuntimeMetrics, elapsedMs: number, timeLimitMs: number): DigScoreBreakdown {
  const excavationAccuracy = clamp01(metrics.excavationClear);
  const overfillPenalty = clamp01(metrics.overfillRatio * 1.4);
  const backfillAccuracy = clamp01(metrics.backfillCoverage - overfillPenalty);
  const timeRatio = clamp01(elapsedMs / Math.max(1, timeLimitMs));
  const timeBonus = Math.round((1 - timeRatio) * 18);
  const overdigPenalty = Math.min(24, Math.round(metrics.overdigCount * 0.4));
  const overfillPenaltyPoints = Math.round(metrics.overfillRatio * 40);
  const raw = Math.round(excavationAccuracy * 45 + backfillAccuracy * 45 + timeBonus - overdigPenalty - overfillPenaltyPoints);

  return {
    score: Math.max(0, Math.min(100, raw)),
    excavationAccuracy,
    backfillAccuracy
  };
}

export function resolveDigPhase(
  current: DigPhase,
  metrics: DigRuntimeMetrics,
  elapsedMs: number,
  config: Pick<DigMinigameConfig, "excavationClearThreshold" | "backfillTargetThreshold" | "overfillTolerance" | "timeLimitMs">
): DigPhase {
  if (current === "complete" || current === "failed") {
    return current;
  }
  if (current === "grade") {
    return "grade";
  }
  if (elapsedMs >= config.timeLimitMs) {
    return "failed";
  }
  if (current === "excavate" && metrics.excavationClear >= config.excavationClearThreshold) {
    return "backfill";
  }
  // Backfill completion enters a short auto-grade phase before final completion.
  if (current === "backfill" && metrics.backfillCoverage >= config.backfillTargetThreshold) {
    return "grade";
  }
  return current;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
