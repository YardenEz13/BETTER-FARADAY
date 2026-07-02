import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion } from "framer-motion";
import CyberAvatar from "../components/CyberAvatar";
import {
  ArrowLeft, MessageSquare, Clock, User, Bot, AlertTriangle, CheckCircle,
  Target, Sparkles, Frown, Smile, Meh,
} from "../components/electric";

const AGENT_LABEL: Record<string, string> = { practice: "שיחת תרגול", homework: "שיעורי בית" };

const SENTIMENT_META: Record<string, { label: string; color: string; Icon: any }> = {
  frustrated: { label: "מתוסכל", color: "var(--color-error)", Icon: Frown },
  confident: { label: "בטוח", color: "var(--color-primary)", Icon: Smile },
  neutral: { label: "ניטרלי", color: "var(--color-tertiary)", Icon: Meh },
};

const CONFUSION_RE = /לא מבינ|מבולבל|למה זה|איך זה|לא הבנתי|מה זה אומר|לא הצלחתי|לא בטוח/;
const BREAKTHROUGH_RE = /עכשיו הבנתי|הבנתי!|אה,? עכשיו|קיבלתי!|אההה|כן! הבנתי|עכשיו זה ברור|הבנתי!/;

function detectFlag(role: string, content: string): "confusion" | "breakthrough" | null {
  if (role !== "user") return null;
  if (BREAKTHROUGH_RE.test(content)) return "breakthrough";
  if (CONFUSION_RE.test(content)) return "confusion";
  return null;
}

function formatDuration(startedAt: number, endedAt?: number) {
  if (!endedAt) return "בשיחה כעת";
  const mins = Math.max(1, Math.round((endedAt - startedAt) / 60000));
  return `${mins} דק׳`;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}, ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
}

// Rough per-message mood trace, used only to sketch the emotional-arc sparkline.
function buildMoodTrace(flaggedUserMessages: { flag: "confusion" | "breakthrough" | null }[]) {
  if (flaggedUserMessages.length === 0) return [50, 50];
  let value = 50;
  const values: number[] = [];
  for (const m of flaggedUserMessages) {
    if (m.flag === "confusion") value = Math.max(10, value - 35);
    else if (m.flag === "breakthrough") value = Math.min(95, value + 40);
    else value = value + (55 - value) * 0.2;
    values.push(Math.round(value));
  }
  return values;
}

interface ChatAnalysisViewProps {
  chat: any;
  onBack: () => void;
}

export function ChatAnalysisView({ chat, onBack }: ChatAnalysisViewProps) {
  const messages = useQuery(api.aiChat.getChatMessages, { chatId: chat._id });
  const brief = useQuery(api.sessionBriefs.getBriefForChat, { chatId: chat._id });

  const metrics = chat.metrics;
  const sentiment = SENTIMENT_META[metrics?.sentiment ?? "neutral"] ?? SENTIMENT_META.neutral;
  const SentimentIcon = sentiment.Icon;

  const flagged = (messages ?? []).map((m: any) => ({ ...m, flag: detectFlag(m.role, m.content) }));
  const userFlagged = flagged.filter((m: any) => m.role === "user");
  const confusionCount = userFlagged.filter((m: any) => m.flag === "confusion").length;
  const breakthroughCount = userFlagged.filter((m: any) => m.flag === "breakthrough").length;

  const confidence = brief
    ? Math.round((brief.solutionAccuracy / 5) * 100)
    : Math.max(5, 100 - (metrics?.confusionScore ?? 50));

  const knowledgeGaps: string[] = (brief?.missingConcepts?.length ? brief.missingConcepts : metrics?.missingKnowledge) ?? [];
  const nextStep: string | undefined = brief?.recommendedAction ?? metrics?.teacherActionItem;
  const conclusion: string | undefined = brief?.keyInsight ?? metrics?.gemmaAnalysisSummary;

  const moodTrace = buildMoodTrace(userFlagged);
  const arcId = `arc-${chat._id}`;
  const W = 400, H = 90, PAD = 12;
  const step = moodTrace.length > 1 ? (W - PAD * 2) / (moodTrace.length - 1) : 0;
  const points = moodTrace.map((v, i) => ({
    x: PAD + i * step,
    y: H - 14 - (v / 100) * (H - 28),
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="w-full min-h-full flex flex-col p-4 md:p-6 bg-background text-on-background" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3 md:gap-4">
          <button className="btn-icon flex-shrink-0" onClick={onBack} title="חזרה">
            <ArrowLeft size={18} />
          </button>
          <CyberAvatar name={chat.studentName || "?"} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-xl md:text-2xl text-on-surface leading-tight">{chat.studentName}</h1>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full border-2 flex items-center gap-1.5"
                style={{ color: sentiment.color, borderColor: `color-mix(in srgb, ${sentiment.color} 35%, transparent)`, background: `color-mix(in srgb, ${sentiment.color} 10%, transparent)` }}
              >
                <SentimentIcon size={13} /> {sentiment.label}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-1">
              {chat.title} · {AGENT_LABEL[chat.agentType] ?? chat.agentType} · {formatDate(chat.startedAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="stat-chip cursor-default"><MessageSquare size={14} /> {chat.messageCount} הודעות</span>
          <span className="stat-chip cursor-default"><Clock size={14} /> {formatDuration(chat.startedAt, chat.endedAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 md:gap-5 items-start">

        {/* ── Transcript ── */}
        <div className="clay-card p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <h3 className="font-bold text-base md:text-lg text-on-surface">תמליל השיחה</h3>
            <div className="flex gap-3 text-xs font-semibold text-on-surface-variant">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--color-error)" }} />בלבול</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--color-primary)" }} />פריצת דרך</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mb-5 font-mono">ניתוח אוטומטי מסמן רגעי בלבול והבנה לאורך השיחה</p>

          {messages === undefined ? (
            <div className="py-16 text-center text-sm text-on-surface-variant">טוען תמליל…</div>
          ) : flagged.length === 0 ? (
            <div className="py-16 text-center text-sm text-on-surface-variant">אין הודעות בשיחה זו</div>
          ) : (
            <motion.div
              className="flex flex-col gap-4 max-h-[640px] overflow-y-auto pe-1"
              initial="hidden"
              animate="visible"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.03 } } }}
            >
              {flagged.map((msg: any, i: number) => {
                const isUser = msg.role === "user";
                const isSystem = msg.role === "system";
                const accent = isUser ? "var(--color-primary)" : isSystem ? "var(--color-outline)" : "var(--color-secondary)";
                return (
                  <motion.div
                    key={msg._id ?? i}
                    variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                    style={{ maxWidth: "82%", alignSelf: isUser ? "flex-start" : "flex-end" }}
                  >
                    <div className="text-xs font-bold mb-1.5 flex items-center gap-1.5" style={{ color: accent, justifyContent: isUser ? "flex-start" : "flex-end" }}>
                      {isUser ? <><User size={12} /> תלמיד</> : isSystem ? "מערכת" : <>{chat.studentName ? "פאראדיי" : "AI"} <Bot size={12} /></>}
                    </div>
                    <div
                      className="text-sm text-on-surface leading-relaxed p-3.5"
                      style={{
                        borderRadius: isUser ? "16px 16px 16px 5px" : "16px 16px 5px 16px",
                        background: `color-mix(in srgb, ${accent} 8%, transparent)`,
                        border: `2px solid color-mix(in srgb, ${accent} 22%, transparent)`,
                      }}
                    >
                      {msg.content}
                    </div>
                    {msg.flag === "confusion" && (
                      <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold rounded-full px-2.5 py-1" style={{ color: "var(--color-error)", background: "color-mix(in srgb, var(--color-error) 9%, transparent)" }}>
                        <AlertTriangle size={12} /> בלבול זוהה
                      </span>
                    )}
                    {msg.flag === "breakthrough" && (
                      <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold rounded-full px-2.5 py-1" style={{ color: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}>
                        <CheckCircle size={12} /> פריצת דרך
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* ── AI conclusion rail ── */}
        <div className="flex flex-col gap-4">

          <div className="clay-card p-5" style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 30%, transparent)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-secondary)" }}>
                <Sparkles size={16} style={{ color: "var(--color-on-secondary)" }} />
              </span>
              <h3 className="font-extrabold text-base text-on-surface">מסקנת ה-AI</h3>
            </div>
            {conclusion ? (
              <p className="text-sm text-on-surface leading-relaxed">{conclusion}</p>
            ) : (
              <p className="text-sm text-on-surface-variant leading-relaxed">שיחה זו טרם נותחה — לא נמצאה מסקנת AI.</p>
            )}
          </div>

          <div className="clay-card p-5">
            <h3 className="font-bold text-sm text-on-surface mb-3">מדד ביטחון בסיום</h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="progress-track flex-1">
                <div className="progress-fill-gradient" style={{ width: `${confidence}%` }} />
              </div>
              <span className="num text-lg font-extrabold text-on-surface">{confidence}%</span>
            </div>
            <p className="text-xs text-on-surface-variant">מבוסס על תשובות נכונות ורמת הוודאות בהודעות האחרונות</p>
          </div>

          <div className="clay-card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-on-surface">קשת רגשית</h3>
              <span className="text-xs font-bold text-primary">תסכול ← הבנה</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="80" preserveAspectRatio="none">
              <defs>
                <linearGradient id={arcId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#FF4B4B" />
                  <stop offset="0.5" stopColor="#FFB02E" />
                  <stop offset="1" stopColor="#17C964" />
                </linearGradient>
              </defs>
              <line x1={PAD} y1={H * 0.33} x2={W - PAD} y2={H * 0.33} style={{ stroke: "var(--color-outline-variant)" }} strokeWidth={1.5} />
              <line x1={PAD} y1={H * 0.66} x2={W - PAD} y2={H * 0.66} style={{ stroke: "var(--color-outline-variant)" }} strokeWidth={1.5} />
              <path d={pathD} fill="none" stroke={`url(#${arcId})`} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              {points.length > 0 && <circle cx={points[0].x} cy={points[0].y} r={5} fill="#FF4B4B" />}
              {points.length > 1 && (
                <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={6} style={{ fill: "var(--color-surface)" }} stroke="#17C964" strokeWidth={3.5} />
              )}
            </svg>
            <div className="flex justify-between mt-1 font-mono text-[10px] text-on-surface-variant">
              <span>התחלה</span><span>אמצע</span><span>סיום</span>
            </div>
          </div>

          {knowledgeGaps.length > 0 && (
            <div className="clay-card p-5">
              <h3 className="font-bold text-sm text-on-surface mb-3">פערי ידע שזוהו</h3>
              <div className="flex flex-wrap gap-2">
                {knowledgeGaps.map((gap, i) => (
                  <span key={i} className="badge" style={{ background: "color-mix(in srgb, var(--color-tertiary) 15%, transparent)", color: "var(--color-on-tertiary-container)" }}>
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {nextStep && (
            <div
              className="p-4 rounded-2xl flex gap-3 items-start"
              style={{ background: "var(--color-primary)", border: "2px solid var(--color-primary-dark)", boxShadow: "0 4px 0 0 var(--color-primary-dark)" }}
            >
              <Target size={20} style={{ color: "var(--color-on-primary)", flexShrink: 0 }} />
              <div>
                <div className="text-xs font-bold mb-0.5" style={{ color: "color-mix(in srgb, var(--color-on-primary) 80%, transparent)" }}>צעד מומלץ למורה</div>
                <div className="text-sm font-bold leading-snug" style={{ color: "var(--color-on-primary)" }}>{nextStep}</div>
              </div>
            </div>
          )}

          {(confusionCount > 0 || breakthroughCount > 0) && (
            <div className="text-xs text-on-surface-variant text-center font-mono">
              {confusionCount} רגעי בלבול · {breakthroughCount} פריצות דרך
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
