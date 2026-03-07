import { useMemo } from "react";
import { getAccountingSnapshot } from "../../core/accounting";
import { getJobProfitRecap } from "../../core/playerFlow";
import { formatNumberByAccountingClarity, getAccountingClarity } from "../readability";
import { useUiStore } from "../state";

export function AccountingTab() {
  const game = useUiStore((state) => state.game);
  const snapshot = useMemo(() => (game ? getAccountingSnapshot(game, 24) : null), [game]);

  if (!game || !snapshot) {
    return null;
  }

  const accountingClarity = getAccountingClarity(game);
  const showDetailedFinance = accountingClarity >= 0.75;
  const contractRecaps = useMemo(
    () =>
      snapshot.jobRows
        .map((row) => (row.contractId ? getJobProfitRecap(game, row.contractId) : null))
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [game, snapshot.jobRows]
  );
  const netClass = snapshot.netFromLogs >= 0 ? "tone-success" : "tone-danger";
  const nextMonthlyDue = Object.values(game.operations.monthlyDueByCategory).reduce((sum, value) => sum + Math.max(0, value), 0);
  const projectedCashPressure = nextMonthlyDue + game.operations.unpaidBalance + game.deferredJobs.length * 5;
  const highRiskCashGap = projectedCashPressure > game.player.cash * 1.2;

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
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <strong>Monthly Billing</strong>
          <span className="chip">Cycle {game.operations.billingCycleDay}/22</span>
        </div>
        {highRiskCashGap ? (
          <p className="task-inline-notice tone-danger">
            Cash risk: projected due {formatNumberByAccountingClarity(game, projectedCashPressure, { currency: true })} exceeds cash buffer.
          </p>
        ) : null}
        <div className="metric-grid two-up">
          <span>Unpaid {formatNumberByAccountingClarity(game, game.operations.unpaidBalance, { currency: true })}</span>
          <span>Strikes {game.operations.missedBillStrikes}/2</span>
          <span>Tier {game.operations.businessTier}</span>
          <span>Downgrade risk {game.operations.missedBillStrikes >= 1 ? "High" : "Low"}</span>
          <span>Next due {formatNumberByAccountingClarity(game, nextMonthlyDue, { currency: true })}</span>
          <span>Deferred carry/day {formatNumberByAccountingClarity(game, game.deferredJobs.length * 5, { currency: true })}</span>
        </div>
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
          <span>Office Rent {formatNumberByAccountingClarity(game, snapshot.categories.officeRentExpense, { currency: true })}</span>
          <span>Storage Rent {formatNumberByAccountingClarity(game, snapshot.categories.storageRentExpense, { currency: true })}</span>
          <span>Insurance/Admin {formatNumberByAccountingClarity(game, snapshot.categories.insuranceAdminExpense, { currency: true })}</span>
          <span>Truck {formatNumberByAccountingClarity(game, snapshot.categories.truckPaymentExpense, { currency: true })}</span>
          <span>Electric {formatNumberByAccountingClarity(game, snapshot.categories.electricExpense, { currency: true })}</span>
          <span>Water/Sewage {formatNumberByAccountingClarity(game, snapshot.categories.waterSewageExpense, { currency: true })}</span>
          <span>Yard Lease {formatNumberByAccountingClarity(game, snapshot.categories.yardLeaseExpense, { currency: true })}</span>
          <span>Dumpster Base {formatNumberByAccountingClarity(game, snapshot.categories.dumpsterBaseExpense, { currency: true })}</span>
          <span>Late Fees {formatNumberByAccountingClarity(game, snapshot.categories.lateFeeExpense, { currency: true })}</span>
          <span>Deferred Carry {formatNumberByAccountingClarity(game, snapshot.categories.deferredCarryExpense, { currency: true })}</span>
          {showDetailedFinance ? (
            <>
              <span>Accountant Salary {formatNumberByAccountingClarity(game, snapshot.categories.accountantSalaryExpense, { currency: true })}</span>
              <span>Accountant Hire {formatNumberByAccountingClarity(game, snapshot.categories.accountantHireExpense, { currency: true })}</span>
              <span>Research {formatNumberByAccountingClarity(game, snapshot.categories.researchExpense, { currency: true })}</span>
              <span>Dumpster Service {formatNumberByAccountingClarity(game, snapshot.categories.dumpsterServiceExpense, { currency: true })}</span>
              <span>Premium Haul {formatNumberByAccountingClarity(game, snapshot.categories.premiumHaulExpense, { currency: true })}</span>
            </>
          ) : null}
        </div>
        {!showDetailedFinance ? <p className="muted-copy">Improve Accounting clarity to reveal deeper cost lines.</p> : null}
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

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <strong>Estimate vs Actual</strong>
          <span className="chip">{contractRecaps.length} jobs</span>
        </div>
        {contractRecaps.length === 0 ? <p className="muted-copy">No contract recap rows yet.</p> : null}
        <div className="stack-list">
          {contractRecaps.map((row) => (
            <article key={`${row.contractId}:${row.day}`} className="task-summary">
              <div className="section-label-row tight-row">
                <strong>{row.jobName}</strong>
                <span className="chip">Day {row.day}</span>
              </div>
              <div className="material-need-meta">
                <span>Before {formatNumberByAccountingClarity(game, row.estimate.projectedNetOnSuccess, { currency: true, signed: true })}</span>
                <span>After {formatNumberByAccountingClarity(game, row.actual.net, { currency: true, signed: true })}</span>
                <span className={row.deltaNet >= 0 ? "tone-success" : "tone-danger"}>
                  Delta {formatNumberByAccountingClarity(game, row.deltaNet, { currency: true, signed: true })}
                </span>
              </div>
              <p className="muted-copy">{row.summaryLine}</p>
            </article>
          ))}
        </div>
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <strong>Contract Files</strong>
          <span className="chip">{game.contractFiles.length}</span>
        </div>
        {game.contractFiles.length === 0 ? <p className="muted-copy">No contract files yet.</p> : null}
        <div className="stack-list">
          {[...game.contractFiles]
            .sort((left, right) => right.dayAccepted - left.dayAccepted || left.contractId.localeCompare(right.contractId))
            .map((file) => (
              <article key={`${file.contractId}:${file.dayAccepted}`} className="task-summary">
                <div className="section-label-row tight-row">
                  <strong>{file.jobName}</strong>
                  <span className="chip">{formatContractFileStatus(file.status)}</span>
                </div>
                <div className="material-need-meta">
                  <span>Payout {formatNumberByAccountingClarity(game, file.acceptedPayout, { currency: true })}</span>
                  <span>Est Lv {file.estimatingLevelAtBid}</span>
                  <span>Outcome {formatOutcome(file.outcome ?? "n/a")}</span>
                </div>
                <div className="material-need-meta">
                  <span>Hours Est {file.estimatedHoursAtAccept.toFixed(1)}h</span>
                  <span>Actual {file.actualHoursAtClose.toFixed(1)}h</span>
                </div>
                <div className="material-need-meta">
                  <span>Net Est {formatNumberByAccountingClarity(game, file.estimatedNetAtAccept, { currency: true, signed: true })}</span>
                  <span>Net Actual {formatNumberByAccountingClarity(game, file.actualNetAtClose, { currency: true, signed: true })}</span>
                </div>
              </article>
            ))}
        </div>
      </article>
    </section>
  );
}

function formatContractFileStatus(status: string): string {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "deferred") {
    return "Deferred";
  }
  if (status === "abandoned") {
    return "Abandoned";
  }
  if (status === "lost") {
    return "Lost";
  }
  return "Active";
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
  if (outcome === "lost") {
    return "Lost";
  }
  if (outcome === "n/a") {
    return "N/A";
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
