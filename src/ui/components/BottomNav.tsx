import { GameTabId } from "../state";

const tabs: Array<{ id: GameTabId; label: string }> = [
  { id: "work", label: "Work" },
  { id: "office", label: "Office" }
];

interface BottomNavProps {
  activeTab: GameTabId;
  onChange: (tab: GameTabId) => void;
  onEndDay: () => void;
  onOpenSettings: () => void;
}

export function BottomNav({ activeTab, onChange, onEndDay, onOpenSettings }: BottomNavProps) {
  const selectedTab: GameTabId =
    activeTab === "contracts" || activeTab === "store" || activeTab === "company" ? "office" : activeTab;

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === selectedTab ? "tab-button active" : "tab-button"}
          onClick={() => onChange(tab.id)}
          aria-pressed={tab.id === selectedTab}
        >
          <span>{tab.label}</span>
        </button>
      ))}
      <button className="tab-button" onClick={() => onEndDay()} aria-label="End Day">
        <span>End Day</span>
      </button>
      <button className="tab-button settings-gear-button" onClick={() => onOpenSettings()} aria-label="Settings">
        <span className="settings-gear-icon" aria-hidden="true">
          ⚙
        </span>
      </button>
    </nav>
  );
}
