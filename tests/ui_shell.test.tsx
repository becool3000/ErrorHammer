// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import { useUiStore, bundle } from "../src/ui/state";
import { SAVE_VERSION } from "../src/core/save";
import { createInitialGameState } from "../src/core/resolver";

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
    storeSection: "fuel",
    activeModal: null,
    activeSheet: null,
    selectedContractId: null,
    game: null,
    lastAction: null,
    notice: "",
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

describe("compact shell ui", () => {
  beforeEach(() => {
    cleanup();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installLocalStorage();
    resetUi();
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

  it("EH-TW-025: empty Work state includes the contract-board CTA", () => {
    const game = createInitialGameState(bundle, 2025);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Open Contract Board/i }));
    expect(screen.getByRole("button", { name: /^Contracts$/i, pressed: true })).toBeTruthy();
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

    expect(screen.getByText(/Operator Lv 0/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Inventory$/i }));
    expect(screen.getByRole("dialog", { name: /Inventory/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close Inventory/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Skills$/i }));
    expect(screen.getByRole("dialog", { name: /Skills/i })).toBeTruthy();
    expect(screen.getByText(/Skill Ledger/i)).toBeTruthy();
    expect(screen.getAllByText(/Avg XP 29/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Travel/i)).toBeTruthy();
    expect(screen.getAllByText(/Lv 1/i).length).toBeGreaterThan(0);
  });

  it("EH-TW-055: progression popups surface in the shell after an XP-granting task", () => {
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
          truckSupplies: Object.fromEntries(bundle.supplies.map((supply) => [supply.id, 10])) as typeof current.truckSupplies,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "job-site",
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" ||
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

    expect(screen.getByText(/XP Earned/i)).toBeTruthy();
    expect(useUiStore.getState().activeProgressPopup?.kind).toBe("xp");
    act(() => {
      useUiStore.getState().dismissProgressPopup();
    });
    expect(screen.getByText(/Skill Leveled Up/i)).toBeTruthy();
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

    fireEvent.click(screen.getByRole("button", { name: /^Store$/i }));

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

  it("EH-TW-032 and EH-TW-033: company detail modals and bottom nav preserve gameplay state", () => {
    const game = createInitialGameState(bundle, 6060);
    useUiStore.setState({ screen: "game", game, activeTab: "company", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    expect(screen.getByRole("button", { name: /District Access/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Crew Status/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Competitor News/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /District Access/i }));
    expect(screen.getByRole("dialog", { name: /District Access/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close District Access/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Store$/i }));

    expect(screen.getByRole("button", { name: /^Store$/i, pressed: true })).toBeTruthy();
    expect(useUiStore.getState().game?.seed).toBe(6060);
  });

  it("EH-TW-047: company crew modal hires the first unlocked crew deterministically", () => {
    const game = createInitialGameState(bundle, 6061);
    game.player.companyLevel = 2;
    useUiStore.setState({ screen: "game", game, activeTab: "company", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Crew Status/i }));
    expect(screen.getByRole("dialog", { name: /Crew Status/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Hire Crew$/i }));

    expect(screen.getByRole("button", { name: /June joined the crew roster/i })).toBeTruthy();
    expect(screen.getByText(/^June$/)).toBeTruthy();
    expect(useUiStore.getState().game?.player.crews[0]?.crewId).toBe("crew-1");
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
    fireEvent.click(screen.getByRole("button", { name: /June \(6\/6\)/i }));

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

  it("EH-TW-051: workday HUD details collapse and reopen from the header summary", () => {
    const game = createInitialGameState(bundle, 6064);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    const headerToggle = screen.getByRole("button", { name: /Toggle workday details for Day 1/i });
    const headerPanel = document.getElementById("workday-status-panel");
    expect(headerPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(headerPanel?.className.includes("open")).toBe(false);

    fireEvent.click(headerToggle);
    expect(headerToggle.getAttribute("aria-expanded")).toBe("true");
    expect(headerPanel?.getAttribute("aria-hidden")).toBe("false");
    expect(headerPanel?.className.includes("open")).toBe(true);
    expect(screen.getByText(/Cash \$300/i)).toBeTruthy();

    fireEvent.click(headerToggle);
    expect(headerToggle.getAttribute("aria-expanded")).toBe("false");
    expect(headerPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(headerPanel?.className.includes("open")).toBe(false);
  });

  it("EH-TW-052: supplier cart guidance appears inline in the current-task card", () => {
    const game = buildAcceptableGame(6065);
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
                location: "supplier",
                supplierCart: {},
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" || task.taskId === "travel_to_supplier"
                    ? { ...task, completedUnits: task.requiredUnits || 1 }
                    : task
                )
              }
            : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));
    expect(screen.getByText(/Add the needed items to the supplier cart before checkout/i)).toBeTruthy();
    expect(screen.queryAllByText(/Add the needed items to the supplier cart before checkout/i).length).toBe(1);
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
    const visibleActionButtons = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "")
      .filter((label) => /Rush|Standard|Careful/.test(label));
    expect(visibleActionButtons.length).toBeGreaterThan(0);
    expect(visibleActionButtons.every((label) => label.includes("+ OT"))).toBe(true);
  });

  it("EH-TW-034: supplier-state jobs expose the supplier cart sheet and supply info modal", () => {
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
                  task.taskId === "travel_to_supplier"
                    ? { ...task, completedUnits: task.requiredUnits || 1 }
                    : task
                )
              }
            : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Supplier Cart/i }));
    expect(screen.getByRole("dialog", { name: /Supplier/i })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /^Info$/i })[0]);
    expect(screen.getByRole("dialog", { name: /Supply Info|Anchor Set|Board Pack/i })).toBeTruthy();
  });
});
