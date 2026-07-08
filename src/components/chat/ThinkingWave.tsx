import { motion, useReducedMotion } from "framer-motion";

/* ── "Faraday is thinking" — a live voltage signal reading on an oscilloscope ── */
export default function ThinkingWave() {
  const reducedMotion = useReducedMotion();
  const bars = [0, 1, 2, 3, 4];
  if (reducedMotion) {
    return (
      <div className="flex items-end gap-1 h-5" aria-hidden>
        {bars.map(i => (
          <span
            key={i}
            className="w-1 rounded-full bg-primary"
            style={{ height: i % 2 ? '100%' : '55%' }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1 h-5" aria-hidden>
      {bars.map(i => (
        <motion.span
          key={i}
          className="w-1 h-5 rounded-full bg-primary origin-bottom"
          style={{ boxShadow: '0 0 6px var(--color-inverse-primary)' }}
          animate={{ scaleY: [0.3, 1, 0.3] }}
          transition={{ duration: 0.7, delay: i * 0.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
