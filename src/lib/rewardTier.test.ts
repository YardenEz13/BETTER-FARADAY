import { describe, it, expect } from "vitest";
import { tierForPrice, TIER_STYLE, iconPath, REWARD_ICON_PATH } from "./rewardTier";

// The price→tier ladder is what makes an expensive reward look rarer, so pin
// the thresholds and a couple of real catalogue prices to their tiers.
describe("tierForPrice", () => {
  it("maps the tier boundaries", () => {
    expect(tierForPrice(0)).toBe("common");
    expect(tierForPrice(449)).toBe("common");
    expect(tierForPrice(450)).toBe("rare");
    expect(tierForPrice(799)).toBe("rare");
    expect(tierForPrice(800)).toBe("epic");
    expect(tierForPrice(1499)).toBe("epic");
    expect(tierForPrice(1500)).toBe("legendary");
  });

  it("places real catalogue rewards on the ladder", () => {
    expect(tierForPrice(400)).toBe("common");   // תג ברק
    expect(tierForPrice(800)).toBe("epic");      // תג ללא טעויות
    expect(tierForPrice(2000)).toBe("legendary"); // תג אגדה
    expect(tierForPrice(1500)).toBe("legendary"); // תואר מוח על
  });

  it("only legendary spins its aura", () => {
    expect(TIER_STYLE.legendary.spin).toBe(true);
    expect(TIER_STYLE.common.spin).toBe(false);
    expect(TIER_STYLE.rare.spin).toBe(false);
    expect(TIER_STYLE.epic.spin).toBe(false);
  });
});

describe("iconPath", () => {
  it("resolves known icons and falls back to star", () => {
    expect(iconPath("trophy")).toBe(REWARD_ICON_PATH.trophy);
    expect(iconPath("nonsense")).toBe(REWARD_ICON_PATH.star);
  });
});
