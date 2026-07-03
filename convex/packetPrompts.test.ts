import { describe, it, expect } from "vitest";
import { buildTopicList, inventoryPrompt, solvePrompt, verifyPrompt } from "./packetPrompts";

const TOPICS = [{ nameHe: "גיאומטריה" }, { nameHe: "הסתברות" }, { nameHe: "טריגונומטריה" }];

describe("buildTopicList", () => {
  it("renders one verbatim topic per line, bulleted", () => {
    expect(buildTopicList(TOPICS)).toBe("- גיאומטריה\n- הסתברות\n- טריגונומטריה");
  });
  it("is empty for no topics", () => {
    expect(buildTopicList([])).toBe("");
  });
});

describe("inventoryPrompt", () => {
  const p = inventoryPrompt(buildTopicList(TOPICS));

  it("injects the topic list verbatim", () => {
    expect(p).toContain("- גיאומטריה");
    expect(p).toContain("- הסתברות");
  });
  it("forbids solving and requires JSON-only output", () => {
    expect(p).toContain("Do NOT solve anything");
    expect(p).toContain("ONLY a valid JSON array");
  });
  it("defines all three kinds incl. proof detection", () => {
    expect(p).toContain('"simple" | "compound" | "proof"');
    expect(p).toContain("הוכח");
  });
  it("insists on covering every page and one entry per question", () => {
    expect(p).toContain("EVERY page");
    expect(p).toContain("EXACTLY ONE entry");
  });
});

describe("solvePrompt", () => {
  const labels = ["שאלה 3", "שאלה 4"];
  const p = solvePrompt(buildTopicList(TOPICS), labels, labels.length);

  it("scopes to exactly the requested labels and count", () => {
    expect(p).toContain('1. "שאלה 3"');
    expect(p).toContain('2. "שאלה 4"');
    expect(p).toContain("EXACTLY 2 entries");
  });

  it("requires the schema-critical fields the model tends to drop", () => {
    expect(p).toContain('"points"');
    expect(p).toContain('"skillsTested"');
    expect(p).toContain("EXACTLY 2 progressive hints");
    expect(p).toContain("sum to ~100");
  });

  it("includes the geometry proof rule with proofMeta + proofSteps", () => {
    expect(p).toContain("GEOMETRY PROOF RULE");
    expect(p).toContain('"answerType": "proof"');
    expect(p).toContain('"proofMeta"');
    expect(p).toContain('"proofSteps"');
    expect(p).toContain('"given"');
    expect(p).toContain('"toProve"');
    expect(p).toContain('"expectedClaim"');
    expect(p).toContain('"expectedReason"');
    expect(p).toContain("צ.ז.צ"); // standard Hebrew theorem-name example
  });

  it("supports mixed section types within one compound", () => {
    expect(p).toContain("PER SECTION");
  });

  it("enforces KaTeX safety (no \\text{Hebrew}) and preserves [FIGURE:] markers", () => {
    expect(p).toContain("NEVER wrap Hebrew in \\text{...}");
    expect(p).toContain("[FIGURE: ...]");
  });

  it("bans MC options inside compound sections", () => {
    expect(p).toContain("Do NOT output multiple-choice options inside a compound section");
  });

  it("reflects the label count in the scoping header", () => {
    const one = solvePrompt("", ["12"], 1);
    expect(one).toContain('1. "12"');
    expect(one).toContain("EXACTLY 1 entries");
    expect(one).not.toContain('2. "');
  });
});

describe("verifyPrompt", () => {
  const p = verifyPrompt("כמה זה $2+2$?", "numeric", "4");

  it("embeds the stem, answerType, and candidate answer", () => {
    expect(p).toContain("כמה זה $2+2$?");
    expect(p).toContain('answerType "numeric"');
    expect(p).toContain("Candidate answer: 4");
  });
  it("asks for the agrees/correctedAnswer/note verdict, JSON only", () => {
    expect(p).toContain('"agrees"');
    expect(p).toContain('"correctedAnswer"');
    expect(p).toContain("ONLY this JSON object");
  });
  it("instructs equivalence-tolerant comparison", () => {
    expect(p).toContain("algebraically-equivalent");
  });
});
