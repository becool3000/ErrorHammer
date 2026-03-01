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
    companyPanel: "overview",
    activeModal: null,
    activeSheet: null,
    selectedContractId: null,
    game: null,
    lastAction: null,
    notice: ""
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

    fireEvent.click(screen.getByRole("button", { name: "New Game" }));

    expect(screen.getByRole("heading", { name: /Day 1/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Work/i, pressed: true })).toBeTruthy();
  });

  it("EH-TW-024: Continue restores a save and opens Work", () => {
    const saved = createInitialGameState(bundle, 9001);
    localStorage.setItem("error-hammer-save-v2", JSON.stringify({ ...saved, saveVersion: SAVE_VERSION }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("button", { name: /Work/i, pressed: true })).toBeTruthy();
    expect(screen.getByText(/No active job/i)).toBeTruthy();
  });

  it("EH-TW-025: empty Work state includes the contract-board CTA", () => {
    const game = createInitialGameState(bundle, 2025);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Open Contract Board/i }));
    expect(screen.getByRole("button", { name: /Contracts/i, pressed: true })).toBeTruthy();
  });

  it("EH-TW-026 and EH-TW-027: selecting and accepting a contract returns focus to Work", () => {
    const game = buildAcceptableGame(3030);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    const acceptButton = screen.getByRole("button", { name: /Accept Job/i });
    fireEvent.click(acceptButton);

    expect(screen.getByRole("button", { name: /Work/i, pressed: true })).toBeTruthy();
    expect(screen.getByText(/Current Task/i)).toBeTruthy();
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

    fireEvent.click(screen.getByRole("button", { name: /Store/i }));

    expect(screen.getByText(/tool bench/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    expect((screen.getAllByRole("button", { name: /^Buy$/i })[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "Stock" }));
    expect(screen.getByText(/Shop Stock/i)).toBeTruthy();
  });

  it("EH-TW-032 and EH-TW-033: company detail modals and bottom nav preserve gameplay state", () => {
    const game = createInitialGameState(bundle, 6060);
    useUiStore.setState({ screen: "game", game, activeTab: "company", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /District Access/i }));
    expect(screen.getByRole("dialog", { name: /District Access/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close District Access/i }));
    fireEvent.click(screen.getByRole("button", { name: /Store/i }));

    expect(screen.getByRole("button", { name: /Store/i, pressed: true })).toBeTruthy();
    expect(useUiStore.getState().game?.seed).toBe(6060);
  });

  it("EH-TW-034: supplier-state jobs expose the supplies bottom sheet", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Open Supplies/i }));
    expect(screen.getByRole("dialog", { name: /Supplier/i })).toBeTruthy();
  });
});
