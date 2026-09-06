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

/**
 * Moods that have hands, cut from the generated poses by cut-gestures.mjs.
 *
 * The rig itself is cut from the idle portrait, which has no arms, so without
 * these he can change expression but never gesture. `idle` has none by design —
 * his hands are down.
 */
const GESTURES = new Set<RigMood>(["thinking", "happy", "wrong", "streak"]);


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
  /** spark-green halo, same as FaradayAvatar's */
  glow?: boolean;
  className?: string;
  alt?: string;
}

export default function FaradayRig({
  mood = "idle",
  px = 200,
  look,
  glow = false,
  className = "",
  alt = "פרופסור פאראדיי",
}: FaradayRigProps) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const [blinking, setBlinking] = useState(false);

  /**
   * Twelve layers is twelve requests, and until they all arrive he assembles
   * himself in front of the student — a hovering pair of eyebrows, then a
   * collar. So the flat pose PNG stands in until they are all here.
   *
   * It is the right placeholder because it is the same drawing through the same
   * framing box (scripts/mascot-frame.mjs), so the swap does not move him, and
   * because it is one 36KB file the app already ships and has almost certainly
   * cached from an avatar somewhere else.
   *
   * Tracked as a Set of layer names rather than a counter: a cached image can
   * report `complete` on mount *and* fire `load`, and counting both would end
   * the wait early with layers still missing.
   */
  const [ready, setReady] = useState(false);
  const arrived = useRef(new Set<string>());
  const settle = (name: string) => {
    arrived.current.add(name);
    if (arrived.current.size >= LAYERS.length) setReady(true);
  };

  /**
   * The hands are tracked separately from the twelve body layers, and the
   * placeholder waits for them too.
   *
   * It has to. The placeholder is the flat pose, which has his hands drawn into
   * it — so handing over the moment the body layers land, while a 55KB gesture
   * is still in flight, makes his hands vanish and then pop back. Worse than
   * never having animated them.
   *
   * After that first handover the placeholder is done for good: a mood change
   * that far along should bring the new hands in on their own entrance, not
   * flash the whole mascot back to a still.
   */
  const [handsIn, setHandsIn] = useState(!GESTURES.has(mood));
  useEffect(() => { setHandsIn(!GESTURES.has(mood)); }, [mood]);
  const shown = useRef(false);
  if (ready && handsIn) shown.current = true;
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

  // Always on top. Tucking the raised arms behind his hair hides the sleeve, and
  // a hand with no arm reaching it reads as floating rather than raised — which
  // is worse than the wedge the sleeve makes across his hair, and wrong besides:
  // in the drawing these arms are in front of him.
  const gesture = GESTURES.has(mood) ? (
    // `key` remounts on every mood change, which replays the entrance —
    // otherwise swapping one gesture for another is a hard cut.
    <img
      key={mood}
      src={`/faraday-rig/gesture-${mood}.png`}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      // Held invisible until it has actually decoded, so the entrance plays on
      // a hand that exists rather than on an empty box.
      data-in={handsIn ? "" : undefined}
      ref={(el) => { if (el?.complete && el.naturalWidth > 0) setHandsIn(true); }}
      onLoad={() => setHandsIn(true)}
      onError={() => setHandsIn(true)}
      className="frig-layer frig-gesture"
    />
  ) : null;

  const img = (name: string) => (
    <img
      key={name}
      src={`/faraday-rig/${name}.png`}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      // A layer already in cache is `complete` before React can attach onLoad,
      // and then onLoad never fires — so that case has to be caught here or the
      // rig waits forever on an image it already has.
      ref={(el) => { if (el?.complete && el.naturalWidth > 0) settle(name); }}
      onLoad={() => settle(name)}
      // A missing layer must not strand him behind the placeholder for ever.
      onError={() => settle(name)}
      className={`frig-layer frig-${name}`}
    />
  );

  return (
    <div
      ref={root}
      className={`frig ${className}`}
      style={{
        width: px,
        height: px,
        filter: glow ? "drop-shadow(0 0 8px var(--color-inverse-primary))" : undefined,
      }}
      data-mood={mood}
      data-blink={blinking ? "" : undefined}
      onPointerMove={track}
      onPointerLeave={rest}
      role="img"
      aria-label={alt}
      data-loading={shown.current ? undefined : ""}
    >
      {/* Held until every layer is in, then it is gone. Not aria-hidden on
          purpose — while it is showing it *is* the mascot. */}
      {!shown.current && (
        <img
          src={`/faraday-${mood}.png`}
          alt=""
          aria-hidden
          draggable={false}
          className="frig-placeholder"
        />
      )}
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
          {gesture}
        </div>
      </div>
    </div>
  );
}

/** Layer names, for the lab and for tests. */
export const RIG_LAYERS = LAYERS;
