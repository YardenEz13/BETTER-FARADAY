import { describe, it, expect } from "vitest";
import {
  dayCount, hourCount, minuteCount, weekCount,
  freezeCount, questionCount, sectionCount, studentCount, topicCount,
} from "./hebrew";

// The whole point of these helpers is the dual form. n=1 and n=2 are the cases
// the naive `${n} ימים` gets wrong, so pin them everywhere.
describe("counted nouns", () => {
  it("uses singular, dual and plural for days", () => {
    expect(dayCount(1)).toBe("יום");
    expect(dayCount(2)).toBe("יומיים");
    expect(dayCount(3)).toBe("3 ימים");
  });

  it("uses singular, dual and plural for hours, minutes and weeks", () => {
    expect(hourCount(1)).toBe("שעה");
    expect(hourCount(2)).toBe("שעתיים");
    expect(hourCount(5)).toBe("5 שעות");
    expect(minuteCount(1)).toBe("דקה");
    expect(minuteCount(2)).toBe("שתי דקות");
    expect(minuteCount(45)).toBe("45 דקות");
    expect(weekCount(1)).toBe("שבוע");
    expect(weekCount(2)).toBe("שבועיים");
    expect(weekCount(4)).toBe("4 שבועות");
  });

  it("counts streak freezes", () => {
    expect(freezeCount(1)).toBe("הקפאה אחת");
    expect(freezeCount(2)).toBe("שתי הקפאות");
    expect(freezeCount(3)).toBe("3 הקפאות");
  });

  it("agrees in gender for the app's nouns", () => {
    expect(questionCount(1)).toBe("שאלה אחת");   // feminine
    expect(questionCount(2)).toBe("שתי שאלות");
    expect(sectionCount(1)).toBe("סעיף אחד");     // masculine
    expect(sectionCount(2)).toBe("שני סעיפים");
    expect(studentCount(2)).toBe("שני תלמידים");
    expect(topicCount(2)).toBe("שני נושאים");
    expect(topicCount(7)).toBe("7 נושאים");
  });

  it("never emits a bare numeral for the singular or dual", () => {
    const all = [dayCount, hourCount, minuteCount, weekCount, freezeCount,
                 questionCount, sectionCount, studentCount, topicCount];
    for (const f of all) {
      expect(f(1)).not.toMatch(/^1/);
      expect(f(2)).not.toMatch(/^2/);
    }
  });
});
