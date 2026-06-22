import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Bot, Frown, Smile, Meh, MessageSquare, Trash2, AlertTriangle, User, FileText, Zap, Target } from "lucide-react";
import { analyzeConversation } from "../services/localAI";
import CyberAvatar from "../components/CyberAvatar";

export function AIChatAnalyticsView({ analytics }: { analytics: any }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteChatMut = useMutation(api.aiChat.deleteChat);
  const endChatMut = useMutation(api.aiChat.endChat);
  const [analyzingChatId, setAnalyzingChatId] = useState<string | null>(null);

  const chatMessages = useQuery(
    api.aiChat.getChatMessages,
    selectedChatId ? { chatId: selectedChatId as any } : "skip"
  );

  const summary = analytics?.summary;
  const chats = analytics?.chats ?? [];

  // Sentiment maps to the brand palette: confident = Volt, neutral = Filament, frustrated = error
  const sentimentColor = (s: string) =>
    s === 'frustrated' ? 'var(--color-error)' : s === 'confident' ? 'var(--color-primary)' : 'var(--color-tertiary)';
  const sentimentLabel = (s: string) =>
    s === 'frustrated' ? 'מתוסכל' : s === 'confident' ? 'בטוח' : 'ניטרלי';
  const SentimentIcon = (s: string, size = 22) =>
    s === 'frustrated'
      ? <Frown size={size} style={{ color: 'var(--color-error)' }} />
      : s === 'confident'
        ? <Smile size={size} style={{ color: 'var(--color-primary)' }} />
        : <Meh size={size} style={{ color: 'var(--color-tertiary)' }} />;

  const confusionHigh = (summary?.avgConfusion ?? 0) > 60;

  return (
    <div className="w-full min-h-full flex flex-col xl:flex-row gap-6 p-6 bg-background text-on-background" dir="rtl">

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-14 h-14 rounded-2xl bg-primary border-2 border-primary-dark flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: 'var(--shadow-clay-primary)' }}
          >
            <Bot size={28} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-3xl text-on-surface leading-tight">אנליטיקת שיחות AI</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              מעקב אחר האינטראקציות של התלמידים עם המורה{' '}
              <span className="font-semibold text-primary">מייקל פאראדיי</span>
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="clay-card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-on-surface-variant">סך שיחות</span>
              <MessageSquare size={18} className="text-primary" />
            </div>
            <div className="num text-4xl font-bold text-primary">{summary?.totalChats ?? 0}</div>
          </div>

          <div className="clay-card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-on-surface-variant">ממוצע בלבול</span>
              <Target size={18} className={confusionHigh ? 'text-error' : 'text-primary'} />
            </div>
            <div className="num text-4xl font-bold" style={{ color: confusionHigh ? 'var(--color-error)' : 'var(--color-primary)' }}>
              {summary?.avgConfusion ?? 0}%
            </div>
          </div>

          <div className="clay-card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-on-surface-variant">סך הודעות</span>
              <Zap size={18} className="text-tertiary" />
            </div>
            <div className="num text-4xl font-bold text-on-surface">{summary?.totalMessages ?? 0}</div>
          </div>
        </div>

        {/* Sentiment distribution */}
        {summary?.sentimentCounts && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {(['confident', 'neutral', 'frustrated'] as const).map(s => {
              const color = sentimentColor(s);
              return (
                <div
                  key={s}
                  className="clay-card p-5 flex items-center gap-4"
                  style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border-2"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
                  >
                    {SentimentIcon(s)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color }}>{sentimentLabel(s)}</div>
                    <div className="num text-2xl font-bold text-on-surface">{summary.sentimentCounts[s] ?? 0}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chat list header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-on-surface">שיחות אחרונות</h2>
          <span className="num text-sm text-on-surface-variant">{chats.length} שיחות</span>
        </div>

        <motion.div
          className="flex flex-col gap-4"
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
        >
          {chats.length === 0 ? (
            <div className="clay-card p-16 text-center border-dashed">
              <Bot size={56} className="text-primary opacity-40 mx-auto mb-5" />
              <div className="text-xl font-bold text-on-surface mb-2">עוד אין שיחות AI</div>
              <div className="text-sm text-on-surface-variant">כשתלמידים ישתמשו במורה AI, השיחות יופיעו כאן.</div>
            </div>
          ) : (
            chats.map((chat: any) => {
              const isSelected = selectedChatId === chat._id;
              const isPractice = chat.agentType === 'practice';
              return (
                <motion.div
                  key={chat._id}
                  className="clay-card p-6 cursor-pointer"
                  style={{ borderColor: isSelected ? 'var(--color-primary)' : undefined }}
                  onClick={() => setSelectedChatId(isSelected ? null : chat._id)}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <CyberAvatar name={chat.studentName || '?'} size={44} />
                      <div>
                        <div className="font-bold text-on-surface">{chat.studentName}</div>
                        <div className="text-sm text-on-surface-variant mt-0.5">{chat.title}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border-2 ${isPractice ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-tertiary/10 border-tertiary/30 text-tertiary'}`}>
                        {isPractice ? 'תרגול' : 'שיעורי בית'}
                      </span>
                      <div className="num text-sm text-on-surface-variant flex items-center gap-1.5">
                        <MessageSquare size={15} /> {chat.messageCount}
                      </div>
                      <button
                        className="btn-icon hover:border-error hover:text-error"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(chat._id); }}
                        title="מחק שיחה"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {chat.metrics ? (
                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t-2 border-outline">
                      <div className="flex flex-wrap gap-2">
                        <div
                          className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1 rounded-full border-2"
                          style={{ borderColor: `color-mix(in srgb, ${sentimentColor(chat.metrics.sentiment)} 30%, transparent)`, color: sentimentColor(chat.metrics.sentiment), background: `color-mix(in srgb, ${sentimentColor(chat.metrics.sentiment)} 10%, transparent)` }}
                        >
                          {SentimentIcon(chat.metrics.sentiment, 14)} {sentimentLabel(chat.metrics.sentiment)}
                        </div>
                        <div className="text-xs font-semibold flex items-center gap-1 px-3 py-1 rounded-full border-2 border-primary/30 bg-primary/10 text-primary">
                          בלבול: <span className="num font-bold">{chat.metrics.confusionScore}%</span>
                        </div>
                        {chat.metrics.keyStrugglePoints?.slice(0, 2).map((p: string, i: number) => (
                          <div key={i} className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-error/30 bg-error/10 text-error">
                            <AlertTriangle size={13} /> {p}
                          </div>
                        ))}
                      </div>

                      {chat.metrics.missingKnowledge && chat.metrics.missingKnowledge.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {chat.metrics.missingKnowledge.map((mk: string, i: number) => (
                            <span key={i} className="text-xs font-medium px-3 py-1 rounded-full border-2 border-dashed border-tertiary/40 text-tertiary bg-tertiary/5">
                              🧩 חסר: {mk}
                            </span>
                          ))}
                        </div>
                      )}

                      {chat.metrics.teacherActionItem && (
                        <div className="mt-1 p-4 rounded-2xl bg-primary/10 border-2 border-primary/25 text-on-surface text-sm font-medium flex items-start gap-3">
                          <Target size={18} className="text-primary flex-shrink-0 mt-0.5" />
                          <span>{chat.metrics.teacherActionItem}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t-2 border-outline flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-tertiary flex items-center gap-2">
                        <AlertTriangle size={16} /> שיחה זו נסגרה בטרם נותחה.
                      </span>
                      {isSelected && chatMessages ? (
                        <button
                          className="btn-clay-primary px-4 py-2 text-sm"
                          disabled={analyzingChatId === chat._id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setAnalyzingChatId(chat._id);
                            try {
                              const metrics = await analyzeConversation(chatMessages as any[]);
                              await endChatMut({ chatId: chat._id, metrics });
                            } catch (err) {
                              console.error("Failed to analyze chat:", err);
                              alert("שגיאה בניתוח השיחה.");
                            } finally {
                              setAnalyzingChatId(null);
                            }
                          }}
                        >
                          {analyzingChatId === chat._id ? (
                            <span className="animate-pulse">מנתח...</span>
                          ) : (
                            <><Zap size={14} /> נתח עכשיו</>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-on-surface-variant opacity-70">פתח את השיחה כדי לנתח</span>
                      )}
                    </div>
                  )}

                  {/* Expanded transcript */}
                  {isSelected && chatMessages && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5 p-5 rounded-2xl bg-surface-container-low border-2 border-outline max-h-[500px] overflow-y-auto"
                    >
                      {chatMessages.map((msg: any, i: number) => {
                        const role = msg.role;
                        const accent = role === 'user' ? 'var(--color-primary)' : role === 'assistant' ? 'var(--color-secondary)' : 'var(--color-outline)';
                        return (
                          <div key={i} className="mb-4 last:mb-0">
                            <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: accent }}>
                              {role === 'user' ? <><User size={13} /> תלמיד</> : role === 'assistant' ? <><Bot size={13} /> פאראדיי</> : <><FileText size={13} /> מערכת</>}
                            </div>
                            <div
                              className="text-sm text-on-surface leading-relaxed p-3.5 rounded-xl border-2"
                              style={{ borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`, background: `color-mix(in srgb, ${accent} 6%, transparent)` }}
                            >
                              {msg.content}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </motion.div>

        {/* Delete confirmation dialog */}
        {confirmDeleteId && createPortal(
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 clay-card p-6 border-error flex items-center gap-6"
            style={{ borderColor: 'var(--color-error)' }}
            dir="rtl"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-error/10 text-error border-2 border-error/30 flex-shrink-0">
              <AlertTriangle size={24} />
            </div>
            <span className="font-bold text-lg text-on-surface">למחוק את השיחה לצמיתות?</span>
            <div className="flex gap-3">
              <button
                className="px-5 py-2.5 rounded-2xl bg-error text-on-error font-semibold border-2 border-error transition-all hover:-translate-y-0.5 active:translate-y-0.5"
                style={{ boxShadow: 'var(--shadow-clay-error)' }}
                onClick={async () => {
                  await deleteChatMut({ chatId: confirmDeleteId as any });
                  setConfirmDeleteId(null);
                  if (selectedChatId === confirmDeleteId) setSelectedChatId(null);
                }}
              >
                מחק
              </button>
              <button className="btn-clay-ghost" onClick={() => setConfirmDeleteId(null)}>
                ביטול
              </button>
            </div>
          </motion.div>,
          document.body
        )}
      </div>

      {/* ── Right panel ── */}
      <div className="w-full xl:w-[420px] flex flex-col gap-6">

        {/* Top struggles */}
        <div className="clay-card p-6" style={{ borderColor: 'color-mix(in srgb, var(--color-error) 30%, transparent)' }}>
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b-2 border-outline text-error">
            <AlertTriangle size={20} />
            <h3 className="font-bold text-lg">נקודות קושי מובילות</h3>
          </div>

          {summary?.topStruggles?.length > 0 ? (
            <div className="flex flex-col gap-3">
              {summary.topStruggles.map((s: { point: string; count: number }, i: number) => (
                <div key={i} className="flex justify-between items-center gap-4 p-4 rounded-2xl bg-surface-container border-2 border-outline">
                  <div className="text-sm text-on-surface font-semibold leading-tight">{s.point}</div>
                  <div className="num text-xs font-bold px-3 py-1.5 rounded-full bg-error/10 text-error border-2 border-error/25 whitespace-nowrap">
                    {s.count} שיחות
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-on-surface-variant border-2 border-dashed border-outline rounded-2xl">
              אין מספיק נתונים עדיין
            </div>
          )}
        </div>

        {/* Chat type distribution */}
        <div className="clay-card p-6">
          <h3 className="font-bold text-lg text-on-surface pb-4 mb-5 border-b-2 border-outline">חלוקת סוגי שיחות</h3>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-primary/10 border-2 border-primary/30 text-primary">תרגול</span>
              <span className="num font-bold text-3xl text-on-surface">{chats.filter((c: any) => c.agentType === 'practice').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-tertiary/10 border-2 border-tertiary/30 text-tertiary">שיעורי בית</span>
              <span className="num font-bold text-3xl text-on-surface">{chats.filter((c: any) => c.agentType === 'homework').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
