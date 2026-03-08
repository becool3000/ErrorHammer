import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/core/resolver";
import { loadContentBundle } from "../src/core/content";
import {
  formatCashByAccountingClarity,
  formatNumberByAccountingClarity,
  formatReadableText,
  getReadingObfuscationMeta,
  obfuscateReadableTextByMeta,
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

  it("applies 25% reading clarity bands and clears text at 95%+", () => {
    const state = createInitialGameState(bundle, 9304);
    const phrase = "Questionable weatherproof notebook shortcuts materialize quickly.";

    state.officeSkills.readingXp = 0; // 40%
    const lowBand = getReadingObfuscationMeta(state);
    expect(lowBand.clarityPercent).toBe(40);
    expect(lowBand.bandLabel).toBe("25-49%");
    expect(lowBand.scrambleChance).toBe(0.6);
    expect(lowBand.fullyClear).toBe(false);

    state.officeSkills.readingXp = 40; // 50%
    const midBand = getReadingObfuscationMeta(state);
    expect(midBand.bandLabel).toBe("50-74%");
    expect(midBand.scrambleChance).toBe(0.4);

    state.officeSkills.readingXp = 140; // 75%
    const upperBand = getReadingObfuscationMeta(state);
    expect(upperBand.bandLabel).toBe("75-94%");
    expect(upperBand.scrambleChance).toBe(0.2);

    state.officeSkills.readingXp = 220; // 95%
    const clearBand = getReadingObfuscationMeta(state);
    expect(clearBand.bandLabel).toBe("95-100%");
    expect(clearBand.scrambleChance).toBe(0);
    expect(clearBand.fullyClear).toBe(true);
    expect(obfuscateReadableText(state, phrase, "clarity-threshold")).toBe(phrase);
  });

  it("scrambles only difficult words and preserves letter-based readability", () => {
    const text = "Basic words stay clear while obfuscated accounting turns tricky";
    const obfuscated = obfuscateReadableTextByMeta(text, "hard-words-only", {
      clarity: 0.4,
      clarityPercent: 40,
      bandLabel: "25-49%",
      scrambleChance: 1,
      fullyClear: false
    });
    const obfuscatedWords = obfuscated.split(" ");

    expect(obfuscatedWords).toHaveLength(9);
    expect(obfuscatedWords[0]).toBe("Basic");
    expect(obfuscatedWords[1]).toBe("words");
    expect(obfuscatedWords[2]).toBe("stay");
    expect(obfuscatedWords[3]).toBe("clear");
    expect(obfuscatedWords[4]).toBe("while");
    expect(obfuscatedWords[5]).not.toBe("obfuscated");
    expect(obfuscatedWords[6]).not.toBe("accounting");
    expect(obfuscated).not.toContain("_");
  });
});
