/**
 * Convex re-throws server errors on the client wrapped in framework noise:
 *   "[Request ID: 4f2…] Server Error  Uncaught Error: אין מספיק XP\n    at handler…"
 * The only part worth showing a student is the message the mutation actually
 * threw, so strip the wrapper and keep the first line.
 */
export function errorMessage(e: unknown, fallback = "משהו השתבש. נסו שוב."): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const clean = raw
    .replace(/^\[.*?\]\s*/, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/Uncaught (Convex)?Error:\s*/i, "")
    .split("\n")[0]
    .trim();
  // A raw stack frame or an empty string is worse than the generic fallback.
  return clean && !clean.startsWith("at ") ? clean : fallback;
}

/** Event name the global handlers in main.tsx fire; ErrorToaster listens. */
export const ERROR_EVENT = "faraday:error";

export function reportToUser(e: unknown) {
  window.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: errorMessage(e) }));
}
