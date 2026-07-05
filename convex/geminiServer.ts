// ── Server-side Gemini helper for the packet pipeline ──
// A plain async helper (not a Convex function) called from the packet
// internalActions. Mirrors the raw-fetch + process.env.GEMINI_API_KEY pattern
// already used in convex/ai.ts, adding what the packet job needs over that
// one-shot usage: a model-fallback chain, 429 backoff, a raised output-token
// budget, and — critically — the response's `finishReason`, so callers can
// detect MAX_TOKENS truncation and split a chunk instead of losing it.

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  // A file already uploaded via the Files API (see uploadFileToGemini). Sending
  // the URI instead of inline base64 keeps large, reused media (the packet PDF)
  // out of every request body — the file's bytes leave Convex only once.
  | { fileData: { mimeType: string; fileUri: string } };

export interface GeminiFile {
  uri: string;          // "https://…/files/abc" — reference in a fileData part
  name: string;         // "files/abc" — for files.get / files.delete
  mimeType: string;
  expiresAt: number;    // ms epoch; Files API stores uploads for ~48h
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com";

/**
 * Upload bytes to the Gemini Files API and wait until the file is ACTIVE.
 * Uses the documented resumable-upload protocol via raw fetch (matching the
 * key/fetch pattern of geminiJson). Returns a handle to reference by URI in
 * later generateContent calls. Throws on any failure — the caller decides
 * whether to fall back to inline data or fail the job.
 */
export async function uploadFileToGemini(
  bytes: Uint8Array,
  mimeType: string,
  displayName: string,
): Promise<GeminiFile> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const numBytes = bytes.byteLength;

  // 1. Start a resumable upload — Google returns the one-time upload URL in a
  //    response header, not the body.
  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(numBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!startRes.ok) {
    throw new Error(
      `Gemini file upload start failed: ${startRes.status} ${(await startRes.text()).slice(0, 300)}`,
    );
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini file upload: missing upload URL header");

  // 2. Upload the bytes and finalize in a single request.
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!upRes.ok) {
    throw new Error(
      `Gemini file upload failed: ${upRes.status} ${(await upRes.text()).slice(0, 300)}`,
    );
  }
  const info = await upRes.json();
  const file = info?.file;
  if (!file?.uri || !file?.name) throw new Error("Gemini file upload: malformed response");

  // 3. A freshly uploaded file may be PROCESSING; it can't be referenced until
  //    ACTIVE. PDFs flip almost immediately, but poll defensively.
  const active = await waitForFileActive(file.name, apiKey);
  const expMs = Date.parse(active?.expirationTime ?? file.expirationTime ?? "");
  return {
    uri: file.uri,
    name: file.name,
    mimeType: file.mimeType ?? mimeType,
    // Fall back to a conservative 47h if the API omitted expirationTime.
    expiresAt: Number.isFinite(expMs) ? expMs : Date.now() + 47 * 60 * 60 * 1000,
  };
}

async function waitForFileActive(
  name: string,
  apiKey: string,
): Promise<{ state?: string; expirationTime?: string }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${GEMINI_BASE}/v1beta/${name}?key=${apiKey}`);
    if (res.ok) {
      const f = await res.json();
      if (f?.state === "ACTIVE") return f;
      if (f?.state === "FAILED") throw new Error("Gemini file processing failed");
    }
    await sleep(1000 * (attempt + 1));
  }
  throw new Error("Gemini file did not become ACTIVE in time");
}

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
  maxRetriesPerModel?: number; // default 4 (backoff attempts per model)
  baseDelayMs?: number;        // default 1500 (5xx exponential backoff base)
  rateLimitDelayMs?: number;   // default 20000 (429 wait unit; ×attempt)
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
    // Set per-attempt below: rate limits need tens of seconds, not the base
    // exponential (free-tier Gemini is ~10 req/min).
    let nextDelay = 0;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) await sleep(nextDelay || baseDelay * 2 ** (attempt - 1));

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
      // Rate limits reset per minute on the free tier, so 429 waits are long
      // (Retry-After when Google sends it, else 20s/40s/60s); 5xx keeps the
      // short exponential.
      if (res.status === 429 || res.status >= 500) {
        if (res.status === 429) {
          // Google's 429 body says WHICH quota tripped. Per-minute quotas
          // reset in seconds — worth waiting. Per-day quotas reset at
          // midnight PT — retrying just burns more requests, so give up
          // with a message the teacher can act on.
          let quotaBody = "";
          try {
            quotaBody = (await res.text()).slice(0, 600);
          } catch {
            /* body unavailable */
          }
          if (/PerDay/i.test(quotaBody)) {
            throw new Error(
              `${model} daily quota exhausted (resets midnight PT): ${quotaBody.slice(0, 300)}`,
            );
          }
          lastError = new Error(`${model} transient 429 ${quotaBody.slice(0, 300)}`);
          const retryAfter = Number(res.headers?.get?.("retry-after"));
          nextDelay = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 90000)
            : (opts.rateLimitDelayMs ?? 20000) * (attempt + 1);
        } else {
          lastError = new Error(`${model} transient ${res.status}`);
          nextDelay = 0; // fall back to the exponential baseDelay schedule
        }
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
