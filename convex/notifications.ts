import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { israelDate } from "./streaks";

// ── Student notification center (DERIVED — no stored notification rows) ──
// getNotifications recomputes the student's notification list on every read
// from live data (homework, PDF assignments, streak, level-ups, daily goal).
// Read-state is the only thing persisted, in `notificationReads`, keyed by the
// same stable string a notification emits. Keys are stable + idempotent so a
// mark-read survives re-derivation.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Urgency = "urgent" | "info" | "celebration";

export type Notification = {
  id: string; // stable key
  kind: string;
  title: string;
  body: string;
  urgency: Urgency;
  linkTo: string | null;
  createdAt: number;
  dueAt: number | null;
  read: boolean;
};

// Hebrew relative deadline phrasing by hours-to-deadline.
function deadlinePhrase(msLeft: number): { label: string; urgency: Urgency } {
  if (msLeft < 0) return { label: "באיחור", urgency: "urgent" };
  if (msLeft < DAY) return { label: msLeft < 12 * HOUR ? "היום" : "עד מחר", urgency: "urgent" };
  if (msLeft < 3 * DAY) return { label: "השבוע", urgency: "info" };
  return { label: "בקרוב", urgency: "info" };
}

export const getNotifications = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }): Promise<Notification[]> => {
    const student = await ctx.db.get(studentId);
    if (!student) return [];

    const now = Date.now();
    const today = israelDate(now);
    const items: Array<Omit<Notification, "read">> = [];

    // ── 1. Active homework with unsubmitted assigned questions ──
    const homeworks = await ctx.db
      .query("homework")
      .withIndex("by_classroom", (q) => q.eq("classroomId", student.classroomId))
      .order("desc")
      .take(20);

    for (const hw of homeworks) {
      if (hw.status !== "active") continue;
      const assigned = await ctx.db
        .query("assignedQuestions")
        .withIndex("by_homework_student", (q) =>
          q.eq("homeworkId", hw._id).eq("studentId", studentId),
        )
        .collect();
      if (assigned.length === 0) continue; // not assigned to this student
      const allDone = assigned.every((a) => a.status === "submitted");
      if (allDone) continue;

      const msLeft = hw.deadline - now;
      const { label, urgency } = deadlinePhrase(msLeft);
      items.push({
        id: `hw_${hw._id}`,
        kind: "homework",
        title: `שיעורי בית: ${hw.title}`,
        body: msLeft < 0 ? "מועד ההגשה עבר — עדיין אפשר להשלים" : `להגשה ${label}`,
        urgency,
        linkTo: `/student/${studentId}/homework/${hw._id}`,
        createdAt: hw.createdAt,
        dueAt: hw.deadline,
      });
    }

    // ── 2. Active PDF personal assignments with a deadline ──
    const pdfs = await ctx.db
      .query("pdfAssignments")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(20);

    for (const pdf of pdfs) {
      if (pdf.status !== "active") continue;
      if (pdf.deadline == null) continue;
      const msLeft = pdf.deadline - now;
      const { label, urgency } = deadlinePhrase(msLeft);
      items.push({
        id: `pdf_${pdf._id}`,
        kind: "pdf",
        title: `מטלה אישית: ${pdf.title}`,
        body: msLeft < 0 ? "מועד ההגשה עבר — עדיין אפשר להשלים" : `להגשה ${label}`,
        urgency,
        linkTo: `/student/${studentId}/pdf/${pdf._id}`,
        createdAt: pdf.createdAt,
        dueAt: pdf.deadline,
      });
    }

    // ── 3. Streak in danger (reuse getStreakStatus logic) ──
    const activeToday = student.lastActiveDate === today;
    if (!activeToday && student.streak > 0) {
      const freezes = student.streakFreezes ?? 0;
      items.push({
        id: `streak_${today}`,
        kind: "streak",
        title: "🔥 הרצף שלך בסכנה!",
        body:
          `פתרו שאלה אחת היום כדי לשמור על רצף של ${student.streak} ימים` +
          (freezes > 0 ? ` · יש לך ${freezes} ${freezes === 1 ? "הקפאה" : "הקפאות"}` : ""),
        urgency: "urgent",
        linkTo: `/student/${studentId}`,
        createdAt: now,
        dueAt: null,
      });
    }

    // ── 4. Level-up approved in the last ~7 days (celebration) ──
    const levelSuggestions = await ctx.db
      .query("levelSuggestions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(10);
    for (const ls of levelSuggestions) {
      if (ls.status !== "approved") continue;
      const resolvedAt = ls.resolvedAt ?? ls.createdAt;
      if (now - resolvedAt > 7 * DAY) continue;
      items.push({
        id: `level_${ls._id}`,
        kind: "level",
        title: "🎉 עלית רמה!",
        body: `הרמה שלך עודכנה לרמה ${ls.suggestedLevel}. כל הכבוד!`,
        urgency: "celebration",
        linkTo: `/student/${studentId}/progress`,
        createdAt: resolvedAt,
        dueAt: null,
      });
    }

    // ── 5. Daily goal reached today (celebration) ──
    const events = await ctx.db
      .query("xpEvents")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(50);
    const goalEvent = events.find(
      (e) => e.reason === "daily_goal" && e.refId === today,
    );
    if (goalEvent) {
      items.push({
        id: `goal_${today}`,
        kind: "goal",
        title: "✨ השלמת את היעד היומי!",
        body: "כל הכבוד — סיימת את מכסת השאלות של היום",
        urgency: "celebration",
        linkTo: null,
        createdAt: goalEvent.createdAt,
        dueAt: null,
      });
    }

    // ── Join read-state (bounded index scan by student) ──
    const reads = await ctx.db
      .query("notificationReads")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .take(200);
    const readKeys = new Set(reads.map((r) => r.notificationKey));

    const withRead: Notification[] = items.map((n) => ({
      ...n,
      read: readKeys.has(n.id),
    }));

    // Sort: urgent first, then by due date (soonest) / recency.
    const urgencyRank: Record<Urgency, number> = { urgent: 0, celebration: 1, info: 2 };
    withRead.sort((a, b) => {
      // unread before read
      if (a.read !== b.read) return a.read ? 1 : -1;
      if (urgencyRank[a.urgency] !== urgencyRank[b.urgency])
        return urgencyRank[a.urgency] - urgencyRank[b.urgency];
      const aKey = a.dueAt ?? a.createdAt;
      const bKey = b.dueAt ?? b.createdAt;
      // For due dates, soonest first; for createdAt, newest first — dueAt items
      // already sort ahead within the same urgency by having smaller values.
      if (a.dueAt != null && b.dueAt != null) return aKey - bKey;
      return bKey - aKey;
    });

    return withRead;
  },
});

// ── Bulk mark-read ──
// Idempotent per (studentId, key): if a read row already exists for a key we
// skip it. Keys are the stable notification ids emitted by getNotifications.
export const markRead = mutation({
  args: { studentId: v.id("students"), keys: v.array(v.string()) },
  handler: async (ctx, { studentId, keys }) => {
    const now = Date.now();
    for (const key of keys) {
      const existing = await getExistingRead(ctx, studentId, key);
      if (existing) continue;
      await ctx.db.insert("notificationReads", {
        studentId,
        notificationKey: key,
        readAt: now,
      });
    }
    return null;
  },
});

async function getExistingRead(
  ctx: QueryCtx,
  studentId: Id<"students">,
  key: string,
) {
  return await ctx.db
    .query("notificationReads")
    .withIndex("by_student_key", (q) =>
      q.eq("studentId", studentId).eq("notificationKey", key),
    )
    .first();
}
