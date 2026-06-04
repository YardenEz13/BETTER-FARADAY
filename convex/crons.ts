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

export default crons;
