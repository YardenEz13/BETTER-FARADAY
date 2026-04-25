import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { Bell, Mail, Search, Map as MapIcon, BookOpen, BarChart2, Activity, AlertTriangle, FileText, Settings, Plus, Lock, ChevronLeft, ArrowLeft, Flame, Zap, Trophy, Target, Bot } from "lucide-react";
import { preloadModel } from "../services/localAI";
import AIChatPanel from "../components/AIChatPanel";
import AIStoragePopup from "../components/AIStoragePopup";

export default function StudentHome() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topics = useQuery(api.topics.list);
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const [chatOpen, setChatOpen] = useState(false);

  const handleStorageConsent = () => {
    preloadModel().catch(console.error);
  };

  if (!student || !topics) return null;

  const getProgress = (topicId: string) => {
    const d = stats?.byTopic[topicId] as { correct: number; total: number } | undefined;
    if (!d || d.total === 0) return 0;
    return Math.round((d.correct / d.total) * 100);
  };

  const totalAttempts = stats?.totalAttempts ?? 0;
  const overallAcc = totalAttempts > 0 
    ? Math.round((topics.reduce((s, t) => s + (stats?.byTopic[t._id]?.correct || 0), 0) / totalAttempts) * 100) 
    : 0;

  const activeTopicIndex = topics.findIndex(t => getProgress(t._id) < 80);
  const activeTopic = activeTopicIndex === -1 ? topics[0] : topics[activeTopicIndex];

  const totalXP = (student.streak * 10) + (totalAttempts * 25);

  return (
    <div className="app-layout">
      {/* סרגל צד + תוכן (unchanged from here, skipping for brevity) ... */}
      {/* ── סרגל צד ── */}
      <aside className="app-sidebar">
        <div className="app-brand">
          <span>FARADAY</span> Logic
        </div>

        <button className="new-proof-btn">
          <Plus size={16} /> הוכחה חדשה
        </button>

        <div className="flex-col" style={{ gap: 4, flex: 1 }}>
          <button className="nav-item active"><MapIcon size={18} /> מפת למידה</button>
          <button className="nav-item" onClick={() => navigate(`/student/${studentId}/practice/${activeTopic._id}`)}><BookOpen size={18} /> תרגול</button>
          <button className="nav-item"><BarChart2 size={18} /> סטטיסטיקות</button>
          <button className="nav-item" onClick={() => navigate("/teacher")}><Activity size={18} /> מפת חום</button>
          <button className="nav-item"><AlertTriangle size={18} /> התראות</button>
          <button className="nav-item"><FileText size={18} /> שיעורי בית</button>
        </div>

        <div className="flex-col" style={{ gap: 4, marginTop: "auto" }}>
          <button className="nav-item"><Settings size={18} /> הגדרות</button>
          <button className="nav-item" onClick={() => navigate("/")}><ArrowLeft size={18} /> התנתקות</button>
        </div>
      </aside>

      {/* ── אזור ראשי ── */}
      <div className="app-content-wrapper">
        {/* טופ בר */}
        <header className="app-topbar">
          <div className="topbar-links">
            <div className="topbar-link active">תוכנית לימודים</div>
            <div className="topbar-link">משאבים</div>
            <div className="topbar-link">קהילה</div>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16} color="var(--text-faint)" />
              <input type="text" placeholder="חיפוש משפטים..." />
            </div>
            <Bell size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
            <Mail size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
            <div className="avatar" style={{ width: 28, height: 28, background: student.avatarColor, fontSize: '0.8rem', cursor: 'pointer' }}>
              {student.name.slice(0, 1)}
            </div>
          </div>
        </header>

        {/* תוכן מפוצל */}
        <div className="app-main">
          {/* עמודה מרכזית: מפת דרכים */}
          <div className="app-center">
            <div className="flex justify-between items-end" style={{ marginBottom: 40 }}>
              <div>
                <div className="t-mini-title" style={{ color: "var(--primary-dim)", marginBottom: 8 }}>מתמטיקה כיתה י״א · שאלון 581</div>
                <h1 className="t-h1">מפת למידה</h1>
                <p className="t-sub" style={{ maxWidth: 500 }}>
                  יאללה {student.name}, בוא נשבור את זה! 💪 המסלול האישי שלך לשליטה מלאה במתמטיקה 5 יחידות.
                </p>
              </div>
              <div style={{ textAlign: "left", minWidth: 140 }}>
                <div className="t-h1" style={{ color: "var(--primary-dim)", marginBottom: 4 }}>{overallAcc}%</div>
                <div className="t-mini-title" style={{ marginBottom: 8 }}>התקדמות כללית</div>
                <div className="seg-bar">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`seg ${i < Math.round(overallAcc/20) ? 'active' : ''}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* XP + Streak Bar */}
            <div className="flex gap-4" style={{ marginBottom: 32 }}>
              <div className="xp-badge">
                <Zap size={18} color="var(--primary-dim)" />
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontWeight: 700 }}>XP</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--primary-dim)", position: "relative", zIndex: 1 }}>{totalXP}</div>
                </div>
              </div>
              <div className="streak-badge">
                <Flame size={18} color="var(--warning)" />
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontWeight: 700 }}>רצף 🔥</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--warning)", position: "relative", zIndex: 1 }}>{student.streak}</div>
                </div>
              </div>
              <div className="streak-badge" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", borderColor: "rgba(99,102,241,0.3)" }}>
                <Trophy size={18} color="#818cf8" />
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontWeight: 700 }}>דרגה</div>
                  <div style={{ fontSize: "1rem", fontWeight: 900, color: "#818cf8" }}>
                    {totalXP > 1000 ? "מתקדם" : totalXP > 500 ? "חוקר" : "מתחיל"}
                  </div>
                </div>
              </div>
            </div>

            {/* מודולים מחוברים ממסד הנתונים */}
            <div className="flex-col" style={{ gap: 48, maxWidth: 640 }}>
              {topics.map((topic, idx) => {
                const progress = getProgress(topic._id);
                const isLocked = false;

                return (
                  <div key={topic._id} className="module-card flex-col" style={{ opacity: isLocked ? 0.6 : 1, position: "relative" }}>
                    <div className="flex justify-between items-start" style={{ cursor: "pointer" }} onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}>
                      <div>
                        {isLocked ? (
                          <div className="status-badge" style={{ background: "var(--surface-highest)", color: "var(--text-faint)", marginBottom: 8 }}>
                            <Lock size={10} /> מודול 0{idx + 1}
                          </div>
                        ) : (
                          <div className="status-badge" style={{ background: "var(--primary-alpha)", color: "var(--primary-dim)", marginBottom: 8 }}>
                            מודול 0{idx + 1}
                          </div>
                        )}
                        <h2 className="t-h2">{topic.nameHe}</h2>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div className="t-h2" style={{ color: isLocked ? "var(--text-faint)" : "var(--primary-dim)", margin: 0 }}>
                          {isLocked ? "0%" : `${progress}%`}
                        </div>
                        <div className="t-mini-title" style={{ marginTop: 4 }}>
                          {isLocked ? "נעול" : progress >= 100 ? "הושלם ✅" : "בתהליך"}
                        </div>
                      </div>
                    </div>

                    <div className="concept-grid">
                      <div className="concept-box" style={{ borderColor: progress > 25 ? "var(--primary-dim)" : "var(--surface-highest)" }}>
                        <div className="t-mini-title" style={{ marginBottom: 4 }}>קונספט 1.1</div>
                        <div>{topic.description}</div>
                      </div>
                      <div className="concept-box" style={{ borderColor: progress > 50 ? "var(--primary-dim)" : "var(--surface-highest)" }}>
                        <div className="t-mini-title" style={{ marginBottom: 4 }}>קונספט 1.2</div>
                        <div style={{ color: progress > 50 ? "var(--text)" : "var(--text-muted)" }}>יישומים מתקדמים</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* שורה תחתונה - אתגרים קרובים */}
            <div style={{ marginTop: 64 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
                <h3 className="t-h2" style={{ margin: 0 }}>אתגרים קרובים 🎯</h3>
                <span className="t-mini-title" style={{ color: "var(--primary-dim)", cursor: "pointer" }}>הצג הכל</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
                {[
                  { title: "אתגר גבולות אלפא", d: "פתרון פרדוקס ההתכנסות", xp: 450, icon: <Target size={16} color="var(--primary-dim)" />, time: "נשארו 24 דק'" },
                  { title: "הסתברות שיתופית", d: "הצטרפו ל-4 אחרים לחישוב שונות", xp: 1200, icon: <Trophy size={16} color="var(--warning)" />, time: "אירוע צוותי" },
                  { title: "האתגר הרציונלי", d: "מבחן שליטה סופי למודול", xp: 3000, icon: <Flame size={16} color="var(--danger)" />, time: "בוס פייט 🔥" },
                ].map((c, i) => (
                  <div key={i} className="card" style={{ padding: 20, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
                      <div style={{ width: 28, height: 28, background: "var(--surface-high)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.icon}</div>
                      <span className="t-mini-title" style={{ margin: 0, color: "var(--text-muted)" }}>{c.time}</span>
                    </div>
                    <div style={{ fontWeight: 800, marginBottom: 8, fontSize: "0.95rem" }}>{c.title}</div>
                    <div className="t-sub" style={{ fontSize: "0.8rem", marginBottom: 24, height: 36 }}>{c.d}</div>
                    <div className="flex justify-between items-center">
                      <span className="status-badge" style={{ background: "var(--surface-high)", color: "var(--primary-dim)", border: "var(--ghost-border)" }}>XP: +{c.xp}</span>
                      <ChevronLeft size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* פאנל ימני: פוקוס פעיל ותובנות */}
          <div className="app-right-panel">
            
            {/* כרטיס פוקוס פעיל */}
            {activeTopic && (
              <div className="card" style={{ padding: 24, marginBottom: 24, background: "linear-gradient(180deg, var(--surface-highest) 0%, var(--surface) 100%)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -80, left: -40, width: 200, height: 200, borderRadius: "50%", border: "40px solid rgba(255,255,255,0.03)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: -60, left: 0, width: 140, height: 140, borderRadius: "50%", border: "20px solid rgba(255,255,255,0.02)", pointerEvents: "none" }} />
                
                <div className="flex justify-end" style={{ marginBottom: 120 }}>
                  <div className="status-badge" style={{ background: "rgba(0,0,0,0.4)", color: "var(--text-muted)" }}>
                    <div className="dot dot-green" style={{ width: 6, height: 6, marginLeft: 6 }} /> פוקוס פעיל
                  </div>
                </div>

                <div className="t-mini-title" style={{ color: "var(--primary-dim)", marginBottom: 8 }}>מודול 0{activeTopicIndex + 1 || 1}</div>
                <h2 className="t-h1" style={{ fontSize: "1.75rem", marginBottom: 32 }}>{activeTopic.nameHe}</h2>

                <div style={{ marginBottom: 16 }}>
                  <div className="flex justify-between" style={{ marginBottom: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                    <span>שליטה בקונספט</span>
                    <span style={{ color: "var(--primary-dim)" }}>{getProgress(activeTopic._id)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div style={{ width: `${getProgress(activeTopic._id)}%`, height: "100%", background: "var(--primary-dim)", borderRadius: "var(--r-sm)", transition: "width 0.5s ease" }} />
                  </div>
                </div>

                <button className="new-proof-btn" style={{ margin: 0, background: "linear-gradient(135deg, #a2ffc2 0%, var(--primary-dim) 100%)", color: "#000" }} onClick={() => navigate(`/student/${studentId}/practice/${activeTopic._id}`)}>
                  המשך תרגול 🚀
                </button>
              </div>
            )}

            {/* כרטיס יעילות למידה */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="t-mini-title">יעילות למידה</div>
              <div className="flex items-center gap-4 mt-4">
                <div style={{ width: 48, height: 48, border: "2px solid var(--primary-dim)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 900, color: "var(--primary-dim)" }}>
                  {totalAttempts > 0 ? student.streak : 0}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>רצף דיוק 🎯</div>
                  <div className="t-sub" style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>תשובות נכונות ברצף</div>
                </div>
              </div>
            </div>

            {/* כרטיס דף נוסחאות */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="flex items-center gap-2 t-mini-title" style={{ color: "var(--text)", marginBottom: 12 }}>
                <BookOpen size={14} color="var(--primary-dim)" /> דף נוסחאות
              </div>
              <div className="t-sub" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
                כל הנוסחאות החשובות לטריגונומטריה ופונקציות רציונליות בכיתה י״א.
              </div>
              <div style={{ color: "var(--primary-dim)", fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                פתח מסמך <ArrowLeft size={14} />
              </div>
            </div>

            {/* כרטיס התראת פער ידע */}
            <div className="card" style={{ padding: 20, background: "var(--primary-dim)", color: "#000" }}>
              <div className="t-mini-title" style={{ color: "rgba(0,0,0,0.6)", marginBottom: 12 }}>התראת פער ידע</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.3, marginBottom: 16 }}>
                היית תקוע ב{topics[0]?.nameHe} בתרגול האחרון. רוצה חזרה של 5 דקות? 🤔
              </h3>
              <button style={{ background: "#000", color: "var(--primary-dim)", border: "none", padding: "10px 16px", borderRadius: "var(--r-sm)", fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase", cursor: "pointer" }}>
                יאללה, בוא נתחיל 💪
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Storage Consent Popup */}
      <AIStoragePopup onConsent={handleStorageConsent} />

      {/* Floating AI Chat Trigger — Homework Agent */}
      <button className="chat-trigger-btn pulse" onClick={() => setChatOpen(true)} title="מורה AI לשיעורי בית">
        <Bot size={24} />
      </button>

      {/* AI Chat Panel — Homework Agent */}
      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId!}
        agentType="homework"
      />
    </div>
  );
}
