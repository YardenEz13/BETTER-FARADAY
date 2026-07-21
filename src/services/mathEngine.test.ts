import { describe, it, expect } from "vitest";
import { compute } from "./mathEngine";

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
});
