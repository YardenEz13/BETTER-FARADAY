import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Recompute student power maps every 5 minutes
crons.interval(
  "recompute-power-maps",
  { minutes: 5 },
  internal.powerMap.scheduledRecompute,
);

export default crons;
