import { describe, it, expect } from "vitest";
import { validateGenerated, stemKey } from "./questionGen";

const good = {
  stem: "בסדרה חשבונית נתון $a_1 = 5$, $d = 2$. חשב את $a_{10}$.",
  choices: ["23", "25", "21", "20"],
  correctIndex: 0,
  solutionSteps: ["$a_n = a_1 + (n-1)d$", "$a_{10} = 5 + 9 \\cdot 2 = 23$"],
  hint: "השתמש בנוסחת האיבר הכללי.",
  explanation: "$5 + 18 = 23$.",
};

describe("validateGenerated", () => {
  it("accepts a well-formed question", () => {
    const { accepted, rejected } = validateGenerated([good], []);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("drops structurally broken questions instead of inserting them", () => {
    const bad = [
      { ...good, stem: "קצר" },                               // stem too short
      { ...good, choices: ["1", "2", "3"] },                   // not 4 choices
      { ...good, choices: ["1", "1", "2", "3"] },              // duplicate choices
      { ...good, choices: ["1", "", "2", "3"] },               // empty choice
      { ...good, correctIndex: 4 },                            // out of range
      { ...good, correctIndex: -1 },                           // out of range
      { ...good, solutionSteps: [] },                          // no solution
      { ...good, hint: "" },                                   // no hint
      { ...good, explanation: "" },                            // no explanation
    ];
    const { accepted, rejected } = validateGenerated(bad, []);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(bad.length);
  });


  // The bank is Hebrew-only, and Gemini slips into the Arabic cognate of a
  // Hebrew letter mid-word (see hebrewGuard.ts). One dev row reached the bank
  // with `סכום الזוויות הנגדיות` in its hint before this gate existed.
  it("drops a question with Arabic script in any field", () => {
    const cases = [
      { ...good, stem: `${good.stem} מيسي` },
      { ...good, hint: "סכום الזוויות הנגדיות" },
      { ...good, choices: ["23", "25", "21", "מيسي"] },
      { ...good, solutionSteps: [...good.solutionSteps, "מيسي"] },
      { ...good, explanation: "מيسي" },
    ];
    const { accepted, rejected } = validateGenerated(cases, []);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(cases.length);
    expect(rejected[1]).toContain("hint");
    expect(rejected[2]).toContain("choices[3]");
  });

  it("keeps Latin letters and digits, which are not a script slip", () => {
    const withLatin = { ...good, stem: `${good.stem} (LeBron, 2024)` };
    expect(validateGenerated([withLatin], []).accepted).toHaveLength(1);
  });

  it("rejects a question already in the bank, ignoring whitespace", () => {
    const { accepted } = validateGenerated([good], [`  ${good.stem.replace(" ", "   ")}  `]);
    expect(accepted).toHaveLength(0);
  });

  it("dedups within a single batch", () => {
    const { accepted } = validateGenerated([good, { ...good }], []);
    expect(accepted).toHaveLength(1);
  });

  it("survives a non-array response", () => {
    expect(validateGenerated({ oops: true }, []).accepted).toHaveLength(0);
    expect(validateGenerated(null, []).accepted).toHaveLength(0);
  });

  it("normalizes stems the same way both sides of the dedup", () => {
    expect(stemKey(" a\n b ")).toBe("a b");
  });
});
