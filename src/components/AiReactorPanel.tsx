import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Magnet, FieldLines, Resistor, Capacitor, Inductor, Pendulum,
  TrendingUp, ThumbsUp, AlertTriangle,
} from "./electric";
import { Sparkline } from "./commandCenter";
import { Skeleton } from "./ui";
import MathText from "./MathText";
import { errorMessage } from "../lib/errors";

/**
 * Teacher-facing control + meter for the Faraday AI tutor, living in the
 * "דופק הכיתה" view.
 *
 * Three things the backend already tracked but nobody could see:
 *  · the kill-switch flag (convex/aiGate.ts) the Gemini proxy reads on every
 *    request — until now only flippable from the CLI;
 *  · the per-day usage rollup (convex/aiUsage.ts), whose own doc comment
 *    promised "the teacher dashboard reads a 7-day window";
 *  · which questions the class actually fails most (attempts.ts).
 */
export default function AiReactorPanel() {
  const aiEnabled = useQuery(api.aiGate.getAiEnabled);
  const usage = useQuery(api.aiUsage.getUsageSummary);
  const failureRates = useQuery(api.attempts.getQuestionFailureRates);
  const setAiEnabled = useMutation(api.aiGate.setAiEnabled);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleAi = async () => {
    if (busy || aiEnabled === undefined) return;
    setBusy(true);
    setErr(null);
    try {
      await setAiEnabled({ enabled: !aiEnabled });
    } catch (e) {
      setErr(errorMessage(e, "שינוי מצב ה-AI נכשל. נסו שוב."));
    } finally {
      setBusy(false);
    }
  };

  const today = usage?.today;
  const totalTokens = (today?.promptTokens ?? 0) + (today?.outputTokens ?? 0);
  // Only questions with a real sample behind them; a single wrong attempt is
  // a 100% failure rate and would crowd out genuinely hard questions.
  const hardest = (failureRates ?? []).filter((q) => q.attempts >= 5).slice(0, 5);

  return (
    <div className="clay-card mt-4.5 p-[22px]">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="w-10 h-10 rounded-2xl bg-secondary/10 border-2 border-secondary/25 flex items-center justify-center flex-shrink-0 text-secondary">
          <Magnet size={20} tone="violet" glow={0.6} />
        </span>
        <div className="flex-1 min-w-[180px]">
          <div className="font-display font-extrabold text-[16px] text-on-surface">ריאקטור פאראדיי</div>
          <p className="text-[12px] text-on-surface-variant m-0">צריכת ה-AI של הכיתה ומתג ההפעלה הראשי.</p>
        </div>

        {/* kill switch */}
        <button
          onClick={toggleAi}
          disabled={busy || aiEnabled === undefined}
          role="switch"
          aria-checked={aiEnabled === true}
          aria-label="הפעלת מורה ה-AI"
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-full border-2 font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
          style={{
            borderColor: aiEnabled ? "var(--color-primary)" : "color-mix(in srgb, var(--color-error) 45%, var(--color-outline))",
            color: aiEnabled ? "var(--color-primary)" : "var(--color-error)",
            boxShadow: "var(--shadow-clay)",
          }}
        >
          <span
            className={aiEnabled ? "charge-drift" : ""}
            style={{
              width: 9, height: 9, borderRadius: "50%",
              background: aiEnabled ? "var(--color-primary)" : "var(--color-error)",
              boxShadow: `0 0 8px ${aiEnabled ? "var(--color-primary)" : "var(--color-error)"}`,
            }}
          />
          {aiEnabled === undefined ? "טוען…" : busy ? "מעדכן…" : aiEnabled ? "פאראדיי פעיל" : "פאראדיי כבוי"}
        </button>
      </div>

      {err && (
        <div role="alert" className="flex items-center gap-2 text-xs font-semibold px-3 py-2 mb-3 rounded-xl border-2"
          style={{ borderColor: "var(--color-error)", color: "var(--color-error)", background: "color-mix(in srgb, var(--color-error) 8%, transparent)" }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {aiEnabled === false && (
        <p className="text-[12.5px] text-on-surface-variant mb-3.5">
          התלמידים מקבלים כרגע הודעת «פאראדיי נח» במקום תשובה. הדף עצמו ממשיך לעבוד כרגיל.
        </p>
      )}

      {/* today's meters */}
      {usage === undefined ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={78} rounded={16} />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Meter icon={<FieldLines size={17} glow={0.5} animated={false} />} label="בקשות היום" value={today?.requests ?? 0} tone="var(--color-primary)" />
            <Meter
              icon={today && today.errors > 0
                ? <Resistor size={17} tone="danger" glow={0.5} animated={false} />
                : <ThumbsUp size={17} glow={0.5} animated={false} />}
              label="שגיאות היום"
              value={today?.errors ?? 0}
              tone={today && today.errors > 0 ? "var(--color-error)" : "var(--color-primary)"}
            />
            <Meter icon={<Capacitor size={17} tone="amber" glow={0.5} animated={false} />} label="טוקנים היום" value={totalTokens} tone="var(--color-tertiary)" />
            <Meter
              icon={<TrendingUp size={17} tone="violet" glow={0.5} animated={false} />}
              label="7 ימים אחרונים"
              value={usage.daily.reduce((s, d) => s + d.requests, 0)}
              tone="var(--color-secondary)"
              chart={<Sparkline values={usage.daily.map((d) => d.requests)} color="var(--color-secondary)" width={72} height={24} />}
            />
          </div>

          {/* per-task split for today */}
          {usage.byTaskToday.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3.5">
              {usage.byTaskToday.map((t) => (
                <span key={t.task} className="stat-chip cursor-default">
                  <Inductor size={14} glow={0.4} animated={false} />
                  {t.task} · <span className="num">{t.requests}</span>
                  {t.errors > 0 && <span className="num text-error">({t.errors} שגיאות)</span>}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* hardest questions */}
      <div className="mt-5 pt-4 border-t-2 border-outline">
        <div className="flex items-center gap-2 mb-3">
          <Pendulum size={17} tone="amber" glow={0.5} animated={false} />
          <span className="font-display font-extrabold text-[15px] text-on-surface">השאלות שמפילות הכי הרבה</span>
        </div>
        {failureRates === undefined ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={38} rounded={12} />)}
          </div>
        ) : hardest.length === 0 ? (
          <p className="text-[12.5px] text-on-surface-variant m-0">אין עדיין מספיק נסיונות כדי לזהות שאלות בעייתיות.</p>
        ) : (
          <ol className="flex flex-col gap-2 m-0 p-0 list-none">
            {hardest.map((q) => {
              const pct = Math.round(q.failureRate * 100);
              return (
                <li key={q.questionId} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-container-low border-2 border-outline">
                  <span className="num font-extrabold text-[15px] flex-shrink-0 w-11 text-center"
                    style={{ color: pct >= 70 ? "var(--color-error)" : "var(--color-tertiary)" }}>
                    {pct}%
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[12.5px] text-on-surface">
                    <MathText>{q.stem}</MathText>
                  </span>
                  <span className="num text-[11px] text-on-surface-variant flex-shrink-0">{q.attempts} נסיונות</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Meter({ icon, label, value, tone, chart }: {
  icon: React.ReactNode; label: string; value: number; tone: string; chart?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low border-2 border-outline p-3.5 flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wide text-on-surface-variant" style={{ color: tone }}>
        {icon} {label}
      </span>
      <div className="flex items-end justify-between gap-2">
        <span className="num font-extrabold text-[24px] leading-none text-on-surface">{value.toLocaleString()}</span>
        {chart}
      </div>
    </div>
  );
}
