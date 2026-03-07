import { getDumpsterServiceCost, getPremiumHaulCost } from "../../core/operations";
import { useUiStore } from "../state";

export function YardTab() {
  const game = useUiStore((state) => state.game);
  const emptyDumpster = useUiStore((state) => state.emptyDumpster);

  if (!game) {
    return null;
  }

  const units = game.yard.dumpsterUnits;
  const capacity = game.yard.dumpsterCapacity;
  const fillRatio = capacity > 0 ? Math.min(1, units / capacity) : 0;
  const serviceCost = getDumpsterServiceCost(units);
  const premiumExample = getPremiumHaulCost(4);
  const dumpsterEnabled = game.operations.facilities.dumpsterEnabled;
  if (!dumpsterEnabled) {
    return null;
  }

  return (
    <section className="tab-panel yard-tab">
      <article className="hero-card chrome-card yard-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Yard</p>
            <h2>Dumpster Management</h2>
          </div>
          <span className="chip">{units}/{capacity} units</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${Math.round(fillRatio * 100)}%` }} />
        </div>
        <div className="material-need-meta">
          <span>Empties {game.yard.emptiesPerformed}</span>
          <span>Service ${serviceCost}</span>
        </div>
        <button className="primary-button" disabled={units <= 0} onClick={() => emptyDumpster()}>
          {units <= 0 ? "Dumpster Empty" : `Empty Dumpster ($${serviceCost})`}
        </button>
        {units >= capacity ? <p className="notice-banner">Dumpster full. Non-day-labor contracts are blocked.</p> : null}
      </article>

      <article className="chrome-card inset-card yard-card">
        <p className="eyebrow">Cost Compare</p>
        <h3>Trash Handling</h3>
        <div className="material-need-meta">
          <span>Premium haul/job (4 units) ${premiumExample}</span>
          <span>Dumpster service now ${serviceCost}</span>
        </div>
        <p className="muted-copy">
          Without dumpster service, jobs charge premium haul-off immediately. Dumpster mode moves trash to the yard and is cheaper at scale.
        </p>
      </article>

    </section>
  );
}
