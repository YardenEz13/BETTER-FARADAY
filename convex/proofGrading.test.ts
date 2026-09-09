import { describe, it, expect } from "vitest";
import { mergeStepResult } from "./proofGrading";
import { judgeReason } from "./geometryTheorems";

/**
 * The reported bug lives in the seam between these two: the deterministic
 * theorem match and Gemini's opinion. The model used to be the only judge of a
 * justification, and it marked correct reasoning wrong for being worded
 * differently from the single `expectedReason` string it was shown.
 *
 * These lock the override rules — including the direction that matters for
 * marks not being given away: a recognised *different* theorem is wrong even
 * when the model says otherwise.
 */

const EXPECTED = ["אלכסוני מקבילית מחצים זה את זה"];
const modelSays = (over: Record<string, unknown> = {}) => ({
  claimCorrect: true, reasonCorrect: true, feedback: "יפה", ...over,
});

describe("judgeReason", () => {
  it("agrees when the student names the same theorem in their own words", () => {
    const j = judgeReason(EXPECTED, "כי במקבילית האלכסונים חוצים זה את זה");
    expect(j.agrees).toBe(true);
    expect(j.knownButDifferent).toBe(false);
    expect(j.phrasingNote).toMatch(/בניסוח הרשמי/);
  });

  it("adds no phrasing note when the student already wrote the formal name", () => {
    const j = judgeReason(["זוויות קודקודיות שוות"], "זוויות קודקודיות שוות");
    expect(j.agrees).toBe(true);
    expect(j.phrasingNote).toBeUndefined();
  });

  it("accepts an alternative route listed in acceptableReasons", () => {
    const j = judgeReason(["צ.ז.צ", "ז.צ.ז"], "זווית צלע זווית");
    expect(j.agrees).toBe(true);
  });

  it("rejects a different known theorem outright", () => {
    const j = judgeReason(EXPECTED, "אלכסוני מעוין מאונכים");
    expect(j.agrees).toBe(false);
    expect(j.knownButDifferent).toBe(true);
  });

  it("leaves an unrecognised justification undecided, for the model to judge", () => {
    const j = judgeReason(EXPECTED, "כי ככה יוצא לי");
    expect(j.agrees).toBe(false);
    expect(j.knownButDifferent).toBe(false);
  });
});

describe("mergeStepResult", () => {
  it("gives full credit for the right theorem informally worded, even if the model says wrong", () => {
    const det = judgeReason(EXPECTED, "כי במקבילית האלכסונים חוצים זה את זה");
    const r = mergeStepResult(0, det, modelSays({ reasonCorrect: false }));
    expect(r.reasonCorrect).toBe(true);
    expect(r.stepScore).toBe(1);
    expect(r.reasonPhrasingNote).toMatch(/בניסוח הרשמי/);
  });

  it("still fails a different theorem, even if the model waves it through", () => {
    const det = judgeReason(EXPECTED, "אלכסוני מעוין מאונכים");
    const r = mergeStepResult(0, det, modelSays({ reasonCorrect: true }));
    expect(r.reasonCorrect).toBe(false);
    expect(r.stepScore).toBe(0.5); // claim was right, justification was not
  });

  it("defers to the model when it recognises no theorem", () => {
    const det = judgeReason(EXPECTED, "כי ככה יוצא לי");
    expect(mergeStepResult(0, det, modelSays({ reasonCorrect: false })).reasonCorrect).toBe(false);
    expect(mergeStepResult(0, det, modelSays({ reasonCorrect: true })).reasonCorrect).toBe(true);
  });

  it("recomputes the score instead of trusting the model's arithmetic", () => {
    const det = judgeReason(EXPECTED, "כי במקבילית האלכסונים חוצים זה את זה");
    // Model contradicts itself: says both wrong, then scores it 1.
    const r = mergeStepResult(0, det, { claimCorrect: false, reasonCorrect: false, stepScore: 1 });
    expect(r.stepScore).toBe(0.5); // reason overridden to true, claim still false
  });

  it("scores zero only when both halves are wrong", () => {
    const det = judgeReason(EXPECTED, "כי ככה");
    const r = mergeStepResult(0, det, { claimCorrect: false, reasonCorrect: false });
    expect(r.stepScore).toBe(0);
  });

  it("survives a malformed model response without throwing", () => {
    const det = judgeReason(EXPECTED, "כי ככה");
    expect(() => mergeStepResult(0, det, {})).not.toThrow();
    const r = mergeStepResult(0, det, { claimCorrect: "yes", feedback: 42 });
    expect(r.feedback).toBe("42");
    expect(r.stepScore).toBe(0.5);
  });

  it("names the theorem from the model's answer when our matcher missed it", () => {
    const det = judgeReason(EXPECTED, "משהו שאיננו מזהים");
    const r = mergeStepResult(0, det, modelSays({ reasonCorrect: true, matchedTheorem: "זוויות קודקוד שוות" }));
    expect(r.matchedTheoremId).toBe("vertical-angles");
    expect(r.reasonPhrasingNote).toMatch(/קודקודיות/);
  });
});
