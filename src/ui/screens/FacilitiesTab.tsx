import { useEffect, useRef, useState } from "react";
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
  const starterKitTrackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollStarterKitLeft, setCanScrollStarterKitLeft] = useState(false);
  const [canScrollStarterKitRight, setCanScrollStarterKitRight] = useState(false);
  const game = useUiStore((state) => state.game);
  const openStorage = useUiStore((state) => state.openStorage);
  const upgradeBusinessTier = useUiStore((state) => state.upgradeBusinessTier);
  const enableDumpsterService = useUiStore((state) => state.enableDumpsterService);
  const closeOfficeManually = useUiStore((state) => state.closeOfficeManually);
  const closeYardManually = useUiStore((state) => state.closeYardManually);

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
      ? "Yard"
      : operations.businessTier === "office"
        ? "Office"
        : operations.facilities.storageOwned
          ? "Storage"
          : "Truck";
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
  useEffect(() => {
    syncStarterKitScrollState();
  }, [starterKit.total, starterKit.owned]);

  useEffect(() => {
    const onResize = () => syncStarterKitScrollState();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function syncStarterKitScrollState() {
    const track = starterKitTrackRef.current;
    if (!track) {
      setCanScrollStarterKitLeft(false);
      setCanScrollStarterKitRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanScrollStarterKitLeft(track.scrollLeft > 4);
    setCanScrollStarterKitRight(track.scrollLeft < maxScrollLeft - 4);
  }

  function nudgeStarterKit(direction: "left" | "right") {
    const track = starterKitTrackRef.current;
    if (!track) {
      return;
    }
    const delta = Math.max(180, Math.floor(track.clientWidth * 0.72)) * (direction === "left" ? -1 : 1);
    track.scrollBy({ left: delta, behavior: "smooth" });
    window.setTimeout(() => syncStarterKitScrollState(), 200);
  }

  return (
    <section className="tab-panel facilities-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <h2>{facilityTierLabel}</h2>
          <span className="chip">Cash ${game.player.cash}</span>
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
        <div className="starter-kit-carousel-shell">
          <div className="starter-kit-carousel-nav">
            <button
              type="button"
              className="icon-button carousel-arrow"
              aria-label="Scroll starter kit left"
              disabled={!canScrollStarterKitLeft}
              onClick={() => nudgeStarterKit("left")}
            >
              {"<"}
            </button>
            <button
              type="button"
              className="icon-button carousel-arrow"
              aria-label="Scroll starter kit right"
              disabled={!canScrollStarterKitRight}
              onClick={() => nudgeStarterKit("right")}
            >
              {">"}
            </button>
          </div>
          <div ref={starterKitTrackRef} className="chip-grid starter-kit-carousel-track" onScroll={syncStarterKitScrollState}>
            {starterToolRows.map((tool) => (
              <span key={tool.toolId} className={tool.owned ? "chip tone-success" : "chip muted"}>
                {tool.owned ? "Owned" : "Missing"} {tool.label}
              </span>
            ))}
          </div>
        </div>
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <h3>Facility Unlock</h3>
        </div>
        <div className="stack-list facilities-other-options">
          {actions.map((action) => (
            <button key={action.id} className="ghost-button secondary-action-button" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function formatCostLabel(amount: number): string {
  return `$${Math.max(0, Math.round(amount)).toLocaleString("en-US")}`;
}
