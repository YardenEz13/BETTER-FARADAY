/**
 * Lightweight action logger for browser devtools.
 *
 * Every call prints a timestamped, color-tagged line to the console so app
 * behavior can be traced live in production (Vercel-hosted static build —
 * there is no server runtime here, so this is the browser console, not the
 * Vercel dashboard). Grouped by domain tag, e.g. `log.practice(...)`.
 *
 * Usage:
 *   log.nav("student -> practice", { studentId, topicId });
 *   log.practice("answer submitted", { correct: true, xp: 12 });
 */

type LogArgs = Record<string, unknown> | undefined;

const STYLES: Record<string, string> = {
  nav: "color:#7B61FF;font-weight:700",
  auth: "color:#17C964;font-weight:700",
  practice: "color:#17C964;font-weight:700",
  homework: "color:#FFB02E;font-weight:700",
  ai: "color:#00B8D9;font-weight:700",
  bridge: "color:#FF4B4B;font-weight:700",
  theme: "color:#9AA0A6;font-weight:700",
  action: "color:#17C964;font-weight:700",
};

function emit(tag: string, message: string, data?: LogArgs) {
  const time = new Date().toISOString().split("T")[1].replace("Z", "");
  const style = STYLES[tag] ?? STYLES.action;
  if (data !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`%c[${tag}]%c ${time} — ${message}`, style, "color:inherit", data);
  } else {
    // eslint-disable-next-line no-console
    console.log(`%c[${tag}]%c ${time} — ${message}`, style, "color:inherit");
  }
}

export const log = {
  nav: (message: string, data?: LogArgs) => emit("nav", message, data),
  auth: (message: string, data?: LogArgs) => emit("auth", message, data),
  practice: (message: string, data?: LogArgs) => emit("practice", message, data),
  homework: (message: string, data?: LogArgs) => emit("homework", message, data),
  ai: (message: string, data?: LogArgs) => emit("ai", message, data),
  bridge: (message: string, data?: LogArgs) => emit("bridge", message, data),
  theme: (message: string, data?: LogArgs) => emit("theme", message, data),
  action: (message: string, data?: LogArgs) => emit("action", message, data),
};
