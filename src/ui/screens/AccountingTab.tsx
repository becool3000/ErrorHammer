import { useMemo } from "react";
import { getAccountingSnapshot } from "../../core/accounting";
import { formatNumberByAccountingClarity, getAccountingClarity } from "../readability";
import { useUiStore } from "../state";

export function AccountingTab() {
  const game = useUiStore((state) => state.game);
  const sessionTelemetry = useUiStore((state) => state.sessionTelemetry);
  const hireAccountant = useUiStore((state) => state.hireAccountant);
  const snapshot = useMemo(() => (game ? getAccountingSnapshot(game, 24) : null), [game]);

  if (!game || !snapshot) {
    return null;
  }

  const accountingClarity = getAccountingClarity(game);
  const showDetailedFinance = accountingClarity >= 0.75 || game.operations.accountantHired;
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
          <span className={`chip ${netClass}`}>Net {formatNumberByAccountingClarity(game, snapshot.netFromLogs, { currency: true, signed: true })}</span>
        </div>
        <p className="muted-copy">Tracks income and costs with bill categories, late fees, and service expenses.</p>
        <div className="metric-grid two-up">
          <span>Accounting XP {Math.round(game.officeSkills.accountingXp)}</span>
          <span>Clarity {(accountingClarity * 100).toFixed(0)}%</span>
        </div>
        <button className="ghost-button" onClick={() => hireAccountant()} disabled={game.operations.accountantHired}>
          {game.operations.accountantHired ? "Accountant On Staff" : "Hire Accountant ($240)"}
        </button>
      </article>

      <article className="chrome-card inset-card">
        <div className="metric-grid two-up">
          <span className="tone-success">Income {formatNumberByAccountingClarity(game, snapshot.totalIncome, { currency: true })}</span>
          <span className="tone-danger">Expenses {formatNumberByAccountingClarity(game, snapshot.totalExpenses, { currency: true })}</span>
          <span className={netClass}>Net {formatNumberByAccountingClarity(game, snapshot.netFromLogs, { currency: true, signed: true })}</span>
          <span>Cash {formatNumberByAccountingClarity(game, game.player.cash, { currency: true, signed: true })}</span>
        </div>
        {snapshot.cashDrift !== 0 ? (
          <p className="muted-copy">
            Untracked cash delta {formatNumberByAccountingClarity(game, snapshot.cashDrift, { currency: true, signed: true })}. This usually means legacy entries.
          </p>
        ) : null}
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <strong>Bill Breakdown</strong>
          <span className="chip">Day {game.day}</span>
        </div>
        <div className="metric-grid two-up">
          <span>Rent {formatNumberByAccountingClarity(game, snapshot.categories.officeRentExpense, { currency: true })}</span>
          <span>Truck {formatNumberByAccountingClarity(game, snapshot.categories.truckPaymentExpense, { currency: true })}</span>
          <span>Electric {formatNumberByAccountingClarity(game, snapshot.categories.electricExpense, { currency: true })}</span>
          <span>Water/Sewage {formatNumberByAccountingClarity(game, snapshot.categories.waterSewageExpense, { currency: true })}</span>
          <span>Dumpster Base {formatNumberByAccountingClarity(game, snapshot.categories.dumpsterBaseExpense, { currency: true })}</span>
          <span>Late Fees {formatNumberByAccountingClarity(game, snapshot.categories.lateFeeExpense, { currency: true })}</span>
          {showDetailedFinance ? (
            <>
              <span>Accountant Salary {formatNumberByAccountingClarity(game, snapshot.categories.accountantSalaryExpense, { currency: true })}</span>
              <span>Accountant Hire {formatNumberByAccountingClarity(game, snapshot.categories.accountantHireExpense, { currency: true })}</span>
              <span>Research {formatNumberByAccountingClarity(game, snapshot.categories.researchExpense, { currency: true })}</span>
              <span>Dumpster Service {formatNumberByAccountingClarity(game, snapshot.categories.dumpsterServiceExpense, { currency: true })}</span>
            </>
          ) : null}
        </div>
        {!showDetailedFinance ? <p className="muted-copy">Improve Accounting clarity or hire an accountant to reveal deeper cost lines.</p> : null}
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
                  <span>Payout {formatNumberByAccountingClarity(game, row.payout, { currency: true })}</span>
                  <span>Costs {formatNumberByAccountingClarity(game, row.costs, { currency: true })}</span>
                  <span className={profitClass}>Profit {formatNumberByAccountingClarity(game, row.profit, { currency: true, signed: true })}</span>
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
