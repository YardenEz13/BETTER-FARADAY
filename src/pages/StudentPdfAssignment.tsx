import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, FileText, CheckCircle2, XCircle, Loader2, Send,
  ExternalLink, Scissors, Trophy,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeContext";
import { ElectricLoader } from "../components/electric";

export default function StudentPdfAssignment() {
  const { studentId, assignmentId } = useParams<{ studentId: string; assignmentId: string }>();
  const navigate = useNavigate();

  const data = useQuery(api.pdfAssignments.getAssignment, {
    assignmentId: assignmentId as Id<"pdfAssignments">,
  });
  const submit = useMutation(api.pdfAssignments.submitPdfAnswer);

  // Per-part local input + in-flight state. Keyed by `${questionId}:${partIndex}`.
  // Persisted answers come from the query.
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (data === undefined) return <ElectricLoader label="טוען מטלה…" />;
  if (data === null) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-on-background">
        <FileText size={48} className="text-on-surface-variant opacity-50" />
        <div className="font-bold text-lg">המטלה לא נמצאה</div>
        <button className="btn btn-primary px-6 py-2.5" onClick={() => navigate(`/student/${studentId}/homework`)}>חזרה</button>
      </div>
    );
  }

  const questions = data.questions;
  const allParts = questions.flatMap((q) => q.parts);
  const total = allParts.length;
  const answered = allParts.filter((p) => p.studentAnswer != null).length;
  const correct = allParts.filter((p) => p.isCorrect === true).length;
  const allDone = total > 0 && answered === total;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const handleSubmit = async (qId: Id<"pdfQuestions">, partIndex: number, raw: string) => {
    const val = raw.trim();
    if (!val) return;
    const key = `${qId}:${partIndex}`;
    setBusyKey(key);
    try {
      await submit({ questionId: qId, partIndex, studentAnswer: val });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col" style={{ fontFamily: "'Assistant', sans-serif" }} dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b-2 border-outline px-4 md:px-8 py-4 flex items-center justify-between" style={{ boxShadow: "var(--shadow-clay)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="w-9 h-9 rounded-full border-2 border-outline bg-surface flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all flex-shrink-0"
            style={{ boxShadow: "var(--shadow-clay)" }}
            onClick={() => navigate(`/student/${studentId}/homework`)} aria-label="חזרה"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-lg text-on-surface leading-tight flex items-center gap-2 truncate">
              <Scissors size={16} className="text-secondary flex-shrink-0" /> {data.title}
            </h1>
            <p className="text-xs text-on-surface-variant">מטלה אישית · בדיקה מיידית</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {data.pdfUrl && (
            <a href={data.pdfUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-surface rounded-full border-2 border-outline text-sm font-semibold text-on-surface hover:border-primary hover:text-primary transition-all"
              style={{ boxShadow: "var(--shadow-clay)" }}>
              <ExternalLink size={15} /> <span className="hidden sm:inline">חוברת מלאה</span>
            </a>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-[860px] w-full mx-auto px-4 md:px-8 py-6 flex flex-col gap-5 flex-1">
        {/* Progress summary */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl p-5 border-2 border-outline flex items-center gap-5" style={{ boxShadow: "var(--shadow-clay)" }}>
          <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 64, height: 64 }}>
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-surface-container-high)" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-primary)" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${total > 0 ? (answered / total) * 97.4 : 0} 97.4`} />
            </svg>
            <span className="num absolute font-extrabold text-sm text-primary">{answered}/{total}</span>
          </div>
          <div className="flex-1">
            <div className="font-bold text-on-surface">{allDone ? "סיימת את המטלה! 🎉" : "עוד קצת ואתה שם"}</div>
            <div className="text-sm text-on-surface-variant mt-0.5 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-primary" /> {correct} נכונות</span>
              {answered - correct > 0 && <span className="flex items-center gap-1"><XCircle size={14} className="text-error" /> {answered - correct} שגויות</span>}
            </div>
          </div>
          {answered > 0 && (
            <div className="flex flex-col items-center px-3.5 py-1.5 rounded-xl flex-shrink-0"
              style={{ background: scorePercent >= 70 ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : scorePercent >= 40 ? "color-mix(in srgb, var(--color-tertiary) 14%, transparent)" : "color-mix(in srgb, var(--color-error) 12%, transparent)" }}>
              <span className="num font-black text-2xl leading-none"
                style={{ color: scorePercent >= 70 ? "var(--color-primary)" : scorePercent >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}>{scorePercent}%</span>
              <span className="text-[10px] font-bold text-on-surface-variant mt-0.5">ציון</span>
            </div>
          )}
          {allDone && <Trophy size={26} className="text-tertiary flex-shrink-0" />}
        </motion.div>

        {total === 0 && (
          <div className="bg-surface rounded-2xl p-12 text-center border-2 border-outline text-on-surface-variant" style={{ boxShadow: "var(--shadow-clay)" }}>
            אין שאלות במטלה זו עדיין.
          </div>
        )}

        {/* Questions */}
        {questions.map((q, i) => {
          const multiPart = q.parts.length > 1;
          const qAnswered = q.parts.filter((p) => p.studentAnswer != null).length;
          const qCorrect = q.parts.filter((p) => p.isCorrect === true).length;
          const qDone = qAnswered === q.parts.length;
          const headColor = !qDone ? "var(--color-outline)"
            : qCorrect === q.parts.length ? "var(--color-primary)" : "var(--color-error)";
          return (
            <motion.div key={q._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.4) }}
              className="bg-surface rounded-2xl border-2 overflow-hidden"
              style={{ borderColor: headColor, boxShadow: "var(--shadow-clay)" }}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-outline bg-surface-container-low">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
                <span className="font-bold text-sm text-on-surface">שאלה {i + 1}</span>
                {multiPart && <span className="text-xs text-on-surface-variant">· {q.parts.length} סעיפים</span>}
                {qDone && (
                  <span className={`ms-auto inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${qCorrect === q.parts.length ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"}`}>
                    <CheckCircle2 size={13} /> {qCorrect}/{q.parts.length}
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3">
                {/* Question image (shared across all parts) */}
                <img src={`data:${q.imageMimeType};base64,${q.imageBase64}`} alt={`שאלה ${i + 1}`}
                  className="w-full rounded-xl border-2 border-outline bg-white" />

                {/* One answer row per part */}
                {q.parts.map((part, pIdx) => {
                  const key = `${q._id}:${pIdx}`;
                  const submitted = part.studentAnswer != null;
                  const isCorrect = part.isCorrect === true;
                  const value = inputs[key] ?? part.studentAnswer ?? "";
                  const busy = busyKey === key;
                  return (
                    <div key={pIdx} className="flex flex-col gap-1.5">
                      <div className="flex gap-2 items-stretch">
                        {multiPart && (
                          <span className="w-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container font-black text-base">
                            {part.label}
                          </span>
                        )}
                        <input
                          value={value}
                          disabled={busy}
                          onChange={(e) => setInputs((m) => ({ ...m, [key]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(q._id, pIdx, value); }}
                          dir="rtl"
                          placeholder={multiPart ? `תשובת סעיף ${part.label}…` : "כתוב את התשובה שלך כאן…"}
                          className="flex-1 min-w-0 bg-surface-container border-2 rounded-xl px-4 py-2.5 text-on-surface focus:outline-none transition-colors"
                          style={{ borderColor: submitted ? (isCorrect ? "var(--color-primary)" : "var(--color-error)") : "var(--color-outline)" }}
                        />
                        <button
                          onClick={() => handleSubmit(q._id, pIdx, value)}
                          disabled={busy || !value.trim()}
                          className="flex items-center gap-1.5 px-5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-bold transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                        >
                          {busy ? <Loader2 size={16} className="animate-spin" /> : submitted ? <CheckCircle2 size={16} /> : <Send size={16} />}
                          <span className="hidden sm:inline">{submitted ? "בדוק שוב" : "בדוק"}</span>
                        </button>
                      </div>
                      {submitted && !isCorrect && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-xs text-error" style={{ marginInlineStart: multiPart ? 44 : 0 }}>
                          <XCircle size={14} className="flex-shrink-0" />
                          לא נכון. התשובה הנכונה: <strong className="font-bold">{part.correctAnswer}</strong>
                        </div>
                      )}
                      {submitted && isCorrect && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary" style={{ marginInlineStart: multiPart ? 44 : 0 }}>
                          <CheckCircle2 size={14} className="flex-shrink-0" /> כל הכבוד! תשובה נכונה.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
