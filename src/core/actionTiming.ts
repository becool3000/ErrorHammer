import { TaskStance } from "./types";

const BASE_ACTION_DURATION_MS: Record<TaskStance, number> = {
  rush: 3_000,
  standard: 6_000,
  careful: 12_000
};

export function getActionDurationMs(stance: TaskStance, allowOvertime: boolean): number {
  const baseDuration = BASE_ACTION_DURATION_MS[stance];
  return allowOvertime ? baseDuration * 2 : baseDuration;
}
