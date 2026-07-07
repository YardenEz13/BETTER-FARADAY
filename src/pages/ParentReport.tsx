import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  Flame,
  Sparkles,
  CheckCircle as CheckCircle2,
  BookOpen,
  Trophy,
  AlertTriangle,
  ElectricBolt,
} from "../components/electric";
import { api } from "../../convex/_generated/api";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function ParentReport() {
  const { token } = useParams<{ token: string }>();
  const report = useQuery(
    api.parentReports.getParentReport,
    token ? { token } : "skip",
  );
  const markView = useMutation(api.parentReports.markParentView);

  // Fire-and-forget view stamp on mount.
  useEffect(() => {
    if (token) markView({ token }).catch(() => {});
  }, [token, markView]);

  // Loading
  if (report === undefined) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-background)" }}
      >
        <ElectricBolt size={40} className="text-primary animate-pulse" />
      </div>
    );
  }

  // Unknown / revoked token → gentle inactive state.
  if (report === null) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "var(--color-background)" }}
      >
        <div
          className="clay-card w-full max-w-[24rem] text-center p-8"
          style={{ borderRadius: 24 }}
        >
          <div className="flex justify-center mb-4">
            <span
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-surface-container-low)", border: "2px solid var(--color-outline)" }}
            >
              <AlertTriangle size={28} className="text-on-surface-variant" />
            </span>
          </div>
          <h1 className="font-display font-extrabold text-[22px] mb-2 text-on-surface">
            הקישור אינו פעיל
          </h1>
          <p className="font-body-md text-on-surface-variant leading-relaxed">
            ייתכן שהקישור בוטל או שאינו תקין. אנא בקשו קישור מעודכן מהמורה.
          </p>
        </div>
      </div>
    );
  }

  const {
    studentName,
    streak,
    level,
    questionsThisWeek,
    correctThisWeek,
    accuracyPct,
    activeDays,
    xpThisWeek,
    homeworkStatus,
    lastExam,
    topicsPracticed,
    encouragementLine,
  } = report;

  const examDate = lastExam
    ? new Intl.DateTimeFormat("he-IL", {
        day: "numeric",
        month: "long",
        timeZone: "Asia/Jerusalem",
      }).format(new Date(lastExam.date))
    : null;

  return (
    <div
      dir="rtl"
      className="min-h-screen px-4 py-6"
      style={{ background: "var(--color-background)" }}
    >
      <div className="w-full max-w-[30rem] mx-auto flex flex-col gap-4">
        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2"
        >
          <div className="flex items-center justify-center gap-1.5 mb-1.5 text-primary">
            <ElectricBolt size={16} />
            <span className="font-label-md tracking-wide">הדוח השבועי</span>
          </div>
          <h1 className="font-display font-extrabold text-[26px] leading-tight text-on-surface">
            הדוח השבועי של {studentName}
          </h1>
        </motion.header>

        {/* ── Hero: streak + level ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="clay-card p-5 flex items-center justify-between gap-3"
          style={{ borderRadius: 22 }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "color-mix(in srgb, var(--color-tertiary) 18%, transparent)",
                border: "2px solid var(--color-tertiary)",
              }}
            >
              <Flame size={26} style={{ color: "var(--color-tertiary)" }} />
            </span>
            <div>
              <div className="num font-extrabold text-[30px] leading-none text-on-surface">
                {streak}
              </div>
              <div className="font-body-sm text-on-surface-variant">ימי רצף</div>
            </div>
          </div>
          <div className="text-left">
            <div className="font-label-md text-on-surface-variant mb-0.5">רמה</div>
            <div
              className="font-display font-extrabold text-[20px]"
              style={{ color: "var(--color-primary)" }}
            >
              {level}
            </div>
          </div>
        </motion.div>

        {/* ── Encouragement line (prominent) ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-[18px] flex items-start gap-2.5"
          style={{
            background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
            border: "2px solid color-mix(in srgb, var(--color-primary) 45%, transparent)",
          }}
        >
          <Sparkles size={20} className="text-primary shrink-0 mt-0.5" />
          <p className="font-body-md font-bold text-on-surface leading-relaxed">
            {encouragementLine}
          </p>
        </motion.div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="שאלות השבוע" value={`${questionsThisWeek}`} sub={`${correctThisWeek} נכונות`} />
          <StatCard label="דיוק" value={`${accuracyPct}%`} accent="var(--color-primary)" />
          <StatCard label="נקודות (XP) השבוע" value={`${xpThisWeek}`} accent="var(--color-tertiary)" />
          <StatCard
            label="שיעורי בית"
            value={`${homeworkStatus.completed}/${homeworkStatus.total}`}
            sub={homeworkStatus.total === 0 ? "אין כרגע" : "הושלמו"}
          />
        </div>

        {/* ── Active days: Sun–Sat dot row ── */}
        <div className="clay-card p-4" style={{ borderRadius: 20 }}>
          <div className="font-label-md text-on-surface-variant mb-3">ימי פעילות השבוע</div>
          <div className="flex items-center justify-between">
            {WEEKDAYS.map((d) => {
              const active = activeDays.includes(d);
              return (
                <div key={d} className="flex flex-col items-center gap-1.5">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      background: active
                        ? "var(--color-primary)"
                        : "var(--color-surface-container-low)",
                      border: active
                        ? "2px solid var(--color-primary)"
                        : "2px solid var(--color-outline)",
                    }}
                  >
                    {active && <CheckCircle2 size={16} style={{ color: "var(--color-on-primary)" }} />}
                  </span>
                  <span className="text-[11px] font-bold text-on-surface-variant">{d}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Topics practiced ── */}
        {topicsPracticed.length > 0 && (
          <div className="clay-card p-4" style={{ borderRadius: 20 }}>
            <div className="flex items-center gap-1.5 mb-3 text-on-surface-variant">
              <BookOpen size={15} />
              <span className="font-label-md">נושאים שתרגלנו</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {topicsPracticed.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1.5 rounded-full font-body-sm font-bold"
                  style={{
                    background: "color-mix(in srgb, var(--color-secondary) 14%, transparent)",
                    border: "2px solid color-mix(in srgb, var(--color-secondary) 40%, transparent)",
                    color: "var(--color-on-surface)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Last exam (positive framing, only if exists) ── */}
        {lastExam && (
          <div
            className="clay-card p-4 flex items-center gap-3"
            style={{ borderRadius: 20 }}
          >
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "color-mix(in srgb, var(--color-secondary) 16%, transparent)",
                border: "2px solid var(--color-secondary)",
              }}
            >
              <Trophy size={22} style={{ color: "var(--color-secondary)" }} />
            </span>
            <div className="flex-1">
              <div className="font-label-md text-on-surface-variant">המבחן האחרון</div>
              <div className="font-body-sm text-on-surface-variant">{examDate}</div>
            </div>
            <div className="num font-extrabold text-[26px]" style={{ color: "var(--color-secondary)" }}>
              {lastExam.score}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="text-center pt-2 pb-4">
          <div className="font-label-md text-on-surface-variant mb-1">
            Faraday — מתמטיקה 581
          </div>
          <div className="text-[11px] text-on-surface-variant/70">
            הקישור אישי — אל תשתפו
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="clay-card p-4" style={{ borderRadius: 18 }}>
      <div className="font-label-md text-on-surface-variant mb-1">{label}</div>
      <div
        className="num font-extrabold text-[28px] leading-none"
        style={{ color: accent ?? "var(--color-on-surface)" }}
      >
        {value}
      </div>
      {sub && <div className="font-body-sm text-on-surface-variant mt-1">{sub}</div>}
    </div>
  );
}
