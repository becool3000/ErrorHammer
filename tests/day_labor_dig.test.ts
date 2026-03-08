import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { resolveDayLaborMinigameResult } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { createDayLaborDigLevel, getDigCell, inDigBounds, setDigCell } from "../src/features/dayLaborDig/DigGrid";
import { canDumpAtPhase, digAtPointer, dumpAtPointer } from "../src/features/dayLaborDig/DigInput";
import { calculateDigMetrics, resolveDigPhase } from "../src/features/dayLaborDig/DigScoring";
import { stepAutoGrade, stepDigSimulation } from "../src/features/dayLaborDig/DigSimulation";
import { DEFAULT_DIG_MINIGAME_CONFIG } from "../src/features/dayLaborDig/DigTypes";

describe("day labor dig minigame core", () => {
  it("checks dig grid bounds and cell access deterministically", () => {
    const level = createDayLaborDigLevel(16, 12);
    expect(inDigBounds(level.grid, 0, 0)).toBe(true);
    expect(inDigBounds(level.grid, 15, 11)).toBe(true);
    expect(inDigBounds(level.grid, -1, 0)).toBe(false);
    expect(inDigBounds(level.grid, 16, 11)).toBe(false);
    setDigCell(level.grid, 1, 1, 1);
    expect(getDigCell(level.grid, 1, 1)).toBe(1);
  });

  it("steps falling dirt downward when a cell below is empty", () => {
    const level = createDayLaborDigLevel(12, 10);
    setDigCell(level.grid, 4, 4, 0);
    setDigCell(level.grid, 6, 4, 0);
    setDigCell(level.grid, 5, 4, 1);
    setDigCell(level.grid, 5, 5, 0);
    const stepped = stepDigSimulation(level.grid, 0);
    expect(stepped.movedCells).toBeGreaterThan(0);
    expect(getDigCell(level.grid, 5, 4)).toBe(0);
    expect(getDigCell(level.grid, 5, 5)).toBe(1);
  });

  it("digging removes dirt clusters and increases carried load budget", () => {
    const level = createDayLaborDigLevel();
    const centerX = level.layout.trenchRegion.x + Math.floor(level.layout.trenchRegion.width / 2);
    const centerY = level.layout.trenchRegion.y + 2;
    const result = digAtPointer(level.grid, level.layout, centerX, centerY, 2, 12, "excavate");
    expect(result.movedCells).toBeGreaterThan(0);
    expect(result.movedCells).toBeLessThanOrEqual(12);
  });

  it("dumping is blocked during excavation and allowed from anywhere during backfill", () => {
    const level = createDayLaborDigLevel();
    const dumpX = Math.floor(level.layout.targetFillRegion.width / 2);
    const dumpY = level.layout.targetFillRegion.y + 1;
    const upperDumpX = level.layout.trenchRegion.x + Math.floor(level.layout.trenchRegion.width / 2);
    const upperDumpY = Math.max(1, level.layout.trenchRegion.y - 3);

    for (let y = level.layout.targetFillRegion.y; y < level.layout.targetFillRegion.y + level.layout.targetFillRegion.height; y += 1) {
      for (let x = level.layout.targetFillRegion.x; x < level.layout.targetFillRegion.x + level.layout.targetFillRegion.width; x += 1) {
        setDigCell(level.grid, x, y, 0);
      }
    }

    const excavateDumped = dumpAtPointer(level.grid, dumpX, dumpY, 2, 8, (x, y) => canDumpAtPhase(level.layout, "excavate", x, y));
    expect(excavateDumped).toBe(0);

    const backfillDumped = dumpAtPointer(level.grid, dumpX, dumpY, 2, 8, (x, y) => canDumpAtPhase(level.layout, "backfill", x, y));
    expect(backfillDumped).toBeGreaterThan(0);
    expect(backfillDumped).toBeLessThanOrEqual(8);

    const upperBackfillDumped = dumpAtPointer(level.grid, upperDumpX, upperDumpY, 2, 6, (x, y) => canDumpAtPhase(level.layout, "backfill", x, y));
    expect(canDumpAtPhase(level.layout, "excavate", upperDumpX, upperDumpY)).toBe(false);
    expect(canDumpAtPhase(level.layout, "backfill", upperDumpX, upperDumpY)).toBe(true);
    expect(upperBackfillDumped).toBeGreaterThan(0);
    expect(upperBackfillDumped).toBeLessThanOrEqual(6);
  });

  it("transitions from excavate to backfill and then grade via thresholds", () => {
    const level = createDayLaborDigLevel();
    for (let y = level.layout.trenchRegion.y; y < level.layout.trenchRegion.y + level.layout.trenchRegion.height; y += 1) {
      for (let x = level.layout.trenchRegion.x; x < level.layout.trenchRegion.x + level.layout.trenchRegion.width; x += 1) {
        setDigCell(level.grid, x, y, 0);
      }
    }
    let metrics = calculateDigMetrics(level.grid, level.layout, 0);
    expect(resolveDigPhase("excavate", metrics, 10_000, DEFAULT_DIG_MINIGAME_CONFIG)).toBe("backfill");

    for (let y = level.layout.targetFillRegion.y; y < level.layout.targetFillRegion.y + level.layout.targetFillRegion.height; y += 1) {
      for (let x = level.layout.targetFillRegion.x; x < level.layout.targetFillRegion.x + level.layout.targetFillRegion.width; x += 1) {
        setDigCell(level.grid, x, y, 1);
      }
    }
    metrics = calculateDigMetrics(level.grid, level.layout, 0);
    expect(resolveDigPhase("backfill", metrics, 20_000, DEFAULT_DIG_MINIGAME_CONFIG)).toBe("grade");
  });

  it("enters auto-grade when target coverage is met even if overfill is high", () => {
    const phase = resolveDigPhase(
      "backfill",
      {
        excavationClear: 0.2,
        backfillCoverage: 1,
        overfillRatio: 0.95,
        overdigCount: 0
      },
      12_000,
      DEFAULT_DIG_MINIGAME_CONFIG
    );
    expect(phase).toBe("grade");
  });

  it("auto-grade shifts peaks downward and reduces overfill ratio", () => {
    const level = createDayLaborDigLevel();
    const xMin = level.layout.targetFillRegion.x;
    const xMaxExclusive = xMin + level.layout.targetFillRegion.width;
    const surfaceY = level.layout.surfaceY;

    for (let y = 0; y < level.grid.height; y += 1) {
      for (let x = xMin; x < xMaxExclusive; x += 1) {
        setDigCell(level.grid, x, y, 0);
      }
    }
    for (let y = surfaceY + 2; y < level.grid.height; y += 1) {
      for (let x = xMin; x < xMaxExclusive; x += 1) {
        setDigCell(level.grid, x, y, 1);
      }
    }
    const peakColumns = [xMin + 4, xMin + 10, xMin + 16];
    for (const x of peakColumns) {
      setDigCell(level.grid, x, surfaceY - 1, 1);
    }

    const before = calculateDigMetrics(level.grid, level.layout, 0);
    expect(before.overfillRatio).toBeGreaterThan(0);
    for (let tick = 0; tick < 8; tick += 1) {
      stepAutoGrade(level.grid, level.layout, tick, 6);
    }
    const after = calculateDigMetrics(level.grid, level.layout, 0);

    expect(after.overfillRatio).toBeLessThan(before.overfillRatio);
  });
});

describe("day labor minigame settlement", () => {
  const bundle = loadContentBundle();

  it("applies success payout with existing day labor economics and log shape", () => {
    const state = createInitialGameState(bundle, 9291);
    const result = resolveDayLaborMinigameResult(state, bundle, {
      success: true,
      score: 84,
      excavationAccuracy: 0.95,
      backfillAccuracy: 0.92,
      timeUsedMs: 62_000
    });
    expect(result.nextState.player.cash).toBeGreaterThan(state.player.cash);
    expect(result.notice).toContain("Day Laborer paid");
    expect(result.nextState.log.some((entry) => /worked a day-labor shift .* earned \$\d+\./i.test(entry.message))).toBe(true);
  });

  it("applies failed settlement with spent hours, no pay, and esteem penalty", () => {
    const state = createInitialGameState(bundle, 9292);
    const result = resolveDayLaborMinigameResult(state, bundle, {
      success: false,
      score: 19,
      excavationAccuracy: 0.42,
      backfillAccuracy: 0.2,
      timeUsedMs: 90_000,
      failureReason: "Time expired before target fill was reached."
    });
    expect(result.nextState.player.cash).toBe(state.player.cash);
    expect(result.nextState.workday.ticksSpent).toBeGreaterThan(state.workday.ticksSpent);
    expect(result.nextState.selfEsteem.currentSelfEsteem).toBeLessThan(state.selfEsteem.currentSelfEsteem);
    expect(result.notice).toContain("shift failed");
    expect(result.nextState.log.some((entry) => /worked a day-labor shift .* earned \$0\./i.test(entry.message))).toBe(true);
  });
});
