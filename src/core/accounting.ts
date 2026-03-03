import { GameState } from "./types";

export interface AccountingCategoryTotals {
  payoutIncome: number;
  dayLaborIncome: number;
  supplyExpense: number;
  fuelExpense: number;
  quickBuyExpense: number;
  toolExpense: number;
  repairExpense: number;
  researchExpense: number;
  officeRentExpense: number;
  truckPaymentExpense: number;
  electricExpense: number;
  waterSewageExpense: number;
  dumpsterBaseExpense: number;
  accountantSalaryExpense: number;
  lateFeeExpense: number;
  accountantHireExpense: number;
  dumpsterServiceExpense: number;
}

export interface AccountingJobLedgerRow {
  day: number;
  jobName: string;
  payout: number;
  costs: number;
  profit: number;
  outcome: "success" | "neutral" | "fail" | "unknown";
  quality: "low" | "medium" | "high" | "n/a";
}

export interface AccountingSnapshot {
  categories: AccountingCategoryTotals;
  totalIncome: number;
  totalExpenses: number;
  netFromLogs: number;
  cashDrift: number;
  jobRows: AccountingJobLedgerRow[];
}

interface PendingJob {
  day: number;
  jobName: string;
  costs: number;
  quality: "low" | "medium" | "high" | "n/a";
}

const STARTING_CASH = 300;

export function getAccountingSnapshot(state: GameState, limit = 80): AccountingSnapshot {
  const categories: AccountingCategoryTotals = {
    payoutIncome: 0,
    dayLaborIncome: 0,
    supplyExpense: 0,
    fuelExpense: 0,
    quickBuyExpense: 0,
    toolExpense: 0,
    repairExpense: 0,
    researchExpense: 0,
    officeRentExpense: 0,
    truckPaymentExpense: 0,
    electricExpense: 0,
    waterSewageExpense: 0,
    dumpsterBaseExpense: 0,
    accountantSalaryExpense: 0,
    lateFeeExpense: 0,
    accountantHireExpense: 0,
    dumpsterServiceExpense: 0
  };
  const pendingJobsByActor = new Map<string, PendingJob>();
  const jobRows: AccountingJobLedgerRow[] = [];

  for (const logEntry of state.log) {
    if (logEntry.actorId !== state.player.actorId) {
      continue;
    }
    const message = logEntry.message;

    const acceptedMatch = message.match(/^Accepted (.+) for \$([0-9]+)\./i);
    if (acceptedMatch) {
      pendingJobsByActor.set(logEntry.actorId, {
        day: logEntry.day,
        jobName: acceptedMatch[1] ?? "Unknown Job",
        costs: 0,
        quality: "n/a"
      });
      continue;
    }

    const qualityMatch = message.match(/Parts quality settled at (low|medium|high)/i);
    if (qualityMatch) {
      const pending = pendingJobsByActor.get(logEntry.actorId);
      if (pending) {
        pending.quality = (qualityMatch[1]?.toLowerCase() as PendingJob["quality"]) ?? "n/a";
        pendingJobsByActor.set(logEntry.actorId, pending);
      }
    }

    const supplyMatch = message.match(/Checked out supplies for \$([0-9]+)\./i);
    if (supplyMatch) {
      const amount = parseMoneyCapture(supplyMatch[1]);
      categories.supplyExpense += amount;
      addExpenseToPendingJob(pendingJobsByActor.get(logEntry.actorId), amount);
      continue;
    }

    const quickBuyMatch = message.match(/quick bought .+ for \$([0-9]+)\./i);
    if (quickBuyMatch) {
      const amount = parseMoneyCapture(quickBuyMatch[1]);
      categories.quickBuyExpense += amount;
      addExpenseToPendingJob(pendingJobsByActor.get(logEntry.actorId), amount);
      continue;
    }

    const fuelBuyMatch = message.match(/Bought [0-9]+ fuel for \$([0-9]+)\./i);
    if (fuelBuyMatch) {
      const amount = parseMoneyCapture(fuelBuyMatch[1]);
      categories.fuelExpense += amount;
      addExpenseToPendingJob(pendingJobsByActor.get(logEntry.actorId), amount);
      continue;
    }

    const gasStationMatch = message.match(/Ran a gas-station stop for [0-9]+ fuel(?: on account)? \(\$([0-9]+)\)\./i);
    if (gasStationMatch) {
      const amount = parseMoneyCapture(gasStationMatch[1]);
      categories.fuelExpense += amount;
      addExpenseToPendingJob(pendingJobsByActor.get(logEntry.actorId), amount);
      continue;
    }

    const toolBuyMatch = message.match(/Bought .+ for \$([0-9]+)\./i);
    if (toolBuyMatch && !message.toLowerCase().includes("fuel")) {
      const amount = parseMoneyCapture(toolBuyMatch[1]);
      categories.toolExpense += amount;
      addExpenseToPendingJob(pendingJobsByActor.get(logEntry.actorId), amount);
      continue;
    }

    const repairMatch = message.match(/Repaired .+ for \$([0-9]+)\./i);
    if (repairMatch) {
      const amount = parseMoneyCapture(repairMatch[1]);
      categories.repairExpense += amount;
      addExpenseToPendingJob(pendingJobsByActor.get(logEntry.actorId), amount);
      continue;
    }

    const researchMatch = message.match(/^Research started: .+ for \$([0-9]+)\./i);
    if (researchMatch) {
      categories.researchExpense += parseMoneyCapture(researchMatch[1]);
      continue;
    }

    const hireAccountantMatch = message.match(/^Hired accountant for \$([0-9]+)\./i);
    if (hireAccountantMatch) {
      categories.accountantHireExpense += parseMoneyCapture(hireAccountantMatch[1]);
      continue;
    }

    const dumpsterServiceMatch = message.match(/^Dumpster emptied for \$([0-9]+)\./i);
    if (dumpsterServiceMatch) {
      categories.dumpsterServiceExpense += parseMoneyCapture(dumpsterServiceMatch[1]);
      continue;
    }

    const officeRentMatch = message.match(/^Bill office rent: \$([0-9]+)\./i);
    if (officeRentMatch) {
      categories.officeRentExpense += parseMoneyCapture(officeRentMatch[1]);
      continue;
    }

    const truckPaymentMatch = message.match(/^Bill truck payment: \$([0-9]+)\./i);
    if (truckPaymentMatch) {
      categories.truckPaymentExpense += parseMoneyCapture(truckPaymentMatch[1]);
      continue;
    }

    const electricMatch = message.match(/^Bill electric: \$([0-9]+)\./i);
    if (electricMatch) {
      categories.electricExpense += parseMoneyCapture(electricMatch[1]);
      continue;
    }

    const waterMatch = message.match(/^Bill water\/sewage: \$([0-9]+)\./i);
    if (waterMatch) {
      categories.waterSewageExpense += parseMoneyCapture(waterMatch[1]);
      continue;
    }

    const dumpsterBaseMatch = message.match(/^Bill dumpster base: \$([0-9]+)\./i);
    if (dumpsterBaseMatch) {
      categories.dumpsterBaseExpense += parseMoneyCapture(dumpsterBaseMatch[1]);
      continue;
    }

    const salaryMatch = message.match(/^Bill accountant salary: \$([0-9]+)\./i);
    if (salaryMatch) {
      categories.accountantSalaryExpense += parseMoneyCapture(salaryMatch[1]);
      continue;
    }

    const lateFeeMatch = message.match(/^Late fee applied: \$([0-9]+)\./i);
    if (lateFeeMatch) {
      categories.lateFeeExpense += parseMoneyCapture(lateFeeMatch[1]);
      continue;
    }

    const dayLaborMatch = message.match(/worked a day-labor shift .+ earned \$([0-9]+)\./i);
    if (dayLaborMatch) {
      const payout = parseMoneyCapture(dayLaborMatch[1]);
      categories.dayLaborIncome += payout;
      jobRows.push({
        day: logEntry.day,
        jobName: "Day Laborer",
        payout,
        costs: 0,
        profit: payout,
        outcome: "success",
        quality: "n/a"
      });
      continue;
    }

    const payoutMatch = message.match(/Collected (success|neutral|fail) payment: cash ([+-]?[0-9]+)/i);
    if (payoutMatch) {
      const outcome = (payoutMatch[1]?.toLowerCase() as AccountingJobLedgerRow["outcome"]) ?? "unknown";
      const payout = parseSignedNumberCapture(payoutMatch[2]);
      categories.payoutIncome += payout;
      const pending = pendingJobsByActor.get(logEntry.actorId);
      const costs = pending?.costs ?? 0;
      jobRows.push({
        day: pending?.day ?? logEntry.day,
        jobName: pending?.jobName ?? "Unknown Job",
        payout,
        costs,
        profit: payout - costs,
        outcome,
        quality: pending?.quality ?? "n/a"
      });
      pendingJobsByActor.delete(logEntry.actorId);
      continue;
    }

    const halfPayMatch = message.match(/Job completed at low quality\. Client approved half pay: cash \+([0-9]+)/i);
    if (halfPayMatch) {
      const payout = parseMoneyCapture(halfPayMatch[1]);
      categories.payoutIncome += payout;
      const pending = pendingJobsByActor.get(logEntry.actorId);
      const costs = pending?.costs ?? 0;
      jobRows.push({
        day: pending?.day ?? logEntry.day,
        jobName: pending?.jobName ?? "Unknown Job",
        payout,
        costs,
        profit: payout - costs,
        outcome: "neutral",
        quality: pending?.quality ?? "low"
      });
      pendingJobsByActor.delete(logEntry.actorId);
    }
  }

  const totalIncome = categories.payoutIncome + categories.dayLaborIncome;
  const totalExpenses =
    categories.supplyExpense +
    categories.fuelExpense +
    categories.quickBuyExpense +
    categories.toolExpense +
    categories.repairExpense +
    categories.researchExpense +
    categories.officeRentExpense +
    categories.truckPaymentExpense +
    categories.electricExpense +
    categories.waterSewageExpense +
    categories.dumpsterBaseExpense +
    categories.accountantSalaryExpense +
    categories.lateFeeExpense +
    categories.accountantHireExpense +
    categories.dumpsterServiceExpense;
  const netFromLogs = totalIncome - totalExpenses;
  const observedCashDelta = state.player.cash - STARTING_CASH;
  const cashDrift = observedCashDelta - netFromLogs;

  return {
    categories,
    totalIncome,
    totalExpenses,
    netFromLogs,
    cashDrift,
    jobRows: jobRows.slice(-limit).reverse()
  };
}

function addExpenseToPendingJob(pending: PendingJob | undefined, amount: number): void {
  if (!pending) {
    return;
  }
  pending.costs += amount;
}

function parseMoneyCapture(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseSignedNumberCapture(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
