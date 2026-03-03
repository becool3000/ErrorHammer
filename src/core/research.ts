import {
  GameState,
  ResearchCategoryId,
  ResearchProjectState,
  ResearchProjectUnlockType,
  ResearchState,
  SkillId,
  TRADE_SKILLS
} from "./types";

export interface ResearchProjectDef {
  projectId: string;
  label: string;
  cost: number;
  daysRequired: number;
  unlockType: ResearchProjectUnlockType;
  categoryId?: ResearchCategoryId;
  skillId?: SkillId;
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
  "core-systems": ["electrician", "plumber", "hvac_technician", "solar_panel_installer", "insulation_installer"],
  structure: ["framer", "carpenter", "mason", "concrete_finisher", "scaffolder"],
  exterior: ["roofer", "siding_installer", "fence_installer", "glazier"],
  "interior-finish": ["drywall_installer", "painter", "flooring_installer", "cabinet_maker", "millworker"]
};

const BABA_PROJECT_ID = "rd-baba-network";
const CATEGORY_PREFIX = "rd-category";
const SKILL_PREFIX = "rd-skill";

const CATEGORY_LABELS: Record<ResearchCategoryId, string> = {
  "core-systems": "Core Systems Certification",
  structure: "Structure Certification",
  exterior: "Exterior Certification",
  "interior-finish": "Interior Finish Certification"
};

const SKILL_LABELS: Record<SkillId, string> = {
  electrician: "Electrician",
  plumber: "Plumber",
  carpenter: "Carpenter",
  mason: "Mason",
  concrete_finisher: "Concrete Finisher",
  roofer: "Roofer",
  hvac_technician: "HVAC Technician",
  drywall_installer: "Drywall Installer",
  painter: "Painter",
  flooring_installer: "Flooring Installer",
  glazier: "Glazier",
  insulation_installer: "Insulation Installer",
  framer: "Framer",
  siding_installer: "Siding Installer",
  fence_installer: "Fence Installer",
  cabinet_maker: "Cabinet Maker",
  millworker: "Millworker",
  scaffolder: "Scaffolder",
  solar_panel_installer: "Solar Panel Installer"
};

const RESEARCH_PROJECTS: ResearchProjectDef[] = [
  {
    projectId: BABA_PROJECT_ID,
    label: "Baba G Network",
    cost: 45,
    daysRequired: 1,
    unlockType: "baba"
  },
  ...(
    Object.keys(RESEARCH_CATEGORY_SKILLS) as ResearchCategoryId[]
  ).map((categoryId) => ({
    projectId: `${CATEGORY_PREFIX}-${categoryId}`,
    label: CATEGORY_LABELS[categoryId],
    cost: 60,
    daysRequired: 1,
    unlockType: "category" as const,
    categoryId
  })),
  ...TRADE_SKILLS.map((skillId) => ({
    projectId: `${SKILL_PREFIX}-${skillId}`,
    label: `${SKILL_LABELS[skillId]} Skill Unlock`,
    cost: 35,
    daysRequired: 1,
    unlockType: "skill" as const,
    skillId,
    categoryId: getResearchCategoryForSkill(skillId)
  }))
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
  return "structure";
}

export function createResearchStateLocked(): ResearchState {
  return {
    babaUnlocked: false,
    unlockedCategories: createCategoryUnlockMap(false),
    unlockedSkills: createSkillUnlockMap(false),
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
    if (project.unlockType === "skill") {
      if (!project.categoryId || !state.research.unlockedCategories[project.categoryId]) {
        return { ...project, status: "locked" };
      }
    }
    return { ...project, status: "available" };
  });
}

function createCategoryUnlockMap(value: boolean): Record<ResearchCategoryId, boolean> {
  return {
    "core-systems": value,
    structure: value,
    exterior: value,
    "interior-finish": value
  };
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
  }
}

function isProjectAlreadyUnlocked(state: GameState, project: ResearchProjectDef): boolean {
  if (project.unlockType === "baba") {
    return state.research.babaUnlocked;
  }
  if (project.unlockType === "category") {
    return Boolean(project.categoryId && state.research.unlockedCategories[project.categoryId]);
  }
  return Boolean(project.skillId && state.research.unlockedSkills[project.skillId]);
}

