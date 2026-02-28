import { bundle, useUiStore } from "../state";

export function Company() {
  const game = useUiStore((state) => state.game);
  const hireCrew = useUiStore((state) => state.hireCrew);
  const goTo = useUiStore((state) => state.goTo);

  if (!game) {
    return (
      <main className="screen">
        <p>Open a game before viewing company status.</p>
        <button onClick={() => goTo("title")}>Back</button>
      </main>
    );
  }

  return (
    <main className="screen">
      <h2>{bundle.strings.companyTitle}</h2>
      <p>Reputation: {game.player.reputation}</p>
      <p>Company Level: {game.player.companyLevel}</p>
      <p>Unlocked Districts: {game.player.districtUnlocks.join(", ")}</p>

      <section className="card">
        <h3>Crews</h3>
        <p>{bundle.strings.crewDeferred}</p>
        <button onClick={() => hireCrew()} disabled>
          Hire Crew (Deferred)
        </button>
      </section>

      <section className="card">
        <h3>Competitor News</h3>
        {bundle.bots.map((bot) => (
          <p key={bot.id}>{bot.flavorLines[0]}</p>
        ))}
      </section>

      <button onClick={() => goTo("main")}>Back To Main</button>
    </main>
  );
}
