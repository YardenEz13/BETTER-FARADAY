import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Zap, Flame, Target, CheckCircle as CheckCircle2, RotateCcw, MapIcon as Map } from "./electric";
import { SparkBurst } from "./electric";

/* ── Celebratory end-of-session recap ──
   Big accuracy ring, count-up XP, streak flame, daily-goal bar, and CTAs.
   Fed by goals.getSessionSummary + goals.getDailyProgress. Reduced-motion safe. */
export default function SessionRecap({
  studentId,
  sessionId,
  onNewSession,
  onBackToMap,
}: {
  studentId: Id<"students">;
  sessionId: Id<"sessions"> | null;
  onNewSession: () => void;
  onBackToMap: () => void;
}) {
  const reducedMotion = !!useReducedMotion();
  const summary = useQuery(
    api.goals.getSessionSummary,
    sessionId ? { sessionId } : "skip",
  );
  const daily = useQuery(api.goals.getDailyProgress, { studentId });

  const accuracy = summary?.accuracy ?? 0;
  const xpEarned = summary?.xpEarned ?? 0;
  const attempted = summary?.attempted ?? 0;
  const correct = summary?.correct ?? 0;
  const streak = summary?.streak ?? daily?.streak ?? 0;

  const goal = daily?.goal ?? 10;
  const answeredToday = daily?.answeredToday ?? 0;
  const goalReached = daily?.goalReached ?? false;
  const goalRatio = Math.min(answeredToday / Math.max(goal, 1), 1);

  const loading = summary === undefined || daily === undefined;

  // Count-up for the XP number.
  const [displayXp, setDisplayXp] = useState(0);
  useEffect(() => {
    if (loading) return;
    if (reducedMotion || xpEarned === 0) { setDisplayXp(xpEarned); return; }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setDisplayXp(Math.round(xpEarned * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [xpEarned, loading, reducedMotion]);

  // Accuracy ring geometry
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const [ringRatio, setRingRatio] = useState(reducedMotion ? accuracy / 100 : 0);
  useEffect(() => {
    if (loading) return;
    if (reducedMotion) { setRingRatio(accuracy / 100); return; }
    const id = setTimeout(() => setRingRatio(accuracy / 100), 120);
    return () => clearTimeout(id);
  }, [accuracy, loading, reducedMotion]);

  const showGoalSpark = goalReached && !reducedMotion;

  const durMin = summary ? Math.round(summary.durationMs / 60000) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      dir="rtl"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "color-mix(in srgb, var(--color-scrim, #000) 55%, transparent)" }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative w-full max-w-[26rem] rounded-[28px] p-7 border-2 border-outline bg-surface my-8"
        style={{ boxShadow: "var(--shadow-clay)" }}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary rounded-t-[26px]" />

        <div className="text-center mb-1">
          <span className="label-mono text-[0.6rem] text-on-surface-variant">סיכום סבב</span>
        </div>
        <h2 className="text-center font-display font-black text-2xl text-on-surface mb-6" style={{ fontFamily: "'Assistant', sans-serif" }}>
          {accuracy >= 80 ? "סבב מעולה! ⚡" : accuracy >= 50 ? "כל הכבוד! 💪" : "המשכת עד הסוף 👏"}
        </h2>

        {/* Accuracy ring */}
        <div className="relative w-[140px] h-[140px] mx-auto mb-6">
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-outline)" strokeWidth="12" />
            <circle
              cx="70" cy="70" r={R} fill="none" stroke="var(--color-primary)" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - ringRatio)}
              style={{ transition: reducedMotion ? "none" : "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)", filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-primary) 55%, transparent))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num font-black text-4xl text-primary leading-none">{accuracy}%</span>
            <span className="text-xs font-semibold text-on-surface-variant mt-1">דיוק</span>
          </div>
        </div>

        {/* Stat chips: correct/attempted, XP, streak */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <div className="rounded-2xl border-2 border-outline bg-surface-container p-3 flex flex-col items-center" style={{ boxShadow: "var(--shadow-clay)" }}>
            <CheckCircle2 size={18} className="text-primary mb-1" />
            <span className="num font-extrabold text-lg text-on-surface leading-none">{correct}/{attempted}</span>
            <span className="text-[10px] font-semibold text-on-surface-variant mt-1">נכונות</span>
          </div>
          <div className="rounded-2xl border-2 border-outline bg-surface-container p-3 flex flex-col items-center" style={{ boxShadow: "var(--shadow-clay)" }}>
            <Zap size={18} className="text-tertiary mb-1" />
            <span className="num font-extrabold text-lg text-tertiary leading-none">+{displayXp}</span>
            <span className="text-[10px] font-semibold text-on-surface-variant mt-1">XP</span>
          </div>
          <div className="rounded-2xl border-2 border-outline bg-surface-container p-3 flex flex-col items-center" style={{ boxShadow: "var(--shadow-clay)" }}>
            <Flame size={18} className="text-tertiary mb-1" />
            <span className="num font-extrabold text-lg text-on-surface leading-none">{streak}</span>
            <span className="text-[10px] font-semibold text-on-surface-variant mt-1">רצף ימים</span>
          </div>
        </div>

        {/* Daily-goal progress bar */}
        <div className="relative rounded-2xl border-2 border-outline bg-surface-container p-4 mb-6" style={{ boxShadow: "var(--shadow-clay)" }}>
          {showGoalSpark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <SparkBurst />
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target size={14} className="text-primary" />
              <span className="text-xs font-bold text-on-surface-variant">יעד יומי</span>
            </div>
            <span className="num text-xs font-extrabold text-primary">{answeredToday}/{goal} שאלות היום</span>
          </div>
          <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden border border-outline">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: reducedMotion ? `${goalRatio * 100}%` : 0 }}
              animate={{ width: `${goalRatio * 100}%` }}
              transition={{ duration: reducedMotion ? 0 : 0.8, ease: "easeOut", delay: 0.2 }}
              style={{ boxShadow: goalReached ? "0 0 8px var(--color-primary)" : "none" }}
            />
          </div>
          {goalReached && (
            <p className="text-[11px] font-bold text-primary mt-2 text-center">🎯 השלמת את היעד היומי! +20 XP</p>
          )}
        </div>

        {/* Meta line */}
        {durMin > 0 && (
          <p className="text-center text-[11px] text-on-surface-variant mb-5">
            {durMin} {durMin === 1 ? "דקה" : "דקות"} של תרגול
          </p>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-on-primary rounded-2xl font-bold border-2 border-primary-dark transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            <RotateCcw size={17} />
            עוד סיבוב
          </button>
          <button
            onClick={onBackToMap}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-surface text-on-surface-variant rounded-2xl font-bold border-2 border-outline hover:border-primary hover:text-primary transition-all cursor-pointer"
            style={{ boxShadow: "var(--shadow-clay)" }}
          >
            <Map size={17} />
            חזרה למפה
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
