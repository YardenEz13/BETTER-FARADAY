import { describe, it, expect } from "vitest";
import { computeAchievements } from "./achievements";

const ZERO = { xp: 0, streak: 0, attempts: 0, correct: 0, topicsCompleted: 0 };

describe("computeAchievements", () => {
  it("earns nothing for a brand-new student and points at the cheapest next goal", () => {
    const { earnedCount, next } = computeAchievements(ZERO);
    expect(earnedCount).toBe(0);
    expect(next?.key).toBe("first_spark"); // goal 1 → highest pct among unearned
  });

  it("earns a tier the moment its threshold is reached, not before", () => {
    const at24 = computeAchievements({ ...ZERO, attempts: 24 });
    const at25 = computeAchievements({ ...ZERO, attempts: 25 });
    expect(at24.list.find((a) => a.key === "warmed_up")?.earned).toBe(false);
    expect(at25.list.find((a) => a.key === "warmed_up")?.earned).toBe(true);
    expect(at25.earnedCount).toBe(at24.earnedCount + 1);
  });

  it("caps progress at 100% and sorts earned achievements first", () => {
    const { list, earnedCount, next } = computeAchievements({
      xp: 99_999, streak: 99, attempts: 9_999, correct: 9_999, topicsCompleted: 99,
    });
    expect(earnedCount).toBe(list.length);
    expect(next).toBeNull();
    expect(list.every((a) => a.pct === 100 && a.earned)).toBe(true);
  });
});
