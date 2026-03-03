import { DayLog, GameState, OfficeSkillsState, OperationsState, YardState } from "./types";
import { advanceResearchProgress, normalizeResearchState } from "./research";

export interface DailyBillBreakdown {
  officeRent: number;
  truckPayment: number;
  electric: number;
  waterSewage: number;
  dumpsterBase: number;
  accountantSalary: number;
  utilityDiscount: number;
  total: number;
  lateFee: number;
  repPenalty: number;
}

export interface EndDayOperationsResult {
  dayLog: DayLog[];
  bills: DailyBillBreakdown;
}

export interface AccountantHireResult {
  ok: boolean;
  notice: string;
}

export interface DumpsterEmptyResult {
  ok: boolean;
  notice: string;
  cost: number;
}

export interface OfficeSkillXpDelta {
  reading?: number;
  accounting?: number;
}

const READING_XP_DAILY_CAP = 30;
const ACCOUNTING_XP_DAILY_CAP = 20;
const ACCOUNTANT_HIRE_COST = 240;
const ACCOUNTANT_SALARY = 12;
const DUMPSTER_CAPACITY_DEFAULT = 50;

const BILL_BASES = {
  officeRent: 18,
  truckPayment: 20,
  electric: 6,
  waterSewage: 5,
  dumpsterBase: 4
} as const;

export function createInitialOfficeSkillsState(): OfficeSkillsState {
  return {
    readingXp: 60,
    accountingXp: 50,
    readingXpToday: 0,
    accountingXpToday: 0
  };
}

export function createInitialYardState(): YardState {
  return {
    dumpsterUnits: 0,
    dumpsterCapacity: DUMPSTER_CAPACITY_DEFAULT,
    emptiesPerformed: 0
  };
}

export function createInitialOperationsState(): OperationsState {
  return {
    accountantHired: false,
    accountantHireDay: null,
    lastDailyBillsDay: 0
  };
}

export function createLegacyOfficeSkillsState(): OfficeSkillsState {
  return {
    readingXp: 180,
    accountingXp: 180,
    readingXpToday: 0,
    accountingXpToday: 0
  };
}

export function createLegacyYardState(): YardState {
  return {
    dumpsterUnits: 0,
    dumpsterCapacity: DUMPSTER_CAPACITY_DEFAULT,
    emptiesPerformed: 0
  };
}

export function createLegacyOperationsState(currentDay: number): OperationsState {
  return {
    accountantHired: false,
    accountantHireDay: null,
    lastDailyBillsDay: Math.max(0, currentDay - 1)
  };
}

export function normalizeOfficeSkillsState(state: Partial<OfficeSkillsState> | null | undefined, legacyDefaults = false): OfficeSkillsState {
  const base = legacyDefaults ? createLegacyOfficeSkillsState() : createInitialOfficeSkillsState();
  return {
    readingXp: Math.max(0, state?.readingXp ?? base.readingXp),
    accountingXp: Math.max(0, state?.accountingXp ?? base.accountingXp),
    readingXpToday: Math.max(0, state?.readingXpToday ?? base.readingXpToday),
    accountingXpToday: Math.max(0, state?.accountingXpToday ?? base.accountingXpToday)
  };
}

export function normalizeYardState(state: Partial<YardState> | null | undefined, legacyDefaults = false): YardState {
  const base = legacyDefaults ? createLegacyYardState() : createInitialYardState();
  return {
    dumpsterUnits: Math.max(0, Math.floor(state?.dumpsterUnits ?? base.dumpsterUnits)),
    dumpsterCapacity: Math.max(1, Math.floor(state?.dumpsterCapacity ?? base.dumpsterCapacity)),
    emptiesPerformed: Math.max(0, Math.floor(state?.emptiesPerformed ?? base.emptiesPerformed))
  };
}

export function normalizeOperationsState(
  state: Partial<OperationsState> | null | undefined,
  currentDay: number,
  legacyDefaults = false
): OperationsState {
  const base = legacyDefaults ? createLegacyOperationsState(currentDay) : createInitialOperationsState();
  return {
    accountantHired: Boolean(state?.accountantHired ?? base.accountantHired),
    accountantHireDay: state?.accountantHireDay ?? base.accountantHireDay,
    lastDailyBillsDay: Math.max(0, Math.floor(state?.lastDailyBillsDay ?? base.lastDailyBillsDay))
  };
}

export function awardOfficeSkillXp(state: GameState, delta: OfficeSkillXpDelta): void {
  if (delta.reading && delta.reading > 0) {
    const availableReading = Math.max(0, READING_XP_DAILY_CAP - state.officeSkills.readingXpToday);
    const grant = Math.min(delta.reading, availableReading);
    if (grant > 0) {
      state.officeSkills.readingXp += grant;
      state.officeSkills.readingXpToday += grant;
    }
  }
  if (delta.accounting && delta.accounting > 0) {
    const availableAccounting = Math.max(0, ACCOUNTING_XP_DAILY_CAP - state.officeSkills.accountingXpToday);
    const grant = Math.min(delta.accounting, availableAccounting);
    if (grant > 0) {
      state.officeSkills.accountingXp += grant;
      state.officeSkills.accountingXpToday += grant;
    }
  }
}

export function resetOfficeSkillDailyCaps(state: GameState): void {
  state.officeSkills.readingXpToday = 0;
  state.officeSkills.accountingXpToday = 0;
}

export function hireAccountant(state: GameState): AccountantHireResult {
  if (state.operations.accountantHired) {
    return { ok: false, notice: "Accountant is already on staff." };
  }
  if (state.player.cash < ACCOUNTANT_HIRE_COST) {
    return { ok: false, notice: `Need $${ACCOUNTANT_HIRE_COST - state.player.cash} more to hire an accountant.` };
  }

  state.player.cash -= ACCOUNTANT_HIRE_COST;
  state.operations.accountantHired = true;
  state.operations.accountantHireDay = state.day;
  return { ok: true, notice: `Hired accountant for $${ACCOUNTANT_HIRE_COST}.` };
}

export function getDumpsterServiceCost(dumpsterUnits: number): number {
  return 22 + Math.max(0, Math.floor(dumpsterUnits)) * 2;
}

export function emptyDumpster(state: GameState): DumpsterEmptyResult {
  if (state.yard.dumpsterUnits <= 0) {
    return { ok: false, notice: "Dumpster is already empty.", cost: 0 };
  }
  const cost = getDumpsterServiceCost(state.yard.dumpsterUnits);
  state.player.cash -= cost;
  state.yard.dumpsterUnits = 0;
  state.yard.emptiesPerformed += 1;
  return { ok: true, notice: `Dumpster emptied for $${cost}.`, cost };
}

export function applyEndDayOperations(state: GameState): EndDayOperationsResult {
  if (state.operations.lastDailyBillsDay === state.day) {
    return {
      dayLog: [],
      bills: emptyBillBreakdown()
    };
  }

  const dayLog: DayLog[] = [];
  const playerId = state.player.actorId;

  const research = normalizeResearchState(state.research, false);
  state.research = research;
  const researchAdvance = advanceResearchProgress(state);
  for (const line of researchAdvance.logLines) {
    dayLog.push({
      day: state.day,
      actorId: playerId,
      message: line
    });
  }

  const scale = 1 + 0.1 * Math.max(0, state.player.companyLevel - 1);
  const officeRent = Math.round(BILL_BASES.officeRent * scale);
  const truckPayment = Math.round(BILL_BASES.truckPayment * scale);
  const electricRaw = Math.round(BILL_BASES.electric * scale);
  const waterSewageRaw = Math.round(BILL_BASES.waterSewage * scale);
  const dumpsterBaseRaw = Math.round(BILL_BASES.dumpsterBase * scale);
  const utilityRawTotal = electricRaw + waterSewageRaw + dumpsterBaseRaw;
  const utilityDiscount = state.operations.accountantHired ? Math.round(utilityRawTotal * 0.1) : 0;
  const utilityAdjustedTotal = utilityRawTotal - utilityDiscount;
  const utilityScale = utilityRawTotal > 0 ? utilityAdjustedTotal / utilityRawTotal : 1;
  const electric = Math.max(0, Math.round(electricRaw * utilityScale));
  const waterSewage = Math.max(0, Math.round(waterSewageRaw * utilityScale));
  const dumpsterBase = Math.max(0, utilityAdjustedTotal - electric - waterSewage);
  const accountantSalary = state.operations.accountantHired ? ACCOUNTANT_SALARY : 0;
  const total = officeRent + truckPayment + electric + waterSewage + dumpsterBase + accountantSalary;

  state.player.cash -= total;
  awardOfficeSkillXp(state, { accounting: 2 });
  let lateFee = 0;
  let repPenalty = 0;
  if (state.player.cash < 0) {
    lateFee = Math.max(6, Math.round(Math.abs(state.player.cash) * 0.08));
    state.player.cash -= lateFee;
    const reputationBefore = state.player.reputation;
    state.player.reputation = Math.max(0, state.player.reputation - 1);
    repPenalty = state.player.reputation - reputationBefore;
  }
  state.operations.lastDailyBillsDay = state.day;

  dayLog.push(
    {
      day: state.day,
      actorId: playerId,
      message: `Bill office rent: $${officeRent}.`
    },
    {
      day: state.day,
      actorId: playerId,
      message: `Bill truck payment: $${truckPayment}.`
    },
    {
      day: state.day,
      actorId: playerId,
      message: `Bill electric: $${electric}.`
    },
    {
      day: state.day,
      actorId: playerId,
      message: `Bill water/sewage: $${waterSewage}.`
    },
    {
      day: state.day,
      actorId: playerId,
      message: `Bill dumpster base: $${dumpsterBase}.`
    }
  );
  if (accountantSalary > 0) {
    dayLog.push({
      day: state.day,
      actorId: playerId,
      message: `Bill accountant salary: $${accountantSalary}.`
    });
  }
  if (utilityDiscount > 0) {
    dayLog.push({
      day: state.day,
      actorId: playerId,
      message: `Accountant utility discount: -$${utilityDiscount}.`
    });
  }
  dayLog.push({
    day: state.day,
    actorId: playerId,
    message: `Daily bills total: $${total}.`
  });
  if (lateFee > 0) {
    dayLog.push({
      day: state.day,
      actorId: playerId,
      message: `Late fee applied: $${lateFee}.`
    });
    dayLog.push({
      day: state.day,
      actorId: playerId,
      message: `Credit strain rep ${repPenalty}.`
    });
  }

  return {
    dayLog,
    bills: {
      officeRent,
      truckPayment,
      electric,
      waterSewage,
      dumpsterBase,
      accountantSalary,
      utilityDiscount,
      total,
      lateFee,
      repPenalty
    }
  };
}

function emptyBillBreakdown(): DailyBillBreakdown {
  return {
    officeRent: 0,
    truckPayment: 0,
    electric: 0,
    waterSewage: 0,
    dumpsterBase: 0,
    accountantSalary: 0,
    utilityDiscount: 0,
    total: 0,
    lateFee: 0,
    repPenalty: 0
  };
}
