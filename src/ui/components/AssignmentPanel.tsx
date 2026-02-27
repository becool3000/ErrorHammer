import { AssignmentIntent, ContractInstance, JobDef } from "../../core/types";

interface AssignmentPanelProps {
  assignments: AssignmentIntent[];
  contracts: ContractInstance[];
  jobsById: Map<string, JobDef>;
  onClear: () => void;
  onConfirm: () => void;
}

export function AssignmentPanel({ assignments, contracts, jobsById, onClear, onConfirm }: AssignmentPanelProps) {
  const contractById = new Map(contracts.map((contract) => [contract.contractId, contract]));

  return (
    <section className="card">
      <h2>Assignments</h2>
      {assignments.length === 0 ? <p>No assignments queued.</p> : null}
      {assignments.map((assignment) => {
        const contract = contractById.get(assignment.contractId);
        const job = contract ? jobsById.get(contract.jobId) : null;
        return (
          <p key={`${assignment.assignee}-${assignment.contractId}`}>
            {assignment.assignee}: {job?.name ?? assignment.contractId}
          </p>
        );
      })}
      <div className="stack-row">
        <button onClick={() => onClear()}>Clear</button>
        <button onClick={() => onConfirm()}>Confirm Day</button>
      </div>
    </section>
  );
}