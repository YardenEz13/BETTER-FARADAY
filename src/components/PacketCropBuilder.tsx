import { useState, useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Upload, Loader as Loader2, Check, X, Scissors, Trash2,
  ChevronRight, ChevronLeft, Send, Sparkles,
} from "./electric";
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// One question the teacher assembled: a question crop + optional answer crop.
interface CropPair {
  questionDataUrl: string;
  answerDataUrl: string | null;
  pageStart: number;
}

interface Rect { x: number; y: number; w: number; h: number; }

interface Props {
  classroomId: Id<"classrooms">;
  onClose: () => void;
}

// Recompress a crop so a question+answer pair stays well under the 1MB Convex
// doc limit and the whole packet fits one Gemini request: max 900px wide,
// JPEG q0.72.
async function shrinkDataUrl(dataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("bad image"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, 900 / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

const stripPrefix = (dataUrl: string) => dataUrl.replace(/^data:image\/jpeg;base64,/, "");

// ── Crop-mode packet builder ──
// Teacher crops each QUESTION, then (optionally) its ANSWER from the answer-key
// pages. On submit everything is sent to Gemini in ONE request that structures
// the whole homework (סעיפים split + question-type classification); answers are
// transcribed from the teacher's crops, never re-solved.
export default function PacketCropBuilder({ classroomId, onClose }: Props) {
  const navigate = useNavigate();
  const generateUploadUrl = useMutation(api.packetImport.generateUploadUrl);
  const startCropPacket = useMutation(api.packetImport.startCropPacket);
  const addCroppedQuestion = useMutation(api.packetImport.addCroppedQuestion);
  const submitCropPacket = useMutation(api.packetImport.submitCropPacket);

  // ── PDF state (same mechanics as PdfAssignmentBuilder) ──
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [rendering, setRendering] = useState(false);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Crop state ──
  const [sel, setSel] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  // Two-step flow: crop the question first, then its answer (or skip).
  const [stage, setStage] = useState<"question" | "answer">("question");
  const [pendingQuestion, setPendingQuestion] = useState<{ dataUrl: string; page: number } | null>(null);

  const [pairs, setPairs] = useState<CropPair[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renderPage = useCallback(async (num: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    setRendering(true);
    try {
      renderTaskRef.current?.cancel();
      const page = await doc.getPage(num);
      const base = page.getViewport({ scale: 1 });
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
        console.error("[PacketCrop] render failed:", err);
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
      setTimeout(() => renderPage(1), 0);
    } catch (err) {
      console.error("[PacketCrop] load failed:", err);
      setError("טעינת ה-PDF נכשלה. נסה קובץ אחר.");
    }
  };

  // ── Pointer-drag selection ──
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
    setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onPointerUp = () => { dragStart.current = null; };

  const cropSelection = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !sel || sel.w < 8 || sel.h < 8) {
      setError("סמן אזור גדול יותר.");
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const out = document.createElement("canvas");
    out.width = Math.round(sel.w * scaleX);
    out.height = Math.round(sel.h * scaleY);
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, sel.x * scaleX, sel.y * scaleY, sel.w * scaleX, sel.h * scaleY, 0, 0, out.width, out.height);
    setError(null);
    return out.toDataURL("image/jpeg", 0.82);
  };

  const takeQuestionCrop = () => {
    const dataUrl = cropSelection();
    if (!dataUrl) return;
    setPendingQuestion({ dataUrl, page: pageNum });
    setStage("answer");
    setSel(null);
  };

  const takeAnswerCrop = () => {
    const dataUrl = cropSelection();
    if (!dataUrl || !pendingQuestion) return;
    setPairs((ps) => [...ps, { questionDataUrl: pendingQuestion.dataUrl, answerDataUrl: dataUrl, pageStart: pendingQuestion.page }]);
    setPendingQuestion(null);
    setStage("question");
    setSel(null);
  };

  const skipAnswer = () => {
    if (!pendingQuestion) return;
    setPairs((ps) => [...ps, { questionDataUrl: pendingQuestion.dataUrl, answerDataUrl: null, pageStart: pendingQuestion.page }]);
    setPendingQuestion(null);
    setStage("question");
    setSel(null);
  };

  const removePair = (i: number) => setPairs((ps) => ps.filter((_, j) => j !== i));

  // ── Submit: upload PDF, create packet, push pairs, fire the ONE AI request ──
  const handleSubmit = async () => {
    if (!pdfFile || pairs.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      setProgress("מעלה את הקובץ…");
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: pdfFile,
      });
      if (!res.ok) throw new Error("העלאת ה-PDF נכשלה.");
      const { storageId } = await res.json();

      const packetId = await startCropPacket({
        classroomId,
        sourceName: pdfFile.name,
        pdfStorageId: storageId as Id<"_storage">,
      });

      for (let i = 0; i < pairs.length; i++) {
        setProgress(`שומר שאלה ${i + 1} מתוך ${pairs.length}…`);
        const q = await shrinkDataUrl(pairs[i].questionDataUrl);
        const a = pairs[i].answerDataUrl ? await shrinkDataUrl(pairs[i].answerDataUrl as string) : null;
        await addCroppedQuestion({
          packetId,
          orderIndex: i,
          questionImageBase64: stripPrefix(q),
          ...(a ? { answerImageBase64: stripPrefix(a) } : {}),
          pageStart: pairs[i].pageStart,
        });
      }

      setProgress("שולח ל-AI…");
      await submitCropPacket({ packetId });
      navigate(`/teacher/packet/${packetId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שליחה נכשלה.");
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch" dir="rtl" onClick={onClose}>
      <div
        className="m-auto w-[min(1100px,96vw)] h-[92vh] bg-[var(--color-background)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[var(--color-outline-variant)] bg-[var(--color-surface)]">
          <div className="font-extrabold flex items-center gap-2">
            <Scissors size={18} className="text-[var(--color-primary)]" />
            ייבוא חוברת בחיתוך ידני
          </div>
          <button type="button" aria-label="סגור" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Canvas side */}
          <div className="flex-1 flex flex-col min-w-0 p-4">
            {!pdfFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 grid place-items-center rounded-2xl border-2 border-dashed border-[var(--color-primary)] text-[var(--color-primary)] font-bold"
              >
                <span className="flex items-center gap-2"><Upload size={18} /> בחר קובץ PDF</span>
              </button>
            ) : (
              <>
                {/* Stage banner */}
                <div className={`mb-2 px-3 py-2 rounded-lg text-sm font-bold ${
                  stage === "question"
                    ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]"
                    : "bg-[color-mix(in_srgb,var(--color-tertiary)_15%,transparent)] text-[var(--color-tertiary)]"
                }`}>
                  {stage === "question"
                    ? `סמן את שאלה ${pairs.length + 1} וגזור`
                    : `עכשיו סמן את התשובה לשאלה ${pairs.length + 1} (בדפי הפתרונות) — או דלג`}
                </div>

                <div className="flex-1 overflow-auto rounded-xl border-2 border-[var(--color-outline-variant)] bg-white relative">
                  <div
                    className="relative inline-block touch-none select-none cursor-crosshair"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  >
                    <canvas ref={canvasRef} className="block max-w-full h-auto" />
                    {sel && (
                      <div
                        className="absolute border-2 border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] pointer-events-none"
                        style={{ insetInlineStart: undefined, left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
                      />
                    )}
                    {rendering && (
                      <div className="absolute inset-0 grid place-items-center bg-white/60">
                        <Loader2 size={22} className="animate-spin text-[var(--color-primary)]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Page nav + crop actions */}
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" aria-label="עמוד קודם" disabled={pageNum <= 1}
                    onClick={() => setPageNum((n) => Math.max(1, n - 1))}
                    className="p-2 rounded-lg border-2 border-[var(--color-outline-variant)] disabled:opacity-40">
                    <ChevronRight size={16} />
                  </button>
                  <span className="text-sm font-bold">{pageNum} / {pageCount}</span>
                  <button type="button" aria-label="עמוד הבא" disabled={pageNum >= pageCount}
                    onClick={() => setPageNum((n) => Math.min(pageCount, n + 1))}
                    className="p-2 rounded-lg border-2 border-[var(--color-outline-variant)] disabled:opacity-40">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex-1" />
                  {stage === "question" ? (
                    <button type="button" onClick={takeQuestionCrop} disabled={!sel}
                      className="btn-clay-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40">
                      <Scissors size={14} /> גזור שאלה
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={skipAnswer}
                        className="px-4 py-2 rounded-lg border-2 border-[var(--color-outline-variant)] font-bold text-sm">
                        דלג (בלי תשובה)
                      </button>
                      <button type="button" onClick={takeAnswerCrop} disabled={!sel}
                        className="btn-clay-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40">
                        <Scissors size={14} /> גזור תשובה
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) ingestPdf(f); }} />
          </div>

          {/* Pairs list */}
          <div className="w-72 border-s-2 border-[var(--color-outline-variant)] bg-[var(--color-surface)] flex flex-col min-h-0">
            <div className="px-4 py-3 font-bold text-sm border-b-2 border-[var(--color-outline-variant)]">
              שאלות שנחתכו ({pairs.length})
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {pendingQuestion && (
                <div className="rounded-xl border-2 border-dashed border-[var(--color-tertiary)] p-2">
                  <div className="text-[10px] font-bold text-[var(--color-tertiary)] mb-1">ממתין לתשובה…</div>
                  <img src={pendingQuestion.dataUrl} alt="" className="w-full rounded" />
                </div>
              )}
              {pairs.map((p, i) => (
                <div key={i} className="rounded-xl border-2 border-[var(--color-outline-variant)] p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">שאלה {i + 1}</span>
                    <span className="flex items-center gap-1.5">
                      {p.answerDataUrl
                        ? <span className="text-[10px] text-[var(--color-primary)] font-bold flex items-center gap-0.5"><Check size={11} /> תשובה</span>
                        : <span className="text-[10px] text-[var(--color-on-surface-variant)]">בלי תשובה</span>}
                      <button type="button" aria-label="מחק" onClick={() => removePair(i)}>
                        <Trash2 size={13} className="text-[var(--color-error)]" />
                      </button>
                    </span>
                  </div>
                  <img src={p.questionDataUrl} alt="" className="w-full rounded" />
                </div>
              ))}
              {pairs.length === 0 && !pendingQuestion && (
                <div className="text-xs text-[var(--color-on-surface-variant)] text-center py-6">
                  גזור שאלה ואז את התשובה שלה — הזוגות יופיעו כאן.
                </div>
              )}
            </div>
            <div className="p-3 border-t-2 border-[var(--color-outline-variant)]">
              {error && <p className="text-xs text-[var(--color-error)] font-bold mb-2">{error}</p>}
              {progress && <p className="text-xs text-[var(--color-primary)] font-bold mb-2">{progress}</p>}
              <button
                type="button"
                disabled={pairs.length === 0 || submitting}
                onClick={handleSubmit}
                className="btn-clay-primary w-full flex items-center justify-center gap-2 py-2.5 font-bold disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {submitting ? "שולח…" : <>שלח הכל ל-AI <Send size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
