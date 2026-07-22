import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "../lib/errors";

const MAX_BYTES = 20 * 1024 * 1024;

// Full-PDF packet import (auto AI pipeline): uploads the source PDF to Convex
// storage, kicks off the extraction pipeline, and routes to the review page.
// Distinct from QuestionImportModal (single question) and PacketCropBuilder
// (manual crop). Single entry point: the "מטלה חדשה" menu in ניהול מטלות.
export function usePacketIngest(classroomId: Id<"classrooms"> | null) {
  const navigate = useNavigate();
  const generateUploadUrl = useMutation(api.packetImport.generateUploadUrl);
  const start = useMutation(api.packetImport.start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingest = async (file: File) => {
    if (!classroomId) return;
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
      setError(errorMessage(e, "העלאה נכשלה."));
      setBusy(false);
    }
  };

  return { ingest, busy, error };
}
