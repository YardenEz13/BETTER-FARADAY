import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Upload, FileText, Loader as Loader2, Check, X, Sparkles, AlertTriangle, RefreshCw } from "./electric";
import MathText from "./MathText";
import { prepareMediaForUpload, type PreparedMedia } from "../services/imageUpload";
import { extractQuestionFromMedia, type ExtractedQuestionDraft } from "../services/localAI";

type EditableDraft = ExtractedQuestionDraft & { topicId?: Id<"topics"> };

interface Props {
  classroomId: Id<"classrooms">;
  onClose: () => void;
  onApproved: (ref: {
    questionId: Id<"questions"> | null;
    compoundId: Id<"compoundQuestions"> | null;
    label: string;
  }) => void;
}

export default function QuestionImportModal({ classroomId, onClose, onApproved }: Props) {
  const topics = useQuery(api.topics.list);
  const createImport = useMutation(api.teacherImport.createImport);
  const approveImport = useMutation(api.teacherImport.approveImport);

  const [step, setStep] = useState<"upload" | "extracting" | "review">("upload");
  const [media, setMedia] = useState<PreparedMedia | null>(null);
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<EditableDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runExtraction = async (prepared: PreparedMedia) => {
    setStep("extracting");
    try {
      const result = await extractQuestionFromMedia({ mimeType: prepared.mimeType, data: prepared.base64 });
      setRawText(result.rawText);
      setDraft({ ...result.draft });
      setStep("review");
    } catch (err) {
      console.error("[QuestionImport] extraction failed:", err);
      setError(err instanceof Error ? err.message : "חילוץ השאלה נכשל. נסה קובץ ברור יותר.");
      setStep("upload");
      setMedia(null);
    }
  };

  const ingestFile = async (file: File) => {
    setError(null);
    let prepared: PreparedMedia;
    try {
      prepared = await prepareMediaForUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינת הקובץ נכשלה.");
      return;
    }
    setMedia(prepared);
    await runExtraction(prepared);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) ingestFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) ingestFile(file);
  };

  const patchDraft = (patch: Partial<EditableDraft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleApprove = async () => {
    if (!draft) return;
    if (!draft.topicId) { setError("יש לבחור נושא לשאלה."); return; }
    if (!draft.stem.trim()) { setError("נוסח השאלה ריק."); return; }
    if (draft.format === "multiple_choice" && draft.choices.filter((c) => c.trim()).length < 2) {
      setError("שאלה אמריקאית צריכה לפחות שתי אפשרויות.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const draftPayload = {
        format: draft.format,
        topicId: draft.topicId,
        difficulty: draft.difficulty,
        stem: draft.stem.trim(),
        choices: draft.format === "multiple_choice" ? draft.choices.filter((c) => c.trim()) : [],
        correctIndex: draft.format === "multiple_choice" ? (draft.correctIndex ?? 0) : undefined,
        correctAnswer: draft.format === "fill_blank" ? (draft.correctAnswer ?? "") : undefined,
        solutionSteps: draft.solutionSteps.filter((s) => s.trim()),
        hint: draft.hint,
        explanation: draft.explanation,
      };
      const importId = await createImport({
        classroomId,
        sourceType: media?.kind ?? "image",
        sourceName: media?.fileName,
        rawExtractedText: rawText,
        draft: draftPayload,
      });
      const ref = await approveImport({ importId });
      onApproved({ questionId: ref.questionId, compoundId: ref.compoundId, label: draft.stem.slice(0, 80) });
      onClose();
    } catch (err) {
      console.error("[QuestionImport] approve failed:", err);
      setError(err instanceof Error ? err.message : "אישור השאלה נכשל.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir="rtl"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />

      <motion.div
        className="relative w-full max-w-[56rem] max-h-[88vh] overflow-y-auto rounded-2xl border-2 border-outline-variant bg-surface shadow-2xl"
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 240 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/60 bg-surface-container-lowest sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary-container/30 border-2 border-primary flex items-center justify-center">
              <Sparkles size={20} className="text-primary" />
            </span>
            <div>
              <div className="font-headline-md text-on-surface">ייבוא שאלה מספר</div>
              <div className="font-label-md text-on-surface-variant" style={{ fontSize: "12px" }}>
                צלם/העלה שאלה — פאראדיי יחלץ ויעצב אותה
              </div>
            </div>
          </div>
          <button
            onClick={busy ? undefined : onClose}
            disabled={busy}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary transition-colors disabled:opacity-40"
            title="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error/10 border border-error/30 text-error font-label-md" style={{ fontSize: "13px" }}>
              <AlertTriangle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── Upload step ── */}
          {step === "upload" && (
            <div
              className={`flex flex-col items-center justify-center text-center gap-4 py-14 px-6 rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/50"}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileInput}
              />
              <span className="w-16 h-16 rounded-2xl bg-primary-container/20 border-2 border-primary/40 flex items-center justify-center">
                <Upload size={28} className="text-primary" />
              </span>
              <div>
                <div className="font-headline-md text-on-surface mb-1">גרור לכאן תמונה או PDF</div>
                <div className="font-body-md text-on-surface-variant max-w-[24rem]">
                  או לחץ לבחירת קובץ. ניתן לצלם שאלה מספר לימוד או להעלות דף סרוק.
                </div>
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant/70 font-label-md" style={{ fontSize: "11px" }}>
                <span className="flex items-center gap-1"><FileText size={13} /> PNG · JPG · PDF</span>
                <span>·</span>
                <span>עד 20MB</span>
              </div>
            </div>
          )}

          {/* ── Extracting step ── */}
          {step === "extracting" && (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-20">
              <Loader2 size={40} className="text-primary animate-spin" />
              <div className="font-headline-md text-on-surface">פאראדיי קורא את השאלה…</div>
              <div className="font-body-md text-on-surface-variant">מחלץ נוסח, מזהה פורמט ומכין טיוטה לעריכה</div>
            </div>
          )}

          {/* ── Review step ── */}
          {step === "review" && draft && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Editor */}
              <div className="flex flex-col gap-4">
                {/* Format */}
                <div>
                  <label className="font-label-md text-on-surface-variant block mb-1.5">פורמט</label>
                  <div className="flex gap-2">
                    {([
                      { v: "multiple_choice", label: "אמריקאית" },
                      { v: "fill_blank", label: "השלמה / תשובה פתוחה" },
                    ] as const).map((f) => (
                      <button
                        key={f.v}
                        onClick={() => patchDraft({ format: f.v })}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${draft.format === f.v ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/40"}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="font-label-md text-on-surface-variant block mb-1.5">נושא <span className="text-error">*</span></label>
                  <select
                    value={draft.topicId ?? ""}
                    onChange={(e) => patchDraft({ topicId: e.target.value ? (e.target.value as Id<"topics">) : undefined })}
                    className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none transition-colors"
                    dir="rtl"
                  >
                    <option value="">— בחר נושא —</option>
                    {topics?.map((t) => (
                      <option key={t._id} value={t._id}>{t.nameHe}</option>
                    ))}
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="font-label-md text-on-surface-variant block mb-1.5">רמת קושי</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => patchDraft({ difficulty: n })}
                        className={`w-10 h-10 rounded-lg text-base font-black border-2 transition-all ${draft.difficulty === n ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/40"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stem */}
                <div>
                  <label className="font-label-md text-on-surface-variant block mb-1.5">נוסח השאלה (LaTeX ב-$...$)</label>
                  <textarea
                    value={draft.stem}
                    onChange={(e) => patchDraft({ stem: e.target.value })}
                    rows={4}
                    dir="rtl"
                    className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none transition-colors"
                    style={{ resize: "vertical" }}
                  />
                </div>

                {/* MC choices */}
                {draft.format === "multiple_choice" && (
                  <div>
                    <label className="font-label-md text-on-surface-variant block mb-1.5">אפשרויות (סמן את הנכונה)</label>
                    <div className="flex flex-col gap-2">
                      {draft.choices.map((choice, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            onClick={() => patchDraft({ correctIndex: i })}
                            className={`w-7 h-7 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${draft.correctIndex === i ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant"}`}
                            title="סמן כתשובה נכונה"
                          >
                            {draft.correctIndex === i ? <Check size={14} /> : String.fromCharCode(0x05d0 + i)}
                          </button>
                          <input
                            value={choice}
                            onChange={(e) => {
                              const next = [...draft.choices];
                              next[i] = e.target.value;
                              patchDraft({ choices: next });
                            }}
                            dir="rtl"
                            className="flex-1 bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-1.5 text-on-surface focus:border-primary focus:outline-none transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fill-blank answer */}
                {draft.format === "fill_blank" && (
                  <div>
                    <label className="font-label-md text-on-surface-variant block mb-1.5">תשובה נכונה</label>
                    <input
                      value={draft.correctAnswer ?? ""}
                      onChange={(e) => patchDraft({ correctAnswer: e.target.value })}
                      dir="rtl"
                      className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                )}

                {/* Hint */}
                <div>
                  <label className="font-label-md text-on-surface-variant block mb-1.5">רמז</label>
                  <input
                    value={draft.hint}
                    onChange={(e) => patchDraft({ hint: e.target.value })}
                    dir="rtl"
                    className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                {/* Explanation */}
                <div>
                  <label className="font-label-md text-on-surface-variant block mb-1.5">הסבר לפתרון</label>
                  <textarea
                    value={draft.explanation}
                    onChange={(e) => patchDraft({ explanation: e.target.value })}
                    rows={2}
                    dir="rtl"
                    className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none transition-colors"
                    style={{ resize: "vertical" }}
                  />
                </div>

                {/* Solution steps */}
                <div>
                  <label className="font-label-md text-on-surface-variant block mb-1.5">שלבי פתרון (שורה לכל שלב)</label>
                  <textarea
                    value={draft.solutionSteps.join("\n")}
                    onChange={(e) => patchDraft({ solutionSteps: e.target.value.split("\n") })}
                    rows={3}
                    dir="rtl"
                    className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none transition-colors"
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-on-surface-variant">תצוגה מקדימה (כפי שהתלמיד יראה)</span>
                  {media && (
                    <button
                      onClick={reExtractGuard(media, runExtraction)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-variant/50 transition-colors font-label-md"
                      style={{ fontSize: "11px" }}
                      title="חלץ מחדש מהקובץ"
                    >
                      <RefreshCw size={13} /> חלץ מחדש
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border-2 border-outline-variant bg-surface-container-low p-5 min-h-[12rem]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-label-md border border-primary/30" style={{ fontSize: "11px" }}>
                      רמה {draft.difficulty}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant font-label-md" style={{ fontSize: "11px" }}>
                      {draft.format === "multiple_choice" ? "אמריקאית" : "השלמה"}
                    </span>
                  </div>

                  <div className="text-lg leading-relaxed text-on-surface mb-4">
                    <MathText>{draft.stem || "—"}</MathText>
                  </div>

                  {draft.format === "multiple_choice" ? (
                    <div className="flex flex-col gap-2">
                      {draft.choices.map((c, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${draft.correctIndex === i ? "border-primary bg-primary/10" : "border-outline-variant bg-surface"}`}
                        >
                          <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${draft.correctIndex === i ? "bg-primary text-on-primary" : "bg-surface-variant text-on-surface-variant"}`}>
                            {String.fromCharCode(0x05d0 + i)}
                          </span>
                          <span className="text-on-surface"><MathText>{c || "—"}</MathText></span>
                          {draft.correctIndex === i && <Check size={15} className="text-primary mr-auto" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-lg border border-primary/40 bg-primary/5">
                      <span className="font-label-md text-on-surface-variant" style={{ fontSize: "11px" }}>תשובה: </span>
                      <span className="text-on-surface"><MathText>{draft.correctAnswer || "—"}</MathText></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions (review only) */}
        {step === "review" && draft && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant/60 bg-surface-container-lowest sticky bottom-0">
            <button
              onClick={busy ? undefined : onClose}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl border-2 border-outline-variant text-on-surface-variant hover:bg-surface-variant/50 transition-all font-label-lg disabled:opacity-40"
            >
              ביטול
            </button>
            <button
              onClick={handleApprove}
              disabled={busy}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-label-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              אשר והוסף לשיעורי הבית
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// Small helper so the "re-extract" button keeps the media closure tidy.
function reExtractGuard(
  media: PreparedMedia,
  run: (m: PreparedMedia) => Promise<void>
) {
  return () => { run(media); };
}
