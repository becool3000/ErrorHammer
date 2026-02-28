import { ActionSummary } from "../state";
import { DayLog, GameState } from "../../core/types";

interface DayReportProps {
  game: GameState;
  lastAction: ActionSummary | null;
}

export function DayReport({ game, lastAction }: DayReportProps) {
  const lines = game.log.slice(-12).reverse();

  return (
    <section className="card report">
      <h2>Field Log</h2>
      {lastAction ? (
        <div className="list-item">
          <strong>{lastAction.title}</strong>
          <p>Digest: {lastAction.digest}</p>
          {lastAction.lines.map((line, index) => (
            <p key={`${lastAction.digest}-${index}`}>{line}</p>
          ))}
        </div>
      ) : null}
      <div className="list">
        {lines.map((entry, index) => (
          <LogLine key={`${entry.day}-${entry.actorId}-${entry.taskId ?? "none"}-${index}`} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function LogLine({ entry }: { entry: DayLog }) {
  return (
    <article className="list-item">
      <p>
        Day {entry.day} | {entry.actorId}
        {entry.taskId ? ` | ${entry.taskId}` : ""}
      </p>
      <p>{entry.message}</p>
    </article>
  );
}
