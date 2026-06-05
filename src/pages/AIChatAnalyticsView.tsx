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

  const SentimentIcon = (s: string) => s === 'frustrated' ? <Frown size={24} color="#ff4b4b" /> : s === 'confident' ? <Smile size={24} color="var(--neon-emerald)" /> : <Meh size={24} color="#f5d44f" />;
  const sentimentLabel = (s: string) => s === 'frustrated' ? 'מתוסכל' : s === 'confident' ? 'בטוח' : 'ניטרלי';
  const sentimentColor = (s: string) => s === 'frustrated' ? '#ff4b4b' : s === 'confident' ? 'var(--neon-emerald)' : '#f5d44f';

  return (
    <div className="w-full h-full flex flex-col xl:flex-row gap-8 p-8 min-h-screen bg-[#050b08] text-[#c0f8d1]">
      <div className="flex-1 flex flex-col">
        <div className="mb-12 border-b-2 border-[var(--neon-emerald)] pb-8">
          <h1 className="text-6xl font-black mb-4 text-[var(--neon-emerald)] drop-shadow-[0_0_15px_rgba(0,255,136,0.5)] tracking-tighter uppercase flex items-center gap-4">
            <Bot size={56} className="text-[var(--acid-green)] drop-shadow-[0_0_10px_var(--acid-green)]" />
            אנליטיקת<br />שיחות AI
          </h1>
          <p className="t-mono-label text-xl text-[var(--acid-green)]">
            מעקב אחרי כל האינטראקציות של התלמידים עם מורה AI <span className="text-[var(--neon-emerald)] font-bold">מייקל פאראדיי</span>.
          </p>
        </div>

        {/* Summary shards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="shard p-8 bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] shadow-[0_0_20px_rgba(0,255,136,0.1)] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-[var(--neon-emerald)]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-[var(--neon-emerald)]" />
            <div className="t-mono-label text-[var(--acid-green)] mb-3 text-lg uppercase tracking-widest">סך שיחות</div>
            <div className="text-6xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{summary?.totalChats ?? 0}</div>
          </div>
          
          <div className="shard p-8 bg-[rgba(0,255,136,0.02)] border border-[var(--neon-emerald)] shadow-[0_0_15px_rgba(0,255,136,0.05)] flex flex-col items-center justify-center">
            <div className="t-mono-label text-[var(--acid-green)] mb-3 text-lg uppercase tracking-widest">ממוצע בלבול</div>
            <div className="text-6xl font-black" style={{ 
              color: (summary?.avgConfusion ?? 0) > 60 ? "#ff4b4b" : "var(--neon-emerald)", 
              textShadow: (summary?.avgConfusion ?? 0) > 60 ? "0 0 15px #ff4b4b" : "0 0 15px var(--neon-emerald)" 
            }}>
              {summary?.avgConfusion ?? 0}%
            </div>
          </div>
          
          <div className="shard p-8 bg-[rgba(0,255,136,0.02)] border border-[var(--neon-emerald)] shadow-[0_0_15px_rgba(0,255,136,0.05)] flex flex-col items-center justify-center">
            <div className="t-mono-label text-[var(--acid-green)] mb-3 text-lg uppercase tracking-widest">סך הודעות</div>
            <div className="text-6xl font-black text-white">{summary?.totalMessages ?? 0}</div>
          </div>
        </div>

        {/* Sentiment distribution */}
        {summary?.sentimentCounts && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {(['confident', 'neutral', 'frustrated'] as const).map(s => {
               const color = sentimentColor(s);
               return (
                <div key={s} className="shard p-8 bg-[#050b08] border border-[var(--neon-emerald)] flex items-center justify-center gap-8" style={{ borderColor: color, boxShadow: "0 0 15px " + color + "20" }}>
                  <div className="flex items-center justify-center p-3 bg-opacity-10 rounded-none border border-current" style={{ backgroundColor: color + "10", color }}>{SentimentIcon(s)}</div>
                  <div>
                    <div className="t-mono-label text-sm uppercase tracking-wider mb-1" style={{ color }}>{sentimentLabel(s)}</div>
                    <div className="font-black text-3xl text-white">{summary.sentimentCounts[s] ?? 0}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chat list */}
        <div className="t-mono-label text-[var(--neon-emerald)] text-xl border-b border-[var(--neon-emerald)] pb-3 mb-6 uppercase tracking-widest flex items-center justify-between">
          <span>שיחות אחרונות</span>
          <span className="text-sm text-[var(--acid-green)]">{chats.length} שיחות</span>
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
            <div className="shard p-16 text-center bg-[rgba(0,255,136,0.02)] border border-dashed border-[var(--neon-emerald)]">
              <Bot size={64} className="text-[var(--neon-emerald)] opacity-50 mx-auto mb-6" />
              <div className="text-2xl font-bold text-white mb-3">עוד אין שיחות AI</div>
              <div className="t-mono-label text-[var(--acid-green)] opacity-80 text-lg">כשתלמידים ישתמשו במורה AI, השיחות יופיעו כאן.</div>
            </div>
          ) : (
            chats.map((chat: any) => (
              <motion.div
                key={chat._id}
                className="shard p-8 cursor-pointer bg-[rgba(0,255,136,0.03)] border transition-all"
                style={{ 
                  borderColor: selectedChatId === chat._id ? 'var(--neon-emerald)' : '#1a3324',
                  boxShadow: selectedChatId === chat._id ? '0 0 20px rgba(0,255,136,0.15)' : 'none'
                }}
                onClick={() => setSelectedChatId(selectedChatId === chat._id ? null : chat._id)}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
                whileHover={{ scale: 1.005, borderColor: 'var(--neon-emerald)', backgroundColor: 'rgba(0,255,136,0.08)' }}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-4">
                  <div className="flex items-center gap-6">
                    <CyberAvatar name={chat.studentName || '?'} size={48} />
                    <div>
                      <div className="text-xl font-bold text-white">{chat.studentName}</div>
                      <div className="t-mono-label text-[var(--acid-green)] text-sm mt-1">{chat.title}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className="t-mono-label px-3 py-1 border uppercase text-xs tracking-widest" style={{ 
                      borderColor: chat.agentType === 'practice' ? 'var(--neon-emerald)' : '#f5d44f',
                      color: chat.agentType === 'practice' ? 'var(--neon-emerald)' : '#f5d44f',
                      backgroundColor: chat.agentType === 'practice' ? 'rgba(0,255,136,0.1)' : 'rgba(245,212,79,0.1)'
                    }}>
                      {chat.agentType === 'practice' ? 'תרגול' : 'שיעורי בית'}
                    </span>
                    <div className="t-mono-label text-[var(--acid-green)] flex items-center gap-2">
                      <MessageSquare size={16} /> {chat.messageCount} הודעות
                    </div>
                    <button
                      className="cyber-btn w-10 h-10 flex items-center justify-center bg-transparent border border-[#1a3324] text-[#8ab098] hover:border-[#ff4b4b] hover:text-[#ff4b4b] hover:bg-[rgba(255,75,75,0.1)] transition-all"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(chat._id); }}
                      title="מחק שיחה"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {chat.metrics ? (
                  <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-[#1a3324]">
                    <div className="flex flex-wrap gap-3">
                      <div className="t-mono-label flex items-center gap-2 px-3 py-1 border" style={{ borderColor: sentimentColor(chat.metrics.sentiment), color: sentimentColor(chat.metrics.sentiment), backgroundColor: `${sentimentColor(chat.metrics.sentiment)}10` }}>
                        {SentimentIcon(chat.metrics.sentiment)} {sentimentLabel(chat.metrics.sentiment)}
                      </div>
                      <div className="t-mono-label flex items-center px-3 py-1 border border-[var(--neon-emerald)] text-[var(--neon-emerald)] bg-[rgba(0,255,136,0.05)]">
                        בלבול: <span className="font-bold ml-2 text-white">{chat.metrics.confusionScore}%</span>
                      </div>
                      {chat.metrics.keyStrugglePoints?.slice(0, 2).map((p: string, i: number) => (
                        <div key={i} className="t-mono-label flex items-center gap-2 px-3 py-1 border border-[#ff4b4b] text-[#ff4b4b] bg-[rgba(255,75,75,0.05)]">
                          <AlertTriangle size={14} /> {p}
                        </div>
                      ))}
                    </div>
                    
                    {chat.metrics.missingKnowledge && chat.metrics.missingKnowledge.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {chat.metrics.missingKnowledge.map((mk: string, i: number) => (
                          <span key={i} className="t-mono-label px-3 py-1 border border-dashed border-[#f5d44f] text-[#f5d44f] bg-[rgba(245,212,79,0.05)]">
                            🧩 חסר: {mk}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {chat.metrics.teacherActionItem && (
                      <div className="mt-3 p-3 bg-[rgba(0,255,136,0.1)] border-l-4 border-[var(--neon-emerald)] text-white text-sm font-bold flex items-start gap-3">
                        <span className="text-[var(--neon-emerald)] text-xl">🎯</span> {chat.metrics.teacherActionItem}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-[#1a3324] flex items-center justify-between bg-[rgba(245,212,79,0.02)] p-4">
                    <span className="t-mono-label text-[#f5d44f] flex items-center gap-2">
                      <AlertTriangle size={16} /> שיחה זו נסגרה בטרם נותחה.
                    </span>
                    {selectedChatId === chat._id && chatMessages ? (
                      <button 
                        className="cyber-btn py-1 px-4 text-xs flex items-center gap-2"
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
                      <span className="t-mono-label text-[10px] opacity-50">פתח את השיחה כדי לנתח</span>
                    )}
                  </div>
                )}

                {/* Expanded chat transcript */}
                {selectedChatId === chat._id && chatMessages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 p-6 bg-[#050b08] border border-[var(--neon-emerald)] max-h-[500px] overflow-y-auto relative"
                  >
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px)', backgroundSize: '100% 4px' }} />
                    
                    {chatMessages.map((msg: any, i: number) => (
                      <div key={i} className="mb-6 relative z-10">
                        <div className="t-mono-label mb-2 flex items-center gap-2" style={{ color: msg.role === 'user' ? 'var(--neon-emerald)' : msg.role === 'assistant' ? 'var(--acid-green)' : '#8ab098' }}>
                          {msg.role === 'user' ? <><User size={14} /> תלמיד</> : msg.role === 'assistant' ? <><Bot size={14} /> ת'אורם</> : <><FileText size={14} /> מערכת</>}
                        </div>
                        <div className="text-base text-white leading-relaxed p-4 border bg-opacity-10" style={{ 
                          borderColor: msg.role === 'user' ? 'var(--neon-emerald)' : msg.role === 'assistant' ? 'var(--acid-green)' : '#1a3324',
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
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 shard p-8 bg-[#050b08] border-2 border-[#ff4b4b] shadow-[0_0_40px_rgba(255,75,75,0.3)] flex items-center gap-8"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-[rgba(255,75,75,0.1)] text-[#ff4b4b] border border-[#ff4b4b]">
              <AlertTriangle size={24} />
            </div>
            <span className="font-bold text-xl text-white">למחוק את השיחה לצמיתות?</span>
            <div className="flex gap-4">
              <button
                className="cyber-btn px-6 py-3 bg-[#ff4b4b] text-black font-black uppercase hover:bg-white hover:text-[#ff4b4b] transition-all"
                onClick={async () => {
                  await deleteChatMut({ chatId: confirmDeleteId as any });
                  setConfirmDeleteId(null);
                  if (selectedChatId === confirmDeleteId) setSelectedChatId(null);
                }}
              >
                מחק
              </button>
              <button
                className="cyber-btn px-6 py-3 bg-transparent border border-[#1a3324] text-[#8ab098] hover:border-white hover:text-white transition-all uppercase"
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
        <div className="shard p-8 bg-[rgba(255,75,75,0.02)] border border-[#ff4b4b]">
          <div className="t-mono-label text-[#ff4b4b] text-xl border-b border-[#ff4b4b] pb-3 mb-6 uppercase tracking-widest flex items-center gap-3">
            <AlertTriangle size={24} /> נקודות קושי מובילות
          </div>

          {summary?.topStruggles?.length > 0 ? (
            <div className="flex flex-col gap-6">
              {summary.topStruggles.map((s: { point: string; count: number }, i: number) => (
                <div key={i} className="shard p-6 bg-[#050b08] border border-[#1a3324] hover:border-[#ff4b4b] transition-colors relative overflow-hidden group">
                  <div className="absolute left-0 top-0 h-full w-1 bg-[#ff4b4b] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex justify-between items-center gap-4">
                    <div className="text-base text-white font-bold leading-tight">{s.point}</div>
                    <div className="t-mono-label px-3 py-2 bg-[rgba(255,75,75,0.1)] text-[#ff4b4b] border border-[#ff4b4b] whitespace-nowrap">
                      {s.count} שיחות
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-[#8ab098] border border-dashed border-[#1a3324]">
              אין מספיק נתונים עדיין
            </div>
          )}
        </div>

        <div className="shard p-8 bg-[rgba(0,255,136,0.02)] border border-[var(--neon-emerald)]">
          <div className="t-mono-label text-[var(--neon-emerald)] text-xl border-b border-[var(--neon-emerald)] pb-3 mb-6 uppercase tracking-widest">
            חלוקת סוגי שיחות
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-[#1a3324] pb-4">
              <span className="t-mono-label px-4 py-2 bg-[rgba(0,255,136,0.1)] border border-[var(--neon-emerald)] text-[var(--neon-emerald)] uppercase tracking-widest text-lg">תרגול</span>
              <span className="font-black text-4xl text-white">{chats.filter((c: any) => c.agentType === 'practice').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="t-mono-label px-4 py-2 bg-[rgba(245,212,79,0.1)] border border-[#f5d44f] text-[#f5d44f] uppercase tracking-widest text-lg">שיעורי בית</span>
              <span className="font-black text-4xl text-white">{chats.filter((c: any) => c.agentType === 'homework').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
