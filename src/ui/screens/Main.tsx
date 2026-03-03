import { useMemo } from "react";
import { getCurrentTask, getSupplyUnitPrice } from "../../core/playerFlow";
import { DayReport } from "../components/DayReport";
import { AssignmentPanel } from "../components/AssignmentPanel";
import { ContractList } from "../components/ContractList";
import { StatsPanel } from "../components/StatsPanel";
import { bundle, useUiStore } from "../state";

export function Main() {
  const game = useUiStore((state) => state.game);
  const accept = useUiStore((state) => state.acceptContract);
  const setCartQuantity = useUiStore((state) => state.setCartQuantity);
  const performTask = useUiStore((state) => state.performTaskUnit);
  const endShift = useUiStore((state) => state.endShift);
  const goTo = useUiStore((state) => state.goTo);
  const lastAction = useUiStore((state) => state.lastAction);
  const notice = useUiStore((state) => state.notice);

  const jobsById = useMemo(() => new Map(bundle.jobs.map((job) => [job.id, job])), []);

  if (!game) {
    return (
      <main className="screen">
        <p>Start a new game first.</p>
        <button onClick={() => goTo("title")}>Back</button>
      </main>
    );
  }

  const activeEvents = bundle.events.filter((event) => game.activeEventIds.includes(event.id));
  const currentTask = getCurrentTask(game);
  const activeJob = game.activeJob;
  const activeJobDef = activeJob ? jobsById.get(activeJob.jobId) : null;
  const supplyPrices = new Map(bundle.supplies.map((supply) => [supply.id, getSupplyUnitPrice(supply, "medium", activeEvents)]));

  return (
    <main className="screen main-screen">
      <section className="main-top">
        <StatsPanel day={game.day} player={game.player} workday={game.workday} activeEvents={activeEvents} />
        {activeJob && activeJobDef ? (
          <AssignmentPanel
            activeJob={activeJob}
            job={activeJobDef}
            supplies={bundle.supplies}
            supplyPrices={supplyPrices}
            truckSupplies={game.truckSupplies}
            shopSupplies={game.shopSupplies}
            currentTask={currentTask}
            lastAction={lastAction}
            onSetCartQuantity={setCartQuantity}
            onPerformTask={performTask}
          />
        ) : (
          <ContractList contracts={game.contractBoard} player={game.player} jobsById={jobsById} onAccept={accept} />
        )}
        <DayReport game={game} lastAction={lastAction} />
      </section>

      <section className="main-actions">
        <button onClick={() => goTo("store")}>Store</button>
        <button onClick={() => goTo("company")}>Company</button>
        <button onClick={() => endShift()}>End Day</button>
      </section>

      {notice ? <p className="notice">{notice}</p> : null}
    </main>
  );
}
