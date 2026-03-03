import {
  applyToolPriceModifiers,
  deriveCompanyLevel,
  generateContractBoard,
  getPayoutMultiplier,
  getRiskValue,
  isForcedNeutral
} from "./economy";
import { evaluateBotPlan, simulateBotDay } from "./bots";
import { createRng, hashSeed } from "./rng";
import { SAVE_VERSION } from "./save";
import { createBotSkills, createInitialShopSupplies, createInitialSkills, createInitialWorkday, digestState, prepareForNextDay } from "./playerFlow";
import {
  ActorState,
  AssignmentIntent,
  BotProfile,
  ContractInstance,
  ContentBundle,
  DayLog,
  EventDef,
  GameState,
  Intent,
  JobDef,
  Resolution,
  ResolverResult,
  SkillId,
  ToolDef,
  TRADE_SKILLS
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
  const hammer = bundle.tools.find((tool) => tool.id === "hammer") ?? bundle.tools[0];
  if (!hammer) {
    throw new Error("Content bundle has no tools.");
  }

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
    fuelMax: 12,
    skills: createInitialSkills(),
    tools: {
      [hammer.id]: {
        toolId: hammer.id,
        durability: hammer.maxDurability
      }
    },
    crews: []
  };

  const bots = bundle.bots.map((profile, index) => createBotActor(profile, bundle, seed, index));
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
    contractBoard,
    activeEventIds,
    log: [],
    activeJob: null,
    shopSupplies: createInitialShopSupplies(),
    truckSupplies: {},
    workday: createInitialWorkday(1, 0)
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
    contractBoard: nextBoard,
    activeEventIds: nextEventIds,
    log: [...state.log, ...dayLog].slice(-300),
    activeJob: state.activeJob,
    shopSupplies: { ...state.shopSupplies },
    truckSupplies: { ...state.truckSupplies },
    workday: createInitialWorkday(nextDay, state.workday.fatigue.debt)
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
  nextState.activeEventIds = pickEventIds(bundle, nextState.day, nextState.seed);
  const pricingEvents = nextState.activeEventIds
    .map((id) => bundle.events.find((event) => event.id === id))
    .filter((event): event is EventDef => Boolean(event));

  const dayLog: DayLog[] = [];
  const profileById = new Map(bundle.bots.map((bot) => [bot.id, bot]));
  const updatedBots: ActorState[] = [];

  for (const bot of nextState.bots) {
    const profile = profileById.get(bot.actorId);
    if (!profile) {
      updatedBots.push(bot);
      continue;
    }

    const botBoard = generateContractBoard(bundle, nextState.day, hashSeed(nextState.seed, "bot-board", nextState.day, bot.actorId), {
      districtIds: bot.districtUnlocks,
      maxTier: bot.companyLevel + 1
    });
    const sim = simulateBotDay(
      bot,
      profile,
      botBoard,
      bundle,
      pricingEvents,
      nextState.day,
      hashSeed(nextState.seed, "bot-sim", nextState.day, bot.actorId)
    );
    applyProgression(sim.bot, bundle);
    const purchasePhase = applyBotPurchasesForNextDay(
      [sim.bot],
      [profile],
      bundle,
      botBoard,
      pricingEvents,
      hashSeed(nextState.seed, "bot-buy", nextState.day, bot.actorId)
    );
    updatedBots.push(purchasePhase.bots[0] ?? sim.bot);

    for (const line of sim.logLines) {
      dayLog.push({
        day: state.day,
        actorId: bot.actorId,
        message: line
      });
    }
    dayLog.push(...purchasePhase.purchaseLogs.map((entry) => ({ ...entry, day: state.day })));
  }

  nextState.bots = updatedBots;
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
  if (state.activeJob && state.activeJob.location !== "shop") {
    return state;
  }
  const tool = bundle.tools.find((item) => item.id === toolId);
  if (!tool) {
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
  if (state.activeJob && state.activeJob.location !== "shop") {
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
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const sortedTools = [...bundle.tools].sort((a, b) => a.id.localeCompare(b.id));
  const nextDay = nextBoard[0]?.expiresDay ?? 0;
  const logDay = nextDay > 0 ? nextDay - 1 : 0;

  const updatedBots: ActorState[] = [];
  const purchaseLogs: DayLog[] = [];

  for (const bot of bots) {
    const profile = profileById.get(bot.actorId) ?? profiles[0];
    const nextBot = cloneActor(bot);
    if (!profile) {
      updatedBots.push(nextBot);
      continue;
    }

    const baselinePlan = evaluateBotPlan(nextBot, profile, nextBoard, bundle, nextDay, nextDaySeed, {
      tieNoise: false
    });

    const candidates: Array<{ tool: ToolDef; price: number; weightedGain: number }> = [];
    for (const tool of sortedTools) {
      const existing = nextBot.tools[tool.id];
      if (existing && existing.durability > 0) {
        continue;
      }

      const price = applyToolPriceModifiers(tool.price, pricingEvents);
      if (nextBot.cash < price) {
        continue;
      }

      const simulated = cloneActor(nextBot);
      simulated.tools[tool.id] = {
        toolId: tool.id,
        durability: tool.maxDurability
      };

      const candidatePlan = evaluateBotPlan(simulated, profile, nextBoard, bundle, nextDay, nextDaySeed, {
        tieNoise: false
      });
      const scoreGain = candidatePlan.totalScore - baselinePlan.totalScore;
      const weightedGain = scoreGain * profile.weights.wToolBuy;
      if (weightedGain < 20) {
        continue;
      }

      candidates.push({
        tool,
        price,
        weightedGain
      });
    }

    candidates.sort((a, b) => {
      if (b.weightedGain !== a.weightedGain) {
        return b.weightedGain - a.weightedGain;
      }
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      return a.tool.id.localeCompare(b.tool.id);
    });

    const choice = candidates[0];
    if (choice) {
      nextBot.cash -= choice.price;
      nextBot.tools[choice.tool.id] = {
        toolId: choice.tool.id,
        durability: choice.tool.maxDurability
      };
      purchaseLogs.push({
        day: logDay,
        actorId: nextBot.actorId,
        message: `${nextBot.name} bought ${choice.tool.name} for $${choice.price}.`
      });
    }

    updatedBots.push(nextBot);
  }

  return {
    bots: updatedBots,
    purchaseLogs
  };
}

function createBotActor(profile: BotProfile, bundle: ContentBundle, seed: number, index: number): ActorState {
  const toolRng = createRng(hashSeed(seed, "botStart", profile.id));
  const starterTools = pickStarterTools(bundle.tools, toolRng.nextInt(bundle.tools.length));

  const tools = starterTools.reduce<Record<string, { toolId: string; durability: number }>>((acc, tool) => {
    acc[tool.id] = {
      toolId: tool.id,
      durability: tool.maxDurability
    };
    return acc;
  }, {});

  const bot: ActorState = {
    actorId: profile.id,
    name: profile.name,
    companyName: profile.name,
    cash: 320 + index * 40,
    reputation: 4 + index * 3,
    companyLevel: 1,
    districtUnlocks: unlockDistricts(bundle, 1),
    staminaMax: 4,
    stamina: 4,
    fuel: 8,
    fuelMax: 12,
    skills: createBotSkills(getStarterSkillIds(starterTools)),
    tools,
    crews: []
  };

  applyProgression(bot, bundle);
  return bot;
}

function pickStarterTools(tools: ToolDef[], randomIndex: number): ToolDef[] {
  const hammer = tools.find((tool) => tool.id === "hammer") ?? tools[0];
  const alt = tools[randomIndex] ?? hammer;
  if (!hammer) {
    return [];
  }
  if (!alt || alt.id === hammer.id) {
    return [hammer];
  }
  return [hammer, alt];
}

function getStarterSkillIds(tools: ToolDef[]): SkillId[] {
  const skillIds: SkillId[] = [];
  const validSkills = new Set<SkillId>([...TRADE_SKILLS]);

  for (const tool of tools) {
    for (const tag of tool.tags) {
      if (validSkills.has(tag as SkillId) && !skillIds.includes(tag as SkillId)) {
        skillIds.push(tag as SkillId);
      }
    }
  }

  return skillIds;
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
