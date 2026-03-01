import { useState } from "react";
import { bundle, StoreSectionId, useUiStore } from "../state";
import { SegmentedControl } from "../components/SegmentedControl";

const storeSections: Array<{ id: StoreSectionId; label: string }> = [
  { id: "fuel", label: "Fuel" },
  { id: "tools", label: "Tools" },
  { id: "stock", label: "Stock" }
];

export function StoreTab() {
  const game = useUiStore((state) => state.game);
  const storeSection = useUiStore((state) => state.storeSection);
  const setStoreSection = useUiStore((state) => state.setStoreSection);
  const buyFuel = useUiStore((state) => state.buyFuel);
  const buyTool = useUiStore((state) => state.buyTool);
  const repairTool = useUiStore((state) => state.repairTool);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  if (!game) {
    return null;
  }

  const atShop = !game.activeJob || game.activeJob.location === "shop";

  return (
    <section className="tab-panel store-tab">
      {!atShop ? <p className="notice-banner">Return to the shop before using the tool bench.</p> : null}
      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Supply Node</p>
            <h2>{bundle.strings.storeTitle}</h2>
          </div>
          <span className="chip">Cash ${game.player.cash}</span>
        </div>
        <SegmentedControl value={storeSection} options={storeSections} onChange={setStoreSection} label="Store sections" />
      </article>

      {storeSection === "fuel" ? (
        <article className="hero-card chrome-card">
          <p className="eyebrow">Fuel Pump</p>
          <h3>
            Fuel {game.player.fuel}/{game.player.fuelMax}
          </h3>
          <div className="metric-grid two-up">
            <span>Unit price $6</span>
            <span>Tank room {Math.max(0, game.player.fuelMax - game.player.fuel)}</span>
          </div>
          <div className="action-row">
            <button className="primary-button" onClick={() => buyFuel(1)} disabled={!atShop}>
              Buy 1 Fuel
            </button>
            <button className="ghost-button" onClick={() => buyFuel(game.player.fuelMax - game.player.fuel)} disabled={!atShop}>
              Fill Tank
            </button>
          </div>
        </article>
      ) : null}

      {storeSection === "tools" ? (
        <div className="stack-list">
          {bundle.tools.map((tool) => {
            const owned = game.player.tools[tool.id];
            const canRepair = Boolean(owned && owned.durability < tool.maxDurability);
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
                {expanded ? <p className="muted-copy">{tool.flavor.description}</p> : null}
                <div className="action-row">
                  <button className="primary-button" onClick={() => buyTool(tool.id)} disabled={!atShop}>
                    Buy
                  </button>
                  <button className="ghost-button" onClick={() => repairTool(tool.id)} disabled={!atShop || !canRepair}>
                    Repair
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {storeSection === "stock" ? (
        <article className="hero-card chrome-card">
          <p className="eyebrow">Shop Stock</p>
          <h3>{bundle.strings.homeSuppliesTitle}</h3>
          <div className="chip-grid">
            {Object.entries(game.shopSupplies)
              .filter(([, quantity]) => quantity > 0)
              .map(([supplyId, quantity]) => (
                <span key={supplyId} className="chip large-chip">
                  {supplyId} x{quantity}
                </span>
              ))}
          </div>
          {Object.entries(game.shopSupplies).every(([, quantity]) => quantity <= 0) ? <p className="muted-copy">No stock on hand.</p> : null}
        </article>
      ) : null}
    </section>
  );
}
