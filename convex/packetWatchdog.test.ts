import { describe, it, expect } from "vitest";
import { isStalePending, STALE_PENDING_MS } from "./packetImport";

const NOW = 1_000_000_000_000;

describe("isStalePending (stale packet-import watchdog cutoff)", () => {
  it("flags a pending row whose heartbeat is older than the cutoff", () => {
    const row = { status: "pending", pendingSince: NOW - STALE_PENDING_MS - 1, createdAt: 0 };
    expect(isStalePending(row, NOW)).toBe(true);
  });

  it("keeps a pending row with a fresh heartbeat", () => {
    const row = { status: "pending", pendingSince: NOW - 60_000, createdAt: 0 };
    expect(isStalePending(row, NOW)).toBe(false);
  });

  it("keeps a pending row exactly at the cutoff (strict >)", () => {
    const row = { status: "pending", pendingSince: NOW - STALE_PENDING_MS, createdAt: 0 };
    expect(isStalePending(row, NOW)).toBe(false);
  });

  it("falls back to createdAt when no heartbeat was ever stamped", () => {
    const stale = { status: "pending", createdAt: NOW - STALE_PENDING_MS - 1 };
    const fresh = { status: "pending", createdAt: NOW - 60_000 };
    expect(isStalePending(stale, NOW)).toBe(true);
    expect(isStalePending(fresh, NOW)).toBe(false);
  });

  it("never flags non-pending rows, however old", () => {
    for (const status of ["review", "failed", "approved", "discarded", "flagged"]) {
      expect(isStalePending({ status, pendingSince: 0, createdAt: 0 }, NOW)).toBe(false);
    }
  });
});
