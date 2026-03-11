import { useEffect, useMemo, useState } from "react";
import { GameState, JobDef, SkillId } from "../../core/types";
import { getPayoutMultiplier } from "../../core/economy";
import { TRADE_GROUPS } from "../../core/research";
import { getPerkArchetypeSnapshot } from "../../core/perks";
import {
  DAY_LABOR_CONTRACT_ID,
  ContractOffer,
  FUEL_PRICE,
  SHOP_SUPPLIER_TICKS,
  formatHours,
  formatSkillCompactLabel,
  formatSkillLabel,
  getAvailableContractOffers,
  getQuickBuyPlan,
  getContractEconomyPreview,
  getContractAutoBidPreview,
  getContractQuotedPayout,
  shouldIgnoreLikelyLossWarning,
  isStarterToolId,
  getSupplyUnitPrice,
  getSettlementPreview
} from "../../core/playerFlow";
import type { ContractEconomyPreview, SettlementPreview } from "../../core/playerFlow";
import type { ContractAutoBidPreview } from "../../core/playerFlow";
import { obfuscateReadableText } from "../readability";
import { bundle, useUiStore } from "../state";

const GROUPS: Array<{ id: string; label: string; skills: SkillId[] }> = TRADE_GROUPS;

export function ContractsTab() {
  const game = useUiStore((state) => state.game);
  const selectedContractId = useUiStore((state) => state.selectedContractId);
  const selectContract = useUiStore((state) => state.selectContract);
  const accept = useUiStore((state) => state.acceptContract);
  const endDay = useUiStore((state) => state.endShift);
  const quickBuyTools = useUiStore((state) => state.quickBuyTools);
  const dayLaborCelebrationActive = useUiStore((state) => state.dayLaborCelebrationActive);
  const [activeGroupId, setActiveGroupId] = useState<string>(GROUPS[0]!.id);

  const baseJobsById = useMemo(() => new Map(bundle.jobs.map((job) => [job.id, job])), []);

  const allOffers = game ? getAvailableContractOffers(game, bundle) : [];
  const tradeOffers = allOffers.filter(
    (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g")
  );
  const unlockedGroups = GROUPS.filter((group) => tradeOffers.some((offer) => group.skills.includes(offer.job.primarySkill)));

  useEffect(() => {
    if (unlockedGroups.length === 0) {
      return;
    }
    if (!unlockedGroups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(unlockedGroups[0]!.id);
    }
  }, [activeGroupId, unlockedGroups]);

  if (!game) {
    return null;
  }

  const economyPreviewByContractId = new Map<string, ContractEconomyPreview | null>();
  for (const offer of allOffers) {
    economyPreviewByContractId.set(offer.contract.contractId, getContractEconomyPreview(game, bundle, offer.contract.contractId));
  }
  const jobsById = new Map(baseJobsById);
  for (const offer of allOffers) {
    jobsById.set(offer.job.id, offer.job);
  }

  const dayLaborOffer = allOffers.find((offer) => offer.contract.contractId === DAY_LABOR_CONTRACT_ID) ?? null;
  const babaOffer = allOffers.find((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && offer.job.tags.includes("baba-g")) ?? null;
  const activeGroup = unlockedGroups.find((group) => group.id === activeGroupId) ?? unlockedGroups[0] ?? null;
  const groupOffers = activeGroup ? tradeOffers.filter((offer) => activeGroup.skills.includes(offer.job.primarySkill)) : [];
  const bestPickContractId = getBestPickContractId(tradeOffers, economyPreviewByContractId, game);
  const effectiveSelected =
    allOffers.find((offer) => offer.contract.contractId === selectedContractId)?.contract.contractId ??
    babaOffer?.contract.contractId ??
    dayLaborOffer?.contract.contractId ??
    groupOffers[0]?.contract.contractId ??
    tradeOffers[0]?.contract.contractId ??
    null;
  const selectedOffer = allOffers.find((offer) => offer.contract.contractId === effectiveSelected) ?? null;
  const selectedContract = selectedOffer?.contract ?? null;
  const selectedJob = selectedOffer?.job ?? null;
  const activeEvents = bundle.events.filter((event) => game.activeEventIds.includes(event.id));
  const payout = selectedOffer ? getOfferPayout(game, selectedOffer) : 0;
  const hasTools = selectedJob ? selectedJob.requiredTools.every((toolId) => (game.player.tools[toolId]?.durability ?? 0) > 0) : false;
  const settlementPreview =
    selectedContract && selectedJob ? buildSettlementPreview(game, selectedContract.contractId, selectedJob, payout) : null;
  const economyPreview = selectedContract ? (economyPreviewByContractId.get(selectedContract.contractId) ?? null) : null;
  const autoBidPreview = selectedContract ? getContractAutoBidPreview(game, bundle, selectedContract.contractId) : null;
  const quickBuyPlan =
    selectedContract && selectedContract.contractId !== DAY_LABOR_CONTRACT_ID
      ? getQuickBuyPlan(game, bundle, selectedContract.contractId)
      : null;
  const quickBuyEnabled =
    Boolean(quickBuyPlan?.missingTools.length) &&
    quickBuyPlan?.allowed &&
    !quickBuyPlan?.starterGateBlocked &&
    quickBuyPlan?.enoughCash &&
    quickBuyPlan?.enoughTime;
  const storageLockedQuickBuyTools = quickBuyPlan?.starterGateBlocked
    ? quickBuyPlan.missingTools.filter((line) => !isStarterToolId(line.toolId)).map((line) => line.toolName)
    : [];
  const archetype = getPerkArchetypeSnapshot(game);

  return (
    <section className="tab-panel contracts-tab">
      {game.activeJob ? (
        <article className="hero-card chrome-card">
          <p className="eyebrow">Contract Board</p>
          <h2>Field board is locked</h2>
          <p>Finish the current field job and end day to refresh contract offers.</p>
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
          {unlockedGroups.map((group) => (
            <button
              key={group.id}
              className={group.id === activeGroup?.id ? "ghost-button active" : "ghost-button"}
              onClick={() => setActiveGroupId(group.id)}
              data-testid={`trade-group-${group.id}`}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="trade-chip-grid">
          {groupOffers.map((offer) => {
            const isActive = offer.contract.contractId === effectiveSelected;
            const quoted = getOfferPayout(game, offer);
            const offerEconomyPreview = economyPreviewByContractId.get(offer.contract.contractId) ?? null;
            const likelyLoss = isLikelyLossOffer(offerEconomyPreview);
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
                {bestPickContractId === offer.contract.contractId ? <small className="tone-energy">Best Pick</small> : null}
                {likelyLoss ? <small className="tone-danger trade-offer-loss-flag">Likely Loss</small> : null}
              </button>
            );
          })}
        </div>
        {!game.activeJob && unlockedGroups.length === 0 ? (
          <p className="muted-copy">No trade groups unlocked yet.</p>
        ) : null}
      </article>

      {selectedContract && selectedJob ? (
        <ContractDetails
          game={game}
          contractId={selectedContract.contractId}
          job={selectedJob}
          payout={payout}
          settlementPreview={settlementPreview}
          economyPreview={economyPreview}
          autoBidPreview={autoBidPreview}
          hasTools={hasTools}
          dayLaborCooldownActive={dayLaborCelebrationActive}
          onEndDay={endDay}
          activeEvents={activeEvents}
          archetypeTags={archetype.tags}
          onAccept={accept}
        />
      ) : null}
      {!game.activeJob && tradeOffers.length === 0 ? (
        <article className="chrome-card inset-card">
          <div className="section-label-row">
            <strong>{game.dayLaborHiddenUntilEndDay ? "Board Refresh Pending" : "No Trade Contracts Unlocked"}</strong>
          </div>
          <p className="muted-copy">
            {game.dayLaborHiddenUntilEndDay
              ? "End day to refresh the board and bring Day Labor back."
              : "Complete Baba G jobs to unlock core trade tracks."}
          </p>
        </article>
      ) : null}
      {quickBuyPlan && quickBuyPlan.missingTools.length > 0 ? (
        <article className="chrome-card inset-card quick-buy-card">
          <p className="eyebrow">Quick Tool Buy</p>
          <p className="muted-copy">Missing {quickBuyPlan.missingTools.map((line) => line.toolName).join(", ")}</p>
          <p className="muted-copy">{bundle.strings.quickBuyDescription}</p>
          {storageLockedQuickBuyTools.length > 0 ? (
            <p className="muted-copy tone-warning" data-testid="quick-buy-storage-lock-warning">
              {buildQuickBuyStorageLockCopy(storageLockedQuickBuyTools)}
            </p>
          ) : null}
          <div className="chip-grid">
            <span className="chip">{formatHours(quickBuyPlan.requiredTicks)}</span>
            <span className="chip">${quickBuyPlan.totalCost}</span>
            {!quickBuyPlan.enoughCash ? <span className="chip muted">Need more cash</span> : null}
            {!quickBuyPlan.enoughTime ? <span className="chip muted">Need more hours</span> : null}
            {!quickBuyPlan.allowed ? <span className="chip muted">Must be at storage</span> : null}
            {quickBuyPlan.starterGateBlocked ? <span className="chip muted">Unlock storage first</span> : null}
          </div>
          <div className="action-row quick-buy-actions">
            <button
              className="ghost-button secondary-action-button wide-button"
              onClick={() => selectedContract && quickBuyTools(selectedContract.contractId)}
              disabled={!quickBuyEnabled}
              data-testid="quick-buy-tools-button"
            >
              {bundle.strings.quickBuyButtonLabel} ({formatHours(quickBuyPlan.requiredTicks)} / ${quickBuyPlan.totalCost})
            </button>
          </div>
        </article>
      ) : null}
      {babaOffer ? (
        <article className="chrome-card inset-card">
          <div className="section-label-row">
            <div>
              <p className="eyebrow">Baba G</p>
              <h2>Baba G Spotlight</h2>
            </div>
            <span className="chip">Always Available</span>
          </div>
          <p className="muted-copy">
            {obfuscateReadableText(
              game,
              "Rotating high-risk contract that unlocks more trade tracks as you complete Baba G jobs.",
              "contracts:baba-spotlight:copy"
            )}
          </p>
          <div className="metric-grid two-up">
            <span>Payout ${getOfferPayout(game, babaOffer)}</span>
            <span>Risk {Math.round(babaOffer.job.risk * 100)}%</span>
            <span>Skill {formatSkillLabel(babaOffer.job.primarySkill)}</span>
            <span>Tier {babaOffer.job.tier}</span>
          </div>
          {isLikelyLossOffer(economyPreviewByContractId.get(babaOffer.contract.contractId) ?? null) ? (
            <p className="muted-copy tone-danger">Likely Loss warning on current Baba G rotation.</p>
          ) : null}
          <div className="action-row">
            <button
              className={effectiveSelected === babaOffer.contract.contractId ? "primary-button wide-button" : "ghost-button secondary-action-button wide-button"}
              onClick={() => selectContract(babaOffer.contract.contractId)}
            >
              Select Baba G Job
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}

function ContractDetails({
  game,
  contractId,
  job,
  payout,
  settlementPreview,
  economyPreview,
  autoBidPreview,
  hasTools,
  dayLaborCooldownActive,
  onEndDay,
  activeEvents,
  archetypeTags,
  onAccept
}: {
  game: GameState;
  contractId: string;
  job: JobDef;
  payout: number;
  settlementPreview: SettlementPreview | null;
  economyPreview: ContractEconomyPreview | null;
  autoBidPreview: ContractAutoBidPreview | null;
  hasTools: boolean;
  dayLaborCooldownActive: boolean;
  onEndDay: () => void;
  activeEvents: typeof bundle.events;
  archetypeTags: string[];
  onAccept: (contractId: string) => void;
}) {
  const isDayLabor = contractId === DAY_LABOR_CONTRACT_ID;
  const isDayLaborCoolingDown = isDayLabor && dayLaborCooldownActive;
  const likelyLoss = isLikelyLossOffer(economyPreview);
  const likelyLossWhy = likelyLoss ? buildLikelyLossWhy(economyPreview, !game.operations.facilities.dumpsterEnabled) : "";
  const ignoreLikelyLossWarning = likelyLoss ? shouldIgnoreLikelyLossWarning(game, contractId) : false;
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmLossOpen, setConfirmLossOpen] = useState(false);
  const noDayLaborHoursRemaining = game.workday.ticksSpent >= game.workday.availableTicks;

  useEffect(() => {
    setConfirmLossOpen(false);
  }, [contractId]);

  function handleAcceptClick() {
    if (isDayLabor) {
      if (noDayLaborHoursRemaining) {
        onEndDay();
        return;
      }
      onAccept(contractId);
      return;
    }
    if (likelyLoss && !ignoreLikelyLossWarning) {
      setConfirmLossOpen(true);
      return;
    }
    onAccept(contractId);
  }

  function confirmLikelyLossAccept() {
    setConfirmLossOpen(false);
    onAccept(contractId);
  }

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
      {economyPreview ? (
        <div className="material-need-meta">
          <span>Est Net {formatSignedMoney(economyPreview.projectedNetOnSuccess)}</span>
          <span>Biggest Cost {formatEstimateCostDriverLabel(economyPreview.biggestCostDriver)}</span>
        </div>
      ) : null}
      {!isDayLabor && !job.tags.includes("baba-g") && autoBidPreview ? (
        <p className="muted-copy">
          Auto-Bid ${autoBidPreview.acceptedPayout} (Estimating Lv {autoBidPreview.estimatingLevel}, Negotiation Lv{" "}
          {autoBidPreview.negotiationLevel})
        </p>
      ) : null}
      {archetypeTags.length > 0 ? (
        <p className="muted-copy">
          {obfuscateReadableText(game, `Style Fit: ${getStyleFitHint(job.primarySkill, archetypeTags)}`, `${job.id}:style-fit`)}
        </p>
      ) : null}
      {likelyLoss && economyPreview ? (
        <p className="muted-copy tone-danger contract-loss-warning">
          Likely Loss: Net on success {formatSignedMoney(economyPreview.projectedNetOnSuccess)}. Why: {likelyLossWhy}
        </p>
      ) : null}
      {likelyLoss && ignoreLikelyLossWarning ? <p className="muted-copy tone-warning">Overconfidence ignored the caution prompt.</p> : null}
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
          {economyPreview ? (
            <div className="detail-block">
              <strong>Cost Preview</strong>
              <div className="chip-grid">
                <span className="chip tone-success">Gross ${economyPreview.grossPayout}</span>
                <span className="chip tone-warning">Materials ${economyPreview.materialsCost}</span>
                <span className="chip tone-info">Fuel ${economyPreview.fuelCost}</span>
                <span className="chip tone-danger">Trash ${economyPreview.trashCost}</span>
                <span className={`chip ${economyPreview.projectedNetOnSuccess >= 0 ? "tone-success" : "tone-danger"}`}>
                  Est Net {formatSignedMoney(economyPreview.projectedNetOnSuccess)}
                </span>
              </div>
              <p className="muted-copy">
                {obfuscateReadableText(game, "Estimate uses medium material pricing, route fuel, and trash handling.", `${job.id}:estimate-note`)}
              </p>
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
          <div className="stack-list">
            {job.materialNeeds.map((material) => {
              const supply = bundle.supplies.find((entry) => entry.id === material.supplyId);
              const unitPrice = supply ? getSupplyUnitPrice(supply, "medium", activeEvents) : 0;
              const totalPrice = unitPrice * material.quantity;
              return (
                <div key={material.supplyId} className="material-need-meta">
                  <span>
                    {supply?.name ?? material.supplyId} x{material.quantity}
                  </span>
                  <span>Med ${unitPrice} ea (${totalPrice})</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="detail-block">
          <strong>Materials</strong>
          <p className="muted-copy">
            {obfuscateReadableText(
              game,
              isDayLabor
                ? "No supplies needed. This fallback uses regular shift hours only and converts those hours into cash."
                : "No supplies needed for this contract.",
              `${job.id}:materials-summary`
            )}
          </p>
        </div>
      )}
      <div className="contract-detail-actions">
        {isDayLabor ? <p className="eyebrow">Task</p> : null}
        <button
          className={`${isDayLabor ? (noDayLaborHoursRemaining ? "day-labor-end-day-button" : "day-labor-shift-button") : "primary-button"} wide-button`}
          onClick={handleAcceptClick}
          disabled={!hasTools || (isDayLaborCoolingDown && !noDayLaborHoursRemaining)}
        >
          {isDayLabor && noDayLaborHoursRemaining
            ? "End Day"
            : isDayLaborCoolingDown
              ? "Celebration Cooldown..."
            : hasTools
                ? isDayLabor
                  ? "Work Day Laborer Shift"
                  : "Accept Job"
                : "Missing Tools"}
        </button>
        {isDayLaborCoolingDown && !noDayLaborHoursRemaining ? (
          <p className="day-labor-cooldown-copy">FX running. Day Labor will unlock in a moment.</p>
        ) : null}
      </div>
      {confirmLossOpen && economyPreview ? (
        <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Likely loss warning">
          <article className="modal-shell chrome-card">
            <div className="overlay-header">
              <h3>Likely Loss</h3>
              <button className="ghost-button" onClick={() => setConfirmLossOpen(false)}>
                Cancel
              </button>
            </div>
            <div className="overlay-body stack-list">
              <p className="loss-confirm-summary">
                Net on success is projected at {formatSignedMoney(economyPreview.projectedNetOnSuccess)}.
              </p>
              <p className="muted-copy">Why: {likelyLossWhy}</p>
              <div className="action-row">
                <button className="ghost-button" onClick={() => setConfirmLossOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button tone-danger" onClick={confirmLikelyLossAccept}>
                  Accept Anyway
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </article>
  );
}

function getOfferPayout(game: GameState, offer: ContractOffer): number {
  const payout = getContractQuotedPayout(game, bundle, offer.contract.contractId);
  if (payout !== null) {
    return payout;
  }
  const activeEvents = bundle.events.filter((event) => game.activeEventIds.includes(event.id));
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
        estimateAtAccept: {
          grossPayout: payout,
          materialsCost: 0,
          fuelCost: 0,
          trashCost: 0,
          estimatedTotalCost: 0,
          projectedNetOnSuccess: payout,
          biggestCostDriver: "none"
        },
        recoveryMode: "none",
        deferredAtDay: null,
        trashUnitsPending: 0,
        siteSupplies: {},
        supplierCart: {},
        tasks: [],
        hasTriggeredAddOn: false,
        pendingAddOnBonus: 0,
        pendingAddOnLabel: null,
        pendingAddOnUnits: 0
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

function formatSignedMoney(value: number): string {
  const rounded = Math.round(value);
  return rounded >= 0 ? `+$${rounded}` : `-$${Math.abs(rounded)}`;
}

function isLikelyLossOffer(preview: ContractEconomyPreview | null): boolean {
  return Boolean(preview && preview.projectedNetOnSuccess < 0);
}

function buildLikelyLossWhy(preview: ContractEconomyPreview | null, premiumHaulLikely: boolean): string {
  if (!preview) {
    return "Projected costs exceed payout";
  }
  const reasons: string[] = [];
  if (preview.materialsCost >= Math.max(preview.fuelCost, preview.trashCost) && preview.materialsCost > 0) {
    reasons.push("Materials high");
  }
  if (preview.fuelCost >= FUEL_PRICE * 2) {
    reasons.push("Long route");
  }
  if (premiumHaulLikely && preview.trashCost > 0) {
    reasons.push("Premium haul");
  }
  if (reasons.length === 0) {
    reasons.push("Projected costs exceed payout");
  }
  return reasons.join(", ");
}

function getBestPickContractId(
  offers: ContractOffer[],
  previewByContractId: Map<string, ContractEconomyPreview | null>,
  game: GameState
): string | null {
  let best: { contractId: string; score: number; risk: number; fuel: number } | null = null;
  for (const offer of offers) {
    const preview = previewByContractId.get(offer.contract.contractId);
    if (!preview) {
      continue;
    }
    const plannedHours = estimatePlannedHours(offer, game, preview);
    const score = preview.projectedNetOnSuccess / Math.max(1, plannedHours);
    if (!best) {
      best = {
        contractId: offer.contract.contractId,
        score,
        risk: offer.job.risk,
        fuel: preview.fuelCost
      };
      continue;
    }
    if (score > best.score || (score === best.score && offer.job.risk < best.risk) || (score === best.score && offer.job.risk === best.risk && preview.fuelCost < best.fuel)) {
      best = {
        contractId: offer.contract.contractId,
        score,
        risk: offer.job.risk,
        fuel: preview.fuelCost
      };
    }
  }
  return best?.contractId ?? null;
}

function estimatePlannedHours(offer: ContractOffer, game: GameState, preview: ContractEconomyPreview): number {
  const district = bundle.districts.find((entry) => entry.id === offer.job.districtId) ?? bundle.districts[0];
  if (!district) {
    return offer.job.workUnits;
  }
  const needsSupplier = preview.materialsCost > 0;
  const fixedTravelTicks = 1;
  const loadTicks = offer.job.materialNeeds.length > 0 ? 2 : 0;
  const supplierTicks = needsSupplier ? SHOP_SUPPLIER_TICKS + 2 + fixedTravelTicks : 0;
  const siteTicks = needsSupplier ? 0 : fixedTravelTicks;
  const workTicks = offer.job.workUnits * 2;
  const closeoutTicks = 2 + district.travel.shopToSiteTicks + 2;
  const totalTicks = loadTicks + supplierTicks + siteTicks + workTicks + closeoutTicks;
  return Math.max(1, totalTicks * 0.5);
}

function formatEstimateCostDriverLabel(driver: ContractEconomyPreview["biggestCostDriver"]): string {
  if (driver === "materials") {
    return "Materials";
  }
  if (driver === "fuel") {
    return "Fuel";
  }
  if (driver === "trash") {
    return "Trash";
  }
  return "None";
}

function getStyleFitHint(skillId: SkillId, archetypeTags: string[]): string {
  const topTag = archetypeTags[0] ?? "";
  const precisionSkills: SkillId[] = ["carpenter", "mason", "tile_setter", "welder", "glazier", "cabinet_maker", "millworker"];
  const safetySkills: SkillId[] = ["demolition_specialist", "scaffolder", "heavy_equipment_operator", "lineman", "roofer"];
  const marginSkills: SkillId[] = ["plumber", "electrician", "flooring_installer", "painter", "siding_installer"];
  const diagnosticsSkills: SkillId[] = ["hvac_technician", "refrigeration_technician", "auto_mechanic", "diesel_mechanic", "industrial_maintenance"];
  const closerSkills: SkillId[] = ["framer", "concrete_finisher", "drywall_installer", "fence_installer", "solar_panel_installer"];

  const fit =
    (topTag === "Precision Shop" && precisionSkills.includes(skillId)) ||
    (topTag === "Safety First" && safetySkills.includes(skillId)) ||
    (topTag === "Margin Master" && marginSkills.includes(skillId)) ||
    (topTag === "Diagnostics Crew" && diagnosticsSkills.includes(skillId)) ||
    (topTag === "Field Closer" && closerSkills.includes(skillId));
  return fit ? `${topTag} bonus alignment` : `${topTag} neutral alignment`;
}

function buildQuickBuyStorageLockCopy(toolNames: string[]): string {
  const toolsLabel = formatQuickBuyToolNames(toolNames);
  const verb = toolNames.length === 1 ? "needs" : "need";
  return `${toolsLabel} ${verb} storage unlocked before quick buy because non-starter tools need storage space.`;
}

function formatQuickBuyToolNames(toolNames: string[]): string {
  if (toolNames.length === 0) {
    return "This tool";
  }
  if (toolNames.length === 1) {
    return toolNames[0]!;
  }
  if (toolNames.length === 2) {
    return `${toolNames[0]} and ${toolNames[1]}`;
  }
  return `${toolNames.slice(0, -1).join(", ")}, and ${toolNames[toolNames.length - 1]}`;
}

