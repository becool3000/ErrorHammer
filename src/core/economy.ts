import { createRng, hashSeed } from "./rng";
import { ContentBundle, ContractInstance, EventDef, JobDef } from "./types";

export interface ContractBoardOptions {
  count?: number;
  districtIds?: string[];
  maxTier?: number;
}

export function deriveCompanyLevel(reputation: number): number {
  if (reputation >= 120) {
    return 4;
  }
  if (reputation >= 70) {
    return 3;
  }
  if (reputation >= 30) {
    return 2;
  }
  return 1;
}

export function getPayoutMultiplier(job: JobDef, events: EventDef[]): number {
  return events.reduce((acc, event) => {
    if (!event.mods.payoutMultByTag) {
      return acc;
    }

    let modifier = 1;
    for (const tag of job.tags) {
      if (event.mods.payoutMultByTag[tag] !== undefined) {
        modifier *= event.mods.payoutMultByTag[tag]!;
      }
    }
    return acc * modifier;
  }, 1);
}

export function getRiskValue(job: JobDef, events: EventDef[]): number {
  const delta = events.reduce((acc, event) => {
    if (!event.mods.riskDeltaByTag) {
      return acc;
    }

    let adjustment = 0;
    for (const tag of job.tags) {
      if (event.mods.riskDeltaByTag[tag] !== undefined) {
        adjustment += event.mods.riskDeltaByTag[tag]!;
      }
    }
    return acc + adjustment;
  }, 0);

  return clamp(job.risk + delta, 0, 0.95);
}

export function isForcedNeutral(job: JobDef, events: EventDef[]): boolean {
  for (const event of events) {
    for (const tag of event.mods.forceNeutralTags ?? []) {
      if (job.tags.includes(tag)) {
        return true;
      }
    }
  }
  return false;
}

export function applyToolPriceModifiers(basePrice: number, events: EventDef[]): number {
  const modifier = events.reduce((acc, event) => {
    if (event.mods.toolPriceMult === undefined) {
      return acc;
    }
    return acc * event.mods.toolPriceMult;
  }, 1);

  return Math.max(1, Math.round(basePrice * modifier));
}

export function generateContractBoard(
  bundle: ContentBundle,
  day: number,
  daySeed: number,
  options: ContractBoardOptions = {}
): ContractInstance[] {
  const count = options.count ?? 8;
  const districtAllowList = new Set(options.districtIds ?? bundle.districts.map((district) => district.id));
  const maxTier = options.maxTier ?? 3;

  const eligible = bundle.jobs
    .filter((job) => districtAllowList.has(job.districtId) && job.tier <= maxTier)
    .sort((a, b) => a.id.localeCompare(b.id));

  const rng = createRng(hashSeed(daySeed, "board", day));
  const picked = eligible.length <= count ? fillFromPool(eligible, count, rng) : rng.shuffle(eligible).slice(0, count);

  return picked.map((job, index) => {
    const payoutMult = Number((0.9 + rng.next() * 0.25).toFixed(2));
    return {
      contractId: `D${day}-C${index + 1}-${job.id}`,
      jobId: job.id,
      districtId: job.districtId,
      payoutMult,
      expiresDay: day
    };
  });
}

function fillFromPool<T>(pool: T[], count: number, rng: ReturnType<typeof createRng>): T[] {
  if (pool.length === 0) {
    return [];
  }

  const output: T[] = [];
  while (output.length < count) {
    output.push(pool[rng.nextInt(pool.length)]!);
  }
  return output;
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