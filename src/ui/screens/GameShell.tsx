import { useEffect, useMemo, useRef, useState } from "react";
import { ActiveModalId, bundle, useUiStore } from "../state";
import { BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import { CompactHeader } from "../components/CompactHeader";
import { Modal } from "../components/Modal";
import rebarBobSprite from "../assets/encounters/rebarbob2026.png";
import { CompanyTab } from "./CompanyTab";
import { OfficeTab } from "./OfficeTab";
import { SettingsTab } from "./SettingsTab";
import { WorkTab } from "./WorkTab";

interface EndDayTransitionState {
  startedAtMs: number;
  durationMs: number;
}

const END_DAY_TRANSITION_MS = 1_000;
const END_DAY_TRANSITION_MIDPOINT_MS = END_DAY_TRANSITION_MS / 2;
const TIER2_COOLDOWN_MS = 1_500;
const PHONE_SHEET_BREAKPOINT_PX = 759;

type Tier2SurfaceKind = "balance" | "encounter" | "task-result";

interface Tier2SurfaceCandidate {
  kind: Tier2SurfaceKind;
  day: number;
  fingerprint: string;
}

interface Tier2SurfaceState extends Tier2SurfaceCandidate {}

const ROUTINE_MODAL_IDS = new Set<Exclude<ActiveModalId, null>>([
  "job-details",
  "inventory",
  "skills",
  "field-log",
  "active-events",
  "districts",
  "crews",
  "news",
  "settings"
]);

function isRoutineModalId(modalId: ActiveModalId): modalId is Exclude<ActiveModalId, null> {
  return Boolean(modalId && ROUTINE_MODAL_IDS.has(modalId));
}

export function GameShell() {
  const [endDayTransition, setEndDayTransition] = useState<EndDayTransitionState | null>(null);
  const [transitionNowMs, setTransitionNowMs] = useState(0);
  const [isPhoneViewport, setIsPhoneViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= PHONE_SHEET_BREAKPOINT_PX : true
  );
  const [tier2Surface, setTier2Surface] = useState<Tier2SurfaceState | null>(null);
  const midpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tier2RegistryRef = useRef<Partial<Record<Tier2SurfaceKind, Tier2SurfaceCandidate & { lastShownAtMs: number }>>>({});
  const game = useUiStore((state) => state.game);
  const activeTab = useUiStore((state) => state.activeTab);
  const activeModal = useUiStore((state) => state.activeModal);
  const activeSheet = useUiStore((state) => state.activeSheet);
  const closeModal = useUiStore((state) => state.closeModal);
  const closeSheet = useUiStore((state) => state.closeSheet);
  const notice = useUiStore((state) => state.notice);
  const clearNotice = useUiStore((state) => state.clearNotice);
  const activeProgressPopup = useUiStore((state) => state.activeProgressPopup);
  const progressQueue = useUiStore((state) => state.progressQueue);
  const dismissProgressPopup = useUiStore((state) => state.dismissProgressPopup);
  const activeTaskResultPopup = useUiStore((state) => state.activeTaskResultPopup);
  const dismissTaskResultPopup = useUiStore((state) => state.dismissTaskResultPopup);
  const goToTab = useUiStore((state) => state.goToTab);
  const endShift = useUiStore((state) => state.endShift);
  const openModal = useUiStore((state) => state.openModal);
  const returnToTitle = useUiStore((state) => state.returnToTitle);
  const dayLaborCelebrationActive = useUiStore((state) => state.dayLaborCelebrationActive);
  const timedTaskAction = useUiStore((state) => state.timedTaskAction);
  const jobCompletionFx = useUiStore((state) => state.jobCompletionFx);
  const activeEncounterPopup = useUiStore((state) => state.activeEncounterPopup);
  const dismissEncounterPopup = useUiStore((state) => state.dismissEncounterPopup);
  const showRoutineModalAsSheet = isPhoneViewport && isRoutineModalId(activeModal);
  const isBalanceDeclinedNotice = notice.toLowerCase().includes("balance declined");
  const normalizedActiveTab = activeTab === "contracts" || activeTab === "store" || activeTab === "company" ? "office" : activeTab;
  const endDayProgress = endDayTransition ? clamp01((transitionNowMs - endDayTransition.startedAtMs) / endDayTransition.durationMs) : 0;
  const endDayBlackoutOpacity = endDayProgress <= 0.5 ? endDayProgress * 2 : (1 - endDayProgress) * 2;
  const endDayPieAngle = Math.round(endDayProgress * 360);
  const tier2Candidates = useMemo<Tier2SurfaceCandidate[]>(() => {
    const day = game?.day ?? 0;
    const candidates: Tier2SurfaceCandidate[] = [];
    if (isBalanceDeclinedNotice) {
      candidates.push({
        kind: "balance",
        day,
        fingerprint: notice.trim()
      });
    }
    if (activeEncounterPopup) {
      candidates.push({
        kind: "encounter",
        day,
        fingerprint: activeEncounterPopup.id
      });
    }
    if (activeTaskResultPopup) {
      candidates.push({
        kind: "task-result",
        day,
        fingerprint: activeTaskResultPopup.digest
      });
    }
    return candidates;
  }, [activeEncounterPopup, activeTaskResultPopup, game?.day, isBalanceDeclinedNotice, notice]);
  const suppressLowerTierUi = Boolean(endDayTransition || tier2Surface);
  const suppressNoticeBanner =
    suppressLowerTierUi ||
    (activeTab === "work" && notice.startsWith("Add the needed items to the supplier cart before checkout")) ||
    isBalanceDeclinedNotice;

  useEffect(() => {
    return () => {
      clearEndDayTransitionTimers(midpointTimerRef, completionTimerRef, transitionTickRef);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => setIsPhoneViewport(window.innerWidth <= PHONE_SHEET_BREAKPOINT_PX);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!endDayTransition) {
      if (transitionTickRef.current !== null) {
        clearInterval(transitionTickRef.current);
        transitionTickRef.current = null;
      }
      return;
    }
    setTransitionNowMs(Date.now());
    if (transitionTickRef.current !== null) {
      clearInterval(transitionTickRef.current);
    }
    transitionTickRef.current = setInterval(() => setTransitionNowMs(Date.now()), 16);
    return () => {
      if (transitionTickRef.current !== null) {
        clearInterval(transitionTickRef.current);
        transitionTickRef.current = null;
      }
    };
  }, [endDayTransition?.startedAtMs]);

  useEffect(() => {
    if (endDayTransition) {
      setTier2Surface(null);
      return;
    }
    if (tier2Candidates.length === 0) {
      setTier2Surface(null);
      return;
    }
    setTier2Surface((current) => {
      if (current && tier2Candidates.some((candidate) => candidate.kind === current.kind && candidate.fingerprint === current.fingerprint)) {
        return current;
      }
      const now = Date.now();
      for (const candidate of tier2Candidates) {
        const prior = tier2RegistryRef.current[candidate.kind];
        const duplicateSameDay = Boolean(prior && prior.day === candidate.day && prior.fingerprint === candidate.fingerprint);
        const coolingDown = Boolean(prior && prior.day === candidate.day && now - prior.lastShownAtMs < TIER2_COOLDOWN_MS);
        if (duplicateSameDay || coolingDown) {
          continue;
        }
        tier2RegistryRef.current[candidate.kind] = {
          ...candidate,
          lastShownAtMs: now
        };
        return candidate;
      }
      return null;
    });
  }, [endDayTransition, tier2Candidates]);

  function handleEndDayTransition() {
    if (timedTaskAction || endDayTransition) {
      return;
    }
    clearEndDayTransitionTimers(midpointTimerRef, completionTimerRef, transitionTickRef);
    const startedAtMs = Date.now();
    setTransitionNowMs(startedAtMs);
    setEndDayTransition({
      startedAtMs,
      durationMs: END_DAY_TRANSITION_MS
    });

    midpointTimerRef.current = setTimeout(() => {
      endShift();
    }, END_DAY_TRANSITION_MIDPOINT_MS);

    completionTimerRef.current = setTimeout(() => {
      setEndDayTransition(null);
      setTransitionNowMs(0);
      clearEndDayTransitionTimers(midpointTimerRef, completionTimerRef, transitionTickRef);
    }, END_DAY_TRANSITION_MS);
  }

  if (!game) {
    return (
      <main className="screen-shell">
        <section className="chrome-card empty-state-card">
          <h2>No active save</h2>
          <p>Start a fresh shift or continue from the title screen.</p>
          <button className="primary-button" onClick={() => returnToTitle()}>
            Back To Title
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="screen-shell app-shell">
      {normalizedActiveTab === "work" ? <CompactHeader game={game} activeTab={normalizedActiveTab} /> : null}
      {activeProgressPopup && !suppressLowerTierUi ? (
        <section
          className={`progress-popup progress-popup-${activeProgressPopup.severity}`}
          role="status"
          aria-live="polite"
          aria-label={activeProgressPopup.title}
        >
          <div className="section-label-row tight-row">
            <div>
              <p className="eyebrow">Progress</p>
              <h3>{activeProgressPopup.title}</h3>
            </div>
            <div className="section-label-row tight-row">
              {progressQueue.length > 0 ? <span className="chip">+{progressQueue.length}</span> : null}
              <button className="icon-button" onClick={() => dismissProgressPopup()} aria-label="Dismiss progress popup">
                Close
              </button>
            </div>
          </div>
          <div className="stack-list progress-popup-lines">
            {activeProgressPopup.lines.map((line, index) => (
              <p key={`${activeProgressPopup.id}-${index}`}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}
      {tier2Surface?.kind === "task-result" && activeTaskResultPopup ? (
        <section className="task-result-popup" role="status" aria-live="polite" aria-label={activeTaskResultPopup.title}>
          <article className="task-result-popup-card chrome-card">
            <div className="section-label-row tight-row">
              <strong>{activeTaskResultPopup.title}</strong>
              <button className="icon-button" onClick={dismissTaskResultPopup} aria-label="Close result popup">
                Close
              </button>
            </div>
            <div className="summary-copy">
              {activeTaskResultPopup.lines.map((line, index) => (
                <p key={`${activeTaskResultPopup.digest}-${index}`}>{line}</p>
              ))}
            </div>
          </article>
        </section>
      ) : null}
      {dayLaborCelebrationActive ? <DayLaborCelebrationOverlay /> : null}
      {tier2Surface?.kind === "balance" && isBalanceDeclinedNotice ? (
        <section className="critical-notice-popup" role="alert" aria-live="assertive" aria-label="Balance Declined">
          <div className="section-label-row tight-row">
            <strong>Balance Declined</strong>
            <button className="icon-button" onClick={() => clearNotice()} aria-label="Dismiss balance declined notice">
              Close
            </button>
          </div>
          <p>{notice}</p>
        </section>
      ) : null}
      {notice && !suppressNoticeBanner ? (
        <button className="notice-banner notice-action" onClick={() => clearNotice()}>
          {notice}
        </button>
      ) : null}
      {tier2Surface?.kind === "encounter" && activeEncounterPopup ? (
        <RebarBobEncounterPopup speaker={activeEncounterPopup.speaker} line={activeEncounterPopup.line} onClose={() => dismissEncounterPopup()} />
      ) : null}
      <section className="tab-stage">
        {normalizedActiveTab === "work" ? <WorkTab /> : null}
        {normalizedActiveTab === "office" ? <OfficeTab /> : null}
      </section>
      <BottomNav
        activeTab={normalizedActiveTab}
        onChange={goToTab}
        onEndDay={handleEndDayTransition}
        onOpenSettings={() => openModal("settings")}
        endDayDisabled={Boolean(timedTaskAction) || Boolean(endDayTransition)}
      />
      <BottomSheet open={activeSheet === "supplies"} title={bundle.strings.supplierTitle || "Supplies"} onClose={closeSheet}>
        <WorkTab sheetOnly />
      </BottomSheet>
      {showRoutineModalAsSheet ? (
        <BottomSheet open={true} title={getRoutineSurfaceTitle(activeModal)} onClose={closeModal}>
          {renderRoutineSurfaceBody(activeModal)}
        </BottomSheet>
      ) : null}
      {!showRoutineModalAsSheet ? (
        <>
          <Modal open={activeModal === "job-details"} title="Job Details" onClose={closeModal}>
            <WorkTab modalView="job-details" />
          </Modal>
          <Modal open={activeModal === "inventory"} title="Inventory" onClose={closeModal}>
            <WorkTab modalView="inventory" />
          </Modal>
          <Modal open={activeModal === "skills"} title="Skills" onClose={closeModal}>
            <WorkTab modalView="skills" />
          </Modal>
          <Modal open={activeModal === "field-log"} title="Field Log" onClose={closeModal}>
            <WorkTab modalView="field-log" />
          </Modal>
          <Modal open={activeModal === "active-events"} title="Active Events" onClose={closeModal}>
            <WorkTab modalView="active-events" />
          </Modal>
          <Modal open={activeModal === "districts"} title={bundle.strings.companyDistrictButton} onClose={closeModal}>
            <CompanyTab modalView="districts" />
          </Modal>
          <Modal open={activeModal === "crews"} title={bundle.strings.companyCrewButton} onClose={closeModal}>
            <CompanyTab modalView="crews" />
          </Modal>
          <Modal open={activeModal === "news"} title={bundle.strings.companyNewsButton} onClose={closeModal}>
            <CompanyTab modalView="news" />
          </Modal>
          <Modal open={activeModal === "settings"} title="Settings" onClose={closeModal}>
            <SettingsTab />
          </Modal>
        </>
      ) : null}
      {jobCompletionFx ? <JobCompletionFxOverlay outcome={jobCompletionFx.outcome} net={jobCompletionFx.net} /> : null}
      {endDayTransition ? <EndDayTransitionOverlay blackoutOpacity={endDayBlackoutOpacity} pieAngle={endDayPieAngle} /> : null}
    </main>
  );
}

function EndDayTransitionOverlay({ blackoutOpacity, pieAngle }: { blackoutOpacity: number; pieAngle: number }) {
  return (
    <section
      className="end-day-transition-overlay"
      role="status"
      aria-live="polite"
      aria-label="Ending Day Transition"
      style={{ backgroundColor: `rgba(0, 0, 0, ${clamp01(blackoutOpacity).toFixed(3)})` }}
    >
      <div className="end-day-transition-pie-wrap">
        <div
          className="end-day-transition-pie"
          style={{
            background: `conic-gradient(rgba(132, 168, 255, 0.92) ${pieAngle}deg, rgba(132, 168, 255, 0.18) ${pieAngle}deg 360deg)`
          }}
        >
          <div className="end-day-transition-pie-inner">
            <span className="end-day-transition-label">Ending Day...</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function DayLaborCelebrationOverlay() {
  return (
    <section className="day-labor-celebration-overlay" aria-hidden="true">
      <div className="day-labor-celebration-banner">DAY LABOR PAYDAY</div>
      <div className="fx-fireworks">
        <span className="fx-firework" />
        <span className="fx-firework" />
        <span className="fx-firework" />
        <span className="fx-firework" />
        <span className="fx-firework" />
        <span className="fx-firework" />
      </div>
      <div className="fx-lightning">
        <span className="fx-bolt" />
        <span className="fx-bolt" />
        <span className="fx-bolt" />
      </div>
      <div className="fx-blasts">
        <span className="fx-blast" />
        <span className="fx-blast" />
        <span className="fx-blast" />
      </div>
      <div className="day-labor-lager-sprites">
        <div className="lager-sprite" role="presentation" aria-hidden="true" />
        <div className="lager-sprite" role="presentation" aria-hidden="true" />
        <div className="lager-sprite" role="presentation" aria-hidden="true" />
      </div>
    </section>
  );
}

function JobCompletionFxOverlay({
  outcome,
  net
}: {
  outcome: "success" | "neutral" | "fail";
  net: number;
}) {
  const outcomeLabel = outcome === "neutral" ? "Low Quality" : outcome === "fail" ? "No Pay" : "Success";
  const outcomeClass = outcome === "neutral" ? "completion-fx-neutral" : outcome === "fail" ? "completion-fx-fail" : "completion-fx-success";
  const netLabel = net >= 0 ? `+$${Math.round(net)}` : `-$${Math.abs(Math.round(net))}`;
  return (
    <section className={`job-completion-fx-overlay ${outcomeClass}`} role="status" aria-live="polite" aria-label="Job completion popup">
      <div className="job-completion-fx-burst" />
      <article className="job-completion-fx-card chrome-card">
        <p className="eyebrow">Job Complete</p>
        <h3>{outcomeLabel}</h3>
        <p className={net >= 0 ? "tone-success" : "tone-danger"}>Net {netLabel}</p>
      </article>
    </section>
  );
}

function RebarBobEncounterPopup({ speaker, line, onClose }: { speaker: string; line: string; onClose: () => void }) {
  return (
    <section className="rebar-bob-encounter-popup" role="status" aria-live="polite" aria-label={`${speaker} encounter`}>
      <div className="rebar-bob-encounter-stage" aria-hidden="true">
        <img src={rebarBobSprite} alt="" className="rebar-bob-encounter-sprite" />
        <div className="rebar-bob-encounter-vignette" />
      </div>
      <article className="rebar-bob-encounter-card chrome-card">
        <div className="rebar-bob-encounter-header">
          <p className="eyebrow rebar-bob-encounter-eyebrow">Random Encounter</p>
          <button className="icon-button rebar-bob-encounter-close" onClick={onClose} aria-label="Close encounter popup">
            Close
          </button>
        </div>
        <strong className="rebar-bob-encounter-speaker">{speaker}</strong>
        <p className="rebar-bob-encounter-line">"{line}"</p>
      </article>
    </section>
  );
}

function clearEndDayTransitionTimers(
  midpointTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  completionTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  transitionTickRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
) {
  if (midpointTimerRef.current !== null) {
    clearTimeout(midpointTimerRef.current);
    midpointTimerRef.current = null;
  }
  if (completionTimerRef.current !== null) {
    clearTimeout(completionTimerRef.current);
    completionTimerRef.current = null;
  }
  if (transitionTickRef.current !== null) {
    clearInterval(transitionTickRef.current);
    transitionTickRef.current = null;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getRoutineSurfaceTitle(modalId: Exclude<ActiveModalId, null>): string {
  if (modalId === "job-details") {
    return "Job Details";
  }
  if (modalId === "inventory") {
    return "Inventory";
  }
  if (modalId === "skills") {
    return "Skills";
  }
  if (modalId === "field-log") {
    return "Field Log";
  }
  if (modalId === "active-events") {
    return "Active Events";
  }
  if (modalId === "districts") {
    return bundle.strings.companyDistrictButton;
  }
  if (modalId === "crews") {
    return bundle.strings.companyCrewButton;
  }
  if (modalId === "news") {
    return bundle.strings.companyNewsButton;
  }
  return "Settings";
}

function renderRoutineSurfaceBody(modalId: Exclude<ActiveModalId, null>) {
  if (modalId === "job-details") {
    return <WorkTab modalView="job-details" />;
  }
  if (modalId === "inventory") {
    return <WorkTab modalView="inventory" />;
  }
  if (modalId === "skills") {
    return <WorkTab modalView="skills" />;
  }
  if (modalId === "field-log") {
    return <WorkTab modalView="field-log" />;
  }
  if (modalId === "active-events") {
    return <WorkTab modalView="active-events" />;
  }
  if (modalId === "districts") {
    return <CompanyTab modalView="districts" />;
  }
  if (modalId === "crews") {
    return <CompanyTab modalView="crews" />;
  }
  if (modalId === "news") {
    return <CompanyTab modalView="news" />;
  }
  return <SettingsTab />;
}
