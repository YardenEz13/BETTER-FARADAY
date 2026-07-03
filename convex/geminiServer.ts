// ── Server-side Gemini helper for the packet pipeline ──
// A plain async helper (not a Convex function) called from the packet
// internalActions. Mirrors the raw-fetch + process.env.GEMINI_API_KEY pattern
// already used in convex/ai.ts, adding what the packet job needs over that
// one-shot usage: a model-fallback chain, 429 backoff, a raised output-token
// budget, and — critically — the response's `finishReason`, so callers can
// detect MAX_TOKENS truncation and split a chunk instead of losing it.

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface GeminiJsonOptions {
  parts: GeminiPart[];
  systemInstruction?: string;
  temperature?: number;        // default 0.2
  maxOutputTokens?: number;    // default 16000 (solve calls pass ~32000)
  // Gemini 2.5 thinks by default and its thinking tokens COUNT AGAINST
  // maxOutputTokens — a hard (e.g. geometry-proof) batch can burn the whole
  // budget on thought and return an empty/truncated JSON with MAX_TOKENS.
  // Default 0 = thinking off; raise deliberately if a pass needs it.
  thinkingBudget?: number;
  models?: string[];           // default fallback chain
  maxRetriesPerModel?: number; // default 3 (429 backoff attempts per model)
  baseDelayMs?: number;        // default 500 (exponential backoff base)
  signal?: AbortSignal;
}

export interface GeminiJsonResult {
  text: string;         // raw text (may be partial when finishReason is MAX_TOKENS)
  finishReason: string; // "STOP" | "MAX_TOKENS" | ...
  model: string;        // the model that produced the result
}

const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini `generateContent` with JSON output, retrying on 429 and falling
 * back across models. Returns the (possibly partial) text plus its finishReason.
 * Throws only when every model/attempt fails or the API key is missing — the
 * caller marks the affected packet/question failed.
 */
export async function geminiJson(opts: GeminiJsonOptions): Promise<GeminiJsonResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const models = opts.models ?? DEFAULT_MODELS;
  const maxRetries = opts.maxRetriesPerModel ?? 4;
  const baseDelay = opts.baseDelayMs ?? 1500; // 1.5s → 3s → 6s per model on 429/5xx

  const body = {
    contents: [{ role: "user", parts: opts.parts }],
    ...(opts.systemInstruction
      ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
      : {}),
    generationConfig: {
      responseMimeType: "application/json",
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 16000,
      thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 0 },
    },
  };

  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) await sleep(baseDelay * 2 ** (attempt - 1));

      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: opts.signal,
          },
        );
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        continue; // network error → retry the same model
      }

      // 429 (rate limit) and 5xx (Google overload — 503 is routine for heavy
      // multimodal requests) are transient: back off and retry the same model.
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`${model} transient ${res.status}`);
        continue;
      }
      if (!res.ok) {
        // Pull Google's error payload — status text alone hides the real cause
        // (INVALID_ARGUMENT details, size limits, blocked key, ...).
        let body = "";
        try {
          body = (await res.text()).slice(0, 400);
        } catch {
          /* body unavailable */
        }
        lastError = new Error(`${model} error ${res.status} ${res.statusText} ${body}`);
        break; // non-429 failure → move to the next model
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts;
      const text = Array.isArray(parts)
        ? parts.map((p: { text?: string }) => p?.text ?? "").join("")
        : "";
      const finishReason: string = candidate?.finishReason ?? "UNKNOWN";
      return { text, finishReason, model };
    }
  }

  throw lastError ?? new Error("Gemini request failed");
}
