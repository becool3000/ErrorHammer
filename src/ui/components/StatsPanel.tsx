import { ActorState, ContractInstance, EventDef, JobDef } from "../../core/types";

interface StatsPanelProps {
  day: number;
  player: ActorState;
  activeEvents: EventDef[];
}

export function StatsPanel({ day, player, activeEvents }: StatsPanelProps) {
  return (
    <section className="card">
      <h2>Stats</h2>
      <p>Day: {day}</p>
      <p>Cash: ${player.cash}</p>
      <p>Rep: {player.reputation}</p>
      <p>
        Stamina: {player.stamina}/{player.staminaMax}
      </p>
      <p>Events: {activeEvents.map((event) => event.name).join(", ") || "None"}</p>
      <p>Contracts visible: {player.districtUnlocks.join(", ")}</p>
    </section>
  );
}