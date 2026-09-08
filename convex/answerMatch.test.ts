import { describe, it, expect } from "vitest";
import { matchAnswer, canonicalize, compile } from "./answerMatch";

/**
 * Golden set. Left column is the stored `correctAnswer` exactly as the seeds
 * and the packet importer write it (plain Unicode); right column is what the
 * student's keystrokes actually reach us as (MathField emits LaTeX, a student
 * typing around the editor emits ASCII or Hebrew).
 *
 * Every "must accept" row here was REJECTED by at least one of the two
 * checkers this module replaces, and several "must reject" rows were ACCEPTED
 * by the old `answerLower.length > 5` fallback.
 */

const accept: Array<[string, string, string]> = [
  // ── roots: the reported complaint ──
  ["√2", "\\sqrt{2}", "root as LaTeX"],
  ["√2", "√2", "root as unicode"],
  ["√2", "sqrt(2)", "root as ascii"],
  ["√2", "sqrt2", "root without parens"],
  ["√2", "2^{0.5}", "root as a power"],
  ["√2", "2^\\frac{1}{2}", "root as a fractional power"],
  ["√2", "שורש 2", "root written in Hebrew"],
  ["2√2", "\\sqrt{8}", "unsimplified root"],
  ["√8", "2\\sqrt{2}", "simplified root"],
  ["3√5", "\\sqrt{45}", "coefficient pulled under the radical"],
  ["\\sqrt[3]{8}", "2", "cube root evaluated"],
  ["√2/2", "\\frac{1}{\\sqrt{2}}", "rationalised vs not"],

  // ── fractions and decimals ──
  ["4/7", "\\frac{4}{7}", "fraction as LaTeX"],
  ["0.5", "\\frac{1}{2}", "decimal vs fraction"],
  ["1/2", "0.5", "fraction vs decimal"],
  ["0.07", "7/100", "decimal vs fraction"],
  ["\\frac{1}{\\frac{1}{2}}", "2", "nested fraction"],

  // ── algebra: same function, different form ──
  ["(x+1)^2", "x^2+2x+1", "expanded binomial"],
  ["x^2-1", "(x-1)(x+1)", "factored difference of squares"],
  ["2x", "x+x", "trivially equal expressions"],
  ["1/x", "x^{-1}", "negative exponent"],

  // ── relations ──
  ["x = 2", "2", "value given without naming the variable"],
  ["2", "x = 2", "variable named when it need not be"],
  ["x = 2", "2 = x", "equation written backwards"],
  ["x = 2", "x - 2 = 0", "equation rearranged"],
  ["x ≠ 2", "x \\neq 2", "not-equal as LaTeX"],
  ["x ≠ 2", "x != 2", "not-equal as ascii"],

  // ── sets, tuples, constants ──
  ["x = π/4, x = 5π/4", "x=\\frac{\\pi}{4},x=\\frac{5\\pi}{4}", "solution set as LaTeX"],
  ["x = π/4, x = 5π/4", "x=\\frac{5\\pi}{4},x=\\frac{\\pi}{4}", "solution set, order swapped"],
  ["(4, 8)", "(4,8)", "coordinates with spacing"],
  ["(0, 0)", "\\left(0,0\\right)", "coordinates with LaTeX delimiters"],
  ["π", "\\pi", "pi"],
  ["2π", "6.283185307", "pi evaluated"],

  // ── notation an adversarial pass found rejected ──
  ["{2,5}", "{5,2}", "a set is unordered"],
  ["90°", "90", "degree sign against a bare number"],
  ["|x|", "abs(x)", "bars against the function form"],
  ["|x-3|", "\\left|x-3\\right|", "bars against the LaTeX the symbol strip inserts"],
  ["2<x<5", "x>2,x<5", "a chained range split into two constraints"],
  ["2<x<5", "5>x>2", "a chained range written the other way round"],
  ["x>2", "2<x", "an inequality written the other way round"],
  ["x = ±2", "x=2,x=-2", "both branches of a ± answer"],

  // ── plain numbers still work ──
  ["670", "670", "integer"],
  ["30", "30.0", "trailing zero"],
  ["-5", "−5", "unicode minus sign"],
  ["7.2", " 7.2 ", "surrounding whitespace"],
];

const reject: Array<[string, string, string]> = [
  // Each of these was accepted by the old homework checker.
  ["670", "\\sqrt{9999}", "wrong answer that is over 5 characters"],
  ["670", "asdfghjkl", "gibberish over 5 characters"],
  ["670", "x^2+2x+1", "a valid expression that is not the answer"],
  ["30", "3", "wrong answer that is a substring of the right one"],
  ["12", "2", "wrong answer that is a substring of the right one"],
  ["4/7", "7/4", "inverted fraction"],
  ["√2", "\\sqrt{3}", "wrong root"],
  ["√2", "2", "the radicand instead of the root"],
  ["(x+1)^2", "x^2+1", "the classic freshman expansion error"],
  ["x = 2", "x = 3", "wrong root of an equation"],
  ["x > 2", "x < 2", "inequality flipped"],
  ["x = π/4, x = 5π/4", "x=\\frac{\\pi}{4}", "only half the solution set"],
  ["x = π/4, x = 5π/4", "x=\\frac{\\pi}{4},x=\\frac{3\\pi}{4}", "one wrong member of the set"],
  ["(4, 8)", "(8,4)", "coordinates transposed"],
  ["670", "", "empty answer"],
  ["670", "   ", "whitespace-only answer"],

  // ── false accepts an adversarial pass found ──
  ["abs(x)", "x", "dropping the absolute value — differs for negative x"],
  ["sqrt(x^2)", "x", "dropping the absolute value — differs for negative x"],
  ["x = ±2", "x = 2", "only the + branch of a ± answer"],
  ["x = ±2", "x = -2", "only the − branch of a ± answer"],
  ["1000", "1004", "a wrong integer inside the old flat rounding tolerance"],
  ["17", "17.08", "a wrong value inside the old flat rounding tolerance"],
  ["100", "100.4", "a wrong value inside the old flat rounding tolerance"],
  ["x=100,x=100.4", "x=100.2,x=100.2", "one duplicated near-value covering two distinct roots"],
];

describe("matchAnswer — answers that must be accepted", () => {
  for (const [correct, student, label] of accept) {
    it(label + `: ${correct} ← ${student}`, () => {
      const r = matchAnswer(correct, student, "expression");
      expect(r.correct, `verdict=${r.verdict} readAs=${r.readAs}`).toBe(true);
    });
  }
});

describe("matchAnswer — answers that must be rejected", () => {
  for (const [correct, student, label] of reject) {
    it(label + `: ${correct} ← ${student}`, () => {
      const r = matchAnswer(correct, student, "expression");
      expect(r.correct, `verdict=${r.verdict} readAs=${r.readAs}`).toBe(false);
    });
  }
});

describe("matchAnswer — verdicts", () => {
  it("reports an identical answer as exact", () => {
    expect(matchAnswer("670", "670").verdict).toBe("exact");
  });

  it("reports a differently-written answer as equivalent", () => {
    expect(matchAnswer("√8", "2\\sqrt{2}").verdict).toBe("equivalent");
  });

  it("accepts a rounded decimal but says so", () => {
    const r = matchAnswer("√2", "1.414");
    expect(r.correct).toBe(true);
    expect(r.verdict).toBe("rounded");
    expect(r.note).toMatch(/מעוגלת/);
  });

  it("does not accept a decimal that is merely nearby", () => {
    expect(matchAnswer("√2", "1.5").correct).toBe(false);
  });

  it("echoes what it read the answer as", () => {
    expect(matchAnswer("√2", "\\sqrt{2}").readAs).toBe("sqrt(2)");
  });

  it("accepts a decimal rounded to the precision the student actually wrote", () => {
    // 1.414 is √2 to three places; 1.41 is √2 to two. Both are honest roundings.
    expect(matchAnswer("√2", "1.414").verdict).toBe("rounded");
    expect(matchAnswer("√2", "1.41").verdict).toBe("rounded");
  });

  it("does not treat a wrong number as a rounding just because it is close", () => {
    // The tolerance comes from the student's own written precision, so "1004"
    // claims integer precision and is 4 out — not a rounding of 1000.
    expect(matchAnswer("1000", "1004").verdict).toBe("wrong");
    expect(matchAnswer("17", "17.08").verdict).toBe("wrong");
  });

  it("marks an unparseable stored answer as unparsed, not wrong", () => {
    // "ראה הוכחה מלאה" is a real stored correctAnswer on proof sections.
    expect(matchAnswer("ראה הוכחה מלאה", "5").verdict).toBe("unparsed");
  });
});

describe("canonicalize", () => {
  it("keeps a bare root over one atom only", () => {
    // Without this √2·x would be read as √(2x).
    expect(canonicalize("\\sqrt{2}x")).toBe("sqrt(2)x");
    expect(canonicalize("√2x")).toBe("sqrt(2)x");
  });

  it("expands nested fractions", () => {
    expect(canonicalize("\\frac{\\frac{1}{2}}{3}")).toBe("((((1)/(2)))/(3))");
  });

  it("survives malformed LaTeX without hanging", () => {
    expect(() => canonicalize("\\frac{1}")).not.toThrow();
    expect(() => canonicalize("\\sqrt{")).not.toThrow();
    expect(() => canonicalize("{{{{{")).not.toThrow();
  });
});

describe("hostile input", () => {
  it("refuses an absurdly long answer instead of parsing it", () => {
    const deep = "(".repeat(2000) + "1" + ")".repeat(2000);
    expect(() => matchAnswer("1", deep)).not.toThrow();
    expect(matchAnswer("1", deep).verdict).toBe("unparsed");
  });

  it("does not blow the stack on a long operator chain", () => {
    const chain = "1+".repeat(20000) + "1";
    expect(() => matchAnswer("20001", chain)).not.toThrow();
  });

  it("refuses nesting deeper than any real answer", () => {
    // Under the length cap, so this exercises the parser's own depth guard.
    expect(() => compile("(".repeat(200) + "1" + ")".repeat(200))).not.toThrow();
    expect(compile("(".repeat(200) + "1" + ")".repeat(200))).toBeNull();
  });
});

describe("compile", () => {
  it("refuses input it cannot fully parse", () => {
    expect(compile("2+")).toBeNull();
    expect(compile("((2)")).toBeNull();
    expect(compile("hello world!")).toBeNull();
  });

  it("treats adjacent letters as a product, not one variable", () => {
    const f = compile("xy");
    expect(f?.vars.sort()).toEqual(["x", "y"]);
    expect(f?.eval({ x: 3, y: 4 })).toBe(12);
  });

  it("never splits a function name into variables", () => {
    expect(compile("sqrt(4)")?.vars).toEqual([]);
    expect(compile("sqrt(4)")?.eval({})).toBe(2);
  });

  it("parses right-associative and signed exponents", () => {
    expect(compile("2^3^2")?.eval({})).toBe(512);
    expect(compile("2^-1")?.eval({})).toBe(0.5);
  });
});
