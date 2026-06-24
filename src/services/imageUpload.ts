// ── Client-side image preparation for notebook checks ──
// A notebook photo straight off a phone is often 3-8MB. We never want to ship
// that to Gemini (slow + costly) or stash it raw in IndexedDB, so we downscale
// to a sane resolution and re-encode as JPEG. The result carries both a
// `dataUrl` (for the <img> preview / chat bubble) and raw `base64` (for the
// Gemini `inlineData` part).

export interface PreparedImage {
  dataUrl: string; // "data:image/jpeg;base64,..." — for <img> rendering
  base64: string; // raw base64 (no prefix) — for Gemini inlineData
  mimeType: string; // always "image/jpeg" after re-encoding
  width?: number; // set by prepareImageForUpload; omitted for QR-bridged images
  height?: number;
}

// Longest edge after downscale. 1280px keeps handwriting legible to the vision
// model while landing a typical photo around 150-350KB.
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;
// Reject obviously-wrong uploads before we even decode them.
const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20MB

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("לא ניתן לפתוח את התמונה. נסה פורמט אחר (JPG/PNG)."));
    };
    img.src = url;
  });
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/**
 * Validate, downscale, and JPEG-encode a user-selected image file.
 * Throws an Error (Hebrew message) on unsupported / oversized / unreadable input.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("יש לבחור קובץ תמונה (JPG, PNG).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("התמונה גדולה מדי (מקסימום 20MB). נסה לצלם שוב.");
  }

  const img = await loadImageElement(file);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("הדפדפן אינו תומך בעיבוד תמונה.");
  // White backdrop so transparent PNGs don't turn black under JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) throw new Error("עיבוד התמונה נכשל. נסה שוב.");

  return { dataUrl, base64, mimeType: "image/jpeg", width, height };
}

// ── Mixed media (image OR PDF) for teacher question import ──
// Images are downscaled/re-encoded (above); PDFs are passed through as raw
// base64 — the Gemini flash-lite models read application/pdf natively, so no
// pdfjs / page rasterization is needed.
export interface PreparedMedia {
  kind: "image" | "pdf";
  mimeType: string; // "image/jpeg" | "application/pdf"
  base64: string; // raw base64 for Gemini inlineData
  previewUrl?: string; // data URL — images only (PDFs have no inline preview)
  fileName: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      if (!base64) reject(new Error("קריאת הקובץ נכשלה."));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error("קריאת הקובץ נכשלה."));
    reader.readAsDataURL(file);
  });
}

export async function prepareMediaForUpload(file: File): Promise<PreparedMedia> {
  const fileName = file.name || "upload";
  const isPdf = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    if (file.size > MAX_INPUT_BYTES) {
      throw new Error("הקובץ גדול מדי (מקסימום 20MB).");
    }
    const base64 = await fileToBase64(file);
    return { kind: "pdf", mimeType: "application/pdf", base64, fileName };
  }

  if (file.type.startsWith("image/")) {
    const img = await prepareImageForUpload(file);
    return { kind: "image", mimeType: img.mimeType, base64: img.base64, previewUrl: img.dataUrl, fileName };
  }

  throw new Error("יש להעלות תמונה (JPG/PNG) או PDF.");
}
