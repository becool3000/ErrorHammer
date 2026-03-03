import { getOperatorLevel } from "./playerFlow";
import { ActorState, GameState, TRADE_SKILLS } from "./types";

export interface TradeIndexMetrics {
  reputation: number;
  cash: number;
  avgSkillXp: number;
  operatorLevel: number;
}

export interface TradeIndexEntry {
  actorId: string;
  name: string;
  companyName: string;
  isPlayer: boolean;
  rank: number;
  compositeScore: number;
  metrics: TradeIndexMetrics;
}

export interface TradeIndexSnapshot {
  playerRank: number;
  totalActors: number;
  entries: TradeIndexEntry[];
}

export function getTradeIndexSnapshot(state: GameState): TradeIndexSnapshot {
  const actors = [state.player, ...state.bots];
  const repPercentiles = buildPercentileMap(actors, (actor) => actor.reputation);
  const cashPercentiles = buildPercentileMap(actors, (actor) => actor.cash);
  const avgSkillPercentiles = buildPercentileMap(actors, (actor) => getAverageSkillXp(actor));

  const ranked = actors
    .map((actor) => {
      const isPlayer = actor.actorId === state.player.actorId;
      const metrics: TradeIndexMetrics = {
        reputation: actor.reputation,
        cash: actor.cash,
        avgSkillXp: getAverageSkillXp(actor),
        operatorLevel: getOperatorLevel(actor).level
      };
      const repPct = repPercentiles.get(actor.actorId) ?? 0;
      const cashPct = cashPercentiles.get(actor.actorId) ?? 0;
      const skillPct = avgSkillPercentiles.get(actor.actorId) ?? 0;
      const compositeScore = roundToTenth(repPct * 0.5 + cashPct * 0.3 + skillPct * 0.2);
      return {
        actorId: actor.actorId,
        name: actor.name,
        companyName: actor.companyName,
        isPlayer,
        compositeScore,
        metrics
      };
    })
    .sort((left, right) => {
      if (right.compositeScore !== left.compositeScore) {
        return right.compositeScore - left.compositeScore;
      }
      if (right.metrics.reputation !== left.metrics.reputation) {
        return right.metrics.reputation - left.metrics.reputation;
      }
      if (right.metrics.cash !== left.metrics.cash) {
        return right.metrics.cash - left.metrics.cash;
      }
      if (right.metrics.avgSkillXp !== left.metrics.avgSkillXp) {
        return right.metrics.avgSkillXp - left.metrics.avgSkillXp;
      }
      return left.actorId.localeCompare(right.actorId);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

  const playerRank = ranked.find((entry) => entry.isPlayer)?.rank ?? 0;
  return {
    playerRank,
    totalActors: ranked.length,
    entries: ranked
  };
}

function buildPercentileMap(actors: ActorState[], metric: (actor: ActorState) => number): Map<string, number> {
  const sorted = [...actors].sort((left, right) => {
    const delta = metric(right) - metric(left);
    if (delta !== 0) {
      return delta;
    }
    return left.actorId.localeCompare(right.actorId);
  });
  const total = sorted.length;
  const result = new Map<string, number>();
  for (let index = 0; index < sorted.length; index += 1) {
    const actor = sorted[index]!;
    const percentile = total <= 1 ? 100 : ((total - 1 - index) / (total - 1)) * 100;
    result.set(actor.actorId, percentile);
  }
  return result;
}

function getAverageSkillXp(actor: ActorState): number {
  const total = TRADE_SKILLS.reduce((sum, skillId) => sum + (actor.skills[skillId] ?? 0), 0);
  return total / TRADE_SKILLS.length;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

