import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { israelDate } from "./streaks";

/* ═══════════════════════════════════════════════════════════════════════
   PARENT WEEKLY REPORT — capability-link backed, warm & rule-based (no LLM)
   A parent opens /parent/<token> and sees a friendly weekly snapshot of
   their child. The token is the ONLY key: getParentReport NEVER returns
   studentId or any other student's data. Links are long-lived and revocable
   (revokedAt stamped). Reads are all index-based and bounded.
   ═══════════════════════════════════════════════════════════════════════ */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const LEVEL_NAMES = ["מתחיל", "חוקר", "מתקדם", "מומחה", "מאסטר"] as const;
function levelName(level: number | undefined): string {
  const i = Math.max(1, Math.min(5, level ?? 1)) - 1;
  return LEVEL_NAMES[i];
}

// Israel-local weekday (יום ראשון … שבת) for a timestamp.
const HE_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
function israelWeekday(ts: number): string {
  // en-US short weekday in Jerusalem tz → map to index.
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
  }).format(new Date(ts));
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
  return idx >= 0 ? HE_WEEKDAYS[idx] : "";
}

// ── Teacher: create (or return existing active) parent link for a student ──
export const createParentLink = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    // Reuse an existing active (non-revoked) link so the URL stays stable.
    const existing = await ctx.db
      .query("parentLinks")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(20);
    const active = existing.find((l) => l.revokedAt === undefined);
    if (active) {
      return { token: active.token, path: `/parent/${active.token}` };
    }

    // Random, unguessable token (>=24 chars). Two UUIDs, hyphens stripped = 64.
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    await ctx.db.insert("parentLinks", {
      studentId,
      token,
      createdAt: Date.now(),
    });
    return { token, path: `/parent/${token}` };
  },
});

// ── Teacher: revoke all active links for a student ──
export const revokeParentLink = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const links = await ctx.db
      .query("parentLinks")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .take(50);
    const now = Date.now();
    let revoked = 0;
    for (const l of links) {
      if (l.revokedAt === undefined) {
        await ctx.db.patch(l._id, { revokedAt: now });
        revoked++;
      }
    }
    return { revoked };
  },
});

// ── Parent page: stamp lastViewedAt (fire-and-forget, keeps the query pure) ──
export const markParentView = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query("parentLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!link || link.revokedAt !== undefined) return { ok: false };
    await ctx.db.patch(link._id, { lastViewedAt: Date.now() });
    return { ok: true };
  },
});

// Encouragement line — rule-based, warm, no grade-shaming. Priority: streak →
// accuracy → activity → gentle default.
function encouragement(o: {
  streak: number;
  accuracyPct: number;
  questionsThisWeek: number;
  activeDaysCount: number;
}): string {
  if (o.streak >= 5) return `${o.streak} ימי תרגול ברצף — התמדה מרשימה! 🔥`;
  if (o.accuracyPct >= 85 && o.questionsThisWeek >= 5)
    return "דיוק גבוה השבוע — עבודה יסודית ומדויקת. כל הכבוד! ⭐";
  if (o.activeDaysCount >= 3)
    return `תרגול ב-${o.activeDaysCount} ימים שונים השבוע — קצב נהדר וקבוע. 💪`;
  if (o.questionsThisWeek >= 10)
    return "שבוע פעיל ומלא תרגול — ממשיכים ככה! 🚀";
  if (o.questionsThisWeek > 0)
    return "כל שאלה היא צעד קדימה — נהדר שהתחלנו לתרגל השבוע. 🌱";
  return "שבוע חדש הוא הזדמנות נהדרת להתחיל — נשמח לראותכם בתרגול! 🌟";
}

// ── Parent page: the weekly snapshot. null if token unknown/revoked. ──
export const getParentReport = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query("parentLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!link || link.revokedAt !== undefined) return null;

    const student = await ctx.db.get(link.studentId);
    if (!student) return null;

    const now = Date.now();
    const weekStart = now - WEEK;

    // ── Attempts this week (bounded; 300 covers a realistic week+) ──
    const recentAttempts: Doc<"attempts">[] = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .order("desc")
      .take(300);
    const thisWeek = recentAttempts.filter((a) => a._creationTime >= weekStart);

    const questionsThisWeek = thisWeek.length;
    const correctThisWeek = thisWeek.filter((a) => a.isCorrect).length;
    const accuracyPct =
      questionsThisWeek > 0
        ? Math.round((correctThisWeek / questionsThisWeek) * 100)
        : 0;

    // ── Active days (Israel weekdays with any attempt this week) ──
    const activeDaySet = new Set<string>();     // by israelDate key (dedupe)
    const activeWeekdays: string[] = [];
    const weekdayOrder = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    for (const a of thisWeek) {
      const key = israelDate(a._creationTime);
      if (activeDaySet.has(key)) continue;
      activeDaySet.add(key);
      const wd = israelWeekday(a._creationTime);
      if (wd) activeWeekdays.push(wd);
    }
    const activeDays = weekdayOrder.filter((d) => activeWeekdays.includes(d));

    // ── XP this week (exclude purchases / backfill; earned only) ──
    const recentXp: Doc<"xpEvents">[] = await ctx.db
      .query("xpEvents")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .order("desc")
      .take(300);
    const xpThisWeek = recentXp
      .filter(
        (e) =>
          e.createdAt >= weekStart &&
          e.amount > 0 &&
          e.reason !== "purchase" &&
          e.reason !== "backfill",
      )
      .reduce((sum, e) => sum + e.amount, 0);

    // ── Topics practiced this week (join attempts → topics, max 5) ──
    const topicIds = new Set<Id<"topics">>();
    for (const a of thisWeek) topicIds.add(a.topicId);
    const topicsPracticed: string[] = [];
    for (const tid of topicIds) {
      if (topicsPracticed.length >= 5) break;
      const t = await ctx.db.get(tid);
      if (t) topicsPracticed.push(t.nameHe || t.name);
    }

    // ── Homework: active assignments for this student, completed vs total ──
    const assigned: Doc<"assignedQuestions">[] = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .order("desc")
      .take(100);
    let hwTotal = 0;
    let hwCompleted = 0;
    for (const aq of assigned) {
      const hw = await ctx.db.get(aq.homeworkId);
      if (!hw || hw.status !== "active") continue;
      hwTotal++;
      if (aq.status === "submitted") hwCompleted++;
    }

    // ── Last exam (most recent submitted score) ──
    const exams: Doc<"examAttempts">[] = await ctx.db
      .query("examAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .order("desc")
      .take(20);
    let lastExam: { score: number; date: number } | null = null;
    for (const ex of exams) {
      if (ex.status === "submitted" && ex.finalScore !== undefined) {
        lastExam = { score: Math.round(ex.finalScore), date: ex.submittedAt ?? ex._creationTime };
        break;
      }
    }

    const encouragementLine = encouragement({
      streak: student.streak,
      accuracyPct,
      questionsThisWeek,
      activeDaysCount: activeDays.length,
    });

    return {
      studentName: student.name,
      weekStart,
      streak: student.streak,
      level: levelName(student.level),
      questionsThisWeek,
      correctThisWeek,
      accuracyPct,
      activeDays,             // Hebrew weekday names, Sun→Sat order
      xpThisWeek,
      homeworkStatus: { completed: hwCompleted, total: hwTotal },
      lastExam,
      topicsPracticed,
      encouragementLine,
    };
  },
});
