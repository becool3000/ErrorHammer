import { useEffect, useMemo, useRef, useState } from "react";
import {
  SUPPLY_QUALITIES,
  formatHours,
  formatSkillLabel,
  formatSupplyQuality,
  getActiveJobSpendPreview,
  getCurrentTask,
  getCurrentTaskGuidance,
  getManualGasStationPlan,
  getOutOfGasRescuePlan,
  getLevelProgress,
  getOperatorLevel,
  getSkillDisplayRows,
  getSupplyQuantity,
  getSupplyUnitPrice,
  getVisibleTaskActions,
  hasUsableTools
} from "../../core/playerFlow";
import { CORE_PERK_IDS, formatArchetypeLabel, formatPerkLabel, getPerkArchetypeSnapshot, getPerkBoostDetails } from "../../core/perks";
import { mapSkillToCoreTrack } from "../../core/tradeProgress";
import { ActiveTaskState, CorePerkId, DeferredJobState, GameState, RecoveryActionId, SupplyInventory, SupplyQuality, TaskStance } from "../../core/types";
import { obfuscateReadableText } from "../readability";
import { bundle, useUiStore } from "../state";

interface WorkTabProps {
  modalView?: "job-details" | "inventory" | "skills" | "perks" | "field-log" | "active-events";
  sheetOnly?: boolean;
}

export function WorkTab({ modalView, sheetOnly = false }: WorkTabProps) {
  const [gasStationOpen, setGasStationOpen] = useState(false);
  const [jobSpendOpen, setJobSpendOpen] = useState(false);
  const [cutLossesOpen, setCutLossesOpen] = useState(false);
  const [canScrollActionsLeft, setCanScrollActionsLeft] = useState(false);
  const [canScrollActionsRight, setCanScrollActionsRight] = useState(false);
  const [expandedPerkId, setExpandedPerkId] = useState<CorePerkId | null>(null);
  const [pendingRecoveryAction, setPendingRecoveryAction] = useState<RecoveryActionId | null>(null);
  const [pendingDeferredAbandonId, setPendingDeferredAbandonId] = useState<string | null>(null);
  const actionTrackRef = useRef<HTMLDivElement | null>(null);
  const game = useUiStore((state) => state.game);
  const lastAction = useUiStore((state) => state.lastAction);
  const notice = useUiStore((state) => state.notice);
  const performTask = useUiStore((state) => state.performTaskUnit);
  const timedTaskAction = useUiStore((state) => state.timedTaskAction);
  const runManualGasStation = useUiStore((state) => state.runManualGasStation);
  const runOutOfGasRescue = useUiStore((state) => state.runOutOfGasRescue);
  const returnToShopForTools = useUiStore((state) => state.returnToShopForTools);
  const runRecoveryAction = useUiStore((state) => state.runRecoveryAction);
  const resumeDeferredJob = useUiStore((state) => state.resumeDeferredJob);
  const spendPerkPoint = useUiStore((state) => state.spendPerkPoint);
  const openModal = useUiStore((state) => state.openModal);
  const goToTab = useUiStore((state) => state.goToTab);
  const setCartQuantity = useUiStore((state) => state.setCartQuantity);
  const [timerNowMs, setTimerNowMs] = useState(() => Date.now());
  if (!game) {
    return null;
  }
  const gameState = game;

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
  const activeJobSpend = getActiveJobSpendPreview(game, bundle);
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
  const primaryTaskActionKey = getPrimaryTaskActionKey(taskActions);
  const missingWorkTools =
    Boolean(activeJob && job && currentTask?.taskId === "do_work" && activeJob.location === "job-site") &&
    !hasUsableTools(game.player, job?.requiredTools ?? []);
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
  const outOfGasRescuePlan = getOutOfGasRescuePlan(game, bundle);
  const manualGasSinglePlan = getManualGasStationPlan(game, "single");
  const manualGasFillPlan = getManualGasStationPlan(game, "fill");
  const supplierCartNotice =
    notice.startsWith("Add the needed items to the supplier cart before checkout") ||
    notice.startsWith("Allocate the needed items by quality before checkout")
      ? notice
      : "";
  const timedActionProgress = timedTaskAction ? clamp01((timerNowMs - timedTaskAction.startedAtMs) / timedTaskAction.durationMs) : 0;
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
  const deferredJobs = [...game.deferredJobs].sort(sortDeferredByUrgency.bind(null, game.day));
  const bestDeferredJob = deferredJobs.reduce<DeferredJobState | null>((best, entry) => {
    if (!best) {
      return entry;
    }
    const bestNet = best.activeJob.estimateAtAccept.projectedNetOnSuccess;
    const nextNet = entry.activeJob.estimateAtAccept.projectedNetOnSuccess;
    return nextNet > bestNet ? entry : best;
  }, null);

  useEffect(() => {
    syncActionCarousel();
  }, [currentTask?.taskId, taskActions.length]);

  useEffect(() => {
    if (!timedTaskAction) {
      return;
    }
    setTimerNowMs(Date.now());
    const intervalId = window.setInterval(() => setTimerNowMs(Date.now()), 100);
    return () => window.clearInterval(intervalId);
  }, [timedTaskAction?.id]);

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

  function confirmRecoveryAction() {
    if (pendingDeferredAbandonId) {
      resumeDeferredJob(pendingDeferredAbandonId);
      useUiStore.getState().runRecoveryAction("abandon");
      setPendingDeferredAbandonId(null);
      return;
    }
    if (!pendingRecoveryAction) {
      return;
    }
    runRecoveryAction(pendingRecoveryAction);
    setPendingRecoveryAction(null);
  }

  function cancelRecoveryAction() {
    setPendingRecoveryAction(null);
    setPendingDeferredAbandonId(null);
  }

  function renderManualGasStationBlock() {
    const singleBlocked =
      !manualGasSinglePlan || manualGasSinglePlan.fuelAdded <= 0 || manualGasSinglePlan.cashShortfall > 0 || manualGasSinglePlan.timeBlocked;
    const fillBlocked =
      !manualGasFillPlan || manualGasFillPlan.fuelAdded <= 0 || manualGasFillPlan.cashShortfall > 0 || manualGasFillPlan.timeBlocked;
    const statusLine = !manualGasSinglePlan
      ? "Need at least 1 fuel to drive to the nearest gas station. If your active task is fuel-blocked, use rescue first."
      : manualGasSinglePlan.fuelAdded <= 0
        ? "Tank already full."
        : manualGasSinglePlan.cashShortfall > 0
          ? `Need $${manualGasSinglePlan.cashShortfall} more for a gas station run.`
          : manualGasSinglePlan.timeBlocked
            ? "No time is left for a gas station run."
            : "Round-trip run to nearest gas station and return.";

    return (
      <div className="detail-block task-collapsible-section">
        <button
          className="ghost-button task-collapsible-toggle"
          onClick={() => setGasStationOpen((open) => !open)}
          aria-expanded={gasStationOpen}
          aria-label="Gas Station"
          data-testid="gas-station-toggle"
        >
          <strong>Gas Station</strong>
          <span className="task-collapsible-meta">
            Fuel {gameState.player.fuel}/{gameState.player.fuelMax}
          </span>
        </button>
        {gasStationOpen ? (
          <div className="collapsible-panel open task-collapsible-content">
            <p>{statusLine}</p>
            {manualGasSinglePlan && manualGasFillPlan ? (
              <>
                <div className="material-need-meta">
                  <span>Travel time {formatHours(manualGasSinglePlan.requiredTicks)}</span>
                  <span>OSHA can: {manualGasSinglePlan.canCost > 0 ? `$${manualGasSinglePlan.canCost} (first purchase)` : "Already owned"}</span>
                  <span>+1 gallon total ${manualGasSinglePlan.totalCost}</span>
                  <span>Fill tank total ${manualGasFillPlan.totalCost}</span>
                </div>
                <div className="task-inline-actions">
                  <button className="ghost-button secondary-action-button" onClick={() => runManualGasStation("single")} disabled={singleBlocked}>
                    Travel To Gas Station (+1 Gal)
                  </button>
                  <button className="ghost-button secondary-action-button" onClick={() => runManualGasStation("fill")} disabled={fillBlocked}>
                    Travel To Gas Station (Fill Tank)
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
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
          <p>{obfuscateReadableText(game, job.flavor.client_quote, `${job.id}:work-quote`)}</p>
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
            <InventoryPanel label="Storage" inventory={game.shopSupplies} />
            <InventoryPanel label="Site" inventory={activeJob?.siteSupplies ?? {}} />
          </div>
        </article>
      </section>
    );
  }

  if (modalView === "skills" || modalView === "perks") {
    const skillRows = getVisibleSkillRows(game);
    const operatorLevel = getOperatorLevel(game.player);
    const archetype = getPerkArchetypeSnapshot(game);
    const showSkills = modalView === "skills";
    const showPerks = modalView === "perks";
    return (
      <section className="stack-block skills-surface">
        {showSkills ? (
          <article className="chrome-card inset-card skills-panel">
            <p className="eyebrow">Skill Ledger</p>
            <div className="section-label-row tight-row">
              <strong>Owner/Operator Lv {operatorLevel.level}</strong>
              <span className="chip">Total XP {Math.floor(operatorLevel.totalXp)}</span>
            </div>
            <div className="stack-list skill-ledger-list">
              {skillRows.map((skill) => (
                <article key={skill.key} className="task-summary skills-row">
                  <div className="section-label-row tight-row">
                    <strong>{skill.label}</strong>
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
        ) : null}
        {showPerks ? (
          <article className="chrome-card inset-card skills-panel">
            <div className="section-label-row">
              <div>
                <p className="eyebrow">Core Perks</p>
                <h3>Perk Points {game.perks.corePerkPoints}</h3>
              </div>
              <span className="chip">Perk XP {game.perks.corePerkXp}/40</span>
            </div>
            {archetype.primary ? (
              <div className="chip-grid">
                <span className="chip tone-energy">Style {formatArchetypeLabel(archetype.primary)}</span>
                {archetype.secondary ? <span className="chip">Alt {formatArchetypeLabel(archetype.secondary)}</span> : null}
              </div>
            ) : (
              <p className="muted-copy">Spend perk points to define your company style.</p>
            )}
            <div className="stack-list skill-ledger-list">
              {CORE_PERK_IDS.map((perkId) => {
                const level = game.perks.corePerks[perkId];
                const details = getPerkBoostDetails(perkId, level);
                const detailsOpen = expandedPerkId === perkId;
                return (
                  <article key={perkId} className="task-summary skills-row">
                    <div className="section-label-row tight-row">
                      <strong>{formatPerkLabel(perkId)}</strong>
                      <span>Lv {level}</span>
                    </div>
                    <div className="action-row">
                      <button className="ghost-button secondary-action-button" onClick={() => setExpandedPerkId(detailsOpen ? null : perkId)}>
                        {detailsOpen ? "Hide" : "Explain"}
                      </button>
                      <button
                        className={game.perks.corePerkPoints > 0 ? "ghost-button" : "ghost-button muted"}
                        disabled={game.perks.corePerkPoints <= 0}
                        onClick={() => spendPerkPoint(perkId)}
                      >
                        Spend Point
                      </button>
                    </div>
                    {detailsOpen ? (
                      <div className="detail-block">
                        <p className="muted-copy">{details.overview}</p>
                        <p className="muted-copy">{details.current}</p>
                        <p className="muted-copy">{details.cap}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </article>
        ) : null}
        <article className="chrome-card inset-card skills-panel">
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
        <EventCueCard game={game} eventCueRows={eventCueRows} />
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
            <button className="primary-button" aria-label="Open Contract Board" onClick={() => goToTab("contracts")}>
              Open Contract Board
            </button>
            <button className="ghost-button" onClick={() => openModal("field-log")}>
              View Log
            </button>
          </div>
        </article>
        {renderManualGasStationBlock()}
        {deferredJobs.length > 0 ? (
          <article className="chrome-card inset-card deferred-jobs-card">
            <div className="section-label-row">
              <div>
                <p className="eyebrow">Deferred Queue</p>
                <strong>{deferredJobs.length} jobs on hold</strong>
              </div>
              {bestDeferredJob ? (
                <button className="ghost-button" onClick={() => resumeDeferredJob(bestDeferredJob.deferredJobId)}>
                  Resume Best
                </button>
              ) : null}
            </div>
            <p className="muted-copy">Carrying fee $5/day per deferred job. Jobs expire after 7 days.</p>
            <div className="stack-list">
              {deferredJobs.map((entry) => {
                const daysHeld = Math.max(0, game.day - entry.deferredAtDay);
                const daysLeft = Math.max(0, 7 - daysHeld);
                return (
                  <article key={entry.deferredJobId} className="task-summary">
                    <div className="section-label-row tight-row">
                      <strong>{entry.activeJob.jobId}</strong>
                      <span className={daysLeft <= 2 ? "tone-warning" : "muted-copy"}>{daysLeft}d left</span>
                    </div>
                    <div className="material-need-meta">
                      <span>Est Net {formatSignedMoney(entry.activeJob.estimateAtAccept.projectedNetOnSuccess)}</span>
                      <span>Payout ${entry.activeJob.lockedPayout}</span>
                    </div>
                    <div className="action-row">
                      <button className="ghost-button secondary-action-button" onClick={() => resumeDeferredJob(entry.deferredJobId)}>
                        Resume
                      </button>
                      <button className="ghost-button tone-danger" onClick={() => setPendingDeferredAbandonId(entry.deferredJobId)}>
                        Abandon
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>
        ) : null}
        {(pendingRecoveryAction || pendingDeferredAbandonId) && (
          <RecoveryConfirmModal
            action={pendingDeferredAbandonId ? "abandon" : pendingRecoveryAction ?? "abandon"}
            onCancel={cancelRecoveryAction}
            onConfirm={confirmRecoveryAction}
            deferredMode={Boolean(pendingDeferredAbandonId)}
          />
        )}
      </section>
    );
  }

  return (
    <section className="tab-panel work-tab">
      <article className="chrome-card inset-card task-focus-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Current Job: {job.name}</p>
          </div>
        </div>
        {currentTask ? <TaskSummary task={currentTask} currentTaskId={currentTask.taskId} /> : <p className="muted-copy">No task remaining.</p>}
        {taskGuidance ? (
          <p className="task-guidance" data-testid="work-task-guidance">
            {taskGuidance}
          </p>
        ) : null}
        {timedTaskAction ? (
          <div className="action-timer-card">
            <div className="section-label-row tight-row action-timer-meta">
              <strong>Working: Earning {timedTaskAction.label} XP</strong>
            </div>
            <div
              className="action-timer-track"
              role="progressbar"
              aria-label={`Resolving ${timedTaskAction.label}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(timedActionProgress * 100)}
            >
              <span className={`action-timer-fill ${toneClassForStance(timedTaskAction.stance)}`} style={{ width: `${Math.round(timedActionProgress * 100)}%` }} />
            </div>
          </div>
        ) : null}
        {currentTask && !missingWorkTools ? (
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
                  disabled={Boolean(timedTaskAction) || !canScrollActionsLeft}
                  onClick={() => nudgeActionCarousel("left")}
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  className="icon-button carousel-arrow"
                  aria-label="Scroll task actions right"
                  disabled={Boolean(timedTaskAction) || !canScrollActionsRight}
                  onClick={() => nudgeActionCarousel("right")}
                >
                  {">"}
                </button>
              </div>
            </div>
            <div ref={actionTrackRef} className="carousel-track action-carousel-track" onScroll={syncActionCarousel}>
              {taskActions.map((action) => {
                const actionKey = getTaskActionKey(action);
                const isPrimaryAction = actionKey === primaryTaskActionKey;
                return (
                  <button
                    key={actionKey}
                    className={`${isPrimaryAction ? "primary-button" : "ghost-button secondary-action-button"} action-carousel-button ${toneClassForStance(action.stance)}`}
                    onClick={() => performTask(action.stance, action.allowOvertime)}
                    disabled={Boolean(timedTaskAction)}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {renderManualGasStationBlock()}
        {outOfGasRescuePlan ? (
          <div
            className={
              outOfGasRescuePlan.cashShortfall > 0
                ? "task-inline-notice fuel-warning-block fuel-warning-critical"
                : "task-inline-notice fuel-warning-block"
            }
          >
            <div className="section-label-row tight-row">
              <strong>Out Of Gas</strong>
              <span className="chip">
                Fuel {game.player.fuel}/{game.player.fuelMax}
              </span>
            </div>
            <p>{outOfGasRescuePlan.warning}</p>
            <div className="material-need-meta">
              <span>Fuel refill {outOfGasRescuePlan.fuelAdded} gal: ${outOfGasRescuePlan.fuelCost}</span>
              <span>
                OSHA can: {outOfGasRescuePlan.canCost > 0 ? `$${outOfGasRescuePlan.canCost} (first rescue)` : "Already owned"}
              </span>
              <span>Total rescue cost ${outOfGasRescuePlan.totalCost}</span>
              <span>Time {formatHours(outOfGasRescuePlan.requiredTicks)}</span>
            </div>
            <div className="task-inline-actions">
              <button
                className="ghost-button tone-warning secondary-action-button"
                onClick={() => runOutOfGasRescue()}
                aria-label="Walk To Nearest Gas Station"
                data-testid="out-of-gas-rescue-button"
              >
                Walk To Nearest Gas Station
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
        {supplierCartNotice ? (
          <p className="task-inline-notice" data-testid="supplier-cart-guidance">
            {supplierCartNotice}
          </p>
        ) : null}
        {missingWorkTools ? (
          <div className="task-inline-actions">
            <button
              className="primary-button tone-warning"
              onClick={() => returnToShopForTools()}
              aria-label="Return To Storage For Tools"
              data-testid="return-to-storage-tools-button"
            >
              Return To Storage For Tools
            </button>
          </div>
        ) : null}
        {activeJobSpend ? (
          <div className="detail-block task-collapsible-section">
            <button className="ghost-button task-collapsible-toggle" onClick={() => setJobSpendOpen((open) => !open)} aria-expanded={jobSpendOpen}>
              <strong>Budget</strong>
              <span className={`task-collapsible-meta ${activeJobSpend.projectedNetOnSuccess >= 0 ? "tone-success" : "tone-danger"}`}>
                Net on success {formatSignedMoney(activeJobSpend.projectedNetOnSuccess)}
              </span>
            </button>
            {jobSpendOpen ? (
              <div className="collapsible-panel open task-collapsible-content">
                <div className="material-need-meta">
                  <span>Gross payout ${activeJobSpend.grossPayout}</span>
                  <span>Spent so far ${activeJobSpend.spentSoFar}</span>
                </div>
                <div className="material-need-meta">
                  <span>Est remaining ${activeJobSpend.estimatedRemainingCost}</span>
                  <span>Est total ${activeJobSpend.estimatedTotalCost}</span>
                </div>
                <div className="material-need-meta">
                  <span>Materials ${activeJobSpend.materialsCost}</span>
                  <span>Fuel ${activeJobSpend.fuelCost}</span>
                  <span>Trash ${activeJobSpend.trashCost}</span>
                </div>
                <p className={activeJobSpend.projectedNetOnSuccess >= 0 ? "tone-success" : "tone-danger"}>
                  Net on success {formatSignedMoney(activeJobSpend.projectedNetOnSuccess)}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        {activeJob ? (
          <div className="detail-block task-collapsible-section">
            <button className="ghost-button task-collapsible-toggle" onClick={() => setCutLossesOpen((open) => !open)} aria-expanded={cutLossesOpen}>
              <strong>Cut Losses</strong>
            </button>
            {cutLossesOpen ? (
              <div className="collapsible-panel open task-collapsible-content">
                <div className="action-row wrap-row">
                  <button
                    className={currentTask?.taskId === "do_work" ? "ghost-button tone-warning" : "ghost-button"}
                    onClick={() => setPendingRecoveryAction("finish_cheap")}
                    disabled={currentTask?.taskId !== "do_work"}
                  >
                    Finish Cheap
                  </button>
                  <button className="ghost-button tone-warning" onClick={() => setPendingRecoveryAction("defer")}>
                    Defer
                  </button>
                  <button className="ghost-button tone-danger" onClick={() => setPendingRecoveryAction("abandon")}>
                    Abandon
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      {(pendingRecoveryAction || pendingDeferredAbandonId) && (
        <RecoveryConfirmModal
          action={pendingDeferredAbandonId ? "abandon" : pendingRecoveryAction ?? "abandon"}
          onCancel={cancelRecoveryAction}
          onConfirm={confirmRecoveryAction}
          deferredMode={Boolean(pendingDeferredAbandonId)}
        />
      )}

    </section>
  );
}

interface VisibleSkillRow {
  key: string;
  label: string;
  level: number;
  xp: number;
  current: number;
  needed: number | null;
  progress: number;
}

function getVisibleSkillRows(game: GameState): VisibleSkillRow[] {
  const officeSkillRows: VisibleSkillRow[] = [
    createOfficeSkillRow("reading", "Reading", game.officeSkills.readingXp),
    createOfficeSkillRow("accounting", "Accounting", game.officeSkills.accountingXp)
  ];
  const unlockedTradeSkillRows: VisibleSkillRow[] = getSkillDisplayRows(game.player)
    .filter((skill) => {
      const coreTrack = mapSkillToCoreTrack(skill.skillId);
      return coreTrack ? game.tradeProgress.unlocked[coreTrack] : false;
    })
    .map((skill) => ({
      key: `trade:${skill.skillId}`,
      label: formatSkillLabel(skill.skillId),
      level: skill.level,
      xp: skill.xp,
      current: skill.current,
      needed: skill.needed,
      progress: skill.progress
    }));
  return [...officeSkillRows, ...unlockedTradeSkillRows];
}

function createOfficeSkillRow(skillId: "reading" | "accounting", label: string, xp: number): VisibleSkillRow {
  const progress = getLevelProgress(Math.max(0, xp));
  return {
    key: `office:${skillId}`,
    label,
    level: progress.level,
    xp: Math.max(0, Math.round(xp)),
    current: progress.current,
    needed: progress.needed,
    progress: progress.progress
  };
}

function EventCueCard({
  game,
  eventCueRows
}: {
  game: GameState;
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
            <p className="muted-copy">{obfuscateReadableText(game, event.flavor.impact_line, `event:${event.id}:impact`)}</p>
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
  const estimatedHours = Math.max(0.5, task.baseTicks * 0.5);
  const estimatedHoursLabel = Number.isInteger(estimatedHours) ? `${estimatedHours}` : estimatedHours.toFixed(1);
  const stepsLabel =
    task.taskId === "do_work" && task.requiredUnits > 1
      ? `Step ${Math.min(task.requiredUnits, task.completedUnits + 1)} of ${task.requiredUnits}`
      : null;

  return (
    <article className={task.taskId === currentTaskId ? "task-summary current" : "task-summary"}>
      <div className="section-label-row tight-row">
        <strong>{task.label}</strong>
        <span>{`Est hours: ${estimatedHoursLabel}`}</span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${complete ? 100 : progress}%` }} />
      </div>
      <small>{stepsLabel ? `${task.location} - ${stepsLabel}` : task.location}</small>
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
    return "Skip Refuel";
  }
  if (stance === "careful") {
    return "Fill Tank";
  }
  return "Buy 1 Fuel";
}

function getPrimaryTaskActionKey(actions: Array<{ stance: TaskStance; allowOvertime?: boolean }>): string | null {
  const standard = actions.find((action) => action.stance === "standard" && !action.allowOvertime);
  if (standard) {
    return getTaskActionKey(standard);
  }
  const noOvertime = actions.find((action) => !action.allowOvertime);
  if (noOvertime) {
    return getTaskActionKey(noOvertime);
  }
  return actions[0] ? getTaskActionKey(actions[0]) : null;
}

function getTaskActionKey(action: { stance: TaskStance; allowOvertime?: boolean }): string {
  return `${action.stance}:${action.allowOvertime ? "ot" : "std"}`;
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
  if (normalized.includes("rebar bob") || normalized.includes("beanpole arms") || normalized.includes("panty waist")) {
    return "tone-warning";
  }
  if (
    normalized.includes("fail") ||
    normalized.includes("sideways") ||
    normalized.includes("sloppy") ||
    normalized.includes("botched") ||
    normalized.includes("blocked") ||
    normalized.includes("dragged out") ||
    normalized.includes("rework") ||
    normalized.includes("burned") ||
    normalized.includes("balance declined") ||
    normalized.includes("declined")
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatSignedMoney(value: number): string {
  const rounded = Math.round(value);
  return rounded >= 0 ? `+$${rounded}` : `-$${Math.abs(rounded)}`;
}

function sortDeferredByUrgency(currentDay: number, left: DeferredJobState, right: DeferredJobState): number {
  const leftDaysLeft = 7 - Math.max(0, currentDay - left.deferredAtDay);
  const rightDaysLeft = 7 - Math.max(0, currentDay - right.deferredAtDay);
  if (leftDaysLeft !== rightDaysLeft) {
    return leftDaysLeft - rightDaysLeft;
  }
  return left.activeJob.contractId.localeCompare(right.activeJob.contractId);
}

function RecoveryConfirmModal({
  action,
  onCancel,
  onConfirm,
  deferredMode
}: {
  action: RecoveryActionId;
  onCancel: () => void;
  onConfirm: () => void;
  deferredMode?: boolean;
}) {
  const title = action === "finish_cheap" ? "Finish Cheap" : action === "defer" ? "Defer Job" : "Abandon Job";
  const penaltyCopy =
    action === "finish_cheap"
      ? "Force low-quality closeout at 70% payout. Rep -1."
      : action === "defer"
        ? "Pay $20 now and $5/day carrying fee. Expires after 7 days (rep -1)."
        : deferredMode
          ? "Discard deferred job with abandon penalties: cash -$40 and rep -2."
          : "Immediately cancel this job: cash -$40 and rep -2.";

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label={`${title} confirmation`}>
      <article className="modal-shell chrome-card">
        <div className="overlay-header">
          <h3>{title}</h3>
          <button className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div className="overlay-body stack-list">
          <p className="muted-copy">{penaltyCopy}</p>
          <div className="action-row">
            <button className="ghost-button" onClick={onCancel}>
              Cancel
            </button>
            <button className={action === "abandon" ? "primary-button tone-danger" : "primary-button"} onClick={onConfirm}>
              Confirm
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
