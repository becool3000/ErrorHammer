import {
  CorePerkId,
  GameState,
  JobDef,
  PerkArchetypeId,
  PerkArchetypeSnapshot,
  PerkTreeId,
  PerksState,
  SkillId,
  TaskId
} from "./types";

export const CORE_PERK_IDS: CorePerkId[] = [
  "precision",
  "blueprint_reading",
  "safety_awareness",
  "physical_endurance",
  "problem_solving",
  "estimating",
  "tool_mastery",
  "project_management",
  "diagnostics",
  "negotiation"
];

export const PERK_TREE_IDS: PerkTreeId[] = ["fundamentals", "safety", "finance", "specialization"];

const PERK_XP_PER_POINT = 40;

const PERK_TREE_FOR_PERK: Record<CorePerkId, PerkTreeId> = {
  precision: "fundamentals",
  blueprint_reading: "fundamentals",
  safety_awareness: "safety",
  physical_endurance: "safety",
  problem_solving: "specialization",
  estimating: "finance",
  tool_mastery: "fundamentals",
  project_management: "specialization",
  diagnostics: "specialization",
  negotiation: "finance"
};

const PRECISION_TRADES: SkillId[] = [
  "carpenter",
  "mason",
  "tile_setter",
  "welder",
  "glazier",
  "cabinet_maker",
  "millworker"
];

const DIAGNOSTIC_TRADES: SkillId[] = [
  "electrician",
  "hvac_technician",
  "refrigeration_technician",
  "auto_mechanic",
  "diesel_mechanic",
  "industrial_maintenance",
  "robotics_technician",
  "low_voltage_data_tech"
];

export interface TaskPerkModifiers {
  skillBonus: number;
  qualityBonus: number;
  payoutMultiplier: number;
  supplyDiscountPct: number;
  overtimeFatigueReduction: number;
  blueprintFirstTaskBonus: number;
}

export function createInitialPerksState(): PerksState {
  return {
    corePerks: createPerkLevelMap(0),
    corePerkXp: 0,
    corePerkPoints: 0,
    unlockedPerkTrees: createPerkTreeMap(true),
    rerollTokens: 0
  };
}

export function createLegacyPerksState(): PerksState {
  return {
    corePerks: createPerkLevelMap(1),
    corePerkXp: 120,
    corePerkPoints: 0,
    unlockedPerkTrees: createPerkTreeMap(true),
    rerollTokens: 0
  };
}

export function normalizePerksState(state: Partial<PerksState> | null | undefined, legacyDefaults = false): PerksState {
  const base = legacyDefaults ? createLegacyPerksState() : createInitialPerksState();
  const normalized: PerksState = {
    corePerks: { ...base.corePerks, ...(state?.corePerks ?? {}) },
    corePerkXp: Math.max(0, Math.floor(state?.corePerkXp ?? base.corePerkXp)),
    corePerkPoints: Math.max(0, Math.floor(state?.corePerkPoints ?? base.corePerkPoints)),
    unlockedPerkTrees: { ...base.unlockedPerkTrees, ...(state?.unlockedPerkTrees ?? {}) },
    rerollTokens: Math.max(0, Math.floor(state?.rerollTokens ?? base.rerollTokens))
  };

  for (const perkId of CORE_PERK_IDS) {
    normalized.corePerks[perkId] = Math.max(0, Math.floor(normalized.corePerks[perkId] ?? 0));
  }
  for (const treeId of PERK_TREE_IDS) {
    normalized.unlockedPerkTrees[treeId] = Boolean(normalized.unlockedPerkTrees[treeId]);
  }

  return normalized;
}

export function awardPerkXp(state: GameState, amount: number): void {
  if (amount <= 0) {
    return;
  }
  state.perks.corePerkXp += amount;
  while (state.perks.corePerkXp >= PERK_XP_PER_POINT) {
    state.perks.corePerkXp -= PERK_XP_PER_POINT;
    state.perks.corePerkPoints += 1;
  }
}

export function unlockPerkTree(state: GameState, treeId: PerkTreeId): void {
  state.perks.unlockedPerkTrees[treeId] = true;
}

export function spendPerkPoint(state: GameState, perkId: CorePerkId): { ok: boolean; notice: string } {
  if (state.perks.corePerkPoints <= 0) {
    return { ok: false, notice: "No perk points available." };
  }
  state.perks.corePerkPoints -= 1;
  state.perks.corePerks[perkId] = (state.perks.corePerks[perkId] ?? 0) + 1;
  return { ok: true, notice: `${formatPerkLabel(perkId)} increased to Lv ${state.perks.corePerks[perkId]}.` };
}

export function resetJobRerollTokens(state: GameState): void {
  state.perks.rerollTokens = Math.max(0, state.perks.corePerks.problem_solving ?? 0) > 0 ? 1 : 0;
}

export function consumeRerollToken(state: GameState): boolean {
  if (state.perks.rerollTokens <= 0) {
    return false;
  }
  state.perks.rerollTokens -= 1;
  return true;
}

export function getTaskPerkModifiers(state: GameState, job: JobDef, taskId: TaskId, isFirstUnit: boolean): TaskPerkModifiers {
  const perk = state.perks.corePerks;
  let skillBonus = 0;
  let qualityBonus = 0;

  if (PRECISION_TRADES.includes(job.primarySkill)) {
    skillBonus += Math.min(2, perk.precision ?? 0);
    qualityBonus += (perk.precision ?? 0) * 3;
  }
  if (DIAGNOSTIC_TRADES.includes(job.primarySkill)) {
    skillBonus += Math.min(2, perk.diagnostics ?? 0);
    qualityBonus += (perk.diagnostics ?? 0) * 2;
  }
  if ((perk.tool_mastery ?? 0) > 0) {
    skillBonus += Math.min(2, Math.floor(((perk.tool_mastery ?? 0) + 1) / 2));
  }
  if (taskId === "do_work" && (perk.project_management ?? 0) > 0) {
    skillBonus += Math.min(2, Math.floor(((perk.project_management ?? 0) + 1) / 2));
  }

  const blueprintFirstTaskBonus = isFirstUnit ? (perk.blueprint_reading ?? 0) : 0;
  const payoutMultiplier = 1 + Math.min(0.12, (perk.negotiation ?? 0) * 0.02);
  const supplyDiscountPct = Math.min(0.2, (perk.estimating ?? 0) * 0.03);
  const overtimeFatigueReduction = Math.min(2, perk.physical_endurance ?? 0);

  return {
    skillBonus,
    qualityBonus,
    payoutMultiplier,
    supplyDiscountPct,
    overtimeFatigueReduction,
    blueprintFirstTaskBonus
  };
}

export function formatPerkLabel(perkId: CorePerkId): string {
  switch (perkId) {
    case "precision":
      return "Precision";
    case "blueprint_reading":
      return "Blueprint Reading";
    case "safety_awareness":
      return "Safety Awareness";
    case "physical_endurance":
      return "Physical Endurance";
    case "problem_solving":
      return "Problem Solving";
    case "estimating":
      return "Estimating";
    case "tool_mastery":
      return "Tool Mastery";
    case "project_management":
      return "Project Management";
    case "diagnostics":
      return "Diagnostics";
    case "negotiation":
      return "Negotiation";
  }
}

export function getPerkTreeForPerk(perkId: CorePerkId): PerkTreeId {
  return PERK_TREE_FOR_PERK[perkId];
}

export function getPerkArchetypeSnapshot(state: GameState): PerkArchetypeSnapshot {
  const perk = state.perks.corePerks;
  const scores: Record<PerkArchetypeId, number> = {
    "precision-shop": (perk.precision ?? 0) * 3 + (perk.tool_mastery ?? 0) * 2 + (perk.blueprint_reading ?? 0) * 2,
    "safety-first": (perk.safety_awareness ?? 0) * 3 + (perk.physical_endurance ?? 0) * 2 + (perk.problem_solving ?? 0),
    "margin-master": (perk.estimating ?? 0) * 3 + (perk.negotiation ?? 0) * 2 + (perk.project_management ?? 0) * 2,
    "diagnostics-crew": (perk.diagnostics ?? 0) * 3 + (perk.problem_solving ?? 0) * 2 + (perk.blueprint_reading ?? 0),
    "field-closer": (perk.negotiation ?? 0) * 2 + (perk.tool_mastery ?? 0) * 2 + (perk.project_management ?? 0) * 2 + (perk.physical_endurance ?? 0)
  };

  const sorted = (Object.entries(scores) as Array<[PerkArchetypeId, number]>).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  const primary = sorted[0] && sorted[0][1] > 0 ? sorted[0][0] : null;
  const primaryScore = sorted[0]?.[1] ?? 0;
  const secondaryCandidate = sorted.find(([archetypeId, score]) => archetypeId !== primary && score > 0);
  const secondary =
    primary && secondaryCandidate && primaryScore > 0 && secondaryCandidate[1] >= Math.ceil(primaryScore * 0.7)
      ? secondaryCandidate[0]
      : null;

  const tags: string[] = [];
  if (primary) {
    tags.push(formatArchetypeLabel(primary));
  }
  if (secondary) {
    tags.push(formatArchetypeLabel(secondary));
  }

  return {
    primary,
    secondary,
    scores,
    tags
  };
}

export function formatArchetypeLabel(archetypeId: PerkArchetypeId): string {
  switch (archetypeId) {
    case "precision-shop":
      return "Precision Shop";
    case "safety-first":
      return "Safety First";
    case "margin-master":
      return "Margin Master";
    case "diagnostics-crew":
      return "Diagnostics Crew";
    case "field-closer":
      return "Field Closer";
  }
}

function createPerkLevelMap(value: number): Record<CorePerkId, number> {
  return Object.fromEntries(CORE_PERK_IDS.map((perkId) => [perkId, value])) as Record<CorePerkId, number>;
}

function createPerkTreeMap(value: boolean): Record<PerkTreeId, boolean> {
  return Object.fromEntries(PERK_TREE_IDS.map((treeId) => [treeId, value])) as Record<PerkTreeId, boolean>;
}
