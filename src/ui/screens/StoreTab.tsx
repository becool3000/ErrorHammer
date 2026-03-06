import { useState } from "react";
import { isStarterToolId, shouldEnforceStarterToolGate, SUPPLY_QUALITIES, formatSupplyQuality } from "../../core/playerFlow";
import { formatNumberByAccountingClarity, obfuscateReadableText } from "../readability";
import { bundle, StoreSectionId, useUiStore } from "../state";
import { SegmentedControl } from "../components/SegmentedControl";

const storeSections: Array<{ id: StoreSectionId; label: string }> = [
  { id: "tools", label: "Tools" },
  { id: "stock", label: "Stock" }
];

export function StoreTab() {
  const game = useUiStore((state) => state.game);
  const storeSection = useUiStore((state) => state.storeSection);
  const setStoreSection = useUiStore((state) => state.setStoreSection);
  const buyTool = useUiStore((state) => state.buyTool);
  const repairTool = useUiStore((state) => state.repairTool);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  if (!game) {
    return null;
  }

  const atStorage = !game.activeJob || game.activeJob.location === "shop";
  const starterGateActive = shouldEnforceStarterToolGate(bundle) && !game.operations.facilities.storageOwned;

  return (
    <section className="tab-panel store-tab">
      {!atStorage ? <p className="notice-banner">Return to storage before using the tool bench.</p> : null}
      {starterGateActive ? (
        <p className="notice-banner">Truck-only mode: buy all starter tools, then open storage to unlock full tool access.</p>
      ) : null}
      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <h2>Storage</h2>
          </div>
          <span className="chip">Cash {formatNumberByAccountingClarity(game, game.player.cash, { currency: true })}</span>
        </div>
        <SegmentedControl value={storeSection} options={storeSections} onChange={setStoreSection} label="Storage sections" />
      </article>

      {storeSection === "tools" ? (
        <div className="stack-list">
          {bundle.tools.map((tool) => {
            const owned = game.player.tools[tool.id];
            const canRepair = Boolean(owned && owned.durability < tool.maxDurability);
            const blockedByStarterGate = starterGateActive && !isStarterToolId(tool.id);
            const expanded = expandedToolId === tool.id;
            return (
              <article key={tool.id} className="chrome-card inset-card tool-card">
                <div className="section-label-row">
                  <div>
                    <p className="eyebrow">Tool Rack</p>
                    <h3>{tool.name}</h3>
                  </div>
                  <button className="summary-toggle" onClick={() => setExpandedToolId(expanded ? null : tool.id)}>
                    {expanded ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="metric-grid two-up">
                  <span>Price ${tool.price}</span>
                  <span>Durability {owned ? `${owned.durability}/${tool.maxDurability}` : "not owned"}</span>
                </div>
                {expanded ? <p className="muted-copy">{obfuscateReadableText(game, tool.flavor.description, `tool:${tool.id}:desc`)}</p> : null}
                <div className="action-row">
                  <button className="primary-button" onClick={() => buyTool(tool.id)} disabled={!atStorage || blockedByStarterGate}>
                    Buy
                  </button>
                  <button className="ghost-button" onClick={() => repairTool(tool.id)} disabled={!atStorage || !canRepair || blockedByStarterGate}>
                    Repair
                  </button>
                </div>
                {blockedByStarterGate ? <p className="muted-copy">Requires Storage unlock.</p> : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {storeSection === "stock" ? (
        <article className="hero-card chrome-card">
          <p className="eyebrow">Storage Stock</p>
          <h3>Storage Supplies</h3>
          <div className="chip-grid">
            {Object.entries(game.shopSupplies)
              .filter(([, stack]) => SUPPLY_QUALITIES.some((quality) => (stack?.[quality] ?? 0) > 0))
              .map(([supplyId, stack]) => (
                <span key={supplyId} className="chip large-chip">
                  {supplyId} {SUPPLY_QUALITIES.filter((quality) => (stack?.[quality] ?? 0) > 0)
                    .map((quality) => `${formatSupplyQuality(quality)} x${stack?.[quality]}`)
                    .join(", ")}
                </span>
              ))}
          </div>
          {Object.entries(game.shopSupplies).every(([, stack]) => SUPPLY_QUALITIES.every((quality) => (stack?.[quality] ?? 0) <= 0)) ? (
            <p className="muted-copy">No stock on hand.</p>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
