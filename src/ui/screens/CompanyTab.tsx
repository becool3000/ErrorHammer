import { getCrewCapacity } from "../../core/playerFlow";
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
    const crewCapacity = getCrewCapacity();
    const canHire = game.player.companyLevel >= 2 && game.player.crews.length < crewCapacity;
    return (
      <section className="stack-block">
        <article className="chrome-card inset-card">
          <div className="section-label-row">
            <div>
              <p className="eyebrow">Crew Roster</p>
              <h3>
                {game.player.crews.length}/{crewCapacity} filled
              </h3>
            </div>
            <span className="chip">Level {game.player.companyLevel}</span>
          </div>
          <p className="muted-copy">
            {game.player.companyLevel >= 2
              ? "Hire one steady extra set of hands at a time."
              : "Reach company level 2 to unlock the first crew slot."}
          </p>
          <button className="ghost-button" onClick={() => hireCrew()} disabled={!canHire}>
            {game.player.crews.length >= crewCapacity ? "Crew Cap Reached" : "Hire Crew"}
          </button>
        </article>
        <div className="stack-list">
          {Array.from({ length: crewCapacity }, (_, index) => game.player.crews[index] ?? null).map((crew, index) =>
            crew ? (
              <article key={crew.crewId} className="chrome-card inset-card">
                <div className="section-label-row tight-row">
                  <strong>{crew.name}</strong>
                  <span className="chip">Crew Member</span>
                </div>
                <div className="metric-grid two-up">
                  <span>Efficiency {crew.efficiency}</span>
                  <span>Reliability {crew.reliability}</span>
                  <span>Morale {crew.morale}</span>
                  <span>Slot {index + 1}</span>
                </div>
              </article>
            ) : (
              <article key={`open-slot-${index + 1}`} className="chrome-card inset-card">
                <div className="section-label-row tight-row">
                  <strong>Open Slot {index + 1}</strong>
                  <span className="chip muted">{game.player.companyLevel >= 2 ? "Ready" : "Locked"}</span>
                </div>
                <p className="muted-copy">
                  {game.player.companyLevel >= 2 ? "This crew slot is ready to hire." : "Progress the company to unlock this slot."}
                </p>
              </article>
            )
          )}
        </div>
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
    <section className="tab-panel company-tab">
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
