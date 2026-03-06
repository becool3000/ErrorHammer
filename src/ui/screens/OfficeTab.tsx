import { useMemo, useState } from "react";
import { OfficeSectionId, useUiStore } from "../state";
import { AccountingTab } from "./AccountingTab";
import { CompanyTab } from "./CompanyTab";
import { ContractsTab } from "./ContractsTab";
import { FacilitiesTab } from "./FacilitiesTab";
import { ResearchTab } from "./ResearchTab";
import { StoreTab } from "./StoreTab";
import { TradeIndexTab } from "./TradeIndexTab";
import { YardTab } from "./YardTab";

const officeSections: Array<{ id: OfficeSectionId; label: string }> = [
  { id: "contracts", label: "Contracts" },
  { id: "store", label: "Shop" },
  { id: "company", label: "Company" },
  { id: "facilities", label: "Facilities" },
  { id: "research", label: "Research" },
  { id: "yard", label: "Yard" },
  { id: "trade-index", label: "Trade Index" },
  { id: "accounting", label: "Accounting" }
];

export function OfficeTab() {
  const game = useUiStore((state) => state.game);
  const officeSection = useUiStore((state) => state.officeSection);
  const setOfficeSection = useUiStore((state) => state.setOfficeSection);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSectionLabel = useMemo(
    () => officeSections.find((entry) => entry.id === officeSection)?.label ?? "Office",
    [officeSection]
  );

  if (!game) {
    return null;
  }

  function handleSelectOfficeSection(sectionId: OfficeSectionId) {
    setOfficeSection(sectionId);
    setMenuOpen(false);
  }

  return (
    <section className="tab-panel office-tab">
      <article className="chrome-card inset-card office-menu-shell">
        <div className="office-menu-header">
          <button
            type="button"
            className={`ghost-button office-menu-trigger ${menuOpen ? "active" : ""}`}
            aria-label="Office menu"
            aria-expanded={menuOpen}
            aria-controls="office-sections-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="office-menu-icon" aria-hidden="true">
              ☰
            </span>
          </button>
          <span className="chip office-menu-current">{activeSectionLabel}</span>
        </div>
        <div id="office-sections-menu" className={`office-sections-menu ${menuOpen ? "open" : "closed"}`} role="tablist" aria-label="Office sections">
          {officeSections.map((section) => (
            <button
              key={section.id}
              role="tab"
              aria-selected={officeSection === section.id}
              className={officeSection === section.id ? "segment active office-menu-segment" : "segment office-menu-segment"}
              onClick={() => handleSelectOfficeSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </article>
      {officeSection === "contracts" ? <ContractsTab /> : null}
      {officeSection === "store" ? <StoreTab /> : null}
      {officeSection === "company" ? <CompanyTab /> : null}
      {officeSection === "facilities" ? <FacilitiesTab /> : null}
      {officeSection === "research" ? <ResearchTab /> : null}
      {officeSection === "yard" ? <YardTab /> : null}
      {officeSection === "trade-index" ? <TradeIndexTab /> : null}
      {officeSection === "accounting" ? <AccountingTab /> : null}
    </section>
  );
}
