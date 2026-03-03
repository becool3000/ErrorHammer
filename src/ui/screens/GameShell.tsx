import { bundle, useUiStore } from "../state";
import { BottomNav } from "../components/BottomNav";
import { BottomSheet } from "../components/BottomSheet";
import { CompactHeader } from "../components/CompactHeader";
import { Modal } from "../components/Modal";
import { CompanyTab } from "./CompanyTab";
import { OfficeTab } from "./OfficeTab";
import { SettingsTab } from "./SettingsTab";
import { WorkTab } from "./WorkTab";

export function GameShell() {
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
  const suppressNoticeBanner = activeTab === "work" && notice.startsWith("Add the needed items to the supplier cart before checkout");
  const normalizedActiveTab = activeTab === "contracts" || activeTab === "store" || activeTab === "company" ? "office" : activeTab;

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
      {notice && !suppressNoticeBanner ? (
        <button className="notice-banner notice-action" onClick={() => clearNotice()}>
          {notice}
        </button>
      ) : null}
      <section className="tab-stage">
        {normalizedActiveTab === "work" ? <WorkTab /> : null}
        {normalizedActiveTab === "office" ? <OfficeTab /> : null}
      </section>
      <BottomNav activeTab={normalizedActiveTab} onChange={goToTab} onEndDay={endShift} onOpenSettings={() => openModal("settings")} />
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
    </main>
  );
}
