import { createRng, hashSeed } from "./rng";
import { EncounterPayload, GameState, TaskId, TaskStance } from "./types";

const REBAR_BOB_CHANCE_PCT = 14;

export const REBAR_BOB_LOG_MARKER = "[rebar-bob]";

const REBAR_BOB_LINES = [
  "Move it, beanpole arms. That steel is waiting on your calendar.",
  "Panty waist pace today? Even rebar cures faster than that.",
  "Beanpole arms, if that layout drifts any more we'll call it abstract art.",
  "Panty waist planning again. Check the tape and hit it square.",
  "Beanpole arms, I've seen straighter lines on a windy scaffold.",
  "Panty waist hustle. The pour won't wait for a committee meeting.",
  "Beanpole arms, stop flirting with the rework pile and finish the pass.",
  "Panty waist confidence is not a measurement. Grab the level.",
  "Beanpole arms, this is field work, not a coffee break podcast.",
  "Panty waist timing. Keep it moving before daylight bills us overtime."
] as const;

export function isRebarBobTaskEligible(taskId: TaskId): boolean {
  return (
    taskId === "load_from_shop" ||
    taskId === "travel_to_supplier" ||
    taskId === "checkout_supplies" ||
    taskId === "travel_to_job_site" ||
    taskId === "pickup_site_supplies" ||
    taskId === "do_work" ||
    taskId === "return_to_shop" ||
    taskId === "store_leftovers"
  );
}

export function formatEncounterMarker(encounter: EncounterPayload): string {
  return `${REBAR_BOB_LOG_MARKER} ${encounter.speaker}: "${encounter.line}"`;
}

export function rollRebarBobEncounter(state: GameState, taskId: TaskId, stance: TaskStance): EncounterPayload | null {
  const activeJob = state.activeJob;
  if (!activeJob || !isRebarBobTaskEligible(taskId) || hasRebarBobEncounterToday(state)) {
    return null;
  }

  const task = activeJob.tasks.find((entry) => entry.taskId === taskId);
  const completedUnits = task?.completedUnits ?? 0;
  const rng = createRng(
    hashSeed(state.seed, state.day, activeJob.contractId, taskId, completedUnits, activeJob.reworkCount, stance, "rebar-bob")
  );
  if (rng.nextInt(100) >= REBAR_BOB_CHANCE_PCT) {
    return null;
  }

  return {
    id: "rebar-bob",
    speaker: "Rebar Bob",
    line: REBAR_BOB_LINES[rng.nextInt(REBAR_BOB_LINES.length)] ?? REBAR_BOB_LINES[0]
  };
}

function hasRebarBobEncounterToday(state: GameState): boolean {
  const actorId = state.player.actorId;
  return state.log.some(
    (entry) => entry.day === state.day && entry.actorId === actorId && entry.message.startsWith(REBAR_BOB_LOG_MARKER)
  );
}
