import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Unified route-transition wrapper. Each routed page slides + fades in with a
 * subtle clay motion (~12px y-offset, ~0.25s easeOut). Respects reduced-motion:
 * transforms are dropped and it degrades to a plain opacity crossfade.
 *
 * Meant to be keyed by location + rendered inside <AnimatePresence mode="wait">
 * so the exiting page finishes before the next one mounts.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const reduced = !!useReducedMotion();

  const variants = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -12 },
      };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: reduced ? 0.15 : 0.25, ease: "easeOut" }}
      style={{ minHeight: "100%" }}
    >
      {children}
    </motion.div>
  );
}
