import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles, ArrowLeft } from "../components/electric";
import { SparkBurst } from "../components/electric";
import MathText from "../components/MathText";
import { ElectricLoader } from "../components/electric";
import { HOMEWORK_THEMES } from "../components/ThemeSelector";

// ── First-run welcome wizard ──
// 3 steps: (1) avatar color, (2) homework theme, (3) placement quiz → finish.
// Reached via /student/:studentId/welcome; StudentHome redirects new students
// here. Guards against re-entry once onboarding is complete.

// Tasteful preset palette — theme-compatible, vivid but soft clay tones.
const AVATAR_COLORS = [
  "#17c964", "#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b",
  "#14b8a6", "#ef4444", "#6366f1", "#f97316", "#22c55e",
  "#06b6d4", "#a855f7",
];

const LEVEL_NAMES = ["מתחיל", "חוקר", "מתקדם", "מומחה", "מאסטר"] as const;

// A theme option's emoji + short label, reusing the shared HOMEWORK_THEMES.
type QuizAnswer = { questionId: Id<"questions">; choiceIndex: number };

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
};

export default function Onboarding() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const reducedMotion = !!useReducedMotion();

  const sid = studentId as Id<"students">;
  const state = useQuery(api.onboarding.getOnboardingState, { studentId: sid });
  const quiz = useQuery(api.onboarding.getPlacementQuiz);
  const complete = useMutation(api.onboarding.completeOnboarding);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [theme, setTheme] = useState<string | null>(null);
  const [customTheme, setCustomTheme] = useState("");
  const [quizIdx, setQuizIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [ticking, setTicking] = useState(false); // "נרשם!" flash between quiz Qs
  const [finished, setFinished] = useState(false);
  const [resultLevel, setResultLevel] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Don't flash content while the state query resolves.
  if (state === undefined) return <ElectricLoader label="טוען…" />;
  // Guard re-entry: already onboarded (or missing student) → back to home.
  if (state === null || !state.needed) {
    return <Navigate to={`/student/${studentId}`} replace />;
  }

  const goStep = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const effectiveTheme = customTheme.trim() ? customTheme.trim() : theme;
  const initial = state.name.slice(0, 1);

  async function submit(finalAnswers: QuizAnswer[]) {
    setSubmitting(true);
    try {
      const res = await complete({
        studentId: sid,
        avatarColor,
        homeworkTheme: effectiveTheme ?? undefined,
        quizAnswers: finalAnswers,
      });
      setResultLevel(res.level);
      setFinished(true);
    } finally {
      setSubmitting(false);
    }
  }

  function answerQuiz(choiceIndex: number) {
    if (ticking || submitting || !quiz) return;
    const q = quiz[quizIdx];
    const next = [...answers, { questionId: q.questionId, choiceIndex }];
    setAnswers(next);
    setTicking(true);
    // Friendly "נרשם!" tick, then advance (no right/wrong feedback — it's placement).
    window.setTimeout(() => {
      setTicking(false);
      if (quizIdx + 1 < quiz.length) {
        setQuizIdx(quizIdx + 1);
      } else {
        void submit(next);
      }
    }, reducedMotion ? 300 : 750);
  }

  // ── Finish screen ──
  if (finished) {
    const levelName = LEVEL_NAMES[Math.max(0, Math.min(4, resultLevel - 1))];
    return (
      <div dir="rtl" className="relative min-h-screen bg-background text-on-background flex items-center justify-center px-5 overflow-hidden">
        {!reducedMotion && <SparkBurst rays={16} />}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative z-10 w-full max-w-[26rem] rounded-3xl border-2 border-outline bg-surface p-8 text-center"
          style={{ boxShadow: "var(--shadow-clay)" }}
        >
          <div
            className="mx-auto mb-5 w-20 h-20 rounded-full flex items-center justify-center text-white font-extrabold text-3xl border-2 border-primary-dark"
            style={{ background: avatarColor, boxShadow: "var(--shadow-clay-primary)", fontFamily: "'Assistant', sans-serif" }}
          >
            {initial}
          </div>
          <h1 className="font-extrabold text-2xl text-on-surface mb-2" style={{ fontFamily: "'Assistant', sans-serif" }}>
            הכל מוכן, {state.name}! 🎉
          </h1>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 300 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/12 border-2 border-primary/30 mb-4"
          >
            <Sparkles size={16} className="text-primary" />
            <span className="num font-extrabold text-primary">+25 XP</span>
          </motion.div>
          <p className="font-medium text-on-surface-variant text-sm mb-6 leading-relaxed">
            הרמה שלך נקבעה לפי המבחן:
            <br />
            <span className="font-extrabold text-lg text-on-surface">רמת {levelName}</span>
            <span className="text-on-surface-variant"> · שלב {resultLevel}/5</span>
          </p>
          <button
            onClick={() => navigate(`/student/${studentId}`, { replace: true })}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-on-primary font-bold text-base border-2 border-primary-dark transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            למפת הלמידה שלי
            <ArrowLeft size={18} />
          </button>
        </motion.div>
      </div>
    );
  }

  const totalSteps = 3;
  const canContinue = step === 0 ? !!avatarColor : true;

  return (
    <div dir="rtl" className="relative min-h-screen bg-background text-on-background flex flex-col items-center px-5 py-8 overflow-x-hidden">
      {/* Progress dots */}
      <div className="flex items-center gap-2.5 mb-8 mt-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 rounded-full transition-all duration-300"
            style={{
              width: i === step ? 28 : 10,
              background: i <= step ? "var(--color-primary)" : "var(--color-outline)",
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-[28rem] flex-1">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={reducedMotion ? undefined : stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* ── Step 1: welcome + avatar color ── */}
            {step === 0 && (
              <div>
                <h1 className="font-extrabold text-2xl text-on-surface mb-1.5" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  ברוכים הבאים, {state.name}! ⚡
                </h1>
                <p className="font-medium text-on-surface-variant text-sm mb-7 leading-relaxed">
                  בוא נגדיר את הפרופיל שלך. איזה צבע מתאים לך?
                </p>

                {/* Live letter-avatar preview */}
                <div className="flex justify-center mb-7">
                  <motion.div
                    key={avatarColor}
                    initial={{ scale: 0.85 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white font-extrabold text-4xl border-2 border-primary-dark"
                    style={{ background: avatarColor, boxShadow: "var(--shadow-clay-primary)", fontFamily: "'Assistant', sans-serif" }}
                  >
                    {initial}
                  </motion.div>
                </div>

                <div className="grid grid-cols-6 gap-3">
                  {AVATAR_COLORS.map((c) => {
                    const selected = c === avatarColor;
                    return (
                      <button
                        key={c}
                        onClick={() => setAvatarColor(c)}
                        aria-label={`צבע ${c}`}
                        className="relative aspect-square rounded-2xl border-2 transition-all active:scale-90 cursor-pointer"
                        style={{
                          background: c,
                          borderColor: selected ? "var(--color-on-surface)" : "var(--color-outline)",
                          boxShadow: selected ? "var(--shadow-clay)" : "none",
                        }}
                      >
                        {selected && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Check size={18} className="text-white" strokeWidth={3.5} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: homework theme ── */}
            {step === 1 && (
              <div>
                <h1 className="font-extrabold text-2xl text-on-surface mb-1.5" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  מה מעניין אותך? 🎯
                </h1>
                <p className="font-medium text-on-surface-variant text-sm mb-6 leading-relaxed">
                  נשתמש בזה כדי להתאים לך את שאלות שיעורי הבית. המתמטיקה נשארת — רק הסיפור משתנה!
                </p>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {HOMEWORK_THEMES.map((t) => {
                    const selected = theme === t.id && !customTheme.trim();
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setTheme(t.id); setCustomTheme(""); }}
                        className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 text-center transition-all active:scale-95 cursor-pointer ${
                          selected ? "border-primary bg-primary/10" : "border-outline bg-surface-container hover:border-primary/50"
                        }`}
                        style={{ boxShadow: selected ? "var(--shadow-clay-primary)" : "var(--shadow-clay)", minHeight: 92 }}
                      >
                        {selected && (
                          <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check size={11} className="text-white" strokeWidth={3} />
                          </span>
                        )}
                        <span className="text-3xl leading-none">{t.label.split(" ")[0]}</span>
                        <span className={`font-bold text-xs leading-tight ${selected ? "text-primary" : "text-on-surface"}`}>
                          {t.label.split(" ").slice(1).join(" ")}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Free-text option */}
                <label className="block font-semibold text-sm text-on-surface-variant mb-2">
                  או כתוב נושא משלך:
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  placeholder="למשל: אופנוענים, גינון, אנימה…"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-outline bg-surface text-on-surface font-medium text-sm focus:border-primary focus:outline-none transition-all"
                  style={{ fontFamily: "'Assistant', sans-serif" }}
                />
              </div>
            )}

            {/* ── Step 3: placement quiz ── */}
            {step === 2 && (
              <div>
                <h1 className="font-extrabold text-2xl text-on-surface mb-1.5" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  מבחן קצר 📝
                </h1>
                <p className="font-medium text-on-surface-variant text-sm mb-6 leading-relaxed">
                  3 שאלות שיעזרו לנו להתאים לך את הרמה. אין טעויות כאן — פשוט תענה מה שנראה לך.
                </p>

                {!quiz ? (
                  <ElectricLoader label="טוען שאלות…" />
                ) : quiz.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-on-surface-variant text-sm mb-5">אין כרגע שאלות מבחן זמינות.</p>
                    <button
                      onClick={() => void submit([])}
                      disabled={submitting}
                      className="px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold border-2 border-primary-dark cursor-pointer disabled:opacity-60"
                      style={{ boxShadow: "var(--shadow-clay-primary)" }}
                    >
                      המשך
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="num font-mono text-xs text-on-surface-variant mb-3">
                      שאלה {quizIdx + 1} מתוך {quiz.length}
                    </div>
                    <AnimatePresence mode="wait">
                      {ticking ? (
                        <motion.div
                          key="tick"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-16 gap-3"
                        >
                          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center border-2 border-primary-dark" style={{ boxShadow: "var(--shadow-clay-primary)" }}>
                            <Check size={30} className="text-white" strokeWidth={3} />
                          </div>
                          <span className="font-bold text-primary">נרשם!</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={quizIdx}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          <div
                            className="rounded-2xl border-2 border-outline bg-surface p-5 mb-4 text-on-surface font-semibold leading-relaxed"
                            style={{ boxShadow: "var(--shadow-clay)" }}
                          >
                            <MathText>{quiz[quizIdx].stem}</MathText>
                          </div>
                          <div className="flex flex-col gap-3">
                            {quiz[quizIdx].choices.map((choice, ci) => (
                              <button
                                key={ci}
                                onClick={() => answerQuiz(ci)}
                                disabled={submitting}
                                className="w-full text-right px-4 py-3.5 rounded-2xl border-2 border-outline bg-surface-container hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
                                style={{ boxShadow: "var(--shadow-clay)" }}
                              >
                                <MathText>{choice}</MathText>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav — hidden on the quiz step (answers auto-advance) */}
      {step < 2 && (
        <div className="w-full max-w-[28rem] mt-8 flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => goStep(step - 1)}
              className="px-5 py-3.5 rounded-2xl border-2 border-outline bg-surface text-on-surface-variant font-semibold hover:border-primary transition-all cursor-pointer"
              style={{ boxShadow: "var(--shadow-clay)" }}
            >
              חזרה
            </button>
          )}
          <button
            onClick={() => goStep(step + 1)}
            disabled={!canContinue}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-on-primary font-bold border-2 border-primary-dark transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            המשך
            <ArrowLeft size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
