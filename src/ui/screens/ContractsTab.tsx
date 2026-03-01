import { useMemo } from "react";
import { JobDef } from "../../core/types";
import { bundle, useUiStore } from "../state";
import { ContractCarousel } from "../components/ContractCarousel";

export function ContractsTab() {
  const game = useUiStore((state) => state.game);
  const selectedContractId = useUiStore((state) => state.selectedContractId);
  const selectContract = useUiStore((state) => state.selectContract);
  const accept = useUiStore((state) => state.acceptContract);

  const jobsById = useMemo(() => new Map(bundle.jobs.map((job) => [job.id, job])), []);

  if (!game) {
    return null;
  }

  if (game.activeJob) {
    return (
      <section className="tab-panel">
        <article className="hero-card chrome-card">
          <p className="eyebrow">Contract Board</p>
          <h2>Board is locked</h2>
          <p>Finish the current job to open the next batch of contracts.</p>
          <div className="chip-grid">
            <span className="chip">{game.activeJob.jobId}</span>
            <span className="chip">Payout ${game.activeJob.lockedPayout}</span>
          </div>
        </article>
      </section>
    );
  }

  const contracts = game.contractBoard;
  const effectiveSelected = contracts.some((contract) => contract.contractId === selectedContractId)
    ? selectedContractId
    : contracts[0]?.contractId ?? null;
  const selected = contracts.find((contract) => contract.contractId === effectiveSelected) ?? null;
  const job = selected ? jobsById.get(selected.jobId) ?? null : null;
  const hasTools = job ? job.requiredTools.every((toolId) => (game.player.tools[toolId]?.durability ?? 0) > 0) : false;
  const payout = selected && job ? Math.round(job.basePayout * selected.payoutMult) : 0;

  return (
    <section className="tab-panel contracts-tab">
      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Contract Carousel</p>
            <h2>Available Work</h2>
          </div>
          <span className="chip">{contracts.length} open</span>
        </div>
        {contracts.length === 0 ? <p className="muted-copy">No open contracts this shift.</p> : null}
        {contracts.length > 0 ? (
          <ContractCarousel contracts={contracts} jobsById={jobsById} selectedContractId={effectiveSelected} onSelect={selectContract} />
        ) : null}
      </article>

      {selected && job ? <ContractDetails contractId={selected.contractId} job={job} payout={payout} hasTools={hasTools} onAccept={accept} /> : null}
    </section>
  );
}

function ContractDetails({
  contractId,
  job,
  payout,
  hasTools,
  onAccept
}: {
  contractId: string;
  job: JobDef;
  payout: number;
  hasTools: boolean;
  onAccept: (contractId: string) => void;
}) {
  return (
    <article className="hero-card chrome-card contract-detail-card">
      <p className="eyebrow">Selected Contract</p>
      <h3>{job.name}</h3>
      <p>{job.flavor.client_quote}</p>
      <div className="chip-grid">
        <span className="chip">Payout ${payout}</span>
        <span className="chip">Risk {Math.round(job.risk * 100)}%</span>
        <span className="chip">Units {job.workUnits}</span>
        <span className="chip">Tier {job.tier}</span>
      </div>
      <div className="detail-block">
        <strong>Required Tools</strong>
        <div className="chip-grid">
          {job.requiredTools.map((toolId) => (
            <span key={toolId} className="chip large-chip">
              {toolId}
            </span>
          ))}
        </div>
      </div>
      <div className="detail-block">
        <strong>Materials</strong>
        <div className="chip-grid">
          {job.materialNeeds.map((material) => (
            <span key={material.supplyId} className="chip large-chip">
              {material.supplyId} x{material.quantity}
            </span>
          ))}
        </div>
      </div>
      <div className="sticky-action-bar inline-actions">
        <button className="primary-button wide-button" onClick={() => onAccept(contractId)} disabled={!hasTools}>
          {hasTools ? "Accept Job" : "Missing Tools"}
        </button>
      </div>
    </article>
  );
}
