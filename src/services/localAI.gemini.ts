// ── Gemini transport ──
// All Gemini traffic goes through Convex httpActions so the API key stays on the
// server (never in the browser bundle). Convex HTTP endpoints live on the
// `.convex.site` host, which is the `.convex.cloud` deployment URL with the TLD
// swapped. See convex/http.ts.
export const CONVEX_SITE_URL = ((import.meta.env.VITE_CONVEX_URL as string) || "").replace(
  /\.convex\.cloud$/,
  ".convex.site"
);
export const GEMINI_STREAM_URL = `${CONVEX_SITE_URL}/gemini-stream`;
export const GEMINI_GENERATE_URL = `${CONVEX_SITE_URL}/gemini-generate`;

// ── Active student id ──
// Set by localAI.createSession(); forwarded on every proxy call so Convex can
// rate-limit per student. No auth yet in this app, so this is an abuse/cost
// throttle, not a security boundary — lives here (the shared transport leaf)
// so both localAI.ts and localAI.analysis.ts/vision.ts can read it without a
// circular import back through the localAI.ts barrel.
let activeStudentId = "anonymous";
export function setActiveStudentId(studentId: string | undefined | null) {
  activeStudentId = studentId || "anonymous";
}
export function getActiveStudentId(): string {
  return activeStudentId;
}

export interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

// Task tag so the server picks the right per-task model order (see
// convex/geminiModels.ts) instead of a flat chat-shaped fallback list.
export type GeminiTask = "chat" | "grading" | "rewrite" | "analysis" | "vision";

// Shared non-streaming Gemini helper. The Convex proxy does the model-fallback
// loop server-side and returns the raw Gemini JSON. The key never reaches the
// browser.
export async function geminiGenerateContent(
  payload: object,
  signal?: AbortSignal,
  task?: GeminiTask,
  studentId?: string
): Promise<GeminiResponse> {
  if (!CONVEX_SITE_URL) throw new Error("Missing VITE_CONVEX_URL");
  const res = await fetch(GEMINI_GENERATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, task, studentId }),
    signal,
  });
  if (!res.ok) throw new Error(`Gemini proxy error: ${res.status} ${res.statusText}`);
  return await res.json();
}
