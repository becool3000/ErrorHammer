// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../src/ui/App";
import { useUiStore, bundle } from "../src/ui/state";
import {
  acceptContract as acceptContractFlow,
  DAY_LABOR_CONTRACT_ID,
  getAvailableContractOffers,
  getContractEstimateSnapshot,
  getCurrentTask,
  getCurrentTaskGuidance,
  getQuickBuyPlan,
  isStarterToolId,
  performTaskUnit as performTaskUnitFlow
} from "../src/core/playerFlow";
import { REBAR_BOB_LOG_MARKER } from "../src/core/encounters";
import { SAVE_VERSION } from "../src/core/save";
import { createInitialGameState } from "../src/core/resolver";
import { TRADE_GROUPS } from "../src/core/research";
import { SupplyQuality, TRADE_SKILLS } from "../src/core/types";
import { CORE_TRADE_SKILLS, mapSkillToCoreTrack } from "../src/core/tradeProgress";

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

function installMatchMediaStub(matches: boolean) {
  const originalMatchMedia = window.matchMedia;
  const mediaQueryList = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  } as unknown as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mediaQueryList)
  });
  return () => {
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia
      });
      return;
    }
    Reflect.deleteProperty(window, "matchMedia");
  };
}

function installImmediateAnimationFrame() {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const pendingFrames = new Map<number, ReturnType<typeof setTimeout>>();
  let frameHandle = 0;
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: ((callback: FrameRequestCallback) => {
      frameHandle += 1;
      const handle = frameHandle;
      const timeoutId = setTimeout(() => {
        pendingFrames.delete(handle);
        callback(16);
      }, 0);
      pendingFrames.set(handle, timeoutId);
      return handle;
    }) as typeof window.requestAnimationFrame
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: ((handle: number) => {
      const timeoutId = pendingFrames.get(handle);
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        pendingFrames.delete(handle);
      }
    }) as typeof window.cancelAnimationFrame
  });
  return () => {
    for (const timeoutId of pendingFrames.values()) {
      clearTimeout(timeoutId);
    }
    pendingFrames.clear();
    if (originalRequestAnimationFrame) {
      Object.defineProperty(window, "requestAnimationFrame", {
        configurable: true,
        writable: true,
        value: originalRequestAnimationFrame
      });
    } else {
      Reflect.deleteProperty(window, "requestAnimationFrame");
    }
    if (originalCancelAnimationFrame) {
      Object.defineProperty(window, "cancelAnimationFrame", {
        configurable: true,
        writable: true,
        value: originalCancelAnimationFrame
      });
      return;
    }
    Reflect.deleteProperty(window, "cancelAnimationFrame");
  };
}

function resetUi() {
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
    lastAction: null,
    notice: "",
    timedTaskAction: null,
    jobCompletionFx: null,
    activeEncounterPopup: null,
    activeTaskResultPopup: null,
    activeResultsScreen: null,
    gameplayMutationLocked: false,
    uiTextScale: "default",
    uiColorMode: "neon",
    uiFxMode: "full",
    contractFilters: [],
    tutorialCompleted: false,
    tutorialInProgress: false,
    tutorialStepId: "open-contracts",
    tutorialMode: null,
    tutorialStartDay: null,
    dayLaborCelebrationActive: false,
    activeJobProfitRecap: null,
    activeProgressPopup: null,
    progressQueue: [],
    titlePlayerName: "",
    titleCompanyName: ""
  });
}

function buildAcceptableGame(seed: number) {
  const game = createInitialGameState(bundle, seed);
  for (const track of CORE_TRADE_SKILLS) {
    game.tradeProgress.unlocked[track] = true;
  }
  const coreJobs = bundle.jobs.filter((job) => mapSkillToCoreTrack(job.primarySkill));
  game.contractBoard = coreJobs.slice(0, 8).map((job, index) => ({
    contractId: `ui-core-${index + 1}`,
    jobId: job.id,
    districtId: job.districtId,
    payoutMult: 1,
    expiresDay: game.day + 1
  }));
  for (const tool of bundle.tools) {
    game.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
  return game;
}

function filledInventory(quantity: number) {
  return Object.fromEntries(bundle.supplies.map((supply) => [supply.id, { medium: quantity }])) as Record<string, Record<SupplyQuality, number>>;
}

function resolveTimedAction(buttonName: RegExp, durationMs: number) {
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
  act(() => {
    vi.advanceTimersByTime(durationMs);
  });
}

function acceptCurrentContract() {
  fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));
  const confirmLossButton = screen.queryByRole("button", { name: /Accept Anyway/i });
  if (confirmLossButton) {
    fireEvent.click(confirmLossButton);
  }
  const continueButton = screen.queryByRole("button", { name: /Continue after results/i });
  if (continueButton) {
    fireEvent.click(continueButton);
  }
}

function buildLikelyLossGame(seed: number) {
  const game = buildAcceptableGame(seed);
  const firstGroupSkills = TRADE_GROUPS[0]?.skills ?? [];
  const candidates = [
    ...bundle.jobs.filter((job) => firstGroupSkills.includes(job.primarySkill) && job.materialNeeds.length > 0 && (job.trashUnits ?? 0) > 0),
    ...bundle.jobs.filter((job) => job.materialNeeds.length > 0 && (job.trashUnits ?? 0) > 0),
    ...bundle.jobs
  ];
  const contractId = "ui-likely-loss-contract";
  let likelyLoss = false;
  for (const candidate of candidates) {
    game.contractBoard = [
      {
        contractId,
        jobId: candidate.id,
        districtId: candidate.districtId,
        payoutMult: 0,
        expiresDay: game.day
      }
    ];
    const preview = getContractEstimateSnapshot(game, bundle, contractId);
    if ((preview?.projectedNetOnSuccess ?? 0) < 0) {
      likelyLoss = true;
      break;
    }
  }
  return { game, contractId, likelyLoss };
}

function moveAcceptedJobToDoWorkState(options?: { overtimeOnly?: boolean }) {
  act(() => {
    const current = useUiStore.getState().game!;
    useUiStore.setState({
      activeTab: "work",
      game: {
        ...current,
        workday: options?.overtimeOnly
          ? {
              ...current.workday,
              availableTicks: 2,
              ticksSpent: 1,
              overtimeUsed: 0
            }
          : current.workday,
        truckSupplies: filledInventory(10) as typeof current.truckSupplies,
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
                  return {
                    ...task,
                    baseTicks: options?.overtimeOnly ? 3 : task.baseTicks,
                    completedUnits: 0
                  };
                }
                return task;
              })
            }
          : null
      }
    });
  });
}

function buildAcceptedDoWorkState(seed: number) {
  const game = buildAcceptableGame(seed);
  const offer = getAvailableContractOffers(game, bundle).find(
    (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g")
  );
  if (!offer) {
    throw new Error("Expected a non-day-labor contract.");
  }
  const accepted = acceptContractFlow(game, bundle, offer.contract.contractId).nextState;
  if (!accepted.activeJob) {
    throw new Error("Expected active job after contract acceptance.");
  }
  accepted.activeJob.location = "job-site";
  accepted.activeJob.tasks = accepted.activeJob.tasks.map((task) => {
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
      return { ...task, completedUnits: 0 };
    }
    return task;
  });
  accepted.truckSupplies = filledInventory(12) as typeof accepted.truckSupplies;
  return accepted;
}

let cachedEncounterSeed: number | null = null;
function getEncounterSeed(): number {
  if (cachedEncounterSeed !== null) {
    return cachedEncounterSeed;
  }
  for (let seed = 1; seed <= 6000; seed += 1) {
    const state = buildAcceptedDoWorkState(seed);
    const result = performTaskUnitFlow(state, bundle, "standard", false);
    if (result.payload?.encounter) {
      cachedEncounterSeed = seed;
      return seed;
    }
  }
  throw new Error("Could not find deterministic Rebar Bob encounter seed.");
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
    const newGameButton = screen.getByRole("button", { name: "New Game" }) as HTMLButtonElement;

    expect(newGameButton.disabled).toBe(true);
    fireEvent.change(nameInput, { target: { value: "Margo" } });
    expect(newGameButton.disabled).toBe(true);
    fireEvent.change(companyInput, { target: { value: "Margo Metalworks" } });
    expect(newGameButton.disabled).toBe(false);

    fireEvent.click(newGameButton);

    expect(screen.getByRole("heading", { name: /Day 1/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Work$/i, pressed: true })).toBeTruthy();
    expect(screen.getByText(/^Margo$/)).toBeTruthy();
    expect(useUiStore.getState().game?.player.companyName).toBe("Margo Metalworks");
    const playerHud = screen.getByRole("list", { name: /Player HUD/i });
    expect(playerHud.textContent ?? "").toMatch(/Fatigue\s*0/i);
  });

  it("EH-TW-063: defaults to standard text scale when no ui preference exists", () => {
    render(<App />);
    const appRoot = document.querySelector(".app-root");
    expect(appRoot?.getAttribute("data-text-scale")).toBe("default");
    expect(appRoot?.getAttribute("data-color-mode")).toBe("neon");
    expect(appRoot?.getAttribute("data-fx-mode")).toBe("full");
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

  it("EH-TW-276: selecting FX intensity updates the root fx-mode attribute", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: "Margo" } });
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: "Margo Metalworks" } });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    fireEvent.click(screen.getByRole("button", { name: /Settings/i }));

    fireEvent.click(screen.getByRole("tab", { name: "Reduced FX" }));
    expect(document.querySelector(".app-root")?.getAttribute("data-fx-mode")).toBe("reduced");

    fireEvent.click(screen.getByRole("tab", { name: "Full FX" }));
    expect(document.querySelector(".app-root")?.getAttribute("data-fx-mode")).toBe("full");
  });

  it("EH-TW-277: full FX mode updates parallax css variables when the shell scrolls", () => {
    const restoreMatchMedia = installMatchMediaStub(false);
    const restoreAnimationFrame = installImmediateAnimationFrame();
    const game = createInitialGameState(bundle, 9460);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: null, uiFxMode: "full" });

    try {
      vi.useFakeTimers();
      render(<App />);
      act(() => {
        useUiStore.getState().setUiFxMode("full");
        vi.runOnlyPendingTimers();
      });

      const appRoot = document.querySelector(".app-root") as HTMLElement | null;
      const appShell = document.querySelector(".app-shell") as HTMLElement | null;
      expect(appRoot).toBeTruthy();
      expect(appShell).toBeTruthy();

      Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 160 });
      window.dispatchEvent(new Event("scroll"));
      act(() => {
        vi.runOnlyPendingTimers();
      });

      const rootParallax = appRoot?.style.getPropertyValue("--parallax-y");
      const shellParallax = appShell?.style.getPropertyValue("--parallax-y");
      expect(rootParallax && rootParallax !== "0.00px").toBe(true);
      expect(shellParallax && shellParallax !== "0.00px").toBe(true);
    } finally {
      restoreAnimationFrame();
      restoreMatchMedia();
    }
  });

  it("EH-TW-278: reduced FX mode keeps parallax css variables at zero", () => {
    const restoreMatchMedia = installMatchMediaStub(false);
    const restoreAnimationFrame = installImmediateAnimationFrame();
    const game = createInitialGameState(bundle, 9461);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: null, uiFxMode: "reduced" });

    try {
      vi.useFakeTimers();
      render(<App />);
      act(() => {
        useUiStore.getState().setUiFxMode("reduced");
        vi.runOnlyPendingTimers();
      });

      const appRoot = document.querySelector(".app-root") as HTMLElement | null;
      const appShell = document.querySelector(".app-shell") as HTMLElement | null;
      expect(appRoot).toBeTruthy();
      expect(appShell).toBeTruthy();

      Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 220 });
      window.dispatchEvent(new Event("scroll"));
      act(() => {
        vi.runOnlyPendingTimers();
      });

      expect(appRoot?.style.getPropertyValue("--parallax-y")).toBe("0.00px");
      expect(appRoot?.style.getPropertyValue("--parallax-y-strong")).toBe("0.00px");
      expect(appShell?.style.getPropertyValue("--parallax-y")).toBe("0.00px");
      expect(appShell?.style.getPropertyValue("--parallax-y-strong")).toBe("0.00px");
    } finally {
      restoreAnimationFrame();
      restoreMatchMedia();
    }
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
    fireEvent.click(screen.getByRole("button", { name: /^Company$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Facilities" }));
    expect(screen.getByRole("button", { name: /^Company$/i, pressed: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Work$/i }));
    fireEvent.click(screen.getByRole("button", { name: /View Log/i }));
    expect(screen.getByRole("dialog", { name: /Field Log/i })).toBeTruthy();
  });

  it("EH-TW-201: Company hub shows flat section tabs for Contracts, Facilities, and Finance", () => {
    const game = createInitialGameState(bundle, 9401);
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "contracts", selectedContractId: null });

    render(<App />);

    expect(screen.queryByRole("tab", { name: "Operations" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Strategy" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Finance" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Contracts" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Facilities" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Finance" }));
    expect(screen.queryByRole("tab", { name: "Trade Index" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Accounting" })).toBeNull();
    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
  });

  it("EH-TW-202: new game contracts begin with Baba G spotlight and no unlocked trade offers", () => {
    const game = createInitialGameState(bundle, 9402);
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "contracts", selectedContractId: null });

    render(<App />);
    expect(screen.getByRole("heading", { name: /Baba G Spotlight/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Select Baba G Job/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Work Day Laborer Shift/i })).toBeNull();
    expect(screen.getByText(/No Trade Contracts Unlocked/i)).toBeTruthy();
  });

  it("EH-TW-203: Yard tab shows dumpster status and empty action", () => {
    const game = createInitialGameState(bundle, 9403);
    game.yard.dumpsterUnits = 9;
    game.player.cash = 500;
    game.operations.facilities.dumpsterEnabled = true;
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "facilities", selectedContractId: null });

    render(<App />);

    expect(screen.getByTestId("yard-dumpster-heading")).toBeTruthy();
    expect(screen.getByTestId("yard-empty-dumpster-button")).toBeTruthy();
  });

  it("EH-TW-233: facilities removes next-step/policy cards and keeps Facility Unlock actions always expanded", () => {
    const game = createInitialGameState(bundle, 9405);
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "facilities", selectedContractId: null });

    render(<App />);

    expect(screen.queryByText(/Next Step/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: /Billing and Downgrade Rules/i })).toBeNull();
    expect(screen.getByRole("heading", { name: /Facility Unlock/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Storage/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Close Office/i })).toBeTruthy();
  });

  it("EH-TW-204: accounting clarity unlocks deeper finance lines and low clarity masks numbers", () => {
    const game = createInitialGameState(bundle, 9404);
    game.officeSkills.accountingXp = 0;
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "accounting", selectedContractId: null });

    render(<App />);

    expect(screen.getAllByText(/\$\?\?/).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("accounting-line-accountant-salary")).toBeNull();
    expect(screen.getByTestId("accounting-clarity-copy")).toBeTruthy();

    act(() => {
      const current = useUiStore.getState().game;
      if (!current) {
        throw new Error("Expected game state to be available.");
      }
      useUiStore.setState({
        game: {
          ...current,
          officeSkills: {
            ...current.officeSkills,
            accountingXp: 220
          }
        }
      });
    });

    expect(screen.getByTestId("accounting-line-accountant-salary")).toBeTruthy();
  });

  it("EH-TW-043: title form retains typed names and repopulates after returning to the title screen", () => {
    render(<App />);

    const nameInput = screen.getByLabelText(/Your Name/i);
    const companyInput = screen.getByLabelText(/Company Name/i);
    const newGameButton = screen.getByRole("button", { name: "New Game" }) as HTMLButtonElement;

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

  it("EH-TW-249: title tutorial launcher offers both modes and starts fresh guided run", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Tutorial" }));
    expect(screen.getByRole("button", { name: "Fresh guided run" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use current save" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fresh guided run" }));

    expect(screen.getByRole("heading", { name: /Day 1/i })).toBeTruthy();
    expect(screen.getByRole("status", { name: /Tutorial coach/i })).toBeTruthy();
    const tutorialState = useUiStore.getState();
    expect(tutorialState.tutorialInProgress).toBe(true);
    expect(tutorialState.tutorialMode).toBe("fresh-guided");
    expect(tutorialState.tutorialStepId).toBe("open-contracts");
    expect(tutorialState.tutorialStartDay).toBe(1);
  });

  it("EH-TW-250: title tutorial current-save mode uses existing continue-missing notice path", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Use current save" }));

    expect(screen.getByText(bundle.strings.continueMissing)).toBeTruthy();
    expect(useUiStore.getState().screen).toBe("title");
  });

  it("EH-TW-251: settings tutorial section can launch current-save tutorial and activate coach", () => {
    const game = createInitialGameState(bundle, 9446);
    useUiStore.setState({ screen: "game", game, activeModal: "settings", activeTab: "work", selectedContractId: null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Tutorial" }));
    expect(screen.getByRole("button", { name: "Fresh guided run" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use current save" }));

    expect(useUiStore.getState().tutorialInProgress).toBe(true);
    expect(useUiStore.getState().tutorialMode).toBe("current-save");
    expect(screen.getByRole("status", { name: /Tutorial coach/i })).toBeTruthy();
  });

  it("EH-TW-252: tutorial progression advances through day labor then Baba G walkthrough and marks completion", () => {
    const game = createInitialGameState(bundle, 9447);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: null });

    render(<App />);

    act(() => {
      useUiStore.getState().startTutorial("current-save");
    });
    expect(useUiStore.getState().tutorialStepId).toBe("open-contracts");

    act(() => {
      useUiStore.setState({ activeTab: "office", officeSection: "contracts" });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("select-day-labor");

    act(() => {
      useUiStore.setState({ selectedContractId: DAY_LABOR_CONTRACT_ID });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("complete-day-labor");

    act(() => {
      useUiStore.setState({
        lastAction: { title: "Day Laborer", lines: ["Worked a shift."], digest: "tut-day-labor" },
        activeResultsScreen: {
          title: "Day Laborer",
          digest: "tut-day-labor",
          rows: [],
          detailLines: [],
          openedAtMs: Date.now(),
          blocksGameplay: true
        }
      });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("continue-day-labor-results");

    act(() => {
      useUiStore.setState({ activeResultsScreen: null });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("end-day");

    act(() => {
      const current = useUiStore.getState().game;
      if (!current) {
        throw new Error("Expected game state for tutorial day progression.");
      }
      useUiStore.setState({ game: { ...current, day: current.day + 1 } });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("select-baba-g");

    let babaContractId = "";
    act(() => {
      const current = useUiStore.getState().game;
      if (!current) {
        throw new Error("Expected game state for Baba G selection step.");
      }
      const babaOffer = getAvailableContractOffers(current, bundle).find(
        (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && offer.job.tags.includes("baba-g")
      );
      if (!babaOffer) {
        throw new Error("Expected a Baba G offer for tutorial progression.");
      }
      babaContractId = babaOffer.contract.contractId;
      useUiStore.setState({ activeTab: "office", officeSection: "contracts", selectedContractId: babaContractId });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("accept-baba-g");

    act(() => {
      useUiStore.setState({
        lastAction: { title: "Contract Accepted", lines: ["Accepted Baba G job."], digest: "tut-baba-accept" },
        activeResultsScreen: {
          title: "Contract Accepted",
          digest: "tut-baba-accept",
          rows: [],
          detailLines: [],
          openedAtMs: Date.now(),
          blocksGameplay: true
        }
      });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("continue-baba-accept-results");

    act(() => {
      useUiStore.setState({ activeResultsScreen: null });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("complete-baba-task");

    act(() => {
      useUiStore.setState({
        lastAction: { title: "Task Result", lines: ["Completed one Baba task."], digest: "tut-baba-task" },
        activeResultsScreen: {
          title: "Task Result",
          digest: "tut-baba-task",
          rows: [],
          detailLines: [],
          openedAtMs: Date.now(),
          blocksGameplay: true
        }
      });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("continue-baba-task-results");

    act(() => {
      useUiStore.setState({ activeResultsScreen: null });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("done");

    fireEvent.click(screen.getByRole("button", { name: "Finish Tutorial" }));
    expect(useUiStore.getState().tutorialCompleted).toBe(true);
    expect(useUiStore.getState().tutorialInProgress).toBe(false);
  });

  it("EH-TW-253: skipping tutorial preserves step and resume restores progress", () => {
    const game = createInitialGameState(bundle, 9448);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: null });

    render(<App />);

    act(() => {
      useUiStore.getState().startTutorial("current-save");
      useUiStore.setState({ activeTab: "office", officeSection: "contracts" });
      useUiStore.getState().syncTutorialProgress();
    });
    expect(useUiStore.getState().tutorialStepId).toBe("select-day-labor");

    fireEvent.click(screen.getByRole("button", { name: "Skip Tutorial" }));
    expect(useUiStore.getState().tutorialInProgress).toBe(false);
    expect(useUiStore.getState().tutorialStepId).toBe("select-day-labor");

    act(() => {
      useUiStore.getState().resumeTutorial();
    });
    expect(useUiStore.getState().tutorialInProgress).toBe(true);
    expect(useUiStore.getState().tutorialStepId).toBe("select-day-labor");
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
    expect(screen.getByRole("button", { name: /^Company$/i, pressed: true })).toBeTruthy();
  });

  it("EH-TW-026 and EH-TW-027: selecting and accepting a contract returns focus to Work", () => {
    const game = buildAcceptableGame(3030);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    acceptCurrentContract();

    expect(screen.getByRole("button", { name: /^Work$/i, pressed: true })).toBeTruthy();
    expect(screen.getByText(/Current Job:/i)).toBeTruthy();
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
    expect(screen.getByText(/Current Job:/i)).toBeTruthy();
    expect(screen.getByText(`Current Job: ${babaOffer!.job.name}`, { selector: "p.eyebrow" })).toBeTruthy();
  });

  it("EH-TW-071: Work tab no longer shows day labor action while an active job is in progress", () => {
    const game = buildAcceptableGame(3031);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

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

  it("EH-TW-232: routine field-log details use bottom sheet on phone widths", () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    try {
      const game = createInitialGameState(bundle, 9040);
      useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: /View Log/i }));

      const dialog = screen.getByRole("dialog", { name: /Field Log/i });
      expect(dialog.className).toContain("sheet-shell");
      expect(dialog.className).not.toContain("modal-shell");

      fireEvent.click(screen.getByRole("button", { name: /Close Field Log/i }));
      expect(screen.queryByRole("dialog", { name: /Field Log/i })).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: originalWidth });
    }
  });

  it("EH-TW-054: operator card shows reading/accounting first and hides locked trade skills", () => {
    const game = createInitialGameState(bundle, 4041);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Skills$/i }));
    expect(screen.getByRole("dialog", { name: /Skills/i })).toBeTruthy();
    expect(screen.getByText(/Skill Ledger/i)).toBeTruthy();
    expect(screen.getAllByText(/Total XP \d+/i).length).toBeGreaterThan(0);
    const readingSkill = screen.getByText(/^Reading$/i);
    const accountingSkill = screen.getByText(/^Accounting$/i);
    expect(Boolean(readingSkill.compareDocumentPosition(accountingSkill) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.queryByText(/^Electrician$/i)).toBeNull();
    expect(screen.queryByText(/^HVAC Technician$/i)).toBeNull();
    expect(screen.getAllByText(/^Lv 0$/i).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: /Close Skills/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Tools$/i }));
    expect(screen.getByRole("dialog", { name: /Tools & Supplies/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Tools" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Truck Tools/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Supplies" }));
    expect(screen.getByRole("tab", { name: "Supplies" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Truck Supplies" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Storage Supplies" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Close Tools & Supplies/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Materials$/i }));
    expect(screen.getByRole("dialog", { name: /Tools & Supplies/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Truck Supplies" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Storage Supplies" })).toBeTruthy();
  });

  it("EH-TW-272: each perk row exposes Explain toggle with boost details", () => {
    const game = createInitialGameState(bundle, 4043);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Perks$/i }));

    expect(screen.queryByText(/Boosts contract pricing accuracy and supply purchasing efficiency\./i)).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Explain$/i })[0]!);
    expect(screen.getByText(/Current:/i)).toBeTruthy();
    expect(screen.getByText(/Cap:/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Hide$/i }));
    expect(screen.queryByText(/Current:/i)).toBeNull();
  });

  it("EH-TW-055: XP gains are shown in Task Result while level-up popups still surface", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(4042);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

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

    resolveTimedAction(/^Standard$/i, 6_000);

    expect(screen.getByText(/XP Earned:/i)).toBeTruthy();
    expect(useUiStore.getState().activeProgressPopup?.kind).toBe("skill-level");
    expect(screen.queryByText(/Skill Leveled Up/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));
    expect(screen.getByText(/Skill Leveled Up/i)).toBeTruthy();
  });

  it("EH-TW-056: level-up progression popups stay visible until manually dismissed", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(4043);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

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

    resolveTimedAction(/^Standard$/i, 6_000);

    expect(screen.queryByText(/Skill Leveled Up/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));
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

  it("EH-TW-030 and EH-TW-031: store sections switch and truck-only mode keeps bench actions available off-shop", () => {
    const game = buildAcceptableGame(5050);
    game.operations.facilities.storageOwned = false;
    delete game.player.tools.hammer;
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    const acceptedState = useUiStore.getState().game!;
    act(() => {
      useUiStore.setState({
        game: {
          ...acceptedState,
          activeJob: acceptedState.activeJob ? { ...acceptedState.activeJob, location: "job-site" } : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Work$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Tools$/i }));
    expect(screen.getByRole("dialog", { name: /Tools & Supplies/i })).toBeTruthy();
    expect(screen.queryByText(/return to storage before using the tool bench/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Truck Tools/i }));
    expect((screen.getAllByRole("button", { name: /^Buy$/i })[0] as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: "Supplies" }));
    expect(screen.getByRole("heading", { name: "Truck Supplies" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Storage Supplies" })).toBeTruthy();
  });

  it("EH-TW-039: quick buy button appears when tools are missing", () => {
    const game = buildAcceptableGame(9090);
    const offerWithTools = getAvailableContractOffers(game, bundle).find(
      (offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g") && offer.job.requiredTools.length > 0
    );
    if (!offerWithTools) {
      throw new Error("Expected at least one tool-requiring non-day-labor offer.");
    }
    const missingToolId = offerWithTools.job.requiredTools[0]!;
    delete game.player.tools[missingToolId];
    const quickBuyContract = {
      contractId: "ui-quick-buy-contract",
      jobId: offerWithTools.job.id,
      districtId: offerWithTools.job.districtId,
      payoutMult: 1,
      expiresDay: 1
    };
    game.operations.facilities.storageOwned = true;
    game.contractBoard = [quickBuyContract];
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: quickBuyContract.contractId });

    render(<App />);

    expect(screen.getByText(/Quick Tool Buy/i)).toBeTruthy();
    const quickBuy = screen.getByRole("button", { name: /Quick Buy Tools/i }) as HTMLButtonElement;
    expect(quickBuy.disabled).toBe(false);
    fireEvent.click(quickBuy);
    expect(screen.getByText(/Quick bought/i)).toBeTruthy();
    expect(screen.queryByText(/Quick Tool Buy/i)).toBeNull();
    expect((screen.getByRole("button", { name: /Accept Job/i }) as HTMLButtonElement).disabled).toBe(false);
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
    game.operations.facilities.storageOwned = true;

    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: babaOffer!.contract.contractId });

    render(<App />);

    expect(screen.getByText(/Quick Tool Buy/i)).toBeTruthy();
    const quickBuy = screen.getByRole("button", { name: /Quick Buy Tools/i }) as HTMLButtonElement;
    expect(quickBuy.disabled).toBe(false);
  });

  it("EH-TW-242: quick buy explains storage unlock when missing non-starter tools in truck-only mode", () => {
    const game = buildAcceptableGame(9092);
    game.operations.facilities.storageOwned = false;
    const offerWithLockedQuickBuyTool = getAvailableContractOffers(game, bundle).find((offer) => {
      if (offer.contract.contractId === DAY_LABOR_CONTRACT_ID || offer.job.tags.includes("baba-g")) {
        return false;
      }
      return Boolean(offer.job.requiredTools.some((toolId) => !isStarterToolId(toolId)));
    });
    if (!offerWithLockedQuickBuyTool) {
      throw new Error("Expected at least one non-day-labor offer that requires a non-starter tool.");
    }
    const missingToolId = offerWithLockedQuickBuyTool.job.requiredTools.find((toolId) => !isStarterToolId(toolId));
    if (!missingToolId) {
      throw new Error("Expected non-starter required tool for quick-buy storage lock test.");
    }
    delete game.player.tools[missingToolId];

    const quickBuyContract = {
      contractId: "ui-quick-buy-storage-lock-contract",
      jobId: offerWithLockedQuickBuyTool.job.id,
      districtId: offerWithLockedQuickBuyTool.job.districtId,
      payoutMult: 1,
      expiresDay: 1
    };
    game.contractBoard = [quickBuyContract];
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: quickBuyContract.contractId });

    render(<App />);

    const plan = getQuickBuyPlan(game, bundle, quickBuyContract.contractId);
    expect(plan?.starterGateBlocked).toBe(true);
    const blockedToolName = plan?.missingTools.find((line) => !isStarterToolId(line.toolId))?.toolName ?? "";
    expect(blockedToolName.length).toBeGreaterThan(0);
    expect(screen.getByText(/Unlock storage first/i)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Missing ${blockedToolName}`, "i"))).toBeTruthy();
    expect(screen.getByTestId("quick-buy-storage-lock-warning")).toBeTruthy();
    const quickBuy = screen.getByRole("button", { name: /Quick Buy Tools/i }) as HTMLButtonElement;
    expect(quickBuy.disabled).toBe(true);
  });

  it("EH-TW-032 and EH-TW-033: contracts view removes company action panel while bottom nav preserves gameplay state", () => {
    const game = createInitialGameState(bundle, 6060);
    useUiStore.setState({
      screen: "game",
      game,
      activeTab: "office",
      officeSection: "contracts",
      selectedContractId: game.contractBoard[0]?.contractId ?? null
    });

    render(<App />);

    expect(screen.queryByRole("button", { name: /District Access/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Crew: Coming Soon/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Competitor News/i })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Facilities" }));
    expect(screen.getByRole("button", { name: /^Company$/i, pressed: true })).toBeTruthy();
    expect(useUiStore.getState().game?.seed).toBe(6060);
  });

  it("EH-TW-047: company crew modal shows crew freeze messaging", () => {
    const game = createInitialGameState(bundle, 6061);
    game.player.companyLevel = 2;
    useUiStore.setState({
      screen: "game",
      game,
      activeTab: "office",
      officeSection: "contracts",
      selectedContractId: game.contractBoard[0]?.contractId ?? null
    });

    render(<App />);

    act(() => {
      useUiStore.getState().openModal("crews");
    });
    expect(screen.getByRole("dialog", { name: /Crew Status/i })).toBeTruthy();
    expect(screen.getByText(/Crew: Coming Soon/i)).toBeTruthy();
    expect(screen.getByText(/Frozen/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Hire Crew$/i })).toBeNull();
  });

  it("EH-TW-090: Finance opens accounting directly with no Trade Index section tabs", () => {
    const game = createInitialGameState(bundle, 7060);
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "contracts" });

    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: "Finance" }));
    expect(screen.queryByRole("tab", { name: "Trade Index" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Accounting" })).toBeNull();
    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
    expect(screen.queryByText(/Session Telemetry/i)).toBeNull();
  });

  it("EH-TW-119: Trade Index content is removed from company finance navigation", () => {
    const game = createInitialGameState(bundle, 7062);
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "accounting" });

    render(<App />);

    expect(screen.queryByText(/Crew Rankings/i)).toBeNull();
    expect(screen.queryByText(/Your Rank #\d+ \/ \d+/i)).toBeNull();
    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
  });

  it("EH-TW-091: Accounting renders with empty logs and remains stable across text scales", () => {
    const game = createInitialGameState(bundle, 7061);
    game.log = [];
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "accounting" });

    render(<App />);

    expect(screen.getByRole("heading", { name: /Cashflow Ledger/i })).toBeTruthy();
    expect(screen.getByTestId("accounting-empty-jobs")).toBeTruthy();

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

  it("EH-TW-048: work tab hides active-events shortcut and keeps assignee controls frozen", () => {
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
    acceptCurrentContract();

    expect(screen.queryByRole("button", { name: /Active Events/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^June$/i })).toBeNull();
    expect(useUiStore.getState().game?.activeJob?.assignee).toBe("self");
  });

  it("EH-TW-050: work tab shows current job focus without the legacy active-job summary card", () => {
    const game = buildAcceptableGame(6063);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    expect(screen.queryByText(/Primary actions stay pinned below for fast shift play/i)).toBeNull();
    expect(screen.getByText(/Current Job:/i)).toBeTruthy();
    expect(screen.queryByText(/^Active Job$/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Scroll task actions left/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Scroll task actions right/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Toggle active job details for/i })).toBeNull();
  });

  it("EH-TW-051: workday HUD details stay visible in the header without a toggle", () => {
    const game = createInitialGameState(bundle, 6064);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    expect(screen.queryByRole("button", { name: /Toggle workday details for Day 1/i })).toBeNull();
    const playerHud = screen.getByRole("list", { name: /Player HUD/i });
    expect(screen.queryByRole("list", { name: /Current status/i })).toBeNull();
    expect(playerHud.textContent ?? "").toMatch(/Hours\s*8\.0\/8\.0/i);
    expect(playerHud.textContent ?? "").toMatch(/Fuel\s*8\/40/i);
    expect(playerHud.textContent ?? "").toMatch(/Fatigue\s*0/i);
    expect(playerHud.textContent ?? "").toMatch(/Cash\s*\$300/i);
    expect(playerHud.textContent ?? "").not.toMatch(/Overtime Limit/i);
    expect(playerHud.textContent ?? "").not.toMatch(/Rep/i);
    expect(screen.getAllByRole("button", { name: /^End Day$/i }).length).toBe(1);
  });

  it("EH-TW-243: work HUD keeps reading obfuscation button and toggles compact XP + clarity details", () => {
    const game = createInitialGameState(bundle, 6069);
    game.officeSkills.readingXp = 0;
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);

    const readingToggle = screen.getByRole("button", { name: /low XP/i });
    expect(readingToggle).toBeTruthy();
    expect(screen.queryByText(/XP 0 \| .*40%/i)).toBeNull();
    fireEvent.click(readingToggle);
    expect(screen.getByText(/XP 0 \| .*40%/i)).toBeTruthy();

    act(() => {
      const current = useUiStore.getState().game;
      if (!current) {
        throw new Error("Expected game state to be available.");
      }
      useUiStore.setState({
        game: {
          ...current,
          officeSkills: {
            ...current.officeSkills,
            readingXp: 220
          }
        }
      });
    });

    expect(screen.queryByRole("button", { name: /low XP/i })).toBeNull();
    expect(screen.queryByText(/XP \d+ \| .*\d+%/i)).toBeNull();
  });

  it("EH-TW-244: competitor info body text obfuscates at low reading clarity and clears at high clarity", () => {
    const game = createInitialGameState(bundle, 6070);
    game.officeSkills.readingXp = 0;
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "contracts", selectedContractId: null });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Competitor Info/i }));

    const rumorLine =
      "Doug tracks every invoice in a weatherproof notebook. Doug says the real job is fixing yesterday's shortcuts. Doug arrives with coffee, tape, and a questionable plan.";
    expect(screen.queryByText(rumorLine)).toBeNull();

    act(() => {
      const current = useUiStore.getState().game;
      if (!current) {
        throw new Error("Expected game state to be available.");
      }
      useUiStore.setState({
        game: {
          ...current,
          officeSkills: {
            ...current.officeSkills,
            readingXp: 220
          }
        }
      });
    });

    expect(screen.getByText(rumorLine)).toBeTruthy();
  });

  it("EH-TW-245: task guidance remains readable at low reading clarity", () => {
    const game = buildAcceptableGame(6071);
    const offer = getAvailableContractOffers(game, bundle).find(
      (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g") && entry.job.materialNeeds.length > 0
    );
    if (!offer) {
      throw new Error("Expected a non-day-labor contract with material needs.");
    }
    const accepted = acceptContractFlow(game, bundle, offer.contract.contractId).nextState;
    accepted.officeSkills.readingXp = 0;
    const expectedGuidance = getCurrentTaskGuidance(accepted, bundle);
    if (!expectedGuidance) {
      throw new Error("Expected task guidance for accepted active job.");
    }

    useUiStore.setState({ screen: "game", game: accepted, activeTab: "work", selectedContractId: null });

    render(<App />);

    expect(screen.getByText(expectedGuidance)).toBeTruthy();
  });

  it("EH-TW-052: supplier cart guidance appears inline in the current-task card", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(6065);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

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

    resolveTimedAction(/^Standard$/i, 6_000);
    expect(screen.getByTestId("supplier-cart-guidance")).toBeTruthy();
    expect(screen.getByText(/Supplier cart total/i)).toBeTruthy();
    expect(screen.getByText(`$${firstSupply.prices.medium}`)).toBeTruthy();
  });

  it("EH-TW-105: checkout shortfall shows a balance-declined popup notice", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(8065);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    const accepted = useUiStore.getState().game!;
    const activeJobDef = bundle.jobs.find((job) => job.id === accepted.activeJob?.jobId)!;
    const supplierCart = Object.fromEntries(
      activeJobDef.materialNeeds.map((material) => [material.supplyId, { high: material.quantity }])
    ) as Record<string, Record<SupplyQuality, number>>;

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          player: {
            ...current.player,
            cash: 0
          },
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "supplier",
                supplierCart,
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" || task.taskId === "refuel_at_station" || task.taskId === "travel_to_supplier"
                    ? { ...task, completedUnits: Math.max(1, task.requiredUnits) }
                    : task
                )
              }
            : null
        }
      });
    });

    resolveTimedAction(/^Standard$/i, 6_000);
    expect(screen.getByRole("dialog", { name: /Results Screen/i })).toBeTruthy();
    expect(screen.getByText(/need \$\d+ more for supplier checkout/i)).toBeTruthy();
  });

  it("EH-TW-240: supplier cart quantity edits do not open the Results Screen", () => {
    const game = buildAcceptableGame(8071);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    const supplyId = bundle.supplies[0]?.id;
    if (!supplyId) {
      throw new Error("Expected at least one supply in bundle.");
    }

    act(() => {
      useUiStore.getState().setCartQuantity(supplyId, "medium", 2);
    });

    const quantity = useUiStore.getState().game?.activeJob?.supplierCart[supplyId]?.medium ?? 0;
    expect(quantity).toBe(2);
    expect(useUiStore.getState().activeResultsScreen).toBeNull();
  });

  it("EH-TW-120: standard action resolves after 3s and locks controls while timer is active", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(8066);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));

    expect(screen.getByRole("progressbar", { name: /Resolving/i })).toBeTruthy();
    expect(useUiStore.getState().timedTaskAction?.durationMs).toBe(3_000);
    expect((screen.getByRole("button", { name: /^Standard$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Scroll task actions left/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Scroll task actions right/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(useUiStore.getState().lastAction?.title).toBe("Contract Accepted");
    expect(useUiStore.getState().timedTaskAction).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useUiStore.getState().timedTaskAction).toBeNull();
    expect(useUiStore.getState().lastAction?.title).toBe("Task Result");
    expect(screen.getByRole("dialog", { name: /Results Screen/i })).toBeTruthy();
    expect((screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));
    expect(screen.queryByRole("dialog", { name: /Results Screen/i })).toBeNull();
  });

  it("EH-TW-230: timed task duration scales down with higher mapped skill rank", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(8069);
    for (const skillId of TRADE_SKILLS) {
      game.player.skills[skillId] = 650;
    }
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));
    expect(useUiStore.getState().timedTaskAction?.durationMs).toBe(2_550);

    act(() => {
      vi.advanceTimersByTime(2_549);
    });
    expect(useUiStore.getState().timedTaskAction).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useUiStore.getState().timedTaskAction).toBeNull();
  });

  it("EH-TW-121: standard overtime action resolves only after 6s", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(8067);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState({ overtimeOnly: true });

    const standardOtButton = screen.getByRole("button", { name: /Standard \+ OT/i });
    fireEvent.click(standardOtButton);
    expect(useUiStore.getState().timedTaskAction?.durationMs).toBe(6_000);

    act(() => {
      vi.advanceTimersByTime(5_999);
    });
    expect(useUiStore.getState().timedTaskAction).toBeTruthy();
    expect(useUiStore.getState().lastAction?.title).toBe("Contract Accepted");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useUiStore.getState().timedTaskAction).toBeNull();
    expect(useUiStore.getState().lastAction?.title).toBe("Task Result");
  });

  it("EH-TW-122: timed actions continue across tab switches and block gameplay mutations", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(8068);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    const cashBefore = useUiStore.getState().game?.player.cash ?? 0;
    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Company$/i }));

    act(() => {
      useUiStore.getState().acceptContract(DAY_LABOR_CONTRACT_ID);
    });
    expect(useUiStore.getState().game?.player.cash).toBe(cashBefore);
    expect(useUiStore.getState().notice).toMatch(/Action locked/i);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(useUiStore.getState().timedTaskAction).toBeNull();
    expect(useUiStore.getState().lastAction?.title).toBe("Task Result");
  });

  it("EH-TW-053: overtime buttons appear only when the visible action needs overtime", () => {
    const game = buildAcceptableGame(6066);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

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
    acceptCurrentContract();
    expect(screen.queryByRole("button", { name: /Walk To Nearest Gas Station/i })).toBeNull();

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

  it("EH-TW-062: zero-fuel blocker surfaces out-of-gas rescue with OSHA can cost breakdown", () => {
    const game = buildAcceptableGame(6067);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          player: {
            ...current.player,
            fuel: 0,
            cash: 100,
            oshaCanOwned: false
          },
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "shop",
                actualTicksSpent: 0,
                tasks: current.activeJob.tasks.map((task) =>
                  task.taskId === "load_from_shop" || task.taskId === "refuel_at_station"
                    ? { ...task, completedUnits: task.requiredUnits || 1 }
                    : task.taskId === "travel_to_supplier"
                      ? { ...task, requiredUnits: 1, completedUnits: 0 }
                    : task
                )
              }
            : null
        }
      });
    });

    expect(screen.getByText(/Out Of Gas/i)).toBeTruthy();
    expect(screen.getByText(/Fuel refill 1 gal: \$5/i)).toBeTruthy();
    expect(screen.getByText(/OSHA can: \$25 \(first rescue\)/i)).toBeTruthy();
    expect(screen.getByText(/Total rescue cost \$30/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Gas Station/i }));
    expect(screen.getByText(/Need at least 1 fuel to drive to the nearest gas station/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Travel To Gas Station \(\+1 Gal\)/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Travel To Gas Station \(Fill Tank\)/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Walk To Nearest Gas Station/i }));

    expect(useUiStore.getState().game?.player.fuel).toBe(1);
    expect(useUiStore.getState().game?.player.cash).toBe(70);
    expect(useUiStore.getState().game?.player.oshaCanOwned).toBe(true);
    expect(screen.getByText(/bought OSHA can/i)).toBeTruthy();
  });

  it("EH-TW-262: Work tab shows manual travel-to-station controls with deterministic cost breakdown", () => {
    const game = buildAcceptableGame(6069);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        activeTab: "work",
        game: {
          ...current,
          player: {
            ...current.player,
            fuel: 2,
            cash: 200,
            oshaCanOwned: false
          },
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                location: "job-site"
              }
            : null
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Gas Station/i }));
    expect(screen.getByText(/Travel time/i)).toBeTruthy();
    expect(screen.getByText(/OSHA can: \$25 \(first purchase\)/i)).toBeTruthy();
    expect(screen.getByText(/\+1 gallon total \$30/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Travel To Gas Station \(\+1 Gal\)/i }));

    expect(useUiStore.getState().game?.player.fuel).toBe(3);
    expect(useUiStore.getState().game?.player.cash).toBe(170);
    expect(useUiStore.getState().game?.player.oshaCanOwned).toBe(true);
    expect(screen.getByRole("heading", { name: /Travel To Gas/i })).toBeTruthy();
  });

  it("EH-TW-263: no-active-job Work view still exposes manual gas station travel controls", () => {
    const game = buildAcceptableGame(6070);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: null });

    render(<App />);

    expect(screen.getByText(/No active job/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Gas Station/i }));
    expect(screen.getByRole("button", { name: /Travel To Gas Station \(\+1 Gal\)/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Travel To Gas Station \(Fill Tank\)/i })).toBeTruthy();
  });

  it("EH-TW-063: Contracts tab hides Day Laborer while a field job is active", () => {
    const game = buildAcceptableGame(6068);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    act(() => {
      useUiStore.setState({ activeTab: "contracts", selectedContractId: DAY_LABOR_CONTRACT_ID });
    });

    expect(screen.getByText(/Field board is locked/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Work Day Laborer Shift/i })).toBeNull();
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
    expect(screen.getByText(/Cost Preview/i)).toBeTruthy();
    expect(screen.getAllByText(/Est Net [+-]\$\d+/i).length).toBeGreaterThan(0);
  });

  it("EH-TW-224: negative-net contracts show likely-loss warning with quick-scan flags and why breakdown", () => {
    const { game, contractId, likelyLoss } = buildLikelyLossGame(7088);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: contractId });

    render(<App />);

    if (likelyLoss) {
      expect(screen.getAllByText(/Likely Loss/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Why:/i)).toBeTruthy();
      expect(screen.getByText(/Materials high|Long route|Premium haul|Projected costs exceed payout/i)).toBeTruthy();
      return;
    }
    expect(screen.queryByText(/Likely Loss/i)).toBeNull();
  });

  it("EH-TW-225: negative-net accept opens confirm modal and only accepts after explicit confirmation", () => {
    const { game } = buildLikelyLossGame(7089);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: null });

    render(<App />);
    const tradeButtons = Array.from(document.querySelectorAll(".trade-chip-grid .trade-offer-chip")) as HTMLButtonElement[];
    if (tradeButtons.length === 0) {
      expect(screen.queryByRole("button", { name: /Accept Job/i })).toBeNull();
      return;
    }
    fireEvent.click(tradeButtons[0]!);

    const selectedContractId = useUiStore.getState().selectedContractId;
    const selectedPreview = selectedContractId ? getContractEstimateSnapshot(useUiStore.getState().game!, bundle, selectedContractId) : null;
    const selectedLikelyLoss = (selectedPreview?.projectedNetOnSuccess ?? 0) < 0;

    expect(useUiStore.getState().game?.activeJob).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));
    if (!selectedLikelyLoss) {
      expect(screen.queryByRole("dialog", { name: /Likely loss warning/i })).toBeNull();
      expect(useUiStore.getState().game?.activeJob?.contractId).toBe(selectedContractId);
      return;
    }

    const dialog = screen.getByRole("dialog", { name: /Likely loss warning/i });
    expect(dialog).toBeTruthy();
    expect(useUiStore.getState().game?.activeJob).toBeNull();
    fireEvent.click(within(dialog).getAllByRole("button", { name: /^Cancel$/i })[0]!);
    expect(screen.queryByRole("dialog", { name: /Likely loss warning/i })).toBeNull();
    expect(useUiStore.getState().game?.activeJob).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Accept Job/i }));
    const dialogRetry = screen.getByRole("dialog", { name: /Likely loss warning/i });
    fireEvent.click(within(dialogRetry).getByRole("button", { name: /Accept Anyway/i }));

    expect(useUiStore.getState().game?.activeJob?.contractId).toBe(selectedContractId);
    expect(screen.getByRole("button", { name: /^Work$/i, pressed: true })).toBeTruthy();
  });

  it("EH-TW-226: contract board only shows trade groups that are unlocked", () => {
    const game = buildAcceptableGame(7090);
    for (const track of CORE_TRADE_SKILLS) {
      game.tradeProgress.unlocked[track] = false;
    }
    game.tradeProgress.unlocked.carpenter = true;
    const carpenterJob = bundle.jobs.find((job) => job.primarySkill === "carpenter");
    const electricianJob = bundle.jobs.find((job) => job.primarySkill === "electrician");
    if (!carpenterJob || !electricianJob) {
      throw new Error("Expected carpenter and electrician jobs in bundle.");
    }
    game.contractBoard = [
      { contractId: "construction-only", jobId: carpenterJob.id, districtId: carpenterJob.districtId, payoutMult: 1, expiresDay: game.day },
      { contractId: "locked-electrical", jobId: electricianJob.id, districtId: electricianJob.districtId, payoutMult: 1, expiresDay: game.day }
    ];
    useUiStore.setState({ screen: "game", game, activeTab: "office", officeSection: "contracts", selectedContractId: null });

    render(<App />);
    expect(screen.getByTestId("trade-group-construction")).toBeTruthy();
    expect(screen.queryByTestId("trade-group-electrical-utility-power")).toBeNull();
    expect(screen.queryByTestId("trade-group-profitable")).toBeNull();
  });

  it("EH-TW-227: do_work shows cut-loss recovery actions and defer/resume flow", () => {
    const game = buildAcceptableGame(7092);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();
    fireEvent.click(screen.getByRole("button", { name: /Cut Losses/i }));

    expect(screen.getByRole("button", { name: /Finish Cheap/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Defer$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Abandon$/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Defer$/i }));
    expect(screen.getByRole("dialog", { name: /Defer Job confirmation/i })).toBeTruthy();
    expect(screen.getByText(/\$20/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));

    expect(screen.getByText(/No active job/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Resume$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));

    expect(screen.getByText(/Current Job:/i)).toBeTruthy();
  });

  it("EH-TW-228: non-day-labor completion keeps completion popup until closed", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(7093);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        game: {
          ...current,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                tasks: current.activeJob.tasks.map((task) => {
                  if (task.taskId === "do_work") {
                    return { ...task, requiredUnits: 1, completedUnits: 1 };
                  }
                  if (task.taskId === "collect_payment") {
                    return { ...task, requiredUnits: 1, completedUnits: 0 };
                  }
                  return task;
                })
              }
            : null
        }
      });
    });

    resolveTimedAction(/^Standard$/i, 6_000);

    expect(screen.getByRole("dialog", { name: /Results Screen/i })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole("dialog", { name: /Results Screen/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));
    expect(screen.queryByRole("dialog", { name: /Results Screen/i })).toBeNull();
  });

  it("EH-TW-223: Work tab shows running spend summary for active jobs", () => {
    const game = buildAcceptableGame(7079);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    fireEvent.click(screen.getByRole("button", { name: /Budget/i }));
    expect(screen.getByText(/Spent so far \$\d+/i)).toBeTruthy();
    expect(screen.getByText(/Est remaining \$\d+/i)).toBeTruthy();
    expect(screen.getAllByText(/Net on success [+-]\$\d+/i).length).toBeGreaterThan(0);
  });

  it("EH-TW-079: day labor detail copy clarifies regular shift hours only", () => {
    const game = buildAcceptableGame(7070);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: DAY_LABOR_CONTRACT_ID });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Info$/i }));
    expect(screen.getAllByText(/regular shift hours only/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Work Day Laborer Shift/i })).toBeTruthy();
  });

  it("EH-TW-117: day labor completion triggers 5s FX cooldown before next day labor shift", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(7072);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: DAY_LABOR_CONTRACT_ID });

    render(<App />);

    const beforeCash = useUiStore.getState().game?.player.cash ?? 0;
    fireEvent.click(screen.getByRole("button", { name: /Work Day Laborer Shift/i }));
    expect(screen.getByRole("dialog", { name: /Day Labor Digging Mini-Game/i })).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: /Day Labor shift prep/i })).toBeNull();

    act(() => {
      useUiStore.getState().submitDayLaborMinigameResult({
        success: true,
        score: 88,
        excavationAccuracy: 0.93,
        backfillAccuracy: 0.89,
        timeUsedMs: 61_000
      });
    });

    const cashAfterFirstShift = useUiStore.getState().game?.player.cash ?? 0;
    expect(cashAfterFirstShift).toBeGreaterThan(beforeCash);
    expect(useUiStore.getState().dayLaborCelebrationActive).toBe(true);
    expect(screen.getByText(/DAY LABOR PAYDAY/i)).toBeTruthy();
    const endDayFallbackButtonDuringFx = screen
      .getAllByRole("button", { name: /^End Day$/i })
      .find((entry) => entry.className.includes("day-labor-end-day-button"));
    expect(endDayFallbackButtonDuringFx?.className).toContain("day-labor-end-day-button");
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));

    act(() => {
      useUiStore.getState().acceptContract(DAY_LABOR_CONTRACT_ID);
    });

    expect(useUiStore.getState().game?.player.cash).toBe(cashAfterFirstShift);
    expect(useUiStore.getState().notice).toMatch(/Celebration cooldown active/i);
    expect(screen.queryByRole("dialog", { name: /Day Labor Digging Mini-Game/i })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(useUiStore.getState().dayLaborCelebrationActive).toBe(false);
    const endDayFallbackButtonAfterFx = screen
      .getAllByRole("button", { name: /^End Day$/i })
      .find((entry) => entry.className.includes("day-labor-end-day-button"));
    expect(endDayFallbackButtonAfterFx?.className).toContain("day-labor-end-day-button");
  });
  it("EH-TW-231: day labor prep timer scales with carpenter skill rank", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(7095);
    game.player.skills.carpenter = 650;
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: DAY_LABOR_CONTRACT_ID });

    render(<App />);

    const beforeCash = useUiStore.getState().game?.player.cash ?? 0;
    fireEvent.click(screen.getByRole("button", { name: /Work Day Laborer Shift/i }));
    expect(screen.getByRole("dialog", { name: /Day Labor Digging Mini-Game/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Go to Work/i })).toBeNull();
    expect(screen.queryByRole("progressbar", { name: /Day Labor shift prep/i })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(useUiStore.getState().game?.player.cash).toBe(beforeCash);

    act(() => {
      useUiStore.getState().submitDayLaborMinigameResult({
        success: false,
        score: 11,
        excavationAccuracy: 0.38,
        backfillAccuracy: 0.21,
        timeUsedMs: 90_000,
        failureReason: "Time expired before target fill was reached."
      });
    });
    expect(useUiStore.getState().game?.player.cash).toBe(beforeCash);
    expect(useUiStore.getState().dayLaborCelebrationActive).toBe(false);
    expect(screen.getByText(/shift failed/i)).toBeTruthy();
  });
  it("EH-TW-229: fallback shift switches to End Day button when no regular shift hours remain", () => {
    const game = buildAcceptableGame(7094);
    game.workday.ticksSpent = game.workday.availableTicks;
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: DAY_LABOR_CONTRACT_ID });

    render(<App />);

    const button = screen
      .getAllByRole("button", { name: /^End Day$/i })
      .find((entry) => entry.className.includes("day-labor-end-day-button")) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();
    const endDayButton = button as HTMLButtonElement;
    expect(endDayButton.className).toContain("day-labor-end-day-button");
    const beforeDay = useUiStore.getState().game?.day ?? 1;
    fireEvent.click(endDayButton);
    expect(useUiStore.getState().game?.day).toBe(beforeDay + 1);
  });

  it("EH-TW-080: work tab shows short next-step guidance for supplier and site blockers", () => {
    const game = buildAcceptableGame(7071);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

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
                    return { ...task, requiredUnits: 0, completedUnits: 0 };
                  }
                  if (task.taskId === "travel_to_supplier") {
                    return { ...task, requiredUnits: 1, completedUnits: 0 };
                  }
                  return task;
                })
              }
            : null,
          player: {
            ...current.player,
            fuel: 0
          }
        }
      });
    });

    expect(getCurrentTaskGuidance(useUiStore.getState().game!, bundle)).toMatch(/Walk to the nearest gas station for rescue fuel/i);
    expect(screen.getByTestId("work-task-guidance")).toBeTruthy();

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

    expect(getCurrentTaskGuidance(useUiStore.getState().game!, bundle)).toMatch(/Allocate materials in Supplier Cart\./i);

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

    expect(getCurrentTaskGuidance(useUiStore.getState().game!, bundle)).toMatch(/Travel to Job Site\./i);
  });

  it("EH-TW-118: broken tools during Do The Job expose return-to-shop action and reroute task flow", () => {
    const game = buildAcceptableGame(7073);
    const accepted = acceptContractFlow(game, bundle, game.contractBoard[0]?.contractId ?? "");
    const activeJob = accepted.nextState.activeJob;
    const job = bundle.jobs.find((entry) => entry.id === activeJob?.jobId) ?? bundle.babaJobs.find((entry) => entry.id === activeJob?.jobId);
    if (!activeJob || !job) {
      throw new Error("Expected accepted active job for tool-break reroute test.");
    }

    const order = [
      "load_from_shop",
      "refuel_at_station",
      "travel_to_supplier",
      "checkout_supplies",
      "travel_to_job_site",
      "pickup_site_supplies",
      "do_work",
      "collect_payment",
      "return_to_shop",
      "store_leftovers"
    ];
    for (const task of activeJob.tasks) {
      const index = order.indexOf(task.taskId);
      const doWorkIndex = order.indexOf("do_work");
      if (index >= 0 && index < doWorkIndex) {
        task.completedUnits = task.requiredUnits;
      } else if (task.taskId === "do_work") {
        task.requiredUnits = Math.max(2, task.requiredUnits);
        task.completedUnits = 1;
      }
    }
    activeJob.location = "job-site";
    const requiredToolId = job.requiredTools[0]!;
    accepted.nextState.player.tools[requiredToolId] = { toolId: requiredToolId, durability: 0 };

    useUiStore.setState({
      screen: "game",
      game: accepted.nextState,
      activeTab: "work",
      selectedContractId: null
    });

    render(<App />);

    const rerouteButton = screen.getByRole("button", { name: /Return To Storage For Tools/i });
    fireEvent.click(rerouteButton);

    const rerouted = useUiStore.getState().game!;
    expect(rerouted.activeJob?.location).toBe("shop");
    expect(getCurrentTask(rerouted)?.taskId).toBe("travel_to_job_site");
  });

  it("EH-TW-123: End Day transition rolls the day at 500ms and clears at 1000ms", () => {
    vi.useFakeTimers();
    const game = createInitialGameState(bundle, 6069);
    game.workday.ticksSpent = game.workday.availableTicks + 3;
    game.workday.overtimeUsed = 3;
    game.workday.fatigue.debt = 3;
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    const startingDay = useUiStore.getState().game?.day ?? 0;
    fireEvent.click(screen.getAllByRole("button", { name: /^End Day$/i })[0]);

    expect(screen.getByText(/Ending Day\.\.\./i)).toBeTruthy();
    expect((screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(useUiStore.getState().game?.day).toBe(startingDay);
    expect(screen.queryByText(/Fatigue is cutting this shift/i)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useUiStore.getState().game?.day).toBe(startingDay + 1);
    expect(screen.queryByText(/Fatigue is cutting this shift to 7.0 hours after heavy overtime/i)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText(/Ending Day\.\.\./i)).toBeNull();
    expect(screen.getByText(/Fatigue is cutting this shift to 7.0 hours after heavy overtime/i)).toBeTruthy();
  });

  it("EH-TW-124: End Day stays disabled while transition is active and allows only one rollover", () => {
    vi.useFakeTimers();
    const game = createInitialGameState(bundle, 6070);
    useUiStore.setState({ screen: "game", game, activeTab: "work", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    const startingDay = useUiStore.getState().game?.day ?? 0;
    const endDayButton = screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement;
    fireEvent.click(endDayButton);
    expect(endDayButton.disabled).toBe(true);

    fireEvent.click(endDayButton);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(useUiStore.getState().game?.day).toBe(startingDay + 1);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect((screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));
    expect((screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it("EH-TW-125: timed task locks prevent End Day transition start until action resolves", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(8071);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();
    const preActionState = useUiStore.getState().game;
    if (!preActionState) {
      throw new Error("Expected game state before timed action.");
    }
    act(() => {
      useUiStore.setState({
        game: {
          ...preActionState,
          log: [
            ...preActionState.log,
            {
              day: preActionState.day,
              actorId: preActionState.player.actorId,
              contractId: preActionState.activeJob?.contractId,
              taskId: "do_work",
              message: `${REBAR_BOB_LOG_MARKER} Rebar Bob: "Already heckled today."`
            }
          ]
        }
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^Standard$/i }));
    const endDayButton = screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement;
    expect(endDayButton.disabled).toBe(true);
    fireEvent.click(endDayButton);
    expect(screen.queryByText(/Ending Day\.\.\./i)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect((screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Continue after results/i }));
    expect((screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getAllByRole("button", { name: /^End Day$/i })[0]);
    expect(screen.getByText(/Ending Day\.\.\./i)).toBeTruthy();
  });

  it("EH-TW-034: supplier-state jobs keep checkout controls inline without supplier popup dependency", () => {
    const game = buildAcceptableGame(7070);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

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
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();
    const warningAction = screen.getByRole("button", { name: /^Rush(?: \+ OT)?$/i });
    const infoAction = screen.getByRole("button", { name: /^Standard(?: \+ OT)?$/i });
    const successAction = screen.getByRole("button", { name: /^Careful(?: \+ OT)?$/i });

    expect(warningAction.className).toContain("tone-warning");
    expect(infoAction.className).toContain("tone-info");
    expect(successAction.className).toContain("tone-success");
  });

  it("EH-TW-234: work action carousel keeps one dominant CTA in do_work state", () => {
    const game = buildAcceptableGame(7075);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    const actionButtons = screen.getAllByRole("button", { name: /^(Rush|Standard|Careful)$/i });
    const primaryButtons = actionButtons.filter((button) => button.className.includes("primary-button"));
    expect(primaryButtons.length).toBe(1);
    expect(primaryButtons[0]?.textContent ?? "").toMatch(/Standard/i);
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

  it("EH-TW-126: Rebar Bob encounter popup stays until manually closed and does not lock End Day", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(getEncounterSeed());
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    resolveTimedAction(/^Standard$/i, 6_000);

    expect(screen.getByRole("dialog", { name: /Results Screen/i })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: /Rebar Bob Encounter/i })).toBeTruthy();
    expect(document.querySelector(".rebar-bob-encounter-sprite")).toBeTruthy();
    expect(screen.getAllByText(/beanpole arms|panty waist/i).length).toBeGreaterThan(0);
    const endDayButton = screen.getAllByRole("button", { name: /^End Day$/i })[0] as HTMLButtonElement;
    expect(endDayButton.disabled).toBe(false);

    fireEvent.click(endDayButton);
    expect(screen.getByText(/Ending Day\.\.\./i)).toBeTruthy();
    expect(screen.getByRole("dialog", { name: /Rebar Bob Encounter/i })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    fireEvent.click(screen.getByRole("button", { name: /Dismiss Rebar Bob encounter/i }));
    expect(screen.queryByRole("dialog", { name: /Rebar Bob Encounter/i })).toBeNull();
  });

  it("EH-TW-127: results detail lines include Rebar Bob encounter copy when triggered", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(getEncounterSeed());
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    resolveTimedAction(/^Standard$/i, 6_000);
    const details = useUiStore.getState().activeResultsScreen?.detailLines ?? [];
    expect(details.some((line) => /Rebar Bob:/i.test(line))).toBe(true);
  });

  it("EH-TW-128: Current Task uses hours done vs estimated format", () => {
    const game = buildAcceptableGame(7101);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();

    expect(screen.getAllByText(/Est hours:\s*\d+/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^0\/1$/i)).toBeNull();
  });

  it("EH-TW-129: Task Result includes task and job estimated vs actual hours on payment", () => {
    vi.useFakeTimers();
    const game = buildAcceptableGame(7102);
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: game.contractBoard[0]?.contractId ?? null });

    render(<App />);
    acceptCurrentContract();
    moveAcceptedJobToDoWorkState();

    act(() => {
      const current = useUiStore.getState().game!;
      useUiStore.setState({
        game: {
          ...current,
          activeJob: current.activeJob
            ? {
                ...current.activeJob,
                tasks: current.activeJob.tasks.map((task) => {
                  if (task.taskId === "do_work") {
                    return { ...task, requiredUnits: 1, completedUnits: 1 };
                  }
                  if (task.taskId === "collect_payment") {
                    return { ...task, requiredUnits: 1, completedUnits: 0 };
                  }
                  return task;
                })
              }
            : null
        }
      });
    });

    resolveTimedAction(/^Standard$/i, 6_000);

    const detailLines = useUiStore.getState().activeResultsScreen?.detailLines ?? [];
    expect(detailLines.some((line) => /Task Hours: Est \d+\.\dh \| Actual \d+\.\dh/i.test(line))).toBe(true);
    expect(detailLines.some((line) => /Job Hours: Est \d+\.\dh \| Actual \d+\.\dh/i.test(line))).toBe(true);
    expect(detailLines.some((line) => /Variance:\s*[+-]?\d+\.\dh/i.test(line))).toBe(true);
  });

  it("EH-TW-130: non-Baba contracts show auto-bid line while Baba stays fixed", () => {
    const game = buildAcceptableGame(7103);
    const offers = getAvailableContractOffers(game, bundle);
    const nonBaba = offers.find((offer) => offer.contract.contractId !== DAY_LABOR_CONTRACT_ID && !offer.job.tags.includes("baba-g"));
    const baba = offers.find((offer) => offer.job.tags.includes("baba-g"));
    if (!nonBaba || !baba) {
      throw new Error("Expected both non-Baba and Baba offers.");
    }
    useUiStore.setState({ screen: "game", game, activeTab: "contracts", selectedContractId: nonBaba.contract.contractId });

    render(<App />);
    expect(screen.getByText(/Auto-Bid \$\d+ \(Estimating Lv \d+,/i)).toBeTruthy();

    act(() => {
      useUiStore.setState({ selectedContractId: baba.contract.contractId });
    });
    expect(screen.queryByText(/Auto-Bid \$\d+ \(Estimating Lv \d+,/i)).toBeNull();
  });

  it("EH-TW-131: Accounting shows Contract Files after a contract closes", () => {
    const game = buildAcceptableGame(7104);
    const offer = game.contractBoard.find((entry) => entry.contractId !== DAY_LABOR_CONTRACT_ID);
    if (!offer) {
      throw new Error("Expected a non-day-labor contract.");
    }
    const acceptedState = acceptContractFlow(game, bundle, offer.contractId).nextState;
    if (!acceptedState.activeJob) {
      throw new Error("Expected active job after accept.");
    }
    acceptedState.activeJob.tasks = acceptedState.activeJob.tasks.map((task) => {
      if (task.taskId === "do_work") {
        return { ...task, requiredUnits: 1, completedUnits: 1 };
      }
      if (task.taskId === "collect_payment") {
        return { ...task, requiredUnits: 1, completedUnits: 0 };
      }
      if (task.taskId === "store_leftovers") {
        return { ...task, requiredUnits: 1, completedUnits: 1 };
      }
      return { ...task, completedUnits: task.requiredUnits };
    });
    let settled = acceptedState;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      settled = performTaskUnitFlow(settled, bundle, "careful", true).nextState;
      const status = settled.contractFiles.find((entry) => entry.contractId === offer.contractId)?.status;
      if (status === "completed") {
        break;
      }
    }

    useUiStore.setState({
      screen: "game",
      game: settled,
      activeTab: "office",
      officeSection: "accounting"
    });

    render(<App />);

    expect(screen.getByText(/Contract Files/i)).toBeTruthy();
    expect(screen.getByTestId(`contract-file-status-${offer.contractId}`)).toBeTruthy();
    expect(screen.getByText(/Hours Est \d+\.\dh/i)).toBeTruthy();
    expect(screen.getByText(/Net Est/i)).toBeTruthy();
    expect(screen.getByText(/Net Actual/i)).toBeTruthy();
  });
});
