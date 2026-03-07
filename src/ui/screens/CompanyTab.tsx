import { bundle, useUiStore } from "../state";

interface CompanyTabProps {
  modalView?: "districts" | "crews" | "news";
  showOverview?: boolean;
}

export function CompanyTab({ modalView, showOverview = true }: CompanyTabProps) {
  const game = useUiStore((state) => state.game);
  const openModal = useUiStore((state) => state.openModal);

  if (!game) {
    return null;
  }

  if (modalView === "districts") {
    return (
      <section className="stack-block">
        <div className="chip-grid">
          {game.player.districtUnlocks.map((districtId) => {
            const district = bundle.districts.find((entry) => entry.id === districtId);
            return (
              <article key={districtId} className="chrome-card inset-card">
                <p className="eyebrow">District</p>
                <h3>{district?.name ?? districtId}</h3>
                <p>{district?.flavor.description ?? districtId}</p>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (modalView === "crews") {
    return (
      <section className="stack-block">
        <article className="chrome-card inset-card">
          <div className="section-label-row">
            <div>
              <p className="eyebrow">Crew</p>
              <h3>Crew: Coming Soon</h3>
            </div>
            <span className="chip">Frozen</span>
          </div>
          <p className="muted-copy">Crew hiring and assignment are temporarily disabled while the system is being refactored.</p>
        </article>
        <article className="chrome-card inset-card">
          <p className="eyebrow">Roster Archive</p>
          {game.player.crews.length > 0 ? (
            <div className="chip-grid">
              {game.player.crews.map((crew) => (
                <span key={crew.crewId} className="chip muted">
                  {crew.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No crew members on file.</p>
          )}
        </article>
      </section>
    );
  }

  if (modalView === "news") {
    return (
      <section className="stack-block">
        {bundle.bots.map((bot) => (
          <article key={bot.id} className="chrome-card inset-card">
            <p className="eyebrow">{bot.name}</p>
            <p>{bot.flavorLines.join(" ")}</p>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section className={showOverview ? "tab-panel company-tab" : "stack-list company-hub-stack"}>
      {showOverview ? (
        <article className="hero-card chrome-card">
          <div className="section-label-row">
            <div>
              <h2>{game.player.companyName}</h2>
            </div>
            <span className="chip">Level {game.player.companyLevel}</span>
          </div>
          <div className="metric-grid two-up">
            <span>Reputation {game.player.reputation}</span>
            <span>Districts {game.player.districtUnlocks.length}</span>
          </div>
        </article>
      ) : null}
      <article className="chrome-card inset-card company-action-card">
        <div className="action-grid company-action-grid">
          <button className="primary-button" onClick={() => openModal("districts")}>
            {bundle.strings.companyDistrictButton}
          </button>
          <button className="ghost-button" onClick={() => openModal("crews")}>
            Crew: Coming Soon
          </button>
          <button className="ghost-button" onClick={() => openModal("news")}>
            {bundle.strings.companyNewsButton}
          </button>
        </div>
      </article>
    </section>
  );
}
