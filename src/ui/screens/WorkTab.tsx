import { useEffect, useMemo, useRef, useState } from "react";
import { applyToolPriceModifiers } from "../../core/economy";
import { formatHours, getCurrentTask, getSkillDisplayRows } from "../../core/playerFlow";
import { ActiveTaskState, SupplyInventory, TaskStance } from "../../core/types";
import { bundle, useUiStore } from "../state";

interface WorkTabProps {
  modalView?: "job-details" | "inventory" | "field-log" | "active-events";
  sheetOnly?: boolean;
}

export function WorkTab({ modalView, sheetOnly = false }: WorkTabProps) {
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [canScrollActionsLeft, setCanScrollActionsLeft] = useState(false);
  const [canScrollActionsRight, setCanScrollActionsRight] = useState(false);
  const actionTrackRef = useRef<HTMLDivElement | null>(null);
  const game = useUiStore((state) => state.game);
  const lastAction = useUiStore((state) => state.lastAction);
  const performTask = useUiStore((state) => state.performTaskUnit);
  const setJobAssignee = useUiStore((state) => state.setJobAssignee);
  const endShift = useUiStore((state) => state.endShift);
  const openModal = useUiStore((state) => state.openModal);
  const openSheet = useUiStore((state) => state.openSheet);
  const goToTab = useUiStore((state) => state.goToTab);
  const setCartQuantity = useUiStore((state) => state.setCartQuantity);
  if (!game) {
    return null;
  }

  const activeEvents = bundle.events.filter((event) => game.activeEventIds.includes(event.id));
  const eventCueRows = useMemo(
    () =>
      activeEvents.map((event) => ({
        event,
        cues: deriveEventCueTags(event)
      })),
    [activeEvents]
  );
  const currentTask = getCurrentTask(game);
  const activeJob = game.activeJob;
  const job = activeJob ? bundle.jobs.find((entry) => entry.id === activeJob.jobId) ?? null : null;
  const supplyPrices = new Map(bundle.supplies.map((supply) => [supply.id, applyToolPriceModifiers(supply.price, activeEvents)]));
  const taskActions = currentTask
    ? currentTask.availableStances
        .map((stance) => ({
          stance,
          allowOvertime: false,
          label: labelForStance(stance)
        }))
        .concat(
          currentTask.availableStances.map((stance) => ({
            stance,
            allowOvertime: true,
            label: `${labelForStance(stance)} + OT`
          }))
        )
    : [];

  useEffect(() => {
    syncActionCarousel();
  }, [currentTask?.taskId, taskActions.length]);

  function syncActionCarousel() {
    const track = actionTrackRef.current;
    if (!track) {
      setCanScrollActionsLeft(false);
      setCanScrollActionsRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanScrollActionsLeft(track.scrollLeft > 4);
    setCanScrollActionsRight(track.scrollLeft < maxScrollLeft - 4);
  }

  function nudgeActionCarousel(direction: "left" | "right") {
    const track = actionTrackRef.current;
    if (!track) {
      return;
    }
    const delta = Math.max(180, Math.floor(track.clientWidth * 0.78)) * (direction === "left" ? -1 : 1);
    track.scrollBy({ left: delta, behavior: "smooth" });
    window.setTimeout(() => syncActionCarousel(), 180);
  }

  if (sheetOnly) {
    return activeJob && activeJob.location === "supplier" ? (
      <section className="stack-block">
        <div className="section-label-row">
          <p className="eyebrow">Supplier Cart</p>
          <span className="chip">{Object.keys(activeJob.supplierCart).length} lines</span>
        </div>
        <div className="drawer-list">
          {bundle.supplies.map((supply) => {
            const quantity = activeJob.supplierCart[supply.id] ?? 0;
            const price = supplyPrices.get(supply.id) ?? supply.price;
            return (
              <article key={supply.id} className="compact-row-card">
                <div>
                  <strong>{supply.name}</strong>
                  <p>{supply.flavor.description}</p>
                  <small>${price} each</small>
                </div>
                <div className="stepper">
                  <button className="icon-button" onClick={() => setCartQuantity(supply.id, Math.max(0, quantity - 1))}>
                    -
                  </button>
                  <span>{quantity}</span>
                  <button className="icon-button" onClick={() => setCartQuantity(supply.id, quantity + 1)}>
                    +
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    ) : (
      <p className="muted-copy">No supplier stop is active.</p>
    );
  }

  if (modalView === "job-details") {
    return activeJob && job ? (
      <section className="stack-block">
        <article className="chrome-card inset-card">
          <p className="eyebrow">Active Job</p>
          <h3>{job.name}</h3>
          <p>{job.flavor.client_quote}</p>
          <div className="metric-grid two-up">
            <span>Locked Payout ${activeJob.lockedPayout}</span>
            <span>Location {activeJob.location}</span>
            <span>Quality {activeJob.qualityPoints}</span>
            <span>Rework {activeJob.reworkCount}</span>
            <span>Time {formatHours(activeJob.actualTicksSpent)}/{formatHours(activeJob.plannedTicks)}</span>
            <span>Outcome {activeJob.outcome ?? "open"}</span>
          </div>
        </article>
        <article className="chrome-card inset-card">
          <p className="eyebrow">Tasks</p>
          <div className="stack-list">
            {activeJob.tasks.map((task) => (
              <TaskSummary key={task.taskId} task={task} currentTaskId={currentTask?.taskId ?? null} />
            ))}
          </div>
        </article>
      </section>
    ) : (
      <p className="muted-copy">No job details available.</p>
    );
  }

  if (modalView === "inventory") {
    const skillRows = getSkillDisplayRows(game.player).slice(0, 8);
    return (
      <section className="stack-block">
        <article className="chrome-card inset-card">
          <p className="eyebrow">Stock</p>
          <div className="inventory-columns">
            <InventoryPanel label="Truck" inventory={game.truckSupplies} />
            <InventoryPanel label="Shop" inventory={game.shopSupplies} />
            <InventoryPanel label="Site" inventory={activeJob?.siteSupplies ?? {}} />
          </div>
        </article>
        <article className="chrome-card inset-card">
          <p className="eyebrow">Skill Ledger</p>
          <div className="chip-grid">
            {skillRows.map((skill) => (
              <span key={skill.skillId} className="chip large-chip">
                {skill.skillId} R{skill.rank} ({skill.xp})
              </span>
            ))}
          </div>
          <p className="muted-copy">Events: {activeEvents.map((event) => event.name).join(", ") || "None"}</p>
        </article>
      </section>
    );
  }

  if (modalView === "field-log") {
    const lines = game.log.slice(-18).reverse();
    return (
      <section className="stack-block scroll-block">
        {lastAction ? (
          <article className="chrome-card inset-card">
            <p className="eyebrow">Last Action</p>
            <h3>{lastAction.title}</h3>
            {lastAction.lines.map((line, index) => (
              <p key={`${lastAction.digest}-${index}`}>{line}</p>
            ))}
          </article>
        ) : null}
        {lines.length === 0 ? <p className="muted-copy">No field log entries yet.</p> : null}
        {lines.map((entry, index) => (
          <article key={`${entry.day}-${entry.actorId}-${index}`} className="chrome-card inset-card log-card">
            <p className="eyebrow">
              Day {entry.day} | {entry.actorId}
              {entry.taskId ? ` | ${entry.taskId}` : ""}
            </p>
            <p>{entry.message}</p>
          </article>
        ))}
      </section>
    );
  }

  if (modalView === "active-events") {
    return (
      <section className="stack-block">
        <EventCueCard eventCueRows={eventCueRows} />
      </section>
    );
  }

  if (!activeJob || !job) {
    return (
      <section className="tab-panel work-tab">
        <article className="hero-card chrome-card">
          <p className="eyebrow">Work Queue</p>
          <h2>No active job</h2>
          <p>Pick a contract from the board to get the shift moving.</p>
          <div className="action-row">
            <button className="primary-button" onClick={() => goToTab("contracts")}>
              Open Contract Board
            </button>
            <button className="ghost-button" onClick={() => openModal("field-log")}>
              View Log
            </button>
          </div>
        </article>
        <article className="chrome-card inset-card compact-metrics">
          <div className="metric-grid two-up">
            <span>Fatigue debt {game.workday.fatigue.debt}</span>
            <span>Overtime left {Math.max(0, game.workday.maxOvertime - game.workday.overtimeUsed)}</span>
          </div>
        </article>
        <div className="sticky-action-bar">
          <button className="primary-button wide-button" onClick={() => endShift()}>
            End Shift
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tab-panel work-tab">
      <article className="chrome-card inset-card task-focus-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Current Task</p>
            <h3>{currentTask?.label ?? "Waiting"}</h3>
          </div>
          {currentTask ? <span className="chip">{renderProgress(currentTask)}</span> : null}
        </div>
        {currentTask ? <TaskSummary task={currentTask} currentTaskId={currentTask.taskId} /> : <p className="muted-copy">No task remaining.</p>}
        {currentTask ? (
          <div className="action-carousel">
            <div className="action-carousel-header">
              <span className="eyebrow">Action Carousel</span>
              <div className="carousel-nav">
                <button
                  type="button"
                  className="icon-button carousel-arrow"
                  aria-label="Scroll task actions left"
                  disabled={!canScrollActionsLeft}
                  onClick={() => nudgeActionCarousel("left")}
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="icon-button carousel-arrow"
                  aria-label="Scroll task actions right"
                  disabled={!canScrollActionsRight}
                  onClick={() => nudgeActionCarousel("right")}
                >
                  ▶
                </button>
              </div>
            </div>
            <div ref={actionTrackRef} className="carousel-track action-carousel-track" onScroll={syncActionCarousel}>
              {taskActions.map((action) => (
                <button
                  key={`${action.stance}-${action.allowOvertime ? "ot" : "std"}`}
                  className={action.allowOvertime ? "ghost-button action-carousel-button" : "primary-button action-carousel-button"}
                  onClick={() => performTask(action.stance, action.allowOvertime)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {lastAction ? (
          <div className="last-action-panel">
            <strong>{lastAction.title}</strong>
            <div className="summary-copy">
              {lastAction.lines.map((line, index) => (
                <p key={`${lastAction.digest}-${index}`}>{line}</p>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      <article className="hero-card chrome-card active-job-hero">
        <div className="section-label-row">
          <button
            type="button"
            className="summary-toggle summary-toggle-block"
            aria-label={`Toggle active job details for ${job.name}`}
            aria-expanded={jobDetailsOpen}
            aria-controls="active-job-panel"
            onClick={() => setJobDetailsOpen((open) => !open)}
          >
            <span className="summary-toggle-copy">
              <span className="eyebrow">Active Job</span>
              <span className="summary-toggle-title">{job.name}</span>
            </span>
            <span className="chip">{jobDetailsOpen ? "Hide" : "Show"}</span>
          </button>
          <span className="chip">{activeJob.location}</span>
        </div>
        <div
          id="active-job-panel"
          className={jobDetailsOpen ? "collapsible-panel open" : "collapsible-panel"}
          aria-hidden={!jobDetailsOpen}
        >
          <p className="muted-copy">{job.flavor.client_quote}</p>
          <div className="metric-grid two-up">
            <span>Payout ${activeJob.lockedPayout}</span>
            <span>Quality {activeJob.qualityPoints}</span>
            <span>Time {formatHours(activeJob.actualTicksSpent)}/{formatHours(activeJob.plannedTicks)}</span>
            <span>Rework {activeJob.reworkCount}</span>
          </div>
          <div className="detail-block">
            <strong>Assigned To</strong>
            <div className="chip-grid">
              <button className={activeJob.assignee === "self" ? "primary-button" : "ghost-button"} onClick={() => setJobAssignee("self")}>
                {game.player.name} ({game.player.stamina}/{game.player.staminaMax})
              </button>
              {game.player.crews.map((crew) => (
                <button
                  key={crew.crewId}
                  className={activeJob.assignee === crew.crewId ? "primary-button" : "ghost-button"}
                  onClick={() => setJobAssignee(crew.crewId)}
                >
                  {crew.name} ({crew.stamina}/{crew.staminaMax})
                </button>
              ))}
            </div>
          </div>
          <div className="action-row wrap-row">
            <button className="ghost-button" onClick={() => openModal("job-details")}>
              Job Details
            </button>
            <button className="ghost-button" onClick={() => openModal("inventory")}>
              Inventory
            </button>
            <button className="ghost-button" onClick={() => openModal("field-log")}>
              Field Log
            </button>
          </div>
        </div>
      </article>

      <div className="sticky-action-bar">
        {activeJob.location === "supplier" ? (
          <button className="ghost-button wide-button" onClick={() => openSheet("supplies")}>
            Open Supplies
          </button>
        ) : (
          <button className="ghost-button wide-button" onClick={() => goToTab("contracts")}>
            Contract Board
          </button>
        )}
        <button className="primary-button wide-button" onClick={() => endShift()}>
          End Shift
        </button>
      </div>
    </section>
  );
}

function EventCueCard({
  eventCueRows
}: {
  eventCueRows: Array<{ event: (typeof bundle.events)[number]; cues: string[] }>;
}) {
  return (
    <article className="chrome-card inset-card">
      <div className="section-label-row">
        <div>
          <p className="eyebrow">Shift Cues</p>
          <h3>Active Events</h3>
        </div>
        <span className="chip">{eventCueRows.length}</span>
      </div>
      {eventCueRows.length === 0 ? <p className="muted-copy">No active event modifiers today.</p> : null}
      <div className="stack-list">
        {eventCueRows.map(({ event, cues }) => (
          <article key={event.id} className="task-summary">
            <div className="section-label-row tight-row">
              <strong>{event.flavor.headline}</strong>
              <span>{event.name}</span>
            </div>
            <p className="muted-copy">{event.flavor.impact_line}</p>
            <div className="chip-grid">
              {cues.map((cue) => (
                <span key={`${event.id}-${cue}`} className="chip large-chip">
                  {cue}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}

function TaskSummary({ task, currentTaskId }: { task: ActiveTaskState; currentTaskId: string | null }) {
  const complete = task.requiredUnits === 0 || task.completedUnits >= task.requiredUnits;
  const progress = task.requiredUnits === 0 ? 100 : Math.round((task.completedUnits / task.requiredUnits) * 100);

  return (
    <article className={task.taskId === currentTaskId ? "task-summary current" : "task-summary"}>
      <div className="section-label-row tight-row">
        <strong>{task.label}</strong>
        <span>{complete ? "Ready" : `${task.completedUnits}/${task.requiredUnits}`}</span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${complete ? 100 : progress}%` }} />
      </div>
      <small>{task.location}</small>
    </article>
  );
}

function InventoryPanel({ label, inventory }: { label: string; inventory: SupplyInventory }) {
  const entries = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
  return (
    <div className="inventory-panel">
      <strong>{label}</strong>
      {entries.length === 0 ? <p className="muted-copy">None</p> : null}
      {entries.map(([supplyId, quantity]) => (
        <div key={supplyId} className="inventory-line">
          <span>{supplyId}</span>
          <span>{quantity}</span>
        </div>
      ))}
    </div>
  );
}

function renderProgress(task: ActiveTaskState) {
  if (task.requiredUnits === 0) {
    return "0/0";
  }
  return `${task.completedUnits}/${task.requiredUnits}`;
}

function labelForStance(stance: TaskStance): string {
  if (stance === "rush") {
    return "Rush";
  }
  if (stance === "careful") {
    return "Careful";
  }
  return "Standard";
}

function deriveEventCueTags(event: (typeof bundle.events)[number]): string[] {
  const cues: string[] = [];
  for (const tag of Object.keys(event.mods.payoutMultByTag ?? {})) {
    cues.push(`${tag} payout`);
  }
  for (const tag of Object.keys(event.mods.riskDeltaByTag ?? {})) {
    cues.push(`${tag} risk`);
  }
  for (const tag of event.mods.forceNeutralTags ?? []) {
    cues.push(`${tag} neutral`);
  }
  if (event.mods.toolPriceMult !== undefined) {
    cues.push("tool prices");
  }
  return cues.length > 0 ? cues : ["general conditions"];
}
