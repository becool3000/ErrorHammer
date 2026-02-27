import { createRng, hashSeed } from "./rng";
import { BotProfile, ContentBundle, ContractInstance, Intent, ActorState, GameState } from "./types";

interface ScoredContract {
  contractId: string;
  score: number;
  staminaCost: number;
}

export function generateBotIntent(
  actor: ActorState,
  profile: BotProfile,
  contracts: ContractInstance[],
  bundle: ContentBundle,
  day: number,
  daySeed: number
): Intent {
  const jobsById = new Map(bundle.jobs.map((job) => [job.id, job]));
  const rng = createRng(hashSeed(daySeed, "bot", actor.actorId, day));

  const scored: ScoredContract[] = contracts
    .map((contract) => {
      const job = jobsById.get(contract.jobId);
      if (!job) {
        return null;
      }
      if (!hasToolsForJob(actor, job.requiredTools)) {
        return null;
      }

      const expectedPayout = job.basePayout * contract.payoutMult;
      const score =
        expectedPayout * profile.weights.wCash +
        job.repGainSuccess * 35 * profile.weights.wRep -
        job.risk * 100 * profile.weights.wRiskAvoid +
        rng.next() * 0.01;

      return {
        contractId: contract.contractId,
        score,
        staminaCost: job.staminaCost
      };
    })
    .filter((item): item is ScoredContract => Boolean(item))
    .sort((a, b) => b.score - a.score);

  const assignments: Intent["assignments"] = [];
  let remainingStamina = actor.stamina;

  for (const candidate of scored) {
    if (remainingStamina < candidate.staminaCost) {
      continue;
    }

    assignments.push({
      assignee: "self",
      contractId: candidate.contractId
    });
    remainingStamina -= candidate.staminaCost;
  }

  return {
    actorId: actor.actorId,
    day,
    assignments
  };
}

export function generateBotIntents(state: GameState, bundle: ContentBundle, daySeed: number): Intent[] {
  const profileById = new Map<string, BotProfile>(bundle.bots.map((bot) => [bot.id, bot]));

  return state.bots.map((bot) => {
    const profile = profileById.get(bot.actorId) ?? bundle.bots[0];
    if (!profile) {
      return { actorId: bot.actorId, day: state.day, assignments: [] };
    }

    return generateBotIntent(bot, profile, state.contractBoard, bundle, state.day, daySeed);
  });
}

function hasToolsForJob(actor: ActorState, requiredTools: string[]): boolean {
  return requiredTools.every((toolId) => {
    const instance = actor.tools[toolId];
    return Boolean(instance && instance.durability > 0);
  });
}