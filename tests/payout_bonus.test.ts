import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { acceptContract, DAY_LABOR_CONTRACT_ID, getAvailableContractOffers, getContractAutoBidPreview, performTaskUnit } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { CORE_TRADE_SKILLS, mapSkillToCoreTrack } from "../src/core/tradeProgress";

const bundle = loadContentBundle();

function unlockCoreTracks(state: ReturnType<typeof createInitialGameState>): void {
  for (const track of CORE_TRADE_SKILLS) {
    state.tradeProgress.unlocked[track] = true;
  }
}

function grantAllTools(state: ReturnType<typeof createInitialGameState>): void {
  for (const tool of bundle.tools) {
    state.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
}

describe("payout boost tuning", () => {
  it("raises non-Baba quote base from skill, estimating perk, and reputation", () => {
    const low = createInitialGameState(bundle, 23001);
    const high = createInitialGameState(bundle, 23001);
    unlockCoreTracks(low);
    unlockCoreTracks(high);

    const offer = getAvailableContractOffers(low, bundle).find(
      (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g") && mapSkillToCoreTrack(entry.job.primarySkill)
    );
    expect(offer).toBeTruthy();

    high.player.reputation = 90;
    high.perks.corePerks.estimating = 8;
    high.player.skills[offer!.job.primarySkill] = 900;

    const lowPreview = getContractAutoBidPreview(low, bundle, offer!.contract.contractId);
    const highPreview = getContractAutoBidPreview(high, bundle, offer!.contract.contractId);
    expect(lowPreview?.isBaba).toBe(false);
    expect(highPreview?.isBaba).toBe(false);
    expect((highPreview?.baseQuote ?? 0)).toBeGreaterThan(lowPreview?.baseQuote ?? 0);
    expect((highPreview?.acceptedPayout ?? 0)).toBeGreaterThanOrEqual(highPreview?.baseQuote ?? 0);
  });

  it("applies deterministic time+quality payout bonus on success settlement", () => {
    let matched: { line: string } | null = null;

    for (let seed = 23100; seed < 23250 && !matched; seed += 1) {
      const state = createInitialGameState(bundle, seed);
      unlockCoreTracks(state);
      grantAllTools(state);
      const offer = getAvailableContractOffers(state, bundle).find(
        (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g")
      );
      if (!offer) {
        continue;
      }

      const accepted = acceptContract(state, bundle, offer.contract.contractId);
      if (!accepted.nextState.activeJob) {
        continue;
      }
      const activeJob = accepted.nextState.activeJob;
      accepted.nextState.activeEventIds = [];
      for (const task of activeJob.tasks) {
        if (task.taskId === "collect_payment") {
          task.completedUnits = 0;
          task.requiredUnits = Math.max(1, task.requiredUnits);
        } else {
          task.completedUnits = task.requiredUnits;
        }
      }
      activeJob.location = "job-site";
      activeJob.qualityPoints = 6;
      activeJob.partsQualityModifier = 0;
      activeJob.actualTicksSpent = Math.max(0, activeJob.plannedTicks - 4);

      const resolved = performTaskUnit(accepted.nextState, bundle, "standard", true);
      const bonusLine = resolved.payload?.logLines.find((line) => line.includes("Payout bonus:"));
      if (!bonusLine) {
        continue;
      }
      matched = {
        line: bonusLine
      };
    }

    expect(matched).toBeTruthy();
    const match = matched?.line.match(/Time ([+-][0-9]+)% \+ Quality ([+-][0-9]+)% = ([+-][0-9]+)%/);
    expect(match).toBeTruthy();
    const totalPct = Number(match?.[3] ?? "0");
    expect(totalPct).toBeGreaterThanOrEqual(-15);
    expect(totalPct).toBeLessThanOrEqual(30);
  });

  it("keeps Baba auto-bid path fixed (no bid noise)", () => {
    const state = createInitialGameState(bundle, 23300);
    const babaOffer = getAvailableContractOffers(state, bundle).find((offer) => offer.job.tags.includes("baba-g"));
    expect(babaOffer).toBeTruthy();

    const preview = getContractAutoBidPreview(state, bundle, babaOffer!.contract.contractId);
    expect(preview?.isBaba).toBe(true);
    expect(preview?.baseQuote).toBe(preview?.autoBid);
    expect(preview?.acceptedPayout).toBe(preview?.baseQuote);
    expect(preview?.bidAccuracyBandPct).toBe(0);
  });
});
