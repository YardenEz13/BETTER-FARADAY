import { useState } from "react";
import { Bot } from "./electric";

/**
 * Full-color Faraday tutor portraits, served from /public.
 * These are level-of-detail / resolution steps — each PNG is ~2x its intended
 * display size, so it stays crisp on retina. We pick by rendered size.
 *
 * Expected files:
 *   public/faraday32.png   (67x76)
 *   public/faraday45.png   (67x76)
 *   public/faraday64.png   (102x112)
 *   public/faraday128.png  (281x334)
 */
const LOD = [32, 45, 64, 128] as const;

/** nearest pre-optimized asset >= the rendered size */
function pickAsset(px: number) {
  return LOD.find((v) => v >= px) ?? 128;
}

export interface FaradayAvatarProps {
  /** intended render size in px — drives both the box and which optimized PNG loads */
  px?: number;
  /** fill the parent box instead of rendering a fixed-size box (use inside an existing circle) */
  fill?: boolean;
  /** spark-green halo */
  glow?: boolean;
  /** "cover" fills the circle (slight crop); "contain" shows the whole portrait */
  fit?: "cover" | "contain";
  className?: string;
  alt?: string;
}

/**
 * Michael Faraday tutor portrait. Drop-in for the lucide <Bot> avatar.
 * Gracefully falls back to <Bot> if a source file is missing, so the app
 * never shows a broken image.
 */
export default function FaradayAvatar({
  px = 40,
  fill = false,
  glow = false,
  fit = "cover",
  className = "",
  alt = "פרופסור פאראדיי",
}: FaradayAvatarProps) {
  const [failed, setFailed] = useState(false);
  const asset = pickAsset(px);

  if (failed) {
    return <Bot size={Math.round(px * 0.6)} className={`text-primary ${className}`} />;
  }

  return (
    <img
      src={`/faraday${asset}.png`}
      alt={alt}
      width={fill ? undefined : px}
      height={fill ? undefined : px}
      draggable={false}
      onError={() => setFailed(true)}
      className={`rounded-full select-none pointer-events-none ${fill ? "w-full h-full" : ""} ${className}`}
      style={{
        objectFit: fit,
        filter: glow ? "drop-shadow(0 0 8px var(--color-inverse-primary))" : undefined,
      }}
    />
  );
}
