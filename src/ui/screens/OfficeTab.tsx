import { SegmentedControl } from "../components/SegmentedControl";
import { OfficeSectionId, useUiStore } from "../state";
import { AccountingTab } from "./AccountingTab";
import { CompanyTab } from "./CompanyTab";
import { ContractsTab } from "./ContractsTab";
import { StoreTab } from "./StoreTab";

const officeSections: Array<{ id: OfficeSectionId; label: string }> = [
  { id: "contracts", label: "Contracts" },
  { id: "store", label: "Shop" },
  { id: "company", label: "Company" },
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
      {officeSection === "accounting" ? <AccountingTab /> : null}
    </section>
  );
}
