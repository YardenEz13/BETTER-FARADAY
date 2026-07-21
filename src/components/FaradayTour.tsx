import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import FaradayAvatar from "./FaradayAvatar";
import { ArrowLeft, X } from "./electric";

/** One stop on a guided tour. `key` matches a `data-tour="…"` attribute on the
 *  element to spotlight. */
export interface TourStep {
  key: string;
  title: string;
  body: string;
  /** Ran when the step activates — e.g. switch the dashboard to the view that
   *  owns this step's target. The tour then waits for the target to mount. */
  onEnter?: () => void;
  /** Selector clicked once the target is on screen, to demo a real interaction
   *  (expanding a student's AI chat, opening the "new assignment" menu).
   *  Fires once per step activation. */
  clickOnArrive?: string;
}

/** Target may mount late (a view swap animates in) — poll rather than assume. */
const POLL_MS = 90;
const POLL_TRIES = 30;

/** Default (student) tour — spotlights StudentHome. */
export const STUDENT_TOUR_STEPS: TourStep[] = [
  {
    key: "map",
    title: "מפת הלמידה שלך",
    body: "כל תחנה במסלול היא נושא. פתרו שאלות כדי להטעין את התחנה ולפתוח את הבאה בתור.",
  },
  {
    key: "stats",
    title: "הרצף והאנרגיה",
    body: "כאן עוקבים אחרי הרצף היומי, נקודות האנרגיה (XP) והרמה שלך. שמרו על הרצף כל יום!",
  },
  {
    key: "daily",
    title: "הניסוי היומי",
    body: "בכל יום פרופסור פאראדיי בוחר לך אתגר. השלימו אותו כדי לשמור על המומנטום.",
  },
  {
    key: "tutor",
    title: "מורה ה-AI",
    body: "תקועים? פרופסור פאראדיי כאן בשבילכם עם רמזים והסברים — בכל שלב.",
  },
];

const BUBBLE_WIDTH = 320;
const GAP = 14; // gap between the spotlight and the bubble
const MARGIN = 12; // min distance from any viewport edge

export interface FaradayTourProps {
  open: boolean;
  /** Called on finish, skip, Escape, or scrim click. Parent persists the "done" flag. */
  onClose: () => void;
  /** Stops to walk through; defaults to the student tour. */
  steps?: TourStep[];
}

/**
 * A lightweight guided tour. Each step spotlights a target element (located via
 * its `data-tour` attribute), dims the
 * rest of the page with a scrim cutout, and anchors a clay speech-bubble from
 * Faraday next to it. Positions are measured with getBoundingClientRect and
 * clamped to the viewport (RTL-aware). Escape or a scrim click skips the tour.
 * Respects reduced motion (fades only, no springs).
 */
export default function FaradayTour({ open, onClose, steps = STUDENT_TOUR_STEPS }: FaradayTourProps) {
  const reducedMotion = !!useReducedMotion();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step === steps.length - 1;

  // Guards `clickOnArrive` so a re-run of the effect can't toggle it back off.
  const clickedFor = useRef(-1);

  // Reset to the first step whenever the tour (re)opens. The click guard is
  // cleared on *close*, not here: this runs after the layout effect below has
  // already fired step 0's click, so resetting it here would re-arm and
  // double-click (toggling the thing it just opened shut).
  useEffect(() => {
    if (open) setStep(0);
    else clickedFor.current = -1;
  }, [open]);

  // A key may be on two elements (e.g. a desktop nav and its mobile twin) — take
  // the first one that's actually rendered.
  const findTarget = useCallback(
    (key: string) =>
      // note: not offsetParent — that's null for position:fixed elements too
      [...document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)]
        .find((e) => e.getBoundingClientRect().width > 0) ?? null,
    [],
  );

  const measure = useCallback(() => {
    const el = findTarget(current.key);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [current.key, findTarget]);

  // Activate the step: run its side effect (switch view), wait for the target to
  // mount, scroll to it, optionally demo a click, then measure. Re-measures a
  // couple of times so the cutout follows a smooth scroll or an expanding card.
  useLayoutEffect(() => {
    if (!open) return;
    current.onEnter?.();

    const timers: number[] = [];
    let tries = 0;
    const settle = () => {
      const el = findTarget(current.key);
      if (!el) {
        setRect(null);
        if (tries++ < POLL_TRIES) timers.push(window.setTimeout(settle, POLL_MS));
        return;
      }
      el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      if (current.clickOnArrive && clickedFor.current !== step) {
        clickedFor.current = step;
        document.querySelector<HTMLElement>(current.clickOnArrive)?.click();
      }
      [0, 320, 900].forEach((d) => timers.push(window.setTimeout(measure, d)));
    };
    settle();

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, current, measure, findTarget, reducedMotion]);

  // Escape skips the tour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const next = () => {
    if (isLast) onClose();
    else setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  // Spotlight padding so the cutout hugs the target with a little breathing room.
  const pad = 8;
  const spot = rect
    ? {
        top: Math.max(rect.top - pad, 0),
        left: Math.max(rect.left - pad, 0),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Bubble placement: below the target if there's room, else above; if the
  // target is unknown (rect null) center the bubble.
  let bubbleTop: number;
  let bubbleLeft: number;
  const bubbleHeightEstimate = 220;

  if (spot) {
    const below = spot.top + spot.height + GAP;
    const placeBelow = below + bubbleHeightEstimate < vh || spot.top < bubbleHeightEstimate;
    bubbleTop = placeBelow ? below : spot.top - GAP - bubbleHeightEstimate;
    bubbleTop = Math.min(Math.max(bubbleTop, MARGIN), Math.max(vh - bubbleHeightEstimate - MARGIN, MARGIN));
    // Anchor to the target's right edge (RTL reading start), clamp to viewport.
    const rightAligned = spot.left + spot.width - BUBBLE_WIDTH;
    bubbleLeft = Math.min(Math.max(rightAligned, MARGIN), Math.max(vw - BUBBLE_WIDTH - MARGIN, MARGIN));
  } else {
    bubbleTop = Math.max(vh / 2 - bubbleHeightEstimate / 2, MARGIN);
    bubbleLeft = Math.max(vw / 2 - BUBBLE_WIDTH / 2, MARGIN);
  }

  const fade = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, y: 8, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.98 },
        transition: { type: "spring" as const, stiffness: 320, damping: 26 },
      };

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="סיור היכרות">
      {/* Scrim + spotlight cutout. A giant box-shadow around the target rect dims
          everything else; clicking the scrim skips the tour. When no target is
          found we fall back to a plain full-screen scrim. */}
      {spot ? (
        <motion.div
          key={current.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.25 }}
          className="absolute rounded-2xl pointer-events-none"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: `0 0 0 9999px color-mix(in srgb, var(--color-scrim) 70%, transparent)`,
            outline: "2px solid color-mix(in srgb, var(--color-primary) 60%, transparent)",
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "color-mix(in srgb, var(--color-scrim) 70%, transparent)" }}
        />
      )}

      {/* Full-screen scrim click-catcher (behind the bubble) */}
      <button
        type="button"
        aria-label="דלג על הסיור"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={onClose}
      />

      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          {...fade}
          className="absolute clay-card p-5"
          style={{ top: bubbleTop, left: bubbleLeft, width: BUBBLE_WIDTH, maxWidth: `calc(100vw - ${MARGIN * 2}px)` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="דלג"
            className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <X size={15} />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-surface border-2 border-primary/40 flex items-center justify-center flex-shrink-0 shadow-(--shadow-clay)">
              <FaradayAvatar px={42} glow />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="font-bold text-on-surface text-base leading-tight">{current.title}</h3>
            </div>
          </div>

          <p className="font-medium text-on-surface-variant text-sm leading-relaxed mt-3">
            {current.body}
          </p>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mt-4" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.key}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 7,
                  height: 7,
                  background:
                    i === step ? "var(--color-primary)" : "color-mix(in srgb, var(--color-primary) 30%, transparent)",
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 mt-4">
            <button type="button" onClick={onClose} className="btn-clay-ghost !px-4 !py-2 text-sm">
              דלג
            </button>
            <button type="button" onClick={next} className="btn-clay-primary !px-5 !py-2 text-sm">
              {isLast ? "יאללה, מתחילים!" : "הבא"}
              {!isLast && <ArrowLeft size={16} />}
            </button>
          </div>

          <span className="num font-mono text-[11px] text-on-surface-variant absolute bottom-3 left-4">
            {step + 1}/{steps.length}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
