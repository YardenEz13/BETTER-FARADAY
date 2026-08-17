import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import FaradayAvatar from "./FaradayAvatar";
import { SparkBurst } from "./electric";
import { spark as playSpark } from "../lib/sfx";

/**
 * Professor Faraday pops into the bottom-start corner with a clay speech
 * bubble and a short Hebrew one-liner reacting to the student's answer,
 * then auto-dismisses after ~3s.
 *
 * Purely a personality flourish — driven entirely by props, no side effects
 * beyond the auto-dismiss timer. Springs in via framer-motion; falls back to
 * a plain fade when the user prefers reduced motion.
 */
export type FaradayReactionKind = "correct" | "wrong" | "streak" | "levelup" | "homework";

export interface FaradayReactionProps {
  kind: FaradayReactionKind;
  visible: boolean;
  onDone: () => void;
  /** current consecutive-correct count — woven into the streak line */
  streakCount?: number;
  /** new level 1–5 — woven into the level-up line */
  level?: number;
}

/** Level names as the schema documents them (students.level, 1–5). */
const LEVEL_NAMES = ["מתחיל", "חוקר", "מתקדם", "מומחה", "מאסטר"];

const CORRECT_LINES = [
  "מצוין! הזרם זורם!",
  "כמו מעגל סגור — מושלם!",
  "יש כאן מוליכות גבוהה למתמטיקה!",
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
    `${count} ברצף — הסוללה טעונה במלואה!`,
    `וואו, ${count} נכונות ברצף! זרם מקסימלי!`,
    `${count} ברצף! המעגל לוהט 🔥`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

const HOMEWORK_LINES = [
  "כל שיעורי הבית הושלמו — מעגל סגור!",
  "כל המשימות הושלמו. עבודה מדויקת!",
  "שיעורי הבית מאחור. אפשר לנשום ⚡",
];

/** level-up lines name the tier the student just reached */
function levelUpLine(level: number): string {
  const name = LEVEL_NAMES[Math.min(Math.max(level, 1), 5) - 1];
  const pool = [
    `עלייה ברמה! מהיום הדרגה היא ${name} ⚡`,
    `רמה חדשה נפתחה — ${name}!`,
    `הפוטנציאל עלה: ${name}. כל הכבוד!`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickLine(kind: FaradayReactionKind, streakCount?: number, level?: number): string {
  if (kind === "streak") return streakLine(streakCount ?? 3);
  if (kind === "levelup") return levelUpLine(level ?? 2);
  const pool =
    kind === "homework" ? HOMEWORK_LINES : kind === "correct" ? CORRECT_LINES : WRONG_LINES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function FaradayReaction({ kind, visible, onDone, streakCount, level }: FaradayReactionProps) {
  const reduced = !!useReducedMotion();
  // Freeze the chosen line for the lifetime of a single appearance so it doesn't
  // re-randomize on unrelated re-renders while the bubble is on screen.
  // `visible` is a deliberate dep: it re-rolls the line on each new appearance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const line = useMemo(() => pickLine(kind, streakCount, level), [kind, streakCount, level, visible]);

  // The dismiss timer must not depend on `onDone`'s identity. Callers pass an
  // inline arrow, so it is a new function on every parent render — and
  // PracticeSession re-renders once a second for its elapsed-time clock. With
  // `onDone` in the dep list the effect tore down and restarted the timer every
  // second, so it never fired and the bubble stayed on screen forever.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    if (!visible) return;
    // Sound on milestones only — a chime on every correct answer is a chime
    // every ten seconds. sfx is a no-op when muted or WebAudio is unavailable.
    if (kind === "levelup" || kind === "homework") playSpark();
    // Milestones earn a longer beat than a per-answer reaction.
    const ms = kind === "levelup" || kind === "homework" ? 4500 : 3000;
    const t = setTimeout(() => onDoneRef.current(), ms);
    return () => clearTimeout(t);
  }, [visible, kind, streakCount, level]);

  const accent =
    kind === "wrong"
      ? "var(--color-secondary)"
      : kind === "streak" || kind === "levelup"
      ? "var(--color-tertiary)"
      : "var(--color-primary)";

  // A miss stays gentle: sparks and a bouncy overshoot would read as taunting.
  const celebratory = kind !== "wrong";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          // Keyed by what is being announced, so a reaction arriving while
          // another is still on screen exits and re-enters instead of silently
          // swapping its text. Without this, wrong -> correct just mutates the
          // bubble in place: no spring, no squash, and it reads as "nothing
          // happened" to the student who just recovered.
          key={`${kind}-${streakCount ?? ""}-${level ?? ""}`}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 70, scale: 0.6, rotate: celebratory ? -7 : 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.85 }}
          transition={
            reduced
              ? { duration: 0.2 }
              // Lower damping on a win so it overshoots and settles — that
              // wobble is what reads as "animated" rather than "appeared".
              : { type: "spring", stiffness: 420, damping: celebratory ? 13 : 20 }
          }
          className="fixed bottom-5 inset-x-3 sm:inset-x-auto sm:start-5 z-[95] sm:max-w-[20rem] flex items-end gap-2.5 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          {/* Avatar. Deliberately not overflow-hidden: the celebrate and streak
              poses throw arms and sparks past the ring, and clipping them to the
              circle flattens the pose. */}
          <div
            className={`relative w-12 h-12 rounded-full bg-surface flex items-center justify-center flex-shrink-0 ${reduced ? "" : "faraday-land"}`}
            style={{ border: `2px solid ${accent}`, boxShadow: "var(--shadow-clay)" }}
          >
            {/* Rays firing off the avatar on a win. Rendered behind him via a
                negative z-index so the burst does not wash out his face. */}
            {celebratory && !reduced && (
              <span className="absolute inset-0 scale-[1.7]" style={{ zIndex: -1 }}>
                <SparkBurst rays={kind === "correct" ? 8 : 12} />
              </span>
            )}
            {/* Level-up gets the 12-frame celebration; everything else is a
                still. Reduced motion falls back to the static pose, since a
                sprite frozen on frame one reads as a mistake, not a moment. */}
            {kind === "levelup" && !reduced ? (
              <span className="faraday-sprite" role="img" aria-label="פרופסור פאראדיי חוגג" />
            ) : (
              <FaradayAvatar
                pose={kind === "wrong" ? "wrong" : kind === "streak" || kind === "levelup" ? "streak" : "happy"}
                px={44}
                fill
              />
            )}
          </div>

          {/* Speech bubble — clay card with a tail pointing toward the avatar.
              Pops a beat after the avatar lands, so he arrives and *then*
              speaks instead of the whole thing sliding in as one slab. */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.7, originX: 0 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={reduced ? undefined : { type: "spring", stiffness: 500, damping: 16, delay: 0.09 }}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
