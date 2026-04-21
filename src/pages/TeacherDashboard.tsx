import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Bell, Mail, User, Search, Map as MapIcon, BookOpen, BarChart2, Activity, AlertTriangle, FileText, Settings, HelpCircle, Plus, ChevronDown, RefreshCw, MessageSquare, Bot } from "lucide-react";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const classroom = useQuery(api.classroom.getFirstClassroom);
  const heatmap = useQuery(api.classroom.getClassroomHeatmap, classroom ? { classroomId: classroom._id } : "skip");
  const aiAnalytics = useQuery(api.aiChat.getTeacherChatAnalytics, classroom ? { classroomId: classroom._id } : "skip");
  const [activeTab, setActiveTab] = useState<"heatmap" | "aiChats">("heatmap");

  if (!heatmap) return null;

  const counts = heatmap.reduce((acc, s) => { acc[s.status]++; return acc; }, { green: 0, yellow: 0, red: 0 });

  return (
    <div className="app-layout">
      {/* ── סרגל צד ── */}
      <aside className="app-sidebar">
        <div className="app-brand" style={{ marginBottom: 24 }}>
          <span>FARADAY</span> Logic
        </div>

        {/* כרטיס אנליטיקה מדויקת */}
        <div className="card" style={{ padding: 12, marginBottom: 24, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-high)" }}>
          <div style={{ width: 32, height: 32, borderRadius: "var(--r-sm)", background: "rgba(52,250,89,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart2 size={16} color="var(--primary-dim)" />
          </div>
          <div>
            <div className="t-mini-title" style={{ margin: 0, color: "var(--text)" }}>אנליטיקה<br/>מדויקת</div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-faint)", marginTop: 2 }}>חדו״א III - חלק 8</div>
          </div>
        </div>

        <button className="new-proof-btn">
          <Plus size={16} /> הוכחה חדשה
        </button>

        <div className="flex-col" style={{ gap: 4, flex: 1 }}>
          <button className="nav-item" onClick={() => navigate("/")}><MapIcon size={18} /> מפת למידה</button>
          <button className="nav-item"><BookOpen size={18} /> תרגול</button>
          <button className="nav-item"><BarChart2 size={18} /> סטטיסטיקות</button>
          <button className="nav-item active"><Activity size={18} /> מפת חום</button>
          <button className="nav-item"><AlertTriangle size={18} /> התראות</button>
          <button className="nav-item"><FileText size={18} /> שיעורי בית</button>
        </div>

        <div className="flex-col" style={{ gap: 4, marginTop: "auto" }}>
          <button className="nav-item"><Settings size={18} /> הגדרות</button>
          <button className="nav-item"><HelpCircle size={18} /> תמיכה</button>
        </div>
      </aside>

      {/* ── אזור ראשי ── */}
      <div className="app-content-wrapper">
        {/* טופ בר */}
        <header className="app-topbar">
          <div className="topbar-links">
            <div className="topbar-link">שיעור חי</div>
            <div className={`topbar-link ${activeTab === 'heatmap' ? 'active' : ''}`} onClick={() => setActiveTab('heatmap')} style={{ cursor: 'pointer' }}>מפת חום</div>
            <div className={`topbar-link ${activeTab === 'aiChats' ? 'active' : ''}`} onClick={() => setActiveTab('aiChats')} style={{ cursor: 'pointer' }}>🤖 שיחות AI</div>
            <div className="topbar-link">תוכנית לימודים</div>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16} color="var(--text-faint)" />
              <input type="text" placeholder="חיפוש הוכחות..." />
            </div>
            <Bell size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
            <Mail size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
            <User size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
          </div>
        </header>

        {/* תוכן מפוצל */}
        <div className="app-main">
          {activeTab === 'heatmap' ? (
            <HeatmapView heatmap={heatmap} counts={counts} />
          ) : (
            <AIChatAnalyticsView analytics={aiAnalytics} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Heatmap View (original content) ── */
function HeatmapView({ heatmap, counts }: { heatmap: any[]; counts: { green: number; yellow: number; red: number } }) {
  return (
    <>
      {/* עמודה מרכזית: רשת מפת חום */}
      <div className="app-center">
        
        <div className="flex justify-between items-start" style={{ marginBottom: 40 }}>
          <div style={{ maxWidth: 400 }}>
            <h1 className="t-h1" style={{ marginBottom: 16 }}>מפת חום<br/>כיתתית<br/>בזמן אמת</h1>
            <p className="t-sub" style={{ fontSize: "1rem" }}>
              מעקב חי אחרי {heatmap.length} תלמידים ב<span style={{ color: "var(--primary-dim)" }}>אלגברה מתקדמת: אריתמטיקה מודולרית</span>.
            </p>
          </div>

          {/* תיבת מקרא סטטוסים */}
          <div className="card" style={{ display: "flex", padding: "16px 24px", gap: 32, alignItems: "center" }}>
            <div>
              <div className="flex items-center gap-2 t-mini-title" style={{ color: "var(--text)", margin: 0 }}><div className="dot dot-green" /> שולט</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>({counts.green})</div>
            </div>
            <div>
              <div className="flex items-center gap-2 t-mini-title" style={{ color: "var(--text)", margin: 0 }}><div className="dot dot-yellow" /> מתקשה</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>({counts.yellow})</div>
            </div>
            <div>
              <div className="flex items-center gap-2 t-mini-title" style={{ color: "var(--text)", margin: 0 }}><div className="dot dot-red" style={{ borderRadius: 2, height: 12, width: 4 }} /> סיכון<br/>גבוה</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>({counts.red})</div>
            </div>
          </div>
        </div>

        {/* שורת מסננים */}
        <div className="flex justify-between items-end" style={{ marginBottom: 24 }}>
          <div className="flex gap-4">
            <div>
              <div className="t-mini-title">אשכול כיתה</div>
              <div className="search-box" style={{ width: 180, justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: "0.85rem" }}>אלגברה מתקדמת</span>
                <ChevronDown size={14} color="var(--text-faint)" />
              </div>
            </div>
            <div>
              <div className="t-mini-title">נושא פעיל</div>
              <div className="search-box" style={{ width: 180, justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: "0.85rem" }}>הוכחות מורכבות 4</span>
                <ChevronDown size={14} color="var(--text-faint)" />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <div className="t-mini-title">רמת סיכון</div>
              <div className="flex gap-2">
                <button className="key-btn" style={{ width: 40, height: 40 }}><div className="dot dot-green"/></button>
                <button className="key-btn" style={{ width: 40, height: 40 }}><div className="dot dot-yellow"/></button>
                <button className="key-btn" style={{ width: 40, height: 40, border: "1px solid var(--danger)", background: "rgba(254,111,107,0.1)" }}><div className="dot dot-red" style={{ borderRadius: 2, height: 12, width: 4 }}/></button>
              </div>
            </div>
            <button className="key-btn" style={{ padding: "0 16px", height: 40, fontSize: "0.85rem", fontFamily: "var(--font-body)", fontWeight: 700 }}>
              <RefreshCw size={14} style={{ marginLeft: 8 }} /> סנכרון מאולץ
            </button>
          </div>
        </div>

        {/* רשת תלמידים */}
        <div className="heatmap-grid pb-12">
          {heatmap.map(({ student, status, isStuck, recentAttempts }) => {
            const filled = recentAttempts ? recentAttempts.filter((a: any) => a.isCorrect).length : 0;
            const total = recentAttempts ? recentAttempts.length : 0;
            
            return (
              <div key={student._id} className={`student-card s-${status}`}>
                <div className="flex items-start gap-3" style={{ marginBottom: 16 }}>
                  <div className="avatar" style={{ width: 36, height: 36, background: student.avatarColor }}>
                    {student.name.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="flex justify-between w-full">
                      <div className="t-mini-title" style={{ margin: 0, color: status === 'red' ? "var(--danger)" : status === 'green' ? "var(--primary-dim)" : "var(--warning)" }}>
                        {status === 'red' ? 'בסיכון' : status === 'green' ? 'שולט' : 'מתקשה'}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.2 }}>{student.name}</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-end" style={{ marginBottom: 6 }}>
                  <div>
                    <div className="t-mini-title" style={{ margin: 0 }}>שלב 6M</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{filled}/{total || 12} {isStuck && <span style={{ color: "var(--danger)" }}>תקוע</span>}</div>
                  </div>
                  {status === "green" && <div className="t-mini-title" style={{ color: "var(--primary-dim)", margin: 0 }}>הושלם</div>}
                </div>

                <div className="seg-bar">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="seg" style={{ background: i < 3 ? (status==='red'?'var(--danger)':status==='green'?'var(--primary-dim)':'var(--warning)') : "var(--surface-highest)" }} />
                  ))}
                </div>
              </div>
            );
          })}
          {[...Array(9)].map((_, i) => (
            <div key={`empty-${i}`} className="student-card s-empty">
              <div className="flex items-start gap-3" style={{ marginBottom: 16 }}>
                <div className="avatar" style={{ width: 36, height: 36, background: "var(--surface-highest)" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  <div style={{ height: 12, width: "60%", background: "var(--surface-highest)", borderRadius: 2 }} />
                  <div style={{ height: 16, width: "80%", background: "var(--surface-highest)", borderRadius: 2 }} />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* פאנל ימני: תובנות */}
      <div className="app-right-panel">
        <div className="t-mini-title" style={{ marginBottom: 24, color: "var(--text)" }}>תובנות בזמן אמת</div>

        {/* כרטיס התערבות דחופה */}
        <div className="card" style={{ background: "transparent", border: "1px solid rgba(254,111,107,0.3)", padding: 20, marginBottom: 32 }}>
          <div className="flex items-center gap-2 t-mini-title" style={{ color: "var(--danger)", marginBottom: 12 }}>
            <span style={{ fontSize: "1.2rem", fontWeight: 900 }}>!</span> התערבות דחופה
          </div>
          <p className="t-sub" style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
            5 תלמידים נכשלים בחישוב ההופכי המודולרי ב<strong style={{ color: "#fff" }}>שלב 4</strong>. זמן עיכוב ממוצע: 6 דקות ו-12 שניות.
          </p>
          <button className="btn-danger" style={{ background: "var(--danger)", color: "#000" }}>
            שליחת טיפ לכיתה
          </button>
        </div>

        {/* אבני דרך אחרונות */}
        <div className="t-mini-title" style={{ marginBottom: 16, color: "var(--text)" }}>אבני דרך אחרונות</div>
        <div className="flex-col" style={{ gap: 16, marginBottom: 32 }}>
          {[
            { n: "אלנה פ.", a: "השלימה הוכחה 4.2", t: "לפני 2 שניות · 98% דיוק" },
            { n: "שרה כ.", a: "השלימה הוכחה 4.2", t: "לפני 14 שניות · 94% דיוק" },
            { n: "מרקוס י.", a: "פתח רמז 2", t: "לפני 45 שניות" },
          ].map((m, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="dot dot-green" style={{ marginTop: 6 }} />
              <div>
                <div style={{ fontSize: "0.85rem" }}><strong>{m.n}</strong> {m.a}</div>
                <div className="t-sub" style={{ fontSize: "0.75rem", marginTop: 2 }}>{m.t}</div>
              </div>
            </div>
          ))}
        </div>

        {/* כרטיס מהירות הפעלה גלובלית */}
        <div className="card" style={{ padding: 20 }}>
          <div className="t-mini-title" style={{ color: "var(--primary-dim)", marginBottom: 12 }}>מהירות שיעור גלובלית</div>
          <div style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "2.5rem", lineHeight: 1, marginBottom: 16 }}>
            4.2 <span style={{ fontSize: "1rem", color: "var(--text-muted)", fontWeight: 600, fontStyle: "italic", verticalAlign: "middle" }}>צעדים/דקה</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 8 }}>
            <div style={{ width: "72%", height: "100%", background: "var(--primary-dim)", borderRadius: 2 }} />
          </div>
          <div style={{ textAlign: "left", fontSize: "0.7rem", color: "var(--text-faint)" }}>
            72% התקדמות ליעד
          </div>
        </div>

      </div>
    </>
  );
}

/* ── AI Chat Analytics View ── */
function AIChatAnalyticsView({ analytics }: { analytics: any }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const chatMessages = useQuery(
    api.aiChat.getChatMessages,
    selectedChatId ? { chatId: selectedChatId as any } : "skip"
  );

  const summary = analytics?.summary;
  const chats = analytics?.chats ?? [];

  const sentimentEmoji = (s: string) => s === 'frustrated' ? '😤' : s === 'confident' ? '💪' : '😐';
  const sentimentLabel = (s: string) => s === 'frustrated' ? 'מתוסכל' : s === 'confident' ? 'בטוח' : 'ניטרלי';

  return (
    <>
      <div className="app-center">
        <div style={{ marginBottom: 40 }}>
          <h1 className="t-h1" style={{ marginBottom: 16 }}>
            <Bot size={32} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 12 }} />
            אנליטיקת<br/>שיחות AI
          </h1>
          <p className="t-sub" style={{ fontSize: "1rem" }}>
            מעקב אחרי כל האינטראקציות של התלמידים עם מורה AI  מייקל פאראדיי .
          </p>
        </div>

        {/* Summary cards */}
        <div className="flex gap-4" style={{ marginBottom: 32 }}>
          <div className="card" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
            <div className="t-mini-title" style={{ marginBottom: 8 }}>סך שיחות</div>
            <div style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "2rem", color: "var(--primary-dim)" }}>
              {summary?.totalChats ?? 0}
            </div>
          </div>
          <div className="card" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
            <div className="t-mini-title" style={{ marginBottom: 8 }}>ממוצע בלבול</div>
            <div style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "2rem", color: (summary?.avgConfusion ?? 0) > 60 ? "var(--danger)" : "var(--warning)" }}>
              {summary?.avgConfusion ?? 0}%
            </div>
          </div>
          <div className="card" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
            <div className="t-mini-title" style={{ marginBottom: 8 }}>סך הודעות</div>
            <div style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "2rem", color: "var(--text)" }}>
              {summary?.totalMessages ?? 0}
            </div>
          </div>
        </div>

        {/* Sentiment distribution */}
        {summary?.sentimentCounts && (
          <div className="flex gap-4" style={{ marginBottom: 32 }}>
            {(['confident', 'neutral', 'frustrated'] as const).map(s => (
              <div key={s} className="card" style={{ flex: 1, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '1.5rem' }}>{sentimentEmoji(s)}</div>
                <div>
                  <div className="t-mini-title" style={{ margin: 0 }}>{sentimentLabel(s)}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{summary.sentimentCounts[s] ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat list */}
        <div className="t-mini-title" style={{ marginBottom: 16, color: "var(--text)" }}>שיחות אחרונות</div>
        <div className="flex-col" style={{ gap: 8 }}>
          {chats.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bot size={48} color="var(--text-faint)" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>עוד אין שיחות AI</div>
              <div className="t-sub" style={{ marginTop: 8 }}>כשתלמידים ישתמשו במורה AI, השיחות יופיעו כאן.</div>
            </div>
          ) : (
            chats.map((chat: any) => (
              <div
                key={chat._id}
                className="card"
                style={{ padding: 16, cursor: 'pointer', border: selectedChatId === chat._id ? '1px solid var(--primary-dim)' : undefined }}
                onClick={() => setSelectedChatId(selectedChatId === chat._id ? null : chat._id)}
              >
                <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                  <div className="flex items-center gap-3">
                    <div className="avatar" style={{ width: 32, height: 32, background: chat.studentAvatar || 'var(--surface-highest)' }}>
                      {(chat.studentName || '?')[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{chat.studentName}</div>
                      <div className="t-sub" style={{ fontSize: '0.75rem' }}>{chat.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`chat-agent-badge ${chat.agentType}`}>
                      {chat.agentType === 'practice' ? 'תרגול' : 'שיעורי בית'}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      <MessageSquare size={12} style={{ display: 'inline', marginLeft: 4 }} /> {chat.messageCount}
                    </div>
                  </div>
                </div>

                {chat.metrics && (
                  <div className="flex gap-4" style={{ marginTop: 8 }}>
                    <div className="context-chip">
                      {sentimentEmoji(chat.metrics.sentiment)} {sentimentLabel(chat.metrics.sentiment)}
                    </div>
                    <div className="context-chip">
                      בלבול: {chat.metrics.confusionScore}%
                    </div>
                    {chat.metrics.keyStrugglePoints?.slice(0, 2).map((p: string, i: number) => (
                      <div key={i} className="context-chip">⚠️ {p}</div>
                    ))}
                  </div>
                )}

                {/* Expanded chat transcript */}
                {selectedChatId === chat._id && chatMessages && (
                  <div style={{ marginTop: 16, padding: 16, background: 'var(--surface)', borderRadius: 'var(--r-md)', maxHeight: 300, overflowY: 'auto' }}>
                    {chatMessages.map((msg: any, i: number) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '0.7rem', color: msg.role === 'user' ? 'var(--primary-dim)' : 'var(--text-faint)', fontWeight: 800, marginBottom: 4 }}>
                          {msg.role === 'user' ? '🧑‍🎓 תלמיד' : msg.role === 'assistant' ? '🤖 ת׳אורם' : '📋 מערכת'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{msg.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Top struggles */}
      <div className="app-right-panel">
        <div className="t-mini-title" style={{ marginBottom: 24, color: "var(--text)" }}>🔥 נקודות קושי מובילות</div>
        
        {summary?.topStruggles?.length > 0 ? (
          <div className="flex-col" style={{ gap: 12 }}>
            {summary.topStruggles.map((s: { point: string; count: number }, i: number) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="flex justify-between items-center">
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{s.point}</div>
                  <div className="context-chip" style={{ background: 'rgba(254,111,107,0.15)', color: 'var(--danger)' }}>
                    {s.count} שיחות
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-faint)' }}>
            אין מספיק נתונים עדיין
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          <div className="t-mini-title" style={{ marginBottom: 12, color: "var(--text)" }}>חלוקת סוגי שיחות</div>
          <div className="card" style={{ padding: 20 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
              <span className="chat-agent-badge practice">תרגול</span>
              <span style={{ fontWeight: 800 }}>{chats.filter((c: any) => c.agentType === 'practice').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="chat-agent-badge homework">שיעורי בית</span>
              <span style={{ fontWeight: 800 }}>{chats.filter((c: any) => c.agentType === 'homework').length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
