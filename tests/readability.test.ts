import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/core/resolver";
import { loadContentBundle } from "../src/core/content";
import {
  formatCashByAccountingClarity,
  formatNumberByAccountingClarity,
  formatReadableText,
  obfuscateReadableText
} from "../src/ui/readability";

const bundle = loadContentBundle();

describe("readability helpers", () => {
  it("scrambles text deterministically for same seed and clarity", () => {
    const state = createInitialGameState(bundle, 9301);
    state.officeSkills.readingXp = 60;

    const text = "Allocate materials in Supplier Cart now";
    const first = obfuscateReadableText(state, text, "checkout-guidance");
    const second = obfuscateReadableText(state, text, "checkout-guidance");

    expect(first).toBe(second);
  });

  it("masks numbers by accounting clarity tier", () => {
    const state = createInitialGameState(bundle, 9302);

    state.officeSkills.accountingXp = 0;
    expect(formatCashByAccountingClarity(state, 250)).toBe("$??");

    state.officeSkills.accountingXp = 120;
    expect(formatNumberByAccountingClarity(state, 247, { currency: true })).toBe("$~250");

    state.officeSkills.accountingXp = 240;
    expect(formatNumberByAccountingClarity(state, 247, { currency: true })).toBe("$247");
  });

  it("keeps critical labels untouched when critical flag is set", () => {
    const state = createInitialGameState(bundle, 9303);
    state.officeSkills.readingXp = 10;

    const critical = "Next step: Travel to Supplier.";
    expect(formatReadableText(state, critical, { critical: true, seedKey: "critical" })).toBe(critical);
  });
});
