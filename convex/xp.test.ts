import { describe, it, expect } from "vitest";
import { boostedXp, XP_BOOST_MULTIPLIER } from "./xp";

const NOW = 1_800_000_000_000;

describe("boostedXp", () => {
  it("doubles earned XP while a boost is running", () => {
    expect(boostedXp(30, NOW + 60_000, NOW)).toBe(30 * XP_BOOST_MULTIPLIER);
  });

  it("leaves XP alone with no boost, or once it has expired", () => {
    expect(boostedXp(30, undefined, NOW)).toBe(30);
    expect(boostedXp(30, NOW, NOW)).toBe(30);       // exactly expired
    expect(boostedXp(30, NOW - 1, NOW)).toBe(30);
  });

  it("never multiplies a spend — purchases must not be discounted", () => {
    expect(boostedXp(-200, NOW + 60_000, NOW)).toBe(-200);
    expect(boostedXp(0, NOW + 60_000, NOW)).toBe(0);
  });
});
