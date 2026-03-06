import { createRng, hashSeed } from "./rng";
import { ContentBundle, ContractInstance, EventDef, JobDef, TRADE_SKILLS } from "./types";
import { getResearchCategoryForSkill, TRADE_GROUPS } from "./research";

export interface ContractBoardOptions {
  count?: number;
  districtIds?: string[];
  maxTier?: number;
}

const BABA_G_MIN_RISK = 0.6;

export function deriveCompanyLevel(reputation: number): number {
  if (reputation >= 120) {
    return 4;
  }
  if (reputation >= 70) {
    return 3;
  }
  if (reputation >= 18) {
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

  const resolvedRisk = job.risk + delta;
  if (job.tags.includes("baba-g")) {
    return clamp(Math.max(BABA_G_MIN_RISK, resolvedRisk), 0, 0.95);
  }
  return clamp(resolvedRisk, 0, 0.95);
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
  const defaultCompactCount = 8;
  const count = Math.min(TRADE_SKILLS.length, Math.max(1, options.count ?? defaultCompactCount));
  const districtAllowList = new Set(options.districtIds ?? bundle.districts.map((district) => district.id));
  const maxTier = options.maxTier ?? 3;

  const picked: JobDef[] = [];
  const categoryOrder = TRADE_GROUPS.map((group) => group.id);
  const categoryWindow = Math.min(count, categoryOrder.length);
  const startIndex = Math.max(0, (day - 1) % categoryOrder.length);
  const selectedCategories = Array.from({ length: categoryWindow }, (_, index) => categoryOrder[(startIndex + index) % categoryOrder.length]!);
  const selectedSkills = new Set<string>();

  for (const categoryId of selectedCategories) {
    const group = TRADE_GROUPS.find((entry) => entry.id === categoryId);
    if (!group || group.skills.length === 0) {
      continue;
    }
    const rng = createRng(hashSeed(daySeed, "group", day, categoryId));
    const bySkill = [...group.skills];
    const skillId = bySkill[rng.nextInt(bySkill.length)]!;
    selectedSkills.add(skillId);
    const job = pickJobForSkill(bundle, skillId, districtAllowList, maxTier, daySeed, day);
    if (job) {
      picked.push(job);
    }
  }

  if (picked.length < count) {
    const remainingSkills = TRADE_SKILLS.filter((skillId) => !selectedSkills.has(skillId));
    const fillRng = createRng(hashSeed(daySeed, "fill", day));
    while (picked.length < count && remainingSkills.length > 0) {
      const index = fillRng.nextInt(remainingSkills.length);
      const [skillId] = remainingSkills.splice(index, 1);
      if (!skillId) {
        break;
      }
      const job = pickJobForSkill(bundle, skillId, districtAllowList, maxTier, daySeed, day);
      if (job) {
        picked.push(job);
      }
    }
  }

  return picked.map((job, index) => {
    const payoutRng = createRng(hashSeed(daySeed, "payout", day, job.id, index));
    const payoutMult = Number((0.9 + payoutRng.next() * 0.25).toFixed(2));
    return {
      contractId: `D${day}-C${index + 1}-${job.id}`,
      jobId: job.id,
      districtId: job.districtId,
      payoutMult,
      expiresDay: day
    };
  });
}

function pickJobForSkill(
  bundle: ContentBundle,
  skillId: (typeof TRADE_SKILLS)[number],
  districtAllowList: Set<string>,
  maxTier: number,
  daySeed: number,
  day: number
): JobDef | null {
  const bySkill = bundle.jobs
    .filter((job) => job.primarySkill === skillId)
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  if (bySkill.length === 0) {
    return null;
  }

  const eligible = bySkill.filter((job) => districtAllowList.has(job.districtId) && job.tier <= maxTier);
  if (eligible.length > 0) {
    const skillRng = createRng(hashSeed(daySeed, "board", day, skillId, getResearchCategoryForSkill(skillId), "eligible"));
    return eligible[skillRng.nextInt(eligible.length)]!;
  }

  const lowestTier = bySkill[0]!.tier;
  const lowestTierPool = bySkill.filter((job) => job.tier === lowestTier);
  const fallbackRng = createRng(hashSeed(daySeed, "board", day, skillId, "fallback"));
  return lowestTierPool[fallbackRng.nextInt(lowestTierPool.length)]!;
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
