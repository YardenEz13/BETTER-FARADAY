import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, Map as MapIcon, BookOpen, BarChart2, Activity, AlertTriangle, FileText, Settings, Plus, Zap, Play, RotateCcw, Loader2, Flame, ChevronLeft, Bot } from "lucide-react";
import AIChatPanel from "../components/AIChatPanel";

export default function PracticeSession() {
  const { studentId, topicId } = useParams<{ studentId: string; topicId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topicsList = useQuery(api.topics.list);
  const currentTopic = topicsList?.find(t => t._id === topicId);
  const question = useQuery(api.questions.getNextQuestion, {
    studentId: studentId as Id<"students">,
    topicId: topicId as Id<"topics">,
  });
  const submitAttempt = useMutation(api.attempts.submitAttempt);
  const generateHint = useMutation(api.ai.generateHint);

  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const startTimeRef = useRef(Date.now());
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [questionKey]);

  useEffect(() => {
    setSelected(null); setSubmitted(false); setShowHint(false);
    setHint(null); setHintsUsed(0); setElapsed(0);
    startTimeRef.current = Date.now(); setShowCelebration(false);
  }, [question?._id]);

  if (!student || !currentTopic) return null;

  const handleSelect = async (idx: number) => {
    if (submitted || !question) return;
    setSelected(idx); setSubmitted(true);
    const isCorrect = idx === question.correctIndex;
    setQuestionsAnswered(q => q + 1);
    if (isCorrect) {
      setSessionXP(x => x + (question.difficulty * 50) + (hintsUsed === 0 ? 30 : 0));
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }
    await submitAttempt({
      studentId: studentId as Id<"students">, questionId: question._id,
      topicId: topicId as Id<"topics">, choiceIndex: idx, isCorrect,
      timeMs: Date.now() - startTimeRef.current, hintsUsed, difficulty: question.difficulty,
    });
  };

  const handleHint = async () => {
    if (!question || loadingHint) return;
    setShowHint(true); setLoadingHint(true); setHintsUsed(h => h + 1);
    const r = await generateHint({
      studentId: studentId as Id<"students">, questionId: question._id,
      studentInput: selected !== null ? question.choices[selected] : "",
    });
    setHint(r.hint); setLoadingHint(false);
  };

  const isCorrect = submitted && selected === question?.correctIndex;

  return (
    <div className="app-layout">
      <Sidebar studentId={studentId!} navigate={navigate} />
      <div className="app-content-wrapper">
        <Topbar student={student} />
        <div className="app-main">
          <CenterPanel
            currentTopic={currentTopic} question={question} student={student}
            questionsAnswered={questionsAnswered} sessionXP={sessionXP}
            showCelebration={showCelebration} submitted={submitted}
            selected={selected} isCorrect={isCorrect} elapsed={elapsed}
            hintsUsed={hintsUsed} handleSelect={handleSelect} handleHint={handleHint}
            setQuestionKey={setQuestionKey}
          />
          <RightPanel showHint={showHint} loadingHint={loadingHint} hint={hint} />
        </div>
      </div>

      {/* Floating AI Chat Trigger */}
      <button className="chat-trigger-btn pulse" onClick={() => setChatOpen(true)} title="פתח מורה AI">
        <Bot size={24} />
      </button>

      {/* AI Chat Panel — Practice Agent */}
      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId!}
        agentType="practice"
        questionStem={question?.stem}
        topicName={currentTopic?.nameHe}
        topicId={topicId}
        questionId={question?._id}
      />

      <style>{`@keyframes spin{100%{transform:rotate(360deg)}}@keyframes blink{50%{opacity:0}}`}</style>
    </div>
  );
}

function Sidebar({ studentId, navigate }: { studentId: string; navigate: any }) {
  return (
    <aside className="app-sidebar">
      <div className="app-brand"><span>FARADAY</span> Logic</div>
      <button className="new-proof-btn" style={{ marginBottom: 32 }}><Plus size={16} /> הוכחה חדשה</button>
      <div className="flex-col" style={{ gap: 4, flex: 1 }}>
        <button className="nav-item" onClick={() => navigate(`/student/${studentId}`)}><MapIcon size={18} /> מפת למידה</button>
        <button className="nav-item active"><BookOpen size={18} /> תרגול</button>
        <button className="nav-item"><BarChart2 size={18} /> סטטיסטיקות</button>
        <button className="nav-item" onClick={() => navigate("/teacher")}><Activity size={18} /> מפת חום</button>
        <button className="nav-item"><AlertTriangle size={18} /> התראות</button>
        <button className="nav-item"><FileText size={18} /> שיעורי בית</button>
      </div>
    </aside>
  );
}

function Topbar({ student }: { student: any }) {
  return (
    <header className="app-topbar">
      <div className="topbar-links">
        <div className="topbar-link">מפת למידה</div>
        <div className="topbar-link active">תרגול</div>
        <div className="topbar-link">סטטיסטיקות</div>
      </div>
      <div className="topbar-actions">
        <div className="search-box">
          <Search size={16} color="var(--text-faint)" />
          <input type="text" placeholder="חיפוש קונספטים..." />
        </div>
        <Bell size={18} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
        <div className="avatar" style={{ width: 28, height: 28, background: student.avatarColor, fontSize: '0.8rem' }}>
          {student.name.slice(0, 1)}
        </div>
      </div>
    </header>
  );
}

function CenterPanel({ currentTopic, question, student, questionsAnswered, sessionXP, showCelebration, submitted, selected, isCorrect, elapsed, hintsUsed, handleSelect, handleHint, setQuestionKey }: any) {
  return (
    <div className="app-center" style={{ padding: 40 }}>
      <div className="flex justify-between items-end" style={{ marginBottom: 32 }}>
        <div>
          <div className="flex items-center gap-2 t-mini-title" style={{ color: "var(--primary-dim)", marginBottom: 8 }}>
            <RotateCcw size={14} /> מודול פעיל: {currentTopic.nameHe}
          </div>
          <h1 className="t-h1" style={{ margin: 0, fontSize: "2.5rem" }}>תרגול אדפטיבי</h1>
          <div className="t-sub" style={{ marginTop: 8 }}>שאלון 581 · הכנה לבגרות · 5 יח״ל</div>
        </div>
        <div className="flex gap-6 items-center">
          <div className="streak-badge">
            <Flame size={16} color="var(--warning)" />
            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--warning)" }}>{questionsAnswered} שאלות</span>
          </div>
          <div className="xp-badge">
            <Zap size={18} color="var(--primary-dim)" />
            <span style={{ fontSize: "1.2rem", fontWeight: 800, position: "relative", zIndex: 1 }}>{student.streak * 10 + sessionXP}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontWeight: 700, position: "relative", zIndex: 1 }}>XP</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCelebration && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1000, padding: "24px 48px", borderRadius: "var(--r-xl)", background: "rgba(52,250,89,0.15)", border: "2px solid var(--primary-dim)", backdropFilter: "blur(12px)", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary-dim)" }}>אחלה עבודה!</div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: 4 }}>+{(question?.difficulty ?? 1) * 50 + (hintsUsed === 0 ? 30 : 0)} XP</div>
          </motion.div>
        )}
      </AnimatePresence>

      {question === undefined ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <Loader2 size={32} color="var(--primary-dim)" style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div className="t-h2">טוען שאלות...</div>
        </div>
      ) : question === null ? (
        <div className="card" style={{ padding: 48, textAlign: "center", border: "1px solid var(--primary-dim)" }}>
          <div className="t-h2" style={{ color: "var(--primary-dim)", marginBottom: 16 }}>🎉 אין יותר שאלות להיום!</div>
          <p style={{ color: "var(--text-muted)" }}>סיימתם את המודול הנוכחי. תוכלו לחזור למפת הלמידה כדי לבחור מודול אחר.</p>
          <button className="key-btn" style={{ marginTop: 24, padding: "8px 24px", background: "var(--primary-dim)", color: "#000", fontWeight: 800 }} onClick={() => navigate(`/student/${studentId}`)}>
            חזרה למפת הלמידה
          </button>
        </div>
      ) : (
        <>
          <motion.div key={question._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="card" style={{ padding: 0, position: "relative", overflow: "hidden", borderRight: "3px solid var(--primary-dim)", marginBottom: 40 }}>
            <div className="flex justify-between items-center" style={{ padding: "16px 24px", borderBottom: "var(--ghost-border)" }}>
              <span className="status-badge" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "4px 8px" }}>רמת קושי {question.difficulty} · שאלון 581</span>
              <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--text-faint)" }}>TH-{question._id.slice(-5).toUpperCase()}</span>
            </div>
            <div style={{ padding: "32px 40px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 500, marginBottom: 24, lineHeight: 1.5 }}>{question.stem}</h2>
            </div>
          </motion.div>

          <QuestionChoices question={question} submitted={submitted} selected={selected} isCorrect={isCorrect} elapsed={elapsed} handleSelect={handleSelect} handleHint={handleHint} setQuestionKey={setQuestionKey} hintsUsed={hintsUsed} />
        </>
      )}
    </div>
  );
}

function QuestionChoices({ question, submitted, selected, isCorrect, elapsed, handleSelect, handleHint, setQuestionKey, hintsUsed }: any) {
  return (
    <div style={{ padding: "0 24px" }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
        <div className="t-mini-title" style={{ margin: 0, color: "var(--text)", fontSize: "0.85rem" }}>צעדי פתרון לוגיים</div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}><RotateCcw size={12} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
      </div>
      <div className="flex gap-6 items-start" style={{ position: "relative" }}>
        <div style={{ position: "absolute", right: 15, top: 32, bottom: -40, width: 2, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ width: 32, height: 32, borderRadius: 16, background: "var(--primary-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 800, color: "#000", flexShrink: 0 }}>01</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--primary-dim)", fontSize: "0.95rem", fontWeight: 800, marginBottom: 16 }}>
            {submitted && !isCorrect ? "צעד שגוי. בדקו ותקנו:" : "בחרו את צעד הפתרון הנכון:"}
          </div>
          <div className="flex-col gap-3" style={{ marginBottom: 24 }}>
            {question.choices.map((choice: string, idx: number) => {
              const isCorrectC = idx === question.correctIndex;
              const isWrong = submitted && idx === selected && !isCorrectC;
              const isRight = submitted && isCorrectC;
              let s: React.CSSProperties = { background: "var(--bg)", border: "1px solid var(--surface-highest)", borderRadius: "var(--r-sm)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, fontFamily: "var(--font-body)", fontSize: "1.1rem", cursor: "pointer", transition: "all 0.2s", textAlign: "right" };
              if (submitted) { s.cursor = "default"; if (isRight) { s.background = "var(--primary-alpha)"; s.border = "1px solid var(--success)"; s.color = "var(--success)"; } else if (isWrong) { s.background = "rgba(254,111,107,0.1)"; s.border = "1px solid var(--danger)"; s.color = "var(--danger)"; } else { s.opacity = 0.5; } } else if (selected === idx) { s.border = "1px solid var(--primary-dim)"; s.boxShadow = "inset 0 0 0 1px var(--primary-dim)"; }
              return (
                <motion.button key={idx} style={s} onClick={() => handleSelect(idx)} whileHover={!submitted ? { scale: 1.01 } : {}} whileTap={!submitted ? { scale: 0.99 } : {}}>
                  <div style={{ flex: 1 }}>{choice}</div>
                  {isRight && <span>✅</span>}{isWrong && <span>❌</span>}
                  {selected === idx && !submitted && <div style={{ width: 8, height: 20, background: "rgba(52,250,89,0.7)", animation: "blink 1s step-end infinite" }} />}
                </motion.button>
              );
            })}
          </div>
          <div className="flex gap-4">
            {!submitted ? (<>
              <button className="key-btn" style={{ padding: "0 24px", background: selected !== null ? "var(--primary-dim)" : "var(--surface)", color: selected !== null ? "#000" : "var(--text)", fontSize: "0.9rem", fontFamily: "var(--font-body)", fontWeight: 700 }}>בדוק תשובה</button>
              <button className="key-btn" style={{ padding: "0 16px", background: "transparent", border: "none", color: "var(--danger)", fontSize: "0.9rem", fontFamily: "var(--font-body)", fontWeight: 700 }} onClick={handleHint}><AlertTriangle size={14} style={{ marginLeft: 8, display: "inline-block", verticalAlign: "middle" }} /> שלח למנוע AI</button>
            </>) : (
              <motion.button className="key-btn" style={{ padding: "0 24px", background: "var(--primary-dim)", color: "#000", fontSize: "0.9rem", fontFamily: "var(--font-body)", fontWeight: 800 }} onClick={() => setQuestionKey((k: number) => k + 1)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                שאלה הבאה <ChevronLeft size={14} style={{ marginRight: 8, display: "inline-block", verticalAlign: "middle" }} />
              </motion.button>
            )}
          </div>
          <AnimatePresence>
            {submitted && !isCorrect && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: 24, padding: 16, background: "rgba(254,111,107,0.1)", borderRadius: "var(--r-md)", borderRight: "3px solid var(--danger)" }}>
                <span style={{ fontWeight: 800, color: "var(--danger)" }}>ניתוח:</span> {question.explanation}
              </motion.div>
            )}
            {submitted && isCorrect && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: 24, padding: 16, background: "var(--primary-alpha)", borderRadius: "var(--r-md)", borderRight: "3px solid var(--primary-dim)" }}>
                <span style={{ fontWeight: 800, color: "var(--primary-dim)" }}>מעולה!</span> {question.explanation}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function RightPanel({ showHint, loadingHint, hint }: { showHint: boolean; loadingHint: boolean; hint: string | null }) {
  const [eqValue, setEqValue] = useState("");

  const handleKeyPress = (key: string) => {
    if (key === "del") {
      setEqValue(v => v.slice(0, -1));
    } else {
      setEqValue(v => v + key);
    }
  };

  return (
    <div className="app-right-panel flex-col gap-6" style={{ background: "var(--bg-topbar)" }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
          <div className="t-mini-title" style={{ margin: 0, color: "var(--text)" }}>עורך משוואות</div>
          <div className="flex gap-2">
            <div className="dot" style={{ background: "var(--danger)", width: 6, height: 6, cursor: "pointer" }} onClick={() => setEqValue("")} title="נקה הכל" />
            <div className="dot" style={{ background: "var(--warning)", width: 6, height: 6 }} />
            <div className="dot" style={{ background: "var(--success)", width: 6, height: 6 }} />
          </div>
        </div>
        <div style={{ background: "var(--surface-highest)", borderRadius: "var(--r-sm)", padding: "12px 16px", minHeight: 48, marginBottom: 16, fontFamily: "monospace", fontSize: "1.2rem", textAlign: "left", direction: "ltr", color: "var(--text)", border: "1px solid var(--ghost-border)" }}>
          {eqValue || <span style={{ color: "var(--text-faint)" }}>0</span>}
        </div>
        <div className="keypad">
          {["x²","xⁿ","√","π","sin","cos","tan","log","d/dx","∫","lim","∑"].map(k => <button key={k} className="key-btn key-op" onClick={() => handleKeyPress(k)}>{k}</button>)}
          {["(",")","^","del","7","8","9","÷","4","5","6","×","1","2","3","-","0",".","=","+"].map(k => <button key={k} className="key-btn" onClick={() => handleKeyPress(k)}>{k}</button>)}
        </div>
      </div>
      <div className="card" style={{ padding: 20, border: showHint ? "1px solid var(--primary-dim)" : "var(--ghost-border)" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "var(--surface-high)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {loadingHint ? <Loader2 size={18} color="var(--primary-dim)" style={{ animation: "spin 1s linear infinite" }} /> : <Settings size={18} color={showHint ? "var(--primary-dim)" : "var(--text)"} />}
          </div>
          <div>
            <div className="t-mini-title" style={{ margin: 0, color: "var(--text)" }}>{showHint ? "מנוע AI פעיל" : "מורה AI ממתין"}</div>
            <div style={{ fontSize: "0.85rem", color: showHint ? "var(--text)" : "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
              {hint ? `"${hint}"` : '"לחצו על ״שלח למנוע AI״ לרמז..."'}
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ height: 120, position: "relative", background: "linear-gradient(45deg,#16181d,#282c35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.3, background: "repeating-linear-gradient(0deg,transparent,transparent 10px,rgba(255,255,255,0.05) 10px,rgba(255,255,255,0.05) 11px)" }} />
          <div style={{ width: 48, height: 48, background: "var(--primary-dim)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, boxShadow: "0 0 20px rgba(52,250,89,0.3)" }}>
            <Play size={24} color="#000" fill="#000" />
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="t-mini-title" style={{ margin: 0 }}>סקירת קונספט</div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: 4 }}>סיכום עקרונות</div>
        </div>
      </div>
    </div>
  );
}
