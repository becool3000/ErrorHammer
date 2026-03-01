import { GameTabId } from "../state";

const tabs: Array<{ id: GameTabId; label: string }> = [
  { id: "work", label: "Work" },
  { id: "contracts", label: "Contracts" },
  { id: "store", label: "Store" },
  { id: "company", label: "Company" }
];

interface BottomNavProps {
  activeTab: GameTabId;
  onChange: (tab: GameTabId) => void;
}

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === activeTab ? "tab-button active" : "tab-button"}
          onClick={() => onChange(tab.id)}
          aria-pressed={tab.id === activeTab}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
