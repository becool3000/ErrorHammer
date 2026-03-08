import { getDigCell, setDigCell } from "./DigGrid";
import { DIG_DIRT, DIG_EMPTY, DigGrid, DigLevelLayout } from "./DigTypes";

export interface DigSimStepResult {
  movedCells: number;
}

export interface DigAutoGradeStepResult {
  movedCells: number;
}

export function stepDigSimulation(grid: DigGrid, tick: number): DigSimStepResult {
  let movedCells = 0;

  for (let y = grid.height - 2; y >= 0; y -= 1) {
    const evenRow = ((y + tick) & 1) === 0;
    if (evenRow) {
      for (let x = 1; x < grid.width - 1; x += 1) {
        movedCells += stepCell(grid, x, y, evenRow);
      }
      continue;
    }
    for (let x = grid.width - 2; x >= 1; x -= 1) {
      movedCells += stepCell(grid, x, y, evenRow);
    }
  }

  return { movedCells };
}

export function stepAutoGrade(
  grid: DigGrid,
  layout: Pick<DigLevelLayout, "surfaceY" | "targetFillRegion">,
  tick: number,
  maxMoves = 6
): DigAutoGradeStepResult {
  let movedCells = 0;
  const xMin = layout.targetFillRegion.x;
  const xMax = layout.targetFillRegion.x + layout.targetFillRegion.width - 1;
  if (xMax <= xMin) {
    return { movedCells };
  }

  while (movedCells < maxMoves) {
    const columns = collectColumnStates(grid, xMin, xMax, layout.surfaceY);
    if (columns.high.length === 0) {
      break;
    }

    if (columns.low.length > 0) {
      const moved = moveFromHighToLow(grid, columns.high, columns.low, layout.surfaceY, tick);
      if (!moved) {
        break;
      }
      movedCells += 1;
      continue;
    }

    const moved = compactPeaks(grid, columns.high, xMin, xMax, tick);
    if (!moved) {
      break;
    }
    movedCells += 1;
  }

  return { movedCells };
}

function stepCell(grid: DigGrid, x: number, y: number, preferLeft: boolean): number {
  if (x <= 0 || x >= grid.width - 1) {
    return 0;
  }
  if (getDigCell(grid, x, y) !== DIG_DIRT) {
    return 0;
  }

  if (getDigCell(grid, x, y + 1) === DIG_EMPTY) {
    setDigCell(grid, x, y, DIG_EMPTY);
    setDigCell(grid, x, y + 1, DIG_DIRT);
    return 1;
  }

  const leftOpen = getDigCell(grid, x - 1, y + 1) === DIG_EMPTY;
  const rightOpen = getDigCell(grid, x + 1, y + 1) === DIG_EMPTY;
  if (!leftOpen && !rightOpen) {
    return 0;
  }

  const targetX = leftOpen && rightOpen ? (preferLeft ? x - 1 : x + 1) : leftOpen ? x - 1 : x + 1;
  setDigCell(grid, x, y, DIG_EMPTY);
  setDigCell(grid, targetX, y + 1, DIG_DIRT);
  return 1;
}

function collectColumnStates(grid: DigGrid, xMin: number, xMax: number, surfaceY: number): { high: number[]; low: number[] } {
  const high: number[] = [];
  const low: number[] = [];
  for (let x = xMin; x <= xMax; x += 1) {
    const topY = getTopDirtY(grid, x);
    if (topY < surfaceY) {
      high.push(x);
    } else if (topY > surfaceY) {
      low.push(x);
    }
  }
  return { high, low };
}

function moveFromHighToLow(grid: DigGrid, highColumns: number[], lowColumns: number[], surfaceY: number, tick: number): boolean {
  const sources = orderColumns(highColumns, tick);
  for (const sourceX of sources) {
    const sourceTopY = getTopDirtY(grid, sourceX);
    if (sourceTopY >= surfaceY) {
      continue;
    }

    const targetX = pickNearestLowColumn(sourceX, lowColumns, tick);
    if (targetX === null) {
      continue;
    }

    const targetTopY = getTopDirtY(grid, targetX);
    const targetY = targetTopY >= grid.height ? grid.height - 1 : targetTopY - 1;
    if (targetY < surfaceY || targetY < 0) {
      continue;
    }
    if (getDigCell(grid, targetX, targetY) !== DIG_EMPTY) {
      continue;
    }

    setDigCell(grid, sourceX, sourceTopY, DIG_EMPTY);
    setDigCell(grid, targetX, targetY, DIG_DIRT);
    return true;
  }
  return false;
}

function compactPeaks(grid: DigGrid, highColumns: number[], xMin: number, xMax: number, tick: number): boolean {
  if (highColumns.length <= 1) {
    return false;
  }
  const sinkX = pickSinkColumn(grid, highColumns, xMin, xMax);
  const sources = orderColumns(highColumns.filter((x) => x !== sinkX), tick);
  for (const sourceX of sources) {
    const sourceTopY = getTopDirtY(grid, sourceX);
    const sinkTopY = getTopDirtY(grid, sinkX);
    const sinkY = sinkTopY - 1;
    if (sourceTopY >= grid.height || sinkY < 0) {
      continue;
    }
    if (getDigCell(grid, sourceX, sourceTopY) !== DIG_DIRT || getDigCell(grid, sinkX, sinkY) !== DIG_EMPTY) {
      continue;
    }
    setDigCell(grid, sourceX, sourceTopY, DIG_EMPTY);
    setDigCell(grid, sinkX, sinkY, DIG_DIRT);
    return true;
  }
  return false;
}

function getTopDirtY(grid: DigGrid, x: number): number {
  for (let y = 0; y < grid.height; y += 1) {
    if (getDigCell(grid, x, y) === DIG_DIRT) {
      return y;
    }
  }
  return grid.height;
}

function pickNearestLowColumn(sourceX: number, lowColumns: number[], tick: number): number | null {
  if (lowColumns.length === 0) {
    return null;
  }
  const ordered = orderColumns(lowColumns, tick);
  let bestX = ordered[0] ?? null;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (const candidateX of ordered) {
    const distance = Math.abs(candidateX - sourceX);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestX = candidateX;
    }
  }
  return bestX;
}

function pickSinkColumn(grid: DigGrid, highColumns: number[], xMin: number, xMax: number): number {
  const centerX = Math.floor((xMin + xMax) / 2);
  let bestX = highColumns[0]!;
  let bestTopY = getTopDirtY(grid, bestX);
  let bestCenterDistance = Math.abs(bestX - centerX);
  for (let index = 1; index < highColumns.length; index += 1) {
    const candidateX = highColumns[index]!;
    const candidateTopY = getTopDirtY(grid, candidateX);
    const candidateCenterDistance = Math.abs(candidateX - centerX);
    if (candidateTopY < bestTopY) {
      bestX = candidateX;
      bestTopY = candidateTopY;
      bestCenterDistance = candidateCenterDistance;
      continue;
    }
    if (candidateTopY === bestTopY && candidateCenterDistance < bestCenterDistance) {
      bestX = candidateX;
      bestCenterDistance = candidateCenterDistance;
    }
  }
  return bestX;
}

function orderColumns(columns: number[], tick: number): number[] {
  if ((tick & 1) === 0) {
    return [...columns];
  }
  return [...columns].reverse();
}
