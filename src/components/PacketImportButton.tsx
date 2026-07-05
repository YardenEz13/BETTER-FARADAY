import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Upload, Loader as Loader2 } from "./electric";

const MAX_BYTES = 20 * 1024 * 1024;

// Teacher entry point for the full-PDF packet import (מטלת קיץ): uploads the
// source PDF to Convex storage, kicks off the extraction pipeline, and routes
// to the review page. Distinct from QuestionImportModal (single question).
export default function PacketImportButton({ classroomId }: { classroomId: Id<"classrooms"> }) {
  const navigate = useNavigate();
  const generateUploadUrl = useMutation(api.packetImport.generateUploadUrl);
  const start = useMutation(api.packetImport.start);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingest = async (file: File) => {
    setError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("יש להעלות קובץ PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("הקובץ גדול מדי (מקסימום 20MB).");
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!res.ok) throw new Error("העלאת ה-PDF נכשלה.");
      const { storageId } = await res.json();
      const packetId = await start({
        classroomId,
        sourceName: file.name,
        pdfStorageId: storageId as Id<"_storage">,
        verifyEnabled: true,
      });
      navigate(`/teacher/packet/${packetId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאה נכשלה.");
      setBusy(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) ingest(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] transition-all font-bold text-sm rounded-lg disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        ייבוא חוברת מלאה
      </button>
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  );
}
