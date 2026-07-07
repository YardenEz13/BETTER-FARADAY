import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FileText, Clock, ChevronLeft, Send, Check, X, AlertTriangle,
  Trophy, RotateCcw, Timer, ShieldOff, Sparkles,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeContext";
import MathText from "../components/MathText";

// ── מצב מתכונת — Bagrut exam simulation ──
// Two routes share this file: the lobby (no examId) and the runner (examId).
// No AI tutor, no hints — a serious timed sitting.

export default function ExamMode() {
  const { studentId, examId } = useParams();
  if (examId) {
    return <ExamRunner studentId={studentId as Id<"students">} examId={examId as Id<"examAttempts">} />;
  }
  return <ExamLobby studentId={studentId as Id<"students">} />;
}

const gradeColor = (score: number) =>
  score >= 85 ? "var(--color-primary)" : score >= 55 ? "var(--color-secondary)" : "var(--color-error)";

const fmtDate = (ts: number) =>
  new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(ts);

// ════════════════════════════════════════ LOBBY ════════════════════════════════════════
function ExamLobby({ studentId }: { studentId: Id<"students"> }) {
  const navigate = useNavigate();
  const history = useQuery(api.exams.getExamHistory, { studentId });
  const startExam = useMutation(api.exams.startExam);
  const [count, setCount] = useState<2 | 3>(2);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await startExam({ studentId, questionCount: count });
      navigate(`/student/${studentId}/exam/${res.examId}`);
    } catch (e) {
      setStarting(false);
      alert("לא הצלחנו להתחיל מתכונת — נסו שוב מאוחר יותר.");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-surface px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(`/student/${studentId}`)}
            className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-semibold transition-colors cursor-pointer"
          >
            <ChevronLeft size={20} /> חזרה למפה
          </button>
          <ThemeToggle />
        </div>

        {/* Intro card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-surface border-2 border-outline p-6 md:p-8 mb-6"
          style={{ boxShadow: "var(--shadow-clay)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-secondary/12 border-2 border-secondary/30 flex items-center justify-center"
              style={{ boxShadow: "var(--shadow-clay-secondary, var(--shadow-clay))" }}>
              <FileText size={28} className="text-secondary" />
            </div>
            <div>
              <h1 className="font-bold text-2xl md:text-3xl" style={{ fontFamily: "'Assistant', sans-serif" }}>מצב מתכונת</h1>
              <p className="text-on-surface-variant font-medium text-sm">סימולציה של בחינת בגרות בתנאי אמת</p>
            </div>
          </div>

          <div className="grid gap-3 mb-6">
            <Rule icon={<Timer size={18} />} text="שעון עצר: 30 דקות לכל שאלה. כשהזמן נגמר — המתכונת מוגשת אוטומטית." />
            <Rule icon={<ShieldOff size={18} />} text="אין מורה AI ואין רמזים. אתם לבד, בדיוק כמו בבגרות." />
            <Rule icon={<Check size={18} />} text="בסיום — פירוק ניקוד מלא לכל סעיף, פתרונות מלאים, וניקוד סופי." />
          </div>

          {/* Question count */}
          <div className="mb-6">
            <div className="label-mono text-xs text-on-surface-variant mb-2">כמה שאלות?</div>
            <div className="flex gap-3">
              {([2, 3] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 rounded-2xl border-2 py-4 font-bold transition-all cursor-pointer ${
                    count === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline bg-surface hover:border-primary/50"
                  }`}
                  style={count === n ? { boxShadow: "var(--shadow-clay-primary)" } : undefined}
                >
                  <div className="text-2xl">{n} שאלות</div>
                  <div className="label-mono text-xs opacity-70 mt-1">{n * 30} דקות</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full rounded-full bg-primary text-on-primary border-2 border-primary-dark font-bold text-lg py-4 transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            {starting ? "מכינים מתכונת…" : "התחל מתכונת 📝"}
          </button>
        </motion.div>

        {/* History */}
        {history && history.length > 0 && (
          <div className="rounded-3xl bg-surface border-2 border-outline p-5 md:p-6" style={{ boxShadow: "var(--shadow-clay)" }}>
            <h2 className="font-bold text-lg mb-4">מתכונות קודמות</h2>
            <div className="flex flex-col gap-2">
              {history.map((h) => (
                <button
                  key={h.examId}
                  onClick={() => navigate(`/student/${studentId}/exam/${h.examId}`)}
                  className="flex items-center justify-between rounded-2xl border-2 border-outline bg-surface px-4 py-3 hover:border-primary/50 transition-all cursor-pointer text-start"
                >
                  <div className="flex items-center gap-3">
                    <span className="label-mono text-xs text-on-surface-variant">{fmtDate(h.startedAt)}</span>
                    <span className="text-sm font-semibold">{h.questionCount} שאלות</span>
                    {h.status === "in_progress" && (
                      <span className="label-mono text-xs px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary">בתהליך</span>
                    )}
                    {h.status === "expired" && (
                      <span className="label-mono text-xs px-2 py-0.5 rounded-full bg-error/15 text-error">פג זמן</span>
                    )}
                  </div>
                  {h.finalScore !== null ? (
                    <span className="num font-bold text-lg" style={{ color: gradeColor(h.finalScore) }}>{h.finalScore}</span>
                  ) : (
                    <span className="label-mono text-xs text-on-surface-variant">—</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-outline bg-surface-container-low/40 px-4 py-3">
      <span className="text-secondary shrink-0 mt-0.5">{icon}</span>
      <span className="text-sm font-medium leading-relaxed text-on-surface">{text}</span>
    </div>
  );
}

// ════════════════════════════════════════ RUNNER ════════════════════════════════════════
type StrippedSection = {
  label: string; prompt: string; dependsOn?: string[]; answerType: string;
  points: number; skillsTested: string[];
  proofMeta?: { given: string; toProve: string; diagramDescription?: string; diagramSvg?: string };
};

function ExamRunner({ studentId, examId }: { studentId: Id<"students">; examId: Id<"examAttempts"> }) {
  const navigate = useNavigate();
  const data = useQuery(api.exams.getExam, { examId });
  const submitSection = useMutation(api.exams.submitExamSection);
  const finishExam = useMutation(api.exams.finishExam);

  if (data === undefined) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background text-on-surface">טוען מתכונת…</div>;
  }
  if (data === null) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center bg-background text-on-surface gap-4">
        <p>המתכונת לא נמצאה.</p>
        <button onClick={() => navigate(`/student/${studentId}/exam`)} className="text-primary font-semibold underline cursor-pointer">חזרה</button>
      </div>
    );
  }

  const done = data.attempt.status !== "in_progress";
  if (done) {
    return <ExamResults studentId={studentId} examId={examId} data={data} />;
  }
  return <ExamActive studentId={studentId} examId={examId} data={data} submitSection={submitSection} finishExam={finishExam} />;
}

// ── Active exam (timer + answering) ──
function ExamActive({
  studentId, examId, data, submitSection, finishExam,
}: {
  studentId: Id<"students">;
  examId: Id<"examAttempts">;
  data: NonNullable<ReturnType<typeof useQuery<typeof api.exams.getExam>>>;
  submitSection: ReturnType<typeof useMutation<typeof api.exams.submitExamSection>>;
  finishExam: ReturnType<typeof useMutation<typeof api.exams.finishExam>>;
}) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { attempt, questions } = data;
  const [activeQ, setActiveQ] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const finishedRef = useRef(false);

  // Local answer buffer keyed by "qId::section", seeded from server state.
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const pq of attempt.perQuestion) {
      for (const sr of pq.sectionResults) {
        seed[`${pq.compoundQuestionId}::${sr.sectionLabel}`] = sr.studentAnswer;
      }
    }
    return seed;
  });

  // ── Countdown ──
  const deadline = attempt.startedAt + attempt.durationMinutes * 60 * 1000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remainingMs = Math.max(0, deadline - now);
  const mm = Math.floor(remainingMs / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);
  const warn = remainingMs < 10 * 60 * 1000;
  const danger = remainingMs < 2 * 60 * 1000;

  const doFinish = useCallback(async (expired: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    await finishExam({ examId, expired });
    // Results render reactively from getExam; no navigation needed.
  }, [examId, finishExam]);

  // Auto-submit on expiry.
  useEffect(() => {
    if (remainingMs <= 0 && !finishedRef.current) {
      void doFinish(true);
    }
  }, [remainingMs, doFinish]);

  // Debounced per-section save.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleChange = (qId: string, label: string, value: string) => {
    const key = `${qId}::${label}`;
    setLocal((p) => ({ ...p, [key]: value }));
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      void submitSection({ examId, compoundQuestionId: qId as Id<"compoundQuestions">, sectionLabel: label, answer: value });
    }, 700);
  };
  const handleBlur = (qId: string, label: string, value: string) => {
    const key = `${qId}::${label}`;
    clearTimeout(saveTimers.current[key]);
    void submitSection({ examId, compoundQuestionId: qId as Id<"compoundQuestions">, sectionLabel: label, answer: value });
  };

  const q = questions[activeQ] as { _id: string; preamble: string; preambleParams: { symbol: string; displayHe: string; type: string }[]; sections: StrippedSection[]; difficulty: number; tags: string[] };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-surface">
      {/* Header + timer */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-md border-b-2 border-outline">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-secondary" />
            <span className="font-bold">מתכונת</span>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 border-2 font-bold num tabular-nums ${
              danger ? "border-error text-error" : warn ? "border-tertiary text-tertiary" : "border-outline text-on-surface"
            }`}
            style={danger && !reduce ? { animation: "pulse 1s ease-in-out infinite" } : undefined}
          >
            <Clock size={16} />
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            className="rounded-full bg-primary text-on-primary border-2 border-primary-dark font-semibold px-4 py-1.5 text-sm transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            הגש מבחן
          </button>
        </div>

        {/* Question tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex gap-2">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveQ(i)}
              className={`flex-1 rounded-xl border-2 py-2 font-bold text-sm transition-all cursor-pointer ${
                activeQ === i ? "border-primary bg-primary/10 text-primary" : "border-outline bg-surface hover:border-primary/40"
              }`}
            >
              שאלה {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div key={activeQ} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Preamble */}
          <div className="rounded-3xl bg-surface border-2 border-outline p-6 mb-5" style={{ boxShadow: "var(--shadow-clay)" }}>
            <div className="flex flex-wrap gap-2 mb-4">
              {q.tags.map((t) => (
                <span key={t} className="label-mono text-xs px-2 py-0.5 rounded-full bg-surface-container-low border border-outline">{t}</span>
              ))}
            </div>
            <div className="text-lg leading-relaxed"><MathText>{q.preamble}</MathText></div>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-4">
            {q.sections.map((s) => {
              const key = `${q._id}::${s.label}`;
              const val = local[key] ?? "";
              const isProof = s.answerType === "proof";
              return (
                <div key={s.label} className="rounded-3xl bg-surface border-2 border-outline p-5" style={{ boxShadow: "var(--shadow-clay)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg border-2 border-primary/50 text-primary bg-primary/10 flex items-center justify-center font-bold">{s.label}</div>
                      <span className="label-mono text-xs text-on-surface-variant">{s.points} נק׳</span>
                    </div>
                    <div className="hidden sm:flex gap-1">
                      {s.skillsTested.slice(0, 2).map((sk) => (
                        <span key={sk} className="label-mono text-[10px] px-2 py-0.5 rounded-full bg-surface-container-low border border-outline">{sk}</span>
                      ))}
                    </div>
                  </div>

                  <div className="text-base leading-relaxed mb-4"><MathText>{s.prompt}</MathText></div>

                  {isProof && s.proofMeta && (
                    <div className="rounded-2xl border border-outline bg-surface-container-low/40 p-4 mb-4 flex flex-col gap-2 text-sm">
                      <div><span className="font-bold text-secondary">נתון: </span><MathText>{s.proofMeta.given}</MathText></div>
                      <div><span className="font-bold text-secondary">להוכיח: </span><MathText>{s.proofMeta.toProve}</MathText></div>
                      {s.proofMeta.diagramSvg && (
                        <div className="flex justify-center py-2" dangerouslySetInnerHTML={{ __html: s.proofMeta.diagramSvg }} />
                      )}
                    </div>
                  )}

                  <textarea
                    dir="rtl"
                    rows={isProof ? 5 : 2}
                    value={val}
                    onChange={(e) => handleChange(q._id, s.label, e.target.value)}
                    onBlur={(e) => handleBlur(q._id, s.label, e.target.value)}
                    placeholder={isProof ? "כתבו כאן את מהלך ההוכחה…" : "התשובה שלכם…"}
                    className="w-full bg-surface border-2 border-outline rounded-2xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Confirm submit */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              className="rounded-3xl bg-surface border-2 border-outline p-6 max-w-[24rem] w-full text-center"
              style={{ boxShadow: "var(--shadow-clay)" }}
              initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-error/12 border-2 border-error/30 flex items-center justify-center mb-4">
                <AlertTriangle size={28} className="text-error" />
              </div>
              <h3 className="font-bold text-xl mb-2">בטוח שברצונך להגיש?</h3>
              <p className="text-on-surface-variant text-sm mb-6">אי אפשר לחזור אחרי ההגשה. המתכונת תיבדק ותקבלו ניקוד סופי.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 rounded-full border-2 border-outline bg-surface font-semibold py-3 cursor-pointer">ביטול</button>
                <button
                  onClick={() => { setConfirmOpen(false); void doFinishManual(); }}
                  className="flex-1 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-bold py-3 cursor-pointer"
                  style={{ boxShadow: "var(--shadow-clay-primary)" }}
                >
                  הגש
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  async function doFinishManual() {
    // Flush any pending debounced saves before grading.
    for (const t of Object.values(saveTimers.current)) clearTimeout(t);
    await doFinish(false);
  }
}

// ── Results screen ──
function ExamResults({
  studentId, examId, data,
}: {
  studentId: Id<"students">;
  examId: Id<"examAttempts">;
  data: NonNullable<ReturnType<typeof useQuery<typeof api.exams.getExam>>>;
}) {
  const navigate = useNavigate();
  const selfGrade = useMutation(api.exams.selfGradeSection);
  const { attempt, questions } = data;
  const score = attempt.finalScore ?? 0;
  const color = gradeColor(score);
  const xpAward = Math.round(score / 2);

  // Map fully-detailed questions by id.
  const qById = new Map(questions.map((q) => [q._id.toString(), q as any]));

  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-surface px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <span className="font-bold text-lg">תוצאות מתכונת</span>
          <ThemeToggle />
        </div>

        {/* Score ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-surface border-2 border-outline p-8 mb-6 flex flex-col items-center text-center"
          style={{ boxShadow: "var(--shadow-clay)" }}
        >
          {attempt.status === "expired" && (
            <span className="label-mono text-xs px-3 py-1 rounded-full bg-error/15 text-error mb-4">הזמן נגמר — הוגש אוטומטית</span>
          )}
          <div
            className="w-40 h-40 rounded-full flex items-center justify-center mb-4"
            style={{ border: `10px solid ${color}`, boxShadow: "var(--shadow-clay)" }}
          >
            <span className="num font-bold text-5xl" style={{ color }}>{score}</span>
          </div>
          <div className="label-mono text-on-surface-variant">ציון מתכונת</div>
          <div className="mt-3 flex items-center gap-2 rounded-full bg-tertiary/12 border-2 border-tertiary/30 px-4 py-1.5">
            <Sparkles size={16} className="text-tertiary" />
            <span className="font-semibold text-sm text-tertiary">+{xpAward} XP</span>
          </div>
        </motion.div>

        {/* Per-question breakdown */}
        {attempt.perQuestion.map((pq, qi) => {
          const q = qById.get(pq.compoundQuestionId.toString());
          return (
            <div key={pq.compoundQuestionId} className="rounded-3xl bg-surface border-2 border-outline p-5 md:p-6 mb-5" style={{ boxShadow: "var(--shadow-clay)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">שאלה {qi + 1}</h3>
                <span className="num font-bold" style={{ color: gradeColor(Math.round((100 * pq.totalEarned) / Math.max(1, pq.totalPossible))) }}>
                  {pq.totalEarned}/{pq.totalPossible}
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {pq.sectionResults.map((sr) => {
                  const section = q?.sections?.find((s: any) => s.label === sr.sectionLabel);
                  const selfCheck = sr.needsSelfCheck && !sr.selfGraded;
                  return (
                    <div key={sr.sectionLabel} className="rounded-2xl border-2 border-outline bg-surface-container-low/30 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg border-2 border-outline flex items-center justify-center font-bold text-sm">{sr.sectionLabel}</span>
                          {sr.isCorrect === true && <span className="label-mono text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1"><Check size={12} /> נכון</span>}
                          {sr.isCorrect === false && !sr.needsSelfCheck && <span className="label-mono text-xs px-2 py-0.5 rounded-full bg-error/15 text-error flex items-center gap-1"><X size={12} /> שגוי</span>}
                          {sr.needsSelfCheck && <span className="label-mono text-xs px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary">בדיקה עצמית</span>}
                        </div>
                        <span className="num text-sm font-bold text-on-surface-variant">
                          {sr.pointsEarned ?? 0}/{sr.pointsPossible}
                        </span>
                      </div>

                      {sr.studentAnswer && (
                        <div className="text-sm mb-2">
                          <span className="text-on-surface-variant">התשובה שלך: </span>
                          <span className="font-medium"><MathText>{sr.studentAnswer}</MathText></span>
                        </div>
                      )}

                      {section && (
                        <>
                          <div className="text-sm mb-2">
                            <span className="text-on-surface-variant">תשובה נכונה: </span>
                            <span className="font-bold text-primary"><MathText>{section.correctAnswer}</MathText></span>
                          </div>
                          {section.solutionSteps?.length > 0 && (
                            <details className="mt-2">
                              <summary className="label-mono text-xs text-secondary cursor-pointer">הצג פתרון מלא</summary>
                              <div className="flex flex-col gap-2 mt-2">
                                {section.solutionSteps.map((step: string, i: number) => (
                                  <div key={i} className="flex gap-2 items-start text-sm">
                                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                                    <span className="leading-relaxed"><MathText>{step}</MathText></span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </>
                      )}

                      {/* Self-grade buttons */}
                      {selfCheck && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => void selfGrade({ examId, compoundQuestionId: pq.compoundQuestionId, sectionLabel: sr.sectionLabel, correct: true })}
                            className="flex-1 rounded-full border-2 border-primary/40 bg-primary/10 text-primary font-semibold py-2 text-sm cursor-pointer hover:border-primary transition-colors"
                          >
                            צדקתי ✓
                          </button>
                          <button
                            onClick={() => void selfGrade({ examId, compoundQuestionId: pq.compoundQuestionId, sectionLabel: sr.sectionLabel, correct: false })}
                            className="flex-1 rounded-full border-2 border-error/40 bg-error/10 text-error font-semibold py-2 text-sm cursor-pointer hover:border-error transition-colors"
                          >
                            טעיתי ✗
                          </button>
                        </div>
                      )}
                      {sr.selfGraded && (
                        <div className="label-mono text-xs text-on-surface-variant mt-2">✔ נבדק עצמית</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={() => navigate(`/student/${studentId}/exam`)}
            className="flex-1 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-bold py-3 flex items-center justify-center gap-2 cursor-pointer"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            <RotateCcw size={18} /> מתכונת חדשה
          </button>
          <button
            onClick={() => navigate(`/student/${studentId}`)}
            className="flex-1 rounded-full border-2 border-outline bg-surface font-semibold py-3 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trophy size={18} /> חזרה למפה
          </button>
        </div>
      </div>
    </div>
  );
}
