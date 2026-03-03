import { useEffect, useMemo, useRef, useState } from "react";
import {
  SUPPLY_QUALITIES,
  formatHours,
  formatSkillLabel,
  formatSupplyQuality,
  getCurrentTask,
  getCurrentTaskGuidance,
  getGasStationStopPlan,
  getOperatorLevel,
  getSkillDisplayRows,
  getSupplyQuantity,
  getSupplyUnitPrice,
  getVisibleTaskActions
} from "../../core/playerFlow";
import { ActiveTaskState, SupplyInventory, SupplyQuality, TaskStance } from "../../core/types";
import { bundle, useUiStore } from "../state";

interface WorkTabProps {
  modalView?: "job-details" | "inventory" | "skills" | "field-log" | "active-events";
  sheetOnly?: boolean;
}

export function WorkTab({ modalView, sheetOnly = false }: WorkTabProps) {
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [canScrollActionsLeft, setCanScrollActionsLeft] = useState(false);
  const [canScrollActionsRight, setCanScrollActionsRight] = useState(false);
  const actionTrackRef = useRef<HTMLDivElement | null>(null);
  const game = useUiStore((state) => state.game);
  const lastAction = useUiStore((state) => state.lastAction);
  const notice = useUiStore((state) => state.notice);
  const performTask = useUiStore((state) => state.performTaskUnit);
  const setJobAssignee = useUiStore((state) => state.setJobAssignee);
  const runGasStationStop = useUiStore((state) => state.runGasStationStop);
  const openModal = useUiStore((state) => state.openModal);
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
  const taskGuidance = getCurrentTaskGuidance(game, bundle);
  const isSupplierCheckoutTask = currentTask?.taskId === "checkout_supplies";
  const activeJob = game.activeJob;
  const job = activeJob
    ? bundle.jobs.find((entry) => entry.id === activeJob.jobId) ?? bundle.babaJobs.find((entry) => entry.id === activeJob.jobId) ?? null
    : null;
  const materialNeedRows = job
    ? job.materialNeeds.map((material) => {
        const supply = bundle.supplies.find((entry) => entry.id === material.supplyId);
        const onTruck = getSupplyQuantity(game.truckSupplies, material.supplyId);
        const onSite = getSupplyQuantity(activeJob?.siteSupplies ?? {}, material.supplyId);
        const inCart = getSupplyQuantity(activeJob?.supplierCart ?? {}, material.supplyId);
        const onHand = onTruck + onSite;
        return {
          supplyId: material.supplyId,
          name: supply?.name ?? material.supplyId,
          required: material.quantity,
          onHand,
          inCart,
          remaining: Math.max(0, material.quantity - onHand - inCart),
          cartByQuality: Object.fromEntries(
            SUPPLY_QUALITIES.map((quality) => [quality, getSupplyQuantity(activeJob?.supplierCart ?? {}, material.supplyId, quality)])
          ) as Record<SupplyQuality, number>
        };
      })
    : [];
  const taskActions = currentTask
    ? getVisibleTaskActions(game, bundle).map((action) => ({
        ...action,
        label:
          currentTask.taskId === "refuel_at_station"
            ? action.allowOvertime
              ? `${labelForRefuelAction(action.stance)} + OT`
              : labelForRefuelAction(action.stance)
            : action.allowOvertime
              ? `${labelForStance(action.stance)} + OT`
              : labelForStance(action.stance)
      }))
    : [];
  const supplierCatalogRows = materialNeedRows
    .map((need) => {
      const supply = bundle.supplies.find((entry) => entry.id === need.supplyId);
      if (!supply) {
        return null;
      }
      const onTruck = getSupplyQuantity(game.truckSupplies, supply.id);
      const inCart = getSupplyQuantity(activeJob?.supplierCart ?? {}, supply.id);
      return {
        supply,
        required: need.required,
        onTruck,
        inCart,
        remaining: Math.max(0, need.required - onTruck - inCart),
        cartByQuality: Object.fromEntries(
          SUPPLY_QUALITIES.map((quality) => [quality, getSupplyQuantity(activeJob?.supplierCart ?? {}, supply.id, quality)])
        ) as Record<SupplyQuality, number>
      };
    })
    .filter(
      (
        row
      ): row is {
        supply: (typeof bundle.supplies)[number];
        required: number;
        onTruck: number;
        inCart: number;
        remaining: number;
        cartByQuality: Record<SupplyQuality, number>;
      } => row !== null
    );
  const gasStationPlan = getGasStationStopPlan(game, bundle);
  const supplierCartNotice =
    notice.startsWith("Add the needed items to the supplier cart before checkout") ||
    notice.startsWith("Allocate the needed items by quality before checkout")
      ? notice
      : "";
  const supplierCartTotal = activeJob
    ? supplierCatalogRows.reduce(
        (sum, row) =>
          sum +
          SUPPLY_QUALITIES.reduce(
            (tierSum, quality) => tierSum + row.cartByQuality[quality] * getSupplyUnitPrice(row.supply, quality, activeEvents),
            0
          ),
        0
      )
    : 0;

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
        <p className="supplier-sheet-intro">Allocate item quality and quantity, then checkout from the task actions.</p>
        <div className="supplier-sheet-meta" role="list" aria-label="Supplier cart summary">
          <span className="supplier-sheet-metric" role="listitem">
            <small>Total checkout cost</small>
            <strong>${supplierCartTotal}</strong>
          </span>
          <span className="supplier-sheet-metric" role="listitem">
            <small>Required lines</small>
            <strong>{materialNeedRows.length}</strong>
          </span>
        </div>
        <div className="supplier-carousel-frame">
          <div className="supplier-carousel-rail">
            {supplierCatalogRows.map((row) => {
              const { supply } = row;
              return (
                <article key={supply.id} className="compact-row-card supplier-card supplier-quality-card">
                  <div className="supplier-card-copy">
                    <div className="section-label-row tight-row">
                      <strong>{supply.name}</strong>
                      <span>{row.required} needed</span>
                    </div>
                    <small>
                      On hand {row.onTruck} {row.inCart > 0 ? `| In cart ${row.inCart}` : ""}
                    </small>
                    {row.remaining > 0 ? <small>Missing {row.remaining}</small> : <small>Requirement covered</small>}
                  </div>
                  <div className="stack-list">
                    {SUPPLY_QUALITIES.map((quality) => {
                      const quantity = row.cartByQuality[quality];
                      const price = getSupplyUnitPrice(supply, quality, activeEvents);
                      return (
                        <div key={`${supply.id}-${quality}`} className="stepper supplier-quality-row">
                          <span>{formatSupplyQuality(quality)} ${price}</span>
                          <button className="icon-button" onClick={() => setCartQuantity(supply.id, quality, Math.max(0, quantity - 1))}>
                            -
                          </button>
                          <span>{quantity}</span>
                          <button className="icon-button" onClick={() => setCartQuantity(supply.id, quality, quantity + 1)}>
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
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
            <span>Outcome {formatOutcomeLabel(activeJob.outcome)}</span>
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
      </section>
    );
  }

  if (modalView === "skills") {
    const skillRows = getSkillDisplayRows(game.player);
    const operatorLevel = getOperatorLevel(game.player);
    return (
      <section className="stack-block">
        <article className="chrome-card inset-card">
          <p className="eyebrow">Skill Ledger</p>
          <div className="section-label-row tight-row">
            <strong>Owner/Operator Lv {operatorLevel.level}</strong>
            <span className="chip">Avg XP {Math.floor(operatorLevel.avgXp)}</span>
          </div>
          <div className="stack-list skill-ledger-list">
            {skillRows.map((skill) => (
              <article key={skill.skillId} className="task-summary">
                <div className="section-label-row tight-row">
                  <strong>{formatSkillLabel(skill.skillId)}</strong>
                  <span>Lv {skill.level}</span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <span style={{ width: `${Math.round(skill.progress * 100)}%` }} />
                </div>
                <div className="material-need-meta">
                  <span>{skill.xp} XP</span>
                  <span>{skill.needed === null ? "Maxed" : `${Math.round(skill.current)} / ${skill.needed} to next`}</span>
                </div>
              </article>
            ))}
          </div>
        </article>
        <article className="chrome-card inset-card">
          <p className="eyebrow">Shift Context</p>
          <p className="muted-copy">Events: {activeEvents.map((event) => event.name).join(", ") || "None"}</p>
          <div className="metric-grid two-up">
            <span>Rep {game.player.reputation}</span>
            <span>Fatigue debt {game.workday.fatigue.debt}</span>
          </div>
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
      </section>
    );
  }

  return (
    <section className="tab-panel work-tab">
      <article className="chrome-card inset-card task-focus-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Current Task</p>
          </div>
        </div>
        {currentTask ? <TaskSummary task={currentTask} currentTaskId={currentTask.taskId} /> : <p className="muted-copy">No task remaining.</p>}
        {taskGuidance ? <p className="task-guidance">{taskGuidance}</p> : null}
        {gasStationPlan && currentTask?.taskId !== "refuel_at_station" ? (
          <div className={gasStationPlan.stranded ? "task-inline-notice fuel-warning-block fuel-warning-critical" : "task-inline-notice fuel-warning-block"}>
            <div className="section-label-row tight-row">
              <strong>{gasStationPlan.stranded ? "Low Fuel Warning" : "Fuel Warning"}</strong>
              <span className="chip">
                Fuel {game.player.fuel}/{game.player.fuelMax}
              </span>
            </div>
            <p>{gasStationPlan.warning}</p>
            <div className="material-need-meta">
              <span>Gas Station Run adds {gasStationPlan.suggestedFuel} fuel</span>
              <span>{gasStationPlan.onAccount ? `Charges $${gasStationPlan.totalCost} on account` : `Costs $${gasStationPlan.totalCost}`}</span>
              <span>Time {formatHours(gasStationPlan.requiredTicks)}</span>
            </div>
            <div className="task-inline-actions">
              <button className={gasStationPlan.stranded ? "primary-button" : "ghost-button"} onClick={() => runGasStationStop()}>
                Gas Station Run
              </button>
            </div>
          </div>
        ) : null}
        {activeJob.location === "supplier" && isSupplierCheckoutTask ? (
          <div className="detail-block material-needs-block">
            <div className="section-label-row tight-row">
              <strong>Needed Supplies</strong>
            </div>
            <div className="material-need-meta">
              <span>Supplier cart total</span>
              <span>${supplierCartTotal}</span>
            </div>
            <div className="supplier-carousel-frame inline-supplier-frame">
              <div className="supplier-carousel-rail">
                {supplierCatalogRows.map((row) => (
                  <article key={row.supply.id} className="task-summary material-need-row inline-supplier-row">
                    <div className="section-label-row tight-row">
                      <strong>{row.supply.name}</strong>
                      <span>{row.required} needed</span>
                    </div>
                    <div className="material-need-meta">
                      <span>On hand {row.onTruck} of {row.required}</span>
                      {row.inCart > 0 ? <span>In cart {row.inCart}</span> : null}
                      {row.remaining > 0 ? <span>Missing {row.remaining}</span> : null}
                    </div>
                    <div className="stack-list">
                      {SUPPLY_QUALITIES.map((quality) => {
                        const quantity = row.cartByQuality[quality];
                        const price = getSupplyUnitPrice(row.supply, quality, activeEvents);
                        return (
                          <div key={`${row.supply.id}-${quality}`} className="stepper supplier-quality-row">
                            <span>{formatSupplyQuality(quality)} ${price}</span>
                            <button className="icon-button" onClick={() => setCartQuantity(row.supply.id, quality, Math.max(0, quantity - 1))}>
                              -
                            </button>
                            <span>{quantity}</span>
                            <button className="icon-button" onClick={() => setCartQuantity(row.supply.id, quality, quantity + 1)}>
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {supplierCartNotice ? <p className="task-inline-notice">{supplierCartNotice}</p> : null}
        {currentTask ? (
          <div className="action-carousel">
            <div className="action-carousel-header">
              <div className="action-callout">
                <strong>TAKE ACTION</strong>
              </div>
              <div className="carousel-nav">
                <button
                  type="button"
                  className="icon-button carousel-arrow"
                  aria-label="Scroll task actions left"
                  disabled={!canScrollActionsLeft}
                  onClick={() => nudgeActionCarousel("left")}
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  className="icon-button carousel-arrow"
                  aria-label="Scroll task actions right"
                  disabled={!canScrollActionsRight}
                  onClick={() => nudgeActionCarousel("right")}
                >
                  {">"}
                </button>
              </div>
            </div>
            <div ref={actionTrackRef} className="carousel-track action-carousel-track" onScroll={syncActionCarousel}>
              {taskActions.map((action) => (
                <button
                  key={`${action.stance}-${action.allowOvertime ? "ot" : "std"}`}
                  className={`${action.allowOvertime ? "ghost-button" : "primary-button"} action-carousel-button ${toneClassForStance(action.stance)}`}
                  onClick={() => performTask(action.stance, action.allowOvertime)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {lastAction ? (
          <div className={`last-action-panel ${toneClassForActionTitle(lastAction.title)}`}>
            <strong>{lastAction.title}</strong>
            <div className="summary-copy">
              {lastAction.lines.map((line, index) => (
                <p key={`${lastAction.digest}-${index}`} className={toneClassForLogLine(line)}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      <article className="hero-card chrome-card active-job-hero">
        <div className="section-label-row active-job-header-row">
          <span className="summary-toggle-copy">
            <span className="eyebrow">Active Job</span>
            <span className="summary-toggle-title">{job.name}</span>
          </span>
          <button
            type="button"
            className="ghost-button summary-detail-button"
            aria-label={`Toggle active job details for ${job.name}`}
            aria-expanded={jobDetailsOpen}
            aria-controls="active-job-panel"
            onClick={() => setJobDetailsOpen((open) => !open)}
          >
            Details
          </button>
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
            <span>Parts {activeJob.partsQuality ? `${formatSupplyQuality(activeJob.partsQuality)} (${activeJob.partsQualityModifier >= 0 ? "+" : ""}${activeJob.partsQualityModifier})` : "pending"}</span>
            <span>Time {formatHours(activeJob.actualTicksSpent)}/{formatHours(activeJob.plannedTicks)}</span>
            <span>Rework {activeJob.reworkCount}</span>
          </div>
          <div className="detail-block">
            <strong>Assigned To</strong>
            <div className="chip-grid">
              <button className={activeJob.assignee === "self" ? "primary-button" : "ghost-button"} onClick={() => setJobAssignee("self")}>
                {game.player.name}
              </button>
              {game.player.crews.map((crew) => (
                <button
                  key={crew.crewId}
                  className={activeJob.assignee === crew.crewId ? "primary-button" : "ghost-button"}
                  onClick={() => setJobAssignee(crew.crewId)}
                >
                  {crew.name}
                </button>
              ))}
            </div>
          </div>
          <div className="action-row wrap-row">
            <button className="ghost-button" onClick={() => openModal("job-details")}>
              Job Details
            </button>
            <button className="ghost-button" onClick={() => openModal("field-log")}>
              Field Log
            </button>
          </div>
        </div>
      </article>

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
  const entries = Object.entries(inventory).filter(([supplyId]) => getSupplyQuantity(inventory, supplyId) > 0);
  return (
    <div className="inventory-panel">
      <strong>{label}</strong>
      {entries.length === 0 ? <p className="muted-copy">None</p> : null}
      {entries.map(([supplyId, stack]) => (
        <div key={supplyId} className="inventory-line">
          <span>{supplyId}</span>
          <span>{formatSupplyStack(stack)}</span>
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

function labelForRefuelAction(stance: TaskStance): string {
  if (stance === "rush") {
    return "Buy 1 Fuel";
  }
  if (stance === "careful") {
    return "Fill Tank";
  }
  return "Recommended Fill";
}

function toneClassForStance(stance: TaskStance): string {
  if (stance === "rush") {
    return "tone-warning";
  }
  if (stance === "careful") {
    return "tone-success";
  }
  return "tone-info";
}

function toneClassForActionTitle(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized.includes("fail")) {
    return "tone-danger";
  }
  if (normalized.includes("neutral")) {
    return "tone-warning";
  }
  if (normalized.includes("success") || normalized.includes("excellent")) {
    return "tone-success";
  }
  return "";
}

function toneClassForLogLine(line: string): string {
  const normalized = line.toLowerCase();
  if (
    normalized.includes("fail") ||
    normalized.includes("sideways") ||
    normalized.includes("blocked") ||
    normalized.includes("rework")
  ) {
    return "tone-danger";
  }
  if (normalized.includes("neutral") || normalized.includes("half pay")) {
    return "tone-warning";
  }
  if (normalized.includes("success") || normalized.includes("excellent") || normalized.includes("earned")) {
    return "tone-success";
  }
  return "";
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

function formatSupplyStack(stack: SupplyInventory[string] | undefined): string {
  return SUPPLY_QUALITIES.map((quality) => ({ quality, quantity: stack?.[quality] ?? 0 }))
    .filter((entry) => entry.quantity > 0)
    .map((entry) => `${entry.quantity} ${formatSupplyQuality(entry.quality)}`)
    .join(", ");
}

function formatOutcomeLabel(outcome: string | undefined): string {
  if (!outcome) {
    return "open";
  }
  if (outcome === "neutral") {
    return "neutral (half pay)";
  }
  return outcome;
}

