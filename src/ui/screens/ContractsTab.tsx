import { useMemo } from "react";
import { JobDef } from "../../core/types";
import { DAY_LABOR_CONTRACT_ID, formatHours, getAvailableContractOffers, getQuickBuyPlan } from "../../core/playerFlow";
import { bundle, useUiStore } from "../state";
import { ContractCarousel } from "../components/ContractCarousel";

export function ContractsTab() {
  const game = useUiStore((state) => state.game);
  const selectedContractId = useUiStore((state) => state.selectedContractId);
  const selectContract = useUiStore((state) => state.selectContract);
  const accept = useUiStore((state) => state.acceptContract);
  const quickBuyTools = useUiStore((state) => state.quickBuyTools);

  const baseJobsById = useMemo(() => new Map(bundle.jobs.map((job) => [job.id, job])), []);

  if (!game) {
    return null;
  }

  const offers = getAvailableContractOffers(game, bundle);
  const jobsById = new Map(baseJobsById);
  for (const offer of offers) {
    jobsById.set(offer.job.id, offer.job);
  }
  const contracts = offers.map((offer) => offer.contract);
  const effectiveSelected = contracts.some((contract) => contract.contractId === selectedContractId)
    ? selectedContractId
    : contracts[0]?.contractId ?? null;
  const selected = contracts.find((contract) => contract.contractId === effectiveSelected) ?? null;
  const job = selected ? jobsById.get(selected.jobId) ?? null : null;
  const hasTools = job ? job.requiredTools.every((toolId) => (game.player.tools[toolId]?.durability ?? 0) > 0) : false;
  const payout = selected && job ? Math.round(job.basePayout * selected.payoutMult) : 0;
  const fieldContractsOpen = game.activeJob ? 0 : game.contractBoard.length;

  const quickBuyPlan = selected && selected.contractId !== DAY_LABOR_CONTRACT_ID ? getQuickBuyPlan(game, bundle, selected.contractId) : null;
  const quickBuyEnabled = Boolean(quickBuyPlan?.missingTools.length) && quickBuyPlan?.allowed && quickBuyPlan?.enoughCash && quickBuyPlan?.enoughTime;

  return (
    <section className="tab-panel contracts-tab">
      {game.activeJob ? (
        <article className="hero-card chrome-card">
          <p className="eyebrow">Contract Board</p>
          <h2>Field board is locked</h2>
          <p>Finish the current field job to refresh normal contracts. Day Laborer stays available as a fallback cash shift.</p>
          <div className="chip-grid">
            <span className="chip">{game.activeJob.jobId}</span>
            <span className="chip">Payout ${game.activeJob.lockedPayout}</span>
          </div>
        </article>
      ) : null}

      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Contract Carousel</p>
            <h2>Available Work</h2>
          </div>
          <span className="chip">{fieldContractsOpen} field + 1 fallback</span>
        </div>
        {contracts.length === 0 ? <p className="muted-copy">No open contracts this shift.</p> : null}
        {contracts.length > 0 ? (
          <ContractCarousel contracts={contracts} jobsById={jobsById} selectedContractId={effectiveSelected} onSelect={selectContract} />
        ) : null}
      </article>

      {selected && job ? <ContractDetails contractId={selected.contractId} job={job} payout={payout} hasTools={hasTools} onAccept={accept} /> : null}
      {quickBuyPlan && quickBuyPlan.missingTools.length > 0 ? (
        <article className="chrome-card inset-card quick-buy-card">
          <p className="eyebrow">Quick Tool Buy</p>
          <p className="muted-copy">Missing {quickBuyPlan.missingTools.map((line) => line.toolName).join(", " )}</p>
          <p className="muted-copy">{bundle.strings.quickBuyDescription}</p>
          <div className="chip-grid">
            <span className="chip">{formatHours(quickBuyPlan.requiredTicks)}</span>
            <span className="chip">${quickBuyPlan.totalCost}</span>
            {!quickBuyPlan.enoughCash ? <span className="chip muted">Need more cash</span> : null}
            {!quickBuyPlan.enoughTime ? <span className="chip muted">Need more hours</span> : null}
            {!quickBuyPlan.allowed ? <span className="chip muted">Must be at shop</span> : null}
          </div>
          <div className="sticky-action-bar inline-actions">
            <button
              className="primary-button wide-button"
              onClick={() => selected && quickBuyTools(selected.contractId)}
              disabled={!quickBuyEnabled}
            >
              {bundle.strings.quickBuyButtonLabel} ({formatHours(quickBuyPlan.requiredTicks)} / ${quickBuyPlan.totalCost})
            </button>
          </div>
        </article>
      ) : null}
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
      <p className="eyebrow">{contractId === DAY_LABOR_CONTRACT_ID ? "Fallback Shift" : "Selected Contract"}</p>
      <h3>{job.name}</h3>
      <p>{job.flavor.client_quote}</p>
      <div className="chip-grid">
        <span className="chip">Payout ${payout}</span>
        <span className="chip">Risk {Math.round(job.risk * 100)}%</span>
        <span className="chip">Units {job.workUnits}</span>
        <span className="chip">Tier {job.tier}</span>
      </div>
      {job.requiredTools.length > 0 ? (
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
      ) : (
        <div className="detail-block">
          <strong>Required Tools</strong>
          <p className="muted-copy">None. This shift is always available.</p>
        </div>
      )}
      {job.materialNeeds.length > 0 ? (
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
      ) : (
        <div className="detail-block">
          <strong>Materials</strong>
          <p className="muted-copy">No supplies needed. The shift just converts remaining hours into cash.</p>
        </div>
      )}
      <div className="sticky-action-bar inline-actions">
        <button className="primary-button wide-button" onClick={() => onAccept(contractId)} disabled={!hasTools}>
          {hasTools ? (contractId === DAY_LABOR_CONTRACT_ID ? "Work Day Laborer Shift" : "Accept Job") : "Missing Tools"}
        </button>
      </div>
    </article>
  );
}
