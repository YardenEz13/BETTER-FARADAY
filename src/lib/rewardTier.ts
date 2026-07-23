/**
 * Reward rarity ladder — one price→tier mapping shared by every cosmetic
 * (badges, titles) so a 2,000-XP reward looks unmistakably rarer than a 150-XP
 * one, in the same clay/electric language. Ported from the design lab
 * (Reward Theme Lab.dc.html). Tiers are derived from the shop `price` so adding
 * a catalogue row needs no extra tagging.
 */

export type Tier = "common" | "rare" | "epic" | "legendary";

export function tierForPrice(price: number): Tier {
  if (price >= 1500) return "legendary";
  if (price >= 800) return "epic";
  if (price >= 450) return "rare";
  return "common";
}

export interface TierStyle {
  /** Clay medal fill (a metallic gradient). */
  metal: string;
  /** Medal border + the pill/text accent. */
  edge: string;
  /** Offset clay shadow colour. */
  clay: string;
  /** Glyph stroke/fill inside a medal. */
  glyph: string;
  /** Rotating aura behind a medal; empty string = none. */
  ring: string;
  /** Whether the ring spins (legendary only). */
  spin: boolean;
  /** Solid tier colour for pills / labels. */
  accent: string;
  /** Hebrew tier name. */
  label: string;
}

export const TIER_STYLE: Record<Tier, TierStyle> = {
  common: {
    metal: "linear-gradient(150deg,#5BFF9F,#17C964)",
    edge: "#0F9E4E", clay: "#0B7A3B", glyph: "rgba(9,44,24,.72)",
    ring: "", spin: false, accent: "#17C964", label: "רגיל",
  },
  rare: {
    metal: "linear-gradient(150deg,#B9A8FF,#7B61FF)",
    edge: "#5E45E0", clay: "#43308F", glyph: "rgba(20,10,60,.72)",
    ring: "radial-gradient(circle,color-mix(in srgb,#7B61FF 45%,transparent),transparent 70%)",
    spin: false, accent: "#7B61FF", label: "נדיר",
  },
  epic: {
    metal: "linear-gradient(150deg,#FFD27A,#FFB02E)",
    edge: "#E0921A", clay: "#A86A10", glyph: "rgba(60,34,0,.72)",
    ring: "radial-gradient(circle,color-mix(in srgb,#FFB02E 55%,transparent),transparent 70%)",
    spin: false, accent: "#FFB02E", label: "אפי",
  },
  legendary: {
    metal: "linear-gradient(150deg,#FFE9A8,#FFB02E 55%,#FF8A3D)",
    edge: "#E0821A", clay: "#A05610", glyph: "rgba(60,30,0,.8)",
    ring: "conic-gradient(from 0deg,#FFB02E,#FFF2C8,#FF8A3D,#FFE9A8,#FFB02E)",
    spin: true, accent: "#FF8A3D", label: "אגדי",
  },
};

/** SVG path data for the badge/title glyphs (24×24 viewBox), keyed by the shop
 *  item's `icon`. Unknown keys fall back to the star. */
export const REWARD_ICON_PATH: Record<string, string> = {
  bolt: "M13 2L3 14h7l-1 8 10-12h-7z",
  lens: "M11 18a7 7 0 110-14 7 7 0 010 14zM20 21l-3.5-3.5",
  trophy: "M6 4h12v4a6 6 0 01-12 0zM6 6H3v2a3 3 0 003 3M18 6h3v2a3 3 0 01-3 3M9 18h6M8 22h8M12 14v4",
  flame: "M12 2c3 3 3 5 2 7 2-1 3 0 3 3a5 5 0 11-10 0c0-3 2-4 2-6 1 1 2 1 2-1 0-2 1-3 1-3z",
  target: "M12 22a10 10 0 110-20 10 10 0 010 20zM12 17a5 5 0 110-10 5 5 0 010 10z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.5 6.6 20l1-6.1L3.2 9.5l6.1-.9z",
  crown: "M3 18h18M4 8l4 4 4-7 4 7 4-4-1 10H5z",
};

export const iconPath = (icon: string): string => REWARD_ICON_PATH[icon] ?? REWARD_ICON_PATH.star;
