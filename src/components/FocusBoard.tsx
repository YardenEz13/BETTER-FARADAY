import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Check, Play, BookOpen, RotateCcw } from "./electric";
import { ProgressBar } from "./ui";

/**
 * FocusBoard — the student home screen in focus mode.
 *
 * The default home is a serpentine learning map over a live field backdrop,
 * ringed by a shop, a league, a streak, achievements, a daily experiment and
 * two alert banners. Every one of those is a decision the student has to
 * decline before they start working.
 *
 * This is the same information with the decisions removed: what to do now, how
 * far through the day they are, and the plain list of topics underneath. One
 * primary button, one column, no motion.
 */

export interface FocusTopic {
  id: string;
  nameHe: string;
  progress: number;
  isCompleted: boolean;
  isActive: boolean;
}

interface FocusBoardProps {
  studentId: Id<"students">;
  topics: FocusTopic[];
  reviewCount: number;
  onOpenTopic: (topicId: string) => void;
  onHomework: () => void;
  onReview: () => void;
}

export default function FocusBoard({
  studentId, topics, reviewCount, onOpenTopic, onHomework, onReview,
}: FocusBoardProps) {
  const daily = useQuery(api.goals.getDailyProgress, { studentId });

  // The one thing to do now: the topic in progress, else the first unfinished
  // one, else the last (everything is done — going back over it is still work).
  const current = topics.find(t => t.isActive) ?? topics.find(t => !t.isCompleted) ?? topics[topics.length - 1];
  const goal = daily?.goal ?? 10;
  const answered = daily?.answeredToday ?? 0;
  const goalPct = Math.min(Math.round((answered / Math.max(goal, 1)) * 100), 100);

  return (
    /* max-w-[34rem], not max-w-xl: this project's @theme redefines --spacing-xl
       to 64px, and the sizing scale resolves the named step from it — max-w-xl
       here is a 64px column, not 36rem. */
    <div className="w-full max-w-[34rem] mx-auto flex flex-col gap-5">

      {/* ── The one next action ── */}
      {current && (
        <section className="clay-card p-6 flex flex-col gap-4">
          <div>
            <div className="text-label-lg text-on-surface-variant">המשימה שלך עכשיו</div>
            <h1 className="font-bold text-headline-lg text-on-surface mt-1">{current.nameHe}</h1>
          </div>
          {current.progress > 0 && (
            <ProgressBar value={current.progress} variant="primary" size="sm" label={`${current.progress}% מהנושא`} />
          )}
          <button
            className="btn-clay-primary w-full py-4 text-body-lg"
            onClick={() => onOpenTopic(current.id)}
          >
            <Play size={18} className="fill-current" />
            התחלת תרגול
          </button>
        </section>
      )}

      {/* ── Today, as one line ── */}
      <section className="clay-card p-5 flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-body-md text-on-surface">היום</span>
          {/* dir="ltr": bidi reorders "4 / 10" to "10 / 4" inside the RTL
              paragraph, which reads as the wrong way round. */}
          <span dir="ltr" className="num font-bold text-body-md text-primary">{answered} / {goal}</span>
        </div>
        <ProgressBar value={goalPct} variant="primary" size="sm" label="שאלות שנפתרו היום" />
      </section>

      {/* ── Every topic, as a plain list ── */}
      <section className="clay-card p-2">
        <ul>
          {topics.map((topic) => (
            <li key={topic.id}>
              <button
                onClick={() => onOpenTopic(topic.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-start hover:bg-surface-container cursor-pointer ${
                  topic.isActive ? "bg-primary/8" : ""
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                    topic.isCompleted
                      ? "bg-primary border-primary text-on-primary"
                      : topic.isActive
                        ? "border-primary text-primary"
                        : "border-outline text-on-surface-variant"
                  }`}
                >
                  {topic.isCompleted ? <Check size={14} strokeWidth={3} /> : <Play size={12} className="fill-current" />}
                </span>
                <span className={`flex-1 font-semibold text-body-md ${topic.isActive ? "text-primary" : "text-on-surface"}`}>
                  {topic.nameHe}
                </span>
                {topic.progress > 0 && (
                  <span className="num text-body-sm text-on-surface-variant">{topic.progress}%</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Everything else, demoted to two quiet links ── */}
      <div className="flex flex-wrap gap-3">
        <button className="btn-clay-ghost px-4 py-2.5 text-body-md" onClick={onHomework}>
          <BookOpen size={16} />
          שיעורי בית
        </button>
        {reviewCount > 0 && (
          <button className="btn-clay-ghost px-4 py-2.5 text-body-md" onClick={onReview}>
            <RotateCcw size={16} />
            חזרה על טעויות
            <span className="num font-bold text-on-surface-variant">{reviewCount}</span>
          </button>
        )}
      </div>

      <p className="text-body-sm text-on-surface-variant text-center">
        מצב מיקוד פעיל — המפה, החנות והליגה מחכות בכפתור המיקוד למעלה.
      </p>
    </div>
  );
}
