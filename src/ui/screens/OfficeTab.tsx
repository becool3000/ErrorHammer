import { SegmentedControl } from "../components/SegmentedControl";
import { OfficeSectionId, useUiStore } from "../state";
import { AccountingTab } from "./AccountingTab";
import { CompanyTab } from "./CompanyTab";
import { ContractsTab } from "./ContractsTab";
import { ResearchTab } from "./ResearchTab";
import { StoreTab } from "./StoreTab";
import { TradeIndexTab } from "./TradeIndexTab";
import { YardTab } from "./YardTab";

const officeSections: Array<{ id: OfficeSectionId; label: string }> = [
  { id: "contracts", label: "Contracts" },
  { id: "store", label: "Shop" },
  { id: "company", label: "Company" },
  { id: "research", label: "Research" },
  { id: "yard", label: "Yard" },
  { id: "trade-index", label: "Trade Index" },
  { id: "accounting", label: "Accounting" }
];

export function OfficeTab() {
  const game = useUiStore((state) => state.game);
  const officeSection = useUiStore((state) => state.officeSection);
  const setOfficeSection = useUiStore((state) => state.setOfficeSection);

  if (!game) {
    return null;
  }

  return (
    <section className="tab-panel office-tab">
      <article className="chrome-card inset-card">
        <SegmentedControl value={officeSection} options={officeSections} onChange={setOfficeSection} label="Office sections" />
      </article>
      {officeSection === "contracts" ? <ContractsTab /> : null}
      {officeSection === "store" ? <StoreTab /> : null}
      {officeSection === "company" ? <CompanyTab /> : null}
      {officeSection === "research" ? <ResearchTab /> : null}
      {officeSection === "yard" ? <YardTab /> : null}
      {officeSection === "trade-index" ? <TradeIndexTab /> : null}
      {officeSection === "accounting" ? <AccountingTab /> : null}
    </section>
  );
}
