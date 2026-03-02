import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { getLevelForXp, getLevelProgress, getOperatorLevel } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { buildProgressPopups } from "../src/ui/state";

describe("progression helpers", () => {
  it("maps tiered XP thresholds to visible levels", () => {
    expect(getLevelForXp(0)).toBe(0);
    expect(getLevelForXp(99)).toBe(0);
    expect(getLevelForXp(100)).toBe(1);
    expect(getLevelForXp(249)).toBe(1);
    expect(getLevelForXp(250)).toBe(2);
    expect(getLevelForXp(449)).toBe(2);
    expect(getLevelForXp(450)).toBe(3);
  });

  it("reports progress within the current tier", () => {
    expect(getLevelProgress(175)).toMatchObject({
      level: 1,
      current: 75,
      needed: 150
    });
  });

  it("derives operator level from average raw XP instead of the highest skill", () => {
    const actor = createInitialGameState(loadContentBundle(), 5150).player;
    for (const skillId of Object.keys(actor.skills) as Array<keyof typeof actor.skills>) {
      actor.skills[skillId] = 0;
    }
    actor.skills.travel = 450;
    actor.skills.procurement = 450;
    actor.skills.organization = 450;
    actor.skills.negotiation = 100;

    const operator = getOperatorLevel(actor);

    expect(operator.avgXp).toBeGreaterThan(0);
    expect(operator.avgXp).toBeLessThan(100);
    expect(operator.level).toBe(0);
  });

  it("builds progression popups in XP, skill, then operator order", () => {
    const bundle = loadContentBundle();
    const previous = createInitialGameState(bundle, 5151);
    const next = createInitialGameState(bundle, 5151);

    for (const skillId of Object.keys(previous.player.skills) as Array<keyof typeof previous.player.skills>) {
      previous.player.skills[skillId] = 99;
      next.player.skills[skillId] = 99;
    }

    next.player.skills.framing = 120;
    next.player.skills.general = 110;

    const popups = buildProgressPopups(previous, next, {
      day: 1,
      taskId: "do_work",
      stance: "standard",
      timeOutcome: "standard",
      qualityOutcome: "solid",
      ticksSpent: 4,
      unitsCompleted: 1,
      qualityPointsDelta: 1,
      skillXpDelta: {
        framing: 21,
        general: 11
      },
      reworkAdded: 0,
      location: "job-site",
      logLines: ["Progress moved."],
      digest: "progress-seq"
    });

    expect(popups.map((popup) => popup.kind)).toEqual(["xp", "skill-level", "skill-level", "operator-level"]);
    expect(popups[0]?.lines).toContain("Framing +21");
    expect(popups[1]?.title).toBe("Skill Leveled Up");
    expect(popups.at(-1)?.title).toBe("Operator Leveled Up!");
  });
});
