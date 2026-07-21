import { useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import FaradayAvatar from "./FaradayAvatar";

/**
 * Professor Faraday pops into the bottom-start corner with a clay speech
 * bubble and a short Hebrew one-liner reacting to the student's answer,
 * then auto-dismisses after ~3s.
 *
 * Purely a personality flourish — driven entirely by props, no side effects
 * beyond the auto-dismiss timer. Springs in via framer-motion; falls back to
 * a plain fade when the user prefers reduced motion.
 */
export type FaradayReactionKind = "correct" | "wrong" | "streak";

export interface FaradayReactionProps {
  kind: FaradayReactionKind;
  visible: boolean;
  onDone: () => void;
  /** current consecutive-correct count — woven into the streak line */
  streakCount?: number;
}

const CORRECT_LINES = [
  "מצוין! הזרם זורם!",
  "כמו מעגל סגור — מושלם!",
  "יש לך מוליכות גבוהה למתמטיקה!",
  "בול בפוטנציאל! כל הכבוד.",
  "התשובה הזו מוארת כמו נורה!",
];

const WRONG_LINES = [
  "גם פאראדיי טעה אלף פעמים לפני שהצליח.",
  "כל טעות היא ניצוץ ללמידה — ננסה שוב.",
  "המעגל עוד לא סגור, אבל אנחנו קרובים.",
  "אל דאגה, גם התנגדות היא חלק מהמסלול.",
  "טעות קטנה, לא קצר חשמלי — ממשיכים!",
];

/** streak lines include the running count for extra energy */
function streakLine(count: number): string {
  const pool = [
    `רצף של ${count}! האנרגיה מזנקת ⚡`,
    `${count} ברצף — אתה טעון במלואך!`,
    `וואו, ${count} נכונות ברצף! זרם מקסימלי!`,
    `${count} ברצף! המעגל שלך לוהט 🔥`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickLine(kind: FaradayReactionKind, streakCount?: number): string {
  if (kind === "streak") return streakLine(streakCount ?? 3);
  const pool = kind === "correct" ? CORRECT_LINES : WRONG_LINES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function FaradayReaction({ kind, visible, onDone, streakCount }: FaradayReactionProps) {
  const reduced = !!useReducedMotion();
  // Freeze the chosen line for the lifetime of a single appearance so it doesn't
  // re-randomize on unrelated re-renders while the bubble is on screen.
  // `visible` is a deliberate dep: it re-rolls the line on each new appearance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const line = useMemo(() => pickLine(kind, streakCount), [kind, streakCount, visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [visible, kind, streakCount, onDone]);

  const accent =
    kind === "wrong"
      ? "var(--color-secondary)"
      : kind === "streak"
      ? "var(--color-tertiary)"
      : "var(--color-primary)";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.7 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.85 }}
          transition={
            reduced
              ? { duration: 0.2 }
              : { type: "spring", stiffness: 340, damping: 20 }
          }
          className="fixed bottom-5 inset-x-3 sm:inset-x-auto sm:start-5 z-[95] sm:max-w-[20rem] flex items-end gap-2.5 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-full bg-surface flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ border: `2px solid ${accent}`, boxShadow: "var(--shadow-clay)" }}
          >
            <FaradayAvatar px={44} fill />
          </div>

          {/* Speech bubble — clay card with a tail pointing toward the avatar */}
          <div
            className="relative rounded-2xl bg-surface px-4 py-3"
            style={{ border: `2px solid ${accent}`, boxShadow: "var(--shadow-clay)" }}
          >
            {/* tail toward the avatar (start side) */}
            <span
              aria-hidden
              className="absolute bottom-3 w-2.5 h-2.5 rotate-45 bg-surface"
              style={{
                insetInlineStart: -6,
                borderInlineStart: `2px solid ${accent}`,
                borderBlockEnd: `2px solid ${accent}`,
              }}
            />
            <p className="text-sm font-semibold leading-snug text-on-surface">
              {line}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
