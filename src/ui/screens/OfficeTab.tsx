import { SegmentedControl } from "../components/SegmentedControl";
import { OfficeSectionId, useUiStore } from "../state";
import { AccountingTab } from "./AccountingTab";
import { CompanyTab } from "./CompanyTab";
import { ContractsTab } from "./ContractsTab";
import { FacilitiesTab } from "./FacilitiesTab";
import { StoreTab } from "./StoreTab";
import { YardTab } from "./YardTab";

const MAX_SECTION_SEGMENTS = 3;

const officeSections: Array<{ id: OfficeSectionId; label: string }> = [
  { id: "contracts", label: "Contracts" },
  { id: "facilities", label: "Facilities" },
  { id: "accounting", label: "Finance" }
];

const officeSectionLabels: Record<OfficeSectionId, string> = {
  contracts: "Contracts",
  facilities: "Facilities",
  accounting: "Finance"
}

export function OfficeTab() {
  const game = useUiStore((state) => state.game);
  const officeSection = useUiStore((state) => state.officeSection);
  const setOfficeSection = useUiStore((state) => state.setOfficeSection);
  const sectionOptions = officeSections.slice(0, MAX_SECTION_SEGMENTS);
  const activeSection = sectionOptions.find((entry) => entry.id === officeSection) ?? sectionOptions[0];
  const activeSectionId = activeSection?.id ?? officeSection;
  const activeSectionLabel = officeSectionLabels[activeSectionId];

  if (!game) {
    return null;
  }

  return (
    <section className="tab-panel office-tab">
      <article className="chrome-card inset-card company-hub-shell">
        <div className="section-label-row tight-row">
          <p className="eyebrow">Company Hub</p>
          <span className="chip company-hub-current">{activeSectionLabel}</span>
        </div>
        <SegmentedControl value={activeSectionId} options={sectionOptions} onChange={setOfficeSection} label="Company sections" />
      </article>
      {activeSectionId !== "accounting" ? <CompanyTab showOverview={false} /> : null}
      {activeSectionId === "contracts" ? <ContractsTab /> : null}
      {activeSectionId === "facilities" ? (
        <section className="stack-list company-hub-stack">
          <FacilitiesTab />
          <YardTab />
          <StoreTab />
        </section>
      ) : null}
      {activeSectionId === "accounting" ? <AccountingTab /> : null}
    </section>
  );
}
