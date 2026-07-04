import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

export { gsap, ScrollTrigger };

/** True when the OS asks for reduced motion — every hook here becomes a no-op. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface ScrollRevealOptions {
  /** slide distance in px (default 28) */
  y?: number;
  /** initial scale — set below 1 for a "pop" (default 1, no scale) */
  scale?: number;
  duration?: number;
  delay?: number;
  ease?: string;
  /** ScrollTrigger start position (default "top 88%") */
  start?: string;
}

/** Fades + slides an element in as it scrolls into view (fires once). */
export function useScrollReveal<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: ScrollRevealOptions = {},
) {
  const opts = useRef(options);
  opts.current = options;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const o = opts.current;
    const tween = gsap.fromTo(
      el,
      { autoAlpha: 0, y: o.y ?? 28, scale: o.scale ?? 1 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: o.duration ?? 0.7,
        delay: o.delay ?? 0,
        ease: o.ease ?? "power3.out",
        scrollTrigger: { trigger: el, start: o.start ?? "top 88%", once: true },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [ref]);
}

export interface StaggerRevealOptions {
  /** seconds between each child (default 0.04 = 40ms) */
  stagger?: number;
  y?: number;
  scale?: number;
  duration?: number;
  ease?: string;
  /** CSS selector for targets — defaults to direct children */
  selector?: string;
  /** stagger children in random order (constellation float-in) */
  random?: boolean;
  start?: string;
}

/** Staggers a container's children into view (KPI cards, student cards, lists). */
export function useStaggerReveal<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: StaggerRevealOptions = {},
) {
  const opts = useRef(options);
  opts.current = options;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const o = opts.current;
    const targets = o.selector ? el.querySelectorAll(o.selector) : el.children;
    if (targets.length === 0) return;
    const tween = gsap.fromTo(
      targets,
      { autoAlpha: 0, y: o.y ?? 26, scale: o.scale ?? 1 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: o.duration ?? 0.55,
        ease: o.ease ?? "power3.out",
        stagger: o.random ? { each: o.stagger ?? 0.04, from: "random" } : (o.stagger ?? 0.04),
        scrollTrigger: { trigger: el, start: o.start ?? "top 90%", once: true },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [ref]);
}

export interface LetterJumpOptions {
  /** set false to skip entirely (avoids the DOM query on non-animated renders) */
  enabled?: boolean;
  /** seconds between each character (default 0.024) */
  stagger?: number;
  /** cap on the total stagger span in seconds so long texts don't drag (default 1.6) */
  maxStaggerSpan?: number;
  /** jump height in px (default 22) */
  y?: number;
  duration?: number;
  delay?: number;
  ease?: string;
  /** CSS selector for the characters (default ".jump-char") */
  selector?: string;
}

/**
 * Staggers `.jump-char` spans (see MathText's `animateLetters`) into view with
 * a bouncy per-letter jump. Re-runs whenever `deps` change (e.g. question id).
 */
export function useLetterJump<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: readonly unknown[],
  options: LetterJumpOptions = {},
) {
  const opts = useRef(options);
  opts.current = options;
  useLayoutEffect(() => {
    const el = ref.current;
    const o = opts.current;
    if (!el || o.enabled === false || prefersReducedMotion()) return;
    const chars = el.querySelectorAll(o.selector ?? ".jump-char");
    if (chars.length === 0) return;
    // long texts keep the same total reveal time instead of dragging on
    const stagger = Math.min(o.stagger ?? 0.024, (o.maxStaggerSpan ?? 1.6) / chars.length);
    const tween = gsap.fromTo(
      chars,
      { autoAlpha: 0, y: o.y ?? 22, scale: 0.7 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: o.duration ?? 0.55,
        delay: o.delay ?? 0,
        ease: o.ease ?? "back.out(2.6)",
        stagger,
        onComplete: () => gsap.set(chars, { clearProps: "transform,opacity,visibility" }),
      },
    );
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export interface CountUpOptions {
  duration?: number;
  /** appended after the number, e.g. "%" */
  suffix?: string;
  /** use toLocaleString grouping (default true) */
  grouped?: boolean;
}

/**
 * Animates an element's text from 0 to `targetValue` when it scrolls into view.
 * Returns the ref to attach. Live data updates re-tween from the current value.
 */
export function useCountUp<T extends HTMLElement>(targetValue: number, options: CountUpOptions = {}) {
  const ref = useRef<T>(null);
  const proxy = useRef({ val: 0, revealed: false });
  const opts = useRef(options);
  opts.current = options;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = opts.current;
    const render = () => {
      const n = Math.round(proxy.current.val);
      el.textContent = (o.grouped === false ? String(n) : n.toLocaleString()) + (o.suffix ?? "");
    };
    if (prefersReducedMotion()) {
      proxy.current.val = targetValue;
      render();
      return;
    }
    render(); // paint the starting value before the trigger fires
    const tween = gsap.to(proxy.current, {
      val: targetValue,
      duration: o.duration ?? 1.2,
      ease: "power2.out",
      onUpdate: render,
      // first reveal waits for the viewport; later data updates tween immediately
      scrollTrigger: proxy.current.revealed
        ? undefined
        : { trigger: el, start: "top 92%", once: true, onEnter: () => { proxy.current.revealed = true; } },
    });
    if (proxy.current.revealed) tween.play();
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [targetValue]);

  return ref;
}

/**
 * Animates a plain number from 0 to `target` (re-tweens on change) and returns
 * the in-flight value — for driving conic gradients / SVG gauges through React.
 */
export function useAnimatedValue(target: number, duration = 1.4): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const proxy = { val: 0 };
    setValue((current) => (proxy.val = current));
    const tween = gsap.to(proxy, {
      val: target,
      duration,
      ease: "power2.out",
      onUpdate: () => setValue(proxy.val),
    });
    return () => {
      tween.kill();
    };
  }, [target, duration]);
  return value;
}

export interface MagneticHoverOptions {
  /** how far the element chases the cursor, 0–1 of the offset (default 0.2) */
  strength?: number;
  /** max 3D tilt in degrees (default 0 = no tilt) */
  tilt?: number;
}

/** Subtle magnetic pull (and optional 3D tilt) toward the cursor on hover. */
export function useMagneticHover<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: MagneticHoverOptions = {},
) {
  const opts = useRef(options);
  opts.current = options;
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (!window.matchMedia("(hover: hover)").matches) return; // touch devices
    const { strength = 0.2, tilt = 0 } = opts.current;

    if (tilt > 0) gsap.set(el, { transformPerspective: 600 });
    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
    const rxTo = gsap.quickTo(el, "rotationX", { duration: 0.4, ease: "power3.out" });
    const ryTo = gsap.quickTo(el, "rotationY", { duration: 0.4, ease: "power3.out" });

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const relX = (e.clientX - (r.left + r.width / 2)) / (r.width / 2); // -1..1
      const relY = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      xTo(relX * (r.width / 2) * strength);
      yTo(relY * (r.height / 2) * strength);
      if (tilt > 0) {
        rxTo(-relY * tilt);
        ryTo(relX * tilt);
      }
    };
    const onLeave = () => {
      xTo(0);
      yTo(0);
      rxTo(0);
      ryTo(0);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(el);
    };
  }, [ref]);
}
