import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import FaradayAvatar, { type FaradayAvatarProps } from "./FaradayAvatar";
import { ElectricAtom, SparkBurst } from "./electric";

/**
 * Wraps {@link FaradayAvatar} with a lightweight "mood" overlay so the tutor
 * portrait feels alive in chat — no new image assets, just token-driven
 * electric effects layered over the existing PNG.
 *
 *   idle     — plain portrait.
 *   thinking — slow pulsing violet glow ring + a tiny electron orbiting the rim.
 *   happy    — a brief green glow flash + a one-shot SparkBurst.
 *
 * All motion is gated on useReducedMotion; the static portrait always shows.
 */
export type FaradayMood = "idle" | "thinking" | "happy";

export interface FaradayMoodAvatarProps extends FaradayAvatarProps {
  mood?: FaradayMood;
}

export default function FaradayMoodAvatar({ mood = "idle", px = 40, fill, ...avatarProps }: FaradayMoodAvatarProps) {
  const reduced = !!useReducedMotion();

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <FaradayAvatar px={px} fill={fill} {...avatarProps} />

      {/* thinking — pulsing violet ring + orbiting electron */}
      <AnimatePresence>
        {mood === "thinking" && (
          <motion.span
            key="thinking"
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid var(--color-secondary)",
                boxShadow: "0 0 10px color-mix(in srgb, var(--color-secondary) 60%, transparent)",
              }}
              animate={
                reduced
                  ? { opacity: 0.6 }
                  : { opacity: [0.25, 0.8, 0.25], scale: [1, 1.08, 1] }
              }
              transition={reduced ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            {!reduced && (
              <motion.span
                className="absolute top-1/2 left-1/2"
                style={{ width: 0, height: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              >
                <span
                  className="absolute"
                  style={{ insetInlineStart: -6, top: -(px / 2 + 3) }}
                >
                  <ElectricAtom size={12} tone="violet" glow={1} />
                </span>
              </motion.span>
            )}
          </motion.span>
        )}
      </AnimatePresence>

      {/* happy — green glow flash + one-shot spark burst */}
      <AnimatePresence>
        {mood === "happy" && (
          <motion.span
            key="happy"
            aria-hidden
            className="absolute inset-0 pointer-events-none rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: reduced ? 0.7 : [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.3 : 0.7, ease: "easeOut" }}
            style={{
              boxShadow: "0 0 16px 4px color-mix(in srgb, var(--color-inverse-primary) 70%, transparent)",
              border: "2px solid var(--color-primary)",
            }}
          >
            {!reduced && (
              <span className="absolute inset-0 scale-[1.6]">
                <SparkBurst rays={10} />
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
