import { describe, it, expect } from "vitest";
import { menuLeftFor } from "./menuPosition";

const MENU_W = 256; // w-64, the "מטלה חדשה" menu

describe("menuLeftFor", () => {
  it("aligns the menu's right edge with the button's, RTL-style", () => {
    // Roomy desktop: no clamping, the ideal placement wins.
    expect(menuLeftFor(900, 1400, MENU_W)).toBe(900 - MENU_W);
  });

  it("keeps the menu on screen when the button sits near the left edge", () => {
    // Ideal would be -156, i.e. starting off the left of the viewport.
    expect(menuLeftFor(100, 1400, MENU_W)).toBe(8);
  });

  it("keeps the menu on screen when the button sits near the right edge", () => {
    // Ideal would run past the right edge; clamp to viewport - width - gap.
    expect(menuLeftFor(390, 390, MENU_W)).toBe(390 - MENU_W - 8);
  });

  it("never returns a negative left, even on a viewport narrower than the menu", () => {
    expect(menuLeftFor(200, 200, MENU_W)).toBe(8);
    expect(menuLeftFor(0, 0, MENU_W)).toBe(8);
  });

  it("stays inside the viewport across a sweep of phone and desktop widths", () => {
    for (const vw of [320, 375, 390, 414, 768, 1024, 1280, 1920]) {
      for (const buttonRight of [40, vw / 2, vw - 16, vw]) {
        const left = menuLeftFor(buttonRight, vw, MENU_W);
        expect(left).toBeGreaterThanOrEqual(8);
        // Where the menu genuinely fits, it must not overhang the right edge.
        if (vw >= MENU_W + 16) expect(left + MENU_W).toBeLessThanOrEqual(vw);
      }
    }
  });
});
