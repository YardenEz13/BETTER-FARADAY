import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

// ── Gemini proxy ──────────────────────────────────────────────────────────
// The browser must never hold the Gemini API key (a `VITE_`-prefixed key is
// baked into the bundle and trivially extractable → cost + abuse risk). Instead
// the client builds the exact same Gemini payload it used to send directly, and
// POSTs it here; we add the server-side key and forward to Google. The key lives
// only in Convex env (`npx convex env set GEMINI_API_KEY ...`), and this is the
// single choke point where we can throttle, meter, or cap usage later.

// Models the proxy is allowed to forward to. Guards against a tampered client
// asking us to bill arbitrary models on the project's key.
const ALLOWED_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function corsPreflight() {
  return httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS }));
}

const http = httpRouter();

// ── Streaming tutor proxy ──
// Pipes Gemini's SSE straight back to the browser (including non-OK statuses, so
// the client's existing 429 → next-model fallback keeps working). Abort is
// preserved because the client passes its own AbortSignal to its fetch.
http.route({
  path: "/gemini-stream",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let body: { model?: string; payload?: unknown };
    try {
      body = await request.json();
    } catch {
      return new Response("bad request body", { status: 400, headers: CORS_HEADERS });
    }

    const model = body.model ?? "";
    if (!ALLOWED_MODELS.includes(model)) {
      return new Response("model not allowed", { status: 400, headers: CORS_HEADERS });
    }

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
  handler: httpAction(async (_ctx, request) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let body: { payload?: unknown };
    try {
      body = await request.json();
    } catch {
      return new Response("bad request body", { status: 400, headers: CORS_HEADERS });
    }

    let lastStatus = 0;
    for (const model of ALLOWED_MODELS) {
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
