import { useState, useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import {
  Upload, FileText, Loader2, Check, X, Scissors, Trash2,
  ChevronRight, ChevronLeft, UserPlus, Send, AlertTriangle, Plus,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// Hebrew section labels for multi-part questions: א, ב, ג…
const HE_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל"];

interface DraftPart { label: string; correctAnswer: string; }

// One question the teacher has cropped + answered, held client-side until publish.
// A simple question has a single part with an empty label; a multi-part question
// (סעיף א/ב/ג sharing one figure) has several labeled parts.
interface DraftQuestion {
  dataUrl: string;       // preview + the JPEG we upload (base64 derived from this)
  parts: DraftPart[];
}

// Selection rectangle in CSS pixels relative to the rendered canvas.
interface Rect { x: number; y: number; w: number; h: number; }

interface Props {
  classroomId: Id<"classrooms">;
  onClose: () => void;
  onPublished?: (studentName: string) => void;
}

export default function PdfAssignmentBuilder({ classroomId, onClose, onPublished }: Props) {
  const students = useQuery(api.classroom.getByClassroom, { classroomId });
  const addStudent = useMutation(api.classroom.addStudent);
  const generateUploadUrl = useMutation(api.pdfAssignments.generateUploadUrl);
  const createAssignment = useMutation(api.pdfAssignments.createAssignment);
  const addQuestion = useMutation(api.pdfAssignments.addQuestion);

  // ── Meta ──
  const [title, setTitle] = useState("");
  const [studentId, setStudentId] = useState<Id<"students"> | "">("");
  const [deadlineDays, setDeadlineDays] = useState(14);
  const [newStudentName, setNewStudentName] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  // ── PDF state ──
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [rendering, setRendering] = useState(false);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // ── Crop state ──
  const [sel, setSel] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [pendingCrop, setPendingCrop] = useState<string | null>(null); // dataUrl
  const [pendingParts, setPendingParts] = useState<DraftPart[]>([{ label: "", correctAnswer: "" }]);

  // ── Questions + publish ──
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Render the current PDF page onto the canvas ──
  const renderPage = useCallback(async (num: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    setRendering(true);
    try {
      renderTaskRef.current?.cancel();
      const page = await doc.getPage(num);
      const base = page.getViewport({ scale: 1 });
      // Aim for ~1100px wide renders so crops stay crisp without being huge.
      const scale = Math.min(3, Math.max(1, 1100 / base.width));
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      if ((err as { name?: string })?.name !== "RenderingCancelledException") {
        console.error("[PdfBuilder] render failed:", err);
      }
    } finally {
      setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (pdfDocRef.current) {
      setSel(null);
      renderPage(pageNum);
    }
  }, [pageNum, renderPage]);

  useEffect(() => () => { renderTaskRef.current?.cancel(); pdfDocRef.current?.destroy(); }, []);

  const ingestPdf = async (file: File) => {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("יש להעלות קובץ PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("הקובץ גדול מדי (מקסימום 20MB).");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      pdfDocRef.current = doc;
      setPdfFile(file);
      setPageCount(doc.numPages);
      setPageNum(1);
      // first page renders via the pageNum effect once canvas mounts
      setTimeout(() => renderPage(1), 0);
    } catch (err) {
      console.error("[PdfBuilder] load failed:", err);
      setError("טעינת ה-PDF נכשלה. נסה קובץ אחר.");
    }
  };

  // ── Crop selection (pointer events — works on touch + mouse) ──
  const pointFromEvent = (e: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pdfDocRef.current) return;
    const p = pointFromEvent(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStart.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const p = pointFromEvent(e);
    if (!p) return;
    const s = dragStart.current;
    setSel({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };

  const onPointerUp = () => { dragStart.current = null; };

  // Crop the current selection out of the full-resolution canvas.
  const cropSelection = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sel || sel.w < 8 || sel.h < 8) {
      setError("סמן אזור גדול יותר סביב השאלה.");
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const sx = sel.x * scaleX, sy = sel.y * scaleY;
    const sw = sel.w * scaleX, sh = sel.h * scaleY;

    const out = document.createElement("canvas");
    out.width = Math.round(sw);
    out.height = Math.round(sh);
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    setPendingCrop(out.toDataURL("image/jpeg", 0.82));
    setPendingParts([{ label: "", correctAnswer: "" }]);
    setError(null);
  };

  // ── Part management for the pending crop ──
  const patchPart = (i: number, patch: Partial<DraftPart>) =>
    setPendingParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const addPart = () =>
    setPendingParts((ps) => {
      // Promote a single unlabeled answer to "א" the moment a 2nd part appears.
      const labeled = ps.length === 1 && !ps[0].label
        ? [{ ...ps[0], label: HE_LABELS[0] }]
        : ps;
      return [...labeled, { label: HE_LABELS[labeled.length] ?? "", correctAnswer: "" }];
    });

  const removePart = (i: number) =>
    setPendingParts((ps) => (ps.length <= 1 ? ps : ps.filter((_, j) => j !== i)));

  const confirmQuestion = () => {
    if (!pendingCrop) return;
    const filled = pendingParts
      .map((p) => ({ label: p.label.trim(), correctAnswer: p.correctAnswer.trim() }))
      .filter((p) => p.correctAnswer);
    if (filled.length === 0) { setError("יש להזין לפחות תשובה אחת."); return; }
    // Re-label multi-part questions so labels are always present and ordered.
    const parts = filled.length === 1
      ? [{ label: "", correctAnswer: filled[0].correctAnswer }]
      : filled.map((p, i) => ({ label: p.label || HE_LABELS[i] || String(i + 1), correctAnswer: p.correctAnswer }));
    setQuestions((qs) => [...qs, { dataUrl: pendingCrop, parts }]);
    setPendingCrop(null);
    setPendingParts([{ label: "", correctAnswer: "" }]);
    setSel(null);
  };

  const handleAddStudent = async () => {
    const name = newStudentName.trim();
    if (!name) return;
    setAddingStudent(true);
    try {
      const id = await addStudent({ classroomId, name });
      setStudentId(id);
      setNewStudentName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "הוספת התלמיד נכשלה.");
    } finally {
      setAddingStudent(false);
    }
  };

  const canPublish = !!title.trim() && !!studentId && questions.length > 0 && !publishing;

  const handlePublish = async () => {
    if (!canPublish || !studentId) return;
    setPublishing(true);
    setError(null);
    try {
      // 1. Upload the source PDF to Convex file storage.
      let pdfStorageId: Id<"_storage"> | undefined;
      if (pdfFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: pdfFile,
        });
        if (!res.ok) throw new Error("העלאת ה-PDF נכשלה.");
        const json = await res.json();
        pdfStorageId = json.storageId as Id<"_storage">;
      }

      // 2. Create the assignment shell.
      const assignmentId = await createAssignment({
        classroomId,
        studentId,
        title: title.trim(),
        pdfStorageId,
        pdfFileName: pdfFile?.name,
        deadline: Date.now() + deadlineDays * 24 * 60 * 60 * 1000,
      });

      // 3. Add each cropped question (with its parts).
      for (const q of questions) {
        const base64 = q.dataUrl.split(",")[1] ?? "";
        await addQuestion({
          assignmentId,
          imageBase64: base64,
          imageMimeType: "image/jpeg",
          parts: q.parts.map((p) => ({ label: p.label, correctAnswer: p.correctAnswer })),
        });
      }

      const studentName = students?.find((s) => s._id === studentId)?.name ?? "התלמיד";
      onPublished?.(studentName);
      onClose();
    } catch (err) {
      console.error("[PdfBuilder] publish failed:", err);
      setError(err instanceof Error ? err.message : "פרסום המטלה נכשל.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      dir="rtl"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={publishing ? undefined : onClose} />

      <motion.div
        className="relative w-full max-w-[72rem] max-h-[94vh] flex flex-col overflow-hidden rounded-2xl border-2 border-outline-variant bg-surface shadow-2xl"
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 240 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/60 bg-surface-container-lowest flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary-container/30 border-2 border-primary flex items-center justify-center">
              <Scissors size={18} className="text-primary" />
            </span>
            <div>
              <div className="font-headline-md text-on-surface">מטלת PDF אישית</div>
              <div className="font-label-md text-on-surface-variant" style={{ fontSize: "12px" }}>
                חתוך כל שאלה מה-PDF, הזן תשובה — התלמיד יפתור ויקבל בדיקה מיידית
              </div>
            </div>
          </div>
          <button onClick={publishing ? undefined : onClose} disabled={publishing}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary transition-colors disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error/10 border border-error/30 text-error font-label-md flex-shrink-0" style={{ fontSize: "13px" }}>
            <AlertTriangle size={16} className="flex-shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-0 flex-1 min-h-0">
          {/* ── Left: PDF + crop ── */}
          <div className="flex-1 min-w-0 flex flex-col border-b lg:border-b-0 lg:border-l border-outline-variant/60 overflow-hidden">
            {!pdfFile ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div
                  className="w-full flex flex-col items-center justify-center text-center gap-4 py-14 px-6 rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) ingestPdf(f); }}
                >
                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) ingestPdf(f); }} />
                  <span className="w-16 h-16 rounded-2xl bg-primary-container/20 border-2 border-primary/40 flex items-center justify-center">
                    <Upload size={28} className="text-primary" />
                  </span>
                  <div>
                    <div className="font-headline-md text-on-surface mb-1">העלה את חוברת הקיץ (PDF)</div>
                    <div className="font-body-md text-on-surface-variant max-w-[24rem]">
                      גרור לכאן או לחץ לבחירה. לאחר מכן תסמן כל שאלה ותזין את תשובתה.
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-on-surface-variant/70 font-label-md" style={{ fontSize: "11px" }}>
                    <FileText size={13} /> PDF · עד 20MB
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Page nav */}
                <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-outline-variant/60 bg-surface-container-lowest flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPageNum((n) => Math.max(1, n - 1))} disabled={pageNum <= 1}
                      className="w-8 h-8 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-primary disabled:opacity-30">
                      <ChevronRight size={16} />
                    </button>
                    <span className="font-label-md text-on-surface tabular-nums" style={{ fontSize: "12px" }}>
                      עמ׳ {pageNum} / {pageCount}
                    </span>
                    <button onClick={() => setPageNum((n) => Math.min(pageCount, n + 1))} disabled={pageNum >= pageCount}
                      className="w-8 h-8 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-primary disabled:opacity-30">
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {rendering && <Loader2 size={15} className="text-primary animate-spin" />}
                    <button onClick={cropSelection} disabled={!sel || sel.w < 8}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md disabled:opacity-40 transition-all" style={{ fontSize: "12.5px" }}>
                      <Scissors size={14} /> חתוך שאלה
                    </button>
                  </div>
                </div>

                {/* Canvas + selection overlay */}
                <div className="flex-1 overflow-auto p-3 bg-surface-container-low">
                  <div className="relative inline-block mx-auto select-none touch-none"
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
                    <canvas ref={canvasRef} className="block max-w-full h-auto rounded-lg shadow-md" style={{ cursor: "crosshair" }} />
                    {sel && sel.w > 0 && (
                      <div className="absolute border-2 border-primary bg-primary/15 pointer-events-none rounded-sm"
                        style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Right: meta + crop confirm + questions ── */}
          <div className="w-full lg:w-[24rem] lg:flex-shrink-0 flex flex-col overflow-y-auto p-4 gap-4">
            {/* Pending crop → answer(s) */}
            {pendingCrop && (
              <div className="rounded-xl border-2 border-primary bg-primary/5 p-3 flex flex-col gap-2.5">
                <div className="font-label-md text-primary" style={{ fontSize: "12px" }}>
                  תצוגת החיתוך — הזן תשובות {pendingParts.length > 1 ? `(${pendingParts.length} סעיפים)` : ""}
                </div>
                <img src={pendingCrop} alt="crop" className="w-full rounded-lg border border-outline-variant bg-white" />

                <div className="flex flex-col gap-2">
                  {pendingParts.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {pendingParts.length > 1 && (
                        <input value={p.label} onChange={(e) => patchPart(i, { label: e.target.value })} dir="rtl"
                          className="w-9 flex-shrink-0 text-center bg-surface-container border-2 border-outline-variant rounded-lg px-1 py-2 text-on-surface font-bold focus:border-primary focus:outline-none"
                          aria-label="סעיף" />
                      )}
                      <input value={p.correctAnswer} onChange={(e) => patchPart(i, { correctAnswer: e.target.value })} dir="rtl"
                        placeholder={pendingParts.length > 1 ? `תשובת סעיף ${p.label || HE_LABELS[i]}` : "התשובה הנכונה (למשל: 12, x=3)"}
                        onKeyDown={(e) => { if (e.key === "Enter" && i === pendingParts.length - 1) confirmQuestion(); }}
                        className="flex-1 min-w-0 bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none" />
                      {pendingParts.length > 1 && (
                        <button onClick={() => removePart(i)}
                          className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button onClick={addPart}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 font-label-md transition-all" style={{ fontSize: "12.5px" }}>
                  <Plus size={14} /> הוסף סעיף
                </button>

                <div className="flex gap-2 pt-0.5">
                  <button onClick={confirmQuestion}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md transition-all">
                    <Check size={15} /> הוסף שאלה
                  </button>
                  <button onClick={() => { setPendingCrop(null); setSel(null); }}
                    className="px-3 py-2 rounded-lg border-2 border-outline-variant text-on-surface-variant hover:bg-surface-variant/50">
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="font-label-md text-on-surface-variant block mb-1">כותרת המטלה <span className="text-error">*</span></label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} dir="rtl" placeholder="חוברת קיץ — חדו״א"
                  className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none" />
              </div>

              <div>
                <label className="font-label-md text-on-surface-variant block mb-1">תלמיד יעד <span className="text-error">*</span></label>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value ? (e.target.value as Id<"students">) : "")} dir="rtl"
                  className="w-full bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none">
                  <option value="">— בחר תלמיד —</option>
                  {students?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
                <div className="flex gap-2 mt-2">
                  <input value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} dir="rtl"
                    placeholder="…או צור תלמיד חדש"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddStudent(); }}
                    className="flex-1 bg-surface-container border-2 border-outline-variant rounded-lg px-3 py-1.5 text-on-surface text-sm focus:border-primary focus:outline-none" />
                  <button onClick={handleAddStudent} disabled={!newStudentName.trim() || addingStudent}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-primary text-primary hover:bg-primary/10 font-label-md disabled:opacity-40" style={{ fontSize: "12.5px" }}>
                    {addingStudent ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} צור
                  </button>
                </div>
              </div>

              <div>
                <label className="font-label-md text-on-surface-variant block mb-1">מועד הגשה (ימים)</label>
                <div className="flex gap-2">
                  {[7, 14, 21, 30].map((d) => (
                    <button key={d} onClick={() => setDeadlineDays(d)}
                      className={`flex-1 h-9 rounded-lg text-sm font-bold border-2 transition-all ${deadlineDays === d ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/40"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Questions list */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-md text-on-surface-variant">שאלות שנוספו</span>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-xs">{questions.length}</span>
              </div>
              {questions.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant/60 font-body-md text-sm border-2 border-dashed border-outline-variant rounded-xl">
                  עדיין אין שאלות. סמן אזור ב-PDF ולחץ "חתוך שאלה".
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-outline-variant bg-surface-container-low">
                      <span className="w-6 h-6 flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <img src={q.dataUrl} alt={`q${i + 1}`} className="w-14 h-12 object-cover rounded border border-outline-variant bg-white flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-sm text-on-surface truncate">
                        {q.parts.length > 1
                          ? q.parts.map((p) => `${p.label}) ${p.correctAnswer}`).join("  ")
                          : q.parts[0]?.correctAnswer}
                      </span>
                      {q.parts.length > 1 && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">{q.parts.length} ס׳</span>
                      )}
                      <button onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                        className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-outline-variant/60 bg-surface-container-lowest flex-shrink-0">
          <span className="font-label-md text-on-surface-variant text-sm">
            {questions.length > 0 ? `${questions.length} שאלות מוכנות` : "סמן שאלות מה-PDF"}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={publishing ? undefined : onClose} disabled={publishing}
              className="px-5 py-2.5 rounded-xl border-2 border-outline-variant text-on-surface-variant hover:bg-surface-variant/50 transition-all font-label-lg disabled:opacity-40">
              ביטול
            </button>
            <button onClick={handlePublish} disabled={!canPublish}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-label-lg shadow-sm transition-all active:scale-95 disabled:opacity-40">
              {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              פרסם לתלמיד
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
