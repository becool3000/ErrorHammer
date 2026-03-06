import { useEffect, useRef, useState } from "react";
import { GameState } from "../../core/types";
import { ticksToHours } from "../../core/playerFlow";
import { getPerkArchetypeSnapshot } from "../../core/perks";
import { bundle, GameTabId, useUiStore } from "../state";

interface CompactHeaderProps {
  game: GameState;
  activeTab: GameTabId;
}

export function CompactHeader({ game, activeTab }: CompactHeaderProps) {
  const openModal = useUiStore((state) => state.openModal);
  const previousCashRef = useRef<number | null>(null);
  const [cashRaised, setCashRaised] = useState(false);
  const remainingHours = ticksToHours(Math.max(0, game.workday.availableTicks - game.workday.ticksSpent));
  const totalHours = ticksToHours(game.workday.availableTicks);
  const baseHours = ticksToHours(game.workday.ticksPerDay);
  const activeEventCount = game.activeEventIds.length;
  const isFatigued = game.workday.fatigue.debt > 0 || game.workday.availableTicks < game.workday.ticksPerDay;
  const showOperatorHud = activeTab === "work";
  const archetype = getPerkArchetypeSnapshot(game);

  useEffect(() => {
    const previousCash = previousCashRef.current;
    if (previousCash !== null && game.player.cash > previousCash) {
      setCashRaised(true);
      const timeoutId = window.setTimeout(() => setCashRaised(false), 1200);
      previousCashRef.current = game.player.cash;
      return () => window.clearTimeout(timeoutId);
    }
    previousCashRef.current = game.player.cash;
    setCashRaised(false);
    return undefined;
  }, [game.player.cash]);

  return (
    <header className="compact-header chrome-card">
      <div className="header-top-row">
        <div className="header-left-stack">
          {showOperatorHud ? (
            <div className="header-operator-copy">
              <h3>{game.player.name}</h3>
              <p className="muted-copy">{game.player.companyName}</p>
            </div>
          ) : null}
          <div className="header-day-copy">
            <h1 className="header-day-title">Day {game.day}</h1>
            <span className="header-subtitle">{game.workday.weekday} shift</span>
            {showOperatorHud && archetype.primary ? <span className="chip tone-energy">Style {archetype.tags[0] ?? "Core"}</span> : null}
          </div>
        </div>
        <div className="header-top-actions">
          {showOperatorHud ? (
            <div className="header-action-row">
              <button className="hud-link-button" onClick={() => openModal("inventory")}>
                Inventory
              </button>
              <button className="hud-link-button" onClick={() => openModal("skills")}>
                Skills
              </button>
            </div>
          ) : null}
          <button type="button" className="hud-link-button" onClick={() => openModal("active-events")}>
            Active Events {activeEventCount}
          </button>
        </div>
      </div>
      <div className="status-strip header-metric-grid" role="list" aria-label="Player HUD">
        <span role="listitem" className={cashRaised ? "status-metric tone-success" : "status-metric"}>
          <span>Cash</span>
          <strong>${game.player.cash}</strong>
        </span>
        <span role="listitem" className="status-metric tone-info">
          <span>Fuel</span>
          <strong>
            {game.player.fuel}/{game.player.fuelMax}
          </strong>
        </span>
        <span role="listitem" className="status-metric tone-energy">
          <span>{bundle.strings.hoursLabel}</span>
          <strong>
            {remainingHours.toFixed(1)}/{totalHours.toFixed(1)}
          </strong>
        </span>
        <span role="listitem" className={game.workday.fatigue.debt > 0 ? "status-metric tone-danger" : "status-metric"}>
          <span>Fatigue</span>
          <strong>{game.workday.fatigue.debt}</strong>
        </span>
      </div>
      {isFatigued ? (
        <p className="muted-copy">Fatigue from overtime shortens this shift to {totalHours.toFixed(1)} of {baseHours.toFixed(1)} hours.</p>
      ) : null}
    </header>
  );
}


