import { ResolverResult } from "../../core/types";

interface DayReportProps {
  result: ResolverResult;
}

export function DayReport({ result }: DayReportProps) {
  return (
    <section className="card report">
      <h2>Day Report</h2>
      <p>Deterministic digest: {result.digest}</p>
      <div className="list">
        {result.resolutions.map((resolution) => (
          <article key={`${resolution.actorId}-${resolution.contractId}`} className="list-item">
            <p>
              {resolution.actorId} | {resolution.contractId} | {resolution.outcome}
            </p>
            <p>
              cash {resolution.cashDelta} | rep {resolution.repDelta} | stamina {resolution.staminaBefore} {"->"}{" "}
              {resolution.staminaAfter}
            </p>
            <p>{resolution.logLine}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
