import { useRef, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { type FaradayPose, isLargePose } from "./FaradayAvatar";

/**
 * Professor Faraday with depth, built out of his own art.
 *
 * Five copies of the SAME pose PNG, each masked to one part of him and set at a
 * real `translateZ`. Tilting the box parallaxes them against each other, so the
 * side hair and collar swing across the face the way layers in a paper theatre
 * do:
 *
 *   base    z  0   the whole portrait, unmasked — nothing can tear
 *   face    z 14   the middle of his face
 *   wings   z 26   the two hair masses either side, one span each (a/b are
 *                  positions in the ARTWORK, not layout sides — the drawing
 *                  does not mirror under RTL, so they must not be start/end)
 *   collar  z 34   the black collar and bowtie
 *
 * ## Why copies of one image and not cut-up layers
 *
 * Every layer is `/faraday-<pose>.png`, the file the app already ships and the
 * browser already has cached. The regions are carved with CSS `mask-image`
 * radial gradients, so this adds **no new assets** — which matters on the
 * filtered school networks these students are on — and the likeness is exact,
 * because it is his drawing, not a model of it.
 *
 * At rest the copies sit pixel-on-pixel over identical pixels, so he looks
 * precisely like the flat portrait. The masks are feathered (the gradients fade
 * out rather than cutting) so no layer edge is ever a visible seam.
 *
 * ## The counter-scale is not optional
 *
 * Under `perspective`, `translateZ(z)` magnifies a layer by `d / (d - z)`. Left
 * alone, the face plane renders bigger than the face underneath it and he is
 * blurred at rest. Each layer is scaled by `(d - z) / d` to cancel exactly
 * that, which is where the odd numbers in the CSS come from. Change
 * `--f25-depth` and every scale has to change with it.
 *
 * Rotation is capped around ±14°: these are flat planes, and past roughly 25°
 * the illusion goes. For a full turntable he has to be redrawn at each angle —
 * see `scripts/make-turntable.mjs`.
 */

/** Max tilt in degrees at the edge of the box. */
const TILT = 14;

/** Poses this works on: the masks are shaped for the head-and-shoulders crop. */
export type Faraday25DPose = Exclude<FaradayPose, "point" | "thumbsup" | "wave">;

export interface Faraday25DProps {
  pose?: Faraday25DPose;
  /** rendered size in px */
  px?: number;
  className?: string;
  alt?: string;
}

export default function Faraday25D({
  pose = "idle",
  px = 200,
  className = "",
  alt = "פרופסור פאראדיי",
}: Faraday25DProps) {
  const stage = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();

  // The full-body poses frame him completely differently, so the masks would
  // land on his chest. Cheap guard — this is invisible in review otherwise.
  if (import.meta.env.DEV && isLargePose(pose as FaradayPose)) {
    console.warn(`Faraday25D: "${pose}" is a full-body pose; the depth masks are cut for the head crop.`);
  }

  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === "touch" || !stage.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    // -0.5..0.5 from the box centre, both axes.
    const dx = (e.clientX - box.left) / box.width - 0.5;
    const dy = (e.clientY - box.top) / box.height - 0.5;
    stage.current.style.setProperty("--f25-ry", `${dx * TILT * 2}deg`);
    stage.current.style.setProperty("--f25-rx", `${-dy * TILT * 2}deg`);
  };

  const rest = () => {
    stage.current?.style.removeProperty("--f25-ry");
    stage.current?.style.removeProperty("--f25-rx");
  };

  const src = `/faraday-${pose}.png`;
  const layer = (name: string) => (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`faraday-25d-layer faraday-25d-${name}`}
    />
  );

  return (
    <div
      className={`faraday-25d ${className}`}
      style={{ width: px, height: px }}
      onPointerMove={tilt}
      onPointerLeave={rest}
    >
      <div ref={stage} className="faraday-25d-stage">
        <div className="faraday-25d-sway">
          <span aria-hidden className="faraday-25d-glow" />
          {/* Only the base carries the alt text; the rest are the same pixels
              again and would just repeat him to a screen reader. */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="faraday-25d-layer faraday-25d-base"
          />
          {layer("face")}
          {layer("wing-a")}
          {layer("wing-b")}
          {layer("collar")}
        </div>
      </div>
    </div>
  );
}
