import { describe, expect, it } from "vitest";
import { generateContractBoard } from "../src/core/economy";
import { loadContentBundle } from "../src/core/content";
import { hashSeed } from "../src/core/rng";
import { TRADE_SKILLS } from "../src/core/types";
import { getResearchCategoryForSkill } from "../src/core/research";

const bundle = loadContentBundle();
const LEGACY_FIVE_JOB_SKILLS = new Set([
  "electrician",
  "plumber",
  "carpenter",
  "mason",
  "concrete_finisher",
  "roofer",
  "hvac_technician",
  "drywall_installer",
  "painter",
  "flooring_installer",
  "glazier",
  "insulation_installer",
  "framer",
  "siding_installer",
  "fence_installer",
  "cabinet_maker",
  "millworker",
  "scaffolder",
  "solar_panel_installer"
]);

describe("trade expansion catalog", () => {
  it("ships 188 jobs with expected per-skill counts", () => {
    const counts = new Map<string, number>();
    for (const skill of TRADE_SKILLS) {
      counts.set(skill, 0);
    }
    for (const job of bundle.jobs) {
      counts.set(job.primarySkill, (counts.get(job.primarySkill) ?? 0) + 1);
    }

    expect(bundle.jobs.length).toBe(188);
    for (const skill of TRADE_SKILLS) {
      const expected = LEGACY_FIVE_JOB_SKILLS.has(skill) ? 5 : 3;
      expect(counts.get(skill)).toBe(expected);
    }
  });

  it("covers all trade categories across a 2-day compact board rotation", () => {
    const day1 = generateContractBoard(bundle, 1, hashSeed(777, 1), { count: 8 });
    const day2 = generateContractBoard(bundle, 2, hashSeed(777, 2), { count: 8 });
    const byId = new Map(bundle.jobs.map((job) => [job.id, job]));
    const categories = new Set<string>();

    for (const offer of [...day1, ...day2]) {
      const job = byId.get(offer.jobId);
      if (!job) {
        continue;
      }
      categories.add(getResearchCategoryForSkill(job.primarySkill));
    }

    expect(categories.size).toBe(9);
  });
});
