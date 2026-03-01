import { GameTabId } from "../state";

const tabs: Array<{ id: GameTabId; label: string; short: string }> = [
  { id: "work", label: "Work", short: "Ops" },
  { id: "contracts", label: "Contracts", short: "Board" },
  { id: "store", label: "Store", short: "Supply" },
  { id: "company", label: "Company", short: "Firm" }
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
          <small>{tab.short}</small>
        </button>
      ))}
    </nav>
  );
}
