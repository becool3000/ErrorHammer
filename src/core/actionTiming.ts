import { TaskStance } from "./types";

const BASE_ACTION_DURATION_MS: Record<TaskStance, number> = {
  rush: 1_500,
  standard: 3_000,
  careful: 6_000
};

const SKILL_SPEED_BASELINE_LEVEL = 1;
const SKILL_SPEED_PER_LEVEL = 0.05;
const SKILL_SPEED_MAX_REDUCTION = 0.45;

export function getSkillSpeedMultiplier(skillRank: number): number {
  const normalizedRank = Math.max(0, Math.floor(skillRank));
  const effectiveBonusLevels = Math.max(0, normalizedRank - SKILL_SPEED_BASELINE_LEVEL);
  const reduction = Math.min(SKILL_SPEED_MAX_REDUCTION, effectiveBonusLevels * SKILL_SPEED_PER_LEVEL);
  return 1 - reduction;
}

export function getScaledDurationMs(baseMs: number, skillRank: number): number {
  const multiplier = getSkillSpeedMultiplier(skillRank);
  return Math.max(1, Math.round(baseMs * multiplier));
}

export function getActionDurationMs(stance: TaskStance, allowOvertime: boolean, skillRank = SKILL_SPEED_BASELINE_LEVEL): number {
  const baseDuration = BASE_ACTION_DURATION_MS[stance];
  const overtimeAdjustedBase = allowOvertime ? baseDuration * 2 : baseDuration;
  return getScaledDurationMs(overtimeAdjustedBase, skillRank);
}
