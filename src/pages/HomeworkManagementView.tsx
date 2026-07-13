import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignalWave, FieldLines, ElectricBolt } from "../components/electric";
import { ClayButton, ProgressBar, SegTabs } from "../components/ui";
import QuestionImportModal from "../components/QuestionImportModal";
import PdfAssignmentBuilder from "../components/PdfAssignmentBuilder";
import PacketImportButton from "../components/PacketImportButton";
import PacketCropBuilder from "../components/PacketCropBuilder";
import {
  FileText, Plus, Send, Calendar, Clock, XCircle,
  BarChart2, Users, AlertTriangle, CheckCircle as CheckCircle2, CircleIcon as Circle,
  Loader as Loader2, Zap, Sparkles, Check, Scissors, User, ChevronDown
} from "../components/electric";

export function HomeworkManagementView({ classroomId }: { classroomId: Id<"classrooms"> | null }) {
  const navigate = useNavigate();
  const topics = useQuery(api.topics.list);
  const packets = useQuery(
    api.packetImport.listPackets,
    classroomId ? { classroomId } : "skip"
  );
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
  const [showCropBuilder, setShowCropBuilder] = useState(false);
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
          <h1 className="font-display flex items-center gap-3 mb-2 text-3xl font-bold text-on-surface">
            <span className="w-12 h-12 rounded-2xl bg-primary border-2 border-primary-dark flex items-center justify-center flex-shrink-0 shadow-(--shadow-clay-primary)">
              <FileText size={24} className="text-white" />
            </span>
            ניהול שיעורי בית
          </h1>
          <p className="text-base text-on-surface-variant">
            צרו שיעורי בית מותאמים אישית לכל תלמיד.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <ClayButton size="lg" className="w-fit gap-3 font-bold" onClick={() => setShowCreate(!showCreate)}>
            <Plus size={20} /> צור שיעורי בית חדשים
          </ClayButton>
          <button className="w-fit flex items-center gap-3 px-8 py-4 text-body-lg font-bold rounded-xl border-2 border-secondary text-secondary hover:bg-secondary/10 transition-all"
            onClick={() => setShowPdfBuilder(true)}>
            <Scissors size={20} /> מטלת PDF אישית
          </button>
        </div>

        {/* Packet imports — resume list. Without this there's no way back to a
            packet mid-review once you leave the review page. */}
        {packets && packets.filter((p) => p.status !== "cancelled").length > 0 && (
          <div className="mb-8">
            <div className="label-mono text-primary mb-3 text-lg border-b border-primary/20 pb-2 inline-block">
              ייבוא חוברות
            </div>
            <div className="flex flex-col gap-2">
              {packets
                .filter((p) => p.status !== "cancelled")
                .map((p) => {
                  const running = ["cropping", "inventory", "solving", "verifying"].includes(p.status);
                  const label =
                    p.status === "review" ? "מוכן לבדיקה" :
                    p.status === "failed" ? "נכשל" :
                    running ? "בעיבוד…" : p.status;
                  return (
                    <button
                      type="button"
                      key={p._id}
                      onClick={() => navigate(`/teacher/packet/${p._id}`)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl border-2 border-outline bg-surface text-right transition-all hover:border-primary/55 shadow-(--shadow-clay)"
                    >
                      <span className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center flex-shrink-0">
                        {running
                          ? <Loader2 size={18} className="animate-spin text-primary" />
                          : <Scissors size={18} className="text-primary" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-secondary truncate">{p.sourceName}</span>
                        <span className="block text-xs text-on-surface-variant">
                          {p.approved}/{p.total} אושרו · {formatDate(p.createdAt)}
                        </span>
                      </span>
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${
                        p.status === "failed"
                          ? "bg-error/15 text-error"
                          : p.status === "review"
                            ? "bg-primary/15 text-primary"
                            : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        {label}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Personal PDF assignments */}
        {pdfAssignments && pdfAssignments.length > 0 && (
          <div className="mb-8">
            <div className="label-mono text-secondary mb-3 text-lg border-b border-secondary/20 pb-2 inline-block">
              מטלות PDF אישיות
            </div>
            <div className="flex flex-col gap-2">
              {pdfAssignments.map((a) => {
                const isOpen = expandedPdfId === a._id;
                return (
                <div key={a._id} className="bg-surface rounded-2xl border-2 border-outline overflow-hidden shadow-(--shadow-clay)">
                  <div className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-primary/4 transition-colors"
                    onClick={() => setExpandedPdfId(isOpen ? null : a._id)}>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: a.avatarColor + "22", border: `2px solid ${a.avatarColor}66`, color: a.avatarColor }}>
                      <Scissors size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-base text-primary truncate">{a.title}</div>
                      <div className="label-mono text-secondary opacity-70 flex items-center gap-2.5 text-xs mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><User size={11} /> {a.studentName}</span>
                        <span className="flex items-center gap-1"><FileText size={11} /> {a.questionCount} שאלות · {a.partCount} סעיפים</span>
                        {a.completedAt && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-primary/15 text-primary">
                            <CheckCircle2 size={11} /> הושלם · {formatDate(a.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center bg-surface border border-primary/30 px-3 py-1 rounded-lg text-center flex-shrink-0">
                      <span className="num font-black text-base text-primary">{a.answeredCount}/{a.partCount}</span>
                      <span className="label-mono text-primary opacity-60 text-xs">נענו</span>
                    </div>
                    {a.answeredCount > 0 && (
                      <div className="flex flex-col items-center px-3 py-1 rounded-lg text-center flex-shrink-0"
                        style={{ background: a.scorePercent >= 70 ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : a.scorePercent >= 40 ? "color-mix(in srgb, var(--color-tertiary) 14%, transparent)" : "color-mix(in srgb, var(--color-error) 12%, transparent)", border: `1px solid ${a.scorePercent >= 70 ? "color-mix(in srgb, var(--color-primary) 30%, transparent)" : a.scorePercent >= 40 ? "color-mix(in srgb, var(--color-tertiary) 30%, transparent)" : "color-mix(in srgb, var(--color-error) 30%, transparent)"}` }}>
                        <span className="num font-black text-base" style={{ color: a.scorePercent >= 70 ? "var(--color-primary)" : a.scorePercent >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}>{a.scorePercent}%</span>
                        <span className="label-mono opacity-60 text-xs" style={{ color: a.scorePercent >= 70 ? "var(--color-primary)" : a.scorePercent >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}>ציון</span>
                      </div>
                    )}
                    <ChevronDown size={18} className={`text-secondary opacity-60 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
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
              <div className="clay-card bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] border border-primary p-8 w-full relative rounded-xl shadow-[0_0_30px_color-mix(in_srgb,var(--color-primary)_10%,transparent)]">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-primary rounded-r-xl" />
                <div className="label-mono text-secondary mb-6 text-lg border-b border-secondary/20 pb-3">
                  ממשק יצירת שיעורי בית
                </div>

                <div className="mb-5">
                  <label className="label-mono text-primary block mb-2 text-sm">כותרת המטלה</label>
                  <input className="w-full bg-surface border border-primary text-secondary p-3 text-base focus:outline-none focus:border-secondary transition-all font-medium placeholder:opacity-40 rounded-lg"
                    type="text" placeholder='לדוגמא: חזרה על חדו"א'
                    value={title} onChange={(e) => setTitle(e.target.value)} dir="rtl" />
                </div>

                <div className="mb-5">
                  <label className="label-mono text-primary block mb-2 text-sm">נושאים לכיסוי</label>
                  <div className="flex gap-2 flex-wrap">
                    {topics?.map((topic) => (
                      <button key={topic._id}
                        className={`px-3 py-1.5 border transition-all text-sm font-semibold rounded-lg ${selectedTopics.includes(topic._id) ? "bg-primary/20 border-primary text-primary" : "bg-surface border-primary/30 text-primary opacity-60 hover:opacity-100"}`}
                        onClick={() => toggleTopic(topic._id)}>
                        {topic.nameHe}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <label className="label-mono text-primary block mb-2 text-sm">שאלות מהספר (ייבוא AI)</label>
                  <div className="flex flex-wrap items-start gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-secondary text-secondary hover:bg-secondary/10 transition-all font-bold text-sm rounded-lg"
                    >
                      <Sparkles size={16} /> ייבא שאלה מתמונה / PDF
                    </button>
                    {classroomId && (
                      <button
                        type="button"
                        onClick={() => setShowCropBuilder(true)}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-primary text-primary hover:bg-primary/10 transition-all font-bold text-sm rounded-lg"
                      >
                        <Scissors size={16} /> ייבוא חוברת בחיתוך ידני (מומלץ)
                      </button>
                    )}
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
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-right transition-all ${pinned ? "border-primary bg-primary/12" : "border-outline-variant hover:border-primary/50"}`}
                          >
                            <span className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${pinned ? "border-primary bg-primary" : "border-outline-variant"}`}>
                              {pinned && <Check size={13} className="text-white" />}
                            </span>
                            <span className="flex-1 text-sm text-secondary truncate min-w-0">{imp.draft?.stem ?? "שאלה מיובאת"}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex-shrink-0">
                              {imp.draft?.format === "multiple_choice" ? "אמריקאית" : "השלמה"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {pinnedCount > 0 && (
                    <div className="mt-2 text-xs text-primary font-bold">
                      {pinnedCount} שאלות מיובאות יתווספו לכל תלמיד
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-5 mb-5">
                  <div className="flex-1 bg-surface-container-high p-4 border border-secondary/20 rounded-lg">
                    <label className="label-mono text-secondary block mb-2 text-xs">שאלות לתלמיד</label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setQuestionCount(n)}
                          className={`w-10 h-10 flex items-center justify-center border text-base font-black transition-all rounded ${questionCount === n ? "bg-secondary/20 border-secondary text-secondary" : "bg-surface border-secondary/30 text-secondary opacity-60 hover:opacity-100"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-surface-container-high p-4 border border-secondary/20 rounded-lg">
                    <label className="label-mono text-secondary block mb-2 text-xs">מועד הגשה (ימים)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button key={d} onClick={() => setDeadlineDays(d)}
                          className={`w-10 h-10 flex items-center justify-center border text-base font-black transition-all rounded ${deadlineDays === d ? "bg-secondary/20 border-secondary text-secondary" : "bg-surface border-secondary/30 text-secondary opacity-60 hover:opacity-100"}`}>{d}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="label-mono text-primary block mb-2 text-xs">הערות (אופציונלי)</label>
                  <textarea className="w-full bg-surface border border-primary text-secondary p-3 text-sm focus:outline-none focus:border-secondary transition-all placeholder:opacity-40 rounded-lg resize-y"
                    placeholder="לדוגמא: התמקדו בשאלות פרמטר..."
                    value={teacherNotes} onChange={(e) => setTeacherNotes(e.target.value)}
                    rows={3} dir="rtl" />
                </div>

                <div className="flex gap-3">
                  <ClayButton className="gap-2 px-6 py-2.5 text-body-sm font-bold" loading={creating}
                    onClick={handleCreate} disabled={creating || !title.trim() || selectedTopics.length === 0}>
                    {!creating && <Send size={16} />} {creating ? "מפעיל..." : "צור מטלות אישיות"}
                  </ClayButton>
                  <button className="px-6 py-2.5 border-2 border-error/50 text-error hover:bg-error/10 transition-all font-bold text-sm rounded-lg"
                    onClick={() => setShowCreate(false)}>ביטול</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="label-mono text-secondary mb-4 text-lg border-b border-secondary/20 pb-3 inline-block">
          מטלות פעילות וארכיון
        </div>

        <motion.div className="flex flex-col gap-3 w-full"
          initial="hidden" animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } }}>
          {!homeworkList || homeworkList.length === 0 ? (
            <div className="clay-card bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] border border-primary p-12 text-center rounded-xl text-primary opacity-60">
              <FileText size={48} className="mx-auto mb-3" />
              <div className="font-black text-xl mb-1">עוד לא יצרת מטלות</div>
              <div className="text-sm font-semibold opacity-80">התחל מ״צור שיעורי בית חדשים״ למעלה</div>
            </div>
          ) : homeworkList.map((hw) => {
            const isExpired = Date.now() > hw.deadline;
            const sc = hw.status === "graded" ? "var(--color-primary)" : hw.status === "closed" ? "gray" : isExpired ? "var(--color-error)" : "var(--color-secondary)";
            const sl = hw.status === "graded" ? "הוערך" : hw.status === "closed" ? "נסגר" : isExpired ? "עבר מועד" : "פעיל";
            return (
              <motion.div key={hw._id}
                className={`bg-surface p-4 cursor-pointer border-2 transition-all w-full relative overflow-hidden rounded-2xl hover:-translate-y-0.5 shadow-(--shadow-clay) ${selectedHwId === hw._id ? "border-primary" : "border-outline hover:border-primary/50"}`}
                onClick={() => setSelectedHwId(selectedHwId === hw._id ? null : hw._id)}
                variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
                {selectedHwId === hw._id && <div className="absolute top-0 right-0 w-1 h-full bg-secondary rounded-r-xl" />}
                <div className="flex justify-between items-center gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-surface border border-on-surface/8 rounded-xl">
                      <FileText size={24} style={{ color: sc, filter: `drop-shadow(0 0 6px ${sc})` }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-lg text-primary mb-0.5 truncate">{hw.title}</div>
                      <div className="label-mono text-secondary opacity-70 flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(hw.createdAt)}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(hw.deadline)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2.5 py-1 text-xs font-black border rounded"
                      style={{ background: `color-mix(in srgb, ${sc} 15%, transparent)`, color: sc, borderColor: sc }}>{sl}</span>
                    <div className="flex flex-col items-center bg-surface border border-primary/30 px-2.5 py-1 rounded-lg text-center">
                      <span className="num font-black text-base text-primary">{hw.questionCount}</span>
                      <span className="label-mono text-primary opacity-60 text-xs">שאלות</span>
                    </div>
                    {hw.status === "active" && (
                      <button className="flex items-center gap-1.5 px-2.5 py-2 border-2 border-error/50 text-error hover:bg-error/10 transition-all text-xs font-bold rounded-lg"
                        onClick={(e) => { e.stopPropagation(); handleClose(hw._id); }}>
                        <XCircle size={14} /> סגור
                      </button>
                    )}
                  </div>
                </div>
                {hw.teacherNotes && (
                  <div className="mt-3 pt-3 border-t border-t-primary/15 border-s-2 border-s-secondary text-xs text-secondary leading-relaxed bg-secondary/3 p-2.5 rounded-lg">
                    <strong className="text-primary">הנחייות: </strong>{hw.teacherNotes}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Right: Analytics */}
      <div className="w-full lg:w-[440px] lg:flex-shrink-0 flex flex-col gap-3 pb-10 lg:pb-20 lg:overflow-y-auto">
        <SegTabs
          label="תצוגת נתוני מטלה"
          className="flex-shrink-0 w-full [&>button]:flex-1"
          tabs={tabs.map((tab) => ({ id: tab.id, icon: <tab.Icon size={16} glow={0.5} animated={false} />, label: tab.label }))}
          value={activeTab}
          onChange={setActiveTab}
        />

        {!selectedHwId ? (
          <div className="clay-card bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] border border-primary p-12 text-center rounded-2xl text-secondary opacity-50">
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
                    { label: "הכל", value: "all" as const, count: totalStudents, color: "var(--color-secondary)" },
                    { label: "הגישו", value: "submitted" as const, count: submittedCount, color: "var(--color-primary)" },
                    { label: "טרם הגישו", value: "pending" as const, count: pendingCount + inProgressCount, color: "var(--color-error)" },
                  ] as const).map((f) => (
                    <button key={f.value} onClick={() => setStudentFilter(f.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
                      style={{ background: studentFilter === f.value ? `color-mix(in srgb, ${f.color} 15%, transparent)` : "var(--color-surface)", color: studentFilter === f.value ? f.color : "var(--color-on-surface-variant)", borderColor: studentFilter === f.value ? f.color : "var(--color-outline-variant)" }}>
                      {f.label} <span className="bg-surface-container-high px-1.5 py-0.5 rounded-full">{f.count}</span>
                    </button>
                  ))}
                </div>
                {totalStudents > 0 && (
                  <div className="clay-card p-4 rounded-xl border border-outline-variant">
                    <div className="flex justify-between text-xs mb-2 text-on-surface-variant">
                      <span>השלמת מטלה</span>
                      <span>{Math.round((submittedCount / totalStudents) * 100)}%</span>
                    </div>
                    <ProgressBar value={(submittedCount / totalStudents) * 100} variant="gradient" size="sm" label="השלמת מטלה" />
                    <div className="flex justify-between text-xs mt-2 text-on-surface-variant">
                      <span>{submittedCount} הגישו</span>
                      {inProgressCount > 0 && <span>{inProgressCount} בתהליך</span>}
                      <span>{pendingCount} טרם</span>
                    </div>
                  </div>
                )}
                {studentSubmissions === undefined ? (
                  <div className="flex items-center justify-center py-10 text-on-surface-variant">
                    <Loader2 size={20} className="animate-spin me-2" /> טוען...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredStudents.map((s) => {
                      const isSub = s.status === "submitted";
                      const isIP = s.status === "in_progress";
                      const isExpanded = expandedStudent === s.assignedQuestionId;
                      return (
                        <div key={s.assignedQuestionId}
                          className={`flex flex-col rounded-xl border transition-all bg-surface ${isSub ? "border-primary/20" : isIP ? "border-tertiary/20" : "border-outline-variant"}`}>
                          
                          {/* Row Header */}
                          <div 
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-on-surface/5 transition-colors"
                            onClick={() => setExpandedStudent(isExpanded ? null : s.assignedQuestionId)}
                          >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                              style={{ background: s.avatarColor + "33", border: `2px solid ${s.avatarColor}66`, color: s.avatarColor }}>
                              {s.studentName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate text-on-surface">{s.studentName}</div>
                              <div className="text-xs flex flex-wrap items-center gap-2 mt-0.5 text-on-surface-variant">
                                {isSub && s.submittedAt && <span className="flex items-center gap-1"><CheckCircle2 size={10} /> הושלם במלואו</span>}
                                {isIP && <span className="text-tertiary">פתר/ה {s.answersCount} מתוך {s.answersCount + 1 /* approx */} סעיפים</span>}
                                {s.status === "pending" && <span className="text-error">טרם התחיל</span>}
                                <span className="text-xs px-1.5 rounded bg-surface-container-high">רמה {s.assignedDifficulty}</span>
                                
                                {/* New stats */}
                                {s.totalTimeMs > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={10} /> {Math.ceil(s.totalTimeMs / 60000)} דקות
                                  </span>
                                )}
                                {s.aiInteractions > 0 && (
                                  <span className="flex items-center gap-1 text-secondary">
                                    <Zap size={10} /> {s.aiInteractions} עזרים מ-AI
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1.5">
                              {isSub ? (
                                <div className="flex flex-col items-end">
                                  <span className="num font-black text-base"
                                    style={{ color: s.score !== null && s.score >= 70 ? "var(--color-primary)" : s.score !== null && s.score >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}>
                                    {s.score !== null ? `${s.score}%` : "—"}
                                  </span>
                                </div>
                              ) : isIP ? (
                                <Loader2 size={16} className="animate-spin text-tertiary" />
                              ) : (
                                <Circle size={16} className="text-on-surface-variant opacity-35" />
                              )}
                              {isSub && s.score === 100 && <CheckCircle2 size={15} className="text-primary/70" />}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && s.answers && s.answers.length > 0 && (
                            <div className="p-4 border-t border-outline-variant bg-surface-container-high/50 rounded-b-xl">
                              <h4 className="text-xs font-bold mb-3 text-secondary">פירוט תשובות ({s.answers.length}):</h4>
                              <div className="flex flex-col gap-2">
                                {s.answers.map((ans, idx: number) => (
                                  <div key={idx} className="bg-surface p-3 rounded-lg border border-outline-variant text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-semibold text-on-surface">סעיף {ans.sectionLabel}</span>
                                      {ans.isCorrect !== undefined ? (
                                        <span className={`text-xs font-bold ${ans.isCorrect ? "text-primary" : "text-error"}`}>
                                          {ans.isCorrect ? "נכון ✓" : "שגוי ✗"}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-on-surface-variant">ממתין לבדיקה</span>
                                      )}
                                    </div>
                                    <div className="text-xs opacity-80 mb-1 text-on-surface">
                                      <span className="opacity-50 ms-1">תשובה:</span>
                                      {ans.studentAnswer}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                                      {ans.hintsUsed > 0 && <span className="flex items-center gap-1"><Zap size={10} className="text-tertiary" />{ans.hintsUsed} רמזים</span>}
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
                  <div className="flex items-center justify-center py-10 text-on-surface-variant">
                    <Loader2 size={20} className="animate-spin me-2" /> טוען...
                  </div>
                ) : questionStats.length === 0 ? (
                  <div className="clay-card p-10 text-center rounded-2xl text-on-surface-variant">
                    <SignalWave size={40} glow={0.8} className="mx-auto mb-3 block" />
                    <div className="text-sm">אין נתוני שאלות עדיין</div>
                    <div className="text-xs mt-1 opacity-60">יופיעו כשתלמידים יתחילו לענות</div>
                  </div>
                ) : questionStats.map((q) => {
                  const red = q.successRate !== null && q.successRate < 40;
                  const green = q.successRate !== null && q.successRate >= 70;
                  const qColor = red ? "var(--color-error)" : green ? "var(--color-primary)" : "var(--color-tertiary)";
                  return (
                    <div key={`${q.questionId}-${q.label}`} className={`p-4 rounded-xl border transition-all bg-surface border-s-4 ${red ? "border-error/25 border-s-error" : green ? "border-primary/20 border-s-primary" : "border-outline-variant border-s-tertiary"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-on-surface">
                          סעיף {q.label} <span className="opacity-40 text-xs">(רמה {q.difficulty})</span>
                        </span>
                        <span className="num font-black text-lg" style={{ color: qColor }}>
                          {q.successRate !== null ? `${q.successRate}%` : "—"}
                        </span>
                      </div>
                      <ProgressBar value={q.successRate ?? 0} color={qColor} className="h-1.5 mb-3" label={`סעיף ${q.label}`} />
                      <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                        <span>{q.correct}/{q.total} ענו נכון</span>
                        {q.avgHints > 0 && <span className="flex items-center gap-1"><Zap size={10} className="text-tertiary" />{q.avgHints} רמזים</span>}
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
                    <div className="clay-card bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] border border-primary p-7 text-center relative rounded-2xl">
                      <div className="label-mono text-secondary mb-2 text-sm">ציון ממוצע כיתתי</div>
                      <div className="num font-black text-6xl"
                        style={{ color: rundown.classAvgScore >= 70 ? "var(--color-primary)" : rundown.classAvgScore >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}>
                        {rundown.classAvgScore}%
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 clay-card bg-surface border border-secondary p-4 text-center rounded-xl">
                        <div className="label-mono text-secondary mb-1 text-xs">אחוז השלמה</div>
                        <div className="num font-black text-3xl text-secondary">{rundown.completionRate}%</div>
                      </div>
                      <div className="flex-1 clay-card bg-surface border border-secondary p-4 text-center rounded-xl">
                        <div className="label-mono text-secondary mb-1 text-xs">זמן ממוצע</div>
                        <div className="num font-black text-3xl text-secondary">{rundown.avgTimeMinutes}ד'</div>
                      </div>
                    </div>
                    {rundown.clusters.length > 0 && (
                      <div className="bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] border border-primary p-4 rounded-xl">
                        <div className="label-mono text-secondary mb-3 text-xs border-b border-secondary/20 pb-2">אשכולות למידה</div>
                        <div className="flex flex-col gap-2">
                          {rundown.clusters.map((cl, i: number) => {
                            const cc = cl.label === "מצטיינים" ? "var(--color-primary)" : cl.label === "צריכים חיזוק" ? "var(--color-error)" : "var(--color-tertiary)";
                            const clusterNames = cl.studentIds.map((id) => studentSubmissions?.find(s => s.studentId === id)?.studentName).filter((n): n is string => Boolean(n));
                            return (
                              <div key={i} className="bg-surface border border-secondary/15 border-s-4 p-3 rounded-lg" style={{ borderInlineStartColor: cc }}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Users size={14} style={{ color: cc }} />
                                  <span className="font-bold text-xs text-secondary">{cl.label}</span>
                                </div>
                                {clusterNames.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {clusterNames.map((name: string, idx: number) => (
                                      <span key={idx} className="text-xs px-1.5 py-0.5 rounded border bg-secondary/8 border-secondary/20 text-secondary">
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-xs text-primary leading-normal">{cl.recommendedAction}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {rundown.flagged.length > 0 && (
                      <div className="bg-error/5 border border-error p-4 rounded-xl">
                        <div className="label-mono text-error mb-3 text-xs flex items-center gap-2 border-b border-error/20 pb-2">
                          <AlertTriangle size={14} /> תלמידים שזקוקים לעזרה
                        </div>
                        <div className="flex flex-col gap-2">
                          {rundown.flagged.map((f, i: number) => {
                            const studentName = studentSubmissions?.find(s => s.studentId === f.studentId)?.studentName || "תלמיד";
                            return (
                              <div key={i} className="bg-surface border border-error/25 border-s-[3px] border-s-error p-2.5 rounded-lg text-xs font-medium text-error">
                                <span className="font-bold underline me-1">{studentName}:</span> {f.reason}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="clay-card bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] border border-primary p-12 text-center rounded-2xl text-primary opacity-50">
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

      {showCropBuilder && classroomId && (
        <PacketCropBuilder classroomId={classroomId} onClose={() => setShowCropBuilder(false)} />
      )}

      <AnimatePresence>
        {pdfToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 12, x: "-50%" }}
            onAnimationComplete={() => setTimeout(() => setPdfToast(null), 2400)}
            className="fixed bottom-6 left-1/2 z-[130] flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-[13.5px] bg-inverse-surface text-inverse-on-surface shadow-lg"
          >
            <CheckCircle2 size={16} className="text-primary" /> {pdfToast}
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
      <div className="flex items-center justify-center py-6 text-on-surface-variant border-t border-outline">
        <Loader2 size={18} className="animate-spin me-2" /> טוען...
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="border-t border-outline bg-surface-container-high/40 p-4 flex flex-col gap-3">
      {detail.pdfUrl && (
        <a href={detail.pdfUrl} target="_blank" rel="noreferrer"
          className="self-start flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-primary transition-colors">
          <FileText size={13} /> פתח את ה-PDF המקורי
        </a>
      )}
      {detail.questions.length === 0 ? (
        <div className="text-sm text-on-surface-variant py-2">אין שאלות במטלה זו.</div>
      ) : (
        detail.questions.map((q, qi) => (
          <div key={q._id} className="flex gap-3 bg-surface rounded-xl border border-outline p-2.5">
            <img src={`data:${q.imageMimeType};base64,${q.imageBase64}`} alt={`שאלה ${qi + 1}`}
              className="w-20 h-20 object-cover rounded-lg border border-outline bg-white flex-shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="text-xs font-bold text-primary">שאלה {qi + 1}</div>
              {q.parts.map((p, pi) => {
                const answered = p.studentAnswer != null;
                const correct = p.isCorrect === true;
                return (
                  <div key={pi} className="flex items-center gap-2 text-xs flex-wrap">
                    {p.label && <span className="w-5 h-5 flex-shrink-0 rounded bg-secondary/15 text-secondary flex items-center justify-center font-bold">{p.label}</span>}
                    {!answered ? (
                      <span className="text-on-surface-variant">טרם נענה</span>
                    ) : (
                      <>
                        {correct
                          ? <CheckCircle2 size={14} className="flex-shrink-0 text-primary" />
                          : <XCircle size={14} className="flex-shrink-0 text-error" />}
                        <span className="text-on-surface">
                          <span className="opacity-50">ענה: </span>
                          <strong className={correct ? "text-primary" : "text-error"}>{p.studentAnswer}</strong>
                        </span>
                        {!correct && (
                          <span className="text-on-surface-variant">
                            <span className="opacity-50">נכון: </span><strong className="text-primary">{p.correctAnswer}</strong>
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
