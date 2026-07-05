import { describe, it, expect } from "vitest";
import {
  stripFences,
  salvageJsonArray,
  normalizeLabel,
  dedupeByLabel,
  indexBySourceLabel,
  pickBatch,
  matchTopic,
  normalizeSimple,
  normalizeCompound,
  normalizeDraft,
} from "./packetParse";

describe("stripFences", () => {
  it("returns plain JSON unchanged", () => {
    expect(stripFences('[{"a":1}]')).toBe('[{"a":1}]');
  });
  it("strips a ```json fence", () => {
    expect(stripFences('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });
  it("strips a bare ``` fence", () => {
    expect(stripFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe("salvageJsonArray", () => {
  it("parses a clean array", () => {
    expect(salvageJsonArray('[{"x":1},{"x":2}]')).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it("parses a fenced array", () => {
    expect(salvageJsonArray('```json\n[{"x":1}]\n```')).toEqual([{ x: 1 }]);
  });

  it("wraps a single top-level object into an array", () => {
    expect(salvageJsonArray('{"x":1}')).toEqual([{ x: 1 }]);
  });

  it("salvages complete elements from an array truncated mid-object", () => {
    // Second element is cut off before it closes.
    const raw = '[{"sourceLabel":"1","stem":"a"},{"sourceLabel":"2","stem":"b';
    expect(salvageJsonArray(raw)).toEqual([{ sourceLabel: "1", stem: "a" }]);
  });

  it("salvages elements when truncated mid-string of a later element", () => {
    const raw = '[{"a":"x"},{"a":"an unterminated string with a , comma and { brace';
    expect(salvageJsonArray(raw)).toEqual([{ a: "x" }]);
  });

  it("does not confuse braces/commas inside strings", () => {
    const raw = '[{"a":"has } and , inside"},{"a":"second"}]';
    expect(salvageJsonArray(raw)).toEqual([{ a: "has } and , inside" }, { a: "second" }]);
  });

  it("returns [] for total garbage", () => {
    expect(salvageJsonArray("not json at all")).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(salvageJsonArray("   ")).toEqual([]);
  });
});

describe("normalizeLabel", () => {
  it("collapses common formatting variants of the same label", () => {
    const key = normalizeLabel("5");
    expect(normalizeLabel("שאלה 5")).toBe(key);
    expect(normalizeLabel("5.")).toBe(key);
    expect(normalizeLabel("5)")).toBe(key);
    expect(normalizeLabel(" 5 ")).toBe(key);
    expect(normalizeLabel("שאלה מס' 5")).toBe(key);
  });

  it("strips a Latin 'question'/'q'/'no' prefix", () => {
    expect(normalizeLabel("Question 4")).toBe("4");
    expect(normalizeLabel("q4")).toBe("4");
    expect(normalizeLabel("No. 7")).toBe("7");
  });

  it("keeps a trailing sub-letter distinct", () => {
    expect(normalizeLabel("12ב")).toBe("12ב");
    expect(normalizeLabel("12ב")).not.toBe(normalizeLabel("12"));
  });

  it("ignores niqqud", () => {
    expect(normalizeLabel("שְׁאֵלָה 3")).toBe(normalizeLabel("שאלה 3"));
  });
});

describe("dedupeByLabel", () => {
  it("collapses duplicate normalized labels, last write wins", () => {
    const items = [
      { sourceLabel: "שאלה 1", v: "first" },
      { sourceLabel: "2", v: "keep" },
      { sourceLabel: "1.", v: "second" }, // same normalized key as "שאלה 1"
    ];
    const out = dedupeByLabel(items);
    expect(out).toHaveLength(2);
    expect(out.find((o) => normalizeLabel(o.sourceLabel) === normalizeLabel("1"))?.v).toBe("second");
  });
});

describe("indexBySourceLabel", () => {
  it("maps normalized labels to items, last write wins", () => {
    const m = indexBySourceLabel([
      { sourceLabel: "שאלה 3", v: "a" },
      { sourceLabel: "3.", v: "b" },
      { sourceLabel: "4", v: "c" },
    ]);
    expect(m.size).toBe(2);
    expect(m.get(normalizeLabel("3"))?.v).toBe("b");
    expect(m.get(normalizeLabel("4"))?.v).toBe("c");
  });
});

describe("pickBatch", () => {
  const simple = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ sourceLabelRaw: `s${i}`, kind: "simple" }));

  it("takes up to 4 simple questions", () => {
    expect(pickBatch(simple(10))).toEqual(["s0", "s1", "s2", "s3"]);
  });

  it("stops at 2 heavy (compound/proof) questions", () => {
    const rows = [
      { sourceLabelRaw: "a", kind: "compound" },
      { sourceLabelRaw: "b", kind: "proof" },
      { sourceLabelRaw: "c", kind: "simple" },
    ];
    expect(pickBatch(rows)).toEqual(["a", "b"]);
  });

  it("returns all rows when neither limit is reached", () => {
    const rows = [
      { sourceLabelRaw: "a", kind: "simple" },
      { sourceLabelRaw: "b", kind: "compound" },
      { sourceLabelRaw: "c", kind: "simple" },
    ];
    expect(pickBatch(rows)).toEqual(["a", "b", "c"]);
  });

  it("returns [] for no rows", () => {
    expect(pickBatch([])).toEqual([]);
  });
});

describe("matchTopic", () => {
  const topics = [{ nameHe: "גיאומטריה" }, { nameHe: "הסתברות" }, { nameHe: "טריגונומטריה" }];

  it("matches an exact nameHe", () => {
    expect(matchTopic("הסתברות", topics)?.nameHe).toBe("הסתברות");
  });
  it("matches despite niqqud / surrounding whitespace", () => {
    expect(matchTopic("  הַסְתַּבְּרוּת  ", topics)?.nameHe).toBe("הסתברות");
  });
  it("matches on containment", () => {
    expect(matchTopic("טריגו", topics)?.nameHe).toBe("טריגונומטריה");
  });
  it("returns undefined when nothing matches", () => {
    expect(matchTopic("אלגברה", topics)).toBeUndefined();
  });
  it("returns undefined for an empty guess", () => {
    expect(matchTopic("", topics)).toBeUndefined();
  });
});

describe("normalizeSimple", () => {
  it("clamps correctIndex within the choices range and defaults difficulty to 3", () => {
    const d = normalizeSimple({
      format: "multiple_choice",
      stem: "כמה זה $2+2$?",
      choices: ["3", "4", "5", "6"],
      correctIndex: 9,
      difficulty: "not-a-number",
    });
    expect(d.difficulty).toBe(3);
    expect(d.correctIndex).toBe(3);
    expect(d.correctAnswer).toBeUndefined();
  });

  it("empties choices for fill_blank and keeps correctAnswer", () => {
    const d = normalizeSimple({
      format: "fill_blank",
      stem: "x?",
      choices: ["junk"],
      correctAnswer: "7",
    });
    expect(d.choices).toEqual([]);
    expect(d.correctAnswer).toBe("7");
    expect(d.correctIndex).toBeUndefined();
  });

  it("accepts a legacy singular `hint` field and yields exactly two hints", () => {
    const d = normalizeSimple({ format: "fill_blank", stem: "x", hint: "רמז יחיד" });
    expect(d.hints).toHaveLength(2);
    expect(d.hints[0]).toBe("רמז יחיד");
  });

  it("truncates more than two hints down to two", () => {
    const d = normalizeSimple({ format: "fill_blank", stem: "x", hints: ["a", "b", "c"] });
    expect(d.hints).toEqual(["a", "b"]);
  });
});

describe("normalizeCompound", () => {
  it("defaults missing points to an even split and skillsTested to []", () => {
    const d = normalizeCompound({
      difficulty: 3,
      sections: [
        { label: "א", prompt: "p1", answerType: "numeric", correctAnswer: "1" },
        { label: "ב", prompt: "p2", answerType: "numeric", correctAnswer: "2" },
      ],
    });
    expect(d.sections[0].points).toBe(50);
    expect(d.sections[1].points).toBe(50);
    expect(d.sections[0].skillsTested).toEqual([]);
    expect(d.sections[0].hints).toHaveLength(2);
  });

  it("coerces an unknown answerType to expression", () => {
    const d = normalizeCompound({
      sections: [{ label: "א", prompt: "p", answerType: "multiple_choice", correctAnswer: "x" }],
    });
    expect(d.sections[0].answerType).toBe("expression");
  });

  it("forces answerType to proof when proofSteps are present and fills the placeholder answer", () => {
    const d = normalizeCompound({
      sections: [
        {
          label: "א",
          prompt: "הוכח כי המשולשים חופפים",
          answerType: "expression", // wrong on purpose
          correctAnswer: "",
          proofMeta: { given: "ABCD מקבילית", toProve: "AOB ≅ COD" },
          proofSteps: [
            { stepIndex: 0, expectedClaim: "AO = OC", expectedReason: "אלכסוני מקבילית מחצים זה את זה" },
          ],
        },
      ],
    });
    const s = d.sections[0];
    expect(s.answerType).toBe("proof");
    expect(s.correctAnswer).toBe("ראה הוכחה מלאה");
    expect(s.proofMeta).toEqual({ given: "ABCD מקבילית", toProve: "AOB ≅ COD" });
    expect(s.proofSteps).toHaveLength(1);
    expect(s.proofSteps?.[0].stepIndex).toBe(0);
  });

  it("keeps a model-provided proof correctAnswer instead of the placeholder", () => {
    const d = normalizeCompound({
      sections: [
        {
          label: "א",
          prompt: "הוכח",
          correctAnswer: "המשולשים חופפים",
          proofMeta: { given: "g", toProve: "t" },
          proofSteps: [{ stepIndex: 0, expectedClaim: "c", expectedReason: "r" }],
        },
      ],
    });
    expect(d.sections[0].correctAnswer).toBe("המשולשים חופפים");
  });

  it("labels sections by index when the model omits the label", () => {
    const d = normalizeCompound({
      sections: [
        { prompt: "p1", answerType: "numeric", correctAnswer: "1" },
        { prompt: "p2", answerType: "numeric", correctAnswer: "2" },
      ],
    });
    expect(d.sections[0].label).toBe("א");
    expect(d.sections[1].label).toBe("ב");
  });
});

describe("normalizeDraft dispatch", () => {
  it("routes an explicit simple kind", () => {
    expect(normalizeDraft({ kind: "simple", format: "fill_blank", stem: "x" }).kind).toBe("simple");
  });
  it("routes an explicit compound kind", () => {
    expect(normalizeDraft({ kind: "compound", sections: [] }).kind).toBe("compound");
  });
  it("infers compound from a sections array when kind is missing", () => {
    expect(normalizeDraft({ sections: [{ prompt: "p" }] }).kind).toBe("compound");
  });
  it("infers simple when there is no sections array", () => {
    expect(normalizeDraft({ format: "multiple_choice", stem: "x" }).kind).toBe("simple");
  });
});
