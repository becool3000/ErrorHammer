// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { App } from "../src/ui/App";
import { createInitialGameState } from "../src/core/resolver";
import { bundle, useUiStore } from "../src/ui/state";
import { releaseInfo } from "../src/ui/releaseInfo";

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

describe("release metadata ui", () => {
  beforeEach(() => {
    cleanup();
    installLocalStorage();
    useUiStore.setState({
      screen: "title",
      game: null,
      activeModal: null,
      activeSheet: null,
      activeTab: "work",
      officeCategory: "operations",
      officeSection: "contracts",
      officeCategorySections: {
        operations: "contracts",
        finance: "accounting"
      },
      storeSection: "tools",
      selectedContractId: null,
      notice: "",
      activeResultsScreen: null,
      titlePlayerName: "",
      titleCompanyName: ""
    });
  });

  it("shows version and build metadata on the title screen", () => {
    render(<App />);

    expect(screen.getByText(`Version ${releaseInfo.appVersion}`)).toBeTruthy();
    expect(screen.getByText(`Build ${releaseInfo.buildId}`)).toBeTruthy();
    expect(screen.getByText(`Release ${releaseInfo.releaseLabel}`)).toBeTruthy();
  });

  it("shows build info in settings modal", () => {
    const game = createInitialGameState(bundle, 1234);
    useUiStore.setState({
      screen: "game",
      game,
      activeModal: "settings",
      activeTab: "work"
    });

    render(<App />);

    expect(screen.getByText("Build Info")).toBeTruthy();
    expect(screen.getByText(`Version ${releaseInfo.appVersion}`)).toBeTruthy();
    expect(screen.getByText(`Build ${releaseInfo.buildId}`)).toBeTruthy();
    expect(screen.getByText(`Release ${releaseInfo.releaseLabel}`)).toBeTruthy();
    expect(screen.getByText(`Commit ${releaseInfo.gitCommit}`)).toBeTruthy();
  });
});

