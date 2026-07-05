// ── Central Gemini model config ──────────────────────────────────────────
// One place to name models + pick per-task fallback order. On a 429 (rate
// limit) a caller moves to the next model in its task's list instead of
// failing outright. Each distinct model has its OWN free-tier quota bucket,
// so we deliberately keep the older models in the chain too — more models
// in a chain means more total free requests/day before we're fully rate
// limited, not just a quality fallback.
//
//   gemini-3.5-flash       — balanced, multimodal, best default quality
//   gemini-3.1-flash-lite  — high-frequency, lightweight/cheap
//   gemini-3-flash         — general-purpose
//   gemini-2.5-flash       — previous-gen balanced model, separate quota
//   gemini-2.5-flash-lite  — previous-gen lightweight model, separate quota
//   gemini-2.0-flash       — older-gen fallback, separate quota

export const GEMINI_MODELS = {
  // User-facing tutor chat: quality first, then cheaper/older models.
  chat: [
    "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash",
    "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash",
  ],
  // Proof-step grading: correctness matters most, lite/older models last.
  grading: [
    "gemini-3.5-flash", "gemini-3-flash", "gemini-2.5-flash",
    "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.0-flash",
  ],
  // Background question rewriting/personalization: cheap model first, it's not user-blocking.
  rewrite: [
    "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash",
    "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash",
  ],
  // Background conversation analysis: cheap model first, same reasoning as rewrite.
  analysis: [
    "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash",
    "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash",
  ],
} as const;

export type GeminiTask = keyof typeof GEMINI_MODELS;

// Allowlist for the client-facing proxy — union of every task's models, since
// the proxy doesn't know which task the browser is asking for.
export const ALL_GEMINI_MODELS: string[] = Array.from(
  new Set(Object.values(GEMINI_MODELS).flat())
);

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

// Tries each model in order, retrying transient errors (429 rate-limit, 5xx
// overload) with backoff before falling through to the next model.
export async function generateWithFallback(
  apiKey: string,
  models: readonly string[],
  body: unknown,
  opts: { maxAttemptsPerModel?: number } = {}
): Promise<
  | { ok: true; model: string; data: any }
  | { ok: false; status: number; error: string }
> {
  const maxAttempts = opts.maxAttemptsPerModel ?? 1;
  let lastStatus = 0;
  let lastError = "";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        lastError = `Gemini ${model} fetch failed: ${String(e)}`;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        break;
      }

      if (res.ok) {
        return { ok: true, model, data: await res.json() };
      }

      lastStatus = res.status;
      lastError = `Gemini ${model} returned ${res.status}`;
      if (TRANSIENT_STATUS.has(res.status) && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      break; // exhausted retries (or non-transient) — move to next model
    }
  }

  return { ok: false, status: lastStatus || 502, error: lastError };
}
