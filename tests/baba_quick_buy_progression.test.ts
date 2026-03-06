import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { createInitialGameState } from "../src/core/resolver";
import { getQuickBuyPlan, getStarterKitProgress, quickBuyMissingTools, STARTER_TOOL_IDS } from "../src/core/playerFlow";
import { ContractInstance, SkillId } from "../src/core/types";

const bundle = loadContentBundle();

const REQUIRED_BABA_SKILLS: SkillId[] = [
  "carpenter",
  "roofer",
  "landscaper",
  "welder",
  "electrician",
  "plumber",
  "hvac_technician",
  "drywall_installer",
  "painter",
  "flooring_installer",
  "cabinet_maker",
  "millworker"
];

function buildContractsForRequiredBabaSkills(): ContractInstance[] {
  return REQUIRED_BABA_SKILLS.map((skillId, index) => {
    const job = [...bundle.babaJobs]
      .filter((entry) => entry.primarySkill === skillId)
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))[0];

    if (!job) {
      throw new Error(`Missing Baba job for required skill '${skillId}'.`);
    }

    return {
      contractId: `test-baba-starter-${index + 1}`,
      jobId: job.id,
      districtId: job.districtId,
      payoutMult: 1,
      expiresDay: 1
    };
  });
}

describe("Baba quick buy starter progression", () => {
  it("quick-buy stays unblocked pre-storage and eventually completes the starter kit across main Baba skill types", () => {
    let state = createInitialGameState(bundle, 9701);
    state.player.cash = 10_000;
    state.player.tools = {};
    state.operations.facilities.storageOwned = false;
    state.contractBoard = buildContractsForRequiredBabaSkills();

    for (const contract of state.contractBoard) {
      const plan = getQuickBuyPlan(state, bundle, contract.contractId);
      expect(plan).toBeTruthy();
      expect(plan?.starterGateBlocked).toBe(false);
      expect(plan?.missingTools.every((line) => STARTER_TOOL_IDS.includes(line.toolId as (typeof STARTER_TOOL_IDS)[number]))).toBe(true);

      const quickBuy = quickBuyMissingTools(state, bundle, contract.contractId);
      expect(quickBuy.notice).not.toContain("Open storage before quick buying non-starter tools.");
      state = quickBuy.nextState;
    }

    const starterProgress = getStarterKitProgress(state.player);
    expect(starterProgress.allOwned).toBe(true);
    expect(starterProgress.missingToolIds).toEqual([]);
  });
});
