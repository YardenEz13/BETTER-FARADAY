// Forwards select client-side events to /api/log (a Vercel serverless
// function) so they show up in Vercel's Runtime Logs. Convex's own logs
// (e.g. convex/http.ts) live in the Convex dashboard instead — this is the
// only path that reaches Vercel.

type LogLevel = "debug" | "info" | "warn" | "error";

const ENDPOINT = "/api/log";

function send(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    level,
    message,
    context,
    url: window.location.href,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through to fetch
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Logging must never break the app.
  });
}

export const remoteLog = {
  debug: (message: string, context?: Record<string, unknown>) => send("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => send("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => send("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => send("error", message, context),
};

export function installGlobalErrorLogging(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    remoteLog.error("Uncaught error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    remoteLog.error("Unhandled promise rejection", {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
