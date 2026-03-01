import { bundle, useUiStore } from "../state";

interface CompanyTabProps {
  modalView?: "districts" | "crews" | "news";
}

export function CompanyTab({ modalView }: CompanyTabProps) {
  const game = useUiStore((state) => state.game);
  const openModal = useUiStore((state) => state.openModal);
  const hireCrew = useUiStore((state) => state.hireCrew);

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
      <article className="chrome-card inset-card">
        <p className="eyebrow">Crews</p>
        <p>{bundle.strings.crewDeferred}</p>
        <button className="ghost-button" onClick={() => hireCrew()} disabled>
          Hire Crew (Deferred)
        </button>
      </article>
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
    <section className="tab-panel company-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Firm Ledger</p>
            <h2>{bundle.strings.companyTitle}</h2>
            <p className="muted-copy">{game.player.companyName}</p>
          </div>
          <span className="chip">Level {game.player.companyLevel}</span>
        </div>
        <div className="metric-grid two-up">
          <span>Reputation {game.player.reputation}</span>
          <span>Districts {game.player.districtUnlocks.length}</span>
        </div>
      </article>

      <article className="chrome-card inset-card company-action-card">
        <div className="action-grid company-action-grid">
          <button className="primary-button" onClick={() => openModal("districts")}>
            {bundle.strings.companyDistrictButton}
          </button>
          <button className="ghost-button" onClick={() => openModal("crews")}>
            {bundle.strings.companyCrewButton}
          </button>
          <button className="ghost-button" onClick={() => openModal("news")}>
            {bundle.strings.companyNewsButton}
          </button>
        </div>
      </article>
    </section>
  );
}
