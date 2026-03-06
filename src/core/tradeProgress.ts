import { CoreTradeSkillId, GameState, SkillId } from "./types";

export const CORE_TRADE_SKILLS: CoreTradeSkillId[] = [
  "carpenter",
  "roofer",
  "landscaper",
  "welder",
  "electrician",
  "plumber",
  "hvac_technician",
  "drywall_installer",
  "painter",
  "flooring_installer",
  "finish_carpentry"
];

const DIRECT_TRACKS = new Set<SkillId>([
  "carpenter",
  "roofer",
  "landscaper",
  "welder",
  "electrician",
  "plumber",
  "hvac_technician",
  "drywall_installer",
  "painter",
  "flooring_installer"
]);

export function createTradeProgressState(locked: boolean): GameState["tradeProgress"] {
  const unlocked = Object.fromEntries(CORE_TRADE_SKILLS.map((skillId) => [skillId, !locked])) as Record<CoreTradeSkillId, boolean>;
  return {
    unlocked,
    unlockedDay: {}
  };
}

export function normalizeTradeProgressState(
  state: Partial<GameState["tradeProgress"]> | null | undefined,
  options: { legacyUnlockedByDefault: boolean; legacyUnlockedSkills?: Partial<Record<SkillId, boolean>> }
): GameState["tradeProgress"] {
  const base = createTradeProgressState(!options.legacyUnlockedByDefault);
  const unlocked = { ...base.unlocked };
  const unlockedDay: Partial<Record<CoreTradeSkillId, number>> = { ...base.unlockedDay };

  if (options.legacyUnlockedSkills) {
    for (const skillId of Object.keys(options.legacyUnlockedSkills) as SkillId[]) {
      if (!options.legacyUnlockedSkills[skillId]) {
        continue;
      }
      const track = mapSkillToCoreTrack(skillId);
      if (!track) {
        continue;
      }
      unlocked[track] = true;
    }
  }

  if (state?.unlocked) {
    for (const coreSkill of CORE_TRADE_SKILLS) {
      if (state.unlocked[coreSkill] !== undefined) {
        unlocked[coreSkill] = Boolean(state.unlocked[coreSkill]);
      }
    }
  }
  if (state?.unlockedDay) {
    for (const coreSkill of CORE_TRADE_SKILLS) {
      const day = state.unlockedDay[coreSkill];
      if (typeof day === "number" && Number.isFinite(day) && day > 0) {
        unlockedDay[coreSkill] = Math.floor(day);
      }
    }
  }

  return {
    unlocked,
    unlockedDay
  };
}

export function mapSkillToCoreTrack(skillId: SkillId): CoreTradeSkillId | null {
  if (DIRECT_TRACKS.has(skillId)) {
    return skillId as CoreTradeSkillId;
  }
  if (skillId === "cabinet_maker" || skillId === "millworker") {
    return "finish_carpentry";
  }
  return null;
}

export function isCoreTrackUnlocked(state: GameState, track: CoreTradeSkillId): boolean {
  return Boolean(state.tradeProgress.unlocked[track]);
}

export function unlockCoreTrack(state: GameState, track: CoreTradeSkillId): { unlockedNow: boolean; track: CoreTradeSkillId } {
  if (state.tradeProgress.unlocked[track]) {
    return { unlockedNow: false, track };
  }
  state.tradeProgress.unlocked[track] = true;
  state.tradeProgress.unlockedDay[track] = state.day;
  return { unlockedNow: true, track };
}

export function formatCoreTrackLabel(track: CoreTradeSkillId): string {
  if (track === "finish_carpentry") {
    return "Finish Carpentry";
  }
  return track
    .split("_")
    .map((word) => (word === "hvac" ? "HVAC" : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(" ");
}
