import { useMemo } from "react";
import { FACILITY_ACTION_COSTS } from "../../core/operations";
import { bundle, useUiStore } from "../state";

export function FacilitiesTab() {
  const game = useUiStore((state) => state.game);
  const upgradeBusinessTier = useUiStore((state) => state.upgradeBusinessTier);
  const enableDumpsterService = useUiStore((state) => state.enableDumpsterService);
  const closeOfficeManually = useUiStore((state) => state.closeOfficeManually);
  const closeYardManually = useUiStore((state) => state.closeYardManually);

  const dueRows = useMemo(() => {
    if (!game) {
      return [];
    }
    return Object.entries(game.operations.monthlyDueByCategory).sort(([left], [right]) => left.localeCompare(right));
  }, [game]);

  if (!game) {
    return null;
  }

  const { operations } = game;
  const openOfficeCost = formatCostLabel(FACILITY_ACTION_COSTS.openOffice);
  const openYardCost = formatCostLabel(FACILITY_ACTION_COSTS.openYard);
  const enableDumpsterCost = formatCostLabel(FACILITY_ACTION_COSTS.enableDumpster);
  const closeYardCost = formatCostLabel(FACILITY_ACTION_COSTS.closeYard);
  const closeOfficeCost = formatCostLabel(FACILITY_ACTION_COSTS.closeOffice);

  return (
    <section className="tab-panel facilities-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Facilities</p>
            <h2>{operations.businessTier === "truck" ? "Truck Life" : operations.businessTier === "office" ? "Office Tier" : "Yard Tier"}</h2>
          </div>
          <span className="chip">Cash ${game.player.cash}</span>
        </div>
        <div className="chip-grid">
          <span className="chip">Cycle Day {operations.billingCycleDay}/22</span>
          <span className="chip">Strikes {operations.missedBillStrikes}/2</span>
          <span className="chip">Unpaid ${operations.unpaidBalance}</span>
        </div>
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Monthly Due Preview</p>
            <h3>Current Fixed Costs</h3>
          </div>
        </div>
        <div className="stack-list">
          {dueRows.length === 0 ? <p className="muted-copy">No monthly due components yet. Unlock facilities to expand operations.</p> : null}
          {dueRows.map(([key, value]) => (
            <div key={key} className="section-label-row tight-row">
              <span>{key.replace(/_/g, " ")}</span>
              <strong>${value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Tier Actions</p>
            <h3>Expand or Downshift</h3>
          </div>
        </div>
        <div className="stack-list">
          <button className="ghost-button" onClick={() => upgradeBusinessTier("office")} disabled={operations.facilities.officeOwned}>
            {operations.facilities.officeOwned ? "Office Active" : `Open Office (${openOfficeCost})`}
          </button>
          <button className="ghost-button" onClick={() => upgradeBusinessTier("yard")} disabled={!operations.facilities.officeOwned || operations.facilities.yardOwned}>
            {operations.facilities.yardOwned ? "Yard Active" : `Open Yard (${openYardCost})`}
          </button>
          <button className="ghost-button" onClick={enableDumpsterService} disabled={!operations.facilities.yardOwned || operations.facilities.dumpsterEnabled}>
            {operations.facilities.dumpsterEnabled ? "Dumpster Enabled" : `Enable Dumpster (${enableDumpsterCost})`}
          </button>
          <button className="ghost-button" onClick={closeYardManually} disabled={!operations.facilities.yardOwned}>
            {`Close Yard (${closeYardCost})`}
          </button>
          <button className="ghost-button" onClick={closeOfficeManually} disabled={!operations.facilities.officeOwned}>
            {`Close Office (${closeOfficeCost})`}
          </button>
        </div>
        <p className="muted-copy">
          Two missed monthly bills force a downgrade. Collapse is hard reset for that tier.
        </p>
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Quick Links</p>
            <h3>Related Surfaces</h3>
          </div>
        </div>
        <div className="chip-grid">
          <span className="chip">{bundle.strings.companyTitle}</span>
          <span className="chip">Accounting</span>
          <span className="chip">Yard</span>
          <span className="chip">Research</span>
        </div>
      </article>
    </section>
  );
}

function formatCostLabel(amount: number): string {
  return `$${Math.max(0, Math.round(amount)).toLocaleString("en-US")}`;
}
