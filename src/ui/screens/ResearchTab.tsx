import { useMemo } from "react";
import { getResearchProjectsWithStatus } from "../../core/research";
import { useUiStore } from "../state";

export function ResearchTab() {
  const game = useUiStore((state) => state.game);
  const startResearch = useUiStore((state) => state.startResearch);
  const projects = useMemo(() => (game ? getResearchProjectsWithStatus(game) : []), [game]);

  if (!game) {
    return null;
  }

  const facilityProjects = projects.filter((project) => project.unlockType === "facility");

  return (
    <section className="tab-panel research-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Facilities R&D</p>
            <h2>Operations Expansion</h2>
          </div>
          <span className="chip">Cash ${game.player.cash}</span>
        </div>
        <p className="muted-copy">Trade unlocks come from Baba G completions. Core perks are available in the Skills panel.</p>
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
          <p className="muted-copy">No active facilities project.</p>
        )}
      </article>

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Programs</p>
            <h3>Office, Yard, Dumpster</h3>
          </div>
        </div>
        <div className="stack-list research-skill-list">
          {facilityProjects.map((project) => (
            <article
              key={project.projectId}
              className={project.status === "locked" ? "task-summary research-row research-row-locked" : "task-summary research-row"}
            >
              <div className="section-label-row tight-row">
                <strong>{project.label}</strong>
                <span className="chip">${project.cost}</span>
              </div>
              <button
                className={project.status === "available" ? "ghost-button" : "ghost-button muted"}
                disabled={project.status !== "available"}
                onClick={() => startResearch(project.projectId)}
              >
                {renderResearchStatusLabel(project.status)}
              </button>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

function renderResearchStatusLabel(status: string): string {
  if (status === "completed") {
    return "Program Complete";
  }
  if (status === "in-progress") {
    return "In Progress";
  }
  if (status === "locked") {
    return "Locked";
  }
  return "Start Program";
}
