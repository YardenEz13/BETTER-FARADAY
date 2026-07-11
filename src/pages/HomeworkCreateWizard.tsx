import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import QuestionImportModal from "../components/QuestionImportModal";
import MathText from "../components/MathText";
import {
  ArrowRight, ArrowLeft, Check, Sparkles, Calendar, Clock,
  Send, FileText, Loader as Loader2,
} from "../components/electric";

const DAY = 24 * 60 * 60 * 1000;

// datetime-local <-> Date helpers. The picker uses local wall-clock time.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function atHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const STEPS = [
  { n: 1 as const, label: "תוכן" },
  { n: 2 as const, label: "שאלות" },
  { n: 3 as const, label: "תזמון וסיכום" },
];

export default function HomeworkCreateWizard() {
  const navigate = useNavigate();
  const { homeworkId } = useParams<{ homeworkId?: string }>();
  const isEdit = !!homeworkId;

  const classroom = useQuery(api.classroom.getFirstClassroom);
  const classroomId = classroom?._id ?? null;
  const topics = useQuery(api.topics.list);
  const approvedImports = useQuery(
    api.teacherImport.listImports,
    classroomId ? { classroomId, status: "approved" } : "skip"
  );
  const existing = useQuery(
    api.homework.getHomeworkById,
    homeworkId ? { homeworkId: homeworkId as Id<"homework"> } : "skip"
  );

  const createHomework = useMutation(api.homework.createHomework);
  const updateHomework = useMutation(api.homework.updateHomework);
  const publishHomework = useMutation(api.homework.publishHomework);

  // ── Form state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Id<"topics">[]>([]);
  const [teacherNotes, setTeacherNotes] = useState("");
  const [questionCount, setQuestionCount] = useState(4);
  const [pinnedQuestionIds, setPinnedQuestionIds] = useState<Id<"questions">[]>([]);
  const [pinnedCompoundIds, setPinnedCompoundIds] = useState<Id<"compoundQuestions">[]>([]);
  const [deadline, setDeadline] = useState(""); // datetime-local string
  const [publishAt, setPublishAt] = useState(""); // datetime-local string
  const [scheduleOn, setScheduleOn] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prefill from the draft once (edit mode).
  useEffect(() => {
    if (!isEdit || !existing || prefilled) return;
    setTitle(existing.title);
    setSelectedTopics(existing.topicIds);
    setTeacherNotes(existing.teacherNotes ?? "");
    setQuestionCount(existing.questionCount);
    setPinnedQuestionIds(existing.pinnedQuestionIds ?? []);
    setPinnedCompoundIds(existing.pinnedCompoundIds ?? []);
    if (existing.deadline) setDeadline(toLocalInput(new Date(existing.deadline)));
    setPrefilled(true);
  }, [isEdit, existing, prefilled]);

  const toggleTopic = (id: Id<"topics">) =>
    setSelectedTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const isImportPinned = (imp: Doc<"teacherImportedQuestions">) =>
    (!!imp.publishedQuestionId && pinnedQuestionIds.includes(imp.publishedQuestionId)) ||
    (!!imp.publishedCompoundId && pinnedCompoundIds.includes(imp.publishedCompoundId));

  const togglePinnedImport = (imp: Doc<"teacherImportedQuestions">) => {
    const qid = imp.publishedQuestionId;
    const cid = imp.publishedCompoundId;
    if (qid) setPinnedQuestionIds((p) => (p.includes(qid) ? p.filter((id) => id !== qid) : [...p, qid]));
    else if (cid) setPinnedCompoundIds((p) => (p.includes(cid) ? p.filter((id) => id !== cid) : [...p, cid]));
  };

  const handleImportApproved = (ref: {
    questionId: Id<"questions"> | null;
    compoundId: Id<"compoundQuestions"> | null;
    label: string;
  }) => {
    if (ref.questionId) setPinnedQuestionIds((p) => (p.includes(ref.questionId!) ? p : [...p, ref.questionId!]));
    else if (ref.compoundId) setPinnedCompoundIds((p) => (p.includes(ref.compoundId!) ? p : [...p, ref.compoundId!]));
  };

  const pinnedCount = pinnedQuestionIds.length + pinnedCompoundIds.length;
  const topicNames = useMemo(
    () => selectedTopics.map((id) => topics?.find((t) => t._id === id)?.nameHe).filter(Boolean) as string[],
    [selectedTopics, topics]
  );

  const now = Date.now();
  const deadlineMs = deadline ? new Date(deadline).getTime() : null;
  const publishMs = scheduleOn && publishAt ? new Date(publishAt).getTime() : null;

  const step1Valid = title.trim().length > 0 && selectedTopics.length > 0;
  const deadlineValid = deadlineMs !== null && deadlineMs > now;
  const scheduleValid = !scheduleOn || (publishMs !== null && publishMs > now && deadlineMs !== null && deadlineMs > publishMs);
  const canPublishNow = step1Valid && deadlineValid;
  const canSchedule = step1Valid && deadlineValid && scheduleOn && scheduleValid;

  const commonFields = () => ({
    title: title.trim(),
    topicIds: selectedTopics,
    teacherNotes: teacherNotes.trim() || undefined,
    questionCount,
    pinnedQuestionIds: pinnedQuestionIds.length ? pinnedQuestionIds : undefined,
    pinnedCompoundIds: pinnedCompoundIds.length ? pinnedCompoundIds : undefined,
  });

  async function saveDraft() {
    if (!classroomId || !step1Valid || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const dl = deadlineMs ?? now + 7 * DAY;
      if (isEdit && homeworkId) {
        await updateHomework({ homeworkId: homeworkId as Id<"homework">, ...commonFields(), deadline: dl });
      } else {
        await createHomework({ classroomId, ...commonFields(), deadline: dl, status: "draft" });
      }
      navigate("/teacher");
    } catch {
      setErrorMsg("שמירת הטיוטה נכשלה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  async function publishNow() {
    if (!classroomId || !canPublishNow || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      if (isEdit && homeworkId) {
        await updateHomework({ homeworkId: homeworkId as Id<"homework">, ...commonFields(), deadline: deadlineMs! });
        await publishHomework({ homeworkId: homeworkId as Id<"homework"> });
      } else {
        await createHomework({ classroomId, ...commonFields(), deadline: deadlineMs!, status: "active" });
      }
      navigate("/teacher");
    } catch {
      setErrorMsg("פרסום המטלה נכשל. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  async function schedulePublish() {
    if (!classroomId || !canSchedule || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      // Scheduling only supported on create (a fresh draft becomes "scheduled").
      await createHomework({ classroomId, ...commonFields(), deadline: deadlineMs!, publishAt: publishMs! });
      navigate("/teacher");
    } catch {
      setErrorMsg("תזמון הפרסום נכשל. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  // ── Preset deadline chips ──
  const presets: { label: string; value: Date }[] = [
    { label: "מחר 20:00", value: atHour(new Date(now + DAY), 20) },
    { label: "עוד 3 ימים", value: atHour(new Date(now + 3 * DAY), 20) },
    {
      label: "יום ראשון 20:00",
      value: (() => {
        const d = new Date(now);
        const diff = (7 - d.getDay()) % 7 || 7; // next Sunday (getDay 0 = Sunday)
        return atHour(new Date(now + diff * DAY), 20);
      })(),
    },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[46rem] px-4 py-6 pb-24 lg:py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/teacher")}
            className="btn-clay-ghost !px-3 !py-2"
            aria-label="חזרה ללוח"
          >
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
              {isEdit ? "עריכת מטלה" : "מטלה חדשה"}
            </h1>
            <p className="text-sm text-on-surface-variant">מטלה אדפטיבית מותאמת לכל תלמיד</p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => (s.n < step || (s.n === 2 && step1Valid) || step > 1) && setStep(s.n)}
                  className="flex items-center gap-2 min-w-0"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0 transition-colors"
                    style={{
                      background: active || done ? "var(--color-primary)" : "var(--color-surface)",
                      borderColor: active || done ? "var(--color-primary)" : "var(--color-outline)",
                      color: active || done ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                    }}
                  >
                    {done ? <Check size={16} /> : s.n}
                  </span>
                  <span
                    className={`text-sm font-semibold truncate hidden sm:inline ${active ? "text-on-surface" : "text-on-surface-variant"}`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="flex-1 h-0.5 rounded-full" style={{ background: step > s.n ? "var(--color-primary)" : "var(--color-outline)" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: תוכן ── */}
        {step === 1 && (
          <div className="clay-card p-6 flex flex-col gap-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">כותרת המטלה</label>
              <input
                type="text"
                dir="rtl"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='לדוגמה: חזרה על חדו"א'
                className="w-full rounded-xl border-2 border-outline bg-surface px-4 py-3 text-base text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">נושאים לכיסוי</label>
              <div className="flex flex-wrap gap-2">
                {topics?.map((topic) => {
                  const on = selectedTopics.includes(topic._id);
                  return (
                    <button
                      key={topic._id}
                      type="button"
                      onClick={() => toggleTopic(topic._id)}
                      className="px-3.5 py-2 rounded-xl border-2 text-sm font-semibold transition-colors"
                      style={{
                        background: on ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "var(--color-surface)",
                        borderColor: on ? "var(--color-primary)" : "var(--color-outline)",
                        color: on ? "var(--color-primary)" : "var(--color-on-surface-variant)",
                      }}
                    >
                      {topic.nameHe}
                    </button>
                  );
                })}
              </div>
              {selectedTopics.length === 0 && (
                <p className="text-xs text-on-surface-variant mt-2">בחרו לפחות נושא אחד.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">הערות לתלמידים (אופציונלי)</label>
              <textarea
                dir="rtl"
                rows={3}
                value={teacherNotes}
                onChange={(e) => setTeacherNotes(e.target.value)}
                placeholder="לדוגמה: התמקדו בשאלות פרמטר…"
                className="w-full rounded-xl border-2 border-outline bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-colors"
                style={{ resize: "vertical" }}
              />
            </div>
          </div>
        )}

        {/* ── STEP 2: שאלות ── */}
        {step === 2 && (
          <div className="clay-card p-6 flex flex-col gap-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">מספר שאלות אוטומטיות לתלמיד</label>
              <p className="text-xs text-on-surface-variant mb-3">
                המערכת בוחרת שאלות ברמת קושי מותאמת לכל תלמיד. שאלות נעוצות (למטה) נוספות מעבר למספר הזה.
              </p>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuestionCount(n)}
                    className="w-11 h-11 rounded-xl border-2 text-base font-bold transition-colors"
                    style={{
                      background: questionCount === n ? "var(--color-primary)" : "var(--color-surface)",
                      borderColor: questionCount === n ? "var(--color-primary)" : "var(--color-outline)",
                      color: questionCount === n ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t-2 border-outline pt-5">
              <label className="block text-sm font-semibold text-on-surface mb-1">שאלות מהספר (נעיצה ידנית)</label>
              <p className="text-xs text-on-surface-variant mb-3">
                שאלות שתייבאו ותסמנו כאן יתווספו לכל תלמיד כמו שהן.
              </p>
              {/* Packet-level imports live in ניהול מטלות → "מטלה חדשה" — one entry per flow. */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="btn-clay-ghost !px-4 !py-2.5 !text-sm"
                >
                  <Sparkles size={16} /> ייבא שאלה מתמונה / PDF
                </button>
              </div>

              {approvedImports && approvedImports.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {approvedImports.map((imp) => {
                    const pinned = isImportPinned(imp);
                    return (
                      <button
                        key={imp._id}
                        type="button"
                        onClick={() => togglePinnedImport(imp)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-start transition-colors"
                        style={{
                          background: pinned ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--color-surface)",
                          borderColor: pinned ? "var(--color-primary)" : "var(--color-outline)",
                        }}
                      >
                        <span
                          className="w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center"
                          style={{
                            background: pinned ? "var(--color-primary)" : "transparent",
                            borderColor: pinned ? "var(--color-primary)" : "var(--color-outline)",
                          }}
                        >
                          {pinned && <Check size={13} className="text-white" />}
                        </span>
                        <span className="flex-1 text-sm text-on-surface truncate min-w-0">
                          <MathText>{imp.draft?.stem ?? "שאלה מיובאת"}</MathText>
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant flex-shrink-0">
                          {imp.draft?.format === "multiple_choice" ? "אמריקאית" : "השלמה"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">אין עדיין שאלות מיובאות מאושרות.</p>
              )}
              {pinnedCount > 0 && (
                <div className="mt-3 text-sm font-semibold text-primary">
                  {pinnedCount} שאלות נעוצות יתווספו לכל תלמיד
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: תזמון וסיכום ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            {/* Deadline */}
            <div className="clay-card p-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-on-surface mb-3">
                <Clock size={16} className="text-primary" /> מועד הגשה
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDeadline(toLocalInput(p.value))}
                    className="px-3 py-1.5 rounded-full border-2 border-outline bg-surface text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div dir="ltr" className="w-full">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border-2 border-outline bg-surface px-4 py-3 text-base text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              {deadline && !deadlineValid && (
                <p className="text-xs text-error mt-2">מועד ההגשה חייב להיות בעתיד.</p>
              )}
            </div>

            {/* Scheduled publish */}
            <div className="clay-card p-6">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <Calendar size={16} className="text-secondary" /> פרסום מתוזמן
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={scheduleOn}
                  onClick={() => setScheduleOn((v) => !v)}
                  className="relative w-12 h-7 rounded-full border-2 flex-shrink-0 transition-colors"
                  style={{
                    background: scheduleOn ? "var(--color-secondary)" : "var(--color-surface-container)",
                    borderColor: scheduleOn ? "var(--color-secondary)" : "var(--color-outline)",
                  }}
                  disabled={isEdit}
                >
                  <span
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ insetInlineStart: scheduleOn ? "calc(100% - 22px)" : "2px" }}
                  />
                </button>
              </label>
              {isEdit ? (
                <p className="text-xs text-on-surface-variant mt-2">תזמון פרסום זמין רק ביצירת מטלה חדשה.</p>
              ) : (
                <p className="text-xs text-on-surface-variant mt-2">
                  המטלה תיווצר כמתוזמנת ותפורסם אוטומטית במועד שתבחרו.
                </p>
              )}
              {scheduleOn && !isEdit && (
                <div dir="ltr" className="w-full mt-3">
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="w-full rounded-xl border-2 border-outline bg-surface px-4 py-3 text-base text-on-surface focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              )}
              {scheduleOn && !isEdit && !scheduleValid && publishAt && (
                <p className="text-xs text-error mt-2">מועד הפרסום חייב להיות בעתיד ולפני מועד ההגשה.</p>
              )}
            </div>

            {/* Summary */}
            <div className="clay-card p-6">
              <div className="text-sm font-semibold text-on-surface mb-4">סיכום</div>
              <dl className="flex flex-col gap-3 text-sm">
                <SummaryRow label="כותרת" value={title.trim() || "—"} />
                <SummaryRow label="נושאים" value={topicNames.length ? topicNames.join(" · ") : "—"} />
                <SummaryRow label="שאלות לתלמיד" value={String(questionCount)} />
                <SummaryRow label="שאלות נעוצות" value={pinnedCount ? String(pinnedCount) : "אין"} />
                {teacherNotes.trim() && <SummaryRow label="הערות" value={teacherNotes.trim()} />}
              </dl>
            </div>

            {/* Actions */}
            {errorMsg && (
              <div className="rounded-xl border-2 px-4 py-3 text-sm font-semibold"
                style={{ borderColor: "color-mix(in srgb, var(--color-error) 45%, var(--color-outline))", color: "var(--color-error)", background: "color-mix(in srgb, var(--color-error) 8%, transparent)" }}>
                {errorMsg}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={saveDraft}
                disabled={!step1Valid || busy}
                className="btn-clay-ghost flex-1 !py-3"
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : <FileText size={17} />} שמור כטיוטה
              </button>
              {scheduleOn && !isEdit ? (
                <button
                  onClick={schedulePublish}
                  disabled={!canSchedule || busy}
                  className="btn-clay-secondary flex-1 !py-3"
                >
                  {busy ? <Loader2 size={17} className="animate-spin" /> : <Calendar size={17} />} תזמן פרסום
                </button>
              ) : (
                <button
                  onClick={publishNow}
                  disabled={!canPublishNow || busy}
                  className="btn-clay-primary flex-1 !py-3"
                >
                  {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} פרסם עכשיו
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step nav */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
            disabled={step === 1}
            className="btn-clay-ghost !px-4 !py-2.5 disabled:opacity-0"
          >
            <ArrowRight size={17} /> חזרה
          </button>
          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
              disabled={step === 1 && !step1Valid}
              className="btn-clay-primary !px-5 !py-2.5"
            >
              הבא <ArrowLeft size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showImportModal && classroomId && (
        <QuestionImportModal
          classroomId={classroomId}
          onClose={() => setShowImportModal(false)}
          onApproved={handleImportApproved}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="text-on-surface-variant font-semibold w-28 flex-shrink-0">{label}</dt>
      <dd className="text-on-surface flex-1 min-w-0">{value}</dd>
    </div>
  );
}
