import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Dev deployments run these cleanups far less often — nobody is using dev, so
// every run there is pure waste. Set on the dev deployment only:
//   npx convex env set SLOW_CRONS 1
//
// The default is deliberately the PROD cadence. If the variable is ever unset,
// missing, or unreadable, every deployment falls back to running crons more
// often, which is harmless. The inverse default — gating crons ON — fails by
// silently not running them in production, which is not a failure you notice.
const SLOW_CRONS = !!process.env.SLOW_CRONS;
console.log(`[crons] cadence: ${SLOW_CRONS ? "slow (dev)" : "normal (prod)"}`);

// Power-map recompute + level evaluation are event-driven now:
// sessionBriefs.createBrief → powerMap.requestRecompute (debounced) →
// recomputePowerMap → levels.evaluateStudentLevel. No polling crons.

// The abandoned-chat cleanup cron is deliberately gone. Hourly it read the
// newest 500 aiChats — fat documents, each carrying the whole `metrics`
// object — and then spent a Gemini analysis call on every idle chat it found.
// The client already closes chats normally through aiChat.endChat; this only
// covered the walked-away case.
//
// The trade: empty and idle chats now stay open, so they never get `metrics`
// and are excluded from the teacher analytics aggregates that filter on them.
// Still runnable by hand if a backlog needs clearing:
//   npx convex run ai:processAbandonedChats

// Reclaim expired / consumed QR bridge sessions. Pure cleanup — consumers
// validate expiresAt themselves, so sweep latency is invisible to users and
// the only thing frequency buys is how long dead rows linger. Was hourly;
// six-hourly is the same cleanup for a quarter of the reads.
crons.interval(
  "sweep-bridge-sessions",
  { hours: SLOW_CRONS ? 12 : 6 },
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

// Watch the Gemini daily budget. Two-hourly still catches a runaway hours
// before the cap trips — the cap is ~3.5x the modelled peak day, so nothing
// crosses it inside one interval — and the check is a single indexed read.
crons.interval(
  "check-ai-usage",
  { hours: SLOW_CRONS ? 6 : 2 },
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
