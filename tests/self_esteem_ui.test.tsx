// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App } from "../src/ui/App";
import { createInitialGameState } from "../src/core/resolver";
import { bundle, useUiStore } from "../src/ui/state";

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
}

function resetUiState() {
  useUiStore.setState({
    screen: "title",
    activeTab: "work",
    officeCategory: "operations",
    officeSection: "contracts",
    officeCategorySections: {
      operations: "contracts",
      finance: "accounting"
    },
    storeSection: "tools",
    activeModal: null,
    activeSheet: null,
    selectedContractId: null,
    game: null,
    notice: "",
    activeResultsScreen: null,
    titlePlayerName: "",
    titleCompanyName: ""
  });
}

describe("self esteem ui", () => {
  beforeEach(() => {
    cleanup();
    installLocalStorage();
    resetUiState();
  });

  it("shows Self Esteem metric in the player HUD", () => {
    const game = createInitialGameState(bundle, 8801);
    useUiStore.setState({
      screen: "game",
      activeTab: "work",
      game
    });

    render(<App />);

    const hud = screen.getByRole("list", { name: /Player HUD/i });
    expect(hud.textContent ?? "").toMatch(/Self Esteem\s*50 \(Solid\)/i);
    expect(screen.queryByText(/Grizzled/i)).toBeNull();
  });

  it("reveals Grizzled badge only after unlock", () => {
    const game = createInitialGameState(bundle, 8802);
    game.selfEsteem.currentSelfEsteem = 88;
    game.selfEsteem.hasGrizzled = true;
    game.selfEsteem.lifetimeTimesAtZero = 10;
    game.selfEsteem.lifetimeTimesAtHundred = 10;

    useUiStore.setState({
      screen: "game",
      activeTab: "work",
      game
    });

    render(<App />);

    expect(screen.getByText(/Grizzled/i)).toBeTruthy();
    const hud = screen.getByRole("list", { name: /Player HUD/i });
    expect(hud.textContent ?? "").toMatch(/Self Esteem\s*88 \(Reckless\)/i);
  });
});
