import { describe, expect, it } from "vitest";
import { arabicSample, findArabicField, hasArabicScript } from "./hebrewGuard";

// Real corruptions pulled out of the dev snapshot. Each one is Hebrew with a
// letter swapped for its Arabic cognate, mid-word.
const MESSI = "מيسي";       // מסי
const CHANDLER = "צ'נדلر"; // צ'נדלר
const STEVE = "סتيב";       // סטיב
const ARTICLE = "סכום الזוויות";   // סכום הזוויות, with the Arabic article
const HIDDEN_MARK = "אלכסَ"; // renders as pure Hebrew, carries a fatha
const WITH_BOM = "שאלה﻿";

describe("hasArabicScript", () => {
  it.each([
    ["a slipped letter mid-word", MESSI],
    ["a slipped suffix", CHANDLER],
    ["a slipped letter between Hebrew ones", STEVE],
    ["the Arabic definite article", ARTICLE],
    ["a combining mark that renders invisibly", HIDDEN_MARK],
  ])("catches %s", (_name, text) => {
    expect(hasArabicScript(text)).toBe(true);
  });

  it.each([
    ["plain Hebrew", "מרובע חסום במעגל"],
    ["Hebrew with LaTeX", String.raw`זווית $\angle A = 2x + 10^\circ$`],
    ["Hebrew with Latin and digits", "לברון LeBron 23"],
    ["an empty string", ""],
  ])("leaves %s alone", (_name, text) => {
    expect(hasArabicScript(text)).toBe(false);
  });

  // U+FEFF sits at the tail of the Arabic Presentation Forms-B block but is
  // the byte-order mark, and it turns up in perfectly good text.
  it("does not fire on a byte-order mark", () => {
    expect(hasArabicScript(WITH_BOM)).toBe(false);
  });
});

describe("arabicSample", () => {
  it("returns the offending word so the log says what was dropped", () => {
    expect(arabicSample("במגרש " + MESSI + " בעט")).toBe(MESSI);
  });

  it("returns an empty string for clean text", () => {
    expect(arabicSample("הכל בסדר")).toBe("");
  });
});

describe("findArabicField", () => {
  it("names a plain string field", () => {
    expect(findArabicField({ stem: "תקין", hint: ARTICLE })).toBe("hint");
  });

  it("names the index inside an array field", () => {
    expect(findArabicField({ choices: ["א", "ב", STEVE, "ד"] })).toBe("choices[2]");
  });

  it("returns null when every field is clean", () => {
    expect(findArabicField({ stem: "תקין", choices: ["א", "ב"] })).toBeNull();
  });
});
