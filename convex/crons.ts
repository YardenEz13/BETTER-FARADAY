import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Power-map recompute + level evaluation are event-driven now:
// sessionBriefs.createBrief → powerMap.requestRecompute (debounced) →
// recomputePowerMap → levels.evaluateStudentLevel. No polling crons.

// Cleanup abandoned/empty AI chats every 15 minutes
crons.interval(
  "cleanup-abandoned-chats",
  { minutes: 15 },
  internal.ai.processAbandonedChats,
);

// Reclaim expired / consumed QR bridge sessions every 15 minutes
crons.interval(
  "sweep-bridge-sessions",
  { minutes: 15 },
  internal.bridge.sweepExpired,
);

// Fail packet-import rows stuck "pending" past the action ceiling (watchdog)
crons.interval(
  "sweep-stale-packet-imports",
  { minutes: 5 },
  internal.packetImport.sweepStalePackets,
);

// Daily: flag students who haven't practiced today (streak in danger).
// 21:00 UTC ≈ midnight Israel time. Compute-only, no push.
crons.cron(
  "flag-inactive-streaks",
  "0 21 * * *",
  internal.streaks.flagInactiveStreaks,
  {},
);

// Weekly: generate the teacher weekly digest for all classrooms.
// Sundays 04:00 UTC.
crons.cron(
  "generate-weekly-digests",
  "0 4 * * 0",
  internal.digest.generateAllDigests,
  {},
);

export default crons;
