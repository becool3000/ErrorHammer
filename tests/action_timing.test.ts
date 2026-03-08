import { describe, expect, it } from "vitest";
import { getActionDurationMs, getScaledDurationMs, getSkillSpeedMultiplier } from "../src/core/actionTiming";

describe("action timing", () => {
  it("returns base durations for non-overtime actions", () => {
    expect(getActionDurationMs("rush", false)).toBe(1_500);
    expect(getActionDurationMs("standard", false)).toBe(3_000);
    expect(getActionDurationMs("careful", false)).toBe(6_000);
  });

  it("doubles durations for overtime actions", () => {
    expect(getActionDurationMs("rush", true)).toBe(3_000);
    expect(getActionDurationMs("standard", true)).toBe(6_000);
    expect(getActionDurationMs("careful", true)).toBe(12_000);
  });

  it("scales duration by skill rank with a capped reduction", () => {
    expect(getSkillSpeedMultiplier(1)).toBe(1);
    expect(getSkillSpeedMultiplier(4)).toBe(0.85);
    expect(getSkillSpeedMultiplier(99)).toBe(0.55);
    expect(getScaledDurationMs(3_000, 4)).toBe(2_550);
    expect(getActionDurationMs("standard", true, 4)).toBe(5_100);
    expect(getActionDurationMs("standard", false, 99)).toBe(1_650);
  });
});
