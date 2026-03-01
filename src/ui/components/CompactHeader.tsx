import { GameState } from "../../core/types";
import { ticksToHours } from "../../core/playerFlow";
import { bundle } from "../state";
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
  const remainingHours = ticksToHours(Math.max(0, game.workday.availableTicks - game.workday.ticksSpent));
  const totalHours = ticksToHours(game.workday.availableTicks);
  const overtimeHours = ticksToHours(Math.max(0, game.workday.maxOvertime - game.workday.overtimeUsed));

  return (
    <header className="compact-header chrome-card">
      <div>
        <p className="eyebrow">{tabLabels[activeTab]}</p>
        <h1>Day {game.day}</h1>
        <p className="header-subtitle">
          {game.workday.weekday} shift - {game.player.name} @ {game.player.companyName}
        </p>
      </div>
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
    </header>
  );
}
