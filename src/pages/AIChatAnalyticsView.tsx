import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Bot, Frown, Smile, Meh, MessageSquare, Trash2, AlertTriangle, User, FileText, Zap } from "lucide-react";
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

  const SentimentIcon = (s: string) => s === 'frustrated' ? <Frown size={24} color="#ff4b4b" /> : s === 'confident' ? <Smile size={24} color="var(--color-primary)" /> : <Meh size={24} color="#f5d44f" />;
  const sentimentLabel = (s: string) => s === 'frustrated' ? 'מתוסכל' : s === 'confident' ? 'בטוח' : 'ניטרלי';
  const sentimentColor = (s: string) => s === 'frustrated' ? '#ff4b4b' : s === 'confident' ? 'var(--color-primary)' : '#f5d44f';

  return (
    <div className="w-full h-full flex flex-col xl:flex-row gap-8 p-8 min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      <div className="flex-1 flex flex-col">
        <div className="mb-12 border-b-2 border-[var(--color-primary)] pb-8">
          <h1 className="text-6xl font-black mb-4 text-[var(--color-primary)] drop-shadow-[0_0_15px_rgba(0,255,136,0.5)] tracking-tighter uppercase flex items-center gap-4">
            <Bot size={56} className="text-[var(--color-primary-light)] drop-shadow-[0_0_10px_var(--color-primary-light)]" />
            אנליטיקת<br />שיחות AI
          </h1>
          <p className="label-mono text-xl text-[var(--color-primary-light)]">
            מעקב אחרי כל האינטראקציות של התלמידים עם מורה AI <span className="text-[var(--color-primary)] font-bold">מייקל פאראדיי</span>.
          </p>
        </div>

        {/* Summary shards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="glass p-8 bg-[var(--color-primary-muted)] border border-[var(--color-primary)] shadow-[0_0_20px_rgba(0,255,136,0.1)] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-[var(--color-primary)]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-[var(--color-primary)]" />
            <div className="label-mono text-[var(--color-primary-light)] mb-3 text-lg uppercase tracking-widest">סך שיחות</div>
            <div className="text-6xl font-black text-[var(--text-primary)] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{summary?.totalChats ?? 0}</div>
          </div>
          
          <div className="glass p-8 bg-[var(--color-primary-muted)] border border-[var(--color-primary)] shadow-[0_0_15px_rgba(0,255,136,0.05)] flex flex-col items-center justify-center">
            <div className="label-mono text-[var(--color-primary-light)] mb-3 text-lg uppercase tracking-widest">ממוצע בלבול</div>
            <div className="text-6xl font-black" style={{ 
              color: (summary?.avgConfusion ?? 0) > 60 ? "#ff4b4b" : "var(--color-primary)", 
              textShadow: (summary?.avgConfusion ?? 0) > 60 ? "0 0 15px #ff4b4b" : "0 0 15px var(--color-primary)" 
            }}>
              {summary?.avgConfusion ?? 0}%
            </div>
          </div>
          
          <div className="glass p-8 bg-[var(--color-primary-muted)] border border-[var(--color-primary)] shadow-[0_0_15px_rgba(0,255,136,0.05)] flex flex-col items-center justify-center">
            <div className="label-mono text-[var(--color-primary-light)] mb-3 text-lg uppercase tracking-widest">סך הודעות</div>
            <div className="text-6xl font-black text-[var(--text-primary)]">{summary?.totalMessages ?? 0}</div>
          </div>
        </div>

        {/* Sentiment distribution */}
        {summary?.sentimentCounts && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {(['confident', 'neutral', 'frustrated'] as const).map(s => {
               const color = sentimentColor(s);
               return (
                <div key={s} className="glass p-8 bg-[var(--bg-void)] border border-[var(--color-primary)] flex items-center justify-center gap-8" style={{ borderColor: color, boxShadow: "0 0 15px " + color + "20" }}>
                  <div className="flex items-center justify-center p-3 bg-opacity-10 rounded-none border border-current" style={{ backgroundColor: color + "10", color }}>{SentimentIcon(s)}</div>
                  <div>
                    <div className="label-mono text-sm uppercase tracking-wider mb-1" style={{ color }}>{sentimentLabel(s)}</div>
                    <div className="font-black text-3xl text-[var(--text-primary)]">{summary.sentimentCounts[s] ?? 0}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chat list */}
        <div className="label-mono text-[var(--color-primary)] text-xl border-b border-[var(--color-primary)] pb-3 mb-6 uppercase tracking-widest flex items-center justify-between">
          <span>שיחות אחרונות</span>
          <span className="text-sm text-[var(--color-primary-light)]">{chats.length} שיחות</span>
        </div>
        
        <motion.div
          className="flex flex-col gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {chats.length === 0 ? (
            <div className="glass p-16 text-center bg-[var(--color-primary-muted)] border border-dashed border-[var(--color-primary)]">
              <Bot size={64} className="text-[var(--color-primary)] opacity-50 mx-auto mb-6" />
              <div className="text-2xl font-bold text-[var(--text-primary)] mb-3">עוד אין שיחות AI</div>
              <div className="label-mono text-[var(--color-primary-light)] opacity-80 text-lg">כשתלמידים ישתמשו במורה AI, השיחות יופיעו כאן.</div>
            </div>
          ) : (
            chats.map((chat: any) => (
              <motion.div
                key={chat._id}
                className="glass p-8 cursor-pointer bg-[rgba(0,255,136,0.03)] border transition-all"
                style={{ 
                  borderColor: selectedChatId === chat._id ? 'var(--color-primary)' : '#1a3324',
                  boxShadow: selectedChatId === chat._id ? '0 0 20px rgba(0,255,136,0.15)' : 'none'
                }}
                onClick={() => setSelectedChatId(selectedChatId === chat._id ? null : chat._id)}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
                whileHover={{ scale: 1.005, borderColor: 'var(--color-primary)', backgroundColor: 'rgba(0,255,136,0.08)' }}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-4">
                  <div className="flex items-center gap-6">
                    <CyberAvatar name={chat.studentName || '?'} size={48} />
                    <div>
                      <div className="text-xl font-bold text-[var(--text-primary)]">{chat.studentName}</div>
                      <div className="label-mono text-[var(--color-primary-light)] text-sm mt-1">{chat.title}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className="label-mono px-3 py-1 border uppercase text-xs tracking-widest" style={{ 
                      borderColor: chat.agentType === 'practice' ? 'var(--color-primary)' : '#f5d44f',
                      color: chat.agentType === 'practice' ? 'var(--color-primary)' : '#f5d44f',
                      backgroundColor: chat.agentType === 'practice' ? 'rgba(0,255,136,0.1)' : 'rgba(245,212,79,0.1)'
                    }}>
                      {chat.agentType === 'practice' ? 'תרגול' : 'שיעורי בית'}
                    </span>
                    <div className="label-mono text-[var(--color-primary-light)] flex items-center gap-2">
                      <MessageSquare size={16} /> {chat.messageCount} הודעות
                    </div>
                    <button
                      className="btn btn-primary w-10 h-10 flex items-center justify-center bg-transparent border border-[var(--border-default)] text-[#8ab098] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[rgba(255,75,75,0.1)] transition-all"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(chat._id); }}
                      title="מחק שיחה"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {chat.metrics ? (
                  <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-[var(--border-default)]">
                    <div className="flex flex-wrap gap-3">
                      <div className="label-mono flex items-center gap-2 px-3 py-1 border" style={{ borderColor: sentimentColor(chat.metrics.sentiment), color: sentimentColor(chat.metrics.sentiment), backgroundColor: `${sentimentColor(chat.metrics.sentiment)}10` }}>
                        {SentimentIcon(chat.metrics.sentiment)} {sentimentLabel(chat.metrics.sentiment)}
                      </div>
                      <div className="label-mono flex items-center px-3 py-1 border border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-muted)]">
                        בלבול: <span className="font-bold ml-2 text-[var(--text-primary)]">{chat.metrics.confusionScore}%</span>
                      </div>
                      {chat.metrics.keyStrugglePoints?.slice(0, 2).map((p: string, i: number) => (
                        <div key={i} className="label-mono flex items-center gap-2 px-3 py-1 border border-[var(--color-danger)] text-[var(--color-danger)] bg-[var(--color-danger-muted)]">
                          <AlertTriangle size={14} /> {p}
                        </div>
                      ))}
                    </div>
                    
                    {chat.metrics.missingKnowledge && chat.metrics.missingKnowledge.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {chat.metrics.missingKnowledge.map((mk: string, i: number) => (
                          <span key={i} className="label-mono px-3 py-1 border border-dashed border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning-muted)]">
                            🧩 חסר: {mk}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {chat.metrics.teacherActionItem && (
                      <div className="mt-3 p-3 bg-[rgba(0,255,136,0.1)] border-l-4 border-[var(--color-primary)] text-[var(--text-primary)] text-sm font-bold flex items-start gap-3">
                        <span className="text-[var(--color-primary)] text-xl">🎯</span> {chat.metrics.teacherActionItem}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-[var(--border-default)] flex items-center justify-between bg-[rgba(245,212,79,0.02)] p-4">
                    <span className="label-mono text-[var(--color-warning)] flex items-center gap-2">
                      <AlertTriangle size={16} /> שיחה זו נסגרה בטרם נותחה.
                    </span>
                    {selectedChatId === chat._id && chatMessages ? (
                      <button 
                        className="btn btn-primary py-1 px-4 text-xs flex items-center gap-2"
                        disabled={analyzingChatId === chat._id}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setAnalyzingChatId(chat._id);
                          try {
                            const metrics = await analyzeConversation(chatMessages as any[]);
                            await endChatMut({ chatId: chat._id, metrics });
                          } catch(err) {
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
                      <span className="label-mono text-[10px] opacity-50">פתח את השיחה כדי לנתח</span>
                    )}
                  </div>
                )}

                {/* Expanded chat transcript */}
                {selectedChatId === chat._id && chatMessages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 p-6 bg-[var(--bg-void)] border border-[var(--color-primary)] max-h-[500px] overflow-y-auto relative"
                  >
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px)', backgroundSize: '100% 4px' }} />
                    
                    {chatMessages.map((msg: any, i: number) => (
                      <div key={i} className="mb-6 relative z-10">
                        <div className="label-mono mb-2 flex items-center gap-2" style={{ color: msg.role === 'user' ? 'var(--color-primary)' : msg.role === 'assistant' ? 'var(--color-primary-light)' : '#8ab098' }}>
                          {msg.role === 'user' ? <><User size={14} /> תלמיד</> : msg.role === 'assistant' ? <><Bot size={14} /> ת'אורם</> : <><FileText size={14} /> מערכת</>}
                        </div>
                        <div className="text-base text-[var(--text-primary)] leading-relaxed p-4 border bg-opacity-10" style={{ 
                          borderColor: msg.role === 'user' ? 'var(--color-primary)' : msg.role === 'assistant' ? 'var(--color-primary-light)' : '#1a3324',
                          backgroundColor: msg.role === 'user' ? 'rgba(0,255,136,0.05)' : msg.role === 'assistant' ? 'rgba(153,255,0,0.05)' : 'transparent',
                          borderLeftWidth: msg.role === 'assistant' ? '4px' : '1px',
                          borderRightWidth: msg.role === 'user' ? '4px' : '1px'
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </motion.div>

        {/* Delete confirmation dialog */}
        {confirmDeleteId && createPortal(
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 shard p-8 bg-[var(--bg-void)] border-2 border-[var(--color-danger)] shadow-[0_0_40px_rgba(255,75,75,0.3)] flex items-center gap-8"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-[rgba(255,75,75,0.1)] text-[var(--color-danger)] border border-[var(--color-danger)]">
              <AlertTriangle size={24} />
            </div>
            <span className="font-bold text-xl text-[var(--text-primary)]">למחוק את השיחה לצמיתות?</span>
            <div className="flex gap-4">
              <button
                className="btn btn-primary px-6 py-3 bg-[#ff4b4b] text-black font-black uppercase hover:bg-white hover:text-[var(--color-danger)] transition-all"
                onClick={async () => {
                  await deleteChatMut({ chatId: confirmDeleteId as any });
                  setConfirmDeleteId(null);
                  if (selectedChatId === confirmDeleteId) setSelectedChatId(null);
                }}
              >
                מחק
              </button>
              <button
                className="btn btn-primary px-6 py-3 bg-transparent border border-[var(--border-default)] text-[#8ab098] hover:border-white hover:text-[var(--text-primary)] transition-all uppercase"
                onClick={() => setConfirmDeleteId(null)}
              >
                ביטול
              </button>
            </div>
          </motion.div>,
          document.body
        )}
      </div>

      {/* Right panel: Top struggles */}
      <div className="w-full xl:w-[450px] flex flex-col gap-8">
        <div className="glass p-8 bg-[rgba(255,75,75,0.02)] border border-[var(--color-danger)]">
          <div className="label-mono text-[var(--color-danger)] text-xl border-b border-[var(--color-danger)] pb-3 mb-6 uppercase tracking-widest flex items-center gap-3">
            <AlertTriangle size={24} /> נקודות קושי מובילות
          </div>

          {summary?.topStruggles?.length > 0 ? (
            <div className="flex flex-col gap-6">
              {summary.topStruggles.map((s: { point: string; count: number }, i: number) => (
                <div key={i} className="glass p-6 bg-[var(--bg-void)] border border-[var(--border-default)] hover:border-[var(--color-danger)] transition-colors relative overflow-hidden group">
                  <div className="absolute left-0 top-0 h-full w-1 bg-[#ff4b4b] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex justify-between items-center gap-4">
                    <div className="text-base text-[var(--text-primary)] font-bold leading-tight">{s.point}</div>
                    <div className="label-mono px-3 py-2 bg-[rgba(255,75,75,0.1)] text-[var(--color-danger)] border border-[var(--color-danger)] whitespace-nowrap">
                      {s.count} שיחות
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-[#8ab098] border border-dashed border-[var(--border-default)]">
              אין מספיק נתונים עדיין
            </div>
          )}
        </div>

        <div className="glass p-8 bg-[var(--color-primary-muted)] border border-[var(--color-primary)]">
          <div className="label-mono text-[var(--color-primary)] text-xl border-b border-[var(--color-primary)] pb-3 mb-6 uppercase tracking-widest">
            חלוקת סוגי שיחות
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-[var(--border-default)] pb-4">
              <span className="label-mono px-4 py-2 bg-[rgba(0,255,136,0.1)] border border-[var(--color-primary)] text-[var(--color-primary)] uppercase tracking-widest text-lg">תרגול</span>
              <span className="font-black text-4xl text-[var(--text-primary)]">{chats.filter((c: any) => c.agentType === 'practice').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="label-mono px-4 py-2 bg-[rgba(245,212,79,0.1)] border border-[var(--color-warning)] text-[var(--color-warning)] uppercase tracking-widest text-lg">שיעורי בית</span>
              <span className="font-black text-4xl text-[var(--text-primary)]">{chats.filter((c: any) => c.agentType === 'homework').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

