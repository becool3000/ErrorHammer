import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/core/resolver";
import { buildResultsScreenState, bundle } from "../src/ui/state";

describe("results screen state builder", () => {
  it("returns null when no gameplay state changed", () => {
    const state = createInitialGameState(bundle, 9901);
    const result = buildResultsScreenState(state, state, "No Change", "digest-none", ["No-op"]);
    expect(result).toBeNull();
  });

  it("builds deterministic money and stats rows with tone mapping", () => {
    const previous = createInitialGameState(bundle, 9902);
    const next = structuredClone(previous);
    next.player.cash += 125;
    next.player.fuel -= 1;
    next.player.reputation += 3;
    next.workday.fatigue.debt += 2;

    const result = buildResultsScreenState(previous, next, "Task Result", "digest-money", ["Cash changed"]);
    expect(result).toBeTruthy();

    const rows = result!.rows;
    expect(rows.find((row) => row.label === "Cash")?.tone).toBe("positive");
    expect(rows.find((row) => row.label === "Cash")?.delta).toBe("+$125");
    expect(rows.find((row) => row.label === "Fuel")?.tone).toBe("negative");
    expect(rows.find((row) => row.label === "Reputation")?.tone).toBe("positive");
    expect(rows.find((row) => row.label === "Fatigue Debt")?.tone).toBe("warning");

    const uniqueSections = [...new Set(rows.map((row) => row.section))];
    expect(uniqueSections[0]).toBe("Money");
    expect(uniqueSections[1]).toBe("Stats");
  });

  it("includes inventory and operations rows and de-duplicates detail lines", () => {
    const previous = createInitialGameState(bundle, 9903);
    const next = structuredClone(previous);
    next.operations.facilities.storageOwned = true;
    next.operations.facilities.officeOwned = true;
    next.player.tools.hammer = { toolId: "hammer", durability: 25 };
    next.player.cash -= 40;
    next.officeSkills.readingXp += 2;
    next.officeSkills.accountingXp += 3;

    const result = buildResultsScreenState(previous, next, "Office Upgrade", "digest-ops", [
      "Opened storage.",
      "Opened storage.",
      "Office unlocked."
    ]);
    expect(result).toBeTruthy();

    const rows = result!.rows;
    expect(rows.some((row) => row.label === "Storage" && row.after === "Yes")).toBe(true);
    expect(rows.some((row) => row.label === "Office" && row.after === "Yes")).toBe(true);
    expect(rows.some((row) => row.label.includes("Hammer Durability"))).toBe(true);
    expect(rows.some((row) => row.label === "Reading XP" && row.before === "0" && row.after === "2")).toBe(true);
    expect(rows.some((row) => row.label === "Accounting XP" && row.before === "0" && row.after === "3")).toBe(true);
    expect(result!.detailLines).toEqual(["Opened storage.", "Office unlocked."]);
  });
});
