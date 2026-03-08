import { DEFAULT_DIG_MINIGAME_CONFIG, DIG_DIRT, DIG_EMPTY, DigGrid, DigLevelLayout, DigRect } from "./DigTypes";

export interface DigLevelSnapshot {
  grid: DigGrid;
  layout: DigLevelLayout;
}

export function createDigGrid(width: number, height: number, fill: 0 | 1 = DIG_EMPTY): DigGrid {
  const cells = new Uint8Array(width * height);
  if (fill === DIG_DIRT) {
    cells.fill(DIG_DIRT);
  }
  return {
    width,
    height,
    cells
  };
}

export function inDigBounds(grid: DigGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function getDigCell(grid: DigGrid, x: number, y: number): 0 | 1 {
  if (!inDigBounds(grid, x, y)) {
    return DIG_EMPTY;
  }
  return grid.cells[y * grid.width + x] as 0 | 1;
}

export function setDigCell(grid: DigGrid, x: number, y: number, value: 0 | 1): void {
  if (!inDigBounds(grid, x, y)) {
    return;
  }
  grid.cells[y * grid.width + x] = value;
}

export function isDigWallColumn(grid: DigGrid, x: number): boolean {
  return x <= 0 || x >= grid.width - 1;
}

export function fillDigRect(grid: DigGrid, rect: DigRect, value: 0 | 1): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      setDigCell(grid, x, y, value);
    }
  }
}

export function isPointInRect(rect: DigRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

export function countDirtInRect(grid: DigGrid, rect: DigRect): number {
  let count = 0;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (getDigCell(grid, x, y) === DIG_DIRT) {
        count += 1;
      }
    }
  }
  return count;
}

export function countCellsInRect(rect: DigRect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

export function collectRectCells(rect: DigRect): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

export function createDayLaborDigLevel(
  width = DEFAULT_DIG_MINIGAME_CONFIG.gridWidth,
  height = DEFAULT_DIG_MINIGAME_CONFIG.gridHeight
): DigLevelSnapshot {
  const grid = createDigGrid(width, height, DIG_EMPTY);
  const surfaceY = Math.max(4, Math.min(height - 4, Math.floor(height * 0.5)));
  const excavationTopY = Math.max(0, surfaceY - 1);
  const trenchX = 1;
  const trenchWidth = Math.max(1, width - 2);
  const trenchRegion: DigRect = {
    x: trenchX,
    y: excavationTopY,
    width: trenchWidth,
    height: Math.max(1, height - excavationTopY)
  };
  const spoilRegion: DigRect = {
    x: trenchX,
    y: surfaceY,
    width: trenchWidth,
    height: Math.max(1, height - surfaceY)
  };
  const targetFillRegion: DigRect = {
    x: trenchX,
    y: surfaceY,
    width: trenchWidth,
    height: 1
  };

  for (let y = 0; y < grid.height; y += 1) {
    setDigCell(grid, 0, y, DIG_DIRT);
    setDigCell(grid, grid.width - 1, y, DIG_DIRT);
  }

  for (let y = surfaceY; y < grid.height; y += 1) {
    for (let x = trenchX; x < trenchX + trenchWidth; x += 1) {
      setDigCell(grid, x, y, DIG_DIRT);
    }
  }
  for (let y = excavationTopY; y < surfaceY; y += 1) {
    for (let x = trenchX; x < trenchX + trenchWidth; x += 1) {
      setDigCell(grid, x, y, DIG_DIRT);
    }
  }

  return {
    grid,
    layout: {
      surfaceY,
      trenchRegion,
      spoilRegion,
      targetFillRegion
    }
  };
}
