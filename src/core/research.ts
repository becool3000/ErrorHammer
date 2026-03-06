import {
  FacilityUnlockId,
  GameState,
  PerkTreeId,
  ResearchCategoryId,
  ResearchProjectState,
  ResearchProjectUnlockType,
  ResearchState,
  SkillId,
  TRADE_SKILLS,
  TradeCategoryId
} from "./types";
import { unlockPerkTree } from "./perks";

export interface ResearchProjectDef {
  projectId: string;
  label: string;
  cost: number;
  daysRequired: number;
  unlockType: ResearchProjectUnlockType;
  categoryId?: ResearchCategoryId;
  skillId?: SkillId;
  facilityId?: FacilityUnlockId;
  perkTreeId?: PerkTreeId;
  requiresProjectIds?: string[];
}

export interface ResearchStartResult {
  ok: boolean;
  notice?: string;
  startedProject?: ResearchProjectState;
}

export interface ResearchAdvanceResult {
  progressed: boolean;
  logLines: string[];
  completedProject?: ResearchProjectState;
}

export type ResearchProjectStatus = "locked" | "available" | "in-progress" | "completed";

export interface ResearchProjectWithStatus extends ResearchProjectDef {
  status: ResearchProjectStatus;
  activeProgress?: {
    daysProgress: number;
    daysRequired: number;
  };
}

export const RESEARCH_CATEGORY_SKILLS: Record<ResearchCategoryId, SkillId[]> = {
  construction: ["carpenter", "framer", "mason", "concrete_finisher", "roofer", "siding_installer", "fence_installer", "scaffolder", "heavy_equipment_operator", "demolition_specialist"],
  "electrical-utility-power": ["electrician", "low_voltage_data_tech", "lineman", "solar_panel_installer"],
  "plumbing-pipe": ["plumber", "pipefitter", "steamfitter", "sprinkler_fitter", "gas_fitter"],
  "hvac-mechanical": ["hvac_technician", "refrigeration_technician", "boiler_technician", "sheet_metal_worker"],
  "metal-fabrication": ["welder", "metal_fabricator", "machinist", "cnc_operator", "blacksmith"],
  "automotive-engine": ["auto_mechanic", "diesel_mechanic", "small_engine_repair", "motorcycle_technician", "aircraft_mechanic"],
  "outdoor-utility-ground": ["landscaper", "arborist", "irrigation_technician", "well_driller"],
  "industrial-systems": ["industrial_maintenance", "millwright", "elevator_technician", "robotics_technician"],
  "finishing-specialty": ["drywall_installer", "painter", "flooring_installer", "glazier", "insulation_installer", "cabinet_maker", "millworker", "tile_setter", "upholsterer"]
};

export const TRADE_GROUPS: Array<{ id: TradeCategoryId; label: string; skills: SkillId[] }> = [
  { id: "construction", label: "Construction", skills: RESEARCH_CATEGORY_SKILLS.construction },
  { id: "electrical-utility-power", label: "Electrical & Utility", skills: RESEARCH_CATEGORY_SKILLS["electrical-utility-power"] },
  { id: "plumbing-pipe", label: "Plumbing & Pipe", skills: RESEARCH_CATEGORY_SKILLS["plumbing-pipe"] },
  { id: "hvac-mechanical", label: "HVAC & Mechanical", skills: RESEARCH_CATEGORY_SKILLS["hvac-mechanical"] },
  { id: "metal-fabrication", label: "Metal & Fabrication", skills: RESEARCH_CATEGORY_SKILLS["metal-fabrication"] },
  { id: "automotive-engine", label: "Automotive & Engine", skills: RESEARCH_CATEGORY_SKILLS["automotive-engine"] },
  { id: "outdoor-utility-ground", label: "Outdoor & Utility", skills: RESEARCH_CATEGORY_SKILLS["outdoor-utility-ground"] },
  { id: "industrial-systems", label: "Industrial Systems", skills: RESEARCH_CATEGORY_SKILLS["industrial-systems"] },
  { id: "finishing-specialty", label: "Finishing & Specialty", skills: RESEARCH_CATEGORY_SKILLS["finishing-specialty"] }
];

const FACILITY_PREFIX = "rd-facility";
const FACILITY_PROJECT_COST = {
  office: 140,
  yard: 180,
  dumpster: 100
} as const;

const RESEARCH_PROJECTS: ResearchProjectDef[] = [
  {
    projectId: `${FACILITY_PREFIX}-office`,
    label: "Facility Program: Office",
    cost: FACILITY_PROJECT_COST.office,
    daysRequired: 1,
    unlockType: "facility",
    facilityId: "office"
  },
  {
    projectId: `${FACILITY_PREFIX}-yard`,
    label: "Facility Program: Yard",
    cost: FACILITY_PROJECT_COST.yard,
    daysRequired: 1,
    unlockType: "facility",
    facilityId: "yard",
    requiresProjectIds: [`${FACILITY_PREFIX}-office`]
  },
  {
    projectId: `${FACILITY_PREFIX}-dumpster`,
    label: "Facility Program: Dumpster",
    cost: FACILITY_PROJECT_COST.dumpster,
    daysRequired: 1,
    unlockType: "facility",
    facilityId: "dumpster",
    requiresProjectIds: [`${FACILITY_PREFIX}-yard`]
  }
];

export function getResearchProjectCatalog(): ResearchProjectDef[] {
  return RESEARCH_PROJECTS;
}

export function getProjectById(projectId: string): ResearchProjectDef | null {
  return RESEARCH_PROJECTS.find((project) => project.projectId === projectId) ?? null;
}

export function getResearchCategoryForSkill(skillId: SkillId): ResearchCategoryId {
  for (const [categoryId, skillIds] of Object.entries(RESEARCH_CATEGORY_SKILLS) as Array<[ResearchCategoryId, SkillId[]]>) {
    if (skillIds.includes(skillId)) {
      return categoryId;
    }
  }
  return "construction";
}

export function isFacilityProjectComplete(research: ResearchState, facilityId: FacilityUnlockId): boolean {
  return research.completedProjectIds.includes(`${FACILITY_PREFIX}-${facilityId}`);
}

export function createResearchStateLocked(): ResearchState {
  return {
    babaUnlocked: true,
    unlockedCategories: createCategoryUnlockMap(true),
    unlockedSkills: createSkillUnlockMap(true),
    activeProject: null,
    completedProjectIds: []
  };
}

export function createResearchStateLegacyUnlocked(): ResearchState {
  return {
    babaUnlocked: true,
    unlockedCategories: createCategoryUnlockMap(true),
    unlockedSkills: createSkillUnlockMap(true),
    activeProject: null,
    completedProjectIds: []
  };
}

export function normalizeResearchState(state: Partial<ResearchState> | null | undefined, legacyDefaults = false): ResearchState {
  const base = legacyDefaults ? createResearchStateLegacyUnlocked() : createResearchStateLocked();
  return {
    babaUnlocked: state?.babaUnlocked ?? base.babaUnlocked,
    unlockedCategories: {
      ...base.unlockedCategories,
      ...(state?.unlockedCategories ?? {})
    },
    unlockedSkills: {
      ...base.unlockedSkills,
      ...(state?.unlockedSkills ?? {})
    },
    activeProject: state?.activeProject
      ? {
          ...state.activeProject,
          daysProgress: Math.max(0, state.activeProject.daysProgress ?? 0),
          daysRequired: Math.max(1, state.activeProject.daysRequired ?? 1),
          cost: Math.max(0, state.activeProject.cost ?? 0),
          startedDay: Math.max(1, state.activeProject.startedDay ?? 1)
        }
      : null,
    completedProjectIds: Array.isArray(state?.completedProjectIds) ? [...state.completedProjectIds] : []
  };
}

export function isSkillUnlocked(research: ResearchState, skillId: SkillId): boolean {
  return Boolean(research.unlockedSkills[skillId]);
}

export function canStartResearchProject(state: GameState, projectId: string): ResearchStartResult {
  const project = getProjectById(projectId);
  if (!project) {
    return { ok: false, notice: "Unknown research project." };
  }
  if (state.research.activeProject) {
    return { ok: false, notice: "A research project is already running." };
  }
  if (state.research.completedProjectIds.includes(project.projectId)) {
    return { ok: false, notice: "That research is already complete." };
  }
  if (state.player.cash < project.cost) {
    return { ok: false, notice: `Need $${project.cost - state.player.cash} more cash to start research.` };
  }
  if (project.unlockType === "baba" && state.research.babaUnlocked) {
    return { ok: false, notice: "Baba G network is already unlocked." };
  }
  if (project.unlockType === "category") {
    if (!project.categoryId) {
      return { ok: false, notice: "Category project data is incomplete." };
    }
    if (state.research.unlockedCategories[project.categoryId]) {
      return { ok: false, notice: "That trade category is already unlocked." };
    }
  }
  if (project.unlockType === "skill") {
    if (!project.skillId || !project.categoryId) {
      return { ok: false, notice: "Skill project data is incomplete." };
    }
    if (!state.research.unlockedCategories[project.categoryId]) {
      return { ok: false, notice: "Unlock the parent trade category first." };
    }
    if (state.research.unlockedSkills[project.skillId]) {
      return { ok: false, notice: "That skill is already unlocked." };
    }
  }
  if (project.requiresProjectIds?.some((requiredId) => !state.research.completedProjectIds.includes(requiredId))) {
    return { ok: false, notice: "Finish prerequisite research first." };
  }
  return { ok: true };
}

export function startResearchProject(state: GameState, projectId: string): ResearchStartResult {
  const gate = canStartResearchProject(state, projectId);
  if (!gate.ok) {
    return gate;
  }
  const project = getProjectById(projectId);
  if (!project) {
    return { ok: false, notice: "Unknown research project." };
  }

  state.player.cash -= project.cost;
  state.research.activeProject = {
    projectId: project.projectId,
    label: project.label,
    cost: project.cost,
    daysRequired: project.daysRequired,
    daysProgress: 0,
    unlockType: project.unlockType,
    categoryId: project.categoryId,
    skillId: project.skillId,
    facilityId: project.facilityId,
    perkTreeId: project.perkTreeId,
    startedDay: state.day
  };

  return { ok: true, startedProject: state.research.activeProject };
}

export function advanceResearchProgress(state: GameState): ResearchAdvanceResult {
  const activeProject = state.research.activeProject;
  if (!activeProject) {
    return { progressed: false, logLines: [] };
  }

  activeProject.daysProgress += 1;
  const logLines = [`Research progress: ${activeProject.label} ${activeProject.daysProgress}/${activeProject.daysRequired}.`];

  if (activeProject.daysProgress < activeProject.daysRequired) {
    return { progressed: true, logLines };
  }

  applyResearchUnlock(state, activeProject);
  state.research.completedProjectIds = [...state.research.completedProjectIds, activeProject.projectId];
  state.research.activeProject = null;
  logLines.push(`Research complete: ${activeProject.label}.`);
  return {
    progressed: true,
    logLines,
    completedProject: activeProject
  };
}

export function getResearchProjectsWithStatus(state: GameState): ResearchProjectWithStatus[] {
  return RESEARCH_PROJECTS.map((project) => {
    if (state.research.activeProject?.projectId === project.projectId) {
      return {
        ...project,
        status: "in-progress",
        activeProgress: {
          daysProgress: state.research.activeProject.daysProgress,
          daysRequired: state.research.activeProject.daysRequired
        }
      };
    }
    if (state.research.completedProjectIds.includes(project.projectId) || isProjectAlreadyUnlocked(state, project)) {
      return { ...project, status: "completed" };
    }
    if (project.requiresProjectIds?.some((requiredId) => !state.research.completedProjectIds.includes(requiredId))) {
      return { ...project, status: "locked" };
    }
    if (project.unlockType === "skill" && project.categoryId && !state.research.unlockedCategories[project.categoryId]) {
      return { ...project, status: "locked" };
    }
    return { ...project, status: "available" };
  });
}

function createCategoryUnlockMap(value: boolean): Record<ResearchCategoryId, boolean> {
  return Object.fromEntries((Object.keys(RESEARCH_CATEGORY_SKILLS) as ResearchCategoryId[]).map((key) => [key, value])) as Record<
    ResearchCategoryId,
    boolean
  >;
}

function createSkillUnlockMap(value: boolean): Record<SkillId, boolean> {
  return Object.fromEntries(TRADE_SKILLS.map((skillId) => [skillId, value])) as Record<SkillId, boolean>;
}

function applyResearchUnlock(state: GameState, activeProject: ResearchProjectState): void {
  if (activeProject.unlockType === "baba") {
    state.research.babaUnlocked = true;
    return;
  }
  if (activeProject.unlockType === "category" && activeProject.categoryId) {
    state.research.unlockedCategories[activeProject.categoryId] = true;
    return;
  }
  if (activeProject.unlockType === "skill" && activeProject.skillId) {
    state.research.unlockedSkills[activeProject.skillId] = true;
    return;
  }
  if (activeProject.unlockType === "perk-tree" && activeProject.perkTreeId) {
    unlockPerkTree(state, activeProject.perkTreeId);
  }
}

function isProjectAlreadyUnlocked(state: GameState, project: ResearchProjectDef): boolean {
  if (project.unlockType === "baba") {
    return state.research.babaUnlocked;
  }
  if (project.unlockType === "category") {
    return Boolean(project.categoryId && state.research.unlockedCategories[project.categoryId]);
  }
  if (project.unlockType === "skill") {
    return Boolean(project.skillId && state.research.unlockedSkills[project.skillId]);
  }
  if (project.unlockType === "facility") {
    return Boolean(project.facilityId && isFacilityProjectComplete(state.research, project.facilityId));
  }
  return Boolean(project.perkTreeId && state.perks.unlockedPerkTrees[project.perkTreeId]);
}

function formatSkillLabel(skillId: SkillId): string {
  return skillId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
