import { Component, useState, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import CyberAvatar from "../components/CyberAvatar";
import MathText from "../components/MathText";
import { ClayCard, ClayButton, Badge, Chip, ProgressBar, SegTabs } from "../components/ui";
import { ArrowLeft, Clock, Sparkles, Check, Users } from "../components/electric";
import { errorMessage } from "../lib/errors";
import { studentCount } from "../lib/hebrew";

/**
 * Chat Analysis · teacher view.
 *
 * The design brief for this screen (Chat Analysis - Teacher View.dc.html, turn 4)
 * is "analysis you can check, not just read": every claim in the verdict is a
 * button that jumps to the round it came from, and the screen refuses to
 * invent a verdict it cannot evidence. Three states, all real:
 *
 *  - full   — a verdict backed by rounds, plus the class picture and prep rail
 *  - thin   — too little conversation to conclude anything ("אין מספיק נתונים")
 *  - hunch  — a low-confidence read, labelled השערה, with how to verify it
 *
 * Mobile collapses the two columns into three tabs (פסק־דין / סבבים / הכנה).
 */

const AGENT_LABEL: Record<string, string> = { practice: "שיחת תרגול", homework: "שיעורי בית" };

/** A round the teacher reads: one exchange — the student's message and Faraday's
 *  reply — with its own independence score. `partialBriefs` is the complete
 *  list (the brief builder splits the live session into exchanges). */
interface Round {
  index: number;
  summary: string;
  autonomy: number;
  messageCount: number;
}

function formatDuration(startedAt: number, endedAt?: number) {
  if (!endedAt) return "בשיחה כעת";
  const mins = Math.max(1, Math.round((endedAt - startedAt) / 60000));
  return `${mins} דק׳`;
}

/** Cumulative mm:ss window for a round, from the per-round durations. */
function roundWindow(rounds: { durationMs: number }[], i: number) {
  const mmss = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const before = rounds.slice(0, i).reduce((s, r) => s + r.durationMs, 0);
  return `${mmss(before)}–${mmss(before + rounds[i].durationMs)}`;
}

/** Independence as five dots — the shape of the conversation at a glance. */
function AutonomyDots({ value, tone }: { value: number; tone: "primary" | "tertiary" | "error" }) {
  const on =
    tone === "error" ? "var(--color-error)"
    : tone === "tertiary" ? "var(--color-tertiary)"
    : "var(--color-primary)";
  return (
    <div className="flex gap-1" role="img" aria-label={`עצמאות ${value} מתוך 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="w-[11px] h-[11px] rounded-full"
          style={{ background: n <= value ? on : "var(--color-outline-variant)" }}
        />
      ))}
    </div>
  );
}

function toneFor(autonomy: number): "primary" | "tertiary" | "error" {
  if (autonomy <= 1) return "error";
  if (autonomy <= 2) return "tertiary";
  return "primary";
}

/**
 * Renders nothing if its subtree throws. This app deploys its frontend
 * (Vercel) and its backend (Convex) separately, so a build can reach users
 * before the query it calls exists — and useQuery throws during render, which
 * would take the whole analysis screen down over an optional panel.
 */
class OptionalPanel extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[ChatAnalysisView] class picture unavailable:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Class picture: is this gap the student's, or the lesson's? Owns its own
 *  query so a backend that predates it can only cost this one panel. */
function ClassGapPanel({ chatId }: { chatId: string }) {
  const picture = useQuery(api.sessionBriefs.getClassGapPicture, { chatId: chatId as Id<"aiChats"> });
  if (!picture || picture.concepts.length === 0) return null;

  return (
    <ClayCard padding="lg" className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-extrabold text-base md:text-lg text-on-surface">תמונת כיתה — אותו מושג</h3>
        <span className="text-xs md:text-sm text-on-surface-variant">מתוך השבוע האחרון</span>
      </div>

      <div
        className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
        style={{ background: "var(--color-error-container)" }}
      >
        <div className="flex shrink-0">
          {picture.classmates.slice(0, 4).map((name: string, i: number) => (
            <span key={i} style={{ marginInlineStart: i === 0 ? 0 : -10 }}>
              <CyberAvatar name={name} size={34} />
            </span>
          ))}
        </div>
        <p
          className="text-sm md:text-base font-bold leading-snug text-pretty"
          style={{ color: "var(--color-on-error-container)" }}
        >
          {studentCount(picture.total)} {picture.total === 1 ? "נשבר" : "נשברו"} על <b>{picture.concepts[0].concept}</b> — זה לא פער אישי, זה פער כיתתי.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {picture.concepts.slice(0, 4).map((c) => (
          <span key={c.concept} className="stat-chip cursor-default">
            <Users size={13} /> {c.concept} · {studentCount(c.count)}
          </span>
        ))}
      </div>
    </ClayCard>
  );
}

interface ChatAnalysisViewProps {
  chat: any;
  onBack: () => void;
}

export function ChatAnalysisView({ chat, onBack }: ChatAnalysisViewProps) {
  const messages = useQuery(api.aiChat.getChatMessages, { chatId: chat._id });
  const brief = useQuery(api.sessionBriefs.getBriefForChat, { chatId: chat._id });
  const createHomework = useMutation(api.homework.createHomework);

  const [focusedRound, setFocusedRound] = useState<number | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [mobileTab, setMobileTab] = useState<"verdict" | "rounds" | "prep">("verdict");
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const metrics = chat.metrics;

  const rounds: Round[] = (brief?.partialBriefs ?? []).map((p: any, i: number) => ({
    index: i,
    summary: p.summary,
    // Briefs written before per-round autonomy existed fall back to the
    // conversation-wide level, so old rows still render a sensible column.
    autonomy: p.autonomyLevel ?? brief?.autonomyLevel ?? 3,
    messageCount: p.messageCount,
  }));

  const conclusion: string | undefined = brief?.keyInsight ?? metrics?.gemmaAnalysisSummary;
  const knowledgeGaps: string[] =
    (brief?.missingConcepts?.length ? brief.missingConcepts : metrics?.missingKnowledge) ?? [];
  const nextStep: string | undefined = brief?.recommendedAction ?? metrics?.teacherActionItem;
  const talkingPoints: string[] = brief?.nextSteps ?? [];
  const selfAssessment: string | undefined = brief?.selfAssessment?.trim() || undefined;
  const quote: string | undefined = selfAssessment ?? brief?.studentQuotes?.[0];

  // Confidence is what licenses the verdict's tone. It is *evidence* volume,
  // not the AI's self-report: a two-message exchange cannot be high-confidence
  // however sure the model sounds. A round is one exchange, so round count and
  // message count are the same evidence — counting both would double it.
  const userMessageCount = (messages ?? []).filter((m: any) => m.role === "user").length;
  const confidence = Math.round((Math.min(userMessageCount, 8) / 8) * 100);
  // "Thin" = nothing worth concluding from. "Hunch" = a read, but one round of
  // evidence behind it, so it ships labelled as a guess rather than a verdict.
  const state: "thin" | "hunch" | "full" =
    !conclusion || userMessageCount < 3 ? "thin" : confidence < 45 ? "hunch" : "full";

  const breakRound = rounds.length ? rounds.reduce((lo, r) => (r.autonomy < lo.autonomy ? r : lo)) : null;
  const peakRound = rounds.length ? rounds.reduce((hi, r) => (r.autonomy > hi.autonomy ? r : hi)) : null;
  // One stuck exchange is ordinary learning; a pattern of them is worth a look.
  // Same rule as the inbox triage in convex/aiChat.ts.
  const worthALook = state === "full" && rounds.filter((r) => r.autonomy <= 2).length >= 2;

  // Evidence chips: each claim names the round it came from, and clicking it
  // scrolls that round into view. This is the "checkable, not just readable"
  // contract — a claim with no round behind it is simply not offered.
  const evidence = [
    peakRound && peakRound.autonomy >= 4
      ? { label: `עבדה עצמאית · סבב ${peakRound.index + 1}`, round: peakRound.index }
      : null,
    breakRound && breakRound.autonomy <= 2
      ? { label: `נקודת השבירה · סבב ${breakRound.index + 1}`, round: breakRound.index }
      : null,
    rounds.length > 1
      ? { label: `הסבב האחרון · סבב ${rounds.length}`, round: rounds.length - 1 }
      : null,
  ].filter(Boolean) as { label: string; round: number }[];

  const focusRound = (i: number) => {
    setFocusedRound(i);
    setMobileTab("rounds");
    // Let the rounds panel mount on mobile before scrolling to the row.
    requestAnimationFrame(() =>
      document.getElementById(`round-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  };

  const handleAssign = async () => {
    if (assigning || assigned) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await createHomework({
        classroomId: chat.classroomId as Id<"classrooms">,
        title: `תרגול ממוקד: ${knowledgeGaps[0] ?? chat.title}`,
        topicIds: chat.topicId ? [chat.topicId as Id<"topics">] : [],
        teacherNotes: nextStep,
        questionCount: 4,
        deadline: Date.now() + 7 * 86_400_000,
        studentIds: [chat.studentId as Id<"students">],
      });
      setAssigned(true);
    } catch (e) {
      setAssignError(errorMessage(e));
    } finally {
      setAssigning(false);
    }
  };
  // Without a topic there is nothing to draw questions from, so the CTA is not
  // offered rather than offered-and-broken.
  const canAssign = !!chat.classroomId && !!chat.topicId;

  /* ── Panels ───────────────────────────────────────────────────────── */

  const verdictPanel = (
    <div className="flex flex-col gap-4">
      {state === "thin" ? (
        <ClayCard padding="lg" className="flex flex-col gap-3.5">
          <h2 className="font-display font-bold text-xl md:text-2xl text-on-surface-variant leading-snug text-pretty">
            אין מספיק נתונים למסקנה על השיחה הזו.
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-on-surface-variant text-pretty">
            השיחה קצרה מדי ולא הגיעה לאף נקודת קושי. פרדיי לא ינחש — כשאין ראיות, אין פסק־דין.
          </p>
          <div className="rounded-2xl bg-surface-container-low p-4 flex flex-col gap-2">
            <span className="text-xs font-extrabold text-on-surface-variant">מה היה חסר</span>
            <span className="text-sm leading-relaxed text-on-surface-variant">
              · {rounds.length <= 1 ? "סבב אחד בלבד, בלי ניסיון פתרון" : `${rounds.length} סבבים, בלי נקודת קושי מזוהה`}
            </span>
            <span className="text-sm leading-relaxed text-on-surface-variant">
              · {userMessageCount} הודעות מהתלמיד — מעט מכדי לזהות דפוס
            </span>
          </div>
          <ClayButton variant="ghost" size="sm" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? "הסתר את התמליל" : `הצג את ${chat.messageCount} ההודעות`}
          </ClayButton>
        </ClayCard>
      ) : (
        <ClayCard
          padding="lg"
          className="flex flex-col gap-3.5"
          style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 45%, transparent)" }}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-secondary inline-flex items-center gap-1.5">
              <Sparkles size={13} /> מסקנת פרדיי
            </span>
            {state === "hunch" && <Badge tone="tertiary">השערה</Badge>}
            <span className="ms-auto text-xs font-bold text-on-surface-variant">
              {state === "hunch" ? "ביטחון נמוך" : "ביטחון גבוה"} · מבוסס על {rounds.length || 1} סבבים
            </span>
            <span className="w-20 shrink-0">
              <ProgressBar
                value={confidence}
                size="sm"
                color={state === "hunch" ? "var(--color-tertiary)" : undefined}
                label={`רמת ביטחון ${confidence}%`}
              />
            </span>
          </div>

          <h2 className="font-display font-bold text-xl md:text-[29px] leading-tight text-pretty text-on-surface">
            {conclusion}
          </h2>

          {brief?.detailedStruggleAnalysis && (
            <p className="text-sm md:text-base leading-relaxed text-on-surface-variant text-pretty">
              {brief.detailedStruggleAnalysis}
            </p>
          )}

          {evidence.length > 0 && (
            <>
              <p className="text-sm leading-relaxed text-on-surface-variant text-pretty">
                לחיצה על ראיה מסמנת את הסבב שממנו היא נלקחה:
              </p>
              <div className="flex flex-wrap gap-2">
                {evidence.map((e) => (
                  <Chip key={e.round} selected={focusedRound === e.round} onClick={() => focusRound(e.round)}>
                    {e.label}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {state === "hunch" && (
            <div className="rounded-2xl bg-surface-container-low p-4 flex flex-col gap-2">
              <span className="text-xs font-extrabold text-on-surface-variant">איך לאמת</span>
              <span className="text-sm leading-relaxed text-on-surface-variant">
                · לבקש הסבר בעל־פה על אחד הפתרונות
              </span>
              <span className="text-sm leading-relaxed text-on-surface-variant">
                · תרגיל אחד בניסוח שונה מזה שהופיע בשיחה
              </span>
            </div>
          )}
        </ClayCard>
      )}
    </div>
  );

  const roundsPanel = (
    <ClayCard padding="lg" className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-extrabold text-base md:text-lg text-on-surface">
          {rounds.length ? `${rounds.length} הסבבים` : "סבבי השיחה"}
        </h3>
        <span className="text-xs md:text-sm text-on-surface-variant">העמודה מציגה עצמאות בכל סבב</span>
      </div>

      {rounds.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-6 text-center">
          השיחה לא חולקה לסבבים — אין פירוט להציג.
        </p>
      ) : (
        rounds.map((r) => {
          const tone = toneFor(r.autonomy);
          const isBreak = breakRound?.index === r.index && r.autonomy <= 2;
          const isFocused = focusedRound === r.index;
          return (
            <div
              key={r.index}
              id={`round-${r.index}`}
              className="grid gap-3 items-start rounded-2xl p-3.5 transition-colors md:grid-cols-[92px_1fr_auto]"
              style={{
                background: isBreak ? "var(--color-error-container)" : "transparent",
                outline: isFocused ? "2px solid var(--color-secondary)" : "none",
                outlineOffset: "-2px",
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className="font-extrabold text-sm"
                  style={{ color: isBreak ? "var(--color-on-error-container)" : undefined }}
                >
                  סבב {r.index + 1}
                </span>
                <span
                  dir="ltr"
                  className="font-mono text-xs inline-block"
                  style={{ color: isBreak ? "var(--color-on-error-container)" : "var(--color-on-surface-variant)", opacity: isBreak ? 0.8 : 1 }}
                >
                  {roundWindow(brief?.partialBriefs ?? [], r.index)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span
                  className="text-sm leading-relaxed"
                  style={{ color: isBreak ? "var(--color-on-error-container)" : undefined }}
                >
                  {isBreak && <b>נקודת השבירה. </b>}
                  {r.summary}
                </span>
                {peakRound?.index === r.index && r.autonomy >= 4 && (
                  <span className="self-start"><Badge tone="primary">✓ שיא העצמאות</Badge></span>
                )}
                {isBreak && (
                  <span className="self-start"><Badge tone="error">! ירידה בעצמאות</Badge></span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 md:items-end">
                <AutonomyDots value={r.autonomy} tone={tone} />
                <span
                  className="text-xs font-bold"
                  style={{ color: isBreak ? "var(--color-on-error-container)" : "var(--color-on-surface-variant)" }}
                >
                  עצמאות {r.autonomy}/5
                </span>
              </div>
            </div>
          );
        })
      )}

      <div className="mt-2 self-start">
        <ClayButton variant="ghost" size="sm" onClick={() => setShowTranscript((v) => !v)}>
          {showTranscript ? "הסתר את התמליל" : "הצג את התמליל המלא"}
        </ClayButton>
      </div>

      {showTranscript && (
        <div className="mt-2 rounded-2xl border-2 border-dashed border-outline p-4 flex flex-col gap-3 max-h-[320px] overflow-y-auto">
          {messages === undefined ? (
            <span className="text-sm text-on-surface-variant text-center py-4">טוען תמליל…</span>
          ) : messages.length === 0 ? (
            <span className="text-sm text-on-surface-variant text-center py-4">אין הודעות בשיחה זו</span>
          ) : (
            messages.map((m: any, i: number) => (
              <div key={m._id ?? i} className="text-sm leading-relaxed">
                <b style={{ color: m.role === "user" ? undefined : "var(--color-secondary)" }}>
                  {m.role === "user" ? `${chat.studentName}:` : m.role === "system" ? "מערכת:" : "פרדיי:"}
                </b>{" "}
                <MathText>{m.content}</MathText>
              </div>
            ))
          )}
        </div>
      )}
    </ClayCard>
  );

  const classPanel = (
    <OptionalPanel>
      <ClassGapPanel chatId={chat._id} />
    </OptionalPanel>
  );

  const prepPanel = (
    <div className="flex flex-col gap-4">
      {nextStep && (
        <ClayCard
          padding="lg"
          className="flex flex-col gap-3"
          style={{ borderColor: "color-mix(in srgb, var(--color-primary) 50%, transparent)" }}
        >
          <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-on-surface-variant">
            מחר בשיעור
          </span>
          <span className="font-extrabold text-base md:text-lg leading-snug text-pretty text-on-surface">
            {nextStep}
          </span>
          {brief?.approach && (
            <span className="text-sm leading-relaxed text-on-surface-variant">{brief.approach}</span>
          )}

          {assigned ? (
            <div className="rounded-2xl px-4 py-3.5 flex flex-col gap-1.5" style={{ background: "var(--color-primary-container)" }}>
              <span className="font-extrabold text-sm inline-flex items-center gap-1.5" style={{ color: "var(--color-on-primary-container)" }}>
                <Check size={15} strokeWidth={3} /> הוקצה ל{chat.studentName} · 4 תרגילים
              </span>
              <span className="text-xs" style={{ color: "var(--color-on-primary-container)", opacity: 0.85 }}>
                יופיע אצל התלמיד במסך הבית
              </span>
            </div>
          ) : canAssign ? (
            <ClayButton variant="primary" loading={assigning} onClick={handleAssign} className="w-full">
              {assigning ? "מקצה…" : `הקצה תרגול${knowledgeGaps[0] ? ` · ${knowledgeGaps[0]}` : ""}`}
            </ClayButton>
          ) : (
            <span className="text-xs text-on-surface-variant">
              לא ניתן להקצות תרגול — לשיחה זו לא משויך נושא.
            </span>
          )}
          {assignError && (
            <span className="text-xs font-semibold" style={{ color: "var(--color-error)" }}>{assignError}</span>
          )}
        </ClayCard>
      )}

      {talkingPoints.length > 0 && (
        <ClayCard padding="lg" className="flex flex-col gap-3">
          <h3 className="font-extrabold text-base text-on-surface">לשיחה אישית</h3>
          {talkingPoints.map((p, i) => (
            <div key={i} className="flex gap-2.5 text-sm leading-relaxed text-on-surface">
              <span className="font-extrabold text-primary">•</span>
              <span>{p}</span>
            </div>
          ))}
        </ClayCard>
      )}

      {knowledgeGaps.length > 0 && (
        <ClayCard padding="lg" className="flex flex-col gap-3">
          <h3 className="font-extrabold text-base text-on-surface">פערים חוזרים</h3>
          <div className="flex flex-wrap gap-2">
            {/* Whether a gap is class-wide is the class panel's story to tell;
                keeping it out of here is what lets that query fail alone. */}
            {knowledgeGaps.map((gap, i) => (
              <Badge key={i} tone="tertiary">{gap}</Badge>
            ))}
          </div>
        </ClayCard>
      )}

      {quote && (
        <ClayCard
          padding="lg"
          className="flex flex-col gap-2.5"
          style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 45%, transparent)" }}
        >
          <h3 className="font-extrabold text-base text-on-surface">במילים של התלמיד</h3>
          <p className="text-base leading-snug font-semibold text-pretty text-on-surface">
            {quote.startsWith("״") || quote.startsWith('"') ? quote : `״${quote}״`}
          </p>
          {selfAssessment && (
            <span className="text-xs text-on-surface-variant">הערכה עצמית בסיום · תואמת את מה שנמדד</span>
          )}
        </ClayCard>
      )}
    </div>
  );

  /* ── Layout ───────────────────────────────────────────────────────── */

  const topicLine = [
    chat.title,
    AGENT_LABEL[chat.agentType] ?? chat.agentType,
    rounds.length ? `${rounds.length} סבבים` : null,
    `${chat.messageCount} הודעות`,
  ].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-full flex flex-col p-4 md:p-6 bg-background text-on-background"
      dir="rtl"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 md:gap-4 mb-5 md:mb-6 flex-wrap">
        <ClayButton variant="icon" onClick={onBack} title="חזרה" aria-label="חזרה">
          <ArrowLeft size={18} />
        </ClayButton>
        <CyberAvatar name={chat.studentName || "?"} size={44} color={chat.studentAvatar} skin={chat.studentSkin} />
        <div className="min-w-0">
          <h1 className="font-display font-bold text-lg md:text-xl text-on-surface leading-tight">
            {chat.studentName}
          </h1>
          <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">{topicLine}</p>
        </div>
        <div className="ms-auto flex items-center gap-2.5">
          <span className="stat-chip cursor-default">
            <Clock size={14} /> {formatDuration(chat.startedAt, chat.endedAt)}
          </span>
          {worthALook && <Badge tone="tertiary">שווה מבט</Badge>}
        </div>
      </div>

      {/* ── Mobile: three tabs over the same panels ── */}
      <div className="lg:hidden mb-4">
        <SegTabs
          label="תצוגת ניתוח"
          value={mobileTab}
          onChange={setMobileTab}
          tabs={[
            { id: "verdict", label: "פסק־דין" },
            { id: "rounds", label: rounds.length ? `${rounds.length} סבבים` : "סבבים" },
            { id: "prep", label: "הכנה" },
          ]}
        />
      </div>
      <div className="lg:hidden flex flex-col gap-4">
        {mobileTab === "verdict" && (<>{verdictPanel}{classPanel}</>)}
        {mobileTab === "rounds" && roundsPanel}
        {mobileTab === "prep" && prepPanel}
      </div>

      {/* ── Desktop: verdict + rounds beside a sticky prep rail ── */}
      <div className="hidden lg:grid grid-cols-[1fr_340px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          {verdictPanel}
          {roundsPanel}
          {classPanel}
        </div>
        <div className="flex flex-col gap-4 sticky top-5">{prepPanel}</div>
      </div>
    </motion.div>
  );
}
