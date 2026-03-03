import { describe, expect, it } from "vitest";
import { loadRawContent, loadSchemas, normalizeBundle, validateContent } from "../scripts/content_pipeline";

describe("content validation", () => {
  it("fails when a required flavor line is missing", async () => {
    const [content, schemas] = await Promise.all([loadRawContent(), loadSchemas()]);
    const jobs = (content.jobs as any[]).map((item) => ({
      ...item,
      flavor: { ...(item.flavor ?? {}) }
    }));
    delete jobs[0]?.flavor?.success_line;

    const result = validateContent({ ...content, jobs }, schemas);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("jobs"))).toBe(true);
  });

  it("normalizes content bundle top-level shape with supplies and derived runtime fields", async () => {
    const [content, schemas] = await Promise.all([loadRawContent(), loadSchemas()]);
    const result = validateContent(content, schemas);
    expect(result.ok).toBe(true);

    const normalized = normalizeBundle(result.bundle!);
    expect(Object.keys(normalized).sort()).toEqual(["babaJobs", "bots", "districts", "events", "jobs", "strings", "supplies", "tools"]);
    expect(normalized.supplies.length).toBeGreaterThanOrEqual(12);
    expect(normalized.supplies.every((supply) => supply.prices.low > 0 && supply.prices.medium > 0 && supply.prices.high > 0)).toBe(true);
    expect(normalized.jobs.every((job) => job.workUnits > 0)).toBe(true);
    expect(normalized.jobs.every((job) => job.materialNeeds.length > 0)).toBe(true);
    expect(normalized.districts.every((district) => district.travel.shopToSiteTicks > 0)).toBe(true);
  });
});
