import { bundle, useUiStore } from "../state";

export function Store() {
  const game = useUiStore((state) => state.game);
  const buyTool = useUiStore((state) => state.buyTool);
  const repairTool = useUiStore((state) => state.repairTool);
  const goTo = useUiStore((state) => state.goTo);

  if (!game) {
    return (
      <main className="screen">
        <p>Open a game before visiting the store.</p>
        <button onClick={() => goTo("title")}>Back</button>
      </main>
    );
  }

  return (
    <main className="screen">
      <h2>{bundle.strings.storeTitle}</h2>
      <p>Cash: ${game.player.cash}</p>
      <div className="list">
        {bundle.tools.map((tool) => {
          const owned = game.player.tools[tool.id];
          const canRepair = Boolean(owned && owned.durability < tool.maxDurability);
          return (
            <article key={tool.id} className="card">
              <h3>{tool.name}</h3>
              <p>{tool.flavor.description}</p>
              <p>Price: ${tool.price}</p>
              <p>
                Durability: {owned ? `${owned.durability}/${tool.maxDurability}` : "not owned"}
              </p>
              <div className="stack-row">
                <button onClick={() => buyTool(tool.id)}>Buy</button>
                <button onClick={() => repairTool(tool.id)} disabled={!canRepair}>
                  Repair
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <button onClick={() => goTo("main")}>Back To Main</button>
    </main>
  );
}