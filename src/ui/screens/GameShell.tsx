import { useEffect, useRef, useState } from "react";
import { bundle, useUiStore } from "../state";
import { BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import { CompactHeader } from "../components/CompactHeader";
import { Modal } from "../components/Modal";
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

export function GameShell() {
  const [endDayTransition, setEndDayTransition] = useState<EndDayTransitionState | null>(null);
  const [transitionNowMs, setTransitionNowMs] = useState(0);
  const midpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const goToTab = useUiStore((state) => state.goToTab);
  const endShift = useUiStore((state) => state.endShift);
  const openModal = useUiStore((state) => state.openModal);
  const returnToTitle = useUiStore((state) => state.returnToTitle);
  const dayLaborCelebrationActive = useUiStore((state) => state.dayLaborCelebrationActive);
  const timedTaskAction = useUiStore((state) => state.timedTaskAction);
  const isBalanceDeclinedNotice = notice.toLowerCase().includes("balance declined");
  const suppressNoticeBanner =
    (activeTab === "work" && notice.startsWith("Add the needed items to the supplier cart before checkout")) || isBalanceDeclinedNotice;
  const normalizedActiveTab = activeTab === "contracts" || activeTab === "store" || activeTab === "company" ? "office" : activeTab;
  const endDayProgress = endDayTransition ? clamp01((transitionNowMs - endDayTransition.startedAtMs) / endDayTransition.durationMs) : 0;
  const endDayBlackoutOpacity = endDayProgress <= 0.5 ? endDayProgress * 2 : (1 - endDayProgress) * 2;
  const endDayPieAngle = Math.round(endDayProgress * 360);

  useEffect(() => {
    return () => {
      clearEndDayTransitionTimers(midpointTimerRef, completionTimerRef, transitionTickRef);
    };
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
      {activeProgressPopup ? (
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
      {dayLaborCelebrationActive ? <DayLaborCelebrationOverlay /> : null}
      {isBalanceDeclinedNotice ? (
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
