import { useMemo, useState } from "react";
import { getSkillDisplayRows, formatSkillLabel } from "../../core/playerFlow";
import { getTradeIndexSnapshot } from "../../core/tradeIndex";
import { ActorState } from "../../core/types";
import { Modal } from "../components/Modal";
import { formatNumberByAccountingClarity, obfuscateReadableText } from "../readability";
import { useUiStore } from "../state";

export function TradeIndexTab() {
  const game = useUiStore((state) => state.game);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);

  const snapshot = useMemo(() => (game ? getTradeIndexSnapshot(game) : null), [game]);
  const actorsById = useMemo(() => {
    if (!game) {
      return new Map<string, ActorState>();
    }
    return new Map<string, ActorState>([game.player, ...game.bots].map((actor) => [actor.actorId, actor]));
  }, [game]);

  if (!game || !snapshot) {
    return null;
  }

  const playerEntry = snapshot.entries.find((entry) => entry.isPlayer) ?? snapshot.entries[0] ?? null;
  const selectedEntry = selectedActorId ? snapshot.entries.find((entry) => entry.actorId === selectedActorId) ?? null : null;
  const selectedActor = selectedActorId ? actorsById.get(selectedActorId) ?? null : null;
  const selectedSkillRows = selectedActor ? getSkillDisplayRows(selectedActor) : [];

  return (
    <section className="tab-panel trade-index-tab">
      <article className="hero-card chrome-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Trade Index</p>
            <h2>Crew Rankings</h2>
          </div>
          <span className="chip tone-energy">Your Rank #{snapshot.playerRank} / {snapshot.totalActors}</span>
        </div>
        <div className="chip-grid">
          <span className="chip tone-info">Composite {playerEntry ? playerEntry.compositeScore.toFixed(1) : "0.0"}</span>
        </div>
        <p className="muted-copy">Rank uses Reputation, Cash, and Skill average.</p>
      </article>

      <article className="chrome-card inset-card trade-index-list">
        <div className="section-label-row">
          <strong>Ranked Operators</strong>
          <span className="chip">{snapshot.totalActors} total</span>
        </div>
        <div className="stack-list">
          {snapshot.entries.map((entry) => (
            <article key={entry.actorId} className={entry.isPlayer ? "task-summary trade-index-row trade-index-you" : "task-summary trade-index-row"}>
              <div className="section-label-row tight-row">
                <span className="trade-index-rank">#{entry.rank}</span>
                <strong>{entry.name}</strong>
                {entry.isPlayer ? <span className="chip tone-energy">You</span> : null}
              </div>
              <p className="muted-copy">{entry.companyName}</p>
              <div className="material-need-meta">
                <span>Cash {formatNumberByAccountingClarity(game, entry.metrics.cash, { currency: true })}</span>
                <span>Rep {entry.metrics.reputation}</span>
                <span>Lv {entry.metrics.operatorLevel}</span>
              </div>
              <div className="action-row">
                <button className="ghost-button" onClick={() => setSelectedActorId(entry.actorId)} aria-label={`Details ${entry.name}`}>
                  Details
                </button>
              </div>
            </article>
          ))}
        </div>
      </article>

      <Modal
        open={Boolean(selectedActor && selectedEntry)}
        title={`${selectedActor?.name ?? "Operator"} Profile`}
        onClose={() => setSelectedActorId(null)}
      >
        {selectedActor && selectedEntry ? (
          <section className="stack-block trade-index-profile">
            <article className="chrome-card inset-card">
              <div className="section-label-row">
                <div>
                  <p className="eyebrow">Profile</p>
                  <h3>{selectedActor.name}</h3>
                </div>
                <span className="chip">Rank #{selectedEntry.rank}</span>
              </div>
              <p className="muted-copy">{selectedActor.companyName}</p>
              <div className="metric-grid two-up">
                <span>Cash {formatNumberByAccountingClarity(game, selectedActor.cash, { currency: true })}</span>
                <span>Reputation {selectedActor.reputation}</span>
                <span>Company Level {selectedActor.companyLevel}</span>
                <span>Fuel {selectedActor.fuel}/{selectedActor.fuelMax}</span>
                <span className="tone-info">Composite {selectedEntry.compositeScore.toFixed(1)}</span>
                <span>Avg Skill XP {Math.round(selectedEntry.metrics.avgSkillXp)}</span>
              </div>
            </article>

            <article className="chrome-card inset-card">
              <div className="section-label-row">
                <strong>Skill Ledger</strong>
                <span className="chip">{selectedSkillRows.length} skills</span>
              </div>
              <div className="stack-list">
                {selectedSkillRows.map((skill) => (
                  <article key={skill.skillId} className="task-summary">
                    <div className="section-label-row tight-row">
                      <strong>{obfuscateReadableText(game, formatSkillLabel(skill.skillId), `trade-index:${selectedActor.actorId}:${skill.skillId}`)}</strong>
                      <span>Lv {skill.level}</span>
                    </div>
                    <div className="material-need-meta">
                      <span>{Math.round(skill.xp)} XP</span>
                      <span>{skill.needed === null ? "Maxed" : `${Math.round(skill.current)} / ${skill.needed}`}</span>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}
      </Modal>
    </section>
  );
}
