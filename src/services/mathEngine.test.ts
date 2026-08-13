import { describe, it, expect } from "vitest";
import { applyBothSides, compute } from "./mathEngine";

// One check per branch that shapes its own result object — solve (x_1=…, approx),
// derivative / integral (presentation wrapper + reuseLatex), evaluate (approx).
describe("compute", () => {
  it("solves an equation into numbered roots with a reusable first root", async () => {
    const r = await compute("solve", "x^2-4=0");
    expect(r.error).toBeNull();
    expect(r.latex).toContain("x_{1}=");
    expect(r.reuseLatex).not.toContain("x_{1}");
  });

  it("wraps a derivative in d/dx(...)= but keeps reuseLatex bare", async () => {
    const r = await compute("derivative", "x^3");
    expect(r.error).toBeNull();
    expect(r.latex).toContain("\\frac{d}{dx}");
    expect(r.reuseLatex).not.toContain("\\frac{d}{dx}");
  });

  it("wraps an integral and appends +C", async () => {
    const r = await compute("integral", "2x");
    expect(r.error).toBeNull();
    expect(r.latex).toContain("+C");
  });

  it("adds a decimal approximation only when it differs from the exact form", async () => {
    expect((await compute("evaluate", "\\sqrt{2}")).approx).toMatch(/^1\.41/);
    expect((await compute("evaluate", "2+2")).approx).toBeUndefined();
  });

  it("expands a product", async () => {
    const r = await compute("expand", "(x+1)^2");
    expect(r.error).toBeNull();
    expect(r.plain).toContain("x^2");
  });

  // On the united board the student's "line" is often a whole equation, so
  // everything but solve has to survive an `=` instead of choking on it.
  describe("on an equation", () => {
    it("expands each side and keeps the equation whole", async () => {
      const r = await compute("expand", "3(x+4)=27");
      expect(r.error).toBeNull();
      expect(r.plain).toBe("12+3*x=27");
      expect(r.latex).toContain("=");
    });

    it("simplifies each side", async () => {
      const r = await compute("simplify", "3x+7-7=31-7");
      expect(r.error).toBeNull();
      expect(r.plain).toBe("3*x=24");
    });

    it("differentiates both sides without the d/dx wrapper", async () => {
      const r = await compute("derivative", "y=x^3");
      expect(r.error).toBeNull();
      expect(r.latex).not.toContain("\\frac{d}{dx}");
      expect(r.plain).toContain("3*x^2");
    });

    it("integrates both sides and adds one +C", async () => {
      const r = await compute("integral", "y=2x");
      expect(r.error).toBeNull();
      expect(r.latex.match(/\+C/g)).toHaveLength(1);
    });

    it("still solves an equation as a whole rather than side by side", async () => {
      const r = await compute("solve", "3x+7=31");
      expect(r.error).toBeNull();
      expect(r.plain).toBe("8");
    });
  });
});

describe("applyBothSides", () => {
  it.each([
    ["subtracting the free term", "3x+7=31", "-" as const, "7", "3*x=24"],
    ["dividing out the coefficient", "3x=24", "/" as const, "3", "x=8"],
    ["clearing a denominator", "x/3=5", "*" as const, "3", "x=15"],
    ["collecting x from the right", "6x+5=2x+29", "-" as const, "2x", "4*x+5=29"],
    ["adding a negative free term", "x-8=-6", "+" as const, "8", "x=2"],
  ])("%s", async (_name, eq, op, operand, expected) => {
    const r = await applyBothSides(eq, op, operand);
    expect(r.error).toBeNull();
    expect(r.plain).toBe(expected);
  });

  it("simplifies rather than piling the operation onto the line", async () => {
    const r = await applyBothSides("3x+7=31", "-", "7");
    expect(r.plain).not.toContain("7-7");
  });

  it("works on expressions the balance metaphor was never built for", async () => {
    const r = await applyBothSides("\\sqrt{x}=4", "*", "\\sqrt{x}");
    expect(r.error).toBeNull();
    expect(r.plain).toBe("x=4*sqrt(x)");
  });

  it("refuses when there is no equation to balance", async () => {
    expect((await applyBothSides("3x+7", "-", "7")).error).toMatch(/סימן =/);
  });

  it("refuses an empty operand", async () => {
    expect((await applyBothSides("3x+7=31", "-", "  ")).error).toMatch(/כתבו מספר/);
  });

  it("refuses division by zero", async () => {
    expect((await applyBothSides("3x=24", "/", "0")).error).toMatch(/באפס/);
  });

  // The result lands back on the board next to what the student typed, so it
  // has to be written the way they write it.
  it("writes a coefficient as 3x, not 3 \\cdot x", async () => {
    const r = await applyBothSides("3x+7=31", "-", "7");
    expect(r.latex).not.toContain("\\cdot");
    expect(r.latex).toContain("3x");
  });

  it("keeps \\cdot between two symbols, where juxtaposition would be ambiguous", async () => {
    const r = await compute("evaluate", "x \\cdot y");
    expect(r.latex).toContain("\\cdot");
  });
});

describe("results that land back on the board", () => {
  it("writes a factored form as (x-2)(x-3), no dot between the groups", async () => {
    const r = await compute("factor", "x^2-5x+6");
    expect(r.error).toBeNull();
    expect(r.latex).not.toContain("\\cdot");
  });

  it("leaves a constant side alone instead of factoring it into 0^1", async () => {
    const r = await compute("factor", "x^2-5x+6=0");
    expect(r.error).toBeNull();
    expect(r.latex).not.toContain("^{1}");
    expect(r.latex.endsWith("=0")).toBe(true);
  });
});
