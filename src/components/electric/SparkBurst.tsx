import { motion } from "framer-motion";

/**
 * Electric spark discharge — a flash ring plus radiating rays, fired on a
 * correct answer as an on-brand "charge burst". Follows the electric family's
 * conventions: token-driven colors (--color-primary / --color-inverse-primary),
 * no hardcoded hex, purely decorative (aria-hidden, pointer-events:none).
 *
 * Callers must gate on useReducedMotion — this component always animates.
 */
export interface SparkBurstProps {
  /** number of radiating rays (default 12) */
  rays?: number;
}

export default function SparkBurst({ rays = 12 }: SparkBurstProps) {
  const spokes = Array.from({ length: rays });
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
      <div className="relative">
        {/* flash ring */}
        <motion.div
          initial={{ scale: 0, opacity: 0.7 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
        />
        {/* rays */}
        {spokes.map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `rotate(${(i / spokes.length) * 360}deg)` }}
          >
            <motion.div
              initial={{ scaleY: 0, opacity: 0, y: 0 }}
              animate={{ scaleY: 1, opacity: [0, 1, 0], y: -52 }}
              transition={{ duration: 0.55, delay: i * 0.012, ease: "easeOut" }}
              style={{
                width: 3,
                height: 30,
                borderRadius: 9999,
                transformOrigin: "center",
                background: "var(--color-inverse-primary)",
                boxShadow: "0 0 8px var(--color-inverse-primary)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
