import { describe, it, expect } from "vitest";
import { isLinkActive } from "./parentReports";

// This gate decides who can read a child's weekly report. Every parent-link
// path routes through it, so the branches are worth pinning down.
describe("isLinkActive", () => {
  const NOW = 1_800_000_000_000;

  it("accepts a link that is neither revoked nor expired", () => {
    expect(isLinkActive({ expiresAt: NOW + 1000 }, NOW)).toBe(true);
  });

  it("rejects a revoked link even while it is still within its TTL", () => {
    expect(isLinkActive({ expiresAt: NOW + 1000, revokedAt: NOW - 1 }, NOW)).toBe(false);
  });

  it("rejects an expired link", () => {
    expect(isLinkActive({ expiresAt: NOW - 1 }, NOW)).toBe(false);
  });

  it("treats the expiry instant as expired", () => {
    expect(isLinkActive({ expiresAt: NOW }, NOW)).toBe(false);
  });

  it("keeps pre-expiry rows (no expiresAt) active", () => {
    expect(isLinkActive({}, NOW)).toBe(true);
  });
});
