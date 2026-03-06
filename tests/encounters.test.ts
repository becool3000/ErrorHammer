import { describe, expect, it } from "vitest";
import { loadContentBundle } from "../src/core/content";
import { REBAR_BOB_LOG_MARKER, isRebarBobTaskEligible, rollRebarBobEncounter } from "../src/core/encounters";
import { DAY_LABOR_CONTRACT_ID, acceptContract, getAvailableContractOffers } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { TaskId } from "../src/core/types";
import { CORE_TRADE_SKILLS } from "../src/core/tradeProgress";

const bundle = loadContentBundle();

function buildAcceptedDoWorkState(seed: number) {
  const game = createInitialGameState(bundle, seed, "James", "The Company");
  for (const track of CORE_TRADE_SKILLS) {
    game.tradeProgress.unlocked[track] = true;
  }
  for (const tool of bundle.tools) {
    game.player.tools[tool.id] = { toolId: tool.id, durability: tool.maxDurability };
  }
  const offer = getAvailableContractOffers(game, bundle).find(
    (entry) => entry.contract.contractId !== DAY_LABOR_CONTRACT_ID && !entry.job.tags.includes("baba-g")
  );
  if (!offer) {
    throw new Error("Expected a non-day-labor contract.");
  }
  const accepted = acceptContract(game, bundle, offer.contract.contractId).nextState;
  if (!accepted.activeJob) {
    throw new Error("Expected active job after accept.");
  }
  accepted.activeJob.location = "job-site";
  accepted.activeJob.tasks = accepted.activeJob.tasks.map((task) => {
    if (
      task.taskId === "load_from_shop" ||
      task.taskId === "refuel_at_station" ||
      task.taskId === "travel_to_supplier" ||
      task.taskId === "checkout_supplies" ||
      task.taskId === "travel_to_job_site" ||
      task.taskId === "pickup_site_supplies"
    ) {
      return { ...task, completedUnits: task.requiredUnits };
    }
    if (task.taskId === "do_work") {
      return { ...task, completedUnits: 0 };
    }
    return task;
  });
  return accepted;
}

function findEncounterState(maxSeed = 5000) {
  for (let seed = 1; seed <= maxSeed; seed += 1) {
    const state = buildAcceptedDoWorkState(seed);
    const encounter = rollRebarBobEncounter(state, "do_work", "standard");
    if (encounter) {
      return { seed, state, encounter };
    }
  }
  throw new Error(`Could not find a deterministic encounter seed in 1..${maxSeed}.`);
}

describe("encounters", () => {
  it("returns deterministic Rebar Bob encounter outcome for identical state inputs", () => {
    const { state } = findEncounterState();
    const first = rollRebarBobEncounter(state, "do_work", "standard");
    const second = rollRebarBobEncounter(state, "do_work", "standard");
    expect(second).toEqual(first);
  });

  it("never triggers on ineligible tasks", () => {
    const { state } = findEncounterState();
    const ineligible: TaskId[] = ["refuel_at_station", "collect_payment"];
    for (const taskId of ineligible) {
      expect(isRebarBobTaskEligible(taskId)).toBe(false);
      expect(rollRebarBobEncounter(state, taskId, "standard")).toBeNull();
    }
  });

  it("suppresses additional encounters once marker exists for the current day", () => {
    const { state } = findEncounterState();
    state.log.push({
      day: state.day,
      actorId: state.player.actorId,
      contractId: state.activeJob?.contractId,
      taskId: "do_work",
      message: `${REBAR_BOB_LOG_MARKER} Rebar Bob: "Beanpole arms, keep moving."`
    });
    expect(rollRebarBobEncounter(state, "do_work", "standard")).toBeNull();
  });

  it("always includes one canonical nickname phrase in the returned line", () => {
    const { encounter } = findEncounterState();
    expect(encounter.line.toLowerCase()).toMatch(/beanpole arms|panty waist/);
  });
});
