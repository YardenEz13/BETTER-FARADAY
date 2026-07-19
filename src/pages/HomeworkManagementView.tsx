import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PdfAssignmentBuilder from "../components/PdfAssignmentBuilder";
import PacketCropBuilder from "../components/PacketCropBuilder";
import { usePacketIngest } from "../components/usePacketIngest";
import MathText from "../components/MathText";
import { SegTabs, ProgressBar, ToastStack } from "../components/ui";
import { useCountUp } from "../lib/gsapUtils";
import { animateSafe, remove as animeRemove } from "../lib/anime";
import {
  FileText, Plus, Clock, XCircle, BookOpen,
  Users, AlertTriangle, CheckCircle as CheckCircle2, CircleIcon as Circle,
  Loader as Loader2, Zap, Scissors, User, BarChart2,
  Edit, Trash2, Send, Package, ChevronLeft, ArrowRight,
} from "../components/electric";
import { ElectricLoader } from "../components/electric/ElectricLoader";

type Bucket = "draft" | "active" | "closed";
type Filter = "all" | "draft" | "active" | "closed";
type Selection = { kind: "hw"; id: Id<"homework"> } | { kind: "pdf"; id: Id<"pdfAssignments"> } | null;

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function HomeworkManagementView({ classroomId }: { classroomId: Id<"classrooms"> | null }) {
  const navigate = useNavigate();

  const homeworkList = useQuery(
    api.homework.getHomeworkForTeacher,
    classroomId ? { classroomId } : "skip"
  );
  const pdfAssignments = useQuery(
    api.pdfAssignments.listForClassroom,
    classroomId ? { classroomId } : "skip"
  );
  const packets = useQuery(
    api.packetImport.listPackets,
    classroomId ? { classroomId } : "skip"
  );

  const closeHomework = useMutation(api.homework.closeHomework);
  const publishHomework = useMutation(api.homework.publishHomework);
  const deleteHomework = useMutation(api.homework.deleteHomework);
  const cancelScheduled = useMutation(api.homework.cancelScheduled);

  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Selection>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPdfBuilder, setShowPdfBuilder] = useState(false);
  const [showCropBuilder, setShowCropBuilder] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel: string; tone: "danger" | "primary"; onConfirm: () => void } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const packetInputRef = useRef<HTMLInputElement>(null);
  const { ingest: ingestPacket, busy: packetBusy, error: packetError } = usePacketIngest(classroomId);

  // Run a confirmed mutation: always close the dialog; surface failures.
  const runConfirmed = async (fn: () => Promise<unknown>, failMsg: string) => {
    try {
      await fn();
    } catch {
      setErrorMsg(failMsg);
      setTimeout(() => setErrorMsg(null), 3500);
    } finally {
      setConfirm(null);
    }
  };

  // ── Merge the three assignment sources into one date-sorted list ──
  type Item =
    | { kind: "hw"; id: Id<"homework">; title: string; status: string; dateMs: number; submitted: number; total: number; questionCount: number }
    | { kind: "pdf"; id: Id<"pdfAssignments">; title: string; status: string; dateMs: number; studentName: string; answeredCount: number; partCount: number }
    | { kind: "packet"; id: Id<"packetImports">; title: string; status: string; dateMs: number; approved: number; total: number };

  const items: Item[] = [];
  for (const hw of homeworkList ?? []) {
    items.push({ kind: "hw", id: hw._id, title: hw.title, status: hw.status, dateMs: hw.deadline ?? hw.createdAt, submitted: hw.submitted, total: hw.total, questionCount: hw.questionCount });
  }
  for (const a of pdfAssignments ?? []) {
    items.push({ kind: "pdf", id: a._id, title: a.title, status: a.status, dateMs: a.deadline ?? a.createdAt, studentName: a.studentName, answeredCount: a.answeredCount, partCount: a.partCount });
  }
  for (const p of packets ?? []) {
    if (p.status === "cancelled") continue;
    items.push({ kind: "packet", id: p._id, title: p.sourceName, status: p.status, dateMs: p.createdAt, approved: p.approved, total: p.total });
  }
  items.sort((a, b) => b.dateMs - a.dateMs);

  const bucketOf = (it: Item): Bucket => {
    if (it.kind === "hw") {
      if (it.status === "draft" || it.status === "scheduled") return "draft";
      if (it.status === "active") return "active";
      return "closed";
    }
    if (it.kind === "pdf") return it.status === "active" ? "active" : "closed";
    return "active"; // packets in progress
  };

  const filtered = filter === "all" ? items : items.filter((it) => bucketOf(it) === filter);

  const counts = {
    all: items.length,
    draft: items.filter((it) => bucketOf(it) === "draft").length,
    active: items.filter((it) => bucketOf(it) === "active").length,
    closed: items.filter((it) => bucketOf(it) === "closed").length,
  };

  const openRow = (it: Item) => {
    if (it.kind === "packet") { navigate(`/teacher/packet/${it.id}`); return; }
    if (it.kind === "hw") setSelected({ kind: "hw", id: it.id });
    else setSelected({ kind: "pdf", id: it.id });
  };

  const isSelected = (it: Item) =>
    selected?.kind === it.kind && (it.kind === "hw" || it.kind === "pdf") && selected.id === it.id;

  const handlePublish = (id: Id<"homework">) =>
    setConfirm({
      title: "פרסום מטלה", message: "השאלות ייווצרו לכל התלמידים והמטלה תהפוך לפעילה. להמשיך?",
      confirmLabel: "פרסם", tone: "primary",
      onConfirm: () => runConfirmed(() => publishHomework({ homeworkId: id }), "פרסום המטלה נכשל. נסו שוב."),
    });

  const handleDelete = (id: Id<"homework">) =>
    setConfirm({
      title: "מחיקת טיוטה", message: "הטיוטה תימחק לצמיתות. לא ניתן לשחזר.",
      confirmLabel: "מחק", tone: "danger",
      onConfirm: () => runConfirmed(async () => {
        if (selected?.kind === "hw" && selected.id === id) setSelected(null);
        await deleteHomework({ homeworkId: id });
      }, "מחיקת הטיוטה נכשלה. נסו שוב."),
    });

  const handleClose = (id: Id<"homework">) =>
    setConfirm({
      title: "סגירת מטלה", message: "סגירת המטלה תפיק סיכום כיתתי מבוסס-AI ותנעל הגשות. הפעולה אינה הפיכה.",
      confirmLabel: "סגור מטלה", tone: "danger",
      onConfirm: () => runConfirmed(() => closeHomework({ homeworkId: id }), "סגירת המטלה נכשלה. נסו שוב."),
    });

  const handleCancelSchedule = (id: Id<"homework">) =>
    setConfirm({
      title: "ביטול תזמון", message: "הפרסום המתוזמן יבוטל והמטלה תחזור להיות טיוטה.",
      confirmLabel: "בטל תזמון", tone: "primary",
      onConfirm: () => runConfirmed(() => cancelScheduled({ homeworkId: id }), "ביטול התזמון נכשל. נסו שוב."),
    });

  return (
    <div className="flex flex-col lg:flex-row w-full h-full gap-4 lg:gap-6 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden" dir="rtl">
      {/* ══════════ LEFT: list ══════════ */}
      <div className="flex-1 flex flex-col lg:overflow-y-auto pb-10 lg:pb-20 min-w-0 w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-surface border-2 border-outline flex items-center justify-center flex-shrink-0">
              <BookOpen size={22} className="text-primary" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-on-surface">ניהול מטלות</h1>
              <p className="text-sm text-on-surface-variant">כל המטלות של הכיתה במקום אחד.</p>
            </div>
          </div>

          {/* Type picker */}
          <div className="relative">
            <button className="btn-clay-primary !px-5 !py-2.5 !text-sm" onClick={() => setMenuOpen((v) => !v)}>
              <Plus size={18} /> מטלה חדשה
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute z-40 mt-2 end-0 w-64 rounded-2xl border-2 border-outline bg-surface overflow-hidden shadow-(--shadow-clay)">
                  <MenuItem Icon={FileText} title="מטלה אדפטיבית" subtitle="שאלות מותאמות לכל תלמיד" onClick={() => { setMenuOpen(false); navigate("/teacher/homework/new"); }} />
                  <MenuItem Icon={Scissors} title="מטלת PDF אישית" subtitle="חיתוך שאלות לתלמיד יחיד" onClick={() => { setMenuOpen(false); setShowPdfBuilder(true); }} />
                  <MenuItem Icon={Package} title="ייבוא חוברת בחיתוך ידני" subtitle="חוברת שלמה, סימון שאלות בעצמכם" onClick={() => { setMenuOpen(false); setShowCropBuilder(true); }} />
                  <MenuItem Icon={Zap} title="ייבוא חוברת אוטומטי" subtitle="חילוץ שאלות מ-PDF באמצעות AI" onClick={() => { setMenuOpen(false); packetInputRef.current?.click(); }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {([
            { v: "all" as const, label: "הכל", c: counts.all },
            { v: "draft" as const, label: "טיוטות", c: counts.draft },
            { v: "active" as const, label: "פעילות", c: counts.active },
            { v: "closed" as const, label: "סגורות", c: counts.closed },
          ]).map((f) => {
            const on = filter === f.v;
            return (
              <button key={f.v} onClick={() => setFilter(f.v)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors"
                style={{
                  background: on ? "var(--color-primary)" : "var(--color-surface)",
                  borderColor: on ? "var(--color-primary)" : "var(--color-outline)",
                  color: on ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                }}>
                {f.label}
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: on ? "color-mix(in srgb, black 12%, transparent)" : "var(--color-surface-container-high)" }}>{f.c}</span>
              </button>
            );
          })}
        </div>

        {/* List — rows cascade in */}
        <motion.div
          className="flex flex-col gap-2.5 w-full"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {homeworkList === undefined ? (
            <ElectricLoader fullscreen={false} size={36} className="py-6" />
          ) : filtered.length === 0 ? (
            <div className="clay-card p-10 text-center">
              <BookOpen size={40} className="mx-auto mb-3 text-on-surface-variant" />
              <div className="font-bold text-base text-on-surface mb-1">אין מטלות להצגה</div>
              <div className="text-sm text-on-surface-variant">התחילו מ״מטלה חדשה״ למעלה.</div>
            </div>
          ) : filtered.map((it) => (
            <motion.div key={`${it.kind}-${it.id}`} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
              <AssignmentRow
                it={it}
                selected={isSelected(it)}
                onOpen={() => openRow(it)}
                onEdit={it.kind === "hw" ? () => navigate(`/teacher/homework/${it.id}/edit`) : undefined}
                onPublish={it.kind === "hw" ? () => handlePublish(it.id) : undefined}
                onDelete={it.kind === "hw" ? () => handleDelete(it.id) : undefined}
                onClose={it.kind === "hw" ? () => handleClose(it.id) : undefined}
                onCancelSchedule={it.kind === "hw" ? () => handleCancelSchedule(it.id) : undefined}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ══════════ RIGHT: detail ══════════ */}
      <div className="w-full lg:w-[440px] lg:flex-shrink-0 flex flex-col gap-3 pb-10 lg:pb-20 lg:overflow-y-auto">
        {selected?.kind === "hw" ? (
          <HomeworkDetail homeworkId={selected.id} />
        ) : selected?.kind === "pdf" ? (
          <div className="clay-card overflow-hidden">
            <PdfAssignmentDetail assignmentId={selected.id} />
          </div>
        ) : (
          <div className="clay-card p-12 text-center text-on-surface-variant">
            <BarChart2 size={44} className="mx-auto mb-3" />
            <div className="font-semibold text-sm">בחרו מטלה לצפייה בנתונים</div>
          </div>
        )}
      </div>

      {/* Hidden picker for the auto packet import (menu: ייבוא חוברת אוטומטי) */}
      <input
        ref={packetInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) ingestPacket(f);
        }}
      />
      {packetBusy && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm bg-inverse-surface text-inverse-on-surface shadow-lg">
          <Loader2 size={16} className="animate-spin" /> מעלה את החוברת…
        </div>
      )}

      {/* Modals */}
      {showPdfBuilder && classroomId && (
        <PdfAssignmentBuilder classroomId={classroomId} onClose={() => setShowPdfBuilder(false)} />
      )}
      {showCropBuilder && classroomId && (
        <PacketCropBuilder classroomId={classroomId} onClose={() => setShowCropBuilder(false)} />
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/45" onClick={() => setConfirm(null)}>
          <div className="clay-card w-full max-w-[26rem] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-extrabold text-on-surface mb-2">{confirm.title}</div>
            <p className="text-sm text-on-surface-variant mb-5 leading-relaxed">{confirm.message}</p>
            <div className="flex gap-3">
              <button className="btn-clay-ghost flex-1 !py-2.5" onClick={() => setConfirm(null)}>ביטול</button>
              <button
                className="flex-1 !py-2.5 inline-flex items-center justify-center gap-2 rounded-2xl border-2 font-semibold cursor-pointer"
                style={{
                  background: confirm.tone === "danger" ? "var(--color-error)" : "var(--color-primary)",
                  borderColor: confirm.tone === "danger" ? "var(--color-error)" : "var(--color-primary)",
                  color: confirm.tone === "danger" ? "var(--color-on-error)" : "var(--color-on-primary)",
                }}
                onClick={confirm.onConfirm}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {(errorMsg ?? packetError) && (
        <ToastStack toasts={[{ id: 1, kind: "error", title: "משהו השתבש", description: errorMsg ?? packetError }]} />
      )}
    </div>
  );
}

function MenuItem({ Icon, title, subtitle, onClick }: { Icon: typeof FileText; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full px-4 py-3 text-start hover:bg-surface-container-high transition-colors">
      <span className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0 text-primary"><Icon size={18} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-on-surface">{title}</span>
        <span className="block text-xs text-on-surface-variant truncate">{subtitle}</span>
      </span>
    </button>
  );
}

// ── One row in the unified assignment list ──
type RowItem =
  | { kind: "hw"; id: Id<"homework">; title: string; status: string; dateMs: number; submitted: number; total: number; questionCount: number }
  | { kind: "pdf"; id: Id<"pdfAssignments">; title: string; status: string; dateMs: number; studentName: string; answeredCount: number; partCount: number }
  | { kind: "packet"; id: Id<"packetImports">; title: string; status: string; dateMs: number; approved: number; total: number };

function statusChip(it: RowItem): { label: string; color: string } {
  if (it.kind === "hw") {
    switch (it.status) {
      case "draft": return { label: "טיוטה", color: "var(--color-on-surface-variant)" };
      case "scheduled": return { label: "מתוזמן", color: "var(--color-secondary)" };
      case "active": return { label: "פעיל", color: "var(--color-primary)" };
      case "graded": return { label: "הוערך", color: "var(--color-on-surface-variant)" };
      default: return { label: "נסגר", color: "var(--color-on-surface-variant)" };
    }
  }
  if (it.kind === "pdf") return it.status === "active"
    ? { label: "פעיל", color: "var(--color-primary)" }
    : { label: "הושלם", color: "var(--color-on-surface-variant)" };
  // packet
  const running = ["cropping", "inventory", "solving", "verifying"].includes(it.status);
  if (it.status === "review") return { label: "מוכן לבדיקה", color: "var(--color-primary)" };
  if (it.status === "failed") return { label: "נכשל", color: "var(--color-error)" };
  return { label: running ? "בעיבוד" : it.status, color: "var(--color-tertiary)" };
}

function AssignmentRow({ it, selected, onOpen, onEdit, onPublish, onDelete, onClose, onCancelSchedule }: {
  it: RowItem; selected: boolean; onOpen: () => void;
  onEdit?: () => void; onPublish?: () => void; onDelete?: () => void; onClose?: () => void;
  onCancelSchedule?: () => void;
}) {
  const chip = statusChip(it);
  const RowIcon = it.kind === "hw" ? FileText : it.kind === "pdf" ? Scissors : Package;
  // Edit/Publish/Delete are backend-guarded to status === "draft" — a scheduled
  // row only offers "בטל תזמון", which reverts it to a draft first.
  const isDraft = it.kind === "hw" && it.status === "draft";
  const isScheduled = it.kind === "hw" && it.status === "scheduled";
  const isActiveHw = it.kind === "hw" && it.status === "active";

  return (
    <div
      onClick={onOpen}
      className={`rounded-2xl bg-surface p-4 cursor-pointer border-2 transition-colors w-full shadow-(--shadow-clay) ${selected ? "border-primary" : "border-outline"}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0 text-on-surface-variant">
          <RowIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-base text-on-surface truncate">{it.title}</div>
          <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(it.dateMs)}</span>
            {it.kind === "hw" && it.total > 0 && (
              <span className="flex items-center gap-1"><Users size={12} /> {it.submitted}/{it.total} הגישו</span>
            )}
            {it.kind === "pdf" && (
              <span className="flex items-center gap-1"><User size={12} /> {it.studentName}</span>
            )}
            {it.kind === "packet" && (
              <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {it.approved}/{it.total} אושרו</span>
            )}
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${chip.color} 14%, transparent)`, color: chip.color }}>
          {chip.label}
        </span>
      </div>

      {/* Row actions */}
      {(isDraft || isScheduled || isActiveHw) && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t-2 border-outline">
          {isScheduled && (
            <button onClick={(e) => { e.stopPropagation(); onCancelSchedule?.(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors"
              style={{ borderColor: "var(--color-secondary)", color: "var(--color-secondary)" }}>
              <XCircle size={14} /> בטל תזמון
            </button>
          )}
          {isDraft && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-outline text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors">
                <Edit size={14} /> עריכה
              </button>
              <button onClick={(e) => { e.stopPropagation(); onPublish?.(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors"
                style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                <Send size={14} /> פרסם
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors"
                style={{ borderColor: "color-mix(in srgb, var(--color-error) 45%, var(--color-outline))", color: "var(--color-error)" }}>
                <Trash2 size={14} /> מחק
              </button>
            </>
          )}
          {isActiveHw && (
            <button onClick={(e) => { e.stopPropagation(); onClose?.(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors"
              style={{ borderColor: "color-mix(in srgb, var(--color-error) 45%, var(--color-outline))", color: "var(--color-error)" }}>
              <XCircle size={14} /> סגור מטלה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Right-panel detail for an adaptive homework (tabs) ──
function HomeworkDetail({ homeworkId }: { homeworkId: Id<"homework"> }) {
  const [activeTab, setActiveTab] = useState<"students" | "questions" | "overview">("students");
  const [studentFilter, setStudentFilter] = useState<"all" | "submitted" | "pending">("all");
  // Master→detail: null = compact list of all students; set = drill into one student's questions.
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const rundown = useQuery(api.homeworkRundown.getRundown, { homeworkId });
  const studentSubmissions = useQuery(api.homework.getStudentSubmissions, { homeworkId });
  const questionStats = useQuery(api.homework.getHomeworkQuestionStats, { homeworkId });

  // Each student gets several assigned questions (one per difficulty level), so
  // getStudentSubmissions returns multiple rows per student. Collapse to one row
  // per student; the drill-in shows all of that student's questions.
  const studentGroups = studentSubmissions ? groupByStudent(studentSubmissions) : undefined;

  const submittedCount = studentGroups?.filter((g) => g.status === "submitted").length ?? 0;
  const inProgressCount = studentGroups?.filter((g) => g.status === "in_progress").length ?? 0;
  const pendingCount = studentGroups?.filter((g) => g.status === "pending").length ?? 0;
  const totalStudents = studentGroups?.length ?? 0;

  const filteredStudents = studentGroups?.filter((g) => {
    if (studentFilter === "submitted") return g.status === "submitted";
    if (studentFilter === "pending") return g.status !== "submitted";
    return true;
  }) ?? [];

  const openStudent = openStudentId
    ? studentGroups?.find((g) => g.studentId === openStudentId) ?? null
    : null;

  const tabs = [
    { id: "students" as const, label: "תלמידים", Icon: Users },
    { id: "questions" as const, label: "איפה נתקעו", Icon: AlertTriangle },
    { id: "overview" as const, label: "תמונת מצב", Icon: BarChart2 },
  ];

  return (
    <>
      {/* Tab bar */}
      <SegTabs
        label="תצוגת נתוני מטלה"
        className="flex-shrink-0 w-full [&>button]:flex-1"
        tabs={tabs.map((tab) => ({ id: tab.id, icon: <tab.Icon size={15} />, label: tab.label }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* STUDENTS — master list ↔ drill-in swap slides like a native stack */}
      {activeTab === "students" && (
        <AnimatePresence mode="wait" initial={false}>
          {openStudent ? (
            <motion.div
              key={`drill-${openStudent.studentId}`}
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <StudentQuestionsPanel g={openStudent} onBack={() => setOpenStudentId(null)} />
            </motion.div>
          ) : (
          <motion.div
            key="master"
            className="flex flex-col gap-3"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex gap-2 flex-wrap">
              {([
                { label: "הכל", value: "all" as const, count: totalStudents },
                { label: "הגישו", value: "submitted" as const, count: submittedCount },
                { label: "טרם הגישו", value: "pending" as const, count: pendingCount + inProgressCount },
              ]).map((f) => {
                const on = studentFilter === f.value;
                return (
                  <button key={f.value} onClick={() => setStudentFilter(f.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors"
                    style={{ background: on ? "var(--color-primary)" : "var(--color-surface)", borderColor: on ? "var(--color-primary)" : "var(--color-outline)", color: on ? "var(--color-on-primary)" : "var(--color-on-surface-variant)" }}>
                    {f.label} <span className="px-1.5 py-0.5 rounded-full" style={{ background: on ? "color-mix(in srgb, black 12%, transparent)" : "var(--color-surface-container-high)" }}>{f.count}</span>
                  </button>
                );
              })}
            </div>

            {totalStudents > 0 && (
              <CompletionCard submitted={submittedCount} inProgress={inProgressCount} pending={pendingCount} total={totalStudents} />
            )}

            {studentSubmissions === undefined ? (
              <ElectricLoader fullscreen={false} size={36} className="py-6" />
            ) : (
              <motion.div
                className="flex flex-col gap-2"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.045 } } }}
              >
                {filteredStudents.map((g) => {
                  const isSub = g.status === "submitted";
                  const isIP = g.status === "in_progress";
                  return (
                    <motion.div key={g.studentId}
                      variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
                      whileHover={{ y: -2 }}
                      className="flex items-center gap-3 p-3 rounded-xl border-2 border-outline bg-surface cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setOpenStudentId(g.studentId)}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                        style={{ background: g.avatarColor + "22", border: `2px solid ${g.avatarColor}55`, color: g.avatarColor }}>
                        {g.studentName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-on-surface truncate">{g.studentName}</div>
                        <div className="text-xs flex flex-wrap items-center gap-2 mt-0.5 text-on-surface-variant">
                          {isSub && <span className="flex items-center gap-1"><CheckCircle2 size={11} /> הושלם</span>}
                          {isIP && <span className="text-tertiary">בתהליך</span>}
                          {g.status === "pending" && <span className="text-error">טרם התחיל</span>}
                          <span className="px-1.5 rounded bg-surface-container-high">{g.subs.length} שאלות</span>
                          {g.totalTimeMs > 0 && <span className="flex items-center gap-1"><Clock size={11} /> {Math.ceil(g.totalTimeMs / 60000)} דק׳</span>}
                          {g.aiInteractions > 0 && <span className="flex items-center gap-1"><Zap size={11} /> {g.aiInteractions} AI</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isSub ? (
                          <span className="num font-extrabold text-base" style={{ color: g.score !== null && g.score >= 70 ? "var(--color-primary)" : g.score !== null && g.score >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}>
                            {g.score !== null ? `${g.score}%` : "—"}
                          </span>
                        ) : isIP ? (
                          <Loader2 size={16} className="animate-spin text-tertiary" />
                        ) : (
                          <Circle size={16} className="text-on-surface-variant" />
                        )}
                      </div>
                      <ChevronLeft size={16} className="text-on-surface-variant flex-shrink-0" />
                    </motion.div>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <div className="clay-card p-8 text-center text-sm text-on-surface-variant">אין תלמידים בקטגוריה זו.</div>
                )}
              </motion.div>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* QUESTIONS */}
      {activeTab === "questions" && (
        <div className="flex flex-col gap-3">
          {questionStats === undefined ? (
            <ElectricLoader fullscreen={false} size={36} className="py-6" />
          ) : questionStats.length === 0 ? (
            <div className="clay-card p-10 text-center text-on-surface-variant">
              <AlertTriangle size={36} className="mx-auto mb-3" />
              <div className="text-sm">אין נתוני שאלות עדיין</div>
              <div className="text-xs mt-1">יופיעו כשתלמידים יתחילו לענות.</div>
            </div>
          ) : questionStats.map((q) => {
            const red = q.successRate !== null && q.successRate < 40;
            const green = q.successRate !== null && q.successRate >= 70;
            const qColor = red ? "var(--color-error)" : green ? "var(--color-primary)" : "var(--color-tertiary)";
            return (
              <div key={`${q.questionId}-${q.label}`} className="p-4 rounded-xl border-2 border-outline bg-surface" style={{ borderInlineStartWidth: 4, borderInlineStartColor: qColor }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-on-surface">סעיף {q.label} <span className="text-on-surface-variant text-xs">(רמה {q.difficulty})</span></span>
                  <span className="num font-extrabold text-lg" style={{ color: qColor }}>{q.successRate !== null ? `${q.successRate}%` : "—"}</span>
                </div>
                <ProgressBar value={q.successRate ?? 0} color={qColor} className="h-1.5 mb-3" label={`סעיף ${q.label}`} />
                <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                  <span>{q.correct}/{q.total} ענו נכון</span>
                  {q.avgHints > 0 && <span className="flex items-center gap-1"><Zap size={10} className="text-tertiary" />{q.avgHints} רמזים</span>}
                  {q.avgTimeSec > 0 && <span className="flex items-center gap-1"><Clock size={10} />{q.avgTimeSec}שנ׳</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-3">
          {rundown ? (
            <>
              <div className="clay-card p-6 text-center">
                <div className="text-sm font-semibold text-on-surface-variant mb-2">ציון ממוצע כיתתי</div>
                <div className="num font-extrabold text-5xl" style={{ color: rundown.classAvgScore >= 70 ? "var(--color-primary)" : rundown.classAvgScore >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}>
                  {rundown.classAvgScore}%
                </div>
              </div>
              <div className="flex gap-3">
                <div className="clay-card flex-1 p-4 text-center">
                  <div className="text-xs font-semibold text-on-surface-variant mb-1">אחוז השלמה</div>
                  <div className="num font-extrabold text-2xl text-on-surface">{rundown.completionRate}%</div>
                </div>
                <div className="clay-card flex-1 p-4 text-center">
                  <div className="text-xs font-semibold text-on-surface-variant mb-1">זמן ממוצע</div>
                  <div className="num font-extrabold text-2xl text-on-surface">{rundown.avgTimeMinutes}ד׳</div>
                </div>
              </div>
              {rundown.clusters.length > 0 && (
                <div className="clay-card p-4">
                  <div className="text-sm font-semibold text-on-surface mb-3">אשכולות למידה</div>
                  <div className="flex flex-col gap-2">
                    {rundown.clusters.map((cl, i: number) => {
                      const cc = cl.label === "מצטיינים" ? "var(--color-primary)" : cl.label === "צריכים חיזוק" ? "var(--color-error)" : "var(--color-tertiary)";
                      const clusterNames = cl.studentIds.map((id) => studentSubmissions?.find((s) => s.studentId === id)?.studentName).filter((n): n is string => Boolean(n));
                      return (
                        <div key={i} className="bg-surface-container-low border-2 border-outline p-3 rounded-lg" style={{ borderInlineStartWidth: 4, borderInlineStartColor: cc }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Users size={14} style={{ color: cc }} />
                            <span className="font-bold text-xs text-on-surface">{cl.label}</span>
                          </div>
                          {clusterNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {clusterNames.map((name: string, idx: number) => (
                                <span key={idx} className="text-xs px-1.5 py-0.5 rounded border-2 border-outline bg-surface text-on-surface-variant">{name}</span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-on-surface leading-relaxed">{cl.recommendedAction}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {rundown.flagged.length > 0 && (
                <div className="clay-card p-4">
                  <div className="text-sm font-semibold text-error mb-3 flex items-center gap-2"><AlertTriangle size={14} /> תלמידים שזקוקים לעזרה</div>
                  <div className="flex flex-col gap-2">
                    {rundown.flagged.map((f, i: number) => {
                      const studentName = studentSubmissions?.find((s) => s.studentId === f.studentId)?.studentName || "תלמיד";
                      return (
                        <div key={i} className="bg-surface-container-low border-2 border-outline p-2.5 rounded-lg text-xs text-on-surface" style={{ borderInlineStartWidth: 3, borderInlineStartColor: "var(--color-error)" }}>
                          <span className="font-bold me-1">{studentName}:</span>{f.reason}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="clay-card p-12 text-center text-on-surface-variant">
              <BarChart2 size={44} className="mx-auto mb-3" />
              <div className="font-semibold text-sm">סיכום כיתתי יהיה זמין לאחר סגירת המטלה.</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Completion summary — GSAP count-up % + anime.js charged progress bar ──
function CompletionCard({ submitted, inProgress, pending, total }: {
  submitted: number; inProgress: number; pending: number; total: number;
}) {
  const pct = Math.round((submitted / total) * 100);
  const pctRef = useCountUp<HTMLSpanElement>(pct, { suffix: "%", duration: 1 });
  const barRef = useRef<HTMLDivElement>(null);

  // The fill "charges up" to its width, then a soft glow pulse lands on arrival.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const anim = animateSafe(el, {
      width: [`0%`, `${pct}%`],
      duration: 900,
      ease: "outCubic",
      onComplete: () => {
        animateSafe(el, {
          boxShadow: [
            "0 0 0px color-mix(in srgb, var(--color-primary) 0%, transparent)",
            "0 0 12px color-mix(in srgb, var(--color-primary) 65%, transparent)",
            "0 0 0px color-mix(in srgb, var(--color-primary) 0%, transparent)",
          ],
          duration: 700,
          ease: "inOutQuad",
        });
      },
    });
    if (!anim) el.style.width = `${pct}%`; // reduced motion: jump to the value
    return () => { if (el) animeRemove(el); };
  }, [pct]);

  return (
    <div className="clay-card p-4">
      <div className="flex justify-between text-xs text-on-surface-variant mb-2">
        <span>השלמת מטלה</span>
        <span className="num" ref={pctRef}>{pct}%</span>
      </div>
      <div className="w-full rounded-full h-2 overflow-hidden bg-surface-container-high">
        <div ref={barRef} className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
      </div>
      <div className="flex justify-between text-xs mt-2 text-on-surface-variant">
        <span>{submitted} הגישו</span>
        {inProgress > 0 && <span>{inProgress} בתהליך</span>}
        <span>{pending} טרם</span>
      </div>
    </div>
  );
}

// ── Collapse per-assignment rows into one entry per student ──
type StudentSub = FunctionReturnType<typeof api.homework.getStudentSubmissions>[number];
type StudentGroup = {
  studentId: StudentSub["studentId"];
  studentName: string;
  avatarColor: string;
  subs: StudentSub[];
  status: "submitted" | "in_progress" | "pending";
  score: number | null;
  totalTimeMs: number;
  aiInteractions: number;
};

function groupByStudent(subs: StudentSub[]): StudentGroup[] {
  const map = new Map<string, StudentSub[]>();
  const order: string[] = [];
  for (const s of subs) {
    const key = s.studentId as string;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(s);
  }
  const groups = order.map((key) => {
    const g = map.get(key)!;
    const status: StudentGroup["status"] =
      g.every((s) => s.status === "submitted") ? "submitted"
      : g.every((s) => s.status === "pending") ? "pending"
      : "in_progress";
    const scored = g.filter((s) => s.status === "submitted" && s.score !== null);
    const score = scored.length
      ? Math.round(scored.reduce((sum, s) => sum + (s.score as number), 0) / scored.length)
      : null;
    return {
      studentId: g[0].studentId,
      studentName: g[0].studentName,
      avatarColor: g[0].avatarColor,
      subs: g,
      status,
      score,
      totalTimeMs: g.reduce((sum, s) => sum + s.totalTimeMs, 0),
      aiInteractions: g.reduce((sum, s) => sum + s.aiInteractions, 0),
    };
  });
  const statusOrder: Record<StudentGroup["status"], number> = { submitted: 0, in_progress: 1, pending: 2 };
  groups.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  return groups;
}

// ── Drill-in: one student, all of their assigned questions for this homework ──
function StudentQuestionsPanel({ g, onBack }: { g: StudentGroup; onBack: () => void }) {
  const isSub = g.status === "submitted";
  const isIP = g.status === "in_progress";
  const scoreColor = (v: number | null) =>
    v !== null && v >= 70 ? "var(--color-primary)" : v !== null && v >= 40 ? "var(--color-tertiary)" : "var(--color-error)";

  return (
    <div className="flex flex-col gap-3">
      {/* Back */}
      <button onClick={onBack}
        className="self-start flex items-center gap-1.5 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">
        <ArrowRight size={16} /> חזרה לכל התלמידים
      </button>

      {/* Student header */}
      <div className="clay-card p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold"
          style={{ background: g.avatarColor + "22", border: `2px solid ${g.avatarColor}55`, color: g.avatarColor }}>
          {g.studentName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-base text-on-surface truncate">{g.studentName}</div>
          <div className="text-xs flex flex-wrap items-center gap-2 mt-0.5 text-on-surface-variant">
            {isSub && <span className="flex items-center gap-1"><CheckCircle2 size={11} /> הושלם</span>}
            {isIP && <span className="text-tertiary">בתהליך</span>}
            {g.status === "pending" && <span className="text-error">טרם התחיל</span>}
            <span className="px-1.5 rounded bg-surface-container-high">{g.subs.length} שאלות</span>
            {g.totalTimeMs > 0 && <span className="flex items-center gap-1"><Clock size={11} /> {Math.ceil(g.totalTimeMs / 60000)} דק׳</span>}
            {g.aiInteractions > 0 && <span className="flex items-center gap-1"><Zap size={11} /> {g.aiInteractions} AI</span>}
          </div>
        </div>
        {isSub && (
          <span className="num font-extrabold text-xl flex-shrink-0" style={{ color: scoreColor(g.score) }}>
            {g.score !== null ? `${g.score}%` : "—"}
          </span>
        )}
      </div>

      {/* One card per assigned question */}
      {g.subs.map((s, qi) => {
        const answers = s.answers ?? [];
        return (
          <div key={s.assignedQuestionId} className="clay-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-on-surface">שאלה {qi + 1}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">רמה {s.assignedDifficulty}</span>
              </div>
              {s.status === "submitted" ? (
                <span className="num font-extrabold text-sm" style={{ color: scoreColor(s.score) }}>
                  {s.score !== null ? `${s.score}%` : "—"}
                </span>
              ) : s.status === "in_progress" ? (
                <span className="text-xs text-tertiary">בתהליך</span>
              ) : (
                <span className="text-xs text-on-surface-variant">טרם התחיל</span>
              )}
            </div>

            {answers.length === 0 ? (
              <div className="text-xs text-on-surface-variant">
                {s.status === "pending" ? "התלמיד עדיין לא התחיל שאלה זו." : "אין תשובות להצגה עדיין."}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {answers.map((ans, idx: number) => (
                  <div key={idx} className="bg-surface-container-low p-3 rounded-lg border-2 border-outline text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-on-surface">סעיף {ans.sectionLabel}</span>
                      <span className="flex items-center gap-2">
                        {(ans.attempts ?? 1) > 1 && (
                          <span
                            className="text-xs font-bold num px-1.5 py-0.5 rounded bg-surface-container-high"
                            title="ניסיונות / נכונים"
                          >
                            {ans.attempts}/{ans.isCorrect ? 1 : 0}
                          </span>
                        )}
                        {ans.isCorrect !== undefined ? (
                          <span className="text-xs font-bold" style={{ color: ans.isCorrect ? "var(--color-primary)" : "var(--color-error)" }}>
                            {ans.isCorrect ? "נכון ✓" : "שגוי ✗"}
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">ממתין לבדיקה</span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-on-surface mb-1">
                      <span className="text-on-surface-variant me-1">תשובה:</span><MathText>{ans.studentAnswer ?? ""}</MathText>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                      {ans.hintsUsed > 0 && <span className="flex items-center gap-1"><Zap size={10} className="text-tertiary" />{ans.hintsUsed} רמזים</span>}
                      {ans.timeMs != null && ans.timeMs > 0 && <span className="flex items-center gap-1"><Clock size={10} />{Math.ceil(ans.timeMs / 1000)} שנ׳</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Per-part breakdown for one PDF assignment (teacher review) ──
function PdfAssignmentDetail({ assignmentId }: { assignmentId: Id<"pdfAssignments"> }) {
  const detail = useQuery(api.pdfAssignments.getAssignment, { assignmentId });

  if (detail === undefined) {
    return (
      <ElectricLoader fullscreen={false} size={32} className="py-4" />
    );
  }
  if (!detail) return null;

  return (
    <div className="p-4 flex flex-col gap-3">
      {detail.pdfUrl && (
        <a href={detail.pdfUrl} target="_blank" rel="noreferrer"
          className="self-start flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <FileText size={13} /> פתח את ה-PDF המקורי
        </a>
      )}
      {detail.questions.length === 0 ? (
        <div className="text-sm text-on-surface-variant py-2">אין שאלות במטלה זו.</div>
      ) : (
        detail.questions.map((q, qi) => (
          <div key={q._id} className="flex gap-3 bg-surface-container-low rounded-xl border-2 border-outline p-2.5">
            <img src={`data:${q.imageMimeType};base64,${q.imageBase64}`} alt={`שאלה ${qi + 1}`}
              className="w-20 h-20 object-cover rounded-lg border-2 border-outline bg-white flex-shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="text-xs font-bold text-on-surface">שאלה {qi + 1}</div>
              {q.parts.map((p, pi) => {
                const answered = p.studentAnswer != null;
                const correct = p.isCorrect === true;
                return (
                  <div key={pi} className="flex items-center gap-2 text-xs flex-wrap">
                    {p.label && <span className="w-5 h-5 flex-shrink-0 rounded bg-surface-container-high text-on-surface-variant flex items-center justify-center font-bold">{p.label}</span>}
                    {!answered ? (
                      <span className="text-on-surface-variant">טרם נענה</span>
                    ) : (
                      <>
                        {correct
                          ? <CheckCircle2 size={14} style={{ color: "var(--color-primary)" }} className="flex-shrink-0" />
                          : <XCircle size={14} style={{ color: "var(--color-error)" }} className="flex-shrink-0" />}
                        <span className="text-on-surface">
                          <span className="text-on-surface-variant">ענה: </span>
                          <strong style={{ color: correct ? "var(--color-primary)" : "var(--color-error)" }}><MathText>{p.studentAnswer ?? ""}</MathText></strong>
                        </span>
                        {!correct && (
                          <span className="text-on-surface-variant">
                            נכון: <strong className="text-on-surface"><MathText>{p.correctAnswer}</MathText></strong>
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
