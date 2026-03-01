import { bundle, CompanyPanelId, useUiStore } from "../state";
import { SegmentedControl } from "../components/SegmentedControl";

const companyPanels: Array<{ id: CompanyPanelId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "districts", label: "Districts" },
  { id: "crews", label: "Crews" },
  { id: "news", label: "News" }
];

interface CompanyTabProps {
  modalView?: "districts" | "crews" | "news";
}

export function CompanyTab({ modalView }: CompanyTabProps) {
  const game = useUiStore((state) => state.game);
  const companyPanel = useUiStore((state) => state.companyPanel);
  const setCompanyPanel = useUiStore((state) => state.setCompanyPanel);
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
          </div>
          <span className="chip">Level {game.player.companyLevel}</span>
        </div>
        <SegmentedControl value={companyPanel} options={companyPanels} onChange={setCompanyPanel} label="Company panels" />
        <div className="metric-grid two-up">
          <span>Reputation {game.player.reputation}</span>
          <span>Districts {game.player.districtUnlocks.length}</span>
        </div>
      </article>

      <article className="chrome-card inset-card">
        <p className="eyebrow">Overview</p>
        <div className="overview-stack">
          <button className="compact-row-card action-card" onClick={() => openModal("districts")}>
            <div>
              <strong>District Access</strong>
              <p>{game.player.districtUnlocks.join(", ")}</p>
            </div>
            <span className="chip">Open</span>
          </button>
          <button className="compact-row-card action-card" onClick={() => openModal("crews")}>
            <div>
              <strong>Crew Status</strong>
              <p>{bundle.strings.crewDeferred}</p>
            </div>
            <span className="chip">Deferred</span>
          </button>
          <button className="compact-row-card action-card" onClick={() => openModal("news")}>
            <div>
              <strong>Competitor News</strong>
              <p>{bundle.bots[0]?.flavorLines[0] ?? "No headlines."}</p>
            </div>
            <span className="chip">Rotate</span>
          </button>
        </div>
      </article>
    </section>
  );
}
