import { useMemo, useState } from "react";
import { GameState, JobDef, SkillId } from "../../core/types";
import { getPayoutMultiplier } from "../../core/economy";
import {
  DAY_LABOR_CONTRACT_ID,
  ContractOffer,
  formatHours,
  formatSkillCompactLabel,
  formatSkillLabel,
  getAvailableContractOffers,
  getQuickBuyPlan,
  getSettlementPreview
} from "../../core/playerFlow";
import type { SettlementPreview } from "../../core/playerFlow";
import { obfuscateReadableText } from "../readability";
import { bundle, useUiStore } from "../state";

const GROUPS: Array<{ id: string; label: string; skills: SkillId[] }> = [
  {
    id: "core-systems",
    label: "Core Systems",
    skills: ["electrician", "plumber", "hvac_technician", "solar_panel_installer", "insulation_installer"]
  },
  {
    id: "structure",
    label: "Structure",
    skills: ["framer", "carpenter", "mason", "concrete_finisher", "scaffolder"]
  },
  {
    id: "exterior",
    label: "Exterior",
    skills: ["roofer", "siding_installer", "fence_installer", "glazier"]
  },
  {
    id: "interior-finish",
    label: "Interior Finish",
    skills: ["drywall_installer", "painter", "flooring_installer", "cabinet_maker", "millworker"]
  }
];

export function ContractsTab() {
  const game = useUiStore((state) => state.game);
  const selectedContractId = useUiStore((state) => state.selectedContractId);
  const selectContract = useUiStore((state) => state.selectContract);
  const accept = useUiStore((state) => state.acceptContract);
  const quickBuyTools = useUiStore((state) => state.quickBuyTools);
  const setOfficeSection = useUiStore((state) => state.setOfficeSection);
  const dayLaborCelebrationActive = useUiStore((state) => state.dayLaborCelebrationActive);
  const [activeGroupId, setActiveGroupId] = useState<string>(GROUPS[0]!.id);

  const baseJobsById = useMemo(() => new Map(bundle.jobs.map((job) => [job.id, job])), []);

  if (!game) {
    return null;
  }

  const offers = getAvailableContractOffers(game, bundle);
  const jobsById = new Map(baseJobsById);
  for (const offer of offers) {
    jobsById.set(offer.job.id, offer.job);
  }

  const dayLaborOffer = offers.find((offer) => offer.contract.contractId === DAY_LABOR_CONTRACT_ID) ?? null;
  const babaOffer = offers.find((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && offer.job.tags.includes("baba-g")) ?? null;
  const tradeOffers = offers.filter(
    (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g")
  );
  const activeGroup = GROUPS.find((group) => group.id === activeGroupId) ?? GROUPS[0]!;
  const groupOffers = tradeOffers.filter((offer) => activeGroup.skills.includes(offer.job.primarySkill));
  const contracts = offers.map((offer) => offer.contract);
  const effectiveSelected =
    offers.find((offer) => offer.contract.contractId === selectedContractId)?.contract.contractId ??
    dayLaborOffer?.contract.contractId ??
    babaOffer?.contract.contractId ??
    tradeOffers[0]?.contract.contractId ??
    null;
  const selectedOffer = offers.find((offer) => offer.contract.contractId === effectiveSelected) ?? null;
  const selectedContract = selectedOffer?.contract ?? null;
  const selectedJob = selectedOffer?.job ?? null;
  const activeEvents = bundle.events.filter((event) => game.activeEventIds.includes(event.id));
  const payout = selectedOffer ? getOfferPayout(selectedOffer, activeEvents) : 0;
  const hasTools = selectedJob
    ? selectedJob.requiredTools.every((toolId) => (game.player.tools[toolId]?.durability ?? 0) > 0)
    : false;
  const settlementPreview =
    selectedContract && selectedJob ? buildSettlementPreview(game, selectedContract.contractId, selectedJob, payout) : null;
  const quickBuyPlan =
    selectedContract && selectedContract.contractId !== DAY_LABOR_CONTRACT_ID
      ? getQuickBuyPlan(game, bundle, selectedContract.contractId)
      : null;
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
            <p className="eyebrow">Trade Groups</p>
            <h2>Contract Board</h2>
          </div>
        </div>
        <div className="chip-grid compact-chip-grid">
          {GROUPS.map((group) => (
            <button
              key={group.id}
              className={group.id === activeGroup.id ? "ghost-button active" : "ghost-button"}
              onClick={() => setActiveGroupId(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="trade-chip-grid">
          {groupOffers.map((offer) => {
            const isActive = offer.contract.contractId === effectiveSelected;
            const quoted = getOfferPayout(offer, activeEvents);
            return (
              <button
                key={offer.contract.contractId}
                className={isActive ? "trade-offer-chip active" : "trade-offer-chip"}
                onClick={() => selectContract(offer.contract.contractId)}
              >
                <strong>{formatSkillCompactLabel(offer.job.primarySkill)}</strong>
                <span>{offer.job.name}</span>
                <small>
                  ${quoted} | {Math.round(offer.job.risk * 100)}% risk
                </small>
              </button>
            );
          })}
        </div>
      </article>

      {selectedContract && selectedJob ? (
        <ContractDetails
          game={game}
          contractId={selectedContract.contractId}
          job={selectedJob}
          payout={payout}
          settlementPreview={settlementPreview}
          hasTools={hasTools}
          dayLaborCooldownActive={dayLaborCelebrationActive}
          onAccept={accept}
        />
      ) : null}
      {!game.activeJob && tradeOffers.length === 0 ? (
        <article className="chrome-card inset-card">
          <div className="section-label-row">
            <strong>No Trade Contracts Unlocked</strong>
          </div>
          <p className="muted-copy">Open Office &gt; Research to unlock category and skill contracts.</p>
          <button className="ghost-button" onClick={() => setOfficeSection("research")}>
            Open Research
          </button>
        </article>
      ) : null}
      {quickBuyPlan && quickBuyPlan.missingTools.length > 0 ? (
        <article className="chrome-card inset-card quick-buy-card">
          <p className="eyebrow">Quick Tool Buy</p>
          <p className="muted-copy">Missing {quickBuyPlan.missingTools.map((line) => line.toolName).join(", ")}</p>
          <p className="muted-copy">{bundle.strings.quickBuyDescription}</p>
          <div className="chip-grid">
            <span className="chip">{formatHours(quickBuyPlan.requiredTicks)}</span>
            <span className="chip">${quickBuyPlan.totalCost}</span>
            {!quickBuyPlan.enoughCash ? <span className="chip muted">Need more cash</span> : null}
            {!quickBuyPlan.enoughTime ? <span className="chip muted">Need more hours</span> : null}
            {!quickBuyPlan.allowed ? <span className="chip muted">Must be at shop</span> : null}
          </div>
          <div className="action-row quick-buy-actions">
            <button
              className="primary-button wide-button"
              onClick={() => selectedContract && quickBuyTools(selectedContract.contractId)}
              disabled={!quickBuyEnabled}
            >
              {bundle.strings.quickBuyButtonLabel} ({formatHours(quickBuyPlan.requiredTicks)} / ${quickBuyPlan.totalCost})
            </button>
          </div>
        </article>
      ) : null}
      <article className="chrome-card inset-card">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Pinned Offers</p>
            <h2>Always Available</h2>
          </div>
          <span className="chip">{contracts.length} offers</span>
        </div>
        <div className="trade-pinned-grid">
          {dayLaborOffer ? (
            <button
              className={effectiveSelected === dayLaborOffer.contract.contractId ? "trade-offer-chip active" : "trade-offer-chip"}
              onClick={() => selectContract(dayLaborOffer.contract.contractId)}
            >
              <strong>Day Labor</strong>
              <span>${getOfferPayout(dayLaborOffer, activeEvents)}</span>
              <small>Fallback</small>
            </button>
          ) : null}
          {babaOffer ? (
            <button
              className={effectiveSelected === babaOffer.contract.contractId ? "trade-offer-chip active" : "trade-offer-chip"}
              onClick={() => selectContract(babaOffer.contract.contractId)}
            >
              <strong>Baba G</strong>
              <span>${getOfferPayout(babaOffer, activeEvents)}</span>
              <small>{Math.round(babaOffer.job.risk * 100)}% risk</small>
            </button>
          ) : null}
        </div>
      </article>
    </section>
  );
}

function ContractDetails({
  game,
  contractId,
  job,
  payout,
  settlementPreview,
  hasTools,
  dayLaborCooldownActive,
  onAccept
}: {
  game: GameState;
  contractId: string;
  job: JobDef;
  payout: number;
  settlementPreview: SettlementPreview | null;
  hasTools: boolean;
  dayLaborCooldownActive: boolean;
  onAccept: (contractId: string) => void;
}) {
  const isDayLabor = contractId === DAY_LABOR_CONTRACT_ID;
  const isDayLaborCoolingDown = isDayLabor && dayLaborCooldownActive;
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <article className="hero-card chrome-card contract-detail-card">
      <div className="section-label-row">
        <div>
          <p className="eyebrow">{isDayLabor ? "Fallback Shift" : "Selected Contract"}</p>
          <h3>{job.name}</h3>
        </div>
        <button
          type="button"
          className="ghost-button"
          aria-expanded={infoOpen}
          aria-controls={`contract-info-${contractId}`}
          onClick={() => setInfoOpen((open) => !open)}
        >
          Info
        </button>
      </div>
      {infoOpen ? (
        <div id={`contract-info-${contractId}`} className="detail-block">
          <p className="muted-copy">{obfuscateReadableText(game, job.flavor.client_quote, `${job.id}:quote`)}</p>
          <div className="chip-grid">
            <span className="chip tone-success">Payout ${payout}</span>
            <span className={`chip ${riskToneClass(job.risk)}`}>Risk {Math.round(job.risk * 100)}%</span>
            {!isDayLabor && settlementPreview ? (
              <span className={`chip ${riskBandToneClass(settlementPreview.riskBand)}`}>Risk Band {formatRiskBand(settlementPreview.riskBand)}</span>
            ) : null}
            <span className="chip">Skill {formatSkillLabel(job.primarySkill)}</span>
            <span className="chip">Tier {job.tier}</span>
          </div>
          {isDayLabor ? (
            <div className="detail-block">
              <strong>Outcome Snapshot</strong>
              <div className="chip-grid">
                <span className="chip tone-success">Guaranteed ${payout}</span>
                <span className="chip tone-success">Risk Band Low</span>
              </div>
              <p className="muted-copy">Uses regular shift hours only; overtime capacity is not included.</p>
            </div>
          ) : settlementPreview ? (
            <div className="detail-block">
              <strong>Outcome Snapshot</strong>
              <div className="chip-grid">
                <span className="chip tone-success">Success ${settlementPreview.successCash}</span>
                <span className="chip tone-warning">Low Quality ${settlementPreview.neutralCash}</span>
                <span className="chip tone-danger">Fail ${settlementPreview.failCash}</span>
              </div>
              <p className="muted-copy">{settlementPreview.neutralWarning}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="detail-block">
        <strong>Required Tools</strong>
        {job.requiredTools.length > 0 ? (
          <div className="chip-grid">
            {job.requiredTools.map((toolId) => (
              <span key={toolId} className="chip large-chip">
                {toolId}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted-copy">None. This shift is always available.</p>
        )}
      </div>
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
          <p className="muted-copy">
            {isDayLabor
              ? "No supplies needed. This fallback uses regular shift hours only and converts those hours into cash."
              : "No supplies needed for this contract."}
          </p>
        </div>
      )}
      <div className="contract-detail-actions">
        <button
          className={`${isDayLabor ? "day-labor-shift-button" : "primary-button"} wide-button`}
          onClick={() => onAccept(contractId)}
          disabled={!hasTools || isDayLaborCoolingDown}
        >
          {isDayLaborCoolingDown ? "Celebration Cooldown..." : hasTools ? (isDayLabor ? "Work Day Laborer Shift" : "Accept Job") : "Missing Tools"}
        </button>
        {isDayLaborCoolingDown ? <p className="day-labor-cooldown-copy">FX running. Day Labor will unlock in a moment.</p> : null}
      </div>
    </article>
  );
}

function getOfferPayout(offer: ContractOffer, activeEvents: typeof bundle.events): number {
  if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID) {
    return offer.job.basePayout;
  }
  return Math.max(0, Math.round(offer.job.basePayout * offer.contract.payoutMult * getPayoutMultiplier(offer.job, activeEvents)));
}

function buildSettlementPreview(game: Parameters<typeof getSettlementPreview>[0], contractId: string, job: JobDef, payout: number): SettlementPreview | null {
  if (contractId === DAY_LABOR_CONTRACT_ID) {
    return null;
  }

  return getSettlementPreview(
    {
      ...game,
      activeJob: {
        contractId,
        jobId: job.id,
        districtId: job.districtId,
        acceptedDay: game.day,
        assignee: "self",
        staminaCommitted: false,
        lockedPayout: payout,
        location: "shop",
        qualityPoints: 0,
        reworkCount: 0,
        plannedTicks: 0,
        actualTicksSpent: 0,
        materialsReserved: false,
        reservedMaterials: {},
        partsQuality: null,
        partsQualityScore: 1,
        partsQualityModifier: 0,
        trashUnitsPending: 0,
        siteSupplies: {},
        supplierCart: {},
        tasks: []
      }
    },
    bundle
  );
}

function formatRiskBand(riskBand: SettlementPreview["riskBand"]): string {
  if (riskBand === "low") {
    return "Low";
  }
  if (riskBand === "medium") {
    return "Medium";
  }
  return "High";
}

function riskBandToneClass(riskBand: SettlementPreview["riskBand"]): string {
  if (riskBand === "low") {
    return "tone-success";
  }
  if (riskBand === "high") {
    return "tone-danger";
  }
  return "tone-warning";
}

function riskToneClass(risk: number): string {
  if (risk >= 0.5) {
    return "tone-danger";
  }
  if (risk >= 0.25) {
    return "tone-warning";
  }
  return "tone-success";
}
