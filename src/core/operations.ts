import {
  BusinessTier,
  DayLog,
  FacilitiesState,
  GameState,
  OfficeSkillsState,
  OperationsState,
  YardState
} from "./types";
import { advanceResearchProgress, normalizeResearchState } from "./research";

export interface MonthlyBillBreakdown {
  truckPayment: number;
  insuranceAdmin: number;
  storageRent: number;
  officeRent: number;
  electric: number;
  waterSewage: number;
  yardLease: number;
  dumpsterBase: number;
  accountantSalary: number;
  subtotal: number;
  previousUnpaid: number;
  totalDue: number;
  paid: number;
  unpaidAfter: number;
  lateFee: number;
  strikeApplied: boolean;
}

export interface EndDayOperationsResult {
  dayLog: DayLog[];
  bills: MonthlyBillBreakdown;
}

export interface AccountantHireResult {
  ok: boolean;
  notice: string;
}

export interface TierUpgradeResult {
  ok: boolean;
  notice: string;
}

export interface DumpsterEnableResult {
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
const ACCOUNTANT_HIRE_COST = 1800;
const ACCOUNTANT_SALARY_MONTHLY = 480;
const ACCOUNTANT_UTILITY_DISCOUNT = 0.1;
const DUMPSTER_CAPACITY_DEFAULT = 40;
const BILLING_CYCLE_LENGTH = 22;
const STORAGE_BUY_IN = 250;
const OFFICE_BUY_IN = 1800;
const YARD_BUY_IN = 1600;
const DUMPSTER_ENABLE_COST = 500;
const DEFERRED_DAILY_CARRY_FEE = 5;
const DEFERRED_EXPIRY_DAYS = 7;

const MONTHLY_BILLS = {
  truckPayment: 450,
  insuranceAdmin: 160,
  storageRent: 150,
  officeRent: 650,
  electric: 95,
  waterSewage: 42,
  yardLease: 480,
  dumpsterBase: 70
} as const;

export const FACILITY_ACTION_COSTS = {
  openStorage: STORAGE_BUY_IN,
  openOffice: OFFICE_BUY_IN,
  openYard: YARD_BUY_IN,
  enableDumpster: DUMPSTER_ENABLE_COST,
  closeYard: 0,
  closeOffice: 0
} as const;

export function createInitialOfficeSkillsState(): OfficeSkillsState {
  return {
    readingXp: 0,
    accountingXp: 0,
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
    lastDailyBillsDay: 0,
    billingCycleDay: 1,
    monthlyDueByCategory: {},
    unpaidBalance: 0,
    missedBillStrikes: 0,
    lastDowngradeDay: null,
    businessTier: "truck",
    facilities: {
      storageOwned: false,
      officeOwned: false,
      yardOwned: false,
      dumpsterEnabled: false
    }
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
    lastDailyBillsDay: Math.max(0, currentDay - 1),
    billingCycleDay: 1 + ((Math.max(1, currentDay) - 1) % BILLING_CYCLE_LENGTH),
    monthlyDueByCategory: {},
    unpaidBalance: 0,
    missedBillStrikes: 0,
    lastDowngradeDay: null,
    businessTier: "yard",
    facilities: {
      storageOwned: true,
      officeOwned: true,
      yardOwned: true,
      dumpsterEnabled: true
    }
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
  const facilities = normalizeFacilitiesState(state?.facilities, base.facilities);
  return {
    accountantHired: Boolean(state?.accountantHired ?? base.accountantHired),
    accountantHireDay: state?.accountantHireDay ?? base.accountantHireDay,
    lastDailyBillsDay: Math.max(0, Math.floor(state?.lastDailyBillsDay ?? base.lastDailyBillsDay)),
    billingCycleDay: clamp(Math.max(1, Math.floor(state?.billingCycleDay ?? base.billingCycleDay)), 1, BILLING_CYCLE_LENGTH),
    monthlyDueByCategory: { ...(state?.monthlyDueByCategory ?? base.monthlyDueByCategory) },
    unpaidBalance: Math.max(0, Math.floor(state?.unpaidBalance ?? base.unpaidBalance)),
    missedBillStrikes: Math.max(0, Math.floor(state?.missedBillStrikes ?? base.missedBillStrikes)),
    lastDowngradeDay: state?.lastDowngradeDay ?? base.lastDowngradeDay,
    businessTier: normalizeBusinessTier(state?.businessTier, facilities),
    facilities
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

export function upgradeBusinessTier(state: GameState, target: BusinessTier): TierUpgradeResult {
  if (target === "truck") {
    return { ok: false, notice: "Truck Life is the base tier." };
  }
  if (target === "office") {
    if (!state.operations.facilities.storageOwned) {
      return { ok: false, notice: "Open storage before opening an office." };
    }
    if (state.operations.facilities.officeOwned) {
      return { ok: false, notice: "Office is already active." };
    }
    if (state.player.cash < OFFICE_BUY_IN) {
      return { ok: false, notice: `Need $${OFFICE_BUY_IN - state.player.cash} more to open an office.` };
    }
    state.player.cash -= OFFICE_BUY_IN;
    state.operations.facilities.officeOwned = true;
    state.operations.businessTier = "office";
    return { ok: true, notice: `Opened office for $${OFFICE_BUY_IN}.` };
  }

  if (!state.operations.facilities.officeOwned) {
    return { ok: false, notice: "Open an office before adding a yard." };
  }
  if (state.operations.facilities.yardOwned) {
    return { ok: false, notice: "Yard is already active." };
  }
  if (state.player.cash < YARD_BUY_IN) {
    return { ok: false, notice: `Need $${YARD_BUY_IN - state.player.cash} more to open a yard.` };
  }
  state.player.cash -= YARD_BUY_IN;
  state.operations.facilities.yardOwned = true;
  state.operations.businessTier = "yard";
  return { ok: true, notice: `Opened yard for $${YARD_BUY_IN}.` };
}

export function openStorage(state: GameState): TierUpgradeResult {
  if (state.operations.facilities.storageOwned) {
    return { ok: false, notice: "Storage is already active." };
  }
  if (state.player.cash < STORAGE_BUY_IN) {
    return { ok: false, notice: `Need $${STORAGE_BUY_IN - state.player.cash} more to open storage.` };
  }
  state.player.cash -= STORAGE_BUY_IN;
  state.operations.facilities.storageOwned = true;
  return { ok: true, notice: `Opened storage for $${STORAGE_BUY_IN}.` };
}

export function enableDumpsterService(state: GameState): DumpsterEnableResult {
  if (!state.operations.facilities.yardOwned) {
    return { ok: false, notice: "Open a yard before enabling dumpster service." };
  }
  if (state.operations.facilities.dumpsterEnabled) {
    return { ok: false, notice: "Dumpster service is already enabled." };
  }
  if (state.player.cash < DUMPSTER_ENABLE_COST) {
    return { ok: false, notice: `Need $${DUMPSTER_ENABLE_COST - state.player.cash} more to add dumpster service.` };
  }
  state.player.cash -= DUMPSTER_ENABLE_COST;
  state.operations.facilities.dumpsterEnabled = true;
  return { ok: true, notice: `Enabled dumpster service for $${DUMPSTER_ENABLE_COST}.` };
}

export function closeOfficeManually(state: GameState): TierUpgradeResult {
  if (!state.operations.facilities.officeOwned) {
    return { ok: false, notice: "No office to close." };
  }
  applyDowngradeToTruck(state, state.day);
  return {
    ok: true,
    notice: state.operations.facilities.storageOwned ? "Closed office and returned to Storage tier." : "Closed office and returned to Truck Life."
  };
}

export function closeYardManually(state: GameState): TierUpgradeResult {
  if (!state.operations.facilities.yardOwned) {
    return { ok: false, notice: "No yard to close." };
  }
  applyDowngradeToOffice(state, state.day);
  return { ok: true, notice: "Closed yard and returned to Office tier." };
}

export function getPremiumHaulCost(trashUnits: number): number {
  // Keep premium haul painful versus dumpster service, but not run-ending for early low-risk contracts.
  return 18 + Math.max(0, Math.floor(trashUnits)) * 3;
}

export function getDumpsterServiceCost(dumpsterUnits: number): number {
  return 95 + Math.max(0, Math.floor(dumpsterUnits)) * 3;
}

export function emptyDumpster(state: GameState): DumpsterEmptyResult {
  if (!state.operations.facilities.dumpsterEnabled) {
    return { ok: false, notice: "Dumpster service is not enabled yet.", cost: 0 };
  }
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
  applyDeferredQueueOperations(state, dayLog);

  awardOfficeSkillXp(state, { accounting: 2 });
  state.operations.billingCycleDay = state.operations.billingCycleDay >= BILLING_CYCLE_LENGTH ? 1 : state.operations.billingCycleDay + 1;
  dayLog.push({
    day: state.day,
    actorId: playerId,
    message: `Billing cycle day ${state.operations.billingCycleDay}/${BILLING_CYCLE_LENGTH}.`
  });

  if (state.operations.billingCycleDay !== BILLING_CYCLE_LENGTH) {
    state.operations.monthlyDueByCategory = buildMonthlyDueByCategory(state);
    state.operations.lastDailyBillsDay = state.day;
    return {
      dayLog,
      bills: emptyBillBreakdown()
    };
  }

  const due = buildMonthlyDueByCategory(state);
  state.operations.monthlyDueByCategory = { ...due };
  const subtotal = sumMoney(Object.values(due));
  const previousUnpaid = state.operations.unpaidBalance;
  const totalDue = subtotal + previousUnpaid;
  let paid = 0;
  let unpaidAfter = 0;
  let lateFee = 0;
  let strikeApplied = false;

  appendBillLines(dayLog, state.day, playerId, due, subtotal, previousUnpaid, totalDue);

  if (state.player.cash >= totalDue) {
    paid = totalDue;
    state.player.cash -= totalDue;
    state.operations.unpaidBalance = 0;
    state.operations.missedBillStrikes = 0;
    dayLog.push({
      day: state.day,
      actorId: playerId,
      message: `Monthly operations paid in full: $${totalDue}.`
    });
  } else {
    paid = Math.max(0, state.player.cash);
    state.player.cash = 0;
    const remaining = Math.max(0, totalDue - paid);
    lateFee = Math.max(35, Math.round(remaining * 0.05));
    unpaidAfter = remaining + lateFee;
    state.operations.unpaidBalance = unpaidAfter;
    state.operations.missedBillStrikes += 1;
    strikeApplied = true;
    dayLog.push(
      {
        day: state.day,
        actorId: playerId,
        message: `Monthly operations partially paid: $${paid} on $${totalDue}.`
      },
      {
        day: state.day,
        actorId: playerId,
        message: `Late fee applied: $${lateFee}.`
      },
      {
        day: state.day,
        actorId: playerId,
        message: `Unpaid balance carried: $${unpaidAfter}.`
      },
      {
        day: state.day,
        actorId: playerId,
        message: `Missed bill strike ${state.operations.missedBillStrikes}/2.`
      }
    );

    if (state.operations.missedBillStrikes >= 2) {
      applyForcedDowngrade(state, dayLog);
    }
  }

  state.operations.lastDailyBillsDay = state.day;

  return {
    dayLog,
    bills: {
      truckPayment: due.truck_payment ?? 0,
      insuranceAdmin: due.insurance_admin ?? 0,
      storageRent: due.storage_rent ?? 0,
      officeRent: due.office_rent ?? 0,
      electric: due.electric ?? 0,
      waterSewage: due.water_sewage ?? 0,
      yardLease: due.yard_lease ?? 0,
      dumpsterBase: due.dumpster_base ?? 0,
      accountantSalary: due.accountant_salary ?? 0,
      subtotal,
      previousUnpaid,
      totalDue,
      paid,
      unpaidAfter: state.operations.unpaidBalance,
      lateFee,
      strikeApplied
    }
  };
}

function applyDeferredQueueOperations(state: GameState, dayLog: DayLog[]): void {
  if (state.deferredJobs.length === 0) {
    return;
  }

  const actorId = state.player.actorId;
  const activeDeferred = state.deferredJobs.filter((entry) => state.day - entry.deferredAtDay < DEFERRED_EXPIRY_DAYS);
  const expiredDeferred = state.deferredJobs.filter((entry) => state.day - entry.deferredAtDay >= DEFERRED_EXPIRY_DAYS);

  for (const expired of expiredDeferred) {
    state.player.reputation = Math.max(0, state.player.reputation - 1);
    state.contractFiles = state.contractFiles.map((entry) =>
      entry.contractId === expired.activeJob.contractId
        ? {
            ...entry,
            status: "lost",
            dayClosed: state.day,
            outcome: "lost",
            actualHoursAtClose: Math.max(0, expired.activeJob.actualTicksSpent * 0.5)
          }
        : entry
    );
    dayLog.push({
      day: state.day,
      actorId,
      contractId: expired.activeJob.contractId,
      message: `Deferred job expired after ${DEFERRED_EXPIRY_DAYS} days: rep -1.`
    });
  }

  state.deferredJobs = activeDeferred;

  if (state.deferredJobs.length > 0) {
    const carryCost = state.deferredJobs.length * DEFERRED_DAILY_CARRY_FEE;
    state.player.cash -= carryCost;
    dayLog.push({
      day: state.day,
      actorId,
      message: `Deferred carrying fees: $${carryCost} (${state.deferredJobs.length} jobs).`
    });
  }
}

function buildMonthlyDueByCategory(state: GameState): Record<string, number> {
  const applyUtilityDiscount = (amount: number): number => {
    if (!state.operations.accountantHired) {
      return amount;
    }
    return Math.max(0, Math.round(amount * (1 - ACCOUNTANT_UTILITY_DISCOUNT)));
  };

  const due: Record<string, number> = {
    truck_payment: MONTHLY_BILLS.truckPayment,
    insurance_admin: MONTHLY_BILLS.insuranceAdmin
  };
  if (state.operations.facilities.storageOwned) {
    due.storage_rent = MONTHLY_BILLS.storageRent;
  }
  if (state.operations.facilities.officeOwned) {
    due.office_rent = MONTHLY_BILLS.officeRent;
    due.electric = applyUtilityDiscount(MONTHLY_BILLS.electric);
    due.water_sewage = applyUtilityDiscount(MONTHLY_BILLS.waterSewage);
  }
  if (state.operations.facilities.yardOwned) {
    due.yard_lease = MONTHLY_BILLS.yardLease;
  }
  if (state.operations.facilities.dumpsterEnabled) {
    due.dumpster_base = applyUtilityDiscount(MONTHLY_BILLS.dumpsterBase);
  }
  if (state.operations.accountantHired) {
    due.accountant_salary = ACCOUNTANT_SALARY_MONTHLY;
  }
  return due;
}

function appendBillLines(
  lines: DayLog[],
  day: number,
  actorId: string,
  due: Record<string, number>,
  subtotal: number,
  previousUnpaid: number,
  totalDue: number
): void {
  const labels: Record<string, string> = {
    truck_payment: "Bill truck payment",
    insurance_admin: "Bill insurance/admin",
    storage_rent: "Bill storage rent",
    office_rent: "Bill office rent",
    electric: "Bill electric",
    water_sewage: "Bill water/sewage",
    yard_lease: "Bill yard lease",
    dumpster_base: "Bill dumpster base",
    accountant_salary: "Bill accountant salary"
  };

  for (const [key, amount] of Object.entries(due)) {
    lines.push({
      day,
      actorId,
      message: `${labels[key] ?? `Bill ${key}`}: $${amount}.`
    });
  }
  lines.push({
    day,
    actorId,
    message: `Monthly operations subtotal: $${subtotal}.`
  });
  if (previousUnpaid > 0) {
    lines.push({
      day,
      actorId,
      message: `Previous unpaid balance: $${previousUnpaid}.`
    });
  }
  lines.push({
    day,
    actorId,
    message: `Monthly due total: $${totalDue}.`
  });
}

function applyForcedDowngrade(state: GameState, dayLog: DayLog[]): void {
  const day = state.day;
  const actorId = state.player.actorId;
  if (state.operations.businessTier === "yard") {
    applyDowngradeToOffice(state, day);
    dayLog.push({
      day,
      actorId,
      message: "Forced downgrade: yard lease lost after repeated missed payments."
    });
    return;
  }
  if (state.operations.businessTier === "office") {
    applyDowngradeToTruck(state, day);
    dayLog.push({
      day,
      actorId,
      message: "Forced downgrade: office lease lost after repeated missed payments."
    });
    return;
  }

  state.operations.unpaidBalance = 0;
  state.operations.missedBillStrikes = 0;
  state.operations.lastDowngradeDay = day;
  state.player.reputation = Math.max(0, state.player.reputation - 5);
  state.player.cash = Math.max(80, state.player.cash);
  dayLog.push({
    day,
    actorId,
    message: "Bankruptcy reset applied. Back to Truck Life with emergency float."
  });
}

function applyDowngradeToOffice(state: GameState, day: number): void {
  state.operations.businessTier = "office";
  state.operations.facilities.yardOwned = false;
  state.operations.facilities.dumpsterEnabled = false;
  state.yard.dumpsterUnits = 0;
  state.operations.missedBillStrikes = 0;
  state.operations.lastDowngradeDay = day;
}

function applyDowngradeToTruck(state: GameState, day: number): void {
  state.operations.businessTier = "truck";
  state.operations.facilities.officeOwned = false;
  state.operations.facilities.yardOwned = false;
  state.operations.facilities.dumpsterEnabled = false;
  state.yard.dumpsterUnits = 0;
  state.operations.missedBillStrikes = 0;
  state.operations.lastDowngradeDay = day;
}

function normalizeFacilitiesState(input: Partial<FacilitiesState> | null | undefined, fallback: FacilitiesState): FacilitiesState {
  return {
    storageOwned: Boolean(input?.storageOwned ?? fallback.storageOwned),
    officeOwned: Boolean(input?.officeOwned ?? fallback.officeOwned),
    yardOwned: Boolean(input?.yardOwned ?? fallback.yardOwned),
    dumpsterEnabled: Boolean(input?.dumpsterEnabled ?? fallback.dumpsterEnabled)
  };
}

function normalizeBusinessTier(input: BusinessTier | undefined, facilities: FacilitiesState): BusinessTier {
  if (input === "truck" || input === "office" || input === "yard") {
    return input;
  }
  if (facilities.yardOwned) {
    return "yard";
  }
  if (facilities.officeOwned) {
    return "office";
  }
  return "truck";
}

function sumMoney(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function emptyBillBreakdown(): MonthlyBillBreakdown {
  return {
    truckPayment: 0,
    insuranceAdmin: 0,
    storageRent: 0,
    officeRent: 0,
    electric: 0,
    waterSewage: 0,
    yardLease: 0,
    dumpsterBase: 0,
    accountantSalary: 0,
    subtotal: 0,
    previousUnpaid: 0,
    totalDue: 0,
    paid: 0,
    unpaidAfter: 0,
    lateFee: 0,
    strikeApplied: false
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
