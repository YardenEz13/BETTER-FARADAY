import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, RotateCcw, Zap, Bot, Activity,
  CheckCircle2, XCircle, Lightbulb, ArrowRight, Clock, Star
} from "lucide-react";
import AIChatPanel from "../components/AIChatPanel";

export default function PracticeSession() {
  const { studentId, topicId } = useParams<{ studentId: string; topicId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topicsList = useQuery(api.topics.list);
  const currentTopic = topicsList?.find(t => t._id === topicId);

  const [questionKey, setQuestionKey] = useState(0);
  const question = useQuery(api.questions.getNextQuestion, {
    studentId: studentId as Id<"students">,
    topicId: topicId as Id<"topics">,
    questionKey,
  });

  const [activeQuestion, setActiveQuestion] = useState<Doc<"questions"> | null>(null);

  useEffect(() => {
    if (question && !activeQuestion) setActiveQuestion(question);
  }, [question, activeQuestion]);

  useEffect(() => { setActiveQuestion(null); }, [topicId]);

  const submitAttempt = useMutation(api.attempts.submitAttempt);
  const generateHint  = useMutation(api.ai.generateHint);

  const [selected, setSelected]             = useState<number | null>(null);
  const [submitted, setSubmitted]           = useState(false);
  const [reviewPhase, setReviewPhase]       = useState(false);
  const [countdown, setCountdown]           = useState(0);
  const [showHint, setShowHint]             = useState(false);
  const [hint, setHint]                     = useState<string | null>(null);
  const [loadingHint, setLoadingHint]       = useState(false);
  const [hintsUsed, setHintsUsed]           = useState(0);
  const [elapsed, setElapsed]               = useState(0);
  const [sessionXP, setSessionXP]           = useState(0);
  const [earnedXP, setEarnedXP]             = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const startTimeRef = useRef(Date.now());
  const transitionLockRef = useRef(false); // prevents click-through to next question
  const [chatOpen, setChatOpen]             = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [questionKey]);

  // Countdown timer during review phase
  useEffect(() => {
    if (!reviewPhase || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [reviewPhase, countdown]);

  useEffect(() => {
    if (activeQuestion) {
      setSelected(null); setSubmitted(false); setReviewPhase(false);
      setCountdown(0); setShowHint(false);
      setHint(null); setHintsUsed(0); setElapsed(0);
      startTimeRef.current = Date.now(); setShowCelebration(false); setEarnedXP(0);
    }
  }, [activeQuestion?._id]);

  if (!student || !currentTopic) return null;

  const handleSelect = async (idx: number) => {
    if (submitted || !activeQuestion || transitionLockRef.current) return;
    setSelected(idx); setSubmitted(true);
    const isCorrect = idx === activeQuestion.correctIndex;
    setQuestionsAnswered(q => q + 1);
    const xpGained = isCorrect
      ? (activeQuestion.difficulty * 50) + (hintsUsed === 0 ? 30 : 0)
      : 0;
    if (isCorrect) {
      setSessionXP(x => x + xpGained);
      setEarnedXP(xpGained);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1800);
    }
    // Enter review phase with 5-second minimum
    setReviewPhase(true);
    setCountdown(5);
    await submitAttempt({
      studentId: studentId as Id<"students">, questionId: activeQuestion._id,
      topicId: topicId as Id<"topics">, choiceIndex: idx, isCorrect,
      timeMs: Date.now() - startTimeRef.current, hintsUsed, difficulty: activeQuestion.difficulty,
    });
  };

  const handleHint = async () => {
    if (!activeQuestion || loadingHint) return;
    setShowHint(true); setLoadingHint(true); setHintsUsed(h => h + 1);
    const r = await generateHint({
      studentId: studentId as Id<"students">, questionId: activeQuestion._id,
      studentInput: selected !== null ? activeQuestion.choices[selected] : "",
    });
    setHint(r.hint); setLoadingHint(false);
  };

  const handleNextQuestion = () => {
    if (countdown > 0) return; // enforce 5s minimum
    transitionLockRef.current = true;
    setTimeout(() => { transitionLockRef.current = false; }, 400);
    setReviewPhase(false);
    setActiveQuestion(null);
    setQuestionKey(k => k + 1);
  };

  const isCorrect = submitted && selected === activeQuestion?.correctIndex;
  const timerStr  = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── Ambient ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--color-primary-muted) 0%, transparent 70%)' }} />
      </div>

      {/* ── Top nav ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-4">
          <button className="btn-icon" onClick={() => navigate(`/student/${studentId}`)}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{currentTopic.nameHe}</div>
            <div className="label-mono" style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>מצב תרגול</div>
          </div>
        </div>

        {/* Session stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <Activity size={13} style={{ color: 'var(--color-primary-light)' }} />
            <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {questionsAnswered}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>שאלות</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <Zap size={13} style={{ color: 'var(--color-warning)' }} />
            <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-warning)' }}>
              +{sessionXP}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>XP</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setChatOpen(true)}>
            <Bot size={14} />
            עזרת AI
          </button>
        </div>
      </motion.header>

      {/* ── Main arena ── */}
      <div className="relative z-10 max-w-6xl mx-auto pt-24 px-6 pb-16 flex gap-6 items-start">

        {/* Left: Question area */}
        <div className="flex-1 flex flex-col gap-5">

          {!activeQuestion && question === undefined ? (
            <div className="glass p-16 flex flex-col items-center justify-center text-center">
              <RotateCcw size={36} className="animate-spin mb-4" style={{ color: 'var(--color-primary)', opacity: 0.5 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>טוען שאלה...</p>
            </div>
          ) : !activeQuestion && question === null ? (
            <div className="glass p-16 flex flex-col items-center justify-center text-center">
              <CheckCircle2 size={48} style={{ color: 'var(--color-success)', marginBottom: 16 }} />
              <h2 className="heading-display mb-3" style={{ fontSize: '1.6rem' }}>כל השאלות הושלמו!</h2>
              <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
                סיימת את כל השאלות הזמינות בנושא זה.
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => navigate(`/student/${studentId}`)}>
                חזרה למפת הלמידה
              </button>
            </div>
          ) : activeQuestion ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeQuestion._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Question card */}
                <div className="glass relative overflow-hidden" style={{ padding: '32px' }}>
                  <div className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />

                  {/* Meta row */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="badge badge-primary">שאלה #{questionsAnswered + 1}</span>
                      <span className="badge" style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-secondary)'
                      }}>
                        {'★'.repeat(Math.max(0, activeQuestion.difficulty || 1))}{'☆'.repeat(Math.max(0, 3 - (activeQuestion.difficulty || 1)))} רמה {activeQuestion.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                      <Clock size={14} />
                      <span>{timerStr}</span>
                    </div>
                  </div>

                  {/* Stem */}
                  <div className="text-xl leading-relaxed font-medium mb-8" style={{ color: 'var(--text-primary)' }}>
                    {activeQuestion.stem}
                  </div>

                  {/* Celebration */}
                  <AnimatePresence>
                    {showCelebration && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.3 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                        style={{ background: 'rgba(16,185,129,0.08)' }}
                      >
                        <div className="text-6xl font-black" style={{ color: 'var(--color-success)', textShadow: '0 0 40px rgba(16,185,129,0.6)' }}>
                          ✓ מעולה!
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Choices */}
                  <div className="flex flex-col gap-3 mb-6">
                    {activeQuestion.choices.map((choice: string, idx: number) => {
                      const isThisCorrect = idx === activeQuestion.correctIndex;
                      const isSelected    = selected === idx;
                      const isWrong       = submitted && isSelected && !isThisCorrect;
                      const isRight       = submitted && isThisCorrect;

                      let borderColor = 'var(--border-default)';
                      let bg          = 'var(--bg-surface)';
                      let textColor   = 'var(--text-secondary)';
                      let RightIcon: typeof CheckCircle2 | null = null;

                      if (isRight)  { borderColor = 'rgba(16,185,129,0.5)'; bg = 'var(--color-success-muted)'; textColor = 'var(--text-primary)'; RightIcon = CheckCircle2; }
                      if (isWrong)  { borderColor = 'rgba(239,68,68,0.5)';  bg = 'var(--color-danger-muted)';  textColor = 'var(--text-muted)';    RightIcon = XCircle; }
                      if (isSelected && !submitted) { borderColor = 'var(--border-primary)'; bg = 'var(--color-primary-muted)'; textColor = 'var(--text-primary)'; }

                      return (
                        <motion.button
                          key={idx}
                          whileHover={!submitted ? { scale: 1.01 } : {}}
                          whileTap={!submitted ? { scale: 0.99 } : {}}
                          className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-right transition-all duration-200"
                          style={{
                            background: bg,
                            border: `1.5px solid ${borderColor}`,
                            color: textColor,
                            cursor: submitted ? 'default' : 'pointer',
                            opacity: submitted && !isRight && !isWrong ? 0.5 : 1,
                          }}
                          onClick={() => handleSelect(idx)}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm"
                            style={{ background: isRight ? 'rgba(16,185,129,0.2)' : isWrong ? 'rgba(239,68,68,0.2)' : 'var(--bg-elevated)', color: textColor }}>
                            {isRight && RightIcon ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} /> :
                             isWrong && RightIcon ? <XCircle size={16} style={{ color: 'var(--color-danger)' }} /> :
                             String.fromCharCode(65 + idx)}
                          </div>
                          <span className="flex-1 font-medium">{choice}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Hint button (pre-submit) */}
                  {!submitted && (
                    <div className="flex items-center gap-3">
                      <button
                        className="btn btn-ghost"
                        onClick={handleHint}
                        disabled={loadingHint}
                      >
                        <Lightbulb size={15} />
                        {loadingHint ? 'טוען רמז...' : 'רמז מ-AI'}
                      </button>
                    </div>
                  )}

                  {/* Hint panel */}
                  <AnimatePresence>
                    {(showHint && hint) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 overflow-hidden"
                      >
                        <div className="p-4 rounded-xl flex items-start gap-3"
                          style={{ background: 'var(--color-warning-muted)', border: '1px solid rgba(245,158,11,0.25)' }}>
                          <Lightbulb size={16} style={{ color: 'var(--color-warning)', marginTop: 2, flexShrink: 0 }} />
                          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{hint}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Review Phase: Full Explanation Panel ── */}
                  <AnimatePresence>
                    {reviewPhase && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35 }}
                        className="mt-6 rounded-2xl overflow-hidden"
                        style={{
                          border: `2px solid ${isCorrect ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
                          background: isCorrect ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                        }}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4"
                          style={{ background: isCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', borderBottom: `1px solid ${isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                          <div className="flex items-center gap-3">
                            {isCorrect
                              ? <CheckCircle2 size={22} style={{ color: 'var(--color-success)' }} />
                              : <XCircle size={22} style={{ color: 'var(--color-danger)' }} />}
                            <span className="font-bold text-lg" style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: "'Yarden', sans-serif" }}>
                              {isCorrect ? '✓ תשובה נכונה!' : '✗ תשובה שגויה'}
                            </span>
                            {isCorrect && earnedXP > 0 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                <Zap size={11} /> +{earnedXP} XP
                              </span>
                            )}
                          </div>
                          {/* Countdown / Next button */}
                          <button
                            onClick={handleNextQuestion}
                            disabled={countdown > 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                            style={{
                              background: countdown > 0 ? 'var(--bg-elevated)' : 'var(--color-primary)',
                              color: countdown > 0 ? 'var(--text-muted)' : 'var(--color-on-primary)',
                              border: countdown > 0 ? '1px solid var(--border-default)' : 'none',
                              cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                              opacity: countdown > 0 ? 0.7 : 1,
                            }}
                          >
                            {countdown > 0 ? (
                              <><Clock size={14} /> {countdown}s...</>
                            ) : (
                              <>שאלה הבאה <ArrowRight size={14} /></>
                            )}
                          </button>
                        </div>

                        <div className="p-6 flex flex-col gap-5">
                          {/* If wrong: show correct answer */}
                          {!isCorrect && (
                            <div className="flex items-start gap-3 p-4 rounded-xl"
                              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                              <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-success)' }}>התשובה הנכונה:</div>
                                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {activeQuestion.choices[activeQuestion.correctIndex]}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Lightbulb size={15} style={{ color: 'var(--color-warning)' }} />
                              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>הסבר:</span>
                            </div>
                            <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)', lineHeight: 1.75 }}>
                              {activeQuestion.explanation}
                            </p>
                          </div>

                          {/* Solution Steps */}
                          {activeQuestion.solutionSteps && activeQuestion.solutionSteps.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Star size={15} style={{ color: 'var(--color-primary)' }} />
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>שלבי פתרון:</span>
                              </div>
                              <ol className="flex flex-col gap-2.5">
                                {activeQuestion.solutionSteps.map((step: string, i: number) => (
                                  <li key={i} className="flex items-start gap-3 text-sm"
                                    style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                      style={{ background: 'var(--color-primary-muted)', color: 'var(--color-primary)', border: '1px solid var(--border-primary)' }}>
                                      {i + 1}
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {/* Right: Calculator */}
        <div className="w-[300px] flex-shrink-0 hidden lg:block">
          <CalculatorCard />
        </div>
      </div>

      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId!}
        agentType="practice"
        questionStem={activeQuestion?.stem}
        topicName={currentTopic?.nameHe}
        topicId={topicId}
        questionId={activeQuestion?._id}
      />
    </div>
  );
}

function CalculatorCard() {
  const [eqValue, setEqValue] = useState("");

  const handleKeyPress = (key: string) => {
    if (key === "del") setEqValue(v => v === "Error" ? "" : v.slice(0, -1));
    else if (key === "C") setEqValue("");
    else if (key === "=") {
      try {
        const expr = eqValue
          .replace(/×/g, "*").replace(/÷/g, "/")
          .replace(/π/g, "Math.PI")
          .replace(/sin\(/g, "Math.sin(").replace(/cos\(/g, "Math.cos(")
          .replace(/tan\(/g, "Math.tan(").replace(/log\(/g, "Math.log10(")
          .replace(/√\(/g, "Math.sqrt(").replace(/\^/g, "**");
        const result = new Function("return " + expr)();
        setEqValue(Number.isFinite(result) ? Number(result.toFixed(5)).toString() : "Error");
      } catch { setEqValue("Error"); }
    }
    else if (["sin", "cos", "tan", "log", "√"].includes(key)) setEqValue(v => (v === "Error" ? "" : v) + key + "(");
    else if (key === "x²") setEqValue(v => (v === "Error" ? "" : v) + "^2");
    else if (key === "xⁿ") setEqValue(v => (v === "Error" ? "" : v) + "^");
    else setEqValue(v => (v === "Error" ? "" : v) + key);
  };

  return (
    <div className="glass" style={{ padding: '20px' }}>
      <div className="label-mono mb-4">מחשבון מדעי</div>

      {/* Display */}
      <div className="rounded-lg px-4 py-3 mb-4 text-left overflow-hidden"
        style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-default)', minHeight: 52 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: eqValue.length > 12 ? '0.85rem' : '1.2rem',
          color: 'var(--text-primary)',
          direction: 'ltr',
          display: 'block',
          textAlign: 'right',
        }}>
          {eqValue || <span style={{ color: 'var(--text-disabled)' }}>0</span>}
        </span>
      </div>

      {/* Scientific row */}
      <div className="grid grid-cols-4 gap-1.5 mb-1.5">
        {["x²", "xⁿ", "√", "π", "sin", "cos", "tan", "log"].map(k => (
          <button key={k} onClick={() => handleKeyPress(k)}
            className="h-9 rounded-lg text-xs font-medium transition-all duration-150"
            style={{
              background: 'var(--color-primary-muted)',
              border: '1px solid var(--border-primary)',
              color: 'var(--color-primary-light)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(99,102,241,0.25)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'var(--color-primary-muted)'; }}
          >{k}</button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {["(", ")", "C", "del", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "=", "+"].map(k => {
          const isEquals  = k === "=";
          const isClear   = k === "C";
          const isOp      = ["÷", "×", "-", "+", "(", ")"].includes(k);
          const isDel     = k === "del";

          const bg = isEquals ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))'
                   : isClear  ? 'var(--color-danger-muted)'
                   : isDel    ? 'var(--bg-elevated)'
                   : isOp     ? 'var(--color-accent-muted)'
                   : 'var(--bg-surface)';
          const color = isEquals ? '#fff'
                      : isClear  ? 'var(--color-danger)'
                      : isOp     ? 'var(--color-accent)'
                      : 'var(--text-secondary)';
          const border = isEquals ? 'var(--border-primary)'
                       : isClear  ? 'rgba(239,68,68,0.25)'
                       : 'var(--border-subtle)';

          return (
            <button key={k} onClick={() => handleKeyPress(k)}
              className="h-10 rounded-lg font-medium text-sm transition-all duration-150"
              style={{ background: bg, border: `1px solid ${border}`, color, cursor: 'pointer', fontFamily: isEquals ? '' : 'var(--font-mono)' }}
              onMouseEnter={e => { if (!isEquals) (e.target as HTMLButtonElement).style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={e => { if (!isEquals) (e.target as HTMLButtonElement).style.background = bg as string; }}
            >{k}</button>
          );
        })}
      </div>
    </div>
  );
}
