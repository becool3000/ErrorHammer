import { describe, expect, it } from "vitest";
import { getActionDurationMs } from "../src/core/actionTiming";

describe("action timing", () => {
  it("returns base durations for non-overtime actions", () => {
    expect(getActionDurationMs("rush", false)).toBe(3_000);
    expect(getActionDurationMs("standard", false)).toBe(6_000);
    expect(getActionDurationMs("careful", false)).toBe(12_000);
  });

  it("doubles durations for overtime actions", () => {
    expect(getActionDurationMs("rush", true)).toBe(6_000);
    expect(getActionDurationMs("standard", true)).toBe(12_000);
    expect(getActionDurationMs("careful", true)).toBe(24_000);
  });
});
