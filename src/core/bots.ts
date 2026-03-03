import { createRng, hashSeed } from "./rng";
import { getTaskSkillMapping, getSkillRank, hasUsableTools } from "./playerFlow";
import { getRiskValue, isForcedNeutral } from "./economy";
import { ActorState, BotProfile, ContentBundle, ContractInstance, EventDef, Intent, TaskStance } from "./types";

interface ScoredContract {
  contractId: string;
  score: number;
}

export interface EvaluateBotPlanOptions {
  tieNoise?: boolean;
}

export interface EvaluatedBotPlan {
  assignments: Intent["assignments"];
  totalScore: number;
}

export function evaluateBotPlan(
  actor: ActorState,
  profile: BotProfile,
  contracts: ContractInstance[],
  bundle: ContentBundle,
  day: number,
  daySeed: number,
  options: EvaluateBotPlanOptions = {}
): EvaluatedBotPlan {
  const tieNoise = options.tieNoise ?? true;
  const jobsById = new Map(bundle.jobs.map((job) => [job.id, job]));
  const rng = tieNoise ? createRng(hashSeed(daySeed, "bot", actor.actorId, day)) : null;

  const scored: ScoredContract[] = contracts
    .map((contract) => {
      const job = jobsById.get(contract.jobId);
      if (!job) {
        return null;
      }
      if (!hasUsableTools(actor, job.requiredTools)) {
        return null;
      }

      const mapping = getTaskSkillMapping(job, "do_work");
      const primaryRank = getSkillRank(actor, mapping.primary);
      const secondaryRank = mapping.secondary ? getSkillRank(actor, mapping.secondary) : primaryRank;
      const averageRank = Math.floor((primaryRank + secondaryRank) / 2);
      const expectedPayout = job.basePayout * contract.payoutMult;
      let score =
        expectedPayout * profile.weights.wCash +
        job.repGainSuccess * 35 * profile.weights.wRep -
        job.risk * 100 * profile.weights.wRiskAvoid +
        averageRank * 15;

      if (rng) {
        score += rng.next() * 0.01;
      }

      return {
        contractId: contract.contractId,
        score
      };
    })
    .filter((item): item is ScoredContract => Boolean(item))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.contractId.localeCompare(b.contractId);
    });

  const assignments: Intent["assignments"] = [];
  let totalScore = 0;

  for (const candidate of scored) {
    assignments.push({
      assignee: "self",
      contractId: candidate.contractId
    });
    totalScore += candidate.score;
  }

  return {
    assignments,
    totalScore
  };
}

export function generateBotIntent(
  actor: ActorState,
  profile: BotProfile,
  contracts: ContractInstance[],
  bundle: ContentBundle,
  day: number,
  daySeed: number
): Intent {
  const plan = evaluateBotPlan(actor, profile, contracts, bundle, day, daySeed, { tieNoise: true });

  return {
    actorId: actor.actorId,
    day,
    assignments: plan.assignments
  };
}

export function getBotPreferredStance(profile: BotProfile): TaskStance {
  if (profile.weights.wCash > profile.weights.wRep) {
    return "rush";
  }
  if (profile.weights.wRep > profile.weights.wCash) {
    return "careful";
  }
  return "standard";
}

export function simulateBotDay(
  bot: ActorState,
  profile: BotProfile,
  contracts: ContractInstance[],
  bundle: ContentBundle,
  events: EventDef[],
  day: number,
  daySeed: number
): { bot: ActorState; logLines: string[] } {
  const nextBot = cloneActor(bot);
  const jobsById = new Map(bundle.jobs.map((job) => [job.id, job]));
  const contractsById = new Map(contracts.map((contract) => [contract.contractId, contract]));
  const intent = generateBotIntent(nextBot, profile, contracts, bundle, day, daySeed);
  const stance = getBotPreferredStance(profile);
  const rng = createRng(hashSeed(daySeed, "bot-sim", bot.actorId, day));
  const logLines: string[] = [];

  for (const assignment of intent.assignments) {
    const contract = contractsById.get(assignment.contractId);
    const job = contract ? jobsById.get(contract.jobId) : null;
    if (!contract || !job) {
      continue;
    }
    if (!hasUsableTools(nextBot, job.requiredTools)) {
      continue;
    }
    const mapping = getTaskSkillMapping(job, "do_work");
    const primaryRank = getSkillRank(nextBot, mapping.primary);
    const secondaryRank = mapping.secondary ? getSkillRank(nextBot, mapping.secondary) : primaryRank;
    const averageRank = Math.floor((primaryRank + secondaryRank) / 2);
    const qualityRoll =
      rng.nextInt(100) + averageRank * 8 + (stance === "careful" ? 15 : stance === "rush" ? -15 : 0) - (1 + job.tier) * 12;
    const qualityPoints = qualityRoll >= 90 ? 2 : qualityRoll >= 55 ? 1 : qualityRoll >= 25 ? -1 : -2;
    const adjustedRisk = clamp(
      getRiskValue(job, events) + (stance === "rush" ? 0.08 : stance === "careful" ? -0.05 : 0) - averageRank * 0.03,
      0,
      0.9
    );

    let outcome: "success" | "neutral" | "fail" = "success";
    if (isForcedNeutral(job, events)) {
      outcome = "neutral";
    } else if (rng.bool(adjustedRisk)) {
      outcome = "fail";
    } else if (qualityPoints < 0) {
      outcome = "neutral";
    }

    const payout = Math.round(job.basePayout * contract.payoutMult);
    let cashDelta = 0;
    let repDelta = 0;
    if (outcome === "success") {
      cashDelta = payout;
      repDelta = job.repGainSuccess + clamp(Math.floor(qualityPoints / 3), -3, 3);
    } else if (outcome === "neutral") {
      cashDelta = Math.round(payout * 0.5);
      repDelta = clamp(Math.floor(qualityPoints / 3), -3, 3);
    } else {
      cashDelta = 0;
      repDelta = -Math.abs(job.repLossFail);
    }

    nextBot.cash += cashDelta;
    nextBot.reputation = Math.max(0, nextBot.reputation + repDelta);
    nextBot.skills[mapping.primary] += 10 + (qualityPoints >= 2 ? 6 : qualityPoints >= 1 ? 3 : 1);
    if (mapping.secondary) {
      nextBot.skills[mapping.secondary] += 5;
    }
    for (const toolId of job.requiredTools) {
      const tool = nextBot.tools[toolId];
      if (!tool) {
        continue;
      }
      tool.durability = Math.max(0, tool.durability - Math.max(1, job.durabilityCost));
    }

    logLines.push(`${nextBot.name} logged a ${outcome} on ${job.name}.`);
  }

  return {
    bot: nextBot,
    logLines
  };
}

function cloneActor(actor: ActorState): ActorState {
  return {
    ...actor,
    districtUnlocks: [...actor.districtUnlocks],
    skills: { ...actor.skills },
    tools: Object.fromEntries(
      Object.entries(actor.tools).map(([toolId, tool]) => [toolId, { toolId: tool.toolId, durability: tool.durability }])
    ),
    crews: actor.crews.map((crew) => ({ ...crew }))
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
