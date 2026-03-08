import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { DayLaborMinigameResult, DigMinigameConfig, DigPhase } from "../../core/types";
import { createDayLaborDigLevel, getDigCell } from "./DigGrid";
import { canDumpAtPhase, digAtPointer, dumpAtPointer } from "./DigInput";
import { renderDigScene } from "./DigRenderer";
import { calculateDigMetrics, calculateDigScore, resolveDigPhase } from "./DigScoring";
import { stepAutoGrade, stepDigSimulation } from "./DigSimulation";
import { createInitialDigRuntimeState, DIG_DIRT, DigRuntimeMetrics, isTerminalDigPhase } from "./DigTypes";

interface DayLaborDiggingMinigameProps {
  sessionId: number;
  config: DigMinigameConfig;
  onSubmit: (result: DayLaborMinigameResult) => void;
  onRestart: () => void;
  onForfeit: () => void;
}

interface PointerState {
  isDown: boolean;
  x: number;
  y: number;
  mode: "dig" | "dump" | null;
}

const DEFAULT_POINTER: PointerState = {
  isDown: false,
  x: 0,
  y: 0,
  mode: null
};

const EMPTY_METRICS: DigRuntimeMetrics = {
  excavationClear: 0,
  backfillCoverage: 0,
  overfillRatio: 0,
  overdigCount: 0
};

const PHASE_MESSAGE_MS = 3_000;
const AUTO_GRADE_MS = 5_000;
const START_PHASE_MESSAGE = "Take the dirt out of the hole!";
const BACKFILL_PHASE_MESSAGE = "Put the dirt back in the hole!";
const GRADE_PHASE_MESSAGE = "Crew is leveling grade...";

export function DayLaborDiggingMinigame({ sessionId, config, onSubmit, onRestart, onForfeit }: DayLaborDiggingMinigameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(createDayLaborDigLevel(config.gridWidth, config.gridHeight));
  const pointerRef = useRef<PointerState>({ ...DEFAULT_POINTER });
  const phaseMessageRef = useRef<{ message: string | null; remainingMs: number }>({
    message: START_PHASE_MESSAGE,
    remainingMs: PHASE_MESSAGE_MS
  });
  const excavationClearLockedRef = useRef<number | null>(null);
  const autoGradeMsRemainingRef = useRef(0);
  const overdigRef = useRef(0);
  const simTickRef = useRef(0);
  const runtimeRef = useRef(createInitialDigRuntimeState());
  const resultRef = useRef<DayLaborMinigameResult | null>(null);
  const [runtime, setRuntime] = useState(() => createInitialDigRuntimeState());
  const [phaseMessage, setPhaseMessage] = useState<{ message: string | null; remainingMs: number }>({
    message: START_PHASE_MESSAGE,
    remainingMs: PHASE_MESSAGE_MS
  });
  const [metrics, setMetrics] = useState<DigRuntimeMetrics>(EMPTY_METRICS);
  const [excavationClearLocked, setExcavationClearLocked] = useState<number | null>(null);
  const [pointerCell, setPointerCell] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<DayLaborMinigameResult | null>(null);

  useEffect(() => {
    const level = createDayLaborDigLevel(config.gridWidth, config.gridHeight);
    levelRef.current = level;
    pointerRef.current = { ...DEFAULT_POINTER };
    phaseMessageRef.current = { message: START_PHASE_MESSAGE, remainingMs: PHASE_MESSAGE_MS };
    excavationClearLockedRef.current = null;
    autoGradeMsRemainingRef.current = 0;
    overdigRef.current = 0;
    simTickRef.current = 0;
    runtimeRef.current = createInitialDigRuntimeState();
    resultRef.current = null;
    setRuntime(runtimeRef.current);
    setPhaseMessage({ message: START_PHASE_MESSAGE, remainingMs: PHASE_MESSAGE_MS });
    setMetrics(calculateDigMetrics(level.grid, level.layout, 0));
    setExcavationClearLocked(null);
    setPointerCell(null);
    setResult(null);
  }, [sessionId, config.gridWidth, config.gridHeight]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      runTick();
    }, config.simStepIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [config.simStepIntervalMs, sessionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    renderDigScene(ctx, {
      grid: levelRef.current.grid,
      layout: levelRef.current.layout,
      phase: runtime.phase,
      pointerCell
    });
  }, [runtime.phase, runtime.currentLoad, runtime.elapsedMs, metrics, pointerCell]);

  const phaseLabel = useMemo(() => formatPhaseLabel(runtime.phase), [runtime.phase]);
  const objectiveText = useMemo(() => getObjectiveText(runtime.phase), [runtime.phase]);
  const loadPercent = Math.round((runtime.currentLoad / Math.max(1, config.maxLoad)) * 100);
  const timeRemainingMs = Math.max(0, config.timeLimitMs - runtime.elapsedMs);
  const timeRemainingLabel = `${(timeRemainingMs / 1000).toFixed(1)}s`;
  const showPhaseMessage = Boolean(phaseMessage.message && phaseMessage.remainingMs > 0);
  const displayedExcavationClear = runtime.phase === "excavate" ? metrics.excavationClear : (excavationClearLocked ?? metrics.excavationClear);

  function runTick() {
    const prev = runtimeRef.current;
    if (isTerminalDigPhase(prev.phase)) {
      return;
    }

    const level = levelRef.current;
    let currentLoad = prev.currentLoad;
    let phase = prev.phase;
    const elapsedMs = prev.elapsedMs + config.simStepIntervalMs;
    let nextPhaseMessage = phaseMessageRef.current.message;
    let nextPhaseMessageMs = Math.max(0, phaseMessageRef.current.remainingMs - config.simStepIntervalMs);
    if (nextPhaseMessageMs <= 0) {
      nextPhaseMessage = null;
      nextPhaseMessageMs = 0;
    }
    const pointer = pointerRef.current;

    if (pointer.isDown && phase !== "grade") {
      if (pointer.mode === "dig" && currentLoad < config.maxLoad) {
        const action = digAtPointer(level.grid, level.layout, pointer.x, pointer.y, config.digRadius, config.maxLoad - currentLoad, "excavate");
        currentLoad += action.movedCells;
        overdigRef.current += action.overdigCells;
      } else if (pointer.mode === "dump" && currentLoad > 0 && canDumpAtPhase(level.layout, phase, pointer.x, pointer.y)) {
        const dumped = dumpAtPointer(level.grid, pointer.x, pointer.y, config.dumpRadius, currentLoad, (x, y) =>
          canDumpAtPhase(level.layout, phase, x, y)
        );
        currentLoad = Math.max(0, currentLoad - dumped);
      }
    }

    if (phase === "grade") {
      stepAutoGrade(level.grid, level.layout, simTickRef.current);
    }
    stepDigSimulation(level.grid, simTickRef.current);
    simTickRef.current += 1;

    const nextMetrics = calculateDigMetrics(level.grid, level.layout, overdigRef.current);
    let lockedExcavationClear = excavationClearLockedRef.current;
    if (phase === "grade") {
      const nextAutoGradeMs = Math.max(0, autoGradeMsRemainingRef.current - config.simStepIntervalMs);
      autoGradeMsRemainingRef.current = nextAutoGradeMs;
      if (nextAutoGradeMs <= 0) {
        phase = "complete";
      } else {
        phase = "grade";
        nextPhaseMessage = GRADE_PHASE_MESSAGE;
        nextPhaseMessageMs = nextAutoGradeMs;
      }
    } else {
      const nextResolvedPhase = resolveDigPhase(phase, nextMetrics, elapsedMs, config);
      if (phase === "excavate" && nextResolvedPhase === "backfill") {
        lockedExcavationClear = nextMetrics.excavationClear;
        nextPhaseMessage = BACKFILL_PHASE_MESSAGE;
        nextPhaseMessageMs = PHASE_MESSAGE_MS;
      }
      if (phase === "backfill" && nextResolvedPhase === "grade") {
        autoGradeMsRemainingRef.current = AUTO_GRADE_MS;
        pointerRef.current = { ...DEFAULT_POINTER };
        setPointerCell(null);
        nextPhaseMessage = GRADE_PHASE_MESSAGE;
        nextPhaseMessageMs = AUTO_GRADE_MS;
      }
      if (nextResolvedPhase === "excavate") {
        lockedExcavationClear = null;
      }
      phase = nextResolvedPhase;
    }

    excavationClearLockedRef.current = lockedExcavationClear;
    const scoringMetrics = {
      ...nextMetrics,
      excavationClear: lockedExcavationClear ?? nextMetrics.excavationClear
    };

    const scoreBreakdown = calculateDigScore(scoringMetrics, elapsedMs, config.timeLimitMs);
    const nextRuntime = {
      phase,
      currentLoad,
      elapsedMs,
      score: scoreBreakdown.score,
      isPointerDown: pointerRef.current.isDown && phase !== "grade"
    };

    phaseMessageRef.current = { message: nextPhaseMessage, remainingMs: nextPhaseMessageMs };
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
    setPhaseMessage({ message: nextPhaseMessage, remainingMs: nextPhaseMessageMs });
    setMetrics(nextMetrics);
    setExcavationClearLocked(lockedExcavationClear);

    if (isTerminalDigPhase(phase) && !resultRef.current) {
      const failureReason =
        phase === "failed"
          ? prev.phase === "excavate"
            ? "Time expired before all dirt was excavated."
            : "Time expired before target fill was reached."
          : undefined;
      const resultPayload = buildResult(
        phase === "complete",
        scoreBreakdown.score,
        scoreBreakdown.excavationAccuracy,
        scoreBreakdown.backfillAccuracy,
        elapsedMs,
        failureReason
      );
      resultRef.current = resultPayload;
      setResult(resultPayload);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (resultRef.current) {
      return;
    }
    if (runtimeRef.current.phase === "grade") {
      return;
    }
    const nextCell = getPointerCell(event);
    if (!nextCell) {
      return;
    }
    const mode = getDigCell(levelRef.current.grid, nextCell.x, nextCell.y) === DIG_DIRT ? "dig" : "dump";
    pointerRef.current = { isDown: true, x: nextCell.x, y: nextCell.y, mode };
    setPointerCell(nextCell);
    runtimeRef.current = {
      ...runtimeRef.current,
      isPointerDown: true
    };
    setRuntime(runtimeRef.current);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!pointerRef.current.isDown) {
      return;
    }
    event.preventDefault();
    const nextCell = getPointerCell(event);
    if (!nextCell) {
      return;
    }
    pointerRef.current = { ...pointerRef.current, isDown: true, x: nextCell.x, y: nextCell.y };
    setPointerCell(nextCell);
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    pointerRef.current = { ...pointerRef.current, isDown: false, mode: null };
    setPointerCell(null);
    runtimeRef.current = {
      ...runtimeRef.current,
      isPointerDown: false
    };
    setRuntime(runtimeRef.current);
  }

  function getPointerCell(event: PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const bounds = canvas.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    const ratioX = bounds.width <= 0 ? 0 : localX / bounds.width;
    const ratioY = bounds.height <= 0 ? 0 : localY / bounds.height;
    const x = clamp(Math.floor(ratioX * levelRef.current.grid.width), 0, levelRef.current.grid.width - 1);
    const y = clamp(Math.floor(ratioY * levelRef.current.grid.height), 0, levelRef.current.grid.height - 1);
    return { x, y };
  }

  return (
    <section className="day-labor-dig-overlay" role="dialog" aria-modal="true" aria-label="Day Labor Digging Mini-Game">
      <article className="day-labor-dig-card chrome-card">
        <div className="day-labor-dig-header">
          <div>
            <p className="eyebrow">Day Labor Shift</p>
            <h3>Digging Crew</h3>
          </div>
          <span className={`chip ${runtime.phase === "failed" ? "tone-danger" : runtime.phase === "complete" ? "tone-success" : "tone-info"}`}>
            {phaseLabel}
          </span>
        </div>
        <p className="muted-copy">{objectiveText}</p>
        <div className="day-labor-dig-hud">
          <span>Load {runtime.currentLoad}/{config.maxLoad}</span>
          <span>{timeRemainingLabel}</span>
          <span>Score {runtime.score}</span>
        </div>
        <div className="day-labor-dig-load-track" role="progressbar" aria-label="Load meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadPercent}>
          <span style={{ width: `${loadPercent}%` }} />
        </div>
        <div className="day-labor-dig-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="day-labor-dig-canvas"
            width={960}
            height={600}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          />
          {showPhaseMessage ? (
            <div className="day-labor-dig-phase-popup" role="status" aria-live="polite">
              {phaseMessage.message}
            </div>
          ) : null}
        </div>
        <div className="day-labor-dig-hud day-labor-dig-metrics">
          <span>Excavate {Math.round(displayedExcavationClear * 100)}%</span>
          <span>Backfill {Math.round(metrics.backfillCoverage * 100)}%</span>
          <span>Overfill {Math.round(metrics.overfillRatio * 100)}%</span>
        </div>
        {result ? (
          <section className="day-labor-dig-result">
            <h4>{result.success ? "Shift Complete" : "Shift Failed"}</h4>
            <p className="muted-copy">
              Score {result.score} | Excavation {Math.round(result.excavationAccuracy * 100)}% | Fill {Math.round(metrics.backfillCoverage * 100)}% |
              Backfill Accuracy {Math.round(result.backfillAccuracy * 100)}%
            </p>
            {result.failureReason ? <p className="tone-warning">{result.failureReason}</p> : null}
            <div className="action-row">
              <button className="primary-button" onClick={() => onSubmit(result)}>
                Finish Shift
              </button>
              <button className="ghost-button" onClick={() => onRestart()}>
                Restart Run
              </button>
            </div>
          </section>
        ) : (
          <div className="action-row">
            <button className="ghost-button tone-warning" onClick={() => onForfeit()}>
              Forfeit Shift
            </button>
          </div>
        )}
      </article>
    </section>
  );
}

function buildResult(
  success: boolean,
  score: number,
  excavationAccuracy: number,
  backfillAccuracy: number,
  timeUsedMs: number,
  failureReason?: string
): DayLaborMinigameResult {
  return {
    success,
    score,
    excavationAccuracy: clamp01(excavationAccuracy),
    backfillAccuracy: clamp01(backfillAccuracy),
    timeUsedMs: Math.max(0, Math.round(timeUsedMs)),
    failureReason
  };
}

function formatPhaseLabel(phase: DigPhase): string {
  if (phase === "excavate") {
    return "Excavation";
  }
  if (phase === "backfill") {
    return "Backfill";
  }
  if (phase === "grade") {
    return "Grading";
  }
  if (phase === "complete") {
    return "Complete";
  }
  return "Failed";
}

function getObjectiveText(phase: DigPhase): string {
  if (phase === "excavate") {
    return "Excavate all dirt in the walled pit (including the extra top layer) until it is completely clear.";
  }
  if (phase === "backfill") {
    return "Press and hold anywhere on the grid to backfill until the dirt reaches the midpoint line.";
  }
  if (phase === "grade") {
    return "Crew is auto-leveling the top surface for final grading.";
  }
  if (phase === "complete") {
    return "Backfill reached the midpoint line. Finish shift to settle Day Labor pay.";
  }
  return "Time expired before excavation/backfill target was met. Finish shift or restart this run.";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
