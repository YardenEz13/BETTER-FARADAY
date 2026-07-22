import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ── Start of the current week (Sunday 00:00, Israel time) as an ms epoch ──
// Israeli school weeks run Sunday→Saturday. We resolve "now" to its Israel
// wall-clock parts, roll back to the most recent Sunday, and re-anchor that to
// midnight. Using the Israel-zone offset at compute time keeps DST correct.
function israelWeekStart(now: number = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = weekdayMap[get("weekday")] ?? 0;
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some environments emit 24 for midnight
  const min = parseInt(get("minute"), 10);
  const sec = parseInt(get("second"), 10);
  const msSinceIsraelMidnight = ((hour * 60 + min) * 60 + sec) * 1000;
  const msSinceWeekStart = dow * 86_400_000 + msSinceIsraelMidnight;
  return now - msSinceWeekStart;
}

// XP reasons that should NOT count toward the weekly competition: purchases are
// spends (negative), and backfill is a one-off historical repair, not activity.
const EXCLUDED_REASONS = new Set(["purchase", "backfill"]);

// Weekly XP for one student = sum of qualifying xpEvents at/after weekStart.
// Events are read newest-first and we stop as soon as we cross weekStart, so a
// student with a long ledger only touches this week's tail. take(500) is a
// safety ceiling for the (rare) case of a very active week.
async function weeklyXpForStudent(
  ctx: QueryCtx,
  studentId: Id<"students">,
  weekStart: number,
): Promise<number> {
  const events = await ctx.db
    .query("xpEvents")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .order("desc")
    .take(500);
  let total = 0;
  for (const e of events) {
    if (e.createdAt < weekStart) break; // newest-first → the rest are older too
    if (EXCLUDED_REASONS.has(e.reason)) continue;
    total += e.amount;
  }
  return Math.max(0, total);
}

type LeaderboardRow = {
  rank: number;
  studentId: Id<"students">;
  name: string;
  avatarColor: string;
  /** Equipped shop title, shown under the name — the point of buying one. */
  title: string | null;
  weeklyXp: number;
  isMe: boolean;
};

export const getWeeklyLeaderboard = query({
  args: {
    classroomId: v.id("classrooms"),
    studentId: v.optional(v.id("students")),
  },
  handler: async (ctx, { classroomId, studentId }) => {
    const classroom = await ctx.db.get(classroomId);
    const enabled = classroom ? classroom.leaderboardEnabled !== false : false;
    const weekStart = israelWeekStart();

    if (!enabled) {
      return { enabled: false, weekStart, rows: [] as LeaderboardRow[], myRank: null as number | null };
    }

    // Bounded: classrooms are ~30 students.
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .take(200);

    const scored = await Promise.all(
      students.map(async (s) => ({
        studentId: s._id,
        name: s.name,
        avatarColor: s.avatarColor,
        title: s.equippedTitle ?? null,
        weeklyXp: await weeklyXpForStudent(ctx, s._id, weekStart),
        hidden: s.hideFromLeaderboard === true,
      })),
    );

    // Rank the full visible class (0-XP students included — it motivates).
    // Ties break by earlier achievement is not tracked here, so fall back to a
    // stable name sort for deterministic ordering.
    const visible = scored
      .filter((s) => !s.hidden)
      .sort((a, b) => b.weeklyXp - a.weeklyXp || a.name.localeCompare(b.name, "he"));

    const rows: LeaderboardRow[] = visible.map((s, i) => ({
      rank: i + 1,
      studentId: s.studentId,
      name: s.name,
      avatarColor: s.avatarColor,
      title: s.title,
      weeklyXp: s.weeklyXp,
      isMe: studentId ? s.studentId === studentId : false,
    }));

    // myRank: from the visible rows if present. A hidden requester isn't ranked
    // among peers, so report null (their row is excluded from everyone's list).
    let myRank: number | null = null;
    if (studentId) {
      const mine = rows.find((r) => r.studentId === studentId);
      myRank = mine ? mine.rank : null;
    }

    return { enabled: true, weekStart, rows, myRank };
  },
});

// Per-student opt-out toggle (student-facing).
export const setLeaderboardVisibility = mutation({
  args: { studentId: v.id("students"), hidden: v.boolean() },
  handler: async (ctx, { studentId, hidden }) => {
    await ctx.db.patch(studentId, { hideFromLeaderboard: hidden });
    return { hidden };
  },
});

// Teacher master switch for the whole classroom.
export const setClassroomLeaderboard = mutation({
  args: { classroomId: v.id("classrooms"), enabled: v.boolean() },
  handler: async (ctx, { classroomId, enabled }) => {
    await ctx.db.patch(classroomId, { leaderboardEnabled: enabled });
    return { enabled };
  },
});
