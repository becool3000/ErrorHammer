import { GameState, Outcome } from "./types";

export interface JobHistoryEntry {
  day: number;
  jobName: string;
  outcome: Outcome | "unknown";
  quality: "low" | "medium" | "high" | "n/a" | "unknown";
  cashEarned: number;
}

export function getJobHistory(state: GameState, limit = 30): JobHistoryEntry[] {
  const maxItems = Math.max(1, Math.floor(limit));
  const pendingByPlayer = new Map<string, { day: number; jobName: string; quality: JobHistoryEntry["quality"] }>();
  const entries: JobHistoryEntry[] = [];

  for (const logEntry of state.log) {
    if (logEntry.actorId !== state.player.actorId) {
      continue;
    }

    const message = logEntry.message;

    const acceptedMatch = message.match(/^Accepted (.+) for \$-?\d+\.?$/i);
    if (acceptedMatch) {
      pendingByPlayer.set(logEntry.actorId, {
        day: logEntry.day,
        jobName: acceptedMatch[1] ?? "Unknown Job",
        quality: "unknown"
      });
      continue;
    }

    const dayLaborMatch = message.match(/worked a day-labor shift .* earned \$(-?\d+)/i);
    if (dayLaborMatch) {
      entries.push({
        day: logEntry.day,
        jobName: "Day Laborer",
        outcome: "success",
        quality: "n/a",
        cashEarned: toSafeInt(dayLaborMatch[1])
      });
      continue;
    }

    const qualityMatch = message.match(/parts quality settled at\s+(low|medium|high)\b/i);
    if (qualityMatch) {
      const pending = pendingByPlayer.get(logEntry.actorId);
      if (pending) {
        pending.quality = qualityMatch[1]?.toLowerCase() as JobHistoryEntry["quality"];
        pendingByPlayer.set(logEntry.actorId, pending);
      }
      continue;
    }

    const neutralPaymentMatch = message.match(/half pay:\s*cash\s*([+-]?\d+)/i);
    if (neutralPaymentMatch) {
      const pending = pendingByPlayer.get(logEntry.actorId);
      entries.push({
        day: pending?.day ?? logEntry.day,
        jobName: pending?.jobName ?? "Unknown Job",
        outcome: "neutral",
        quality: pending?.quality === "unknown" ? "low" : pending?.quality ?? "low",
        cashEarned: toSafeInt(neutralPaymentMatch[1])
      });
      pendingByPlayer.delete(logEntry.actorId);
      continue;
    }

    const collectedMatch = message.match(/Collected\s+(success|neutral|fail)\s+payment:\s*cash\s*([+-]?\d+)/i);
    if (collectedMatch) {
      const pending = pendingByPlayer.get(logEntry.actorId);
      entries.push({
        day: pending?.day ?? logEntry.day,
        jobName: pending?.jobName ?? "Unknown Job",
        outcome: collectedMatch[1]?.toLowerCase() as Outcome,
        quality: pending?.quality ?? "unknown",
        cashEarned: toSafeInt(collectedMatch[2])
      });
      pendingByPlayer.delete(logEntry.actorId);
      continue;
    }
  }

  return entries.slice(-maxItems).reverse();
}

function toSafeInt(value: string | undefined): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}
