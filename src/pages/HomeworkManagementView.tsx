import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, Send, Calendar, Clock, XCircle, BarChart2, Users, AlertTriangle } from "lucide-react";

export function HomeworkManagementView({ classroomId }: { classroomId: Id<"classrooms"> | null }) {
  const topics = useQuery(api.topics.list);
  const homeworkList = useQuery(
    api.homework.getHomeworkForClassroom,
    classroomId ? { classroomId } : "skip"
  );
  const createHomework = useMutation(api.homework.createHomework);
  const closeHomework = useMutation(api.homework.closeHomework);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Id<"topics">[]>([]);
  const [teacherNotes, setTeacherNotes] = useState("");
  const [questionCount, setQuestionCount] = useState(4);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [creating, setCreating] = useState(false);
  const [selectedHwId, setSelectedHwId] = useState<Id<"homework"> | null>(null);

  const rundown = useQuery(
    api.homeworkRundown.getRundown,
    selectedHwId ? { homeworkId: selectedHwId } : "skip"
  );

  const handleCreate = async () => {
    if (!classroomId || !title.trim() || selectedTopics.length === 0) return;
    setCreating(true);
    await createHomework({
      classroomId,
      title: title.trim(),
      topicIds: selectedTopics,
      teacherNotes: teacherNotes.trim() || undefined,
      questionCount,
      deadline: Date.now() + deadlineDays * 24 * 60 * 60 * 1000,
    });
    setTitle(""); setSelectedTopics([]); setTeacherNotes("");
    setQuestionCount(4); setDeadlineDays(3);
    setShowCreate(false); setCreating(false);
  };

  const handleClose = async (hwId: Id<"homework">) => {
    await closeHomework({ homeworkId: hwId });
  };

  const toggleTopic = (id: Id<"topics">) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("he-IL", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });

  return (
    <div className="flex w-full h-full gap-8 p-8 overflow-hidden">
      {/* Left/Center: Main Content - Expansive */}
      <div className="flex-1 flex-col overflow-y-auto pr-4 pb-20">
        <div className="mb-12">
          <h1 className="t-h1 mb-6 text-[var(--color-accent)] font-black text-6xl leading-tight" style={{ textShadow: "0 0 20px var(--color-accent)" }}>
            <FileText size={56} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 20 }} className="text-[var(--color-primary)]" />
            ניהול שיעורי בית
          </h1>
          <p className="text-[var(--color-primary)] text-2xl opacity-80 max-w-4xl leading-relaxed">
            צרו שיעורי בית מותאמים אישית — המערכת מתאימה את רמת הקושי לכל תלמיד לפי מפת הכוח שלו באסתטיקה סייברפאנקית.
          </p>
        </div>

        {/* Create button */}
        <button
          className="btn btn-primary mb-10 w-fit text-xl px-10 py-5 flex items-center gap-4 shadow-[0_0_20px_var(--color-primary)]"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={28} /> צור שיעורי בית חדשים
        </button>

        {/* Creation Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              className="mb-12 w-full"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-10 w-full shadow-[0_0_30px_rgba(0,255,136,0.1)] relative">
                <div className="absolute top-0 right-0 w-2 h-full bg-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]"></div>
                <div className="t-mini-title text-[var(--color-accent)] mb-8 text-3xl border-b border-[rgba(0,255,255,0.2)] pb-4 inline-block">ממשק יצירת שיעורי בית</div>

                {/* Title */}
                <div className="mb-8">
                  <label className="label-mono text-[var(--color-primary)] block mb-4 text-xl">כותרת המטלה</label>
                  <input
                    className="w-full bg-[var(--bg-surface)] border border-[var(--color-primary)] text-[var(--color-accent)] p-5 text-xl focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_20px_var(--color-accent)] transition-all font-bold placeholder:opacity-50"
                    type="text"
                    placeholder="לדוגמה: חזרה על חדו״א — נקודות קיצון"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    dir="rtl"
                  />
                </div>

                {/* Topics */}
                <div className="mb-8">
                  <label className="label-mono text-[var(--color-primary)] block mb-4 text-xl">נושאים לכיסוי</label>
                  <div className="flex gap-6 flex-wrap">
                    {topics?.map((topic) => (
                      <button
                        key={topic._id}
                        className={`px-6 py-3 border transition-all text-lg font-bold ${selectedTopics.includes(topic._id) ? 'bg-[rgba(0,255,136,0.2)] border-[var(--color-primary)] text-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]' : 'bg-[var(--bg-surface)] border-[rgba(0,255,136,0.3)] text-[var(--color-primary)] opacity-70 hover:opacity-100 hover:border-[var(--color-accent)] hover:shadow-[0_0_10px_var(--color-accent)]'}`}
                        onClick={() => toggleTopic(topic._id)}
                      >
                        {topic.nameHe}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Settings row */}
                <div className="flex gap-10 mb-8">
                  <div className="flex-1 bg-[rgba(0,0,0,0.3)] p-6 border border-[rgba(0,255,255,0.2)]">
                    <label className="label-mono text-[var(--color-accent)] block mb-5 text-xl">שאלות לתלמיד</label>
                    <div className="flex gap-6">
                      {[2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          className={`w-16 h-16 flex items-center justify-center border text-2xl font-black transition-all ${questionCount === n ? 'bg-[rgba(0,255,255,0.2)] border-[var(--color-accent)] text-[var(--color-accent)] shadow-[0_0_20px_var(--color-accent)]' : 'bg-[var(--bg-surface)] border-[rgba(0,255,255,0.3)] text-[var(--color-accent)] opacity-70 hover:opacity-100 hover:border-[var(--color-primary)]'}`}
                          onClick={() => setQuestionCount(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-[rgba(0,0,0,0.3)] p-6 border border-[rgba(0,255,255,0.2)]">
                    <label className="label-mono text-[var(--color-accent)] block mb-5 text-xl">מועד הגשה (ימים)</label>
                    <div className="flex gap-6">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button
                          key={d}
                          className={`w-16 h-16 flex items-center justify-center border text-2xl font-black transition-all ${deadlineDays === d ? 'bg-[rgba(0,255,255,0.2)] border-[var(--color-accent)] text-[var(--color-accent)] shadow-[0_0_20px_var(--color-accent)]' : 'bg-[var(--bg-surface)] border-[rgba(0,255,255,0.3)] text-[var(--color-accent)] opacity-70 hover:opacity-100 hover:border-[var(--color-primary)]'}`}
                          onClick={() => setDeadlineDays(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Teacher notes */}
                <div className="mb-10">
                  <label className="label-mono text-[var(--color-primary)] block mb-4 text-xl">הערות למערכת (אופציונלי)</label>
                  <textarea
                    className="w-full bg-[var(--bg-surface)] border border-[var(--color-primary)] text-[var(--color-accent)] p-5 text-xl focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_20px_var(--color-accent)] transition-all placeholder:opacity-50"
                    placeholder="לדוגמה: התמקדו בשאלות פרמטר... (הנחיות אלו ישמשו את המנוע בהרכבת השאלות)"
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    rows={3}
                    dir="rtl"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-6">
                  <button
                    className="btn btn-primary flex items-center gap-3 px-10 py-4 text-xl font-bold shadow-[0_0_20px_var(--color-primary)]"
                    onClick={handleCreate}
                    disabled={creating || !title.trim() || selectedTopics.length === 0}
                    style={{ opacity: (creating || !title.trim() || selectedTopics.length === 0) ? 0.5 : 1 }}
                  >
                    <Send size={24} /> {creating ? 'מפעיל שגרה...' : 'הפעל וצור מטלות אישיות'}
                  </button>
                  <button className="px-10 py-4 border-2 border-[rgba(255,50,50,0.5)] text-[var(--danger)] hover:bg-[rgba(255,50,50,0.1)] hover:shadow-[0_0_20px_var(--danger)] transition-all font-bold text-xl" onClick={() => setShowCreate(false)}>
                    ביטול פעולה
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Homework list */}
        <div className="t-mini-title text-[var(--color-accent)] mb-8 text-3xl border-b border-[rgba(0,255,255,0.2)] pb-4 inline-block">מטלות פעילות וארכיון</div>
        <motion.div
          className="flex-col gap-6 w-full"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
        >
          {!homeworkList || homeworkList.length === 0 ? (
            <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-16 text-center text-[var(--color-primary)] opacity-60 w-full">
              <FileText size={80} className="mx-auto mb-6" style={{ filter: "drop-shadow(0 0 15px currentColor)" }} />
              <div className="font-black text-4xl mb-4" style={{ textShadow: "0 0 10px currentColor" }}>אין מטלות במערכת</div>
              <div className="text-2xl">לחצו על "צור שיעורי בית חדשים" כדי להריץ שגרה חדשה.</div>
            </div>
          ) : (
            homeworkList.map((hw) => {
              const isExpired = Date.now() > hw.deadline;
              const statusColor = hw.status === 'graded' ? 'var(--color-primary)' : hw.status === 'closed' ? 'gray' : isExpired ? 'var(--danger)' : 'var(--color-accent)';
              const statusLabel = hw.status === 'graded' ? 'הוערך' : hw.status === 'closed' ? 'נסגר' : isExpired ? 'עבר מועד' : 'פעיל';

              return (
                <motion.div
                  key={hw._id}
                  className={`shard bg-[var(--color-primary-muted)] p-8 cursor-pointer border-2 transition-all w-full relative overflow-hidden ${selectedHwId === hw._id ? 'border-[var(--color-accent)] shadow-[0_0_30px_rgba(0,255,255,0.2)]' : 'border-[rgba(0,255,136,0.3)] hover:border-[var(--color-primary)] hover:shadow-[0_0_20px_rgba(0,255,136,0.1)]'}`}
                  onClick={() => setSelectedHwId(selectedHwId === hw._id ? null : hw._id)}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                >
                  {selectedHwId === hw._id && (
                    <div className="absolute top-0 right-0 w-3 h-full bg-[var(--color-accent)] shadow-[0_0_20px_var(--color-accent)]"></div>
                  )}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-8">
                      <div className="flex items-center justify-center w-20 h-20 bg-[var(--bg-surface)] border border-[rgba(255,255,255,0.1)] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                        <FileText size={40} style={{ color: statusColor, filter: `drop-shadow(0 0 10px ${statusColor})` }} />
                      </div>
                      <div>
                        <div className="font-black text-3xl text-[var(--color-primary)] mb-3" style={{ textShadow: "0 0 15px rgba(0,255,136,0.4)" }}>{hw.title}</div>
                        <div className="label-mono text-[var(--color-accent)] opacity-90 flex items-center gap-8 text-lg bg-[rgba(0,0,0,0.3)] p-2 px-4 border border-[rgba(0,255,255,0.2)]">
                          <span className="flex items-center gap-2"><Calendar size={18} /> נוצר: {formatDate(hw.createdAt)}</span>
                          <span className="flex items-center gap-2"><Clock size={18} /> מועד: {formatDate(hw.deadline)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <span className="px-6 py-2 text-lg font-black border-2 shadow-[0_0_15px_currentColor]" style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor, borderColor: statusColor }}>
                        {statusLabel}
                      </span>
                      <div className="flex flex-col items-center justify-center bg-[var(--bg-surface)] border border-[rgba(0,255,136,0.3)] p-3 min-w-[120px]">
                         <span className="font-black text-2xl text-[var(--color-primary)]">{hw.questionCount}</span>
                         <span className="label-mono text-[var(--color-primary)] opacity-70 text-xs">שאלות/תלמיד</span>
                      </div>
                      {hw.status === 'active' && (
                        <button
                          className="flex items-center gap-2 px-4 py-3 border-2 border-[rgba(255,50,50,0.5)] text-[var(--danger)] hover:bg-[rgba(255,50,50,0.1)] hover:shadow-[0_0_15px_var(--danger)] transition-all text-lg font-bold"
                          onClick={(e) => { e.stopPropagation(); handleClose(hw._id); }}
                        >
                          <XCircle size={20} /> סגור מטלה
                        </button>
                      )}
                    </div>
                  </div>

                  {hw.teacherNotes && (
                    <div className="mt-6 pt-6 border-t border-[rgba(0,255,136,0.2)] text-[var(--color-accent)] opacity-100 text-xl leading-relaxed bg-[rgba(0,255,255,0.05)] p-4" style={{ paddingRight: 40, borderRight: "4px solid var(--color-accent)" }}>
                      <strong className="text-[var(--color-primary)]">הנחיות מערכת:</strong> {hw.teacherNotes}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* Right panel: Rundown - Extra Wide and Dense */}
      <div className="w-[550px] flex-shrink-0 flex-col gap-8 pb-20 overflow-y-auto pr-2">
        <div className="t-mini-title text-[var(--color-accent)] text-3xl flex items-center gap-4 border-b border-[rgba(0,255,255,0.2)] pb-4">
          <BarChart2 size={32} className="text-[var(--color-primary)]" style={{ filter: "drop-shadow(0 0 15px var(--color-primary))" }} /> סיכום וניתוח נתונים
        </div>

        {selectedHwId && rundown ? (
          <div className="flex-col gap-8 w-full">
            {/* Class-level stats */}
            <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-10 text-center w-full shadow-[0_0_30px_rgba(0,255,136,0.15)] relative">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent"></div>
              <div className="label-mono text-[var(--color-accent)] mb-4 text-xl tracking-widest">ציון ממוצע כיתתי</div>
              <div className="font-black text-8xl" style={{ color: rundown.classAvgScore >= 70 ? 'var(--color-primary)' : rundown.classAvgScore >= 40 ? 'var(--warning)' : 'var(--danger)', textShadow: "0 0 30px currentColor" }}>
                {rundown.classAvgScore}%
              </div>
            </div>

            <div className="flex gap-6 w-full">
              <div className="glass bg-[var(--bg-surface)] border border-[var(--color-accent)] p-8 text-center flex-1 shadow-[inset_0_0_20px_rgba(0,255,255,0.1)]">
                <div className="label-mono text-[var(--color-accent)] mb-3 text-lg">אחוז השלמה</div>
                <div className="font-black text-5xl text-[var(--color-accent)]" style={{ textShadow: "0 0 20px currentColor" }}>{rundown.completionRate}%</div>
              </div>
              <div className="glass bg-[var(--bg-surface)] border border-[var(--color-accent)] p-8 text-center flex-1 shadow-[inset_0_0_20px_rgba(0,255,255,0.1)]">
                <div className="label-mono text-[var(--color-accent)] mb-3 text-lg">זמן ממוצע</div>
                <div className="font-black text-5xl text-[var(--color-accent)]" style={{ textShadow: "0 0 20px currentColor" }}>{rundown.avgTimeMinutes} דק'</div>
              </div>
            </div>

            {/* Topic breakdown */}
            {rundown.topicBreakdown.length > 0 && (
              <div className="w-full shard bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-8">
                <div className="label-mono text-[var(--color-accent)] mb-6 text-2xl border-b border-[rgba(0,255,255,0.2)] pb-2 inline-block">פירוט רמת שליטה לפי נושא</div>
                <div className="flex flex-col gap-6">
                  {rundown.topicBreakdown.map((tb: any, i: number) => (
                    <div key={i} className="bg-[var(--bg-surface)] border border-[rgba(0,255,136,0.3)] p-5 w-full hover:border-[var(--color-primary)] transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-black text-xl text-[var(--color-primary)]">{tb.topicName}</span>
                        <span className="font-black text-3xl" style={{ color: tb.avgScore >= 70 ? 'var(--color-primary)' : tb.avgScore >= 40 ? 'var(--warning)' : 'var(--danger)', textShadow: "0 0 15px currentColor" }}>
                          {tb.avgScore}%
                        </span>
                      </div>
                      <div className="label-mono text-[var(--color-accent)] opacity-90 text-base mb-2 p-2 bg-[rgba(0,255,255,0.05)] border-r-2 border-[var(--color-accent)]">נקודת תורפה מרכזית: {tb.hardestSection}</div>
                      {tb.commonMistakes.length > 0 && (
                        <div className="text-[var(--danger)] text-base opacity-100 mt-3 bg-[rgba(255,50,50,0.05)] p-3 border border-[rgba(255,50,50,0.2)]">
                          <strong>טעויות נפוצות:</strong> {tb.commonMistakes.slice(0, 2).join(' | ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clusters */}
            {rundown.clusters.length > 0 && (
              <div className="w-full shard bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-8">
                <div className="label-mono text-[var(--color-accent)] mb-6 text-2xl border-b border-[rgba(0,255,255,0.2)] pb-2 inline-block">ניתוח אשכולות למידה</div>
                <div className="flex flex-col gap-6">
                  {rundown.clusters.map((cl: any, i: number) => (
                    <div key={i} className="bg-[var(--bg-surface)] border border-[rgba(0,255,255,0.2)] p-5 w-full border-r-8 shadow-[0_0_15px_rgba(0,0,0,0.5)]" style={{ borderRightColor: cl.label === 'מצטיינים' ? 'var(--color-primary)' : cl.label === 'צריכים חיזוק' ? 'var(--danger)' : 'var(--warning)' }}>
                      <div className="flex items-center gap-4 mb-3">
                        <Users size={24} color={cl.label === 'מצטיינים' ? 'var(--color-primary)' : cl.label === 'צריכים חיזוק' ? 'var(--danger)' : 'var(--warning)'} style={{ filter: "drop-shadow(0 0 8px currentColor)" }} />
                        <span className="font-black text-2xl text-[var(--color-accent)]">{cl.label}</span>
                        <span className="label-mono bg-[rgba(0,255,255,0.1)] text-[var(--color-accent)] px-3 py-1 border border-[rgba(0,255,255,0.3)]">{cl.studentIds.length} תלמידים</span>
                      </div>
                      <div className="text-[var(--color-primary)] opacity-100 text-lg leading-relaxed">{cl.recommendedAction}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flagged */}
            {rundown.flagged.length > 0 && (
              <div className="w-full shard bg-[rgba(255,50,50,0.05)] border border-[var(--danger)] p-8 shadow-[0_0_20px_rgba(255,50,50,0.1)]">
                <div className="label-mono text-[var(--danger)] mb-6 text-2xl flex items-center gap-3 border-b border-[rgba(255,50,50,0.2)] pb-2 inline-flex font-black" style={{ textShadow: "0 0 10px var(--danger)" }}>
                  <AlertTriangle size={24} /> התראות מערכת - תלמידים בסיכון
                </div>
                <div className="flex flex-col gap-6">
                  {rundown.flagged.map((f: any, i: number) => (
                    <div key={i} className="bg-[var(--bg-surface)] border border-[rgba(255,50,50,0.3)] p-5 w-full border-r-4 border-r-[var(--danger)] shadow-[inset_0_0_15px_rgba(255,50,50,0.1)]">
                      <div className="text-xl text-[var(--danger)] font-bold">{f.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : selectedHwId ? (
          <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-16 text-center text-[var(--color-primary)] opacity-50 w-full shadow-[inset_0_0_30px_rgba(0,255,136,0.05)]">
            <BarChart2 size={80} className="mx-auto mb-6" style={{ filter: "drop-shadow(0 0 15px currentColor)" }} />
            <div className="font-bold text-2xl">סיכום וניתוח נתונים יהיו זמינים לאחר סגירת המטלה</div>
          </div>
        ) : (
          <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-16 text-center text-[var(--color-accent)] opacity-50 w-full shadow-[inset_0_0_30px_rgba(0,255,255,0.05)]">
            <FileText size={80} className="mx-auto mb-6" style={{ filter: "drop-shadow(0 0 15px currentColor)" }} />
            <div className="font-bold text-2xl">אנא בחרו מטלה מהרשימה כדי לראות את סיכום הנתונים המלא</div>
          </div>
        )}
      </div>
    </div>
  );
}

