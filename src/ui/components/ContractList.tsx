import { ActorState, ContractInstance, JobDef } from "../../core/types";

interface ContractListProps {
  contracts: ContractInstance[];
  player: ActorState;
  jobsById: Map<string, JobDef>;
  onAccept: (contractId: string) => void;
}

export function ContractList({ contracts, player, jobsById, onAccept }: ContractListProps) {
  return (
    <section className="card">
      <h2>Contract Board</h2>
      {contracts.length === 0 ? <p>No open contracts this shift.</p> : null}
      {contracts.map((contract) => {
        const job = jobsById.get(contract.jobId);
        if (!job) {
          return null;
        }

        const hasTools = job.requiredTools.every((toolId) => (player.tools[toolId]?.durability ?? 0) > 0);
        const payout = Math.round(job.basePayout * contract.payoutMult);

        return (
          <article key={contract.contractId} className="list-item">
            <h3>{job.name}</h3>
            <p>{job.flavor.client_quote}</p>
            <p>
              Payout: ${payout} | Work Units: {job.workUnits} | Risk: {Math.round(job.risk * 100)}%
            </p>
            <p>Tools: {job.requiredTools.join(", ")}</p>
            <p>
              Materials:{" "}
              {job.materialNeeds.map((material) => `${material.supplyId} x${material.quantity}`).join(", ")}
            </p>
            <div className="stack-row">
              <button onClick={() => onAccept(contract.contractId)} disabled={!hasTools}>
                {hasTools ? "Accept Job" : "Missing Tools"}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
