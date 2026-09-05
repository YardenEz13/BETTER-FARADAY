import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Professor Faraday as a rigged puppet instead of a flipbook.
 *
 * Every other mascot component here swaps whole drawings: one PNG per pose,
 * cross-faded on change. Nothing can interpolate between two drawings, so he
 * cannot look at anything, cannot blend, and cannot breathe *while* he waves —
 * a second CSS `animation` on one element replaces the first.
 *
 * This renders the twelve cut parts from `public/faraday-rig/` (see
 * `scripts/cut-rig-layers.mjs`) nested so a parent's transform carries its
 * children. That nesting is the whole trick:
 *
 *   - **Nested transforms are bones.** Rotating `.frig-head` carries the eyes,
 *     brows and mouth with it, for free, because they are its DOM children.
 *     Forward kinematics with no maths and no library.
 *   - **A CSS transition is the blend.** Mood changes move the same elements to
 *     new transforms over 200ms rather than cutting between two pictures. This
 *     is the thing the pose-swap approach structurally cannot do.
 *   - **Separate elements compose.** Breathing lives on the body, blinking on
 *     the eyes, look-at on the pupils. They run at once and never fight, since
 *     no two share an element.
 *
 * Every layer is a full-canvas PNG, so they stack at `inset: 0` with nothing to
 * position by hand and one shared coordinate space for the nesting to work in.
 *
 * ## Ceilings
 *
 * No mesh deformation — parts move rigidly, so the hair swings rather than
 * bending, and past ~8% of head rotation a seam opens at the hairline where the
 * face outline was drawn over the hair. There is no eyelid drawing either, so a
 * blink squashes the eye to a sliver of its own dark rim. All three want the
 * redraw in `docs/mascot-plan.md` §5.3; none of them block the rig.
 */

export type RigMood = "idle" | "thinking" | "happy" | "wrong" | "streak";

/** Back to front. Order matters — it is the paint order of the drawing. */
const LAYERS = [
  "jacket", "bowtie", "hair", "collar", "head",
  "eye-white-a", "eye-white-b", "brow-a", "brow-b", "mouth", "pupil-a", "pupil-b",
] as const;

export interface FaradayRigProps {
  mood?: RigMood;
  /** rendered size in px */
  px?: number;
  /**
   * Where he looks, each -1..1, in ARTWORK space — not layout space. The
   * drawing does not mirror under RTL, so a caller wanting him to look at
   * something on the page flips the sign it passes, never the character.
   * Omitted means he follows the pointer.
   */
  look?: { x: number; y: number };
  className?: string;
  alt?: string;
}

export default function FaradayRig({
  mood = "idle",
  px = 200,
  look,
  className = "",
  alt = "פרופסור פאראדיי",
}: FaradayRigProps) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const [blinking, setBlinking] = useState(false);
  /** When the pointer last drove the gaze, so idle drift can stay out of its way. */
  const lastPointerRef = useRef(0);

  // Drive look-at through CSS custom properties rather than React state: it
  // fires on every pointer move, and re-rendering twelve images at that rate to
  // change two numbers is work the compositor can do on its own.
  const setLook = (x: number, y: number) => {
    root.current?.style.setProperty("--rig-lx", `${x}`);
    root.current?.style.setProperty("--rig-ly", `${y}`);
  };

  useEffect(() => {
    if (look) setLook(look.x, look.y);
  }, [look?.x, look?.y]);

  // Blink on a randomised interval. A fixed beat is the tell that something is
  // on a timer rather than alive — the existing CSS blink is a fixed 6.4s and
  // reads as mechanical once you have noticed it.
  useEffect(() => {
    if (reduced) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 110);
        schedule();
      }, 2200 + Math.random() * 4200);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [reduced]);

  /**
   * Idle gaze. With nothing to follow he drifts his eyes on his own, which on a
   * phone is every single moment — there is no pointer to track, so without this
   * he stares dead ahead forever and reads as switched off. Desktop gets it too
   * whenever the cursor is somewhere else on the page.
   *
   * Kept well inside the pupils' travel so a drift never looks like a stare, and
   * skipped while the pointer is actually driving him, or the two fight over the
   * same two numbers.
   */
  useEffect(() => {
    if (reduced || look) return;
    let timer: number;
    const drift = () => {
      timer = window.setTimeout(() => {
        if (Date.now() - lastPointerRef.current > 1600) {
          setLook((Math.random() * 2 - 1) * 0.55, (Math.random() * 2 - 1) * 0.4);
        }
        drift();
      }, 1600 + Math.random() * 2800);
    };
    drift();
    return () => window.clearTimeout(timer);
  }, [reduced, look]);

  const track = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || look || e.pointerType === "touch") return;
    lastPointerRef.current = Date.now();
    const b = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    // Divided by a distance rather than the box, so he tracks the pointer across
    // the page instead of only within his own bounds.
    setLook(
      clamp((e.clientX - (b.left + b.width / 2)) / 420),
      clamp(((b.top + b.height / 2) - e.clientY) / 420),
    );
  };

  const rest = () => {
    if (look) return;
    setLook(0, 0);
  };

  const img = (name: string) => (
    <img
      key={name}
      src={`/faraday-rig/${name}.png`}
      alt=""
      aria-hidden
      draggable={false}
      className={`frig-layer frig-${name}`}
    />
  );

  return (
    <div
      ref={root}
      className={`frig ${className}`}
      style={{ width: px, height: px }}
      data-mood={mood}
      data-blink={blinking ? "" : undefined}
      onPointerMove={track}
      onPointerLeave={rest}
      role="img"
      aria-label={alt}
    >
      <div className="frig-body">
        {img("jacket")}
        {img("bowtie")}
        <div className="frig-head-grp">
          {img("hair")}
          {img("collar")}
          {img("head")}
          <div className="frig-eye frig-eye-a">
            {img("eye-white-a")}
            {img("pupil-a")}
          </div>
          <div className="frig-eye frig-eye-b">
            {img("eye-white-b")}
            {img("pupil-b")}
          </div>
          {img("brow-a")}
          {img("brow-b")}
          {img("mouth")}
        </div>
      </div>
    </div>
  );
}

/** Layer names, for the lab and for tests. */
export const RIG_LAYERS = LAYERS;
