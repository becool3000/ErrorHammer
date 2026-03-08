import { getDigCell, inDigBounds, isDigWallColumn, isPointInRect, setDigCell } from "./DigGrid";
import { DIG_DIRT, DIG_EMPTY, DigGrid, DigLevelLayout } from "./DigTypes";
import type { DigPhase } from "../../core/types";

export interface DigActionResult {
  movedCells: number;
  overdigCells: number;
}

interface CandidateCell {
  x: number;
  y: number;
  distanceSq: number;
}

export function digAtPointer(
  grid: DigGrid,
  layout: DigLevelLayout,
  centerX: number,
  centerY: number,
  radius: number,
  loadCapacityLeft: number,
  phase: "excavate" | "backfill"
): DigActionResult {
  if (loadCapacityLeft <= 0) {
    return { movedCells: 0, overdigCells: 0 };
  }

  const candidates = collectRadialCandidates(centerX, centerY, radius);
  let movedCells = 0;
  let overdigCells = 0;

  for (const candidate of candidates) {
    if (movedCells >= loadCapacityLeft) {
      break;
    }
    if (!inDigBounds(grid, candidate.x, candidate.y)) {
      continue;
    }
    if (isDigWallColumn(grid, candidate.x)) {
      continue;
    }
    if (getDigCell(grid, candidate.x, candidate.y) !== DIG_DIRT) {
      continue;
    }
    if (phase === "backfill" && !isPointInRect(layout.spoilRegion, candidate.x, candidate.y)) {
      continue;
    }

    setDigCell(grid, candidate.x, candidate.y, DIG_EMPTY);
    movedCells += 1;
    if (!isPointInRect(layout.trenchRegion, candidate.x, candidate.y)) {
      overdigCells += 1;
    }
  }

  return {
    movedCells,
    overdigCells
  };
}

export function dumpAtPointer(
  grid: DigGrid,
  centerX: number,
  centerY: number,
  radius: number,
  loadAvailable: number,
  canPlaceAt: (x: number, y: number) => boolean
): number {
  if (loadAvailable <= 0) {
    return 0;
  }
  const primaryCandidates = collectRadialCandidates(centerX, centerY, radius);
  let placed = placeFromCandidates(grid, primaryCandidates, loadAvailable, canPlaceAt);
  if (placed >= loadAvailable) {
    return placed;
  }

  const assistCandidates = collectRadialCandidates(centerX, centerY, radius + 4);
  placed += placeFromCandidates(grid, assistCandidates, loadAvailable - placed, canPlaceAt);
  return placed;
}

export function canDumpAtPhase(
  layout: DigLevelLayout,
  phase: DigPhase,
  x: number,
  y: number
): boolean {
  void layout;
  void x;
  void y;
  return phase === "backfill";
}

function placeFromCandidates(
  grid: DigGrid,
  candidates: CandidateCell[],
  limit: number,
  canPlaceAt: (x: number, y: number) => boolean
): number {
  let placed = 0;
  for (const candidate of candidates) {
    if (placed >= limit) {
      break;
    }
    if (!inDigBounds(grid, candidate.x, candidate.y)) {
      continue;
    }
    if (isDigWallColumn(grid, candidate.x)) {
      continue;
    }
    if (!canPlaceAt(candidate.x, candidate.y)) {
      continue;
    }
    if (getDigCell(grid, candidate.x, candidate.y) !== DIG_EMPTY) {
      continue;
    }
    setDigCell(grid, candidate.x, candidate.y, DIG_DIRT);
    placed += 1;
  }
  return placed;
}

function collectRadialCandidates(centerX: number, centerY: number, radius: number): CandidateCell[] {
  const cells: CandidateCell[] = [];
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > radius * radius) {
        continue;
      }
      cells.push({ x, y, distanceSq });
    }
  }
  cells.sort((left, right) => left.distanceSq - right.distanceSq);
  return cells;
}
