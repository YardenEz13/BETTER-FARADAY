import type { VercelRequest, VercelResponse } from "@vercel/node";

// Lets the client forward errors and key events here so they land in Vercel's
// Runtime Logs (the SPA itself has no other server surface — everything else
// runs through Convex, whose logs live in the Convex dashboard, not Vercel).

type LogLevel = "debug" | "info" | "warn" | "error";
const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

interface LogPayload {
  level?: string;
  message?: string;
  context?: Record<string, unknown>;
  url?: string;
}

const MAX_MESSAGE_LEN = 2000;
const MAX_CONTEXT_LEN = 4000;

export default function handler(req: VercelRequest, res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as LogPayload;
  const level: LogLevel = LEVELS.includes(body.level as LogLevel) ? (body.level as LogLevel) : "info";
  const message = typeof body.message === "string" ? body.message.slice(0, MAX_MESSAGE_LEN) : "(no message)";

  let contextStr: string | undefined;
  if (body.context && typeof body.context === "object") {
    try {
      contextStr = JSON.stringify(body.context).slice(0, MAX_CONTEXT_LEN);
    } catch {
      contextStr = "(unserializable context)";
    }
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim();

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    url: typeof body.url === "string" ? body.url.slice(0, 500) : req.headers.referer,
    ip,
    userAgent: req.headers["user-agent"],
    context: contextStr,
  };

  const line = `[client:${level}] ${JSON.stringify(entry)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  res.status(204).end();
}
