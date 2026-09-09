import { describe, it, expect } from "vitest";
import { THEOREMS, resolveTheorem, sameTheorem, canonicalNameOf, normalizeHebrew } from "./geometryTheorems";

/**
 * The reported bug: a student whose justification is right but not phrased
 * word-for-word like `expectedReason` was marked wrong. Left column is what
 * the question bank stores, right column is a student writing the same thing
 * their own way. Every one of these must resolve to the same theorem.
 */
const sameCases: Array<[string, string, string]> = [
  ["צ.ז.צ (SAS)", "צזצ", "abbreviation without dots"],
  ["צ.ז.צ (SAS)", "צ.ז.צ", "abbreviation with dots"],
  ["צ.ז.צ (SAS)", "צלע זווית צלע", "abbreviation written out"],
  ["צ.ז.צ (SAS)", "SAS", "the Latin abbreviation"],
  ["צ.ז.צ (SAS)", "לפי צלע-זווית-צלע", "written out with hyphens and a filler word"],
  ["אלכסוני מקבילית מחצים זה את זה", "האלכסונים במקבילית חוצים זה את זה", "definite article and a synonym"],
  ["אלכסוני מקבילית מחצים זה את זה", "כי במקבילית האלכסונים חוצים זה את זה", "student's own sentence"],
  ["זוויות קודקוד שוות", "זוויות קודקודיות", "adjectival form"],
  ["זוויות קודקוד שוות", "הזוויות הן קודקודיות ולכן שוות", "wrapped in reasoning"],
  ["סכום זוויות במשולש הוא 180°", "סכום הזוויות במשולש 180", "degree sign dropped"],
  ["משפט פיתגורס", "פיתגורס", "bare theorem name"],
  ["ז.צ.ז", "זווית צלע זווית", "ASA written out"],
  ["קטע אמצעים במשולש מקביל לצלע השלישית ושווה למחציתה", "משפט קטע האמצעים", "short reference to a long theorem"],
  ["משיק למעגל מאונך לרדיוס בנקודת ההשקה", "המשיק מאונך לרדיוס", "shortened"],
  ["זווית היקפית שווה למחצית הזווית המרכזית הנשענת על אותה קשת", "זווית היקפית", "shortened"],
];

/**
 * The opposite failure mode, and the reason this is an identity match rather
 * than a fuzzy score: a genuinely different theorem must still be wrong, even
 * when it shares most of its vocabulary.
 */
const differentCases: Array<[string, string, string]> = [
  ["צ.ז.צ (SAS)", "ז.צ.ז", "a different congruence theorem"],
  ["צ.ז.צ (SAS)", "צ.צ.צ", "a different congruence theorem"],
  ["אלכסוני מקבילית מחצים זה את זה", "אלכסוני מעוין מאונכים", "parallelogram vs rhombus diagonals"],
  ["אלכסוני מקבילית מחצים זה את זה", "אלכסוני מלבן שווים", "parallelogram vs rectangle diagonals"],
  ["זוויות קודקוד שוות", "זוויות מתחלפות שוות", "vertical vs alternate angles"],
  ["זוויות מתחלפות שוות", "זוויות מתאימות שוות", "alternate vs corresponding angles"],
  ["סכום זוויות במשולש הוא 180°", "סכום הזוויות במרובע", "triangle vs quadrilateral"],
  ["זווית היקפית שווה למחצית הזווית המרכזית", "זווית בין משיק למיתר", "two different circle theorems"],
  ["משפט פיתגורס", "משפט תאלס", "two different named theorems"],
  ["ישרים מקבילים בעלי שיפועים שווים", "מכפלת השיפועים", "parallel vs perpendicular slopes"],
];

describe("resolveTheorem — the same theorem in different words", () => {
  for (const [stored, written, label] of sameCases) {
    it(label + `: "${stored}" ≡ "${written}"`, () => {
      const a = resolveTheorem(stored);
      const b = resolveTheorem(written);
      expect(a, `stored resolved to ${a}`).not.toBeNull();
      expect(b, `student resolved to ${b}`).not.toBeNull();
      expect(b).toBe(a);
      expect(sameTheorem(stored, written)).toBe(true);
    });
  }
});

describe("resolveTheorem — different theorems stay different", () => {
  for (const [stored, written, label] of differentCases) {
    it(label + `: "${stored}" ≠ "${written}"`, () => {
      expect(sameTheorem(stored, written)).toBe(false);
    });
  }
});

describe("resolveTheorem — refusing to guess", () => {
  it("returns null for text that names no theorem", () => {
    expect(resolveTheorem("כי ככה")).toBeNull();
    expect(resolveTheorem("אני לא יודע")).toBeNull();
    expect(resolveTheorem("")).toBeNull();
    expect(resolveTheorem("   ")).toBeNull();
  });

  it("never calls two unrecognised reasons the same theorem", () => {
    // Both resolve to null; treating that as a match would pass any two
    // nonsense justifications as agreeing with each other.
    expect(sameTheorem("בלה בלה", "משהו אחר")).toBe(false);
  });

  it("does not match on stopwords alone", () => {
    expect(resolveTheorem("כי לפי של את זה")).toBeNull();
  });
});

describe("resolveTheorem — adversarial cases", () => {
  it("does not read an ordinary Hebrew word as a theorem abbreviation", () => {
    // "לזז" (to move) prefix-strips to "זז", the ז.ז similarity abbreviation.
    // A two-letter abbreviation is too small to survive prefix tolerance.
    expect(resolveTheorem("אי אפשר לזז את הנקודה כי אין מספיק מידע")).toBeNull();
  });

  it("stays silent when the text points at two different theorems equally", () => {
    // "מאונכים" and "צ.ז.צ" both match at one token. Picking either would be a
    // coin flip presented as a fact; leave it to the model.
    expect(resolveTheorem("לפי ההגדרה, מאונכים אלה לא שווים אבל בגלל צ.ז.צ המשולשים חופפים")).toBeNull();
  });

  it("does not match a theorem the student is explicitly ruling out", () => {
    expect(resolveTheorem("יש כאן זווית ואז צלע ואז זווית, זה לא צלע זווית צלע")).toBeNull();
  });

  it("still matches when a negation is elsewhere in the sentence", () => {
    expect(resolveTheorem("הזוויות לא שוות בגלל צלע זווית צלע")).toBe("sas");
  });
});

describe("canonicalNameOf", () => {
  it("gives a student the formal name for their informal phrasing", () => {
    expect(canonicalNameOf("כי במקבילית האלכסונים חוצים זה את זה"))
      .toBe("אלכסוני מקבילית חוצים זה את זה");
    expect(canonicalNameOf("צלע זווית צלע")).toBe("צ.ז.צ — שתי צלעות והזווית שביניהן");
  });
});

describe("normalizeHebrew", () => {
  it("strips niqqud, geresh and punctuation", () => {
    expect(normalizeHebrew("צ׳.ז״.צ!")).toBe("צזצ");
    expect(normalizeHebrew("מָקבִּילִית")).toBe("מקבילית");
  });

  it("folds final letters so word endings do not split a match", () => {
    expect(normalizeHebrew("מחצים")).toBe(normalizeHebrew("מחצימ"));
  });
});

describe("the bank itself", () => {
  it("has unique ids", () => {
    const ids = THEOREMS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every theorem's own canonical name back to itself", () => {
    for (const t of THEOREMS) {
      expect(resolveTheorem(t.canonicalHe), `${t.id} did not resolve to itself`).toBe(t.id);
    }
  });

  it("resolves every alias to its own theorem", () => {
    for (const t of THEOREMS) {
      for (const alias of t.aliases) {
        expect(resolveTheorem(alias), `alias "${alias}" of ${t.id} resolved elsewhere`).toBe(t.id);
      }
    }
  });
});
