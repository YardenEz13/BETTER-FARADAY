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

export interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

// Shared non-streaming Gemini helper. The Convex proxy does the model-fallback
// loop server-side and returns the raw Gemini JSON. The key never reaches the
// browser.
export async function geminiGenerateContent(
  payload: object,
  signal?: AbortSignal
): Promise<GeminiResponse> {
  if (!CONVEX_SITE_URL) throw new Error("Missing VITE_CONVEX_URL");
  const res = await fetch(GEMINI_GENERATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
    signal,
  });
  if (!res.ok) throw new Error(`Gemini proxy error: ${res.status} ${res.statusText}`);
  return await res.json();
}
