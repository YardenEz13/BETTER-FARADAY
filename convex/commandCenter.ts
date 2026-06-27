import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/* ═══════════════════════════════════════════════════════════════════════
   TEACHER COMMAND CENTER — single aggregated payload
   Everything the command center renders is derived from REAL data here:
   per-student / per-topic mastery from `attempts`, live status, weekly
   trend, KPIs with sparklines, topic averages, alerts and a ticker.
   The frontend only does geometry (radar/sparkline/gauge), never numbers.
   ═══════════════════════════════════════════════════════════════════════ */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

type Tone = "primary" | "secondary" | "tertiary" | "error";

function initialOf(name: string): string {
  return (name?.trim()?.[0] ?? "?");
}

// Relative Hebrew time label ("עכשיו", "לפני 3 דק׳", ...)
function relHe(ms: number, now: number): string {
  const d = now - ms;
  if (d < 60 * 1000) return "עכשיו";
  const min = Math.floor(d / (60 * 1000));
  if (min < 60) return `לפני ${min} דק׳`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} ש׳`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

export const getCommandCenter = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const now = Date.now();
    const classroom = await ctx.db.get(classroomId);

    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const topics = (await ctx.db.query("topics").collect()).sort(
      (a, b) => a.order - b.order
    );
    const topicIndex = new Map<string, number>();
    topics.forEach((t, i) => topicIndex.set(t._id, i));

    // ── Per-student aggregation ──────────────────────────────────────────
    const studentRows = [];
    const classDailyAttempts = new Array(7).fill(0);   // last 7 days, count
    const classDailyCorrect = new Array(7).fill(0);    // last 7 days, correct
    const classDailyActive: Array<Set<string>> = Array.from({ length: 7 }, () => new Set());
    const classDailyAi = new Array(7).fill(0);
    const tickerCandidates: Array<{ tone: Tone; who: string; text: string; ms: number }> = [];
    const alertCandidates: Array<{ tone: Tone; who: string; text: string; ms: number }> = [];

    // topic → accumulators for class average
    const topicAgg = topics.map(() => ({ correct: 0, total: 0 }));

    for (const s of students) {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .order("desc")
        .take(200);

      // per-topic mastery from attempts
      const perTopic = topics.map(() => ({ correct: 0, total: 0 }));
      for (const a of attempts) {
        const ti = topicIndex.get(a.topicId);
        if (ti === undefined) continue;
        perTopic[ti].total++;
        if (a.isCorrect) perTopic[ti].correct++;
      }

      const mastery = perTopic.map((p, i) => {
        const pct = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0;
        topicAgg[i].correct += p.correct;
        topicAgg[i].total += p.total;
        return { topicId: topics[i]._id, pct, attempts: p.total };
      });

      // overall accuracy from the most recent 20 attempts
      const recent = attempts.slice(0, 20);
      const recentTotal = recent.length;
      const recentCorrect = recent.filter((a) => a.isCorrect).length;
      const acc = recentTotal > 0 ? Math.round((recentCorrect / recentTotal) * 100) : 0;

      // weekly trend: this-week accuracy minus last-week accuracy (points)
      const thisWeek = attempts.filter((a) => a._creationTime >= now - WEEK);
      const lastWeek = attempts.filter(
        (a) => a._creationTime >= now - 2 * WEEK && a._creationTime < now - WEEK
      );
      const accOf = (arr: typeof attempts) =>
        arr.length > 0 ? (arr.filter((a) => a.isCorrect).length / arr.length) * 100 : 0;
      const trend =
        thisWeek.length > 0 && lastWeek.length > 0
          ? Math.round(accOf(thisWeek) - accOf(lastWeek))
          : 0;

      // status — same thresholds as the classroom heatmap
      let status: "risk" | "watch" | "thriving" = "thriving";
      if (attempts.length === 0) {
        status = "watch";
      } else {
        const last5 = attempts.slice(0, 5);
        const ratio = last5.filter((a) => a.isCorrect).length / last5.length;
        if (ratio < 0.4) status = "risk";
        else if (ratio < 0.7) status = "watch";
        else status = "thriving";
      }

      // weakest / strongest topic (only where the student has attempts)
      const attempted = mastery.filter((m) => m.attempts > 0);
      let weak: { topicId: Id<"topics">; name: string; pct: number } | null = null;
      let strong: { topicId: Id<"topics">; name: string; pct: number } | null = null;
      if (attempted.length > 0) {
        const w = attempted.reduce((lo, m) => (m.pct < lo.pct ? m : lo));
        const st = attempted.reduce((hi, m) => (m.pct > hi.pct ? m : hi));
        const wt = topics[topicIndex.get(w.topicId)!];
        const stt = topics[topicIndex.get(st.topicId)!];
        weak = { topicId: w.topicId, name: wt.nameHe || wt.name, pct: w.pct };
        strong = { topicId: st.topicId, name: stt.nameHe || stt.name, pct: st.pct };
      }

      // minutes today + last activity
      const todayStart = now - DAY;
      const minutesToday = Math.round(
        attempts
          .filter((a) => a._creationTime >= todayStart)
          .reduce((sum, a) => sum + (a.timeMs || 0), 0) / 60000
      );
      const lastMs = attempts[0]?._creationTime ?? s._creationTime;

      // AI chats for this student (count + today)
      const chats = await ctx.db
        .query("aiChats")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .order("desc")
        .take(50);
      const aiQ = chats.length;
      for (const c of chats) {
        const bucket = Math.floor((now - c.startedAt) / DAY);
        if (bucket >= 0 && bucket < 7) classDailyAi[bucket]++;
      }

      // fold attempts into class daily buckets + activity feeds
      for (const a of attempts) {
        const bucket = Math.floor((now - a._creationTime) / DAY);
        if (bucket >= 0 && bucket < 7) {
          classDailyAttempts[bucket]++;
          if (a.isCorrect) classDailyCorrect[bucket]++;
          classDailyActive[bucket].add(s._id);
        }
      }

      studentRows.push({
        id: s._id,
        name: s.name,
        initial: initialOf(s.name),
        avatarColor: s.avatarColor,
        level: s.level ?? 1,
        status,
        acc,
        trend,
        streak: s.streak ?? 0,
        aiQ,
        minutes: minutesToday,
        lastLabel: relHe(lastMs, now),
        lastMs,
        mastery,
        weak,
        strong,
        attemptCount: attempts.length,
      });

      // ticker — most recent attempt for this student
      if (attempts[0]) {
        const a0 = attempts[0];
        const ti = topicIndex.get(a0.topicId);
        const tName = ti !== undefined ? topics[ti].nameHe || topics[ti].name : "תרגול";
        tickerCandidates.push({
          tone: a0.isCorrect ? "primary" : "error",
          who: s.name,
          text: a0.isCorrect ? `פתר/ה שאלה ב${tName}` : `נתקל/ה בקושי ב${tName}`,
          ms: a0._creationTime,
        });
      }
    }

    // ── Alerts — from recent hint requests + struggle/streak signals ──────
    const studentById = new Map(students.map((s) => [s._id as string, s]));
    const recentHints = await ctx.db.query("hintRequests").order("desc").take(40);
    for (const h of recentHints) {
      const st = studentById.get(h.studentId);
      if (!st) continue;
      if (h._creationTime < now - 2 * WEEK) continue;
      alertCandidates.push({
        tone: "secondary",
        who: st.name,
        text: "ביקש/ה עזרה מפרופ׳ פאראדיי",
        ms: h._creationTime,
      });
    }
    // risk + thriving signals from this run's student rows
    for (const r of studentRows) {
      if (r.status === "risk" && r.attemptCount > 0) {
        alertCandidates.push({
          tone: "error",
          who: r.name,
          text: r.weak ? `מתקשה ב${r.weak.name} · ${r.weak.pct}%` : "דיוק מתחת לסף השבוע",
          ms: r.lastMs,
        });
      } else if (r.status === "thriving" && r.streak >= 5) {
        alertCandidates.push({
          tone: "tertiary",
          who: r.name,
          text: `רצף לוהט — ${r.streak} ימים`,
          ms: r.lastMs,
        });
      } else if (r.strong && r.strong.pct >= 90) {
        alertCandidates.push({
          tone: "primary",
          who: r.name,
          text: `שולט/ת ב${r.strong.name} · ${r.strong.pct}%`,
          ms: r.lastMs,
        });
      }
    }
    // PDF personal-assignment completions — "אלמוג finished" notifications
    const completedPdf = await ctx.db
      .query("pdfAssignments")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();
    for (const a of completedPdf) {
      if (!a.completedAt || a.completedAt < now - 2 * WEEK) continue;
      const st = studentById.get(a.studentId);
      if (!st) continue;
      const qs = await ctx.db
        .query("pdfQuestions")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
        .collect();
      const parts = qs.flatMap((q) => q.parts);
      const correct = parts.filter((p) => p.isCorrect === true).length;
      const pct = parts.length > 0 ? Math.round((correct / parts.length) * 100) : 0;
      alertCandidates.push({
        tone: "primary",
        who: st.name,
        text: `סיים/ה את מטלת "${a.title}" · ${pct}%`,
        ms: a.completedAt,
      });
    }

    const alerts = alertCandidates
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 7)
      .map((a) => ({ tone: a.tone, who: a.who, text: a.text, timeLabel: relHe(a.ms, now) }));

    const ticker = tickerCandidates
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 12)
      .map((t) => ({ tone: t.tone, who: t.who, text: t.text }));

    // ── Topic averages (class) ───────────────────────────────────────────
    const topicAverages = topics.map((t, i) => ({
      topicId: t._id,
      name: t.nameHe || t.name,
      pct: topicAgg[i].total > 0 ? Math.round((topicAgg[i].correct / topicAgg[i].total) * 100) : 0,
      attempts: topicAgg[i].total,
    }));

    // ── Class-level metrics ──────────────────────────────────────────────
    const counts = { risk: 0, watch: 0, thriving: 0 };
    for (const r of studentRows) counts[r.status]++;

    const studentsWithData = studentRows.filter((r) => r.attemptCount > 0);
    const classAvg =
      studentsWithData.length > 0
        ? Math.round(studentsWithData.reduce((s, r) => s + r.acc, 0) / studentsWithData.length)
        : 0;

    const activeNow = studentRows.filter((r) => r.lastMs >= now - 15 * 60 * 1000).length;
    const aiToday = classDailyAi[0];
    const atRisk = counts.risk;

    // sparklines (oldest → newest), reversing the day-0-is-today buckets
    const accSpark = classDailyAttempts
      .map((tot, i) => (tot > 0 ? Math.round((classDailyCorrect[i] / tot) * 100) : 0))
      .reverse();
    const activeSpark = classDailyActive.map((set) => set.size).reverse();
    const aiSpark = [...classDailyAi].reverse();

    const healthLabel =
      classAvg >= 80 ? "מצוינת" : classAvg >= 65 ? "יציבה" : classAvg >= 50 ? "דורשת מעקב" : "דורשת התערבות";

    const kpis = [
      {
        key: "students",
        label: "תלמידים",
        value: students.length,
        tone: "secondary" as Tone,
        delta: null as number | null,
        spark: [] as number[],
      },
      {
        key: "mastery",
        label: "שליטה ממוצעת",
        value: classAvg,
        suffix: "%",
        tone: "primary" as Tone,
        delta: null, // the KPI card derives its delta from the sparkline series
        spark: accSpark,
      },
      {
        key: "active",
        label: "פעילים עכשיו",
        value: activeNow,
        tone: "primary" as Tone,
        delta: null,
        spark: activeSpark,
      },
      {
        key: "ai",
        label: "שאלות AI היום",
        value: aiToday,
        tone: "secondary" as Tone,
        delta: null,
        spark: aiSpark,
      },
      {
        key: "risk",
        label: "בסיכון",
        value: atRisk,
        tone: "error" as Tone,
        delta: null,
        spark: [] as number[],
      },
    ];

    return {
      classroom: classroom ? { name: classroom.name, teacherName: classroom.teacherName } : null,
      topics: topics.map((t) => ({ id: t._id, name: t.nameHe || t.name, order: t.order })),
      students: studentRows,
      topicAverages,
      counts,
      classAvg,
      activeNow,
      aiToday,
      atRisk,
      healthLabel,
      kpis,
      alerts,
      ticker,
      generatedAt: now,
    };
  },
});
