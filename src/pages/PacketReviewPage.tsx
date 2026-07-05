import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import MathText from "../components/MathText";
import { Check, X, AlertTriangle, Loader as Loader2, RefreshCw, Sparkles } from "../components/electric";

type PacketQuestion = Doc<"packetImportQuestions">;
type PacketDraft = NonNullable<PacketQuestion["draft"]>;
type Section = Extract<PacketDraft, { kind: "compound" }>["sections"][number];

const STATUS_HE: Record<string, string> = {
  cropping: "בחיתוך…",
  inventory: "סורק את החוברת…",
  solving: "פותר שאלות…",
  verifying: "מאמת תשובות…",
  review: "מוכן לבדיקה",
  failed: "נכשל",
  cancelled: "בוטל",
};

const Q_STATUS_HE: Record<string, string> = {
  pending: "ממתין",
  review: "לבדיקה",
  flagged: "דורש תשומת לב",
  proof_unverified: "הוכחה — דורש בדיקה",
  approved: "אושר",
  discarded: "נמחק",
  failed: "נכשל",
};

const KIND_HE: Record<string, string> = { simple: "רגילה", compound: "רב-סעיפית", proof: "הוכחה" };

// Flagged / proof / failed rise to the top; otherwise packet order.
const SORT_RANK: Record<string, number> = {
  flagged: 0,
  proof_unverified: 1,
  failed: 2,
  review: 3,
  pending: 4,
  approved: 5,
  discarded: 6,
};

export default function PacketReviewPage() {
  const { packetId } = useParams<{ packetId: string }>();
  const navigate = useNavigate();
  const id = packetId as Id<"packetImports">;

  const reduce = useReducedMotion();
  const spin = reduce ? "" : "animate-spin";

  const packet = useQuery(api.packetImport.getPacket, id ? { packetId: id } : "skip");
  const questions = useQuery(api.packetImport.listPacketQuestions, id ? { packetId: id } : "skip");
  const pdfUrl = useQuery(api.packetImport.getPdfUrl, id ? { packetId: id } : "skip");
  const topics = useQuery(api.topics.list);

  const cancel = useMutation(api.packetImport.cancel);
  const retryAllFailed = useMutation(api.packetImport.retryAllFailed);
  const bulkApprove = useMutation(api.packetImport.bulkApprove);
  const discardQuestion = useMutation(api.packetImport.discardQuestion);
  const createHomework = useMutation(api.packetImport.createHomeworkFromPacket);

  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<Id<"packetImportQuestions"> | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!questions) return [];
    const rows = [...questions];
    rows.sort((a, b) => (SORT_RANK[a.status] ?? 9) - (SORT_RANK[b.status] ?? 9) || a.orderIndex - b.orderIndex);
    return filter === "all" ? rows : rows.filter((r) => r.status === filter);
  }, [questions, filter]);

  const editing = useMemo(
    () => questions?.find((q) => q._id === editingId) ?? null,
    [questions, editingId],
  );

  if (packet === undefined) {
    return (
      <div className="min-h-screen grid place-items-center" dir="rtl">
        <Loader2 size={28} className={`${spin} text-[var(--color-primary)]`} />
      </div>
    );
  }
  if (packet === null) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--text-muted)]" dir="rtl">
        החבילה לא נמצאה.
      </div>
    );
  }

  const total = packet.total ?? 0;
  const resolved = packet.resolved ?? 0;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const running = ["inventory", "solving", "verifying"].includes(packet.status);
  const publishable = (questions ?? []).filter((q) =>
    ["review", "flagged", "proof_unverified", "approved"].includes(q.status),
  ).length;
  const missingTopic = (questions ?? []).filter((q) => !q.topicId && q.status !== "discarded" && q.status !== "failed").length;

  const toggleSelect = (qid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  const runBulkApprove = async () => {
    setBanner(null);
    const ids = Array.from(selected) as Id<"packetImportQuestions">[];
    if (ids.length === 0) return;
    const r = await bulkApprove({ questionIds: ids });
    setSelected(new Set());
    setBanner(
      r.errors.length > 0
        ? `אושרו ${r.approved}, ${r.errors.length} נכשלו (${r.errors[0].message})`
        : `אושרו ${r.approved} שאלות.`,
    );
  };

  const runBulkDiscard = async () => {
    const ids = Array.from(selected) as Id<"packetImportQuestions">[];
    for (const qid of ids) await discardQuestion({ questionId: qid });
    setSelected(new Set());
  };

  const makeHomework = async () => {
    const title = window.prompt("כותרת שיעורי הבית:", packet.sourceName?.replace(/\.pdf$/i, "") ?? "מטלת קיץ");
    if (!title) return;
    const topicIds = topics ? topics.map((t) => t._id) : [];
    const deadline = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const r = await createHomework({ packetId: id, title, deadline, topicIds });
    setBanner(
      r.errors.length > 0
        ? `נוצרו שיעורי בית עם ${r.pinnedQuestions + r.pinnedCompounds} שאלות, ${r.errors.length} דילגו.`
        : `נוצרו שיעורי בית עם ${r.pinnedQuestions + r.pinnedCompounds} שאלות.`,
    );
  };

  const filters = ["all", "review", "flagged", "proof_unverified", "approved", "failed"];

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-accent)]" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="label-mono text-[var(--color-primary)] text-xs mb-1">ייבוא חוברת</div>
            <h1 className="text-2xl font-extrabold">{packet.sourceName}</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-2 rounded-lg border-2 border-[var(--border-subtle)] text-sm font-bold hover:bg-[var(--bg-elevated)]"
          >
            חזרה
          </button>
        </div>

        {/* Progress */}
        <div className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              {running && <Loader2 size={16} className={`${spin} text-[var(--color-primary)]`} />}
              {STATUS_HE[packet.status] ?? packet.status}
            </div>
            {running && (
              <button
                type="button"
                onClick={() => cancel({ packetId: id })}
                className="text-xs px-3 py-1.5 rounded-lg border-2 border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)] text-[var(--danger)] font-bold hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
              >
                בטל
              </button>
            )}
          </div>
          <div className="h-3 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className={`h-full bg-[var(--color-primary)] ${reduce ? "" : "transition-all duration-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-[var(--text-muted)]">
              חולצו {resolved} מתוך {total} שאלות
              {packet.status === "failed" && packet.error ? ` — ${packet.error}` : ""}
            </div>
            {!running && (packet.counts?.failed ?? 0) > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const r = await retryAllFailed({ packetId: id });
                  setBanner(`נשלחו ${r.retried} שאלות לעיבוד חוזר.`);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border-2 border-[var(--color-primary)] text-[var(--color-primary)] font-bold hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] flex items-center gap-1.5"
              >
                <RefreshCw size={13} /> נסה שוב את כל הנכשלות ({packet.counts?.failed})
              </button>
            )}
          </div>
        </div>

        {banner && (
          <div className="rounded-xl border-2 border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-4 py-2.5 mb-4 text-sm font-bold flex items-center justify-between">
            <span>{banner}</span>
            <button type="button" aria-label="סגור הודעה" onClick={() => setBanner(null)}><X size={14} /></button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border-2 font-bold transition-all ${
                filter === f
                  ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--color-primary)]"
              }`}
            >
              {f === "all" ? "הכל" : Q_STATUS_HE[f]}
              {packet.counts?.[f] ? ` (${packet.counts[f]})` : ""}
            </button>
          ))}
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="sticky top-2 z-10 flex items-center gap-2 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] px-4 py-2.5 mb-4 shadow-lg">
            <span className="text-sm font-bold flex-1">נבחרו {selected.size}</span>
            <button type="button" onClick={runBulkApprove} className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
              <Check size={14} /> אשר ופרסם
            </button>
            <button
              type="button"
              onClick={runBulkDiscard}
              className="text-xs px-4 py-2 rounded-lg border-2 border-[var(--border-subtle)] font-bold hover:bg-[var(--bg-elevated)]"
            >
              מחק
            </button>
          </div>
        )}

        {/* Question list */}
        <div className="flex flex-col gap-2">
          {questions === undefined && <Loader2 size={20} className={`${spin} text-[var(--color-primary)] mx-auto`} />}
          {questions && sorted.length === 0 && (
            <div className="text-center text-sm text-[var(--text-muted)] py-8">אין שאלות בסינון זה.</div>
          )}
          {sorted.map((q) => (
            <QuestionRow
              key={q._id}
              q={q}
              selected={selected.has(q._id)}
              onToggle={() => toggleSelect(q._id)}
              onOpen={() => setEditingId(q._id)}
            />
          ))}
        </div>

        {/* Homework bar */}
        {packet.status === "review" && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {missingTopic > 0 && (
              <span className="text-xs text-[var(--danger)] font-bold">{missingTopic} שאלות ללא נושא</span>
            )}
            <button
              type="button"
              onClick={makeHomework}
              disabled={publishable === 0}
              title={publishable === 0 ? "אין שאלות לפרסום" : undefined}
              className="btn btn-primary flex items-center gap-2 px-6 py-3 font-bold disabled:opacity-50"
            >
              <Sparkles size={16} /> צור שיעורי בית מהחוברת
            </button>
          </div>
        )}
      </div>

      {editing && topics && (
        <QuestionEditor
          key={editing._id}
          question={editing}
          topics={topics}
          pdfUrl={pdfUrl ?? null}
          onClose={() => setEditingId(null)}
          onBanner={setBanner}
        />
      )}
    </div>
  );
}

// ── Row ──
function QuestionRow({
  q,
  selected,
  onToggle,
  onOpen,
}: {
  q: PacketQuestion;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const flagged = q.status === "flagged" || q.status === "failed";
  const proof = q.status === "proof_unverified";
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border-2 bg-[var(--color-surface)] px-3 py-2.5 ${
        flagged
          ? "border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)]"
          : proof
            ? "border-[color-mix(in_srgb,var(--color-tertiary)_55%,transparent)]"
            : "border-[var(--border-subtle)]"
      }`}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 accent-[var(--color-primary)]" />
      <button type="button" onClick={onOpen} className="flex-1 flex items-center gap-3 min-w-0 text-right">
        <span className="font-bold text-sm whitespace-nowrap">{q.sourceLabelRaw}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] whitespace-nowrap">
          {KIND_HE[q.kind] ?? q.kind}
        </span>
        <span className="flex-1 text-xs text-[var(--text-muted)] truncate min-w-0">
          {q.draft?.kind === "simple" ? q.draft.stem : q.draft?.kind === "compound" ? q.draft.preamble : q.topicHe}
        </span>
      </button>
      {q.topicId ? null : (
        <span className="text-[10px] text-[var(--danger)] font-bold whitespace-nowrap">ללא נושא</span>
      )}
      {(flagged || proof) && (
        <AlertTriangle size={15} className={flagged ? "text-[var(--danger)]" : "text-[var(--color-tertiary)]"} />
      )}
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] whitespace-nowrap">
        {Q_STATUS_HE[q.status] ?? q.status}
      </span>
    </div>
  );
}

// ── Editor ──
function QuestionEditor({
  question,
  topics,
  pdfUrl,
  onClose,
  onBanner,
}: {
  question: PacketQuestion;
  topics: Doc<"topics">[];
  pdfUrl: string | null;
  onClose: () => void;
  onBanner: (s: string) => void;
}) {
  const images = useQuery(api.packetImport.getQuestionImages, { questionId: question._id });
  const updateDraft = useMutation(api.packetImport.updateQuestionDraft);
  const setTopic = useMutation(api.packetImport.setQuestionTopic);
  const confirmProof = useMutation(api.packetImport.confirmProofSteps);
  const approve = useMutation(api.packetImport.approveQuestion);
  const discard = useMutation(api.packetImport.discardQuestion);
  const retry = useMutation(api.packetImport.retryQuestion);

  const [draft, setDraft] = useState<PacketDraft | null>(question.draft ?? null);
  const [topicId, setTopicId] = useState<Id<"topics"> | undefined>(question.topicId);
  const [proofReviewed, setProofReviewed] = useState<boolean>(!!question.proofReviewedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasProof = draft?.kind === "compound" && draft.sections.some((s) => s.answerType === "proof");

  const persist = async () => {
    setBusy(true);
    setError(null);
    try {
      if (draft) await updateDraft({ questionId: question._id, draft });
      if (topicId && topicId !== question.topicId) await setTopic({ questionId: question._id, topicId });
      if (hasProof && proofReviewed && !question.proofReviewedAt) await confirmProof({ questionId: question._id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירה נכשלה");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    try {
      await persist();
      onBanner("נשמר.");
      onClose();
    } catch {
      /* error already surfaced */
    }
  };

  const onApprove = async () => {
    setError(null);
    try {
      await persist();
      await approve({ questionId: question._id });
      onBanner("השאלה פורסמה.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "פרסום נכשל");
    }
  };

  const updateSection = (i: number, patch: Partial<Section>) => {
    setDraft((d) => {
      if (!d || d.kind !== "compound") return d;
      const sections = d.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
      return { ...d, sections };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40" dir="rtl" onClick={onClose}>
      <div
        className="ms-auto h-full w-full max-w-3xl bg-[var(--color-background)] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--color-surface)] border-b-2 border-[var(--border-subtle)] px-5 py-3 flex items-center justify-between z-10">
          <div className="font-extrabold">{question.sourceLabelRaw} · {KIND_HE[question.kind]}</div>
          <button type="button" aria-label="סגור" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-5">
          {/* Editing column */}
          <div className="flex flex-col gap-4">
            {/* Topic */}
            <div>
              <label className="label-mono text-xs text-[var(--color-primary)] block mb-1">נושא</label>
              <select
                value={topicId ?? ""}
                onChange={(e) => setTopicId(e.target.value ? (e.target.value as Id<"topics">) : undefined)}
                className="w-full rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              >
                <option value="">— בחר נושא —</option>
                {topics.map((t) => (
                  <option key={t._id} value={t._id}>{t.nameHe}</option>
                ))}
              </select>
            </div>

            {draft?.kind === "simple" && (
              <SimpleFields draft={draft} onChange={setDraft} />
            )}

            {draft?.kind === "compound" && (
              <div className="flex flex-col gap-3">
                <Field label="פתיח (preamble)" value={draft.preamble} onChange={(v) => setDraft({ ...draft, preamble: v })} textarea />
                {draft.sections.map((s, i) => (
                  <SectionEditor key={i} section={s} onChange={(patch) => updateSection(i, patch)} />
                ))}
              </div>
            )}

            {hasProof && (
              <label className="flex items-center gap-2 text-sm font-bold rounded-lg border-2 border-[var(--color-tertiary)] px-3 py-2">
                <input type="checkbox" checked={proofReviewed} onChange={(e) => setProofReviewed(e.target.checked)} className="w-4 h-4 accent-[var(--color-tertiary)]" />
                אישרתי את שלבי ההוכחה
              </label>
            )}

            {question.verification?.detail && (
              <div className="text-xs rounded-lg border-2 border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] px-3 py-2 text-[var(--danger)]">
                בדיקה: {question.verification.detail}
              </div>
            )}
            {error && <div className="text-sm text-[var(--danger)] font-bold">{error}</div>}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" disabled={busy} onClick={onApprove} className="btn btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm">
                <Check size={15} /> אשר ופרסם
              </button>
              <button type="button" disabled={busy} onClick={onSave} className="px-5 py-2.5 rounded-lg border-2 border-[var(--border-subtle)] font-bold text-sm hover:bg-[var(--bg-elevated)]">
                שמור
              </button>
              {question.status === "failed" && (
                <button type="button" onClick={() => { retry({ questionId: question._id }); onClose(); }} className="px-4 py-2.5 rounded-lg border-2 border-[var(--border-subtle)] font-bold text-sm flex items-center gap-1.5">
                  <RefreshCw size={14} /> נסה שוב
                </button>
              )}
              <button type="button" onClick={() => { discard({ questionId: question._id }); onClose(); }} className="px-4 py-2.5 rounded-lg border-2 border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] text-[var(--danger)] font-bold text-sm ms-auto">
                מחק
              </button>
            </div>
          </div>

          {/* Preview / source column */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] p-3">
              <div className="label-mono text-xs text-[var(--color-primary)] mb-1">תצוגה מקדימה</div>
              <div className="text-sm leading-relaxed">
                <MathText>
                  {draft?.kind === "simple" ? draft.stem : draft?.kind === "compound" ? draft.preamble : ""}
                </MathText>
              </div>
            </div>
            {images?.questionImageBase64 ? (
              <>
                <div className="rounded-xl border-2 border-[var(--border-subtle)] bg-white p-2">
                  <div className="label-mono text-xs text-[var(--color-primary)] mb-1">השאלה המקורית</div>
                  <img src={`data:image/jpeg;base64,${images.questionImageBase64}`} alt="השאלה המקורית" className="w-full rounded" />
                </div>
                {images.answerImageBase64 && (
                  <div className="rounded-xl border-2 border-[var(--border-subtle)] bg-white p-2">
                    <div className="label-mono text-xs text-[var(--color-primary)] mb-1">התשובה מהמחוון</div>
                    <img src={`data:image/jpeg;base64,${images.answerImageBase64}`} alt="התשובה מהמחוון" className="w-full rounded" />
                  </div>
                )}
              </>
            ) : pdfUrl ? (
              <embed
                src={`${pdfUrl}#page=${question.pageStart}`}
                type="application/pdf"
                className="w-full rounded-xl border-2 border-[var(--border-subtle)]"
                style={{ height: 460 }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleFields({ draft, onChange }: { draft: Extract<PacketDraft, { kind: "simple" }>; onChange: (d: PacketDraft) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="נוסח השאלה" value={draft.stem} onChange={(v) => onChange({ ...draft, stem: v })} textarea />
      {draft.format === "multiple_choice" ? (
        <div>
          <label className="label-mono text-xs text-[var(--color-primary)] block mb-1">אפשרויות (סמן את הנכונה)</label>
          {draft.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input
                type="radio"
                checked={draft.correctIndex === i}
                onChange={() => onChange({ ...draft, correctIndex: i })}
                className="accent-[var(--color-primary)]"
              />
              <input
                value={c}
                onChange={(e) => onChange({ ...draft, choices: draft.choices.map((x, idx) => (idx === i ? e.target.value : x)) })}
                className="flex-1 rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      ) : (
        <Field label="תשובה נכונה" value={draft.correctAnswer ?? ""} onChange={(v) => onChange({ ...draft, correctAnswer: v })} />
      )}
      <Field label="הסבר" value={draft.explanation} onChange={(v) => onChange({ ...draft, explanation: v })} textarea />
    </div>
  );
}

function SectionEditor({ section, onChange }: { section: Section; onChange: (patch: Partial<Section>) => void }) {
  const isProof = section.answerType === "proof";
  return (
    <div className="rounded-xl border-2 border-[var(--border-subtle)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-extrabold text-sm">סעיף {section.label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">{section.answerType}</span>
        <span className="text-[10px] text-[var(--text-muted)] ms-auto">{section.points} נק'</span>
      </div>
      <Field label="שאלה" value={section.prompt} onChange={(v) => onChange({ prompt: v })} textarea />
      {isProof ? (
        <>
          <Field label="נתון" value={section.proofMeta?.given ?? ""} onChange={(v) => onChange({ proofMeta: { ...(section.proofMeta ?? { given: "", toProve: "" }), given: v } })} />
          <Field label="להוכיח" value={section.proofMeta?.toProve ?? ""} onChange={(v) => onChange({ proofMeta: { ...(section.proofMeta ?? { given: "", toProve: "" }), toProve: v } })} />
          <div className="label-mono text-xs text-[var(--color-primary)]">שלבי ההוכחה</div>
          {(section.proofSteps ?? []).map((st, i) => (
            <div key={i} className="grid grid-cols-2 gap-1.5">
              <input
                value={st.expectedClaim}
                placeholder="טענה"
                onChange={(e) => onChange({ proofSteps: (section.proofSteps ?? []).map((x, idx) => (idx === i ? { ...x, expectedClaim: e.target.value } : x)) })}
                className="rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
              />
              <input
                value={st.expectedReason}
                placeholder="נימוק"
                onChange={(e) => onChange({ proofSteps: (section.proofSteps ?? []).map((x, idx) => (idx === i ? { ...x, expectedReason: e.target.value } : x)) })}
                className="rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ proofSteps: [...(section.proofSteps ?? []), { stepIndex: section.proofSteps?.length ?? 0, expectedClaim: "", expectedReason: "" }] })}
            className="text-xs font-bold text-[var(--color-primary)] self-start"
          >
            + הוסף שלב
          </button>
        </>
      ) : (
        <Field label="תשובה נכונה" value={section.correctAnswer} onChange={(v) => onChange({ correctAnswer: v })} />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="label-mono text-xs text-[var(--color-primary)] block mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm resize-y"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
