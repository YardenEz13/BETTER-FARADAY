// ── Central Gemini model config ──────────────────────────────────────────
// One place to name models + pick per-task fallback order. On a 429 (rate
// limit) a caller moves to the next model in its task's list instead of
// failing outright. Each distinct model has its OWN free-tier quota bucket,
// so we deliberately keep the older models in the chain too — more models
// in a chain means more total free requests/day before we're fully rate
// limited, not just a quality fallback.
//
// Free-tier quota per model (RPM/RPD limits — Google AI Studio, checked
// 2026-07-31). gemini-2.0-flash is gone from the account's model list, so it
// was dropped from every chain below.
//
//   gemini-3.6-flash       — newest; RPM 5, RPD 20  — authoring new questions only
//   gemini-3.5-flash       — balanced, multimodal, best default quality; RPM 5, RPD 20
//   gemini-3.5-flash-lite  — newest lightweight; RPM 15, RPD 500 — theme rewrites
//   gemini-3.1-flash-lite  — RPM 15, RPD 500 — high-frequency, lightweight/cheap
//   gemini-3-flash         — general-purpose; RPM 5, RPD 20
//   gemini-2.5-flash       — previous-gen balanced model; RPM 5, RPD 20, separate quota
//   gemini-2.5-flash-lite  — previous-gen lightweight model; RPM 10, RPD 20, separate quota
//
// The two *-flash-lite models carry ~25x the daily quota of every other
// model here, so any high-volume task (chat, rewrite, analysis) leads with
// one of them for throughput; quality-first tasks (grading, vision) still
// lead with a heavier model and fall back to the lite pair last.

export const GEMINI_MODELS = {
  // User-facing tutor chat: highest request volume of any task (every student
  // message), so lead with the lite model for throughput/quota headroom, not
  // raw quality — the escalation-level prompt already keeps replies short and
  // simple enough that lite handles them well. Heavier models are fallback
  // only, for when lite itself is rate-limited.
  chat: [
    "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash",
    "gemini-2.5-flash-lite", "gemini-2.5-flash",
  ],
  // Proof-step grading: correctness matters most, lite/older models last.
  grading: [
    "gemini-3.5-flash", "gemini-3-flash", "gemini-2.5-flash",
    "gemini-3.1-flash-lite", "gemini-2.5-flash-lite",
  ],
  // Authoring brand-new bagrut-style questions (questionGen cron). Newest
  // model first because a wrong question costs more than a skipped batch;
  // one fallback so a 429 on 3.6 doesn't idle the run. Deliberately short —
  // older models write weaker questions and the run is manual anyway.
  authoring: ["gemini-3.6-flash", "gemini-3.5-flash"],
  // Homework theme personalization (ai.personalizeHomework). Lite models only:
  // it's a rewrite with the math frozen, not reasoning.
  rewrite: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  // Background conversation analysis: cheap model first, same reasoning as rewrite.
  analysis: [
    "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash",
    "gemini-2.5-flash-lite", "gemini-2.5-flash",
  ],
  // Notebook-photo / question-image reading: needs real multimodal reasoning to
  // read messy handwriting reliably, so quality first like grading. Lite models
  // are fallback only if the good ones are rate-limited.
  vision: [
    "gemini-3.5-flash", "gemini-3-flash", "gemini-2.5-flash",
    "gemini-3.1-flash-lite", "gemini-2.5-flash-lite",
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
