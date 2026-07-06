import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Unified route-transition wrapper. Each routed page slides + fades in with a
 * subtle clay motion (~12px y-offset, ~0.25s easeOut). Respects reduced-motion:
 * transforms are dropped and it degrades to a plain opacity fade.
 *
 * Enter-only by design: exit animations (AnimatePresence mode="wait") deadlock
 * with lazy routes + Suspense — the outgoing page never finishes its exit and
 * the new route never mounts. Keyed by location, this remounts and slides the
 * incoming page in instead, which is just as smooth without the hang.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const reduced = !!useReducedMotion();

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.25, ease: "easeOut" }}
      style={{ minHeight: "100%" }}
    >
      {children}
    </motion.div>
  );
}
