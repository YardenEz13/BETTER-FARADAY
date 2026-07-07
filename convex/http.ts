import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { ALL_GEMINI_MODELS, GEMINI_MODELS, type GeminiTask } from "./geminiModels";
import { internal } from "./_generated/api";
import { rateLimiter, RESTING_MESSAGE } from "./aiGate";

// ── Gemini proxy ──────────────────────────────────────────────────────────
// The browser must never hold the Gemini API key (a `VITE_`-prefixed key is
// baked into the bundle and trivially extractable → cost + abuse risk). Instead
// the client builds the exact same Gemini payload it used to send directly, and
// POSTs it here; we add the server-side key and forward to Google. The key lives
// only in Convex env (`npx convex env set GEMINI_API_KEY ...`), and this is the
// single choke point where we can throttle, meter, or cap usage later.

// Models the proxy is allowed to forward to. Guards against a tampered client
// asking us to bill arbitrary models on the project's key.
const ALLOWED_MODELS = ALL_GEMINI_MODELS;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function corsPreflight() {
  return httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS }));
}

// SSE-shaped "resting" message so the client's existing chunk-parsing code path
// (which expects `data: {...}` lines with a Gemini-shaped payload) renders it
// like any other reply, instead of needing a special-cased error branch.
function restingSseResponse() {
  const chunk = {
    candidates: [{ content: { parts: [{ text: RESTING_MESSAGE }] } }],
  };
  const body = `data: ${JSON.stringify(chunk)}\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", ...CORS_HEADERS },
  });
}

function restingJsonResponse() {
  const payload = {
    candidates: [{ content: { parts: [{ text: RESTING_MESSAGE }] } }],
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function rateLimitedResponse(retryAfterMs?: number, streaming?: boolean) {
  const msg = "פאראדיי עמוס כרגע — נסו שוב בעוד כמה דקות.";
  if (streaming) {
    const chunk = { candidates: [{ content: { parts: [{ text: msg }] } }] };
    return new Response(`data: ${JSON.stringify(chunk)}\n\n`, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", ...CORS_HEADERS },
    });
  }
  return new Response(JSON.stringify({ error: msg, retryAfterMs }), {
    status: 429,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const http = httpRouter();

// ── Streaming tutor proxy ──
// Pipes Gemini's SSE straight back to the browser (including non-OK statuses, so
// the client's existing 429 → next-model fallback keeps working). Abort is
// preserved because the client passes its own AbortSignal to its fetch.
http.route({
  path: "/gemini-stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let body: { model?: string; payload?: unknown; studentId?: string };
    try {
      body = await request.json();
    } catch {
      return new Response("bad request body", { status: 400, headers: CORS_HEADERS });
    }

    const model = body.model ?? "";
    if (!ALLOWED_MODELS.includes(model)) {
      return new Response("model not allowed", { status: 400, headers: CORS_HEADERS });
    }

    const aiEnabled = await ctx.runQuery(internal.aiGate.isAiEnabled, {});
    if (!aiEnabled) return restingSseResponse();

    const studentKey = body.studentId || "anonymous";
    const burst = await rateLimiter.limit(ctx, "globalBurst", { key: "global" });
    if (!burst.ok) return rateLimitedResponse(burst.retryAfter, true);
    const daily = await rateLimiter.limit(ctx, "globalDaily", { key: "global" });
    if (!daily.ok) return rateLimitedResponse(daily.retryAfter, true);
    const perStudent = await rateLimiter.limit(ctx, "studentChat", { key: studentKey });
    if (!perStudent.ok) return rateLimitedResponse(perStudent.retryAfter, true);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.payload ?? {}),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
        ...CORS_HEADERS,
      },
    });
  }),
});
http.route({ path: "/gemini-stream", method: "OPTIONS", handler: corsPreflight() });

// ── Non-streaming proxy (vision extraction, analysis, briefs) ──
// Does the model-fallback loop server-side and returns the raw Gemini JSON.
http.route({
  path: "/gemini-generate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let body: { payload?: unknown; task?: string; studentId?: string };
    try {
      body = await request.json();
    } catch {
      return new Response("bad request body", { status: 400, headers: CORS_HEADERS });
    }

    // Route by task so each caller gets its intended cost/quality tradeoff
    // (e.g. vision needs a real model to read handwriting; analysis is
    // background and cheap-first) instead of always trying chat's order first.
    const task = body.task as GeminiTask | undefined;
    const modelsForTask = (task && GEMINI_MODELS[task]) || ALL_GEMINI_MODELS;

    const aiEnabled = await ctx.runQuery(internal.aiGate.isAiEnabled, {});
    if (!aiEnabled) return restingJsonResponse();

    const studentKey = body.studentId || "anonymous";
    const burst = await rateLimiter.limit(ctx, "globalBurst", { key: "global" });
    if (!burst.ok) return rateLimitedResponse(burst.retryAfter, false);
    const daily = await rateLimiter.limit(ctx, "globalDaily", { key: "global" });
    if (!daily.ok) return rateLimitedResponse(daily.retryAfter, false);
    // Vision (notebook photo checks) is heavier — gate on its own bucket; other
    // background tasks (analysis/rewrite/grading/composite briefs) share the
    // lighter chat bucket since they're lower-frequency, non-user-blocking calls.
    const bucket = task === "vision" ? "studentVision" : "studentChat";
    const perStudent = await rateLimiter.limit(ctx, bucket, { key: studentKey });
    if (!perStudent.ok) return rateLimitedResponse(perStudent.retryAfter, false);

    let lastStatus = 0;
    for (const model of modelsForTask) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.payload ?? {}),
      });
      if (res.ok) {
        const json = await res.text();
        return new Response(json, {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      lastStatus = res.status;
      // Rate limited on this model → try the next one. Any other error is fatal.
      if (res.status !== 429) break;
    }
    return new Response(JSON.stringify({ error: `Gemini upstream failed (${lastStatus})` }), {
      status: lastStatus === 429 ? 429 : 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }),
});
http.route({ path: "/gemini-generate", method: "OPTIONS", handler: corsPreflight() });

export default http;
