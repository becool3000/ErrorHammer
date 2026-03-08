import { useState } from "react";
import { isStarterToolId, shouldEnforceStarterToolGate, SUPPLY_QUALITIES, formatSupplyQuality } from "../../core/playerFlow";
import { formatNumberByAccountingClarity, obfuscateReadableText } from "../readability";
import { bundle, StoreSectionId, useUiStore } from "../state";
import { SegmentedControl } from "../components/SegmentedControl";

const storeSections: Array<{ id: StoreSectionId; label: string }> = [
  { id: "tools", label: "Tools" },
  { id: "stock", label: "Supplies" }
];

export function StoreTab() {
  const game = useUiStore((state) => state.game);
  const storeSection = useUiStore((state) => state.storeSection);
  const setStoreSection = useUiStore((state) => state.setStoreSection);
  const buyTool = useUiStore((state) => state.buyTool);
  const repairTool = useUiStore((state) => state.repairTool);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [truckToolsOpen, setTruckToolsOpen] = useState(false);
  const [storageToolsOpen, setStorageToolsOpen] = useState(false);

  if (!game) {
    return null;
  }

  const truckOnlyMode = !game.operations.facilities.storageOwned;
  const atStorage = !game.activeJob || game.activeJob.location === "shop";
  const canUseToolBench = atStorage || truckOnlyMode;
  const starterGateActive = shouldEnforceStarterToolGate(bundle) && !game.operations.facilities.storageOwned;
  const truckTools = bundle.tools.filter((tool) => isStarterToolId(tool.id));
  const storageTools = bundle.tools.filter((tool) => !isStarterToolId(tool.id));
  const ownedTruckTools = truckTools.filter((tool) => Boolean(game.player.tools[tool.id])).length;
  const ownedStorageTools = storageTools.filter((tool) => Boolean(game.player.tools[tool.id])).length;

  return (
    <section className="tab-panel store-tab">
      {!canUseToolBench ? <p className="notice-banner">Return to storage before using the tool bench.</p> : null}
      {starterGateActive ? (
        <p className="notice-banner">Truck-only mode: buy all starter tools, then open storage to unlock full tool access.</p>
      ) : null}
      <article className="chrome-card inset-card">
        <div className="section-label-row store-tab-header">
          <span className="chip">Cash {formatNumberByAccountingClarity(game, game.player.cash, { currency: true })}</span>
        </div>
        <SegmentedControl value={storeSection} options={storeSections} onChange={setStoreSection} label="Store sections" />
      </article>

      {storeSection === "tools" ? (
        <div className="stack-list">
          <article className="chrome-card inset-card tool-group-shell">
            <button
              type="button"
              className="ghost-button tool-group-toggle"
              onClick={() => setTruckToolsOpen((open) => !open)}
              aria-expanded={truckToolsOpen}
              aria-controls="truck-tools-panel"
            >
              <span className="tool-group-toggle-title">Truck Tools</span>
              <span className="chip">
                {ownedTruckTools}/{truckTools.length}
              </span>
            </button>
            <div
              id="truck-tools-panel"
              className={truckToolsOpen ? "collapsible-panel open tool-group-panel" : "collapsible-panel tool-group-panel"}
              aria-hidden={!truckToolsOpen}
            >
              {truckTools.length ? (
                <div className="stack-list">
                  {truckTools.map((tool) => {
                    const owned = game.player.tools[tool.id];
                    const expanded = expandedToolId === tool.id;
                    return (
                      <article key={tool.id} className="tool-card">
                        <div className="section-label-row">
                          <div>
                            <h3>{tool.name}</h3>
                          </div>
                          <button className="summary-toggle" onClick={() => setExpandedToolId(expanded ? null : tool.id)}>
                            {expanded ? "Hide" : "Show"}
                          </button>
                        </div>
                        <div className="metric-grid two-up">
                          <span>Durability {owned ? `${owned.durability}/${tool.maxDurability}` : "not owned"}</span>
                          <span>Price ${tool.price}</span>
                        </div>
                        {expanded ? <p className="muted-copy">{obfuscateReadableText(game, tool.flavor.description, `tool:${tool.id}:desc`)}</p> : null}
                        <div className="action-row">
                          {owned ? (
                            <button className="ghost-button" onClick={() => repairTool(tool.id)} disabled={!canUseToolBench || owned.durability >= tool.maxDurability}>
                              Repair
                            </button>
                          ) : (
                            <button className="primary-button" onClick={() => buyTool(tool.id)} disabled={!canUseToolBench}>
                              Buy
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="muted-copy">No tools on your rack yet.</p>
              )}
            </div>
          </article>
          <article className="chrome-card inset-card tool-group-shell">
            <button
              type="button"
              className="ghost-button tool-group-toggle"
              onClick={() => setStorageToolsOpen((open) => !open)}
              aria-expanded={storageToolsOpen}
              aria-controls="storage-tools-panel"
            >
              <span className="tool-group-toggle-title">Storage Tools</span>
              <span className="chip">
                {ownedStorageTools}/{storageTools.length}
              </span>
            </button>
            <div
              id="storage-tools-panel"
              className={storageToolsOpen ? "collapsible-panel open tool-group-panel" : "collapsible-panel tool-group-panel"}
              aria-hidden={!storageToolsOpen}
            >
              {storageTools.length ? (
                <div className="stack-list">
                  {storageTools.map((tool) => {
                    const blockedByStarterGate = starterGateActive && !isStarterToolId(tool.id);
                    const owned = game.player.tools[tool.id];
                    const expanded = expandedToolId === tool.id;
                    return (
                      <article key={tool.id} className="tool-card">
                        <div className="section-label-row">
                          <div>
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
                          {owned ? (
                            <button className="ghost-button" onClick={() => repairTool(tool.id)} disabled={!canUseToolBench || owned.durability >= tool.maxDurability || blockedByStarterGate}>
                              Repair
                            </button>
                          ) : (
                            <button className="primary-button" onClick={() => buyTool(tool.id)} disabled={!canUseToolBench || blockedByStarterGate}>
                              Buy
                            </button>
                          )}
                        </div>
                        {blockedByStarterGate ? <p className="muted-copy">Requires Storage unlock.</p> : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="muted-copy">No storage-only tools found.</p>
              )}
            </div>
          </article>
        </div>
      ) : null}

      {storeSection === "stock" ? (
        <section className="stack-list">
          <article className="hero-card chrome-card">
            <h3>Truck Supplies</h3>
            <div className="chip-grid">
              {Object.entries(game.truckSupplies)
                .filter(([, stack]) => SUPPLY_QUALITIES.some((quality) => (stack?.[quality] ?? 0) > 0))
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([supplyId, stack]) => (
                  <span key={`truck-${supplyId}`} className="chip large-chip">
                    {supplyId} {SUPPLY_QUALITIES.filter((quality) => (stack?.[quality] ?? 0) > 0)
                      .map((quality) => `${formatSupplyQuality(quality)} x${stack?.[quality]}`)
                      .join(", ")}
                  </span>
                ))}
            </div>
            {Object.entries(game.truckSupplies).every(([, stack]) => SUPPLY_QUALITIES.every((quality) => (stack?.[quality] ?? 0) <= 0)) ? (
              <p className="muted-copy">No truck supplies on hand.</p>
            ) : null}
          </article>
          <article className="hero-card chrome-card">
            <h3>Storage Supplies</h3>
            <div className="chip-grid">
              {Object.entries(game.shopSupplies)
                .filter(([, stack]) => SUPPLY_QUALITIES.some((quality) => (stack?.[quality] ?? 0) > 0))
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([supplyId, stack]) => (
                  <span key={`storage-${supplyId}`} className="chip large-chip">
                    {supplyId} {SUPPLY_QUALITIES.filter((quality) => (stack?.[quality] ?? 0) > 0)
                      .map((quality) => `${formatSupplyQuality(quality)} x${stack?.[quality]}`)
                      .join(", ")}
                  </span>
                ))}
            </div>
            {Object.entries(game.shopSupplies).every(([, stack]) => SUPPLY_QUALITIES.every((quality) => (stack?.[quality] ?? 0) <= 0)) ? (
              <p className="muted-copy">No storage supplies on hand.</p>
            ) : null}
          </article>
        </section>
      ) : null}
    </section>
  );
}
