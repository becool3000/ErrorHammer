import { useMemo, useState } from "react";
import { FACILITY_ACTION_COSTS } from "../../core/operations";
import { getStarterKitProgress, STARTER_TOOL_IDS } from "../../core/playerFlow";
import { bundle, useUiStore } from "../state";

interface FacilityActionRow {
  id: "open-storage" | "open-office" | "open-yard" | "enable-dumpster" | "close-yard" | "close-office";
  label: string;
  disabled: boolean;
  onClick: () => void;
}

export function FacilitiesTab() {
  const [otherOptionsOpen, setOtherOptionsOpen] = useState(false);
  const game = useUiStore((state) => state.game);
  const openStorage = useUiStore((state) => state.openStorage);
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
  const starterKit = getStarterKitProgress(game.player);
  const starterToolRows = STARTER_TOOL_IDS.map((toolId) => ({
    toolId,
    owned: Boolean(game.player.tools[toolId]),
    label: bundle.tools.find((tool) => tool.id === toolId)?.name ?? toolId
  }));
  const facilityTierLabel =
    operations.businessTier === "yard"
      ? "Yard Tier"
      : operations.businessTier === "office"
        ? "Office Tier"
        : operations.facilities.storageOwned
          ? "Storage Tier"
          : "Truck Life";
  const openStorageCost = formatCostLabel(FACILITY_ACTION_COSTS.openStorage);
  const openOfficeCost = formatCostLabel(FACILITY_ACTION_COSTS.openOffice);
  const openYardCost = formatCostLabel(FACILITY_ACTION_COSTS.openYard);
  const enableDumpsterCost = formatCostLabel(FACILITY_ACTION_COSTS.enableDumpster);
  const closeYardCost = formatCostLabel(FACILITY_ACTION_COSTS.closeYard);
  const closeOfficeCost = formatCostLabel(FACILITY_ACTION_COSTS.closeOffice);
  const storageActionLabel = operations.facilities.storageOwned
    ? "Storage Active"
    : starterKit.allOwned
      ? `Open Storage (${openStorageCost})`
      : `Open Storage (${openStorageCost}) - Starter kit required`;
  const actions: FacilityActionRow[] = [
    {
      id: "open-storage",
      label: storageActionLabel,
      disabled: operations.facilities.storageOwned || !starterKit.allOwned,
      onClick: () => openStorage()
    },
    {
      id: "open-office",
      label: operations.facilities.officeOwned ? "Office Active" : `Open Office (${openOfficeCost})`,
      disabled: !operations.facilities.storageOwned || operations.facilities.officeOwned,
      onClick: () => upgradeBusinessTier("office")
    },
    {
      id: "open-yard",
      label: operations.facilities.yardOwned ? "Yard Active" : `Open Yard (${openYardCost})`,
      disabled: !operations.facilities.officeOwned || operations.facilities.yardOwned,
      onClick: () => upgradeBusinessTier("yard")
    },
    {
      id: "enable-dumpster",
      label: operations.facilities.dumpsterEnabled ? "Dumpster Enabled" : `Enable Dumpster (${enableDumpsterCost})`,
      disabled: !operations.facilities.yardOwned || operations.facilities.dumpsterEnabled,
      onClick: () => enableDumpsterService()
    },
    {
      id: "close-yard",
      label: `Close Yard (${closeYardCost})`,
      disabled: !operations.facilities.yardOwned,
      onClick: () => closeYardManually()
    },
    {
      id: "close-office",
      label: `Close Office (${closeOfficeCost})`,
      disabled: !operations.facilities.officeOwned,
      onClick: () => closeOfficeManually()
    }
  ];
  const availableActionsCount = actions.filter((action) => !action.disabled).length;
  const otherOptionsToggleLabel = otherOptionsOpen
    ? "Hide Other Options"
    : availableActionsCount > 0
      ? `Other Options (${availableActionsCount})`
      : "Other Options";

  return (
    <section className="tab-panel facilities-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Facilities</p>
            <h2>{facilityTierLabel}</h2>
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
            <p className="eyebrow">Starter Kit</p>
            <h3>
              {starterKit.owned}/{starterKit.total} tools owned
            </h3>
          </div>
          <span className="chip">{starterKit.allOwned ? "Ready" : "Incomplete"}</span>
        </div>
        <div className="chip-grid">
          {starterToolRows.map((tool) => (
            <span key={tool.toolId} className={tool.owned ? "chip tone-success" : "chip muted"}>
              {tool.owned ? "Owned" : "Missing"} {tool.label}
            </span>
          ))}
        </div>
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Other Options</p>
            <h3>Facility Actions</h3>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setOtherOptionsOpen((open) => !open)}
            aria-expanded={otherOptionsOpen}
            aria-controls="facility-other-options"
          >
            {otherOptionsToggleLabel}
          </button>
        </div>
        {otherOptionsOpen ? (
          <div id="facility-other-options" className="stack-list facilities-other-options">
            {actions.map((action) => (
              <button key={action.id} className="ghost-button secondary-action-button" onClick={action.onClick} disabled={action.disabled}>
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted-copy">Expand to manage storage, office, yard, and dumpster actions.</p>
        )}
      </article>
    </section>
  );
}

function formatCostLabel(amount: number): string {
  return `$${Math.max(0, Math.round(amount)).toLocaleString("en-US")}`;
}
