import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import FaradayAvatar from "./FaradayAvatar";
import { CircuitNode, ElectricBolt, Check } from "./electric";

export interface DailyExperimentTopic {
  _id: string;
  nameHe: string;
}

export interface DailyExperimentProps {
  /** Topics the student has unlocked — the pool the "question of the day" is drawn from. */
  topics: DailyExperimentTopic[];
  /** Navigate to a topic's practice route. Reuses the page's existing navigate call. */
  onStart: (topicId: string) => void;
}

/** yyyy-mm-dd in the local timezone — the deterministic seed for the day. */
function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Small stable string hash (djb2) → non-negative int, so the same date always
 *  maps to the same topic without any backend state. */
function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * הניסוי היומי — a featured daily challenge card on the student home. Picks a
 * deterministic "topic of the day" client-side (date hash → index into the
 * unlocked topics) and deep-links into its practice route. Frontend-only: the
 * "done for today" flag lives in localStorage under
 * `faraday_daily_done_<yyyy-mm-dd>`, so once the CTA is tapped the card settles
 * into a quieter completed state for the rest of the day.
 */
export default function DailyExperiment({ topics, onStart }: DailyExperimentProps) {
  const reducedMotion = !!useReducedMotion();
  const dateKey = todayKey();
  const storageKey = `faraday_daily_done_${dateKey}`;

  const [done, setDone] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (topics.length === 0) return null;

  const topic = topics[hashString(dateKey) % topics.length];

  const handleStart = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* private mode / storage disabled — the deep-link still works */
    }
    setDone(true);
    onStart(topic._id);
  };

  const eyebrow = (
    <div className="label-mono text-[10px] text-primary/80 mb-2">
      הניסוי היומי · DAILY EXPERIMENT
    </div>
  );

  if (done) {
    // Quieter "completed" state — dimmed, a check + electric bolt confirm it.
    return (
      <div className="clay-card circuit-grid relative overflow-hidden w-full max-w-4xl mb-8 p-5">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-primary/12 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
            <Check size={20} strokeWidth={3} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {eyebrow}
            <p className="font-bold text-on-surface text-sm leading-snug">
              הניסוי של היום הושלם — {topic.nameHe} ✓
            </p>
            <p className="font-medium text-on-surface-variant text-xs mt-0.5">
              נתראה מחר לניסוי הבא
            </p>
          </div>
          <ElectricBolt tone="spark" size={22} glow={0.5} animated={!reducedMotion} />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="clay-card circuit-grid relative overflow-hidden w-full max-w-4xl mb-8 p-6"
    >
      {/* Electric flourish — an animated circuit node charging in the far corner */}
      <div className="absolute -top-3 left-4 opacity-70 pointer-events-none" aria-hidden>
        <CircuitNode size={46} tone="spark" glow={0.7} animated={!reducedMotion} />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Faraday avatar */}
        <div className="w-16 h-16 rounded-full bg-surface border-2 border-primary/40 flex items-center justify-center flex-shrink-0 shadow-(--shadow-clay)">
          <FaradayAvatar px={56} glow />
        </div>

        <div className="flex-1 min-w-0">
          {eyebrow}
          <p className="font-medium text-on-surface-variant text-sm leading-snug">
            פרופסור פאראדיי מזמין אותך לניסוי של היום
          </p>
          <h3 className="font-bold text-xl text-on-surface mt-1 flex items-center gap-2">
            <ElectricBolt tone="spark" size={18} glow={0.5} animated={false} />
            {topic.nameHe}
          </h3>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="btn-clay-primary flex-shrink-0 w-full sm:w-auto"
        >
          <ElectricBolt tone="ghost" size={16} glow={0.6} animated={false} />
          יאללה, מתחילים
        </button>
      </div>
    </motion.div>
  );
}
