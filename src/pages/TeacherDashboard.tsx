import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Bell, Mail, User, Search, Map as MapIcon, BookOpen, BarChart2, Activity, AlertTriangle, FileText, Settings, HelpCircle, Plus, ChevronDown, RefreshCw, MessageSquare, Bot, Frown, Smile, Meh, ArrowRight, TrendingUp, Zap, ChevronRight, Clock, CheckCircle2, Users, Calendar, Send, XCircle, Trash2 } from "lucide-react";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const classroom = useQuery(api.classroom.getFirstClassroom);
  const heatmap = useQuery(api.classroom.getClassroomHeatmap, classroom ? { classroomId: classroom._id } : "skip");
  const aiAnalytics = useQuery(api.aiChat.getTeacherChatAnalytics, classroom ? { classroomId: classroom._id } : "skip");
  const dashboardStats = useQuery(api.classroom.getDashboardStats, classroom ? { classroomId: classroom._id } : "skip");
  const liveAlerts = useQuery(api.classroom.getLiveAlerts, classroom ? { classroomId: classroom._id } : "skip");
  const [activeTab, setActiveTab] = useState<"heatmap" | "aiChats" | "powerMap" | "homework">("heatmap");
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);

  if (!heatmap) return null;

  const counts = heatmap.reduce((acc, s) => { acc[s.status]++; return acc; }, { green: 0, yellow: 0, red: 0 });

  return (
    <div className="app-layout">
      {/* ── סרגל צד ── */}
      <aside className="app-sidebar">
        <div className="app-brand mb-6">
          <span>FARADAY</span> Logic
        </div>

        {/* כרטיס אנליטיקה מדויקת */}
        <div className="card flex items-center gap-3 p-3 mb-6" style={{ background: "var(--surface-high)" }}>
          <div className="icon-box" style={{ background: "rgba(52,250,89,0.1)" }}>
            <BarChart2 size={16} color="var(--primary-dim)" />
          </div>
          <div>
            <div className="t-mini-title mb-0 text-default">אנליטיקה<br />מדויקת</div>
            <div className="text-2xs text-faint mt-1">חדו״א III - חלק 8</div>
          </div>
        </div>

        <button className="new-proof-btn">
          <Plus size={16} /> הוכחה חדשה
        </button>

        <div className="flex-col gap-1 flex-1">
          <button className="nav-item" onClick={() => navigate("/")}><MapIcon size={18} /> מפת למידה</button>
          <button className="nav-item"><BookOpen size={18} /> תרגול</button>
          <button className="nav-item"><BarChart2 size={18} /> סטטיסטיקות</button>
          <button className="nav-item active"><Activity size={18} /> מפת חום</button>
          <button className="nav-item"><AlertTriangle size={18} /> התראות</button>
          <button className="nav-item"><FileText size={18} /> שיעורי בית</button>
        </div>

        <div className="flex-col gap-1 mt-auto">
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
            <div className={`topbar-link ${activeTab === 'aiChats' ? 'active' : ''}`} onClick={() => setActiveTab('aiChats')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Bot size={16} /> שיחות AI</div>
            <div className={`topbar-link ${activeTab === 'powerMap' ? 'active' : ''}`} onClick={() => setActiveTab('powerMap')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={16} /> פרופיל תלמיד</div>
            <div className={`topbar-link ${activeTab === 'homework' ? 'active' : ''}`} onClick={() => setActiveTab('homework')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={16} /> שיעורי בית</div>
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
          <AnimatePresence mode="wait">
            {activeTab === 'heatmap' ? (
              <motion.div key="heatmap" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ flex: 1, display: 'flex', width: '100%' }}>
                <HeatmapView heatmap={heatmap} counts={counts} classroom={classroom} dashboardStats={dashboardStats} liveAlerts={liveAlerts} onStudentClick={(id: Id<"students">) => { setSelectedStudentId(id); setActiveTab('powerMap'); }} />
              </motion.div>
            ) : activeTab === 'aiChats' ? (
              <motion.div key="aiChats" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ flex: 1, display: 'flex', width: '100%' }}>
                <AIChatAnalyticsView analytics={aiAnalytics} />
              </motion.div>
            ) : activeTab === 'powerMap' ? (
              <motion.div key="powerMap" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ flex: 1, display: 'flex', width: '100%' }}>
                <StudentPowerMapView studentId={selectedStudentId} onBack={() => setActiveTab('heatmap')} />
              </motion.div>
            ) : (
              <motion.div key="homework" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ flex: 1, display: 'flex', width: '100%' }}>
                <HomeworkManagementView classroomId={classroom?._id ?? null} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Heatmap View (original content) ── */
function HeatmapView({ heatmap, counts, classroom, dashboardStats, liveAlerts, onStudentClick }: { heatmap: any[]; counts: { green: number; yellow: number; red: number }; classroom: any; dashboardStats: any; liveAlerts: any; onStudentClick: (id: Id<"students">) => void }) {
  const pendingLevels = useQuery(api.levels.getPendingSuggestions, classroom ? { classroomId: classroom._id } : "skip");
  const resolveLevel = useMutation(api.levels.resolveSuggestion);

  return (
    <>
      {/* עמודה מרכזית: רשת מפת חום */}
      <div className="app-center">

        <div className="flex justify-between items-start mb-10">
          <div style={{ maxWidth: 400 }}>
            <h1 className="t-h1 mb-4">מפת חום<br />כיתתית<br />בזמן אמת</h1>
            <p className="t-sub text-base">
              מעקב חי אחרי {heatmap.length} תלמידים ב<span className="text-primary">{classroom?.name ?? "כיתה"}</span>.
            </p>
          </div>

          {/* תיבת מקרא סטטוסים */}
          <div className="card flex items-center gap-6" style={{ padding: "4px 24px" }}>
            <div>
              <div className="flex items-center gap-1 t-mini-title mb-0 text-default"><div className="dot dot-green" /> שולט</div>
              <div className="text-sm text-muted mt-1">({counts.green})</div>
            </div>
            <div>
              <div className="flex items-center gap-1 t-mini-title mb-0 text-default"><div className="dot dot-yellow" /> מתקשה</div>
              <div className="text-sm text-muted mt-1">({counts.yellow})</div>
            </div>
            <div>
              <div className="flex items-center gap-1 t-mini-title mb-0 text-default"><div className="dot dot-red" style={{ borderRadius: 2, height: 8, width: 4 }} /> סיכון<br />גבוה</div>
              <div className="text-sm text-muted">({counts.red})</div>
            </div>
          </div>
        </div>

        {/* שורת מסננים */}
        <div className="flex justify-between items-end mb-6">
          <div className="flex gap-4">
            <div>
              <div className="t-mini-title">רמת סיכון</div>
              <div className="flex gap-2">
                <button className="key-btn" style={{ width: 40, height: 40 }}><div className="dot dot-green" /></button>
                <button className="key-btn" style={{ width: 40, height: 40 }}><div className="dot dot-yellow" /></button>
                <button className="key-btn" style={{ width: 40, height: 40, border: "1px solid var(--danger)", background: "rgba(254,111,107,0.1)" }}><div className="dot dot-red" style={{ borderRadius: 2, height: 12, width: 4 }} /></button>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button className="key-btn text-sm font-body fw-700" style={{ padding: "0 16px", height: 40 }}>
              <RefreshCw size={14} style={{ marginLeft: 8 }} /> ריענון הנתונים
            </button>
          </div>
        </div>

        {/* רשת תלמידים */}
        <motion.div
          className="heatmap-grid pb-12"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {heatmap.map(({ student, status, currentTopicName, isStuck, recentAttempts }) => {
            const filled = recentAttempts ? recentAttempts.filter((a: any) => a.isCorrect).length : 0;
            const total = recentAttempts ? recentAttempts.length : 0;
            const attemptsArr = recentAttempts ? [...recentAttempts].reverse() : []; // show chronologically

            return (
              <motion.div
                key={student._id}
                className={`student-card s-${status}`}
                onClick={() => onStudentClick(student._id)}
                style={{ cursor: 'pointer' }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                whileHover={{
                  y: -4,
                  boxShadow: '0 12px 24px rgba(0,0,0,0.2), var(--glass-edge)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)'
                }}
                transition={{ duration: 0.2 }}
              >
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
                    <div className="t-mini-title" style={{ margin: 0, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTopicName || 'נושא פעיל'}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{filled}/{total || 0} {isStuck && <span style={{ color: "var(--danger)" }}>תקוע</span>}</div>
                  </div>
                  {status === "green" && <div className="t-mini-title" style={{ color: "var(--primary-dim)", margin: 0 }}>מצוין</div>}
                </div>

                <div className="seg-bar">
                  {attemptsArr.length > 0 ? attemptsArr.map((a: any, i: number) => (
                    <div key={i} className="seg" style={{ background: a.isCorrect ? 'var(--primary-dim)' : 'var(--danger)' }} title={a.isCorrect ? 'נכון' : 'שגוי'} />
                  )) : (
                    <div className="seg" style={{ background: "var(--surface-highest)", width: '100%' }} title="אין נתונים עדיין" />
                  )}
                </div>
              </motion.div>
            );
          })}
          {heatmap.length < 12 && [...Array(12 - heatmap.length)].map((_, i) => (
            <motion.div
              key={`empty-${i}`}
              className="student-card s-empty"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <div className="flex items-start gap-3" style={{ marginBottom: 16 }}>
                <div className="avatar" style={{ width: 36, height: 36, background: "var(--surface-highest)" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  <div style={{ height: 12, width: "60%", background: "var(--surface-highest)", borderRadius: 2 }} />
                  <div style={{ height: 16, width: "80%", background: "var(--surface-highest)", borderRadius: 2 }} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>

      {/* פאנל ימני: תובנות */}
      <div className="app-right-panel">
        <div className="t-mini-title mb-6 text-default">תובנות בזמן אמת</div>

        {/* כרטיס התערבות דחופה */}
        {liveAlerts && liveAlerts.length > 0 ? (
          <div className="card p-5 mb-8" style={{ background: "transparent", border: "1px solid rgba(254,111,107,0.3)" }}>
            <div className="flex items-center gap-2 t-mini-title mb-3 text-danger">
              <span className="text-lg fw-900">!</span> התערבות דחופה
            </div>
            <p className="t-sub text-sm text-muted mb-4">
              <strong className="text-white">{liveAlerts[0].count} תלמידים</strong> נתקעים ב<strong className="text-white">{liveAlerts[0].topicName}</strong>. 
              <br/>"{liveAlerts[0].questionStem}"
            </p>
            <button className="btn btn-danger">
              שליחת טיפ לכיתה
            </button>
          </div>
        ) : (
          <div className="card p-5 mb-8 text-center" style={{ background: "transparent", border: "1px solid rgba(52,250,89,0.2)" }}>
            <div className="flex items-center justify-center gap-2 t-mini-title mb-2" style={{ color: "var(--primary-dim)" }}>
              <CheckCircle2 size={18} /> הכל מתנהל כשורה
            </div>
            <p className="text-xs text-muted">אין התראות דחופות כרגע.</p>
          </div>
        )}

        {/* Level Suggestions */}
        <div className="t-mini-title mb-4 text-default flex items-center gap-2"><TrendingUp size={16} color="var(--primary-dim)" /> הצעות לקידום רמה</div>
        {pendingLevels && pendingLevels.length > 0 ? (
          <div className="flex-col gap-4 mb-8">
            {pendingLevels.map((s, i) => (
              <div key={i} className="card p-4" style={{ border: '1px solid var(--primary-dim)', background: 'var(--surface)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="avatar" style={{ width: 24, height: 24, background: s.avatarColor || 'var(--surface-highest)' }}>
                      {(s.studentName || '?')[0]}
                    </div>
                    <div>
                      <div className="text-sm fw-800">{s.studentName}</div>
                      <div className="t-sub text-xs">רמה {s.currentLevel} ← רמה {s.suggestedLevel}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted mb-3">{s.reason}</div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" style={{ flex: 1, padding: '4px 0', fontSize: '0.8rem' }} onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'approved' })}>
                    <CheckCircle2 size={14} style={{ display: 'inline', marginLeft: 4 }} /> אישור
                  </button>
                  <button className="btn" style={{ flex: 1, padding: '4px 0', fontSize: '0.8rem', background: 'var(--surface-highest)' }} onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'rejected' })}>
                    <XCircle size={14} style={{ display: 'inline', marginLeft: 4 }} /> דחייה
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-4 mb-8 text-center text-faint text-sm">
            אין הצעות קידום כרגע.
          </div>
        )}

        {/* אבני דרך אחרונות */}
        <div className="t-mini-title mb-4 text-default">אבני דרך אחרונות</div>
        {dashboardStats?.milestones?.length > 0 ? (
          <div className="flex-col gap-4 mb-8">
            {dashboardStats.milestones.map((m: any, i: number) => {
              const diffSec = Math.floor((Date.now() - m.timestamp) / 1000);
              const diffMin = Math.floor(diffSec / 60);
              const timeStr = diffSec < 60 ? `לפני ${diffSec} שניות` : `לפני ${diffMin} דקות`;
              
              return (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`dot ${m.isCorrect ? 'dot-green' : 'dot-red'}`} style={{ marginTop: 6, borderRadius: m.isCorrect ? '50%' : 2, width: m.isCorrect ? 8 : 4, height: m.isCorrect ? 8 : 8 }} />
                  <div>
                    <div className="text-sm"><strong>{m.studentName}</strong> {m.action} <span style={{ opacity: 0.7 }}>({m.topicName})</span></div>
                    <div className="t-sub text-xs mt-1">{timeStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-4 mb-8 text-center text-faint text-sm">
            אין אירועים עדיין
          </div>
        )}

        {/* כרטיס מהירות הפעלה גלובלית */}
        <div className="card p-5">
          <div className="t-mini-title text-primary mb-3">מהירות שיעור גלובלית</div>
          <div className="font-title fw-900 text-3xl lh-1 mb-4">
            {dashboardStats?.globalSpeed || 0} <span className="fw-600 text-muted" style={{ fontSize: "1rem", fontStyle: "italic", verticalAlign: "middle" }}>פעולות/דקה</span>
          </div>
          <div className="text-left text-2xs text-faint">
            מבוסס על ממוצע כיתתי בשעה האחרונה
          </div>
        </div>

      </div>
    </>
  );
}

/* ── AI Chat Analytics View ── */
function AIChatAnalyticsView({ analytics }: { analytics: any }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteChatMut = useMutation(api.aiChat.deleteChat);
  const chatMessages = useQuery(
    api.aiChat.getChatMessages,
    selectedChatId ? { chatId: selectedChatId as any } : "skip"
  );

  const summary = analytics?.summary;
  const chats = analytics?.chats ?? [];

  const SentimentIcon = (s: string) => s === 'frustrated' ? <Frown size={20} color="var(--danger)" /> : s === 'confident' ? <Smile size={20} color="var(--success)" /> : <Meh size={20} color="var(--warning)" />;
  const sentimentLabel = (s: string) => s === 'frustrated' ? 'מתוסכל' : s === 'confident' ? 'בטוח' : 'ניטרלי';

  return (
    <>
      <div className="app-center">
        <div className="mb-10">
          <h1 className="t-h1 mb-4">
            <Bot size={32} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 12 }} />
            אנליטקת<br />שיחות AI
          </h1>
          <p className="t-sub text-base">
            מעקב אחרי כל האינטראקציות של התלמידים עם מורה AI  מייקל פאראדיי .
          </p>
        </div>

        {/* Summary cards */}
        <div className="flex gap-4 mb-8">
          <div className="card flex-1 p-5 text-center">
            <div className="t-mini-title mb-2">סך שיחות</div>
            <div className="stat-value text-primary">{summary?.totalChats ?? 0}</div>
          </div>
          <div className="card flex-1 p-5 text-center">
            <div className="t-mini-title mb-2">ממוצע בלבול</div>
            <div className="stat-value" style={{ color: (summary?.avgConfusion ?? 0) > 60 ? "var(--danger)" : "var(--warning)" }}>{summary?.avgConfusion ?? 0}%</div>
          </div>
          <div className="card flex-1 p-5 text-center">
            <div className="t-mini-title mb-2">סך הודעות</div>
            <div className="stat-value text-default">{summary?.totalMessages ?? 0}</div>
          </div>
        </div>

        {/* Sentiment distribution */}
        {summary?.sentimentCounts && (
          <div className="flex gap-4 mb-8">
            {(['confident', 'neutral', 'frustrated'] as const).map(s => (
              <div key={s} className="card flex items-center flex-1 p-4 gap-3">
                <div className="flex items-center justify-center">{SentimentIcon(s)}</div>
                <div>
                  <div className="t-mini-title mb-0">{sentimentLabel(s)}</div>
                  <div className="fw-800 text-lg">{summary.sentimentCounts[s] ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat list */}
        <div className="t-mini-title mb-4 text-default">שיחות אחרונות</div>
        <motion.div
          className="flex-col gap-2"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {chats.length === 0 ? (
            <div className="card p-10 text-center text-muted">
              <Bot size={48} color="var(--text-faint)" style={{ margin: '0 auto 16px' }} />
              <div className="fw-700" style={{ fontSize: '1.1rem' }}>עוד אין שיחות AI</div>
              <div className="t-sub mt-2">כשתלמידים ישתמשו במורה AI, השיחות יופיעו כאן.</div>
            </div>
          ) : (
            chats.map((chat: any) => (
              <motion.div
                key={chat._id}
                className="card p-4 pointer"
                style={{ border: selectedChatId === chat._id ? '1px solid var(--primary-dim)' : undefined }}
                onClick={() => setSelectedChatId(selectedChatId === chat._id ? null : chat._id)}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
                whileHover={{ scale: 1.01, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="avatar" style={{ width: 32, height: 32, background: chat.studentAvatar || 'var(--surface-highest)' }}>
                      {(chat.studentName || '?')[0]}
                    </div>
                    <div>
                      <div className="fw-800">{chat.studentName}</div>
                      <div className="t-sub text-xs">{chat.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`chat-agent-badge ${chat.agentType}`}>
                      {chat.agentType === 'practice' ? 'תרגול' : 'שיעורי בית'}
                    </span>
                    <div className="text-xs text-faint">
                      <MessageSquare size={12} style={{ display: 'inline', marginLeft: 4 }} /> {chat.messageCount}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(chat._id); }}
                      title="מחק שיחה"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 4, borderRadius: 'var(--r-sm)', transition: 'color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {chat.metrics && (
                  <div className="flex-col gap-2 mt-2">
                    <div className="flex gap-4">
                      <div className="context-chip">
                        <div className="flex items-center gap-1">{SentimentIcon(chat.metrics.sentiment)}</div> {sentimentLabel(chat.metrics.sentiment)}
                      </div>
                      <div className="context-chip">
                        בלבול: {chat.metrics.confusionScore}%
                      </div>
                      {chat.metrics.keyStrugglePoints?.slice(0, 2).map((p: string, i: number) => (
                        <div key={i} className="context-chip flex items-center gap-1"><AlertTriangle size={12} /> {p}</div>
                      ))}
                    </div>
                    {chat.metrics.missingKnowledge && chat.metrics.missingKnowledge.length > 0 && (
                      <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                        {chat.metrics.missingKnowledge.map((mk: string, i: number) => (
                          <span key={i} className="context-chip" style={{ background: "rgba(254,111,107,0.1)", color: "var(--danger)", borderColor: "rgba(254,111,107,0.25)" }}>🧩 {mk}</span>
                        ))}
                      </div>
                    )}
                    {chat.metrics.teacherActionItem && (
                      <div style={{ fontSize: "0.78rem", color: "var(--primary-dim)", fontWeight: 600 }}>
                        🎯 {chat.metrics.teacherActionItem}
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded chat transcript */}
                {selectedChatId === chat._id && chatMessages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ marginTop: 16, padding: 16, background: 'var(--surface)', borderRadius: 'var(--r-md)', maxHeight: 300, overflowY: 'auto' }}
                  >
                    {chatMessages.map((msg: any, i: number) => (
                      <div key={i} className="mb-3">
                        <div className="text-2xs fw-800 mb-1" style={{ color: msg.role === 'user' ? 'var(--primary-dim)' : 'var(--text-faint)' }}>
                          {msg.role === 'user' ? <><User size={12} style={{ display: 'inline', marginLeft: 4 }} /> תלמיד</> : msg.role === 'assistant' ? <><Bot size={12} style={{ display: 'inline', marginLeft: 4 }} /> ת'אורם</> : <><FileText size={12} style={{ display: 'inline', marginLeft: 4 }} /> מערכת</>}
                        </div>
                        <div className="text-sm text-muted lh-relaxed">{msg.content}</div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </motion.div>

        {/* Delete confirmation dialog */}
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--surface-highest)', border: '1px solid var(--danger)', borderRadius: 'var(--r-md)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
          >
            <AlertTriangle size={20} color="var(--danger)" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>למחוק את השיחה לצמיתות?</span>
            <button
              onClick={async () => {
                await deleteChatMut({ chatId: confirmDeleteId as any });
                setConfirmDeleteId(null);
                if (selectedChatId === confirmDeleteId) setSelectedChatId(null);
              }}
              style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 'var(--r-sm)', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              מחק
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--surface-highest)', padding: '6px 16px', borderRadius: 'var(--r-sm)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              ביטול
            </button>
          </motion.div>
        )}
      </div>

      {/* Right panel: Top struggles */}
      <div className="app-right-panel">
        <div className="t-mini-title mb-6 text-default flex items-center gap-2"><AlertTriangle size={16} color="var(--danger)" /> נקודות קושי מובילות</div>

        {summary?.topStruggles?.length > 0 ? (
          <div className="flex-col gap-3">
            {summary.topStruggles.map((s: { point: string; count: number }, i: number) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="flex justify-between items-center">
                  <div className="text-sm fw-700">{s.point}</div>
                  <div className="context-chip" style={{ background: 'rgba(254,111,107,0.15)', color: 'var(--danger)' }}>
                    {s.count} שיחות
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-5 text-center text-faint">
            אין מספיק נתונים עדיין
          </div>
        )}

        <div className="mt-8">
          <div className="t-mini-title mb-3 text-default">חלוקת סוגי שיחות</div>
          <div className="card p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="chat-agent-badge practice">תרגול</span>
              <span className="fw-800">{chats.filter((c: any) => c.agentType === 'practice').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="chat-agent-badge homework">שיעורי בית</span>
              <span className="fw-800">{chats.filter((c: any) => c.agentType === 'homework').length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Student Power Map View ── */
function StudentPowerMapView({ studentId, onBack }: { studentId: Id<"students"> | null; onBack: () => void }) {
  const powerMap = useQuery(
    api.powerMap.getStudentPowerMap,
    studentId ? { studentId } : "skip"
  );
  const briefs = useQuery(
    api.sessionBriefs.getBriefsForStudent,
    studentId ? { studentId } : "skip"
  );
  const student = useQuery(
    api.classroom.get,
    studentId ? { id: studentId } : "skip"
  );

  if (!studentId) {
    return (
      <>
        <div style={{ padding: 40 }}>
          <button className="power-map-back" onClick={onBack}>
            <ChevronRight size={16} /> חזרה למפת חום
          </button>
          <div className="card" style={{ padding: 40, textAlign: "center", marginTop: 24 }}>
            <TrendingUp size={48} color="var(--text-faint)" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 8 }}>בחר תלמיד</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              לחץ על כרטיסיית תלמיד במפת החום כדי לראות את הפרופיל שלו
            </div>
          </div>
        </div>
      </>
    );
  }

  const formatDuration = (ms: number) => {
    const mins = Math.round(ms / 60000);
    return mins < 60 ? `${mins} דק'` : `${Math.floor(mins / 60)} שע' ${mins % 60} דק'`;
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Center: Power Map */}
      <div className="app-center" style={{ paddingTop: 24 }}>
        <button className="power-map-back" onClick={onBack} style={{ marginBottom: 20 }}>
          <ChevronRight size={16} /> חזרה למפת חום
        </button>

        {/* Student header */}
        <div className="flex items-center gap-4" style={{ marginBottom: 28 }}>
          {student && (
            <div className="avatar" style={{ width: 48, height: 48, fontSize: "1.3rem", background: student.avatarColor }}>
              {student.name.slice(0, 1)}
            </div>
          )}
          <div>
            <div style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "1.5rem" }}>
              {student?.name || "..."}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              פרופיל למידה מצטבר
            </div>
          </div>
        </div>

        {/* Topic Mastery Heatmap */}
        <div className="t-mini-title" style={{ marginBottom: 12, color: "var(--text)" }}>מפת שליטה בנושאים</div>
        {powerMap?.topicMastery && powerMap.topicMastery.length > 0 ? (
          <div className="mastery-grid" style={{ marginBottom: 32 }}>
            {powerMap.topicMastery.map((t: any) => (
              <div key={t.topicId} className={`mastery-cell ${t.masteryScore >= 70 ? 'high' : t.masteryScore >= 40 ? 'mid' : 'low'}`}>
                <div style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "2rem", lineHeight: 1 }}>
                  {t.masteryScore}%
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.85rem", marginTop: 8 }}>{t.topicName}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
                  {t.sessionCount} שיחות · דיוק {t.avgAccuracy.toFixed(1)}/5
                </div>
                <div style={{ fontSize: "0.7rem", marginTop: 4, color: t.trend === 'improving' ? 'var(--success)' : t.trend === 'declining' ? 'var(--danger)' : 'var(--text-faint)' }}>
                  {t.trend === 'improving' ? '↑ משתפר' : t.trend === 'declining' ? '↓ יורד' : '─ יציב'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", marginBottom: 32 }}>
            אין מספיק נתונים עדיין
          </div>
        )}

        {/* Progress Velocity */}
        <div className="t-mini-title" style={{ marginBottom: 12, color: "var(--text)" }}>מהירות התקדמות</div>
        {powerMap?.progressVelocity?.weeklySnapshots && powerMap.progressVelocity.weeklySnapshots.length > 0 ? (
          <div className="card" style={{ padding: 20, marginBottom: 32 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-3">
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>שינוי דיוק: </span>
                  <span style={{ fontWeight: 800, color: powerMap.progressVelocity.accuracyDelta > 0 ? "var(--success)" : powerMap.progressVelocity.accuracyDelta < 0 ? "var(--danger)" : "var(--text)" }}>
                    {powerMap.progressVelocity.accuracyDelta > 0 ? "+" : ""}{powerMap.progressVelocity.accuracyDelta}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>שינוי עצמאות: </span>
                  <span style={{ fontWeight: 800, color: powerMap.progressVelocity.autonomyDelta > 0 ? "var(--success)" : powerMap.progressVelocity.autonomyDelta < 0 ? "var(--danger)" : "var(--text)" }}>
                    {powerMap.progressVelocity.autonomyDelta > 0 ? "+" : ""}{powerMap.progressVelocity.autonomyDelta}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>
                {powerMap.progressVelocity.overall} שיחות/שבוע
              </div>
            </div>
            <div className="flex-col" style={{ gap: 8 }}>
              {powerMap.progressVelocity.weeklySnapshots.map((w: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", width: 50, textAlign: "left", flexShrink: 0 }}>
                    שבוע {i + 1}
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: 4 }}>
                    <div className="velocity-bar" style={{ width: `${(w.avgAccuracy / 5) * 100}%`, background: "linear-gradient(90deg, var(--primary-alpha), var(--primary-dim))" }} />
                  </div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, width: 30, textAlign: "center" }}>
                    {w.avgAccuracy.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", marginBottom: 32 }}>
            אין מספיק נתונים לתרשים מהירות
          </div>
        )}

        {/* Session Briefs Timeline */}
        <div className="t-mini-title" style={{ marginBottom: 12, color: "var(--text)" }}>סיכומים פדגוגיים</div>
        {briefs && briefs.length > 0 ? (
          <motion.div
            className="flex-col"
            style={{ gap: 16, marginBottom: 32 }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
          >
            {briefs.map((brief: any) => (
              <motion.div
                key={brief._id}
                className="brief-card"
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
                whileHover={{
                  scale: 1.01,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                }}
              >
                <div className="flex justify-between items-start" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>
                      {brief.totalCycles > 1 ? `${brief.totalCycles} סבבים · ` : ""}{brief.totalMessages} הודעות · {formatDuration(brief.totalDurationMs)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginTop: 2 }}>
                      {formatDate(brief.createdAt)}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.85rem", marginBottom: 12 }}>
                  <strong>גישה:</strong> {brief.approach}
                </div>

                {brief.frictionPoints.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--danger)", marginBottom: 4 }}>נקודות חיכוך:</div>
                    {brief.frictionPoints.map((f: string, i: number) => (
                      <div key={i} style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingRight: 12 }}>• {f}</div>
                    ))}
                  </div>
                )}

                <div className="flex gap-6" style={{ marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>עצמאות </span>
                    <div className="autonomy-bar">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`bar-seg ${n <= brief.autonomyLevel ? 'filled' : ''}`} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>דיוק </span>
                    <div className="accuracy-bar">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`bar-seg ${n <= brief.solutionAccuracy ? 'filled' : ''}`} />
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.85rem", marginBottom: 4 }}>
                  <Zap size={12} style={{ display: "inline", color: "var(--warning)", marginLeft: 4 }} />
                  <strong> תובנה:</strong> {brief.keyInsight}
                </div>

                {brief.missingConcepts && brief.missingConcepts.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--danger)", marginBottom: 4 }}>🧩 מושגים חסרים:</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {brief.missingConcepts.map((c: string, i: number) => (
                        <span key={i} style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "var(--r-sm)", background: "rgba(254,111,107,0.12)", color: "var(--danger)", border: "1px solid rgba(254,111,107,0.25)" }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {brief.teacherActionItem && (
                  <div style={{ fontSize: "0.8rem", padding: "8px 12px", borderRadius: "var(--r-sm)", background: "rgba(99,179,237,0.1)", border: "1px solid rgba(99,179,237,0.25)", marginBottom: 8 }}>
                    <strong>🎯 פעולה נדרשת:</strong> {brief.teacherActionItem}
                  </div>
                )}

                {brief.detailedStruggleAnalysis && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>
                    <strong>📋 ניתוח קשיים:</strong> {brief.detailedStruggleAnalysis}
                  </div>
                )}

                {brief.nextSteps && brief.nextSteps.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>📌 צעדים הבאים:</div>
                    {brief.nextSteps.map((step: string, i: number) => (
                      <div key={i} style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingRight: 12 }}>• {step}</div>
                    ))}
                  </div>
                )}

                {brief.studentQuotes && brief.studentQuotes.length > 0 && (
                  <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--surface)", borderRight: "3px solid var(--primary-dim)" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-faint)", marginBottom: 4 }}>💬 ציטוטים מהתלמיד:</div>
                    {brief.studentQuotes.map((q: string, i: number) => (
                      <div key={i} style={{ fontSize: "0.8rem", fontStyle: "italic", color: "var(--text-muted)", marginBottom: 2 }}>{q}</div>
                    ))}
                  </div>
                )}

                {brief.recommendedAction && (
                  <div style={{ fontSize: "0.8rem", color: "var(--primary-dim)" }}>
                    <ArrowRight size={12} style={{ display: "inline", marginLeft: 4 }} />
                    <strong> המלצה:</strong> {brief.recommendedAction}
                  </div>
                )}

                {brief.selfAssessment && (
                  <div className="brief-self-assess">
                    "{brief.selfAssessment}"
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", marginBottom: 32 }}>
            אין סיכומים פדגוגיים עדיין
          </div>
        )}
      </div>

      {/* Right panel: Engagement */}
      <div className="app-right-panel" style={{ padding: "24px 20px" }}>
        <div className="t-mini-title mb-4 text-default">מטריקות מעורבות</div>

        {powerMap?.engagement ? (
          <div className="flex-col gap-4">
            <div className="card p-4">
              <div className="stat-label">סטטיסטיקות</div>
              <div className="flex-col" style={{ gap: 10 }}>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">סה"כ שיחות</span>
                  <span className="fw-800">{powerMap.engagement.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">סה"כ הודעות</span>
                  <span className="fw-800">{powerMap.engagement.totalMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">משך ממוצע</span>
                  <span className="fw-800">{formatDuration(powerMap.engagement.avgSessionDuration)}</span>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="stat-label">סגנון למידה</div>
              <div className="font-title fw-900 text-primary mb-1" style={{ fontSize: "1.3rem" }}>
                {powerMap.engagement.inquiryStyle === "explorer" ? "חוקר" : powerMap.engagement.inquiryStyle === "direct" ? "ישיר" : "פסיבי"}
              </div>
              <div className="text-xs text-muted">
                {powerMap.engagement.inquiryStyle === "explorer"
                  ? "שואל שאלות עומק ומציג עבודה עצמית"
                  : powerMap.engagement.inquiryStyle === "direct"
                    ? "שואל שאלות ממוקדות ועניינית"
                    : "ממתין להנחיות, מעט יוזמה עצמית"}
              </div>
            </div>

            <div className="card p-4">
              <div className="stat-label">מגמת תסכול</div>
              <div className="fw-800" style={{
                color: powerMap.engagement.frustrationTrend === "decreasing" ? "var(--success)"
                  : powerMap.engagement.frustrationTrend === "increasing" ? "var(--danger)"
                    : "var(--text)"
              }}>
                {powerMap.engagement.frustrationTrend === "decreasing" ? "↓ יורד"
                  : powerMap.engagement.frustrationTrend === "increasing" ? "↑ עולה"
                    : "─ יציב"}
              </div>
            </div>

            {powerMap.engagement.inquiryEvolution && powerMap.engagement.inquiryEvolution.length > 1 && (
              <div className="card p-4">
                <div className="stat-label">אבולוציית סגנון</div>
                <div className="flex-col gap-2">
                  {powerMap.engagement.inquiryEvolution.map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="dot" style={{
                        background: e.style === "explorer" ? "var(--success)" : e.style === "direct" ? "var(--primary-dim)" : "var(--warning)",
                        width: 8, height: 8
                      }} />
                      <span className="text-xs text-muted">
                        {e.style === "explorer" ? "חוקר" : e.style === "direct" ? "ישיר" : "פסיבי"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-5 text-center text-faint">
            אין נתוני מעורבות עדיין
          </div>
        )}
      </div>
    </>
  );
}

/* ── Homework Management View ── */
function HomeworkManagementView({ classroomId }: { classroomId: Id<"classrooms"> | null }) {
  const topics = useQuery(api.topics.list);
  const homeworkList = useQuery(
    api.homework.getHomeworkForClassroom,
    classroomId ? { classroomId } : "skip"
  );
  const createHomework = useMutation(api.homework.createHomework);
  const closeHomework = useMutation(api.homework.closeHomework);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Id<"topics">[]>([]);
  const [teacherNotes, setTeacherNotes] = useState("");
  const [questionCount, setQuestionCount] = useState(4);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [creating, setCreating] = useState(false);
  const [selectedHwId, setSelectedHwId] = useState<Id<"homework"> | null>(null);

  const rundown = useQuery(
    api.homeworkRundown.getRundown,
    selectedHwId ? { homeworkId: selectedHwId } : "skip"
  );

  const handleCreate = async () => {
    if (!classroomId || !title.trim() || selectedTopics.length === 0) return;
    setCreating(true);
    await createHomework({
      classroomId,
      title: title.trim(),
      topicIds: selectedTopics,
      teacherNotes: teacherNotes.trim() || undefined,
      questionCount,
      deadline: Date.now() + deadlineDays * 24 * 60 * 60 * 1000,
    });
    setTitle(""); setSelectedTopics([]); setTeacherNotes("");
    setQuestionCount(4); setDeadlineDays(3);
    setShowCreate(false); setCreating(false);
  };

  const handleClose = async (hwId: Id<"homework">) => {
    await closeHomework({ homeworkId: hwId });
  };

  const toggleTopic = (id: Id<"topics">) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("he-IL", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });

  return (
    <>
      <div className="app-center">
        <div className="mb-10">
          <h1 className="t-h1 mb-4">
            <FileText size={32} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 12 }} />
            ניהול<br />שיעורי בית
          </h1>
          <p className="t-sub text-base">
            צרו שיעורי בית מותאמים אישית — המערכת מתאימה את רמת הקושי לכל תלמיד לפי מפת הכוח שלו.
          </p>
        </div>

        {/* Create button */}
        <button
          className="new-proof-btn mb-8"
          style={{ maxWidth: 300 }}
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={16} /> צור שיעורי בית חדשים
        </button>

        {/* Creation Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              className="hw-create-form mb-8"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card p-6">
                <div className="t-mini-title mb-4 text-default">שיעורי בית חדשים</div>

                {/* Title */}
                <div className="mb-4">
                  <label className="stat-label">כותרת</label>
                  <input
                    className="hw-input"
                    type="text"
                    placeholder="לדוגמה: חזרה על חדו״א — נקודות קיצון"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    dir="rtl"
                  />
                </div>

                {/* Topics */}
                <div className="mb-4">
                  <label className="stat-label">נושאים</label>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {topics?.map((topic) => (
                      <button
                        key={topic._id}
                        className={`hw-topic-chip ${selectedTopics.includes(topic._id) ? 'selected' : ''}`}
                        onClick={() => toggleTopic(topic._id)}
                      >
                        {topic.nameHe}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Settings row */}
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="stat-label">מספר שאלות לתלמיד</label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          className={`key-btn ${questionCount === n ? 'key-op' : ''}`}
                          style={{ width: 48, height: 44, fontSize: '1rem' }}
                          onClick={() => setQuestionCount(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="stat-label">מועד הגשה (ימים)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button
                          key={d}
                          className={`key-btn ${deadlineDays === d ? 'key-op' : ''}`}
                          style={{ width: 48, height: 44, fontSize: '1rem' }}
                          onClick={() => setDeadlineDays(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Teacher notes */}
                <div className="mb-6">
                  <label className="stat-label">הערות למורה (אופציונלי)</label>
                  <textarea
                    className="hw-input"
                    placeholder="לדוגמה: התמקדו בשאלות פרמטר..."
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    rows={2}
                    dir="rtl"
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-3">
                  <button
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={creating || !title.trim() || selectedTopics.length === 0}
                  >
                    <Send size={16} /> {creating ? 'יוצר...' : 'צור והפץ לתלמידים'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                    ביטול
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Homework list */}
        <div className="t-mini-title mb-4 text-default">שיעורי בית קיימים</div>
        <motion.div
          className="flex-col gap-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
          }}
        >
          {!homeworkList || homeworkList.length === 0 ? (
            <div className="card p-10 text-center text-muted">
              <FileText size={48} color="var(--text-faint)" style={{ margin: '0 auto 16px' }} />
              <div className="fw-700" style={{ fontSize: '1.1rem' }}>עוד אין שיעורי בית</div>
              <div className="t-sub mt-2">לחצו על "צור שיעורי בית חדשים" כדי להתחיל.</div>
            </div>
          ) : (
            homeworkList.map((hw) => {
              const isExpired = Date.now() > hw.deadline;
              const statusColor = hw.status === 'graded' ? 'var(--success)' : hw.status === 'closed' ? 'var(--text-muted)' : isExpired ? 'var(--danger)' : 'var(--primary-dim)';
              const statusLabel = hw.status === 'graded' ? 'הוערך' : hw.status === 'closed' ? 'נסגר' : isExpired ? 'עבר מועד' : 'פעיל';

              return (
                <motion.div
                  key={hw._id}
                  className="card p-5 pointer"
                  style={{ border: selectedHwId === hw._id ? '1px solid var(--primary-dim)' : undefined }}
                  onClick={() => setSelectedHwId(selectedHwId === hw._id ? null : hw._id)}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  whileHover={{ scale: 1.005, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} color={statusColor} />
                      </div>
                      <div>
                        <div className="fw-800" style={{ fontSize: '1rem' }}>{hw.title}</div>
                        <div className="text-xs text-faint flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1"><Calendar size={12} /> נוצר: {formatDate(hw.createdAt)}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> מועד: {formatDate(hw.deadline)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="context-chip" style={{ background: `${statusColor}20`, color: statusColor, borderColor: `${statusColor}40` }}>
                        {statusLabel}
                      </span>
                      <span className="text-xs text-faint">{hw.questionCount} שאלות/תלמיד</span>
                      {hw.status === 'active' && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                          onClick={(e) => { e.stopPropagation(); handleClose(hw._id); }}
                        >
                          <XCircle size={14} /> סגור
                        </button>
                      )}
                    </div>
                  </div>

                  {hw.teacherNotes && (
                    <div className="text-sm text-muted mt-2" style={{ paddingRight: 56 }}>
                      📝 {hw.teacherNotes}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* Right panel: Rundown */}
      <div className="app-right-panel">
        <div className="t-mini-title mb-6 text-default flex items-center gap-2">
          <BarChart2 size={16} color="var(--primary-dim)" /> סיכום שיעור
        </div>

        {selectedHwId && rundown ? (
          <div className="flex-col gap-4">
            {/* Class-level stats */}
            <div className="card p-4 text-center">
              <div className="stat-label">ציון ממוצע כיתתי</div>
              <div className="stat-value" style={{ color: rundown.classAvgScore >= 70 ? 'var(--success)' : rundown.classAvgScore >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                {rundown.classAvgScore}%
              </div>
            </div>

            <div className="flex gap-3">
              <div className="card flex-1 p-4 text-center">
                <div className="stat-label">השלמה</div>
                <div className="fw-800 text-lg">{rundown.completionRate}%</div>
              </div>
              <div className="card flex-1 p-4 text-center">
                <div className="stat-label">זמן ממוצע</div>
                <div className="fw-800 text-lg">{rundown.avgTimeMinutes} דק'</div>
              </div>
            </div>

            {/* Topic breakdown */}
            {rundown.topicBreakdown.length > 0 && (
              <div>
                <div className="stat-label mb-2">פירוט נושאים</div>
                {rundown.topicBreakdown.map((tb, i) => (
                  <div key={i} className="card p-3 mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="fw-700 text-sm">{tb.topicName}</span>
                      <span className="fw-800" style={{ color: tb.avgScore >= 70 ? 'var(--success)' : tb.avgScore >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                        {tb.avgScore}%
                      </span>
                    </div>
                    <div className="text-2xs text-faint">{tb.hardestSection}</div>
                    {tb.commonMistakes.length > 0 && (
                      <div className="text-2xs text-muted mt-1">טעויות: {tb.commonMistakes.slice(0, 2).join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Clusters */}
            {rundown.clusters.length > 0 && (
              <div>
                <div className="stat-label mb-2">אשכולות תלמידים</div>
                {rundown.clusters.map((cl, i) => (
                  <div key={i} className="card p-3 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} color={cl.label === 'מצטיינים' ? 'var(--success)' : cl.label === 'צריכים חיזוק' ? 'var(--danger)' : 'var(--warning)'} />
                      <span className="fw-700 text-sm">{cl.label}</span>
                      <span className="text-2xs text-faint">({cl.studentIds.length})</span>
                    </div>
                    <div className="text-2xs text-muted">{cl.recommendedAction}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Flagged */}
            {rundown.flagged.length > 0 && (
              <div>
                <div className="stat-label mb-2 flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                  <AlertTriangle size={12} /> תלמידים לטיפול
                </div>
                {rundown.flagged.map((f, i) => (
                  <div key={i} className="card p-3 mb-2" style={{ borderColor: 'rgba(251,113,133,0.2)', background: 'rgba(251,113,133,0.05)' }}>
                    <div className="text-sm text-danger fw-700">{f.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : selectedHwId ? (
          <div className="card p-5 text-center text-faint">
            <BarChart2 size={32} color="var(--text-faint)" style={{ margin: '0 auto 12px' }} />
            סיכום יהיה זמין לאחר סגירת שיעורי הבית
          </div>
        ) : (
          <div className="card p-5 text-center text-faint">
            <FileText size={32} color="var(--text-faint)" style={{ margin: '0 auto 12px' }} />
            בחרו שיעורי בית מהרשימה כדי לראות סיכום
          </div>
        )}
      </div>
    </>
  );
}
