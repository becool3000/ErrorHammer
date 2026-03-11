import { useEffect, useRef, useState } from "react";
import { ActiveModalId, bundle, ResultsRow, ResultsSection, TutorialStepId, useUiStore } from "../state";
import { BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import { CompactHeader } from "../components/CompactHeader";
import { Modal } from "../components/Modal";
import rebarBobSprite from "../assets/encounters/rebarbob2026.png";
import { DayLaborDiggingMinigame } from "../../features/dayLaborDig/DayLaborDiggingMinigame";
import { CompanyTab } from "./CompanyTab";
import { OfficeTab } from "./OfficeTab";
import { SettingsTab } from "./SettingsTab";
import { StoreTab } from "./StoreTab";
import { WorkTab } from "./WorkTab";

interface EndDayTransitionState {
  startedAtMs: number;
  durationMs: number;
}

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown) => void;
  removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown) => void;
};

const END_DAY_TRANSITION_MS = 1_000;
const END_DAY_TRANSITION_MIDPOINT_MS = END_DAY_TRANSITION_MS / 2;
const PHONE_SHEET_BREAKPOINT_PX = 759;
const PARALLAX_LIGHT_FACTOR = 0.22;
const PARALLAX_STRONG_FACTOR = 0.38;
const PARALLAX_LIGHT_MAX_PX = 32;
const PARALLAX_STRONG_MAX_PX = 54;
const RESULTS_SECTIONS: ResultsSection[] = ["Money", "Stats", "Inventory/Tools", "Operations/Office", "Progress/Other"];

const ROUTINE_MODAL_IDS = new Set<Exclude<ActiveModalId, null>>([
  "job-details",
  "inventory",
  "store",
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
  const appShellRef = useRef<HTMLElement | null>(null);
  const parallaxRafRef = useRef<number | null>(null);
  const midpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const game = useUiStore((state) => state.game);
  const uiFxMode = useUiStore((state) => state.uiFxMode);
  const activeTab = useUiStore((state) => state.activeTab);
  const officeSection = useUiStore((state) => state.officeSection);
  const activeModal = useUiStore((state) => state.activeModal);
  const activeSheet = useUiStore((state) => state.activeSheet);
  const selectedContractId = useUiStore((state) => state.selectedContractId);
  const lastAction = useUiStore((state) => state.lastAction);
  const closeModal = useUiStore((state) => state.closeModal);
  const closeSheet = useUiStore((state) => state.closeSheet);
  const notice = useUiStore((state) => state.notice);
  const clearNotice = useUiStore((state) => state.clearNotice);
  const activeProgressPopup = useUiStore((state) => state.activeProgressPopup);
  const progressQueue = useUiStore((state) => state.progressQueue);
  const dismissProgressPopup = useUiStore((state) => state.dismissProgressPopup);
  const activeResultsScreen = useUiStore((state) => state.activeResultsScreen);
  const activeEncounterPopup = useUiStore((state) => state.activeEncounterPopup);
  const dismissEncounterPopup = useUiStore((state) => state.dismissEncounterPopup);
  const dismissResultsScreen = useUiStore((state) => state.dismissResultsScreen);
  const goToTab = useUiStore((state) => state.goToTab);
  const endShift = useUiStore((state) => state.endShift);
  const openModal = useUiStore((state) => state.openModal);
  const returnToTitle = useUiStore((state) => state.returnToTitle);
  const tutorialInProgress = useUiStore((state) => state.tutorialInProgress);
  const tutorialStepId = useUiStore((state) => state.tutorialStepId);
  const skipTutorial = useUiStore((state) => state.skipTutorial);
  const completeTutorial = useUiStore((state) => state.completeTutorial);
  const syncTutorialProgress = useUiStore((state) => state.syncTutorialProgress);
  const dayLaborCelebrationActive = useUiStore((state) => state.dayLaborCelebrationActive);
  const activeDayLaborMinigame = useUiStore((state) => state.activeDayLaborMinigame);
  const restartDayLaborMinigame = useUiStore((state) => state.restartDayLaborMinigame);
  const submitDayLaborMinigameResult = useUiStore((state) => state.submitDayLaborMinigameResult);
  const forfeitDayLaborMinigame = useUiStore((state) => state.forfeitDayLaborMinigame);
  const timedTaskAction = useUiStore((state) => state.timedTaskAction);
  const jobCompletionFx = useUiStore((state) => state.jobCompletionFx);
  const showRoutineModalAsSheet = isPhoneViewport && isRoutineModalId(activeModal);
  const normalizedActiveTab = activeTab === "contracts" || activeTab === "store" || activeTab === "company" ? "office" : activeTab;
  const endDayProgress = endDayTransition ? clamp01((transitionNowMs - endDayTransition.startedAtMs) / endDayTransition.durationMs) : 0;
  const endDayBlackoutOpacity = endDayProgress <= 0.5 ? endDayProgress * 2 : (1 - endDayProgress) * 2;
  const endDayPieAngle = Math.round(endDayProgress * 360);
  const suppressLowerTierUi = Boolean(endDayTransition || activeResultsScreen || activeDayLaborMinigame);
  const suppressNoticeBanner = suppressLowerTierUi || (activeTab === "work" && notice.startsWith("Add the needed items to the supplier cart before checkout"));
  const hasActiveGame = Boolean(game);

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
    if (typeof window === "undefined") {
      return;
    }
    const root = document.querySelector<HTMLElement>(".app-root");
    const shell = appShellRef.current;
    const mediaQuery: LegacyMediaQueryList | null =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    const setParallaxOffsets = (lightOffsetPx: number, strongOffsetPx: number) => {
      const lightValue = `${lightOffsetPx.toFixed(2)}px`;
      const strongValue = `${strongOffsetPx.toFixed(2)}px`;
      root?.style.setProperty("--parallax-y", lightValue);
      root?.style.setProperty("--parallax-y-strong", strongValue);
      shell?.style.setProperty("--parallax-y", lightValue);
      shell?.style.setProperty("--parallax-y-strong", strongValue);
    };

    if (!hasActiveGame || !shell) {
      setParallaxOffsets(0, 0);
      return;
    }

    const isReducedMotion = () => uiFxMode === "reduced" || Boolean(mediaQuery?.matches);

    const updateParallax = () => {
      parallaxRafRef.current = null;
      if (isReducedMotion()) {
        setParallaxOffsets(0, 0);
        return;
      }
      const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
      const lightOffsetPx = Math.min(PARALLAX_LIGHT_MAX_PX, scrollY * PARALLAX_LIGHT_FACTOR);
      const strongOffsetPx = Math.min(PARALLAX_STRONG_MAX_PX, scrollY * PARALLAX_STRONG_FACTOR);
      setParallaxOffsets(lightOffsetPx, strongOffsetPx);
    };

    const queueParallaxUpdate = () => {
      if (parallaxRafRef.current !== null) {
        return;
      }
      parallaxRafRef.current = scheduleAnimationFrame(() => updateParallax());
    };

    const handleMotionChange = () => queueParallaxUpdate();
    queueParallaxUpdate();
    window.addEventListener("scroll", queueParallaxUpdate, { passive: true });
    window.addEventListener("resize", queueParallaxUpdate);
    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleMotionChange);
      } else {
        mediaQuery.addListener?.(handleMotionChange);
      }
    }

    return () => {
      window.removeEventListener("scroll", queueParallaxUpdate);
      window.removeEventListener("resize", queueParallaxUpdate);
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", handleMotionChange);
        } else {
          mediaQuery.removeListener?.(handleMotionChange);
        }
      }
      if (parallaxRafRef.current !== null) {
        cancelScheduledAnimationFrame(parallaxRafRef.current);
        parallaxRafRef.current = null;
      }
      setParallaxOffsets(0, 0);
    };
  }, [hasActiveGame, uiFxMode]);

  useEffect(() => {
    syncTutorialProgress();
  }, [syncTutorialProgress, tutorialInProgress, tutorialStepId, activeTab, officeSection, selectedContractId, lastAction?.title, activeResultsScreen, game?.day]);

  function handleEndDayTransition() {
    if (timedTaskAction || endDayTransition || activeResultsScreen) {
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
    <main className="screen-shell app-shell" ref={appShellRef}>
      {normalizedActiveTab === "work" ? <CompactHeader game={game} activeTab={normalizedActiveTab} /> : null}
      {tutorialInProgress ? (
        <TutorialCoachCard
          stepId={tutorialStepId}
          dayLaborCelebrationActive={dayLaborCelebrationActive}
          onSkip={() => skipTutorial()}
          onComplete={() => completeTutorial()}
        />
      ) : null}
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
      {dayLaborCelebrationActive ? <DayLaborCelebrationOverlay /> : null}
      {notice && !suppressNoticeBanner ? (
        <button className="notice-banner notice-action" onClick={() => clearNotice()}>
          {notice}
        </button>
      ) : null}
      <section className="tab-stage">
        {normalizedActiveTab === "work" ? <WorkTab /> : null}
        {normalizedActiveTab === "office" ? <OfficeTab /> : null}
      </section>
      {!activeDayLaborMinigame ? (
        <BottomNav
          activeTab={normalizedActiveTab}
          onChange={goToTab}
          onEndDay={handleEndDayTransition}
          onOpenSettings={() => openModal("settings")}
          endDayDisabled={Boolean(timedTaskAction) || Boolean(endDayTransition) || Boolean(activeResultsScreen)}
        />
      ) : null}
      <BottomSheet open={activeSheet === "supplies"} title={bundle.strings.supplierTitle || "Supplies"} onClose={closeSheet}>
        <WorkTab sheetOnly />
      </BottomSheet>
      {showRoutineModalAsSheet ? (
        <BottomSheet open={true} title={getRoutineSurfaceTitle(activeModal)} onClose={closeModal} shellClassName={getRoutineSurfaceShellClass(activeModal)}>
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
          <Modal open={activeModal === "store"} title="Tools & Supplies" onClose={closeModal} shellClassName="store-supplies-modal">
            <StoreTab />
          </Modal>
          <Modal open={activeModal === "skills"} title="Skills" onClose={closeModal} shellClassName="skills-modal">
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
          <Modal open={activeModal === "news"} title={bundle.strings.companyNewsButton} onClose={closeModal} shellClassName="competitor-news-modal">
            <CompanyTab modalView="news" />
          </Modal>
          <Modal open={activeModal === "settings"} title="Settings" onClose={closeModal}>
            <SettingsTab />
          </Modal>
        </>
      ) : null}
      {activeEncounterPopup ? (
        <RebarBobEncounterPopup speaker={activeEncounterPopup.speaker} line={activeEncounterPopup.line} onClose={() => dismissEncounterPopup()} />
      ) : null}
      {jobCompletionFx ? <JobCompletionFxOverlay outcome={jobCompletionFx.outcome} net={jobCompletionFx.net} /> : null}
      {endDayTransition ? <EndDayTransitionOverlay blackoutOpacity={endDayBlackoutOpacity} pieAngle={endDayPieAngle} /> : null}
      {activeDayLaborMinigame ? (
        <DayLaborDiggingMinigame
          sessionId={activeDayLaborMinigame.sessionId}
          config={activeDayLaborMinigame.config}
          onRestart={() => restartDayLaborMinigame()}
          onSubmit={(result) => submitDayLaborMinigameResult(result)}
          onForfeit={() => forfeitDayLaborMinigame()}
        />
      ) : null}
      {activeResultsScreen && !endDayTransition ? (
        <ResultsScreenOverlay onContinue={() => dismissResultsScreen()} rows={activeResultsScreen.rows} detailLines={activeResultsScreen.detailLines} title={activeResultsScreen.title} />
      ) : null}
    </main>
  );
}

function TutorialCoachCard({
  stepId,
  dayLaborCelebrationActive,
  onSkip,
  onComplete
}: {
  stepId: TutorialStepId;
  dayLaborCelebrationActive: boolean;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const content = getTutorialCoachContent(stepId, dayLaborCelebrationActive);
  const isComplete = stepId === "done";

  return (
    <section className="tutorial-coach-card chrome-card" role="status" aria-live="polite" aria-label="Tutorial coach">
      <div className="section-label-row tight-row">
        <div>
          <p className="eyebrow">Tutorial Coach</p>
          <h3>{content.title}</h3>
        </div>
        <span className={`chip ${isComplete ? "tone-success" : "tone-info"}`}>{content.progress}</span>
      </div>
      <p className="muted-copy">{content.instruction}</p>
      {content.waitingCopy ? <p className="muted-copy">{content.waitingCopy}</p> : null}
      <div className="action-row">
        {isComplete ? (
          <button className="primary-button" onClick={onComplete}>
            Finish Tutorial
          </button>
        ) : null}
        <button className="ghost-button" onClick={onSkip}>
          Skip Tutorial
        </button>
      </div>
    </section>
  );
}

function getTutorialCoachContent(stepId: TutorialStepId, dayLaborCelebrationActive: boolean): {
  title: string;
  instruction: string;
  progress: string;
  waitingCopy?: string;
} {
  if (stepId === "open-contracts") {
    return {
      title: "Open Company Contracts",
      instruction: "Tap Company, then open Contracts.",
      progress: "1/11"
    };
  }
  if (stepId === "select-day-labor") {
    return {
      title: "Select Day Labor",
      instruction: "Pick the Day Labor contract so you can run a safe first shift.",
      progress: "2/11"
    };
  }
  if (stepId === "complete-day-labor") {
    return {
      title: "Run Day Labor",
      instruction: "Accept Day Labor and complete the action until the results panel appears.",
      progress: "3/11",
      waitingCopy: dayLaborCelebrationActive ? "Day Labor celebration cooldown is active. Wait a few seconds, then try again." : undefined
    };
  }
  if (stepId === "continue-day-labor-results") {
    return {
      title: "Continue Day Labor Results",
      instruction: "Press Continue on the Day Labor results panel.",
      progress: "4/11"
    };
  }
  if (stepId === "end-day") {
    return {
      title: "End The Day",
      instruction: "Press End Day once to roll into the next day.",
      progress: "5/11"
    };
  }
  if (stepId === "select-baba-g") {
    return {
      title: "Select A Baba G Job",
      instruction: "Back on Contracts, select the Baba G spotlight card.",
      progress: "6/11"
    };
  }
  if (stepId === "accept-baba-g") {
    return {
      title: "Accept Baba G Job",
      instruction: "Accept the selected Baba G contract and wait for the acceptance results panel.",
      progress: "7/11"
    };
  }
  if (stepId === "continue-baba-accept-results") {
    return {
      title: "Continue Acceptance Results",
      instruction: "Press Continue to enter the Baba G job flow.",
      progress: "8/11"
    };
  }
  if (stepId === "complete-baba-task") {
    return {
      title: "Run One Baba G Task",
      instruction: "On Work, run one action on the Baba G job until a Task Result panel appears.",
      progress: "9/11"
    };
  }
  if (stepId === "continue-baba-task-results") {
    return {
      title: "Continue Task Results",
      instruction: "Press Continue on the task results panel.",
      progress: "10/11"
    };
  }
  return {
    title: "Tutorial Complete",
    instruction: "You finished the Day Labor and Baba G walkthrough. You can replay this anytime from Settings.",
    progress: "11/11"
  };
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
    <section className="rebar-bob-encounter-popup" role="dialog" aria-modal="false" aria-label="Rebar Bob Encounter">
      <div className="rebar-bob-encounter-stage" aria-hidden="true">
        <img className="rebar-bob-encounter-sprite" src={rebarBobSprite} alt="" />
        <div className="rebar-bob-encounter-vignette" />
      </div>
      <article className="rebar-bob-encounter-card chrome-card">
        <header className="rebar-bob-encounter-header">
          <p className="eyebrow rebar-bob-encounter-eyebrow">Encounter</p>
          <button className="icon-button rebar-bob-encounter-close" onClick={onClose} aria-label="Dismiss Rebar Bob encounter">
            Close
          </button>
        </header>
        <strong>{speaker}</strong>
        <p className="rebar-bob-encounter-line">{line}</p>
      </article>
    </section>
  );
}

function ResultsScreenOverlay({
  title,
  rows,
  detailLines,
  onContinue
}: {
  title: string;
  rows: ResultsRow[];
  detailLines: string[];
  onContinue: () => void;
}) {
  const groupedRows = RESULTS_SECTIONS.map((section) => ({
    section,
    rows: rows.filter((row) => row.section === section)
  })).filter((group) => group.rows.length > 0);

  return (
    <section className="results-screen-overlay" role="dialog" aria-modal="true" aria-label="Results Screen">
      <article className="results-screen-card chrome-card">
        <div className="section-label-row tight-row">
          <div>
            <h3>{title}</h3>
          </div>
          <button className="primary-button results-screen-continue" onClick={onContinue} aria-label="Continue after results">
            Continue
          </button>
        </div>
        <div className="results-screen-scroll">
          {groupedRows.map((group) => (
            <section key={group.section} className="results-screen-section">
              <h4>{group.section}</h4>
                <div className="results-screen-grid" role="table" aria-label={`${group.section} changes`}>
                  <div className="results-screen-row results-screen-row-head" role="row">
                    <span className="results-screen-cell results-screen-label">Item</span>
                    <span className="results-screen-cell">Before</span>
                    <span className="results-screen-cell">After</span>
                  </div>
                  {group.rows.map((row, index) => (
                    <div key={`${group.section}-${row.label}-${index}`} className={`results-screen-row ${getResultsToneClass(row.tone)}`} role="row">
                      <span className="results-screen-cell results-screen-label">{row.label}</span>
                      <span className="results-screen-cell">{row.before}</span>
                      <span className="results-screen-cell">{row.after}</span>
                    </div>
                  ))}
                </div>
              </section>
          ))}
          {detailLines.length > 0 ? (
            <section className="results-screen-details">
              <h4>Details</h4>
              <div className="summary-copy">
                {detailLines.map((line, index) => (
                  <p key={`detail-${index}`}>{line}</p>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </article>
    </section>
  );
}

function getResultsToneClass(tone: ResultsRow["tone"]): string {
  if (tone === "positive") {
    return "tone-success";
  }
  if (tone === "negative") {
    return "tone-danger";
  }
  if (tone === "warning") {
    return "tone-warning";
  }
  return "tone-info";
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

function scheduleAnimationFrame(callback: () => void): number {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(() => callback());
  }
  return window.setTimeout(() => callback(), 16);
}

function cancelScheduledAnimationFrame(handle: number) {
  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
}

function getRoutineSurfaceTitle(modalId: Exclude<ActiveModalId, null>): string {
  if (modalId === "job-details") {
    return "Job Details";
  }
  if (modalId === "inventory") {
    return "Inventory";
  }
  if (modalId === "store") {
    return "Tools & Supplies";
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

function getRoutineSurfaceShellClass(modalId: Exclude<ActiveModalId, null>): string | undefined {
  if (modalId === "news") {
    return "competitor-news-modal";
  }
  if (modalId === "store") {
    return "store-supplies-modal";
  }
  if (modalId === "skills") {
    return "skills-modal";
  }
  return undefined;
}

function renderRoutineSurfaceBody(modalId: Exclude<ActiveModalId, null>) {
  if (modalId === "job-details") {
    return <WorkTab modalView="job-details" />;
  }
  if (modalId === "inventory") {
    return <WorkTab modalView="inventory" />;
  }
  if (modalId === "store") {
    return <StoreTab />;
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
