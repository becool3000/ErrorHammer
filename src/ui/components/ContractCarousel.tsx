import { ContractInstance, JobDef } from "../../core/types";

interface ContractCarouselProps {
  contracts: ContractInstance[];
  jobsById: Map<string, JobDef>;
  selectedContractId: string | null;
  onSelect: (contractId: string) => void;
}

export function ContractCarousel({ contracts, jobsById, selectedContractId, onSelect }: ContractCarouselProps) {
  return (
    <div className="contract-carousel" role="tablist" aria-label="Contract board carousel">
      {contracts.map((contract) => {
        const job = jobsById.get(contract.jobId);
        if (!job) {
          return null;
        }
        const active = contract.contractId === selectedContractId;
        return (
          <button
            key={contract.contractId}
            className={active ? "carousel-card active" : "carousel-card"}
            onClick={() => onSelect(contract.contractId)}
            role="tab"
            aria-selected={active}
          >
            <strong>{job.name}</strong>
            <span>${Math.round(job.basePayout * contract.payoutMult)}</span>
            <small>{Math.round(job.risk * 100)}% risk</small>
          </button>
        );
      })}
    </div>
  );
}
