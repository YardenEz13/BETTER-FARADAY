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

// The question-authoring cron is deliberately gone. It wrote unreviewed
// Gemini questions into the live bank every 75 minutes, and its gap scan
// (questionGen.pickGap) plus the themed-precompute pipeline it kicked were
// 4.4 GB/month of database bandwidth between them — 91% of the account's
// total. `questionGen.generateBatch` still exists and can be run by hand:
//   npx convex run questionGen:generateBatch
// Put it back on a schedule only behind a human review gate.

// Watch the Gemini daily budget. Half-hourly is enough to catch a runaway
// hours before the cap trips, and the check is a single indexed read.
crons.interval(
  "check-ai-usage",
  { minutes: 30 },
  internal.aiUsage.checkDailyBudget,
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
