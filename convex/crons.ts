import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Recompute student power maps every 5 minutes
crons.interval(
  "recompute-power-maps",
  { minutes: 5 },
  internal.powerMap.scheduledRecompute,
);

// Evaluate student levels every 6 hours
crons.interval(
  "evaluate-student-levels",
  { hours: 6 },
  internal.levels.scheduledEvaluateAll,
);

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

export default crons;
