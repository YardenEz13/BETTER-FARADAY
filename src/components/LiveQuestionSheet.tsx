import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import MathText from "./MathText";
import { fireConfetti } from "../lib/celebrations";
import { X, CheckCircle as CheckCircle2, XCircle, Send, Loader as Loader2 } from "./electric";

/**
 * Live class mode (שיעור חי) — student side.
 * `LiveBanner` shows on the map while the teacher's question is live;
 * the sheet lets the student answer exactly once and gives instant feedback.
 */
export function LiveBanner({ studentId, onJoin }: { studentId: string; onJoin: () => void }) {
  const live = useQuery(api.live.getActiveForStudent, { studentId: studentId as Id<"students"> });
  if (!live) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mb-4 rounded-2xl border-2 px-5 py-3.5 flex items-center gap-3"
      style={{
        borderColor: "color-mix(in srgb, var(--color-error) 45%, var(--color-outline))",
        background: "color-mix(in srgb, var(--color-error) 7%, var(--color-surface))",
        boxShadow: "var(--shadow-clay)",
      }}
      role="alert"
    >
      <span className="w-3 h-3 rounded-full bg-error animate-pulse flex-shrink-0" style={{ boxShadow: "0 0 10px var(--color-error)" }} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-on-surface text-sm">שיעור חי! המורה שידר/ה שאלה לכיתה</div>
        {live.answered && (
          <div className="text-xs text-on-surface-variant mt-0.5">
            ענית {live.wasCorrect ? "נכון ✓" : ""} — ממתינים לשאר הכיתה
          </div>
        )}
      </div>
      {!live.answered && (
        <button className="btn-clay-primary !px-4 !py-2 !text-sm flex-shrink-0" onClick={onJoin}>
          הצטרף עכשיו
        </button>
      )}
    </motion.div>
  );
}

export function LiveQuestionSheet({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const live = useQuery(api.live.getActiveForStudent, { studentId: studentId as Id<"students"> });
  const submit = useMutation(api.live.submitAnswer);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = async () => {
    if (selected === null || !live || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submit({ sessionId: live.sessionId, studentId: studentId as Id<"students">, choiceIndex: selected });
      setResult(res.isCorrect ? "correct" : "wrong");
      if (res.isCorrect) fireConfetti(window.innerWidth / 2, window.innerHeight * 0.4);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "השליחה נכשלה. נסה שוב.";
      setError(msg.replace(/^\[.*?\]\s*/, "").replace(/Uncaught Error:\s*/i, "").trim());
    } finally {
      setBusy(false);
    }
  };

  // Session ended (or none) while the sheet is open
  const ended = live === null;
  const alreadyAnswered = !!live?.answered && result === null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="clay-card w-full max-w-[30rem] max-h-[85vh] overflow-y-auto p-6 bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
            <span className="font-extrabold text-lg text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>שיעור חי</span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="סגירה"><X size={15} /></button>
        </div>

        {ended ? (
          <div className="py-8 text-center text-on-surface-variant text-sm">השיעור החי הסתיים.</div>
        ) : live === undefined ? (
          <div className="flex items-center justify-center py-10 text-on-surface-variant"><Loader2 size={20} className="animate-spin ms-2" /> טוען…</div>
        ) : (
          <>
            <div className="text-base leading-relaxed text-on-surface mb-5"><MathText animateLetters>{live.stem}</MathText></div>

            {result || alreadyAnswered ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                {(result === "correct" || (alreadyAnswered && live.wasCorrect)) ? (
                  <>
                    <CheckCircle2 size={44} style={{ color: "var(--color-primary)" }} />
                    <div className="font-bold text-on-surface">נכון! ⚡</div>
                  </>
                ) : (
                  <>
                    <XCircle size={44} style={{ color: "var(--color-error)" }} />
                    <div className="font-bold text-on-surface">לא הפעם — המורה יראה את הפתרון על הלוח</div>
                  </>
                )}
                <div className="text-xs text-on-surface-variant">ממתינים לשאר הכיתה…</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <AnimatePresence>
                  {live.choices.map((choice, i) => {
                    const on = selected === i;
                    return (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => setSelected(i)}
                        className="w-full text-start px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer"
                        style={{
                          borderColor: on ? "var(--color-primary)" : "var(--color-outline)",
                          background: on ? "color-mix(in srgb, var(--color-primary) 9%, transparent)" : "var(--color-surface)",
                          boxShadow: "var(--shadow-clay)",
                        }}
                      >
                        <span className="text-sm text-on-surface"><MathText>{choice}</MathText></span>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {error && <div className="text-xs font-bold text-error">{error}</div>}

                <button
                  className={`btn-clay-primary mt-2 !py-3 justify-center ${selected === null ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={selected === null || busy}
                  onClick={answer}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} שלח תשובה
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
