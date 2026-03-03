// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import { useUiStore, bundle } from "../src/ui/state";
import { acceptContract as acceptContractFlow, DAY_LABOR_CONTRACT_ID, getAvailableContractOffers } from "../src/core/playerFlow";
import { SAVE_VERSION } from "../src/core/save";
import { createInitialGameState } from "../src/core/resolver";
import { SupplyQuality } from "../src/core/types";

function installLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key)
    },
    configurable: true
  });
  return store;
}

function resetUi() {
  useUiStore.setState({
    screen: "title",
    activeTab: "work",
    officeSection: "contracts",
    storeSection: "fuel",
    activeModal: null,
    activeSheet: null,
    selectedContractId: null,
    game: null,
    lastAction: null,
    notice: "",
    uiTextScale: "default",
    uiColorMode: "neon",
    sessionTelemetry: {
      startedAtMs: Date.now(),
      startDay: 1,
      startReputation: 0,
      interactions: 0,
      endDayPresses: 0
    },
    activeProgressPopup: null,
    progressQueue: [],
    titlePlayerName: "",
    titleCompanyName: ""
  });
}

function buildAcceptableGame(seed: number) {
  const game = createInitialGameState(bundle, seed);
  for (const tool of bundle.tools) {
    game.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
  return game;
}

function filledInventory(quantity: number) {
  return Object.fromEntries(bundle.supplies.map((supply) => [supply.id, { medium: quantity }])) as Record<string, Record<SupplyQuality, number>>;
}

describe("compact shell ui", () => {
  beforeEach(() => {
    cleanup();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installLocalStorage();
    resetUi();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("EH-TW-023: New Game enters the compact Work tab shell", () => {
    render(<App />);

    const nameInput = screen.getByLabelText(/Your Name/i);
    const companyInput = screen.getByLabelText(/Company Name/i);
    const newGameButton = screen.getByRole("button", { name: "New Game" });

    expect(newGameButton.disabled).toBe(true);
    fireEvent.change(nameInput, { target: { value: "Margo" } });
    expect(newGameButton.disabled).toBe(true);
    fireEvent.change(companyInput, { target: { value: "Margo Metalworks" } });
    expect(newGameButton.disabled).toBe(false);

    fireEvent.click(newGameButton);

    expect(screen.getByRole("heading", { name: /Day 1/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Work$/i, pressed: true })).toBeTruthy();
    expect(screen.getByText(/^Margo$/)).toBeTruthy();
    expect(screen.getByText(/Margo Metalworks/)).toBeTruthy();
    const playerHud = screen.getByRole("list", { name: /Player HUD/i });
    expect(playerHud.textContent ?? "").toMatch(/Fatigue\s*0/i);
  });

  it("EH-TW-063: defaults to standard text scale when no ui preference exists", () => {
    render(<App />);
    const appRoot = document.querySelector(".app-root");
    expect(appRoot?.getAttribute("data-text-scale")).toBe("default");
    expect(appRoot?.getAttribute("data-color-mode")).toBe("neon");
  });

  it("EH-TW-064: selecting text size updates the app scale attribute", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: "Margo" } });
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: "Margo Metalworks" } });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    fireEvent.click(screen.getByRole("button", { name: /Settings/i }));

    fireEvent.click(screen.getByRole("tab", { name: "XS" }));
    expect(document.querySelector(".app-root")?.getAttribute("data-text-scale")).toBe("xsmall");

    fireEvent.click(screen.getByRole("tab", { name: "Large" }));
    expect(document.querySelector(".app-root")?.getAttribute("data-text-scale")).toBe("large");

    fireEvent.click(screen.getByRole("tab", { name: "XL" }));
    expect(document.querySelector(".app-root")?.getAttribute("data-text-scale")).toBe("xlarge");
  });

  it("EH-TW-065: text scale preference persists via localStorage and hydrates on mount", () => {
    render(<App />);

    act(() => {
      useUiStore.getState().setUiTextScale("xlarge");
    });
    expect(localStorage.getItem("error-hammer-ui-prefs-v1")).toContain("\"xlarge\"");

    cleanup();
    resetUi();
    render(<App />);

    expect(document.querySelector(".app-root")?.getAttribute("data-text-scale")).toBe("xlarge");
  });

  it("EH-TW-066: gameplay flow remains functional after changing text scale", () => {
    render(<App />);

    act(() => {
      useUiStore.getState().setUiTextScale("large");
    });

    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: "Margo" } });
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: "Margo Metalworks" } });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));

    expect(screen.getByRole("heading", { name: /Day 1/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Office$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Shop" }));
    expect(screen.getByRole("button", { name: /^Office$/i, pressed: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Work$/i }));
    fireEvent.click(screen.getByRole("button", { name: /View Log/i }));
    expect(screen.getByRole("dialog", { name: /Field Log/i })).toBeTruthy();
  });

  it("EH-TW-043: title form retains typed names and repopulates after returning to the title screen", () => {
    render(<App />);

    const nameInput = screen.getByLabelText(/Your Name/i);
    const companyInput = screen.getByLabelText(/Company Name/i);
    const newGameButton = screen.getByRole("button", { name: "New Game" });

    fireEvent.change(nameInput, { target: { value: "Margo" } });
    fireEvent.change(companyInput, { target: { value: "Margo Metalworks" } });
    expect(newGameButton.disabled).toBe(false);

    fireEvent.click(newGameButton);
    act(() => {
      useUiStore.getState().returnToTitle();
    });

    const nameInputAfter = screen.getByLabelText(/Your Name/i) as HTMLInputElement;
    const companyInputAfter = screen.getByLabelText(/Company Name/i) as HTMLInputElement;
    expect(nameInputAfter.value).toBe("Margo");
    expect(companyInputAfter.value).toBe("Margo Metalworks");
  });


  it("EH-TW-024: Continue restores a save and opens Work", () => {
    const saved = createInitialGameState(bundle, 9001);
    localStorage.setItem("error-hammer-save-v2", JSON.stringify({ ...saved, saveVersion: SAVE_VERSION }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("button", { name: /^Work$/i, pressed: true })).toBeTruthy();
    expect(screen.getByText(/No active job/i)).toBeTruthy();
  });

  it("EH-TW-070: Work tab no longer shows day labor action when there is no active job", () => {
    const game = createInitialGameState(bundle, 9010);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: null });

    render(<App />);
    expect(screen.queryByRole("button", { name: /Work Day Laborer Shift/i })).toBeNull();
  });

  it("EH-TW-025: empty Work state includes the contract-board CTA", () => {
    const game = createInitialGameState(bundle, 2025);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Open Contract Board/i }));
    expect(screen.getByRole("button", { name: /^Office$/i, pressed: true })).toBeTruthy();
  });

  it("EH-TW-026 and EH-TW-027: selecting and accepting a contract returns focus to Work", () => {
    const game = buildAcceptableGame(3030);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    const acceptButton = screen.getByRole("button", { name: /Accept Job/i });
    fireEvent.click(acceptButton);

    expect(screen.getByRole("button", { name: /^Work$/i, pressed: true })).toBeTruthy();
    expect(screen.getByText(/Current Task/i)).toBeTruthy();
    expect(screen.queryByText(/Needed Supplies/i)).toBeNull();
  });

  it("EH-TW-101: accepted Baba G contracts render in Work tab like active jobs", () => {
    const game = buildAcceptableGame(9311);
    const babaOffer = getAvailableContractOffers(game, bundle).find(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && offer.job.tags.includes("baba-g")
    );
    expect(babaOffer).toBeTruthy();
    const accepted = acceptContractFlow(game, bundle, babaOffer!.contract.contractId);
    expect(accepted.nextState.activeJob?.jobId).toBe(babaOffer?.job.id);
    useUiStore.setState({ screen: "game", game: accepted.nextState, activeTab: "work", selectedContractId: null });

    render(<App />);

    expect(screen.queryByText(/No active job/i)).toBeNull();
    expect(screen.getByText(/Current Task/i)).toBeTruthy();
    expect(screen.getByText(babaOffer!.job.name)).toBeTruthy();
  });

  it("EH-TW-071: Work tab no longer shows day labor action while an active job is in progress", () => {
    const game = buildAcceptableGame(3031);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));
    fireEvent.click(screen.getByRole("button", { name: /Toggle active job details for/i }));

    expect(screen.queryByRole("button", { name: /Day Labor Shift/i })).toBeNull();
  });

  it("EH-TW-029: field log modal opens and closes without changing the active tab", () => {
    const game = createInitialGameState(bundle, 4040);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /View Log/i }));
    expect(screen.getByRole("dialog", { name: /Field Log/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close Field Log/i }));

    expect(screen.queryByRole("dialog", { name: /Field Log/i })).toBeNull();
    expect(useUiStore.getState().activeTab).toBe("work");
  });

  it("EH-TW-054: operator card exposes inventory and skills modals", () => {
    const game = createInitialGameState(bundle, 4041);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Inventory$/i }));
    expect(screen.getByRole("dialog", { name: /Inventory/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close Inventory/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Skills$/i }));
    expect(screen.getByRole("dialog", { name: /Skills/i })).toBeTruthy();
    expect(screen.getByText(/Skill Ledger/i)).toBeTruthy();
    expect(screen.getAllByText(/Avg XP \d+/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Electrician/i)).toBeTruthy();
    expect(screen.getByText(/HVAC Technician/i)).toBeTruthy();
    expect(screen.getByText(/Solar Panel Installer/i)).toBeTruthy();
    expect(screen.getByText(/Concrete Finisher/i)).toBeTruthy();
    expect(screen.getAllByText(/Lv 1/i).length).toBeGreaterThan(0);
  });

  it("EH-TW-055: XP gains are shown in Task Result while level-up popups still surface", () => {
    const game = buildAcceptableGame(4042);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        game: {
          ...current,
          player: {
            ...current.player,
            skills: Object.fromEntries(Object.keys(current.player.skills).map((skillId) => [skillId, 99])) as typeof current.player.skills
          },
          truckSupplies: filledInventory(10) as typeof current.truckSupplies,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "job-site",
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" ||
                  task.taskId === "travel_to_supplier" ||
                  task.taskId === "checkout_supplies" ||
                  task.taskId === "travel_to_job_site" ||
                  task.taskId === "pickup_site_supplies"
                    ? { ...task, completedUnits: task.requiredUnits }
                    : task
                )
              }
            : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));

    expect(screen.getByText(/XP Earned:/i)).toBeTruthy();
    expect(useUiStore.getState().activeProgressPopup?.kind).toBe("skill-level");
    expect(screen.getByText(/Skill Leveled Up/i)).toBeTruthy();
  });

  it("EH-TW-056: level-up progression popups stay visible until manually dismissed", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(4043);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        game: {
          ...current,
          player: {
            ...current.player,
            skills: Object.fromEntries(Object.keys(current.player.skills).map((skillId) => [skillId, 99])) as typeof current.player.skills
          },
          truckSupplies: filledInventory(10) as typeof current.truckSupplies,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "job-site",
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" ||
                  task.taskId === "travel_to_supplier" ||
                  task.taskId === "checkout_supplies" ||
                  task.taskId === "travel_to_job_site" ||
                  task.taskId === "pickup_site_supplies"
                    ? { ...task, completedUnits: task.requiredUnits }
                    : task
                )
              }
            : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));

    expect(screen.getByText(/Skill Leveled Up/i)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/Skill Leveled Up/i)).toBeTruthy();
    const firstPopupId = useUiStore.getState().activeProgressPopup?.id ?? null;
    act(() => {
      useUiStore.getState().dismissProgressPopup();
    });
    expect(useUiStore.getState().activeProgressPopup?.id ?? null).not.toBe(firstPopupId);
  });

  it("EH-TW-030 and EH-TW-031: store sections switch and off-shop state disables actions", () => {
    const game = buildAcceptableGame(5050);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    const acceptedState = useUiStore.getState().game!;
    act(() => {
      useUiStore.setState({
        game: {
          ...acceptedState,
          activeJob: acceptedState.activeJob ? { ...acceptedState.activeJob, location: "job-site" } : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Office$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Shop" }));

    expect(screen.getByText(/tool bench/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    expect((screen.getAllByRole("button", { name: /^Buy$/i })[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "Stock" }));
    expect(screen.getByText(/Shop Stock/i)).toBeTruthy();
  });

  it("EH-TW-039: quick buy button appears when tools are missing", () => {
    const game = buildAcceptableGame(9090);
    delete game.player.tools.drill;
    const drillJob = bundle.jobs.find((job) => job.requiredTools.includes("drill"));
    const quickBuyContract = drillJob
      ? {
          contractId: "ui-quick-buy-contract",
          jobId: drillJob.id,
          districtId: drillJob.districtId,
          payoutMult: 1,
          expiresDay: 1
        }
      : game.contractBoard[0];
    game.contractBoard = [quickBuyContract];
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: quickBuyContract.contractId });

    render(<App />);

    expect(screen.getByText(/Quick Tool Buy/i)).toBeTruthy();
    const quickBuy = screen.getByRole("button", { name: /Quick Buy Tools/i });
    expect(quickBuy.disabled).toBe(false);
    fireEvent.click(quickBuy);
    expect(screen.getByText(/Quick bought/i)).toBeTruthy();
    expect(screen.queryByText(/Quick Tool Buy/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Accept Job/i }).disabled).toBe(false);
  });

  it("EH-TW-102: quick buy appears for Baba offers when required tools are missing", () => {
    const game = buildAcceptableGame(9091);
    game.player.cash = 2_000;
    const babaOffer = getAvailableContractOffers(game, bundle).find(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && offer.job.tags.includes("baba-g")
    );
    expect(babaOffer).toBeTruthy();
    expect((babaOffer?.job.requiredTools.length ?? 0)).toBeGreaterThan(0);
    const missingToolId = babaOffer!.job.requiredTools[0]!;
    delete game.player.tools[missingToolId];

    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: babaOffer!.contract.contractId });

    render(<App />);

    expect(screen.getByText(/Quick Tool Buy/i)).toBeTruthy();
    const quickBuy = screen.getByRole("button", { name: /Quick Buy Tools/i });
    expect(quickBuy.disabled).toBe(false);
  });

  it("EH-TW-032 and EH-TW-033: company detail modals and bottom nav preserve gameplay state", () => {
    const game = createInitialGameState(bundle, 6060);
    useUiStore.setState({
      screen: "game",
      game,
      activeTab: "office",
      officeSection: "company",
      selectedContractId: game.contractBoard[0]?.contractId ?? null
    });

    render(<App />);

    expect(screen.getByRole("button", { name: /District Access/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Crew Status/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Competitor News/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /District Access/i }));
    expect(screen.getByRole("dialog", { name: /District Access/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close District Access/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Shop" }));
    expect(screen.getByRole("button", { name: /^Office$/i, pressed: true })).toBeTruthy();
    expect(useUiStore.getState().game?.seed).toBe(6060);
  });

  it("EH-TW-047: company crew modal hires the first unlocked crew deterministically", () => {
    const game = createInitialGameState(bundle, 6061);
    game.player.companyLevel = 2;
    useUiStore.setState({
      screen: "game",
      game,
      activeTab: "office",
      officeSection: "company",
      selectedContractId: game.contractBoard[0]?.contractId ?? null
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Crew Status/i }));
    expect(screen.getByRole("dialog", { name: /Crew Status/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Hire Crew$/i }));

    expect(screen.getByRole("button", { name: /June joined the crew roster/i })).toBeTruthy();
    expect(screen.getByText(/^June$/)).toBeTruthy();
    expect(useUiStore.getState().game?.player.crews[0]?.crewId).toBe("crew-1");
  });

  it("EH-TW-090: Office includes Accounting and renders the cashflow ledger", () => {
    const game = createInitialGameState(bundle, 7060);
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "contracts" });

    render(<App />);

    expect(screen.getByRole("tab", { name: "Accounting" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Accounting" }));
    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
    expect(screen.getByText(/Session Telemetry/i)).toBeTruthy();
  });

  it("EH-TW-091: Accounting renders with empty logs and remains stable across text scales", () => {
    const game = createInitialGameState(bundle, 7061);
    game.log = [];
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "accounting" });

    render(<App />);

    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
    expect(screen.getByText(/No completed jobs yet./i)).toBeTruthy();

    act(() => {
      useUiStore.getState().setUiTextScale("xsmall");
    });
    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
    act(() => {
      useUiStore.getState().setUiTextScale("large");
    });
    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
    act(() => {
      useUiStore.getState().setUiTextScale("xlarge");
    });
    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
  });

  it("EH-TW-048: work tab shows event cues and assignee controls for hired crews", () => {
    const game = buildAcceptableGame(6062);
    game.player.companyLevel = 2;
    game.player.crews = [
      {
        crewId: "crew-1",
        name: "June",
        staminaMax: 6,
        stamina: 6,
        efficiency: 1,
        reliability: 1,
        morale: 2
      }
    ];
    game.activeEventIds = ["event-rain"];
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    fireEvent.click(screen.getByRole("button", { name: /Active Events 1/i }));
    expect(screen.getByRole("dialog", { name: /Active Events/i })).toBeTruthy();
    expect(screen.getByText(/Light Rain, Heavy Opinions/i)).toBeTruthy();
    expect(screen.getByText(/Outdoor jobs pay less and slip more/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close Active Events/i }));
    fireEvent.click(screen.getByRole("button", { name: /Toggle active job details for/i }));
    fireEvent.click(screen.getByRole("button", { name: /^June$/i }));

    expect(useUiStore.getState().game?.activeJob?.assignee).toBe("crew-1");
  });

  it("EH-TW-050: active job details collapse and reopen from the job summary row", () => {
    const game = buildAcceptableGame(6063);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    expect(screen.queryByText(/Primary actions stay pinned below for fast shift play/i)).toBeNull();
    const workCards = screen.getAllByText(/Current Task|Active Job/i).map((node) => node.textContent);
    expect(workCards[0]).toBe("Current Task");
    expect(workCards[1]).toBe("Active Job");
    expect(screen.getByRole("button", { name: /Scroll task actions left/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Scroll task actions right/i })).toBeTruthy();
    const activeJobToggle = screen.getByRole("button", { name: /Toggle active job details for/i });
    const activeJobPanel = document.getElementById("active-job-panel");
    expect(activeJobPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(activeJobPanel?.className.includes("open")).toBe(false);

    fireEvent.click(activeJobToggle);
    expect(activeJobToggle.getAttribute("aria-expanded")).toBe("true");
    expect(activeJobPanel?.getAttribute("aria-hidden")).toBe("false");
    expect(activeJobPanel?.className.includes("open")).toBe(true);
    expect(screen.getByRole("button", { name: /^Job Details$/i })).toBeTruthy();

    fireEvent.click(activeJobToggle);
    expect(activeJobToggle.getAttribute("aria-expanded")).toBe("false");
    expect(activeJobPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(activeJobPanel?.className.includes("open")).toBe(false);
  });

  it("EH-TW-051: workday HUD details stay visible in the header without a toggle", () => {
    const game = createInitialGameState(bundle, 6064);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    expect(screen.queryByRole("button", { name: /Toggle workday details for Day 1/i })).toBeNull();
    const playerHud = screen.getByRole("list", { name: /Player HUD/i });
    expect(screen.queryByRole("list", { name: /Current status/i })).toBeNull();
    expect(playerHud.textContent ?? "").toMatch(/Hours\s*8\.0\/8\.0/i);
    expect(playerHud.textContent ?? "").toMatch(/Fuel\s*8\/12/i);
    expect(playerHud.textContent ?? "").toMatch(/Fatigue\s*0/i);
    expect(playerHud.textContent ?? "").toMatch(/Cash\s*\$300/i);
    expect(playerHud.textContent ?? "").not.toMatch(/Overtime Limit/i);
    expect(playerHud.textContent ?? "").not.toMatch(/Rep/i);
    expect(screen.getAllByRole("button", { name: /^End Day$/i }).length).toBe(1);
  });

  it("EH-TW-052: supplier cart guidance appears inline in the current-task card", () => {
    const game = buildAcceptableGame(6065);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    const accepted = useUiStore.getState().game!;
    const activeJobDef = bundle.jobs.find((job) => job.id === accepted.activeJob?.jobId)!;
    const firstMaterial = activeJobDef.materialNeeds[0]!;
    const firstSupply = bundle.supplies.find((supply) => supply.id === firstMaterial.supplyId)!;

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "supplier",
                supplierCart: {
                  [firstMaterial.supplyId]: { medium: 1 }
                },
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" || task.taskId === "travel_to_supplier"
                    ? { ...task, completedUnits: task.requiredUnits || 1 }
                    : task
                )
              }
            : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));
    expect(screen.queryAllByText(/Allocate the needed items by quality before checkout/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Supplier cart total/i)).toBeTruthy();
    expect(screen.getByText(`$${firstSupply.prices.medium}`)).toBeTruthy();
  });

  it("EH-TW-053: overtime buttons appear only when the visible action needs overtime", () => {
    const game = buildAcceptableGame(6066);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          workday: {
            ...current.workday,
            availableTicks: 1,
            ticksSpent: 1,
            overtimeUsed: 0
          },
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "job-site",
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" ||
                  task.taskId === "travel_to_supplier" ||
                  task.taskId === "checkout_supplies" ||
                  task.taskId === "travel_to_job_site" ||
                  task.taskId === "pickup_site_supplies"
                    ? { ...task, completedUnits: task.requiredUnits }
                    : task
                )
              }
            : null
        }
      });
    });

    expect(screen.queryByRole("button", { name: /^Standard$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Careful$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Standard \+ OT/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^End Day$/i }).length).toBe(1);
    const visibleActionButtons = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "")
      .filter((label) => /Rush|Standard|Careful/.test(label));
    expect(visibleActionButtons.length).toBeGreaterThan(0);
    expect(visibleActionButtons.every((label) => label.includes("+ OT"))).toBe(true);
  });

  it("EH-TW-086: End Day appears when only OT actions remain even with regular time left", () => {
    const game = buildAcceptableGame(6866);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          workday: {
            ...current.workday,
            availableTicks: 2,
            ticksSpent: 1,
            overtimeUsed: 0
          },
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "job-site",
                tasks: current.activeJob.tasks.map((task) => {
                  if (
                    task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" ||
                    task.taskId === "travel_to_supplier" ||
                    task.taskId === "checkout_supplies" ||
                    task.taskId === "travel_to_job_site" ||
                    task.taskId === "pickup_site_supplies"
                  ) {
                    return { ...task, completedUnits: task.requiredUnits };
                  }
                  if (task.taskId === "do_work") {
                    return { ...task, baseTicks: 3 };
                  }
                  return task;
                })
              }
            : null
        }
      });
    });

    const playerHud = screen.getByRole("list", { name: /Player HUD/i });
    expect(playerHud.textContent ?? "").toMatch(/Hours\s*0\.5\//i);
    expect(screen.queryByRole("button", { name: /^Standard$/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /\+ OT/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^End Day$/i }).length).toBe(1);
    expect(screen.queryByRole("button", { name: /^Contract Board$/i })).toBeNull();
  });

  it("EH-TW-062: low fuel warning surfaces a gas-station run that recovers a stranded route", () => {
    const game = buildAcceptableGame(6067);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          player: {
            ...current.player,
            fuel: 0,
            cash: 0
          },
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "supplier",
                actualTicksSpent: 0,
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" || task.taskId === "travel_to_supplier" || task.taskId === "checkout_supplies"
                    ? { ...task, completedUnits: task.requiredUnits || 1 }
                    : task
                )
              }
            : null
        }
      });
    });

    expect(screen.getByText(/low fuel warning|fuel warning/i)).toBeTruthy();
    expect(screen.getByText(/truck fuel is too low/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Gas Station Run/i }));

    expect(useUiStore.getState().game?.player.fuel).toBeGreaterThan(0);
    expect(useUiStore.getState().game?.player.cash).toBeLessThan(0);
    expect(screen.getByText(/Gas Station Run added/i)).toBeTruthy();
  });

  it("EH-TW-063: Contracts tab keeps Day Laborer available while a field job is active", () => {
    const game = buildAcceptableGame(6068);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    act(() => {
      useUiStore.setState({ activeTab: "contracts", selectedContractId: DAY_LABOR_CONTRACT_ID });
    });

    const before = useUiStore.getState().game!;
    const beforeCash = before.player.cash;
    const beforeActiveJobId = before.activeJob?.contractId;

    expect(screen.getByText(/Field board is locked/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Work Day Laborer Shift/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Work Day Laborer Shift/i }));

    const after = useUiStore.getState().game!;
    expect(after.activeJob?.contractId).toBe(beforeActiveJobId);
    expect(after.player.cash).toBeGreaterThan(beforeCash);
    expect(screen.getByText(/Day Laborer paid/i)).toBeTruthy();
  });

  it("EH-TW-078: contract details show a compact outcome snapshot with risk band", () => {
    const game = buildAcceptableGame(7069);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    expect(screen.queryByText(/Outcome Snapshot/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Info$/i }));
    expect(screen.getByText(/Outcome Snapshot/i)).toBeTruthy();
    expect(screen.getByText(/Success \$\d+/i)).toBeTruthy();
    expect(screen.getByText(/Low Quality \$\d+/i)).toBeTruthy();
    expect(screen.getByText(/Fail \$0/i)).toBeTruthy();
    expect(screen.getByText(/Risk Band (Low|Medium|High)/i)).toBeTruthy();
  });

  it("EH-TW-079: day labor detail copy clarifies regular shift hours only", () => {
    const game = buildAcceptableGame(7070);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: DAY_LABOR_CONTRACT_ID });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Info$/i }));
    expect(screen.getAllByText(/regular shift hours only/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Work Day Laborer Shift/i })).toBeTruthy();
  });

  it("EH-TW-080: work tab shows short next-step guidance for supplier and site blockers", () => {
    const game = buildAcceptableGame(7071);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "shop",
                tasks: current.activeJob.tasks.map((task) => {
                  if (task.taskId === "load_from_shop") {
                    return { ...task, requiredUnits: Math.max(1, task.requiredUnits), completedUnits: Math.max(1, task.requiredUnits) };
                  }
                  if (task.taskId === "refuel_at_station") {
                    return { ...task, requiredUnits: 1, completedUnits: 0 };
                  }
                  if (task.taskId === "travel_to_supplier") {
                    return { ...task, requiredUnits: 1, completedUnits: 0 };
                  }
                  return task;
                })
              }
            : null
        }
      });
    });

    expect(screen.getByText(/Next step: Refuel at Gas Station\./i)).toBeTruthy();

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        game: {
          ...current,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "supplier",
                tasks: current.activeJob.tasks.map((task) => {
                  if (task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" || task.taskId === "travel_to_supplier") {
                    return { ...task, requiredUnits: 1, completedUnits: 1 };
                  }
                  if (task.taskId === "checkout_supplies") {
                    return { ...task, requiredUnits: 1, completedUnits: 0 };
                  }
                  return task;
                }),
                supplierCart: {}
              }
            : null
        }
      });
    });

    expect(screen.getByText(/Next step: Allocate materials in Supplier Cart\./i)).toBeTruthy();

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        game: {
          ...current,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "shop",
                tasks: current.activeJob.tasks.map((task) => {
                  if (
                    task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" ||
                    task.taskId === "travel_to_supplier" ||
                    task.taskId === "checkout_supplies" ||
                    task.taskId === "travel_to_job_site" ||
                    task.taskId === "pickup_site_supplies"
                  ) {
                    return { ...task, requiredUnits: Math.max(1, task.requiredUnits), completedUnits: Math.max(1, task.requiredUnits) };
                  }
                  if (task.taskId === "do_work") {
                    return { ...task, requiredUnits: 1, completedUnits: 0 };
                  }
                  return task;
                })
              }
            : null
        }
      });
    });

    expect(screen.getByText(/Next step: Travel to Job Site\./i)).toBeTruthy();
  });

  it("EH-TW-064: ending a fatigue-heavy shift surfaces a notice that explains the shortened next day", () => {
    const game = createInitialGameState(bundle, 6069);
    game.workday.ticksSpent = game.workday.availableTicks + 3;
    game.workday.overtimeUsed = 3;
    game.workday.fatigue.debt = 3;
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /^End Day$/i })[0]);

    expect(screen.getByText(/Fatigue is cutting this shift to 7.0 hours after heavy overtime/i)).toBeTruthy();
    const playerHud = screen.getByRole("list", { name: /Player HUD/i });
    expect(playerHud.textContent ?? "").toMatch(/Fatigue\s*2/i);
  });

  it("EH-TW-034: supplier-state jobs keep checkout controls inline without supplier popup dependency", () => {
    const game = buildAcceptableGame(7070);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    const acceptedState = useUiStore.getState().game!;
    act(() => {
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...acceptedState,
          activeJob: acceptedState.activeJob
            ? {
                ...acceptedState.activeJob,
                location: "supplier",
                tasks: acceptedState.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" ||
                  task.taskId === "refuel_at_station" || task.taskId === "travel_to_supplier"
                    ? { ...task, completedUnits: task.requiredUnits || 1 }
                    : task
                )
              }
            : null
        }
      });
    });

    expect(screen.queryByRole("button", { name: /Supplier Cart/i })).toBeNull();
    expect(screen.getAllByText(/Low/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Medium/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/High/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^Info$/i })).toBeNull();
  });

  it("EH-TW-099: fatigue HUD metric switches to danger tone when fatigue is above zero", () => {
    const game = createInitialGameState(bundle, 7072);
    game.workday.fatigue.debt = 2;
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    const fatigueMetric = screen.getByText(/^Fatigue$/i).closest(".status-metric");
    expect(fatigueMetric?.className ?? "").toContain("tone-danger");
  });

  it("EH-TW-100: work actions apply stance tone classes", () => {
    const game = buildAcceptableGame(7073);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));

    expect(screen.getByRole("button", { name: /^Rush$/i }).className).toContain("tone-warning");
    expect(screen.getByRole("button", { name: /^Standard$/i }).className).toContain("tone-info");
    expect(screen.getByRole("button", { name: /^Careful$/i }).className).toContain("tone-success");
  });

  it("EH-TW-101: contracts risk band and outcome snapshot chips map to tone classes", () => {
    const game = buildAcceptableGame(7074);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Info$/i }));

    const riskBandChip = screen.getByText(/Risk Band (Low|Medium|High)/i).closest(".chip");
    expect(riskBandChip).toBeTruthy();
    const riskBandClass = riskBandChip?.className ?? "";
    expect(riskBandClass.includes("tone-success") || riskBandClass.includes("tone-warning") || riskBandClass.includes("tone-danger")).toBe(
      true
    );

    expect(screen.getByText(/Success \$\d+/i).className).toContain("tone-success");
    expect(screen.getByText(/Low Quality \$\d+/i).className).toContain("tone-warning");
    expect(screen.getByText(/Fail \$0/i).className).toContain("tone-danger");
  });
});




