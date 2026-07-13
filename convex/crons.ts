import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Power-map recompute + level evaluation are event-driven now:
// sessionBriefs.createBrief → powerMap.requestRecompute (debounced) →
// recomputePowerMap → levels.evaluateStudentLevel. No polling crons.

// Cleanup abandoned/empty AI chats. Hourly is enough: the cleanup thresholds
// themselves are 30min (empty) / 1h (idle), so faster polling buys nothing.
crons.interval(
  "cleanup-abandoned-chats",
  { hours: 1 },
  internal.ai.processAbandonedChats,
);

// Reclaim expired / consumed QR bridge sessions. Pure cleanup — consumers
// validate expiresAt themselves, so hourly latency is invisible.
crons.interval(
  "sweep-bridge-sessions",
  { hours: 1 },
  internal.bridge.sweepExpired,
);

// Stale packet-import watchdog is event-scheduled now: entering "solving"
// arms packetImport.sweepStalePacket, which reschedules itself only while
// the packet is still solving. No polling cron.

// Weekly: generate the teacher weekly digest for all classrooms.
// Sundays 04:00 UTC.
crons.cron(
  "generate-weekly-digests",
  "0 4 * * 0",
  internal.digest.generateAllDigests,
  {},
);

export default crons;
