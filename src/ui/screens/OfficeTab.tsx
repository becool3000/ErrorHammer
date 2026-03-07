import { SegmentedControl } from "../components/SegmentedControl";
import { OfficeCategoryId, OfficeSectionId, useUiStore } from "../state";
import { AccountingTab } from "./AccountingTab";
import { CompanyTab } from "./CompanyTab";
import { ContractsTab } from "./ContractsTab";
import { FacilitiesTab } from "./FacilitiesTab";
import { StoreTab } from "./StoreTab";
import { YardTab } from "./YardTab";

const MAX_CATEGORY_SEGMENTS = 3;
const MAX_SECTION_SEGMENTS = 3;

const officeCategories: Array<{ id: OfficeCategoryId; label: string }> = [
  { id: "operations", label: "Operations" },
  { id: "finance", label: "Finance" }
];

const officeSectionsByCategory: Record<OfficeCategoryId, Array<{ id: OfficeSectionId; label: string }>> = {
  operations: [
    { id: "contracts", label: "Contracts" },
    { id: "facilities", label: "Facilities" }
  ],
  finance: [{ id: "accounting", label: "Accounting" }]
};

const officeSectionLabels: Record<OfficeSectionId, string> = {
  contracts: "Contracts",
  facilities: "Facilities",
  accounting: "Accounting"
};

function getOfficeCategoryForSection(section: OfficeSectionId): OfficeCategoryId {
  return section === "accounting" ? "finance" : "operations";
}

export function OfficeTab() {
  const game = useUiStore((state) => state.game);
  const officeCategory = useUiStore((state) => state.officeCategory);
  const officeSection = useUiStore((state) => state.officeSection);
  const setOfficeCategory = useUiStore((state) => state.setOfficeCategory);
  const setOfficeSection = useUiStore((state) => state.setOfficeSection);
  const categoryOptions = officeCategories.slice(0, MAX_CATEGORY_SEGMENTS);
  const effectiveOfficeCategory = officeSectionsByCategory[officeCategory].some((entry) => entry.id === officeSection)
    ? officeCategory
    : getOfficeCategoryForSection(officeSection);
  const activeCategory = categoryOptions.find((entry) => entry.id === effectiveOfficeCategory) ?? categoryOptions[0] ?? officeCategories[0];
  const activeCategoryId = activeCategory?.id ?? "operations";
  const categorySections = officeSectionsByCategory[activeCategoryId].slice(0, MAX_SECTION_SEGMENTS);
  const activeSection = categorySections.find((entry) => entry.id === officeSection) ?? categorySections[0];
  const activeSectionId = activeSection?.id ?? officeSection;
  const activeSectionLabel = officeSectionLabels[activeSectionId];
  const activeCategoryLabel = activeCategory?.label ?? "Company";
  const showSectionControl = categorySections.length > 1;

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
        <SegmentedControl value={activeCategoryId} options={categoryOptions} onChange={setOfficeCategory} label="Company categories" />
        {showSectionControl ? (
          <SegmentedControl value={activeSectionId} options={categorySections} onChange={setOfficeSection} label={`${activeCategoryLabel} sections`} />
        ) : null}
      </article>
      {activeCategoryId === "operations" ? <CompanyTab showOverview={false} /> : null}
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
