import { useState } from "react";
import { GameState } from "../../core/types";
import { ticksToHours } from "../../core/playerFlow";
import { bundle, useUiStore } from "../state";
import { GameTabId } from "../state";

const tabLabels: Record<GameTabId, string> = {
  work: "Work",
  contracts: "Contracts",
  store: "Store",
  company: "Company"
};

interface CompactHeaderProps {
  game: GameState;
  activeTab: GameTabId;
}

export function CompactHeader({ game, activeTab }: CompactHeaderProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const openModal = useUiStore((state) => state.openModal);
  const remainingHours = ticksToHours(Math.max(0, game.workday.availableTicks - game.workday.ticksSpent));
  const totalHours = ticksToHours(game.workday.availableTicks);
  const overtimeHours = ticksToHours(Math.max(0, game.workday.maxOvertime - game.workday.overtimeUsed));
  const activeEventCount = game.activeEventIds.length;

  return (
    <header className="compact-header chrome-card">
      <div className="section-label-row header-summary-row">
        <button
          type="button"
          className="summary-toggle summary-toggle-block"
          aria-label={`Toggle workday details for Day ${game.day}`}
          aria-expanded={detailsOpen}
          aria-controls="workday-status-panel"
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span className="summary-toggle-copy header-summary-copy">
            <span className="eyebrow">{tabLabels[activeTab]}</span>
            <h1 className="summary-toggle-title">Day {game.day}</h1>
            <span className="header-subtitle">{game.workday.weekday} shift</span>
          </span>
          <span className="chip">{detailsOpen ? "Hide" : "Show"}</span>
        </button>
        <button type="button" className="ghost-button hud-button" onClick={() => openModal("active-events")}>
          Active Events {activeEventCount}
        </button>
      </div>
      <div
        id="workday-status-panel"
        className={detailsOpen ? "collapsible-panel open" : "collapsible-panel"}
        aria-hidden={!detailsOpen}
      >
        <div className="status-strip" role="list" aria-label="Current status">
          <span role="listitem">Cash ${game.player.cash}</span>
          <span role="listitem">Rep {game.player.reputation}</span>
          <span role="listitem">Fuel {game.player.fuel}/{game.player.fuelMax}</span>
          <span role="listitem">
            {bundle.strings.hoursLabel} {remainingHours.toFixed(1)}/{totalHours.toFixed(1)}
          </span>
          <span role="listitem">
            {bundle.strings.overtimeLabel} {overtimeHours.toFixed(1)}
          </span>
        </div>
      </div>
    </header>
  );
}
