import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import MathText from "./MathText";
import {
  X, Zap, Send, CheckCircle as CheckCircle2, XCircle, Users,
  Loader as Loader2, Activity,
} from "./electric";

/**
 * Live class mode (שיעור חי) — teacher side.
 * Pick a topic → pick a question → broadcast. Answers stream onto a live
 * histogram (Convex reactivity — no polling). Ending the session reveals the
 * correct answer on the chart.
 */
export default function LiveClassPanel({ classroomId, onClose }: {
  classroomId: Id<"classrooms">;
  onClose: () => void;
}) {
  const active = useQuery(api.live.getActiveForClassroom, { classroomId });
  const [startedId, setStartedId] = useState<Id<"liveSessions"> | null>(null);
  const sessionId = startedId ?? active?.sessionId ?? null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} dir="rtl">
      <div
        className="clay-card w-full max-w-[40rem] max-h-[86vh] overflow-y-auto p-6 bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-error/10 border-2 border-error/30 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
            </span>
            <div>
              <h2 className="font-extrabold text-xl text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>שיעור חי</h2>
              <p className="text-xs text-on-surface-variant">שאלה אחת, כל הכיתה, תוצאות בזמן אמת.</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="סגירה"><X size={16} /></button>
        </div>

        {sessionId ? (
          <LiveResults sessionId={sessionId} onDone={onClose} />
        ) : (
          <QuestionPicker classroomId={classroomId} onStarted={setStartedId} />
        )}
      </div>
    </div>
  );
}

// ── Step 1: choose topic → question ──
function QuestionPicker({ classroomId, onStarted }: {
  classroomId: Id<"classrooms">;
  onStarted: (id: Id<"liveSessions">) => void;
}) {
  const topics = useQuery(api.topics.list);
  const [topicId, setTopicId] = useState<Id<"topics"> | null>(null);
  const questions = useQuery(api.questions.getByTopic, topicId ? { topicId } : "skip");
  const start = useMutation(api.live.start);
  const [starting, setStarting] = useState<string | null>(null);

  const launch = async (questionId: Id<"questions">) => {
    setStarting(questionId);
    try {
      const id = await start({ classroomId, questionId });
      onStarted(id);
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-bold text-on-surface mb-2">נושא</div>
        <div className="flex flex-wrap gap-2">
          {(topics ?? []).map((t) => {
            const on = topicId === t._id;
            return (
              <button key={t._id} onClick={() => setTopicId(t._id)}
                className="px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors cursor-pointer"
                style={{
                  background: on ? "var(--color-primary)" : "var(--color-surface)",
                  borderColor: on ? "var(--color-primary)" : "var(--color-outline)",
                  color: on ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                }}>
                {t.nameHe}
              </button>
            );
          })}
        </div>
      </div>

      {topicId && (
        <div>
          <div className="text-sm font-bold text-on-surface mb-2">בחרו שאלה לשידור</div>
          {questions === undefined ? (
            <div className="flex items-center justify-center py-8 text-on-surface-variant"><Loader2 size={18} className="animate-spin ms-2" /> טוען…</div>
          ) : questions.length === 0 ? (
            <div className="text-sm text-on-surface-variant py-4">אין שאלות בנושא זה.</div>
          ) : (
            <motion.div
              className="flex flex-col gap-2"
              initial="hidden" animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
            >
              {questions.map((q) => (
                <motion.div key={q._id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  className="flex items-center gap-3 p-3 rounded-xl border-2 border-outline bg-surface">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex-shrink-0">רמה {q.difficulty}</span>
                  <span className="flex-1 min-w-0 text-sm text-on-surface truncate"><MathText>{q.stem}</MathText></span>
                  <button
                    className="btn-clay-primary !px-3.5 !py-1.5 !text-xs flex-shrink-0"
                    disabled={starting !== null}
                    onClick={() => launch(q._id)}
                  >
                    {starting === q._id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} שדר לכיתה
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 2: live histogram ──
function LiveResults({ sessionId, onDone }: { sessionId: Id<"liveSessions">; onDone: () => void }) {
  const results = useQuery(api.live.getResults, { sessionId });
  const end = useMutation(api.live.end);

  if (!results) {
    return <div className="flex items-center justify-center py-10 text-on-surface-variant"><Loader2 size={20} className="animate-spin ms-2" /> טוען…</div>;
  }

  const ended = results.status === "ended";
  const maxCount = Math.max(1, ...results.counts);

  return (
    <div className="flex flex-col gap-4">
      {/* Question */}
      <div className="clay-card p-4 bg-surface-container-low">
        <div className="text-base leading-relaxed text-on-surface"><MathText>{results.stem}</MathText></div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-bold text-on-surface"><Users size={15} className="text-primary" /> {results.answered}/{results.total} ענו</span>
        {ended && (
          <span className="flex items-center gap-1.5 font-bold" style={{ color: "var(--color-primary)" }}>
            <CheckCircle2 size={15} /> {results.correct} צדקו
          </span>
        )}
        {!ended && <span className="flex items-center gap-1.5 text-error font-bold text-xs"><span className="w-2 h-2 rounded-full bg-error animate-pulse" /> חי</span>}
      </div>

      {/* Histogram — bars grow live as answers land; the correct bar is revealed on end */}
      <div className="flex flex-col gap-2.5">
        {results.choices.map((choice, i) => {
          const count = results.counts[i];
          const pct = results.answered > 0 ? Math.round((count / results.answered) * 100) : 0;
          const isCorrect = ended && i === results.correctIndex;
          return (
            <div key={i} className="relative rounded-xl border-2 overflow-hidden"
              style={{ borderColor: isCorrect ? "var(--color-primary)" : "var(--color-outline)" }}>
              <motion.div
                className="absolute inset-y-0 start-0"
                initial={false}
                animate={{ width: `${(count / maxCount) * 100}%` }}
                transition={{ type: "spring", stiffness: 160, damping: 26 }}
                style={{ background: isCorrect ? "color-mix(in srgb, var(--color-primary) 25%, transparent)" : "color-mix(in srgb, var(--color-secondary) 14%, transparent)" }}
              />
              <div className="relative flex items-center gap-3 px-4 py-3">
                {isCorrect ? <CheckCircle2 size={16} style={{ color: "var(--color-primary)" }} className="flex-shrink-0" /> : <Activity size={14} className="text-on-surface-variant flex-shrink-0" />}
                <span className="flex-1 min-w-0 text-sm text-on-surface"><MathText>{choice}</MathText></span>
                <span className="num font-extrabold text-sm text-on-surface flex-shrink-0">{count} <span className="text-xs text-on-surface-variant font-semibold">({pct}%)</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Who answered — chips stream in as answers arrive */}
      {results.answeredNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {results.answeredNames.map((s, i) => (
              <motion.span
                key={`${s.name}-${i}`}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs px-2 py-0.5 rounded-full border-2 bg-surface text-on-surface-variant"
                style={{ borderColor: ended ? (s.isCorrect ? "color-mix(in srgb, var(--color-primary) 45%, transparent)" : "color-mix(in srgb, var(--color-error) 40%, transparent)") : "var(--color-outline)" }}
              >
                {s.name}{ended && (s.isCorrect ? " ✓" : " ✗")}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Actions */}
      {!ended ? (
        <button
          className="self-start flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 font-bold text-sm cursor-pointer"
          style={{ background: "var(--color-error)", borderColor: "var(--color-error)", color: "var(--color-on-error)" }}
          onClick={() => end({ sessionId })}
        >
          <XCircle size={15} /> סיים וחשוף תשובה
        </button>
      ) : (
        <button className="btn-clay-primary self-start !px-5 !py-2.5 !text-sm" onClick={onDone}>
          <Zap size={15} /> סגור
        </button>
      )}
    </div>
  );
}
