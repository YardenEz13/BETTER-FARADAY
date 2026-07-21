import { describe, it, expect } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("unwraps a Convex server error down to the thrown message", () => {
    const e = new Error(
      "[Request ID: 4f2a] Server Error\nUncaught Error: אין מספיק XP\n    at handler (../convex/shop.ts:120:5)",
    );
    expect(errorMessage(e)).toBe("אין מספיק XP");
  });

  it("passes a plain message through untouched", () => {
    expect(errorMessage(new Error("המטלה כבר נסגרה"))).toBe("המטלה כבר נסגרה");
  });

  it("falls back when there is nothing usable to show", () => {
    expect(errorMessage(new Error(""), "נפל")).toBe("נפל");
    expect(errorMessage(undefined, "נפל")).toBe("נפל");
    // A bare stack frame is noise, not a message.
    expect(errorMessage(new Error("    at handler (x.ts:1:1)"), "נפל")).toBe("נפל");
  });

  it("accepts a raw string reason (unhandledrejection often carries one)", () => {
    expect(errorMessage("network down")).toBe("network down");
  });
});
