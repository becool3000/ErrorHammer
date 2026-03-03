import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { getJobHistory } from "../src/core/history";
import { createInitialGameState } from "../src/core/resolver";

const bundle = loadContentBundle();

describe("job history", () => {
  it("captures completed jobs with payout and final quality", () => {
    const state = createInitialGameState(bundle, 1701);
    state.log = [
      { day: 2, actorId: state.player.actorId, message: "Accepted Cafe Counter Shim for $163." },
      { day: 2, actorId: state.player.actorId, message: "Parts quality settled at High (+2 quality)." },
      { day: 2, actorId: state.player.actorId, message: "Collected success payment: cash +163, rep 4." },
      { day: 3, actorId: state.player.actorId, message: "Accepted Roof Vent Frame for $82." },
      { day: 3, actorId: state.player.actorId, message: "Parts quality settled at Low (-2 quality)." },
      { day: 3, actorId: state.player.actorId, message: "Job completed at low quality. Client approved half pay: cash +41, rep 0." }
    ];

    const history = getJobHistory(state);
    expect(history.length).toBe(2);
    expect(history[0]).toMatchObject({
      day: 3,
      jobName: "Roof Vent Frame",
      outcome: "neutral",
      quality: "low",
      cashEarned: 41
    });
    expect(history[1]).toMatchObject({
      day: 2,
      jobName: "Cafe Counter Shim",
      outcome: "success",
      quality: "high",
      cashEarned: 163
    });
  });

  it("includes day labor as history with n/a quality", () => {
    const state = createInitialGameState(bundle, 1702);
    state.log = [{ day: 1, actorId: state.player.actorId, message: "James worked a day-labor shift for 8.0 hours and earned $58." }];

    const history = getJobHistory(state);
    expect(history.length).toBe(1);
    expect(history[0]).toMatchObject({
      jobName: "Day Laborer",
      outcome: "success",
      quality: "n/a",
      cashEarned: 58
    });
  });

  it("handles payment lines without prior accepted line", () => {
    const state = createInitialGameState(bundle, 1703);
    state.log = [{ day: 4, actorId: state.player.actorId, message: "Collected fail payment: cash +0, rep -3." }];

    const history = getJobHistory(state);
    expect(history.length).toBe(1);
    expect(history[0]).toMatchObject({
      day: 4,
      jobName: "Unknown Job",
      outcome: "fail",
      cashEarned: 0
    });
  });
});
