import { useState } from "react";
import { Bot } from "./electric";

/**
 * Professor Faraday, the app mascot. One transparent 192px PNG per pose, cut
 * from the generated character sheet by `scripts/slice-mascot.mjs`:
 *
 *   public/faraday-idle.png      neutral, eyes open
 *   public/faraday-thinking.png  hand at chin
 *   public/faraday-happy.png     arms up, green sparks
 *   public/faraday-wrong.png     open hand, encouraging
 *   public/faraday-streak.png    amber lightning
 *   public/faraday-blink.png     eyes closed — registers against `idle`
 *
 * One size for all of them: 192px covers 3x on the largest site (64px), and a
 * resolution ladder for a ~40KB asset costs more in files than it saves in bytes.
 */
export type FaradayPose = "idle" | "thinking" | "happy" | "wrong" | "streak";

export interface FaradayAvatarProps {
  /** which pose to show */
  pose?: FaradayPose;
  /** rendered size in px */
  px?: number;
  /** fill the parent box instead of a fixed-size box (use inside an existing circle) */
  fill?: boolean;
  /** spark-green halo */
  glow?: boolean;
  /** "cover" fills the box (slight crop); "contain" shows the whole pose */
  fit?: "cover" | "contain";
  className?: string;
  alt?: string;
}

/**
 * Drop-in for the lucide <Bot> avatar; falls back to it if a file is missing,
 * so the app never shows a broken image.
 */
export default function FaradayAvatar({
  pose = "idle",
  px = 40,
  fill = false,
  glow = false,
  fit = "contain",
  className = "",
  alt = "פרופסור פאראדיי",
}: FaradayAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Bot size={Math.round(px * 0.6)} className={`text-primary ${className}`} />;
  }

  const imgClass = `w-full h-full ${className}`;
  const imgStyle = { objectFit: fit } as const;

  return (
    <span
      className={`relative block select-none pointer-events-none faraday-idle ${fill ? "w-full h-full" : ""}`}
      style={{
        width: fill ? undefined : px,
        height: fill ? undefined : px,
        filter: glow ? "drop-shadow(0 0 8px var(--color-inverse-primary))" : undefined,
      }}
    >
      {/* `key` remounts this group on every pose change, which is what replays
          the swap animation. Each layer owns one animation — they cannot share
          an element, since a second `animation` would replace the first. */}
      <span key={pose} className="faraday-swap relative block w-full h-full">
        {/* Blink only on idle: the closed-eye frame was cut to register against
            that pose, and the others either move the head or already close his
            eyes. Underneath, so the open-eyed pose fading out reveals it. */}
        {pose === "idle" && (
          <img
            src="/faraday-blink.png"
            alt=""
            aria-hidden
            draggable={false}
            className={`absolute inset-0 ${imgClass}`}
            style={imgStyle}
          />
        )}
        <img
          src={`/faraday-${pose}.png`}
          alt={alt}
          draggable={false}
          onError={() => setFailed(true)}
          className={`relative ${pose === "idle" ? "faraday-blinker" : ""} ${
            pose === "thinking" ? "faraday-ponder" : ""
          } ${imgClass}`}
          style={imgStyle}
        />
      </span>
    </span>
  );
}
