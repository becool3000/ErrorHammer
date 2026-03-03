import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { formatSkillLabel, getLevelForXp, getLevelProgress, getOperatorLevel } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { buildProgressPopups } from "../src/ui/state";

describe("progression helpers", () => {
  it("EH-TW-057: tiered XP thresholds map to visible levels deterministically", () => {
    expect(getLevelForXp(0)).toBe(0);
    expect(getLevelForXp(99)).toBe(0);
    expect(getLevelForXp(100)).toBe(1);
    expect(getLevelForXp(249)).toBe(1);
    expect(getLevelForXp(250)).toBe(2);
    expect(getLevelForXp(449)).toBe(2);
    expect(getLevelForXp(450)).toBe(3);
  });

  it("EH-TW-058: level progress reports current-tier progress deterministically", () => {
    expect(getLevelProgress(175)).toMatchObject({
      level: 1,
      current: 75,
      needed: 150
    });
  });

  it("EH-TW-059: operator level derives from average raw XP instead of the highest skill", () => {
    const actor = createInitialGameState(loadContentBundle(), 5150).player;
    for (const skillId of Object.keys(actor.skills) as Array<keyof typeof actor.skills>) {
      actor.skills[skillId] = 0;
    }
    const boostedSkills = Object.keys(actor.skills).slice(0, 10) as Array<keyof typeof actor.skills>;
    for (const skillId of boostedSkills) {
      actor.skills[skillId] = 450;
    }
    actor.skills.electrician = 100;

    const operator = getOperatorLevel(actor);

    expect(operator.avgXp).toBeGreaterThan(100);
    expect(operator.avgXp).toBeLessThan(250);
    expect(operator.level).toBe(1);
  });

  it("EH-TW-060: progression popup helpers emit skill and operator level popups", () => {
    const bundle = loadContentBundle();
    const previous = createInitialGameState(bundle, 5151);
    const next = createInitialGameState(bundle, 5151);

    for (const skillId of Object.keys(previous.player.skills) as Array<keyof typeof previous.player.skills>) {
      previous.player.skills[skillId] = 99;
      next.player.skills[skillId] = 99;
    }

    next.player.skills.framer = 120;
    next.player.skills.electrician = 110;

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
        framer: 21,
        electrician: 11
      },
      reworkAdded: 0,
      location: "job-site",
      logLines: ["Progress moved."],
      digest: "progress-seq"
    });

    expect(popups.map((popup) => popup.kind)).toEqual(["skill-level", "skill-level", "operator-level"]);
    expect(popups[0]?.title).toBe("Skill Leveled Up");
    expect(popups.at(-1)?.title).toBe("Operator Leveled Up!");
  });

  it("EH-TW-061: progression labels preserve acronym-heavy skill names", () => {
    expect(formatSkillLabel("hvac_technician")).toBe("HVAC Technician");
    expect(formatSkillLabel("solar_panel_installer")).toBe("Solar Panel Installer");
    expect(formatSkillLabel("drywall_installer")).toBe("Drywall Installer");
    expect(formatSkillLabel("concrete_finisher")).toBe("Concrete Finisher");
  });
});
