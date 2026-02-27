import { useMemo } from "react";
import { DayReport } from "../components/DayReport";
import { AssignmentPanel } from "../components/AssignmentPanel";
import { ContractList } from "../components/ContractList";
import { StatsPanel } from "../components/StatsPanel";
import { bundle, useUiStore } from "../state";

export function Main() {
  const game = useUiStore((state) => state.game);
  const pendingAssignments = useUiStore((state) => state.pendingAssignments);
  const toggleAssignment = useUiStore((state) => state.toggleAssignment);
  const clearAssignments = useUiStore((state) => state.clearAssignments);
  const confirmDay = useUiStore((state) => state.confirmDay);
  const goTo = useUiStore((state) => state.goTo);
  const lastResult = useUiStore((state) => state.lastResult);

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

  return (
    <main className="screen main-screen">
      <section className="main-top">
        <StatsPanel day={game.day} player={game.player} activeEvents={activeEvents} />
        <ContractList
          contracts={game.contractBoard}
          player={game.player}
          jobsById={jobsById}
          pendingAssignments={pendingAssignments}
          onToggle={toggleAssignment}
        />
        <AssignmentPanel
          assignments={pendingAssignments}
          contracts={game.contractBoard}
          jobsById={jobsById}
          onClear={clearAssignments}
          onConfirm={confirmDay}
        />
      </section>

      <section className="main-actions">
        <button onClick={() => goTo("store")}>Store</button>
        <button onClick={() => goTo("company")}>Company</button>
      </section>

      {lastResult ? <DayReport result={lastResult} /> : null}
    </main>
  );
}