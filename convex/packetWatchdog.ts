// ── Stale-packet watchdog cutoff (pure) ──
// Convex actions die silently at the 10-minute ceiling — their rows would sit
// "pending" forever with no errorMessage. A pending row whose heartbeat is
// older than this (heartbeats land at action start, and split retries are
// staggered ≤45s apart) has no live action behind it → failed + retriable.
// Kept pure and free of Convex imports so the cutoff logic is unit-testable
// without a Convex harness (see packetWatchdog.test.ts).
export const STALE_PENDING_MS = 12 * 60 * 1000;

export function isStalePending(
  row: { status: string; pendingSince?: number; createdAt: number },
  now: number,
): boolean {
  return row.status === "pending" && now - (row.pendingSince ?? row.createdAt) > STALE_PENDING_MS;
}
