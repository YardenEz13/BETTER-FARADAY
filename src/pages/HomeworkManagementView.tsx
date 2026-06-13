import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Send, Calendar, Clock, XCircle,
  BarChart2, Users, AlertTriangle, CheckCircle2, Circle,
  Loader2, Target, Zap
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "questions">("students");
  const [studentFilter, setStudentFilter] = useState<"all" | "submitted" | "pending">("all");

  const rundown = useQuery(
    api.homeworkRundown.getRundown,
    selectedHwId ? { homeworkId: selectedHwId } : "skip"
  );
  const studentSubmissions = useQuery(
    api.homework.getStudentSubmissions,
    selectedHwId ? { homeworkId: selectedHwId } : "skip"
  );
  const questionStats = useQuery(
    api.homework.getHomeworkQuestionStats,
    selectedHwId ? { homeworkId: selectedHwId } : "skip"
  );

  const handleCreate = async () => {
    if (!classroomId || !title.trim() || selectedTopics.length === 0) return;
    setCreating(true);
    await createHomework({
      classroomId, title: title.trim(), topicIds: selectedTopics,
      teacherNotes: teacherNotes.trim() || undefined, questionCount,
      deadline: Date.now() + deadlineDays * 24 * 60 * 60 * 1000,
    });
    setTitle(""); setSelectedTopics([]); setTeacherNotes("");
    setQuestionCount(4); setDeadlineDays(3); setShowCreate(false); setCreating(false);
  };

  const handleClose = async (hwId: Id<"homework">) => { await closeHomework({ homeworkId: hwId }); };
  const toggleTopic = (id: Id<"topics">) => {
    setSelectedTopics((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const submittedCount = studentSubmissions?.filter(s => s.status === "submitted").length ?? 0;
  const inProgressCount = studentSubmissions?.filter(s => s.status === "in_progress").length ?? 0;
  const pendingCount = studentSubmissions?.filter(s => s.status === "pending").length ?? 0;
  const totalStudents = studentSubmissions?.length ?? 0;

  const filteredStudents = studentSubmissions?.filter(s => {
    if (studentFilter === "submitted") return s.status === "submitted";
    if (studentFilter === "pending") return s.status !== "submitted";
    return true;
  }) ?? [];

  const tabs = [
    { id: "students" as const, label: "תלמידים", icon: <Users size={15} /> },
    { id: "questions" as const, label: "ניתוח שאלות", icon: <Target size={15} /> },
    { id: "overview" as const, label: "סקירת כיתה", icon: <BarChart2 size={15} /> },
  ];

  return (
    <div className="flex w-full h-full gap-6 p-6 overflow-hidden" dir="rtl">
      {/* Left: List */}
      <div className="flex-1 flex flex-col overflow-y-auto pb-20 min-w-0">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 mb-2 text-4xl font-black"
            style={{ color: "var(--color-accent)", fontFamily: "'Yarden', sans-serif", textShadow: "0 0 20px var(--color-accent)" }}>
            <FileText size={40} style={{ filter: "drop-shadow(0 0 10px var(--color-primary))", color: "var(--color-primary)" }} />
            ניהול שיעורי בית
          </h1>
          <p className="text-base opacity-70" style={{ color: "var(--color-primary)" }}>
            צרו שיעורי בית מותאמים אישית לכל תלמיד.
          </p>
        </div>

        <button className="btn btn-primary mb-8 w-fit flex items-center gap-3 px-8 py-4 text-base font-bold"
          style={{ boxShadow: "0 0 20px var(--color-primary)" }}
          onClick={() => setShowCreate(!showCreate)}>
          <Plus size={20} /> צור שיעורי בית חדשים
        </button>

        <AnimatePresence>
          {showCreate && (
            <motion.div className="mb-10 w-full"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
              <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-8 w-full relative rounded-xl"
                style={{ boxShadow: "0 0 30px rgba(0,255,136,0.1)" }}>
                <div className="absolute top-0 right-0 w-1.5 h-full bg-[var(--color-primary)] rounded-r-xl" />
                <div className="label-mono text-[var(--color-accent)] mb-6 text-lg border-b border-[rgba(0,255,255,0.2)] pb-3">
                  ממשק יצירת שיעורי בית
                </div>

                <div className="mb-5">
                  <label className="label-mono text-[var(--color-primary)] block mb-2 text-sm">כותרת המטלה</label>
                  <input className="w-full bg-[var(--bg-surface)] border border-[var(--color-primary)] text-[var(--color-accent)] p-3 text-base focus:outline-none focus:border-[var(--color-accent)] transition-all font-medium placeholder:opacity-40 rounded-lg"
                    type="text" placeholder='לדוגמא: חזרה על חדו"א'
                    value={title} onChange={(e) => setTitle(e.target.value)} dir="rtl" />
                </div>

                <div className="mb-5">
                  <label className="label-mono text-[var(--color-primary)] block mb-2 text-sm">נושאים לכיסוי</label>
                  <div className="flex gap-2 flex-wrap">
                    {topics?.map((topic) => (
                      <button key={topic._id}
                        className={`px-3 py-1.5 border transition-all text-sm font-semibold rounded-lg ${selectedTopics.includes(topic._id) ? "bg-[rgba(0,255,136,0.2)] border-[var(--color-primary)] text-[var(--color-primary)]" : "bg-[var(--bg-surface)] border-[rgba(0,255,136,0.3)] text-[var(--color-primary)] opacity-60 hover:opacity-100"}`}
                        onClick={() => toggleTopic(topic._id)}>
                        {topic.nameHe}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-5 mb-5">
                  <div className="flex-1 bg-[rgba(0,0,0,0.3)] p-4 border border-[rgba(0,255,255,0.2)] rounded-lg">
                    <label className="label-mono text-[var(--color-accent)] block mb-2 text-xs">שאלות לתלמיד</label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setQuestionCount(n)}
                          className={`w-10 h-10 flex items-center justify-center border text-base font-black transition-all rounded ${questionCount === n ? "bg-[rgba(0,255,255,0.2)] border-[var(--color-accent)] text-[var(--color-accent)]" : "bg-[var(--bg-surface)] border-[rgba(0,255,255,0.3)] text-[var(--color-accent)] opacity-60 hover:opacity-100"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-[rgba(0,0,0,0.3)] p-4 border border-[rgba(0,255,255,0.2)] rounded-lg">
                    <label className="label-mono text-[var(--color-accent)] block mb-2 text-xs">מועד הגשה (ימים)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button key={d} onClick={() => setDeadlineDays(d)}
                          className={`w-10 h-10 flex items-center justify-center border text-base font-black transition-all rounded ${deadlineDays === d ? "bg-[rgba(0,255,255,0.2)] border-[var(--color-accent)] text-[var(--color-accent)]" : "bg-[var(--bg-surface)] border-[rgba(0,255,255,0.3)] text-[var(--color-accent)] opacity-60 hover:opacity-100"}`}>{d}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="label-mono text-[var(--color-primary)] block mb-2 text-xs">הערות (אופציונלי)</label>
                  <textarea className="w-full bg-[var(--bg-surface)] border border-[var(--color-primary)] text-[var(--color-accent)] p-3 text-sm focus:outline-none focus:border-[var(--color-accent)] transition-all placeholder:opacity-40 rounded-lg"
                    placeholder="לדוגמא: התמקדו בשאלות פרמטר..."
                    value={teacherNotes} onChange={(e) => setTeacherNotes(e.target.value)}
                    rows={3} dir="rtl" style={{ resize: "vertical" }} />
                </div>

                <div className="flex gap-3">
                  <button className="btn btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-bold"
                    style={{ boxShadow: "0 0 16px var(--color-primary)", opacity: (creating || !title.trim() || selectedTopics.length === 0) ? 0.5 : 1 }}
                    onClick={handleCreate} disabled={creating || !title.trim() || selectedTopics.length === 0}>
                    <Send size={16} /> {creating ? "מפעיל..." : "צור מטלות אישיות"}
                  </button>
                  <button className="px-6 py-2.5 border-2 border-[rgba(255,50,50,0.5)] text-[var(--danger)] hover:bg-[rgba(255,50,50,0.1)] transition-all font-bold text-sm rounded-lg"
                    onClick={() => setShowCreate(false)}>ביטול</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="label-mono text-[var(--color-accent)] mb-4 text-lg border-b border-[rgba(0,255,255,0.2)] pb-3 inline-block">
          מטלות פעילות וארכיון
        </div>

        <motion.div className="flex flex-col gap-3 w-full"
          initial="hidden" animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } }}>
          {!homeworkList || homeworkList.length === 0 ? (
            <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-12 text-center rounded-xl"
              style={{ color: "var(--color-primary)", opacity: 0.6 }}>
              <FileText size={48} className="mx-auto mb-3" />
              <div className="font-black text-xl mb-1">אין מטלות במערכת</div>
            </div>
          ) : homeworkList.map((hw) => {
            const isExpired = Date.now() > hw.deadline;
            const sc = hw.status === "graded" ? "var(--color-primary)" : hw.status === "closed" ? "gray" : isExpired ? "var(--danger)" : "var(--color-accent)";
            const sl = hw.status === "graded" ? "הוערך" : hw.status === "closed" ? "נסגר" : isExpired ? "עבר מועד" : "פעיל";
            return (
              <motion.div key={hw._id}
                className={`bg-[var(--color-primary-muted)] p-4 cursor-pointer border-2 transition-all w-full relative overflow-hidden rounded-xl ${selectedHwId === hw._id ? "border-[var(--color-accent)]" : "border-[rgba(0,255,136,0.3)] hover:border-[var(--color-primary)]"}`}
                style={{ boxShadow: selectedHwId === hw._id ? "0 0 20px rgba(0,255,255,0.12)" : "none" }}
                onClick={() => setSelectedHwId(selectedHwId === hw._id ? null : hw._id)}
                variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
                {selectedHwId === hw._id && <div className="absolute top-0 right-0 w-1 h-full bg-[var(--color-accent)] rounded-r-xl" />}
                <div className="flex justify-between items-center gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-[var(--bg-surface)] border border-[rgba(255,255,255,0.08)] rounded-xl">
                      <FileText size={24} style={{ color: sc, filter: `drop-shadow(0 0 6px ${sc})` }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-lg text-[var(--color-primary)] mb-0.5 truncate">{hw.title}</div>
                      <div className="label-mono text-[var(--color-accent)] opacity-70 flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(hw.createdAt)}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(hw.deadline)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2.5 py-1 text-xs font-black border rounded"
                      style={{ background: `color-mix(in srgb, ${sc} 15%, transparent)`, color: sc, borderColor: sc }}>{sl}</span>
                    <div className="flex flex-col items-center bg-[var(--bg-surface)] border border-[rgba(0,255,136,0.3)] px-2.5 py-1 rounded-lg text-center">
                      <span className="font-black text-base text-[var(--color-primary)]">{hw.questionCount}</span>
                      <span className="label-mono text-[var(--color-primary)] opacity-60 text-xs">שאלות</span>
                    </div>
                    {hw.status === "active" && (
                      <button className="flex items-center gap-1.5 px-2.5 py-2 border-2 border-[rgba(255,50,50,0.5)] text-[var(--danger)] hover:bg-[rgba(255,50,50,0.1)] transition-all text-xs font-bold rounded-lg"
                        onClick={(e) => { e.stopPropagation(); handleClose(hw._id); }}>
                        <XCircle size={14} /> סגור
                      </button>
                    )}
                  </div>
                </div>
                {hw.teacherNotes && (
                  <div className="mt-3 pt-3 border-t border-[rgba(0,255,136,0.15)] text-xs text-[var(--color-accent)] leading-relaxed bg-[rgba(0,255,255,0.03)] p-2.5 rounded-lg"
                    style={{ borderRight: "2px solid var(--color-accent)", paddingRight: 10 }}>
                    <strong className="text-[var(--color-primary)]">הנחייות: </strong>{hw.teacherNotes}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Right: Analytics */}
      <div className="w-[440px] flex-shrink-0 flex flex-col gap-3 pb-20 overflow-y-auto">
        <div className="flex gap-1 p-1 rounded-xl flex-shrink-0"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: activeTab === tab.id ? "var(--color-primary-muted)" : "transparent",
                color: activeTab === tab.id ? "var(--color-primary)" : "var(--text-muted)",
                border: activeTab === tab.id ? "1px solid var(--border-primary)" : "1px solid transparent",
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {!selectedHwId ? (
          <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-12 text-center rounded-2xl"
            style={{ color: "var(--color-accent)", opacity: 0.5 }}>
            <FileText size={48} className="mx-auto mb-3" />
            <div className="font-bold text-sm">בחרו מטלה לראות נתונים</div>
          </div>
        ) : (
          <>
            {/* STUDENTS TAB */}
            {activeTab === "students" && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { label: "הכל", value: "all" as const, count: totalStudents, color: "var(--color-accent)" },
                    { label: "הגישו", value: "submitted" as const, count: submittedCount, color: "#10b981" },
                    { label: "טרם הגישו", value: "pending" as const, count: pendingCount + inProgressCount, color: "var(--danger)" },
                  ] as const).map((f) => (
                    <button key={f.value} onClick={() => setStudentFilter(f.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
                      style={{ background: studentFilter === f.value ? `color-mix(in srgb, ${f.color} 15%, transparent)` : "var(--bg-surface)", color: studentFilter === f.value ? f.color : "var(--text-muted)", borderColor: studentFilter === f.value ? f.color : "var(--border-subtle)" }}>
                      {f.label} <span className="bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-full">{f.count}</span>
                    </button>
                  ))}
                </div>
                {totalStudents > 0 && (
                  <div className="glass p-4 rounded-xl border border-[var(--border-subtle)]">
                    <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                      <span>השלמת מטלה</span>
                      <span>{Math.round((submittedCount / totalStudents) * 100)}%</span>
                    </div>
                    <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(submittedCount / totalStudents) * 100}%`, background: "linear-gradient(to left, var(--color-primary), var(--color-secondary))" }} />
                    </div>
                    <div className="flex justify-between text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                      <span>{submittedCount} הגישו</span>
                      {inProgressCount > 0 && <span>{inProgressCount} בתהליך</span>}
                      <span>{pendingCount} טרם</span>
                    </div>
                  </div>
                )}
                {studentSubmissions === undefined ? (
                  <div className="flex items-center justify-center py-10" style={{ color: "var(--text-muted)" }}>
                    <Loader2 size={20} className="animate-spin ml-2" /> טוען...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredStudents.map((s) => {
                      const isSub = s.status === "submitted";
                      const isIP = s.status === "in_progress";
                      return (
                        <div key={s.assignedQuestionId}
                          className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                          style={{ background: "var(--bg-surface)", borderColor: isSub ? "rgba(16,185,129,0.2)" : isIP ? "rgba(245,158,11,0.2)" : "var(--border-subtle)" }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                            style={{ background: s.avatarColor + "33", border: `2px solid ${s.avatarColor}66`, color: s.avatarColor }}>
                            {s.studentName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{s.studentName}</div>
                            <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {isSub && s.submittedAt && <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(s.submittedAt)}</span>}
                              {isIP && <span style={{ color: "var(--color-warning)" }}>בתהליך</span>}
                              {s.status === "pending" && <span style={{ color: "var(--danger)" }}>טרם התחיל</span>}
                              <span className="text-xs px-1.5 rounded" style={{ background: "var(--bg-elevated)" }}>רמה {s.assignedDifficulty}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            {isSub ? (
                              <div className="flex flex-col items-end">
                                <span className="font-black text-base"
                                  style={{ color: s.score !== null && s.score >= 70 ? "var(--color-primary)" : s.score !== null && s.score >= 40 ? "var(--color-warning)" : "var(--danger)" }}>
                                  {s.score !== null ? `${s.score}%` : "—"}
                                </span>
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.correctCount}/{s.answersCount} נכון</span>
                              </div>
                            ) : isIP ? (
                              <Loader2 size={16} style={{ color: "var(--color-warning)" }} className="animate-spin" />
                            ) : (
                              <Circle size={16} style={{ color: "var(--text-muted)", opacity: 0.35 }} />
                            )}
                            {isSub && <CheckCircle2 size={15} style={{ color: "rgba(16,185,129,0.7)" }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* QUESTIONS TAB */}
            {activeTab === "questions" && (
              <div className="flex flex-col gap-3">
                {questionStats === undefined ? (
                  <div className="flex items-center justify-center py-10" style={{ color: "var(--text-muted)" }}>
                    <Loader2 size={20} className="animate-spin ml-2" /> טוען...
                  </div>
                ) : questionStats.length === 0 ? (
                  <div className="glass p-10 text-center rounded-2xl" style={{ color: "var(--text-muted)" }}>
                    <Target size={36} className="mx-auto mb-3 opacity-40" />
                    <div className="text-sm">אין נתוני שאלות עדיין</div>
                    <div className="text-xs mt-1 opacity-60">יופיעו כשתלמידים יתחילו לענות</div>
                  </div>
                ) : questionStats.map((q) => {
                  const red = q.successRate !== null && q.successRate < 40;
                  const green = q.successRate !== null && q.successRate >= 70;
                  const qColor = red ? "var(--danger)" : green ? "#10b981" : "var(--color-warning)";
                  return (
                    <div key={`${q.questionId}-${q.label}`} className="p-4 rounded-xl border transition-all"
                      style={{ background: "var(--bg-surface)", borderColor: red ? "rgba(239,68,68,0.25)" : green ? "rgba(16,185,129,0.2)" : "var(--border-subtle)", borderRight: `4px solid ${qColor}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          סעיף {q.label} <span className="opacity-40 text-xs">(רמה {q.difficulty})</span>
                        </span>
                        <span className="font-black text-lg" style={{ color: qColor }}>
                          {q.successRate !== null ? `${q.successRate}%` : "—"}
                        </span>
                      </div>
                      <div className="w-full rounded-full h-1.5 mb-3 overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${q.successRate ?? 0}%`, background: qColor }} />
                      </div>
                      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span>{q.correct}/{q.total} ענו נכון</span>
                        {q.avgHints > 0 && <span className="flex items-center gap-1"><Zap size={10} style={{ color: "var(--color-warning)" }} />{q.avgHints} רמזים</span>}
                        {q.avgTimeSec > 0 && <span className="flex items-center gap-1"><Clock size={10} />{q.avgTimeSec}ש'</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-4">
                {rundown ? (
                  <>
                    <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-7 text-center relative rounded-2xl">
                      <div className="label-mono text-[var(--color-accent)] mb-2 text-sm">ציון ממוצע כיתתי</div>
                      <div className="font-black text-6xl"
                        style={{ color: rundown.classAvgScore >= 70 ? "var(--color-primary)" : rundown.classAvgScore >= 40 ? "var(--warning)" : "var(--danger)", textShadow: "0 0 20px currentColor" }}>
                        {rundown.classAvgScore}%
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 glass bg-[var(--bg-surface)] border border-[var(--color-accent)] p-4 text-center rounded-xl">
                        <div className="label-mono text-[var(--color-accent)] mb-1 text-xs">אחוז השלמה</div>
                        <div className="font-black text-3xl text-[var(--color-accent)]">{rundown.completionRate}%</div>
                      </div>
                      <div className="flex-1 glass bg-[var(--bg-surface)] border border-[var(--color-accent)] p-4 text-center rounded-xl">
                        <div className="label-mono text-[var(--color-accent)] mb-1 text-xs">זמן ממוצע</div>
                        <div className="font-black text-3xl text-[var(--color-accent)]">{rundown.avgTimeMinutes}ד'</div>
                      </div>
                    </div>
                    {rundown.clusters.length > 0 && (
                      <div className="bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-4 rounded-xl">
                        <div className="label-mono text-[var(--color-accent)] mb-3 text-xs border-b border-[rgba(0,255,255,0.2)] pb-2">אשכולות למידה</div>
                        <div className="flex flex-col gap-2">
                          {rundown.clusters.map((cl: any, i: number) => {
                            const cc = cl.label === "מצטיינים" ? "var(--color-primary)" : cl.label === "צריכים חיזוק" ? "var(--danger)" : "var(--warning)";
                            return (
                              <div key={i} className="bg-[var(--bg-surface)] border p-3 rounded-lg"
                                style={{ borderColor: "rgba(0,255,255,0.15)", borderRight: `4px solid ${cc}` }}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Users size={14} style={{ color: cc }} />
                                  <span className="font-bold text-xs" style={{ color: "var(--color-accent)" }}>{cl.label}</span>
                                  <span className="label-mono px-1.5 py-0.5 rounded border text-xs"
                                    style={{ background: "rgba(0,255,255,0.08)", borderColor: "rgba(0,255,255,0.25)", color: "var(--color-accent)" }}>
                                    {cl.studentIds.length}
                                  </span>
                                </div>
                                <div className="text-xs" style={{ color: "var(--color-primary)", lineHeight: 1.5 }}>{cl.recommendedAction}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {rundown.flagged.length > 0 && (
                      <div className="bg-[rgba(255,50,50,0.05)] border border-[var(--danger)] p-4 rounded-xl">
                        <div className="label-mono text-[var(--danger)] mb-3 text-xs flex items-center gap-2 border-b border-[rgba(255,50,50,0.2)] pb-2">
                          <AlertTriangle size={14} /> תלמידים בסיכון
                        </div>
                        <div className="flex flex-col gap-2">
                          {rundown.flagged.map((f: any, i: number) => (
                            <div key={i} className="bg-[var(--bg-surface)] border p-2.5 rounded-lg text-xs font-medium"
                              style={{ color: "var(--danger)", borderColor: "rgba(255,50,50,0.25)", borderRight: "3px solid var(--danger)" }}>{f.reason}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-12 text-center rounded-2xl"
                    style={{ color: "var(--color-primary)", opacity: 0.5 }}>
                    <BarChart2 size={48} className="mx-auto mb-3" />
                    <div className="font-bold text-sm">סיכום כיתתי יהיה זמין לאחר סגירת המטלה</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
