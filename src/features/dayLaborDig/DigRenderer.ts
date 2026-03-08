import { getDigCell } from "./DigGrid";
import { DigGrid, DigLevelLayout, DigPhase } from "./DigTypes";

export interface DigRenderParams {
  grid: DigGrid;
  layout: DigLevelLayout;
  phase: DigPhase;
  pointerCell: { x: number; y: number } | null;
}

export function renderDigScene(ctx: CanvasRenderingContext2D, params: DigRenderParams): void {
  const { grid, layout, phase, pointerCell } = params;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const cellWidth = width / grid.width;
  const cellHeight = height / grid.height;

  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height);
  drawTargetOverlays(ctx, layout, phase, cellWidth, cellHeight);
  drawDirtCells(ctx, grid, cellWidth, cellHeight);
  drawPointer(ctx, pointerCell, cellWidth, cellHeight);
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0f1b2d");
  sky.addColorStop(0.45, "#132238");
  sky.addColorStop(1, "#0a121f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function drawDirtCells(ctx: CanvasRenderingContext2D, grid: DigGrid, cellWidth: number, cellHeight: number) {
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (getDigCell(grid, x, y) !== 1) {
        continue;
      }
      ctx.fillStyle = x === 0 || x === grid.width - 1 ? "#59697d" : "#8a6a43";
      const px = x * cellWidth;
      const py = y * cellHeight;
      ctx.fillRect(px, py, cellWidth + 0.1, cellHeight + 0.1);
    }
  }
}

function drawTargetOverlays(
  ctx: CanvasRenderingContext2D,
  layout: DigLevelLayout,
  phase: DigPhase,
  cellWidth: number,
  cellHeight: number
) {
  const targetPx = layout.spoilRegion.x * cellWidth;
  const targetPy = layout.spoilRegion.y * cellHeight;
  const targetPw = layout.spoilRegion.width * cellWidth;
  const targetPh = layout.spoilRegion.height * cellHeight;
  const linePy = layout.surfaceY * cellHeight;

  ctx.save();

  ctx.fillStyle = phase === "excavate" ? "rgba(86, 186, 236, 0.08)" : "rgba(102, 220, 170, 0.08)";
  ctx.fillRect(targetPx, targetPy, targetPw, targetPh);

  ctx.strokeStyle = phase === "backfill" || phase === "grade" ? "rgba(250, 220, 120, 0.95)" : "rgba(100, 200, 250, 0.9)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, linePy);
  ctx.lineTo(ctx.canvas.width, linePy);
  ctx.stroke();

  ctx.restore();
}

function drawPointer(ctx: CanvasRenderingContext2D, pointerCell: { x: number; y: number } | null, cellWidth: number, cellHeight: number) {
  if (!pointerCell) {
    return;
  }
  const centerX = (pointerCell.x + 0.5) * cellWidth;
  const centerY = (pointerCell.y + 0.5) * cellHeight;
  const radius = Math.max(6, Math.min(cellWidth, cellHeight) * 1.4);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 245, 200, 0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
