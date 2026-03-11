import {
  applyToolPriceModifiers,
  deriveCompanyLevel,
  generateContractBoard,
  getPayoutMultiplier,
  getRiskValue,
  isForcedNeutral
} from "./economy";
import { createInitialBotCareer, simulateBotCareerDay, syncBotSnapshotsFromCareers } from "./bots";
import { createRng, hashSeed } from "./rng";
import { SAVE_VERSION } from "./save";
import {
  createInitialShopSupplies,
  createInitialSkills,
  createInitialWorkday,
  digestState,
  isStarterToolId,
  prepareForNextDay,
  shouldEnforceStarterToolGate
} from "./playerFlow";
import { applyEndDayOperations, createInitialOfficeSkillsState, createInitialOperationsState, createInitialYardState } from "./operations";
import { createInitialPerksState } from "./perks";
import { createResearchStateLocked } from "./research";
import { createTradeProgressState } from "./tradeProgress";
import {
  ActorState,
  AssignmentIntent,
  BotProfile,
  BotCareerState,
  ContractInstance,
  ContentBundle,
  DayLog,
  EventDef,
  GameState,
  Intent,
  JobDef,
  Resolution,
  ResolverResult
} from "./types";

interface ValidAssignment {
  actorId: string;
  assignee: AssignmentIntent["assignee"];
  contractId: string;
  job: JobDef;
}

export function createInitialGameState(
  bundle: ContentBundle,
  seed = 1,
  playerName = bundle.strings.defaultPlayerName ?? "You",
  companyName = bundle.strings.defaultCompanyName ?? "Field Ops"
): GameState {
  const player: ActorState = {
    actorId: "player",
    name: playerName,
    companyName,
    cash: 300,
    reputation: 0,
    companyLevel: 1,
    districtUnlocks: unlockDistricts(bundle, 1),
    staminaMax: 4,
    stamina: 4,
    fuel: 8,
    fuelMax: 40,
    oshaCanOwned: false,
    skills: createInitialSkills(),
    tools: {},
    crews: []
  };

  const botCareers = bundle.bots.map((profile) => createInitialBotCareer(profile, bundle));
  const bots = syncBotSnapshotsFromCareers(botCareers);
  const activeEventIds = pickEventIds(bundle, 1, seed);
  const contractBoard = generateContractBoard(bundle, 1, hashSeed(seed, 1), {
    districtIds: player.districtUnlocks,
    maxTier: player.companyLevel + 1
  });

  return {
    saveVersion: SAVE_VERSION,
    day: 1,
    seed,
    player,
    bots,
    botCareers,
    contractBoard,
    activeEventIds,
    log: [],
    activeJob: null,
    shopSupplies: createInitialShopSupplies(),
    truckSupplies: {},
    workday: createInitialWorkday(1, 0),
    research: createResearchStateLocked(),
    tradeProgress: createTradeProgressState(true),
    officeSkills: createInitialOfficeSkillsState(),
    yard: createInitialYardState(),
    operations: createInitialOperationsState(),
    perks: createInitialPerksState(),
    selfEsteem: {
      currentSelfEsteem: 50,
      dailySelfEsteemDrift: 4,
      lifetimeTimesAtZero: 0,
      lifetimeTimesAtHundred: 0,
      fullExtremeSwings: 0,
      hasGrizzled: false
    },
    deferredJobs: [],
    contractFiles: [],
    dayLaborHiddenUntilEndDay: false
  };
}

export function resolveDay(
  state: GameState,
  intents: Intent[],
  bundle: ContentBundle,
  daySeed = hashSeed(state.seed, state.day)
): ResolverResult {
  const events = state.activeEventIds
    .map((id) => bundle.events.find((event) => event.id === id))
    .filter((event): event is EventDef => Boolean(event));

  const jobsById = new Map(bundle.jobs.map((job) => [job.id, job]));
  const contractsById = new Map(state.contractBoard.map((contract) => [contract.contractId, contract]));
  const actors = hydrateActorMap(state);
  const actorOrder = [state.player.actorId, ...state.bots.map((bot) => bot.actorId)];

  const dayLog: DayLog[] = [];
  const validAssignments: ValidAssignment[] = [];

  for (const actorId of actorOrder) {
    const actor = actors.get(actorId);
    if (!actor) {
      continue;
    }

    const intent = intents.find((item) => item.actorId === actorId);
    if (!intent) {
      continue;
    }

    for (const assignment of intent.assignments) {
      const contract = contractsById.get(assignment.contractId);
      if (!contract || contract.expiresDay < state.day) {
        continue;
      }

      const job = jobsById.get(contract.jobId);
      if (!job) {
        continue;
      }

      if (!hasUsableTools(actor, job.requiredTools)) {
        dayLog.push({
          day: state.day,
          actorId,
          contractId: contract.contractId,
          message: `${actor.name} could not start ${job.name}; missing usable tools.`
        });
        continue;
      }

      validAssignments.push({
        actorId,
        assignee: assignment.assignee,
        contractId: contract.contractId,
        job
      });
    }
  }

  const groupedByContract = new Map<string, ValidAssignment[]>();
  for (const assignment of validAssignments) {
    const list = groupedByContract.get(assignment.contractId) ?? [];
    list.push(assignment);
    groupedByContract.set(assignment.contractId, list);
  }

  const winners: ValidAssignment[] = [];
  const lostResolutions: Resolution[] = [];

  const sortedContractIds = [...groupedByContract.keys()].sort((a, b) => a.localeCompare(b));
  for (const contractId of sortedContractIds) {
    const contenders = groupedByContract.get(contractId) ?? [];
    if (contenders.length === 0) {
      continue;
    }

    let winner = contenders[0]!;
    if (contenders.length > 1) {
      const maxRep = Math.max(...contenders.map((contender) => actors.get(contender.actorId)?.reputation ?? Number.MIN_SAFE_INTEGER));
      const finalists = contenders.filter((contender) => (actors.get(contender.actorId)?.reputation ?? Number.MIN_SAFE_INTEGER) === maxRep);
      if (finalists.length > 1) {
        const tieRng = createRng(hashSeed(daySeed, "tie", contractId));
        winner = finalists[tieRng.nextInt(finalists.length)]!;
      } else {
        winner = finalists[0]!;
      }
    }

    winners.push(winner);

    const winnerName = actors.get(winner.actorId)?.name ?? winner.actorId;
    for (const contender of contenders) {
      if (contender.actorId === winner.actorId) {
        continue;
      }
      const loser = actors.get(contender.actorId);
      if (!loser) {
        continue;
      }

      const staminaBefore = getAssigneeStamina(loser, contender.assignee);
      const toolBefore = readToolDurability(loser, contender.job.requiredTools);
      lostResolutions.push({
        day: state.day,
        actorId: contender.actorId,
        contractId,
        outcome: "lost",
        winnerActorId: winner.actorId,
        cashDelta: 0,
        repDelta: 0,
        staminaBefore,
        staminaAfter: staminaBefore,
        toolDurabilityBefore: toolBefore,
        toolDurabilityAfter: { ...toolBefore },
        logLine: `${loser.name} lost ${contender.job.name}; ${winnerName} had priority.`
      });
      dayLog.push({
        day: state.day,
        actorId: contender.actorId,
        contractId,
        message: `${loser.name} lost ${contender.job.name}; ${winnerName} had priority.`
      });
    }
  }

  const outcomeRng = createRng(hashSeed(daySeed, "outcome"));
  const winnerResolutions: Resolution[] = [];

  for (const winner of winners.sort((a, b) => a.contractId.localeCompare(b.contractId))) {
    const actor = actors.get(winner.actorId);
    if (!actor) {
      continue;
    }

    const contract = contractsById.get(winner.contractId);
    if (!contract) {
      continue;
    }

    const staminaBefore = getAssigneeStamina(actor, winner.assignee);

    const toolBefore = readToolDurability(actor, winner.job.requiredTools);
    const payout = Math.max(
      0,
      Math.round(winner.job.basePayout * contract.payoutMult * getPayoutMultiplier(winner.job, events))
    );

    const risk = getRiskValue(winner.job, events);
    const forcedNeutral = isForcedNeutral(winner.job, events);

    let outcome: Resolution["outcome"] = "success";
    if (forcedNeutral) {
      outcome = "neutral";
    } else if (outcomeRng.bool(risk)) {
      outcome = "fail";
    }

    let cashDelta = 0;
    let repDelta = 0;
    let logLine = winner.job.flavor.neutral_line;

    if (outcome === "success") {
      cashDelta = payout;
      repDelta = winner.job.repGainSuccess;
      logLine = winner.job.flavor.success_line;
    }

    if (outcome === "fail") {
      cashDelta = 0;
      repDelta = -Math.abs(winner.job.repLossFail);
      logLine = winner.job.flavor.fail_line;
    }

    if (outcome === "neutral") {
      cashDelta = Math.round(payout * 0.5);
      repDelta = 0;
      logLine = winner.job.flavor.neutral_line || bundle.strings.neutralLogFallback;
    }

    actor.cash += cashDelta;
    const reputationBefore = actor.reputation;
    actor.reputation = Math.max(0, actor.reputation + repDelta);
    const appliedRepDelta = actor.reputation - reputationBefore;

    for (const toolId of winner.job.requiredTools) {
      const tool = actor.tools[toolId];
      if (!tool) {
        continue;
      }
      tool.durability = Math.max(0, tool.durability - winner.job.durabilityCost);
    }

    const toolAfter = readToolDurability(actor, winner.job.requiredTools);
    winnerResolutions.push({
      day: state.day,
      actorId: winner.actorId,
      contractId: winner.contractId,
      outcome,
      winnerActorId: winner.actorId,
      cashDelta,
      repDelta: appliedRepDelta,
      staminaBefore,
      staminaAfter: staminaBefore,
      toolDurabilityBefore: toolBefore,
      toolDurabilityAfter: toolAfter,
      logLine
    });

    dayLog.push({
      day: state.day,
      actorId: winner.actorId,
      contractId: winner.contractId,
      message: logLine
    });
  }

  const nextPlayer = actors.get(state.player.actorId)!;
  const nextBots = state.bots.map((bot) => actors.get(bot.actorId)!).filter((bot): bot is ActorState => Boolean(bot));

  applyProgression(nextPlayer, bundle);
  for (const bot of nextBots) {
    applyProgression(bot, bundle);
  }

  const resetPlayer = resetActorStamina(nextPlayer);
  const resetBots = nextBots.map((bot) => resetActorStamina(bot));

  const nextDay = state.day + 1;
  const nextEventIds = pickEventIds(bundle, nextDay, state.seed);
  const nextEvents = nextEventIds
    .map((id) => bundle.events.find((event) => event.id === id))
    .filter((event): event is EventDef => Boolean(event));
  const nextBoard = generateContractBoard(bundle, nextDay, hashSeed(state.seed, nextDay), {
    districtIds: resetPlayer.districtUnlocks,
    maxTier: resetPlayer.companyLevel + 1
  });
  const purchasePhase = applyBotPurchasesForNextDay(
    resetBots,
    bundle.bots,
    bundle,
    nextBoard,
    nextEvents,
    hashSeed(state.seed, "bot-buy", nextDay)
  );
  dayLog.push(...purchasePhase.purchaseLogs);

  const resolutions = [...winnerResolutions, ...lostResolutions].sort((a, b) => {
    const contractOrder = a.contractId.localeCompare(b.contractId);
    if (contractOrder !== 0) {
      return contractOrder;
    }
    return a.actorId.localeCompare(b.actorId);
  });

  const nextState: GameState = {
    saveVersion: state.saveVersion,
    day: nextDay,
    seed: state.seed,
    player: resetPlayer,
    bots: purchasePhase.bots,
    botCareers: state.botCareers.map((career) => {
      const actor = purchasePhase.bots.find((bot) => bot.actorId === career.actor.actorId);
      return {
        ...career,
        actor: actor ? cloneActor(actor) : cloneActor(career.actor),
        activeJob: career.activeJob
          ? {
              ...career.activeJob,
              estimateAtAccept: { ...career.activeJob.estimateAtAccept },
              reservedMaterials: cloneSupplyInventory(career.activeJob.reservedMaterials),
              siteSupplies: cloneSupplyInventory(career.activeJob.siteSupplies),
              supplierCart: cloneSupplyInventory(career.activeJob.supplierCart),
              tasks: career.activeJob.tasks.map((task) => ({ ...task }))
            }
          : null,
        contractBoard: career.contractBoard.map((contract) => ({ ...contract })),
        log: career.log.map((entry) => ({ ...entry })),
        shopSupplies: cloneSupplyInventory(career.shopSupplies),
        truckSupplies: cloneSupplyInventory(career.truckSupplies),
        workday: {
          ...career.workday,
          fatigue: { ...career.workday.fatigue }
        },
        research: {
          ...career.research,
          unlockedCategories: { ...career.research.unlockedCategories },
          unlockedSkills: { ...career.research.unlockedSkills },
          activeProject: career.research.activeProject ? { ...career.research.activeProject } : null,
          completedProjectIds: [...career.research.completedProjectIds]
        },
        tradeProgress: {
          unlocked: { ...career.tradeProgress.unlocked },
          unlockedDay: { ...career.tradeProgress.unlockedDay }
        },
        officeSkills: { ...career.officeSkills },
        yard: { ...career.yard },
        operations: {
          ...career.operations,
          monthlyDueByCategory: { ...career.operations.monthlyDueByCategory },
          facilities: { ...career.operations.facilities }
        },
        perks: {
          ...career.perks,
          corePerks: { ...career.perks.corePerks },
          unlockedPerkTrees: { ...career.perks.unlockedPerkTrees }
        },
        selfEsteem: { ...career.selfEsteem },
        deferredJobs: career.deferredJobs.map((entry) => ({
          deferredJobId: entry.deferredJobId,
          deferredAtDay: entry.deferredAtDay,
          activeJob: {
            ...entry.activeJob,
            estimateAtAccept: { ...entry.activeJob.estimateAtAccept },
            reservedMaterials: cloneSupplyInventory(entry.activeJob.reservedMaterials),
            siteSupplies: cloneSupplyInventory(entry.activeJob.siteSupplies),
            supplierCart: cloneSupplyInventory(entry.activeJob.supplierCart),
            tasks: entry.activeJob.tasks.map((task) => ({ ...task }))
          }
        })),
        contractFiles: career.contractFiles.map((entry) => ({ ...entry }))
      };
    }),
    contractBoard: nextBoard,
    activeEventIds: nextEventIds,
    log: [...state.log, ...dayLog].slice(-300),
    activeJob: state.activeJob,
    shopSupplies: { ...state.shopSupplies },
    truckSupplies: { ...state.truckSupplies },
    workday: createInitialWorkday(nextDay, state.workday.fatigue.debt),
    research: {
      babaUnlocked: state.research.babaUnlocked,
      unlockedCategories: { ...state.research.unlockedCategories },
      unlockedSkills: { ...state.research.unlockedSkills },
      activeProject: state.research.activeProject ? { ...state.research.activeProject } : null,
      completedProjectIds: [...state.research.completedProjectIds]
    },
    tradeProgress: {
      unlocked: { ...state.tradeProgress.unlocked },
      unlockedDay: { ...state.tradeProgress.unlockedDay }
    },
    officeSkills: { ...state.officeSkills },
    yard: { ...state.yard },
    operations: {
      ...state.operations,
      monthlyDueByCategory: { ...state.operations.monthlyDueByCategory },
      facilities: { ...state.operations.facilities }
    },
    perks: {
      ...state.perks,
      corePerks: { ...state.perks.corePerks },
      unlockedPerkTrees: { ...state.perks.unlockedPerkTrees }
    },
    selfEsteem: { ...state.selfEsteem },
    deferredJobs: state.deferredJobs.map((entry) => ({
      deferredJobId: entry.deferredJobId,
      deferredAtDay: entry.deferredAtDay,
      activeJob: {
        ...entry.activeJob,
        estimateAtAccept: { ...entry.activeJob.estimateAtAccept },
        reservedMaterials: cloneSupplyInventory(entry.activeJob.reservedMaterials),
        siteSupplies: cloneSupplyInventory(entry.activeJob.siteSupplies),
        supplierCart: cloneSupplyInventory(entry.activeJob.supplierCart),
        tasks: entry.activeJob.tasks.map((task) => ({ ...task }))
      }
    })),
    contractFiles: state.contractFiles.map((entry) => ({ ...entry })),
    dayLaborHiddenUntilEndDay: state.dayLaborHiddenUntilEndDay
  };

  return {
    nextState,
    resolutions,
    dayLog,
    digest: createDigest(nextState, resolutions, dayLog)
  };
}

export function endShift(state: GameState, bundle: ContentBundle): ResolverResult {
  const nextState = prepareForNextDay(state);
  const operationsResult = applyEndDayOperations(nextState);
  nextState.activeEventIds = pickEventIds(bundle, nextState.day, nextState.seed);
  const dayLog: DayLog[] = [...operationsResult.dayLog];
  const competitorSimulation = simulateCompetitorCareers(nextState, bundle, state.day);
  nextState.botCareers = competitorSimulation.careers;
  nextState.bots = competitorSimulation.snapshots;
  dayLog.push(...competitorSimulation.dayLog);
  applyStagnationRecovery(nextState, bundle, dayLog, state.day);
  nextState.contractBoard = nextState.activeJob
    ? []
    : generateContractBoard(bundle, nextState.day, hashSeed(nextState.seed, nextState.day), {
        districtIds: nextState.player.districtUnlocks,
        maxTier: nextState.player.companyLevel + 1
      });
  nextState.log = [...nextState.log, ...dayLog].slice(-300);

  return {
    nextState,
    resolutions: [],
    dayLog,
    digest: digestState(nextState)
  };
}

function simulateCompetitorCareers(
  nextState: GameState,
  bundle: ContentBundle,
  completedDay: number
): { careers: BotCareerState[]; snapshots: ActorState[]; dayLog: DayLog[] } {
  const careersById = new Map(nextState.botCareers.map((career) => [career.actor.actorId, career]));
  const snapshotsById = new Map(nextState.bots.map((bot) => [bot.actorId, bot]));
  const careers: BotCareerState[] = [];
  const dayLog: DayLog[] = [];

  for (const profile of bundle.bots) {
    const existingCareer = careersById.get(profile.id);
    const baseCareer = existingCareer
      ? existingCareer
      : (() => {
          const seeded = createInitialBotCareer(profile, bundle);
          const existingSnapshot = snapshotsById.get(profile.id);
          if (existingSnapshot) {
            seeded.actor = cloneActor(existingSnapshot);
          }
          return seeded;
        })();
    const simulation = simulateBotCareerDay(baseCareer, profile, nextState, bundle, {
      completedDay,
      sharedEventIds: nextState.activeEventIds,
      daySeed: hashSeed(nextState.seed, "bot-career-day", nextState.day, profile.id)
    });
    careers.push(simulation.career);
    dayLog.push(...simulation.dayLog.map((entry) => ({ ...entry })));
  }

  const snapshots = syncBotSnapshotsFromCareers(careers);
  return { careers, snapshots, dayLog };
}

function applyStagnationRecovery(nextState: GameState, bundle: ContentBundle, dayLog: DayLog[], completedDay: number): void {
  if (completedDay < 3) {
    return;
  }

  const playerId = nextState.player.actorId;
  const fullLog = [...nextState.log, ...dayLog];
  const alreadyRecovered = fullLog.some(
    (entry) => entry.actorId === playerId && entry.message.includes("Stagnation recovery applied")
  );
  if (alreadyRecovered) {
    return;
  }

  const repDeltaByDay = new Map<number, number>();
  for (const entry of fullLog) {
    if (entry.actorId !== playerId) {
      continue;
    }
    const repMatch = entry.message.match(/rep\s+([+-]?\d+)/i);
    const repDelta = repMatch ? Number.parseInt(repMatch[1] ?? "0", 10) : 0;
    repDeltaByDay.set(entry.day, (repDeltaByDay.get(entry.day) ?? 0) + repDelta);
  }

  const lastThreeDays = [completedDay - 2, completedDay - 1, completedDay];
  const stalled = lastThreeDays.every((day) => (repDeltaByDay.get(day) ?? 0) <= 0);
  if (!stalled) {
    return;
  }

  nextState.player.reputation += 3;
  nextState.player.companyLevel = deriveCompanyLevel(nextState.player.reputation);
  nextState.player.districtUnlocks = unlockDistricts(bundle, nextState.player.companyLevel);
  dayLog.push({
    day: completedDay,
    actorId: playerId,
    message: "Stagnation recovery applied: reputation +3 after three flat days."
  });
}

export function buyTool(state: GameState, bundle: ContentBundle, toolId: string): GameState {
  if (state.activeJob && state.activeJob.location !== "shop" && state.operations.facilities.storageOwned) {
    return state;
  }
  const tool = bundle.tools.find((item) => item.id === toolId);
  if (!tool) {
    return state;
  }
  if (shouldEnforceStarterToolGate(bundle) && !state.operations.facilities.storageOwned && !isStarterToolId(tool.id)) {
    return state;
  }

  const events = state.activeEventIds
    .map((id) => bundle.events.find((event) => event.id === id))
    .filter((event): event is EventDef => Boolean(event));

  const price = applyToolPriceModifiers(tool.price, events);
  if (state.player.cash < price) {
    return state;
  }

  const nextPlayer = cloneActor(state.player);
  nextPlayer.cash -= price;
  nextPlayer.tools[tool.id] = {
    toolId: tool.id,
    durability: tool.maxDurability
  };

  const nextState = {
    ...state,
    player: nextPlayer,
    log: [
      ...state.log,
      {
        day: state.day,
        actorId: state.player.actorId,
        message: `Bought ${tool.name} for $${price}.`
      }
    ].slice(-300)
  };
  return nextState;
}

export function repairTool(state: GameState, bundle: ContentBundle, toolId: string): GameState {
  if (state.activeJob && state.activeJob.location !== "shop" && state.operations.facilities.storageOwned) {
    return state;
  }
  const toolDef = bundle.tools.find((tool) => tool.id === toolId);
  if (!toolDef) {
    return state;
  }

  const existing = state.player.tools[toolId];
  if (!existing || existing.durability >= toolDef.maxDurability) {
    return state;
  }

  const repairCost = Math.max(1, Math.round(toolDef.price * 0.4));
  if (state.player.cash < repairCost) {
    return state;
  }

  const nextPlayer = cloneActor(state.player);
  nextPlayer.cash -= repairCost;
  nextPlayer.tools[toolId] = {
    toolId,
    durability: toolDef.maxDurability
  };

  const nextState = {
    ...state,
    player: nextPlayer,
    log: [
      ...state.log,
      {
        day: state.day,
        actorId: state.player.actorId,
        message: `Repaired ${toolDef.name} for $${repairCost}.`
      }
    ].slice(-300)
  };
  return nextState;
}

export function hireCrew(state: GameState): GameState {
  return state;
}

export function applyBotPurchasesForNextDay(
  bots: ActorState[],
  profiles: BotProfile[],
  bundle: ContentBundle,
  nextBoard: ContractInstance[],
  pricingEvents: EventDef[],
  nextDaySeed: number
): { bots: ActorState[]; purchaseLogs: DayLog[] } {
  return {
    bots: bots.map((bot) => cloneActor(bot)),
    purchaseLogs: []
  };
}

function cloneSupplyInventory(inventory: Record<string, { low?: number; medium?: number; high?: number }> | undefined) {
  if (!inventory) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(inventory).map(([supplyId, stack]) => [
      supplyId,
      {
        low: stack.low ?? 0,
        medium: stack.medium ?? 0,
        high: stack.high ?? 0
      }
    ])
  );
}

function hydrateActorMap(state: GameState): Map<string, ActorState> {
  const entries: Array<[string, ActorState]> = [[state.player.actorId, cloneActor(state.player)]];
  for (const bot of state.bots) {
    entries.push([bot.actorId, cloneActor(bot)]);
  }
  return new Map(entries);
}

function cloneActor(actor: ActorState): ActorState {
  return {
    ...actor,
    districtUnlocks: [...actor.districtUnlocks],
    skills: { ...actor.skills },
    tools: Object.fromEntries(
      Object.entries(actor.tools).map(([toolId, value]) => [toolId, { toolId: value.toolId, durability: value.durability }])
    ),
    crews: actor.crews.map((crew) => ({ ...crew }))
  };
}

function hasUsableTools(actor: ActorState, requiredToolIds: string[]): boolean {
  return requiredToolIds.every((toolId) => {
    const tool = actor.tools[toolId];
    return Boolean(tool && tool.durability > 0);
  });
}

function getAssigneeStamina(actor: ActorState, assignee: AssignmentIntent["assignee"]): number {
  if (assignee === "self") {
    return actor.stamina;
  }
  const crew = actor.crews.find((item) => item.crewId === assignee);
  return crew?.stamina ?? 0;
}

function readToolDurability(actor: ActorState, requiredToolIds: string[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const toolId of requiredToolIds) {
    values[toolId] = actor.tools[toolId]?.durability ?? 0;
  }
  return values;
}

function applyProgression(actor: ActorState, bundle: ContentBundle): void {
  actor.companyLevel = deriveCompanyLevel(actor.reputation);
  actor.districtUnlocks = unlockDistricts(bundle, actor.companyLevel);
}

function unlockDistricts(bundle: ContentBundle, companyLevel: number): string[] {
  const sorted = [...bundle.districts].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  return sorted.filter((district) => district.tier <= companyLevel + 1).map((district) => district.id);
}

function pickEventIds(bundle: ContentBundle, day: number, seed: number): string[] {
  if (bundle.events.length === 0) {
    return [];
  }

  const rng = createRng(hashSeed(seed, "events", day));
  const count = 1 + rng.nextInt(2);
  const pool = [...bundle.events];
  const picks: string[] = [];

  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const chosen = rng.pickWeighted(pool, (event) => event.weight);
    picks.push(chosen.id);
    const index = pool.findIndex((event) => event.id === chosen.id);
    pool.splice(index, 1);
  }

  return picks.sort((a, b) => a.localeCompare(b));
}

function resetActorStamina(actor: ActorState): ActorState {
  const nextActor = cloneActor(actor);
  nextActor.stamina = nextActor.staminaMax;
  nextActor.crews = nextActor.crews.map((crew) => ({
    ...crew,
    stamina: crew.staminaMax
  }));
  return nextActor;
}

function createDigest(nextState: GameState, resolutions: Resolution[], dayLog: DayLog[]): string {
  const payload = stableStringify({
    nextState,
    resolutions,
    dayLog
  });
  return hashSeed(payload).toString(16);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}
