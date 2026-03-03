import { useMemo } from "react";
import { formatSkillLabel } from "../../core/playerFlow";
import { getResearchProjectsWithStatus, RESEARCH_CATEGORY_SKILLS } from "../../core/research";
import { ResearchCategoryId } from "../../core/types";
import { useUiStore } from "../state";

const CATEGORY_ORDER: ResearchCategoryId[] = ["core-systems", "structure", "exterior", "interior-finish"];

function formatCategoryLabel(categoryId: ResearchCategoryId): string {
  if (categoryId === "core-systems") {
    return "Core Systems";
  }
  if (categoryId === "interior-finish") {
    return "Interior Finish";
  }
  return categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

export function ResearchTab() {
  const game = useUiStore((state) => state.game);
  const startResearch = useUiStore((state) => state.startResearch);

  const projects = useMemo(() => (game ? getResearchProjectsWithStatus(game) : []), [game]);

  if (!game) {
    return null;
  }

  const babaProject = projects.find((project) => project.projectId === "rd-baba-network") ?? null;

  return (
    <section className="tab-panel research-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Research Queue</p>
            <h2>Unlock Trade Work</h2>
          </div>
          <span className="chip">Cash ${game.player.cash}</span>
        </div>
        <p className="muted-copy">Start with Day Labor, unlock Baba G second, then unlock categories and skills.</p>
        {game.research.activeProject ? (
          <div className="task-summary research-active-card">
            <div className="section-label-row tight-row">
              <strong>{game.research.activeProject.label}</strong>
              <span className="chip">
                {game.research.activeProject.daysProgress}/{game.research.activeProject.daysRequired} day
              </span>
            </div>
            <p className="muted-copy">Progress advances when you End Day.</p>
          </div>
        ) : (
          <p className="muted-copy">No active project. Start one below.</p>
        )}
      </article>

      {babaProject ? (
        <article className="chrome-card inset-card">
          <div className="section-label-row tight-row">
            <div>
              <p className="eyebrow">Baba Network</p>
              <strong>{babaProject.label}</strong>
            </div>
            <span className="chip">${babaProject.cost}</span>
          </div>
          <p className="muted-copy">Unlocks Baba G pinned fallback offers in slot #2.</p>
          <button
            className={babaProject.status === "available" ? "primary-button" : "ghost-button"}
            disabled={babaProject.status !== "available"}
            onClick={() => startResearch(babaProject.projectId)}
          >
            {babaProject.status === "completed"
              ? "Unlocked"
              : babaProject.status === "in-progress"
                ? "In Progress"
                : babaProject.status === "locked"
                  ? "Locked"
                  : "Start Research"}
          </button>
        </article>
      ) : null}

      <div className="stack-list">
        {CATEGORY_ORDER.map((categoryId) => {
          const categoryProject = projects.find((project) => project.projectId === `rd-category-${categoryId}`) ?? null;
          const skillProjects = projects.filter(
            (project) => project.unlockType === "skill" && project.categoryId === categoryId && project.skillId
          );

          return (
            <article key={categoryId} className="chrome-card inset-card">
              <div className="section-label-row">
                <div>
                  <p className="eyebrow">Trade Category</p>
                  <h3>{formatCategoryLabel(categoryId)}</h3>
                </div>
                {categoryProject ? <span className="chip">${categoryProject.cost}</span> : null}
              </div>
              {categoryProject ? (
                <button
                  className={categoryProject.status === "available" ? "primary-button" : "ghost-button"}
                  disabled={categoryProject.status !== "available"}
                  onClick={() => startResearch(categoryProject.projectId)}
                >
                  {categoryProject.status === "completed"
                    ? "Category Unlocked"
                    : categoryProject.status === "in-progress"
                      ? "In Progress"
                      : categoryProject.status === "locked"
                        ? "Locked"
                        : "Unlock Category"}
                </button>
              ) : null}

              <div className="stack-list research-skill-list">
                {RESEARCH_CATEGORY_SKILLS[categoryId].map((skillId) => {
                  const skillProject = skillProjects.find((project) => project.skillId === skillId) ?? null;
                  if (!skillProject) {
                    return null;
                  }
                  return (
                    <article
                      key={skillId}
                      className={
                        skillProject.status === "locked"
                          ? "task-summary research-row research-row-locked"
                          : "task-summary research-row"
                      }
                    >
                      <div className="section-label-row tight-row">
                        <strong>{formatSkillLabel(skillId)}</strong>
                        <span className="chip">${skillProject.cost}</span>
                      </div>
                      <button
                        className={skillProject.status === "available" ? "ghost-button" : "ghost-button muted"}
                        disabled={skillProject.status !== "available"}
                        onClick={() => startResearch(skillProject.projectId)}
                      >
                        {skillProject.status === "completed"
                          ? "Unlocked"
                          : skillProject.status === "in-progress"
                            ? "In Progress"
                            : skillProject.status === "locked"
                              ? "Locked"
                              : "Unlock Skill"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
