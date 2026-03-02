import { ActorState, EventDef, WorkdayState } from "../../core/types";
import { formatSkillLabel, getSkillDisplayRows, ticksToHours } from "../../core/playerFlow";
import { bundle } from "../state";

interface StatsPanelProps {
  day: number;
  player: ActorState;
  workday: WorkdayState;
  activeEvents: EventDef[];
}

export function StatsPanel({ day, player, workday, activeEvents }: StatsPanelProps) {
  const topSkills = getSkillDisplayRows(player).slice(0, 5);
  const regularRemainingHours = ticksToHours(Math.max(0, workday.availableTicks - workday.ticksSpent));
  const overtimeRemainingHours = ticksToHours(Math.max(0, workday.maxOvertime - workday.overtimeUsed));

  return (
    <section className="card">
      <h2>Workday</h2>
      <p>
        Day {day} | {workday.weekday}
      </p>
      <p>Cash: ${player.cash}</p>
      <p>Rep: {player.reputation}</p>
      <p>
        Fuel: {player.fuel}/{player.fuelMax}
      </p>
      <p>
        {bundle.strings.hoursLabel} left: {regularRemainingHours.toFixed(1)} | {bundle.strings.overtimeLabel} left:{" "}
        {overtimeRemainingHours.toFixed(1)}
      </p>
      <p>Fatigue debt: {workday.fatigue.debt}</p>
      <p>Events: {activeEvents.map((event) => event.name).join(", ") || "None"}</p>
      <div className="list compact-list">
        {topSkills.map((skill) => (
          <p key={skill.skillId}>
            {formatSkillLabel(skill.skillId)}: level {skill.level} ({skill.xp} xp)
          </p>
        ))}
      </div>
    </section>
  );
}
