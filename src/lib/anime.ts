// Thin wrapper around anime.js v4, matching the reduced-motion contract used by
// the GSAP helpers in gsapUtils.ts. anime.js is the project's third animation
// tool — reach for it for SVG-attribute effects (line-drawing, traveling
// charges, dash morphs) where its API is nicer than GSAP/Framer. For
// scroll-reveal / stagger / count-up, prefer the existing GSAP helpers.
import { animate, createTimeline, createMotionPath, stagger, remove, utils } from "animejs";

export { animate, createTimeline, createMotionPath, stagger, remove, utils };

/** True when the OS asks for reduced motion — animateSafe becomes a no-op. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Reduced-motion-aware `animate()`. Returns `undefined` (no tween created) when
 * the user prefers reduced motion, so callers can also skip rendering the
 * animated element. Otherwise identical to anime.js's `animate`.
 */
export function animateSafe(...args: Parameters<typeof animate>): ReturnType<typeof animate> | undefined {
  if (prefersReducedMotion()) return undefined;
  return animate(...args);
}
