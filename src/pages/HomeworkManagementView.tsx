import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignalWave, FieldLines, ElectricBolt } from "../components/electric";
import QuestionImportModal from "../components/QuestionImportModal";
import PdfAssignmentBuilder from "../components/PdfAssignmentBuilder";
import PacketImportButton from "../components/PacketImportButton";
import {
  FileText, Plus, Send, Calendar, Clock, XCircle,
  BarChart2, Users, AlertTriangle, CheckCircle as CheckCircle2, CircleIcon as Circle,
  Loader as Loader2, Zap, Sparkles, Check, Scissors, User, ChevronDown
} from "../components/electric";

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
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Teacher-imported questions pinned to the homework being created
  const [showImportModal, setShowImportModal] = useState(false);
  const [pinnedQuestionIds, setPinnedQuestionIds] = useState<Id<"questions">[]>([]);
  const [pinnedCompoundIds, setPinnedCompoundIds] = useState<Id<"compoundQuestions">[]>([]);

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
  const approvedImports = useQuery(
    api.teacherImport.listImports,
    classroomId ? { classroomId, status: "approved" } : "skip"
  );
  const pdfAssignments = useQuery(
    api.pdfAssignments.listForClassroom,
    classroomId ? { classroomId } : "skip"
  );

  const [showPdfBuilder, setShowPdfBuilder] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);
  const [expandedPdfId, setExpandedPdfId] = useState<Id<"pdfAssignments"> | null>(null);

  const pinnedCount = pinnedQuestionIds.length + pinnedCompoundIds.length;

  const isImportPinned = (imp: Doc<"teacherImportedQuestions">) =>
    (!!imp.publishedQuestionId && pinnedQuestionIds.includes(imp.publishedQuestionId)) ||
    (!!imp.publishedCompoundId && pinnedCompoundIds.includes(imp.publishedCompoundId));

  const togglePinnedImport = (imp: Doc<"teacherImportedQuestions">) => {
    const qid = imp.publishedQuestionId;
    const cid = imp.publishedCompoundId;
    if (qid) {
      setPinnedQuestionIds((prev) => prev.includes(qid) ? prev.filter((id) => id !== qid) : [...prev, qid]);
    } else if (cid) {
      setPinnedCompoundIds((prev) => prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]);
    }
  };

  const handleImportApproved = (ref: {
    questionId: Id<"questions"> | null;
    compoundId: Id<"compoundQuestions"> | null;
    label: string;
  }) => {
    const qid = ref.questionId;
    const cid = ref.compoundId;
    if (qid) setPinnedQuestionIds((prev) => prev.includes(qid) ? prev : [...prev, qid]);
    else if (cid) setPinnedCompoundIds((prev) => prev.includes(cid) ? prev : [...prev, cid]);
  };

  const handleCreate = async () => {
    if (!classroomId || !title.trim() || selectedTopics.length === 0) return;
    setCreating(true);
    await createHomework({
      classroomId, title: title.trim(), topicIds: selectedTopics,
      teacherNotes: teacherNotes.trim() || undefined, questionCount,
      deadline: Date.now() + deadlineDays * 24 * 60 * 60 * 1000,
      pinnedQuestionIds: pinnedQuestionIds.length ? pinnedQuestionIds : undefined,
      pinnedCompoundIds: pinnedCompoundIds.length ? pinnedCompoundIds : undefined,
    });
    setTitle(""); setSelectedTopics([]); setTeacherNotes("");
    setQuestionCount(4); setDeadlineDays(3); setShowCreate(false); setCreating(false);
    setPinnedQuestionIds([]); setPinnedCompoundIds([]);
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
    { id: "students" as const, label: "תלמידים", Icon: FieldLines },
    { id: "questions" as const, label: "איפה נתקעו?", Icon: SignalWave },
    { id: "overview" as const, label: "תמונת מצב", Icon: ElectricBolt },
  ];

  return (
    <div className="flex flex-col lg:flex-row w-full h-full gap-4 lg:gap-6 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden" dir="rtl">
      {/* Left: List */}
      <div className="flex-1 flex flex-col lg:overflow-y-auto pb-10 lg:pb-20 min-w-0 w-full">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 mb-2 text-3xl font-bold text-on-surface"
            style={{ fontFamily: "'Yarden', 'Assistant', sans-serif" }}>
            <span className="w-12 h-12 rounded-2xl bg-primary border-2 border-primary-dark flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: 'var(--shadow-clay-primary)' }}>
              <FileText size={24} className="text-white" />
            </span>
            ניהול שיעורי בית
          </h1>
          <p className="text-base text-on-surface-variant">
            צרו שיעורי בית מותאמים אישית לכל תלמיד.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <button className="btn btn-primary w-fit flex items-center gap-3 px-8 py-4 text-base font-bold"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
            onClick={() => setShowCreate(!showCreate)}>
            <Plus size={20} /> צור שיעורי בית חדשים
          </button>
          <button className="w-fit flex items-center gap-3 px-8 py-4 text-base font-bold rounded-xl border-2 border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] transition-all"
            onClick={() => setShowPdfBuilder(true)}>
            <Scissors size={20} /> מטלת PDF אישית
          </button>
        </div>

        {/* Personal PDF assignments */}
        {pdfAssignments && pdfAssignments.length > 0 && (
          <div className="mb-8">
            <div className="label-mono text-[var(--color-accent)] mb-3 text-lg border-b border-[color-mix(in srgb, var(--color-accent) 20%, transparent)] pb-2 inline-block">
              מטלות PDF אישיות
            </div>
            <div className="flex flex-col gap-2">
              {pdfAssignments.map((a) => {
                const isOpen = expandedPdfId === a._id;
                return (
                <div key={a._id} className="bg-surface rounded-2xl border-2 border-outline overflow-hidden"
                  style={{ boxShadow: "var(--shadow-clay)" }}>
                  <div className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-primary)_4%,transparent)] transition-colors"
                    onClick={() => setExpandedPdfId(isOpen ? null : a._id)}>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: a.avatarColor + "22", border: `2px solid ${a.avatarColor}66`, color: a.avatarColor }}>
                      <Scissors size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-base text-[var(--color-primary)] truncate">{a.title}</div>
                      <div className="label-mono text-[var(--color-accent)] opacity-70 flex items-center gap-2.5 text-xs mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><User size={11} /> {a.studentName}</span>
                        <span className="flex items-center gap-1"><FileText size={11} /> {a.questionCount} שאלות · {a.partCount} סעיפים</span>
                        {a.completedAt && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded font-bold"
                            style={{ background: "color-mix(in srgb, var(--color-success) 15%, transparent)", color: "var(--color-success)" }}>
                            <CheckCircle2 size={11} /> הושלם · {formatDate(a.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center bg-[var(--bg-surface)] border border-[color-mix(in srgb, var(--color-primary) 30%, transparent)] px-3 py-1 rounded-lg text-center flex-shrink-0">
                      <span className="num font-black text-base text-[var(--color-primary)]">{a.answeredCount}/{a.partCount}</span>
                      <span className="label-mono text-[var(--color-primary)] opacity-60 text-xs">נענו</span>
                    </div>
                    {a.answeredCount > 0 && (
                      <div className="flex flex-col items-center px-3 py-1 rounded-lg text-center flex-shrink-0"
                        style={{ background: a.scorePercent >= 70 ? "color-mix(in srgb, var(--color-success) 12%, transparent)" : a.scorePercent >= 40 ? "color-mix(in srgb, var(--color-warning) 14%, transparent)" : "color-mix(in srgb, var(--color-danger) 12%, transparent)", border: `1px solid ${a.scorePercent >= 70 ? "color-mix(in srgb, var(--color-success) 30%, transparent)" : a.scorePercent >= 40 ? "color-mix(in srgb, var(--color-warning) 30%, transparent)" : "color-mix(in srgb, var(--color-danger) 30%, transparent)"}` }}>
                        <span className="num font-black text-base" style={{ color: a.scorePercent >= 70 ? "var(--color-success)" : a.scorePercent >= 40 ? "var(--color-warning)" : "var(--danger)" }}>{a.scorePercent}%</span>
                        <span className="label-mono opacity-60 text-xs" style={{ color: a.scorePercent >= 70 ? "var(--color-success)" : a.scorePercent >= 40 ? "var(--color-warning)" : "var(--danger)" }}>ציון</span>
                      </div>
                    )}
                    <ChevronDown size={18} className={`text-[var(--color-accent)] opacity-60 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                  {isOpen && <PdfAssignmentDetail assignmentId={a._id} />}
                </div>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence>
          {showCreate && (
            <motion.div className="mb-10 w-full"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
              <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-8 w-full relative rounded-xl"
                style={{ boxShadow: "0 0 30px color-mix(in srgb, var(--color-primary) 10%, transparent)" }}>
                <div className="absolute top-0 right-0 w-1.5 h-full bg-[var(--color-primary)] rounded-r-xl" />
                <div className="label-mono text-[var(--color-accent)] mb-6 text-lg border-b border-[color-mix(in srgb, var(--color-accent) 20%, transparent)] pb-3">
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
                        className={`px-3 py-1.5 border transition-all text-sm font-semibold rounded-lg ${selectedTopics.includes(topic._id) ? "bg-[color-mix(in srgb, var(--color-primary) 20%, transparent)] border-[var(--color-primary)] text-[var(--color-primary)]" : "bg-[var(--bg-surface)] border-[color-mix(in srgb, var(--color-primary) 30%, transparent)] text-[var(--color-primary)] opacity-60 hover:opacity-100"}`}
                        onClick={() => toggleTopic(topic._id)}>
                        {topic.nameHe}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <label className="label-mono text-[var(--color-primary)] block mb-2 text-sm">שאלות מהספר (ייבוא AI)</label>
                  <div className="flex flex-wrap items-start gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] transition-all font-bold text-sm rounded-lg"
                    >
                      <Sparkles size={16} /> ייבא שאלה מתמונה / PDF
                    </button>
                    {classroomId && <PacketImportButton classroomId={classroomId} />}
                  </div>
                  {approvedImports && approvedImports.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {approvedImports.map((imp) => {
                        const pinned = isImportPinned(imp);
                        return (
                          <button
                            type="button"
                            key={imp._id}
                            onClick={() => togglePinnedImport(imp)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-right transition-all ${pinned ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]" : "border-[var(--border-subtle)] hover:border-[color-mix(in_srgb,var(--color-primary)_50%,transparent)]"}`}
                          >
                            <span className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${pinned ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--border-subtle)]"}`}>
                              {pinned && <Check size={13} className="text-white" />}
                            </span>
                            <span className="flex-1 text-sm text-[var(--color-accent)] truncate min-w-0">{imp.draft?.stem ?? "שאלה מיובאת"}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] flex-shrink-0">
                              {imp.draft?.format === "multiple_choice" ? "אמריקאית" : "השלמה"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {pinnedCount > 0 && (
                    <div className="mt-2 text-xs text-[var(--color-primary)] font-bold">
                      {pinnedCount} שאלות מיובאות יתווספו לכל תלמיד
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-5 mb-5">
                  <div className="flex-1 bg-[var(--bg-elevated)] p-4 border border-[color-mix(in srgb, var(--color-accent) 20%, transparent)] rounded-lg">
                    <label className="label-mono text-[var(--color-accent)] block mb-2 text-xs">שאלות לתלמיד</label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setQuestionCount(n)}
                          className={`w-10 h-10 flex items-center justify-center border text-base font-black transition-all rounded ${questionCount === n ? "bg-[color-mix(in srgb, var(--color-accent) 20%, transparent)] border-[var(--color-accent)] text-[var(--color-accent)]" : "bg-[var(--bg-surface)] border-[color-mix(in srgb, var(--color-accent) 30%, transparent)] text-[var(--color-accent)] opacity-60 hover:opacity-100"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-[var(--bg-elevated)] p-4 border border-[color-mix(in srgb, var(--color-accent) 20%, transparent)] rounded-lg">
                    <label className="label-mono text-[var(--color-accent)] block mb-2 text-xs">מועד הגשה (ימים)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button key={d} onClick={() => setDeadlineDays(d)}
                          className={`w-10 h-10 flex items-center justify-center border text-base font-black transition-all rounded ${deadlineDays === d ? "bg-[color-mix(in srgb, var(--color-accent) 20%, transparent)] border-[var(--color-accent)] text-[var(--color-accent)]" : "bg-[var(--bg-surface)] border-[color-mix(in srgb, var(--color-accent) 30%, transparent)] text-[var(--color-accent)] opacity-60 hover:opacity-100"}`}>{d}</button>
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
                    style={{ boxShadow: "var(--shadow-clay-primary)", opacity: (creating || !title.trim() || selectedTopics.length === 0) ? 0.5 : 1 }}
                    onClick={handleCreate} disabled={creating || !title.trim() || selectedTopics.length === 0}>
                    <Send size={16} /> {creating ? "מפעיל..." : "צור מטלות אישיות"}
                  </button>
                  <button className="px-6 py-2.5 border-2 border-[color-mix(in srgb, var(--color-danger) 50%, transparent)] text-[var(--danger)] hover:bg-[color-mix(in srgb, var(--color-danger) 10%, transparent)] transition-all font-bold text-sm rounded-lg"
                    onClick={() => setShowCreate(false)}>ביטול</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="label-mono text-[var(--color-accent)] mb-4 text-lg border-b border-[color-mix(in srgb, var(--color-accent) 20%, transparent)] pb-3 inline-block">
          מטלות פעילות וארכיון
        </div>

        <motion.div className="flex flex-col gap-3 w-full"
          initial="hidden" animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } }}>
          {!homeworkList || homeworkList.length === 0 ? (
            <div className="glass bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-12 text-center rounded-xl"
              style={{ color: "var(--color-primary)", opacity: 0.6 }}>
              <FileText size={48} className="mx-auto mb-3" />
              <div className="font-black text-xl mb-1">עוד לא יצרת מטלות</div>
              <div className="text-sm font-semibold opacity-80">התחל מ״צור שיעורי בית חדשים״ למעלה</div>
            </div>
          ) : homeworkList.map((hw) => {
            const isExpired = Date.now() > hw.deadline;
            const sc = hw.status === "graded" ? "var(--color-primary)" : hw.status === "closed" ? "gray" : isExpired ? "var(--danger)" : "var(--color-accent)";
            const sl = hw.status === "graded" ? "הוערך" : hw.status === "closed" ? "נסגר" : isExpired ? "עבר מועד" : "פעיל";
            return (
              <motion.div key={hw._id}
                className={`bg-surface p-4 cursor-pointer border-2 transition-all w-full relative overflow-hidden rounded-2xl hover:-translate-y-0.5 ${selectedHwId === hw._id ? "border-primary" : "border-outline hover:border-primary/50"}`}
                style={{ boxShadow: 'var(--shadow-clay)' }}
                onClick={() => setSelectedHwId(selectedHwId === hw._id ? null : hw._id)}
                variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
                {selectedHwId === hw._id && <div className="absolute top-0 right-0 w-1 h-full bg-[var(--color-accent)] rounded-r-xl" />}
                <div className="flex justify-between items-center gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-[var(--bg-surface)] border border-[color-mix(in srgb, var(--color-on-surface) 8%, transparent)] rounded-xl">
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
                    <div className="flex flex-col items-center bg-[var(--bg-surface)] border border-[color-mix(in srgb, var(--color-primary) 30%, transparent)] px-2.5 py-1 rounded-lg text-center">
                      <span className="num font-black text-base text-[var(--color-primary)]">{hw.questionCount}</span>
                      <span className="label-mono text-[var(--color-primary)] opacity-60 text-xs">שאלות</span>
                    </div>
                    {hw.status === "active" && (
                      <button className="flex items-center gap-1.5 px-2.5 py-2 border-2 border-[color-mix(in srgb, var(--color-danger) 50%, transparent)] text-[var(--danger)] hover:bg-[color-mix(in srgb, var(--color-danger) 10%, transparent)] transition-all text-xs font-bold rounded-lg"
                        onClick={(e) => { e.stopPropagation(); handleClose(hw._id); }}>
                        <XCircle size={14} /> סגור
                      </button>
                    )}
                  </div>
                </div>
                {hw.teacherNotes && (
                  <div className="mt-3 pt-3 border-t border-[color-mix(in srgb, var(--color-primary) 15%, transparent)] text-xs text-[var(--color-accent)] leading-relaxed bg-[color-mix(in srgb, var(--color-accent) 3%, transparent)] p-2.5 rounded-lg"
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
      <div className="w-full lg:w-[440px] lg:flex-shrink-0 flex flex-col gap-3 pb-10 lg:pb-20 lg:overflow-y-auto">
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
              <tab.Icon size={16} glow={0.5} animated={false} /> {tab.label}
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
                    { label: "הגישו", value: "submitted" as const, count: submittedCount, color: "var(--color-primary)" },
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
                      const isExpanded = expandedStudent === s.assignedQuestionId;
                      return (
                        <div key={s.assignedQuestionId}
                          className="flex flex-col rounded-xl border transition-all"
                          style={{ background: "var(--bg-surface)", borderColor: isSub ? "color-mix(in srgb, var(--color-success) 20%, transparent)" : isIP ? "color-mix(in srgb, var(--color-warning) 20%, transparent)" : "var(--border-subtle)" }}>
                          
                          {/* Row Header */}
                          <div 
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)] transition-colors"
                            onClick={() => setExpandedStudent(isExpanded ? null : s.assignedQuestionId)}
                          >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                              style={{ background: s.avatarColor + "33", border: `2px solid ${s.avatarColor}66`, color: s.avatarColor }}>
                              {s.studentName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{s.studentName}</div>
                              <div className="text-xs flex flex-wrap items-center gap-2 mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {isSub && s.submittedAt && <span className="flex items-center gap-1"><CheckCircle2 size={10} /> הושלם במלואו</span>}
                                {isIP && <span style={{ color: "var(--color-warning)" }}>פתר/ה {s.answersCount} מתוך {s.answersCount + 1 /* approx */} סעיפים</span>}
                                {s.status === "pending" && <span style={{ color: "var(--danger)" }}>טרם התחיל</span>}
                                <span className="text-xs px-1.5 rounded" style={{ background: "var(--bg-elevated)" }}>רמה {s.assignedDifficulty}</span>
                                
                                {/* New stats */}
                                {s.totalTimeMs > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={10} /> {Math.ceil(s.totalTimeMs / 60000)} דקות
                                  </span>
                                )}
                                {s.aiInteractions > 0 && (
                                  <span className="flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
                                    <Zap size={10} /> {s.aiInteractions} עזרים מ-AI
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1.5">
                              {isSub ? (
                                <div className="flex flex-col items-end">
                                  <span className="num font-black text-base"
                                    style={{ color: s.score !== null && s.score >= 70 ? "var(--color-primary)" : s.score !== null && s.score >= 40 ? "var(--color-warning)" : "var(--danger)" }}>
                                    {s.score !== null ? `${s.score}%` : "—"}
                                  </span>
                                </div>
                              ) : isIP ? (
                                <Loader2 size={16} style={{ color: "var(--color-warning)" }} className="animate-spin" />
                              ) : (
                                <Circle size={16} style={{ color: "var(--text-muted)", opacity: 0.35 }} />
                              )}
                              {isSub && s.score === 100 && <CheckCircle2 size={15} style={{ color: "color-mix(in srgb, var(--color-success) 70%, transparent)" }} />}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && s.answers && s.answers.length > 0 && (
                            <div className="p-4 border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-elevated)_50%,transparent)] rounded-b-xl">
                              <h4 className="text-xs font-bold mb-3" style={{ color: "var(--color-accent)" }}>פירוט תשובות ({s.answers.length}):</h4>
                              <div className="flex flex-col gap-2">
                                {s.answers.map((ans, idx: number) => (
                                  <div key={idx} className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>סעיף {ans.sectionLabel}</span>
                                      {ans.isCorrect !== undefined ? (
                                        <span className="text-xs font-bold" style={{ color: ans.isCorrect ? "var(--color-success)" : "var(--danger)" }}>
                                          {ans.isCorrect ? "נכון ✓" : "שגוי ✗"}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted">ממתין לבדיקה</span>
                                      )}
                                    </div>
                                    <div className="text-xs opacity-80 mb-1" style={{ color: "var(--text-primary)" }}>
                                      <span className="opacity-50 mr-1">תשובה:</span>
                                      {ans.studentAnswer}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                                      {ans.hintsUsed > 0 && <span className="flex items-center gap-1"><Zap size={10} style={{ color: "var(--color-warning)" }} />{ans.hintsUsed} רמזים</span>}
                                      {ans.timeMs != null && ans.timeMs > 0 && <span className="flex items-center gap-1"><Clock size={10} />{Math.ceil(ans.timeMs / 1000)} שניות</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                    <SignalWave size={40} glow={0.8} className="mx-auto mb-3 block" />
                    <div className="text-sm">אין נתוני שאלות עדיין</div>
                    <div className="text-xs mt-1 opacity-60">יופיעו כשתלמידים יתחילו לענות</div>
                  </div>
                ) : questionStats.map((q) => {
                  const red = q.successRate !== null && q.successRate < 40;
                  const green = q.successRate !== null && q.successRate >= 70;
                  const qColor = red ? "var(--danger)" : green ? "var(--color-primary)" : "var(--color-warning)";
                  return (
                    <div key={`${q.questionId}-${q.label}`} className="p-4 rounded-xl border transition-all"
                      style={{ background: "var(--bg-surface)", borderColor: red ? "color-mix(in srgb, var(--color-danger) 25%, transparent)" : green ? "color-mix(in srgb, var(--color-success) 20%, transparent)" : "var(--border-subtle)", borderRight: `4px solid ${qColor}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          סעיף {q.label} <span className="opacity-40 text-xs">(רמה {q.difficulty})</span>
                        </span>
                        <span className="num font-black text-lg" style={{ color: qColor }}>
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
                      <div className="num font-black text-6xl"
                        style={{ color: rundown.classAvgScore >= 70 ? "var(--color-primary)" : rundown.classAvgScore >= 40 ? "var(--warning)" : "var(--danger)" }}>
                        {rundown.classAvgScore}%
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 glass bg-[var(--bg-surface)] border border-[var(--color-accent)] p-4 text-center rounded-xl">
                        <div className="label-mono text-[var(--color-accent)] mb-1 text-xs">אחוז השלמה</div>
                        <div className="num font-black text-3xl text-[var(--color-accent)]">{rundown.completionRate}%</div>
                      </div>
                      <div className="flex-1 glass bg-[var(--bg-surface)] border border-[var(--color-accent)] p-4 text-center rounded-xl">
                        <div className="label-mono text-[var(--color-accent)] mb-1 text-xs">זמן ממוצע</div>
                        <div className="num font-black text-3xl text-[var(--color-accent)]">{rundown.avgTimeMinutes}ד'</div>
                      </div>
                    </div>
                    {rundown.clusters.length > 0 && (
                      <div className="bg-[var(--color-primary-muted)] border border-[var(--color-primary)] p-4 rounded-xl">
                        <div className="label-mono text-[var(--color-accent)] mb-3 text-xs border-b border-[color-mix(in srgb, var(--color-accent) 20%, transparent)] pb-2">אשכולות למידה</div>
                        <div className="flex flex-col gap-2">
                          {rundown.clusters.map((cl, i: number) => {
                            const cc = cl.label === "מצטיינים" ? "var(--color-primary)" : cl.label === "צריכים חיזוק" ? "var(--danger)" : "var(--warning)";
                            const clusterNames = cl.studentIds.map((id) => studentSubmissions?.find(s => s.studentId === id)?.studentName).filter((n): n is string => Boolean(n));
                            return (
                              <div key={i} className="bg-[var(--bg-surface)] border p-3 rounded-lg"
                                style={{ borderColor: "color-mix(in srgb, var(--color-accent) 15%, transparent)", borderRight: `4px solid ${cc}` }}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Users size={14} style={{ color: cc }} />
                                  <span className="font-bold text-xs" style={{ color: "var(--color-accent)" }}>{cl.label}</span>
                                </div>
                                {clusterNames.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {clusterNames.map((name: string, idx: number) => (
                                      <span key={idx} className="text-xs px-1.5 py-0.5 rounded border" style={{ background: "color-mix(in srgb, var(--color-accent) 8%, transparent)", borderColor: "color-mix(in srgb, var(--color-accent) 20%, transparent)", color: "var(--color-accent)" }}>
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-xs" style={{ color: "var(--color-primary)", lineHeight: 1.5 }}>{cl.recommendedAction}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {rundown.flagged.length > 0 && (
                      <div className="bg-[color-mix(in srgb, var(--color-danger) 5%, transparent)] border border-[var(--danger)] p-4 rounded-xl">
                        <div className="label-mono text-[var(--danger)] mb-3 text-xs flex items-center gap-2 border-b border-[color-mix(in srgb, var(--color-danger) 20%, transparent)] pb-2">
                          <AlertTriangle size={14} /> תלמידים שזקוקים לעזרה
                        </div>
                        <div className="flex flex-col gap-2">
                          {rundown.flagged.map((f, i: number) => {
                            const studentName = studentSubmissions?.find(s => s.studentId === f.studentId)?.studentName || "תלמיד";
                            return (
                              <div key={i} className="bg-[var(--bg-surface)] border p-2.5 rounded-lg text-xs font-medium"
                                style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--color-danger) 25%, transparent)", borderRight: "3px solid var(--danger)" }}>
                                <span className="font-bold underline ml-1">{studentName}:</span> {f.reason}
                              </div>
                            );
                          })}
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

      {showImportModal && classroomId && (
        <QuestionImportModal
          classroomId={classroomId}
          onClose={() => setShowImportModal(false)}
          onApproved={handleImportApproved}
        />
      )}

      {showPdfBuilder && classroomId && (
        <PdfAssignmentBuilder
          classroomId={classroomId}
          onClose={() => setShowPdfBuilder(false)}
          onPublished={(name) => setPdfToast(`המטלה נשלחה אל ${name}`)}
        />
      )}

      <AnimatePresence>
        {pdfToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 12, x: "-50%" }}
            onAnimationComplete={() => setTimeout(() => setPdfToast(null), 2400)}
            className="fixed bottom-6 left-1/2 z-[130] flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-[13.5px]"
            style={{ background: "var(--color-inverse-surface)", color: "var(--color-inverse-on-surface)", boxShadow: "var(--shadow-lg)" }}
          >
            <CheckCircle2 size={16} style={{ color: "var(--color-primary)" }} /> {pdfToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Per-part breakdown for one PDF assignment (teacher review) ──
function PdfAssignmentDetail({ assignmentId }: { assignmentId: Id<"pdfAssignments"> }) {
  const detail = useQuery(api.pdfAssignments.getAssignment, { assignmentId });

  if (detail === undefined) {
    return (
      <div className="flex items-center justify-center py-6 text-[var(--text-muted)] border-t border-outline">
        <Loader2 size={18} className="animate-spin ml-2" /> טוען...
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="border-t border-outline bg-[color-mix(in_srgb,var(--bg-elevated)_40%,transparent)] p-4 flex flex-col gap-3">
      {detail.pdfUrl && (
        <a href={detail.pdfUrl} target="_blank" rel="noreferrer"
          className="self-start flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors">
          <FileText size={13} /> פתח את ה-PDF המקורי
        </a>
      )}
      {detail.questions.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)] py-2">אין שאלות במטלה זו.</div>
      ) : (
        detail.questions.map((q, qi) => (
          <div key={q._id} className="flex gap-3 bg-surface rounded-xl border border-outline p-2.5">
            <img src={`data:${q.imageMimeType};base64,${q.imageBase64}`} alt={`שאלה ${qi + 1}`}
              className="w-20 h-20 object-cover rounded-lg border border-outline bg-white flex-shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="text-xs font-bold text-[var(--color-primary)]">שאלה {qi + 1}</div>
              {q.parts.map((p, pi) => {
                const answered = p.studentAnswer != null;
                const correct = p.isCorrect === true;
                return (
                  <div key={pi} className="flex items-center gap-2 text-xs flex-wrap">
                    {p.label && <span className="w-5 h-5 flex-shrink-0 rounded bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] flex items-center justify-center font-bold">{p.label}</span>}
                    {!answered ? (
                      <span className="text-[var(--text-muted)]">טרם נענה</span>
                    ) : (
                      <>
                        {correct
                          ? <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} className="flex-shrink-0" />
                          : <XCircle size={14} style={{ color: "var(--danger)" }} className="flex-shrink-0" />}
                        <span className="text-[var(--text-primary)]">
                          <span className="opacity-50">ענה: </span>
                          <strong style={{ color: correct ? "var(--color-success)" : "var(--danger)" }}>{p.studentAnswer}</strong>
                        </span>
                        {!correct && (
                          <span className="text-[var(--text-muted)]">
                            <span className="opacity-50">נכון: </span><strong className="text-[var(--color-primary)]">{p.correctAnswer}</strong>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
