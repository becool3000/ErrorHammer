import { useMemo } from "react";
import { getAccountingSnapshot } from "../../core/accounting";
import { useUiStore } from "../state";

export function AccountingTab() {
  const game = useUiStore((state) => state.game);
  const sessionTelemetry = useUiStore((state) => state.sessionTelemetry);
  const snapshot = useMemo(() => (game ? getAccountingSnapshot(game, 24) : null), [game]);

  if (!game || !snapshot) {
    return null;
  }

  const netClass = snapshot.netFromLogs >= 0 ? "tone-success" : "tone-danger";
  const sessionMinutes = Math.max(0, (Date.now() - sessionTelemetry.startedAtMs) / 60000);
  const repsGained = game.player.reputation - sessionTelemetry.startReputation;
  const daysAdvanced = Math.max(0, game.day - sessionTelemetry.startDay);
  const repsPerDay = daysAdvanced > 0 ? repsGained / daysAdvanced : repsGained;
  const interactionsPerMinute = sessionMinutes > 0 ? sessionTelemetry.interactions / sessionMinutes : sessionTelemetry.interactions;

  return (
    <section className="tab-panel accounting-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Accounting</p>
            <h2>Cashflow Ledger</h2>
          </div>
          <span className={`chip ${netClass}`}>Net ${snapshot.netFromLogs}</span>
        </div>
        <p className="muted-copy">Tracks income and costs from logs so you can see exactly where job money went.</p>
      </article>

      <article className="chrome-card inset-card">
        <div className="metric-grid two-up">
          <span className="tone-success">Income ${snapshot.totalIncome}</span>
          <span className="tone-danger">Expenses ${snapshot.totalExpenses}</span>
          <span className={netClass}>Net ${snapshot.netFromLogs}</span>
          <span>Current Cash ${game.player.cash}</span>
          <span>Supplies ${snapshot.categories.supplyExpense}</span>
          <span>Fuel ${snapshot.categories.fuelExpense}</span>
          <span>Quick Buy ${snapshot.categories.quickBuyExpense}</span>
          <span>Tools + Repairs ${snapshot.categories.toolExpense + snapshot.categories.repairExpense}</span>
        </div>
        {snapshot.cashDrift !== 0 ? (
          <p className="muted-copy">
            Untracked cash delta ${snapshot.cashDrift}. This usually means older saves or expenses not logged before the accounting pass.
          </p>
        ) : null}
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <strong>Session Telemetry</strong>
          <span className="chip">{sessionMinutes.toFixed(1)} min</span>
        </div>
        <div className="metric-grid two-up">
          <span>Interactions {sessionTelemetry.interactions}</span>
          <span>End Day presses {sessionTelemetry.endDayPresses}</span>
          <span>Rate {interactionsPerMinute.toFixed(1)} taps/min</span>
          <span>Rep gain {repsGained >= 0 ? "+" : ""}{repsGained}</span>
          <span>Days advanced {daysAdvanced}</span>
          <span>Rep/day {repsPerDay.toFixed(2)}</span>
        </div>
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <strong>Job Profit Breakdown</strong>
          <span className="chip">{snapshot.jobRows.length} rows</span>
        </div>
        {snapshot.jobRows.length === 0 ? <p className="muted-copy">No completed jobs yet.</p> : null}
        <div className="stack-list">
          {snapshot.jobRows.map((row, index) => {
            const profitClass = row.profit >= 0 ? "tone-success" : "tone-danger";
            return (
              <article key={`${row.day}-${row.jobName}-${index}`} className="task-summary">
                <div className="section-label-row tight-row">
                  <strong>{row.jobName}</strong>
                  <span className="chip">Day {row.day}</span>
                </div>
                <div className="material-need-meta">
                  <span>Payout ${row.payout}</span>
                  <span>Costs ${row.costs}</span>
                  <span className={profitClass}>Profit ${row.profit}</span>
                </div>
                <div className="material-need-meta">
                  <span>Outcome {formatOutcome(row.outcome)}</span>
                  <span>Quality {formatQuality(row.quality)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function formatOutcome(outcome: string): string {
  if (outcome === "neutral") {
    return "Low Quality";
  }
  if (outcome === "success") {
    return "Success";
  }
  if (outcome === "fail") {
    return "Fail";
  }
  return "Unknown";
}

function formatQuality(quality: string): string {
  if (quality === "n/a") {
    return "N/A";
  }
  if (quality === "low") {
    return "Low";
  }
  if (quality === "medium") {
    return "Medium";
  }
  if (quality === "high") {
    return "High";
  }
  return "Unknown";
}
