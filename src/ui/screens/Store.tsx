import { bundle, useUiStore } from "../state";
import { SUPPLY_QUALITIES, formatSupplyQuality } from "../../core/playerFlow";

export function Store() {
  const game = useUiStore((state) => state.game);
  const buyTool = useUiStore((state) => state.buyTool);
  const repairTool = useUiStore((state) => state.repairTool);
  const buyFuel = useUiStore((state) => state.buyFuel);
  const goTo = useUiStore((state) => state.goTo);
  const notice = useUiStore((state) => state.notice);

  if (!game) {
    return (
      <main className="screen">
        <p>Open a game before visiting the store.</p>
        <button onClick={() => goTo("title")}>Back</button>
      </main>
    );
  }

  const atShop = !game.activeJob || game.activeJob.location === "shop";

  return (
    <main className="screen">
      <h2>{bundle.strings.storeTitle}</h2>
      <p>
        Cash: ${game.player.cash} | Fuel: {game.player.fuel}/{game.player.fuelMax}
      </p>
      {!atShop ? <p className="notice">Return to the shop before using the tool bench.</p> : null}

      <section className="card">
        <h3>Fuel Pump</h3>
        <div className="stack-row">
          <button onClick={() => buyFuel(1)} disabled={!atShop}>
            Buy 1 Fuel (${6})
          </button>
          <button onClick={() => buyFuel(game.player.fuelMax - game.player.fuel)} disabled={!atShop}>
            Fill Tank
          </button>
        </div>
      </section>

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
                <button onClick={() => buyTool(tool.id)} disabled={!atShop}>
                  Buy
                </button>
                <button onClick={() => repairTool(tool.id)} disabled={!atShop || !canRepair}>
                  Repair
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="card">
        <h3>{bundle.strings.homeSuppliesTitle}</h3>
        {Object.entries(game.shopSupplies).filter(([, stack]) => SUPPLY_QUALITIES.some((quality) => (stack?.[quality] ?? 0) > 0)).length === 0 ? (
          <p>No stock on hand.</p>
        ) : null}
        {Object.entries(game.shopSupplies)
          .filter(([, stack]) => SUPPLY_QUALITIES.some((quality) => (stack?.[quality] ?? 0) > 0))
          .map(([supplyId, stack]) => (
            <p key={supplyId}>
              {supplyId}:{" "}
              {SUPPLY_QUALITIES.filter((quality) => (stack?.[quality] ?? 0) > 0)
                .map((quality) => `${formatSupplyQuality(quality)} ${stack?.[quality]}`)
                .join(", ")}
            </p>
          ))}
      </section>

      {notice ? <p className="notice">{notice}</p> : null}
      <button onClick={() => goTo("main")}>Back To Main</button>
    </main>
  );
}
