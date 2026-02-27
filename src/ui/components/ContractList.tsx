import { ActorState, AssignmentIntent, ContractInstance, JobDef } from "../../core/types";

interface ContractListProps {
  contracts: ContractInstance[];
  player: ActorState;
  jobsById: Map<string, JobDef>;
  pendingAssignments: AssignmentIntent[];
  onToggle: (contractId: string, assignee?: AssignmentIntent["assignee"]) => void;
}

export function ContractList({ contracts, player, jobsById, pendingAssignments, onToggle }: ContractListProps) {
  return (
    <section className="card">
      <h2>Contract Board</h2>
      {contracts.map((contract) => {
        const job = jobsById.get(contract.jobId);
        if (!job) {
          return null;
        }

        const selectedSelf = pendingAssignments.some(
          (item) => item.contractId === contract.contractId && item.assignee === "self"
        );

        return (
          <article key={contract.contractId} className="list-item">
            <h3>{job.name}</h3>
            <p>{job.flavor.client_quote}</p>
            <p>
              Payout: ${Math.round(job.basePayout * contract.payoutMult)} | Risk: {Math.round(job.risk * 100)}% | Stamina: {job.staminaCost}
            </p>
            <p>Tools: {job.requiredTools.join(", ")}</p>
            <div className="stack-row">
              <button onClick={() => onToggle(contract.contractId, "self")}>
                {selectedSelf ? "Unassign Self" : "Assign Self"}
              </button>
              {player.crews.map((crew) => {
                const selectedCrew = pendingAssignments.some(
                  (item) => item.contractId === contract.contractId && item.assignee === crew.crewId
                );
                return (
                  <button key={crew.crewId} onClick={() => onToggle(contract.contractId, crew.crewId)}>
                    {selectedCrew ? `Unassign ${crew.name}` : `Assign ${crew.name}`}
                  </button>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}