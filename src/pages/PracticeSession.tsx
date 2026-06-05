import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, RotateCcw, AlertTriangle, Zap, Bot, Database, Activity, Scan, Terminal } from "lucide-react";
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
    questionKey: questionKey,
  });

  const [activeQuestion, setActiveQuestion] = useState<Doc<"questions"> | null>(null);

  useEffect(() => {
    if (question && !activeQuestion) {
      setActiveQuestion(question);
    }
  }, [question, activeQuestion]);

  useEffect(() => {
    setActiveQuestion(null);
  }, [topicId]);

  const submitAttempt = useMutation(api.attempts.submitAttempt);
  const generateHint = useMutation(api.ai.generateHint);

  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
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
    if (activeQuestion) {
      setSelected(null); setSubmitted(false); setShowHint(false);
      setHint(null); setHintsUsed(0); setElapsed(0);
      startTimeRef.current = Date.now(); setShowCelebration(false);
    }
  }, [activeQuestion?._id]);

  if (!student || !currentTopic) return null;

  const handleSelect = async (idx: number) => {
    if (submitted || !activeQuestion) return;
    setSelected(idx); setSubmitted(true);
    const isCorrect = idx === activeQuestion.correctIndex;
    setQuestionsAnswered(q => q + 1);
    if (isCorrect) {
      setSessionXP(x => x + (activeQuestion.difficulty * 50) + (hintsUsed === 0 ? 30 : 0));
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
    }
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
    setActiveQuestion(null);
    setQuestionKey(k => k + 1);
  };

  const isCorrect = submitted && selected === activeQuestion?.correctIndex;

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      
      {/* ── Background & Ambient ── */}
      <div className="absolute top-0 left-0 w-[50vw] h-full border-r border-[var(--neon-emerald)] opacity-10" style={{clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)'}}></div>
      
      {/* ── HUD ── */}
      <div className="fixed top-6 left-6 z-40 flex items-center gap-6">
        <button className="cyber-btn cyber-btn-ghost !p-2" onClick={() => navigate(`/student/${studentId}`)}>
          <ChevronLeft size={24} />
        </button>
        <div>
          <div className="t-mono-label">MODULE: {currentTopic.nameHe}</div>
          <div className="font-mono text-[var(--neon-emerald)] opacity-80 uppercase tracking-widest text-xs mt-1">ACTIVE ASSIMILATION</div>
        </div>
      </div>

      <div className="fixed top-6 right-6 z-40 flex gap-6">
        <div className="shard px-6 py-3 flex items-center gap-3">
          <Activity size={16} className="text-[var(--acid-green)]" />
          <div className="font-mono font-bold">{questionsAnswered} / INF</div>
        </div>
        <div className="shard px-6 py-3 flex items-center gap-3">
          <Zap size={16} className="text-[var(--neon-emerald)]" />
          <div className="font-mono font-bold">+{sessionXP} XP</div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-40 flex gap-6">
        <button className="cyber-btn" onClick={() => setChatOpen(true)}>
          <Terminal size={18} />
          [ TERMINAL_UPLINK ]
        </button>
      </div>

      {/* ── Main Arena ── */}
      <div className="relative z-10 w-full max-w-7xl px-8 flex gap-12 items-start mt-12">
        
        {/* Left: The Question Slab */}
        <div className="flex-1 flex flex-col gap-8 relative">
          
          {question === undefined ? (
            <div className="shard p-24 flex flex-col items-center justify-center text-[var(--neon-emerald)] text-center">
              <Scan size={64} className="animate-spin mb-8 opacity-50" />
              <h2 className="hud-title text-4xl" data-text="SCANNING...">SCANNING...</h2>
            </div>
          ) : question === null ? (
            <div className="shard p-24 flex flex-col items-center justify-center text-center">
              <Database size={64} className="text-[var(--acid-green)] mb-8" />
              <h2 className="hud-title text-5xl mb-4" data-text="DATABANK_DEPLETED">DATABANK_DEPLETED</h2>
              <p className="font-mono text-[var(--text-muted)] mb-12">ALL AVAILABLE NODES ASSIMILATED.</p>
              <button className="cyber-btn" onClick={() => navigate(`/student/${studentId}`)}>
                [ RETURN_TO_CORE ]
              </button>
            </div>
          ) : (
            <>
              {/* Question Header */}
              <div className="flex justify-between items-end border-b border-[var(--neon-emerald)] pb-4 mb-4">
                <div className="font-mono text-2xl font-bold text-[var(--neon-emerald)]">PROBLEM_ID: {question._id.slice(-6).toUpperCase()}</div>
                <div className="flex items-center gap-2 text-[var(--acid-green)] font-mono">
                  <RotateCcw size={16} className="animate-spin-slow" />
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </div>
              </div>

              {/* The Stem */}
              <motion.div 
                key={question._id} 
                initial={{ opacity: 0, x: -50, scale: 0.95 }} 
                animate={{ opacity: 1, x: 0, scale: 1 }} 
                className="text-2xl leading-relaxed mb-8"
              >
                {question.stem}
              </motion.div>

              {/* Celebration Overlay */}
              <AnimatePresence>
                {showCelebration && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 2 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0 }} 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-title text-[8rem] text-[var(--neon-emerald)] drop-shadow-[var(--glow-emerald)] z-50 pointer-events-none"
                  >
                    SYNCED!
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Choices */}
              <div className="flex flex-col gap-6">
                {question.choices.map((choice: string, idx: number) => {
                  const isCorrectC = idx === question.correctIndex;
                  const isWrong = submitted && idx === selected && !isCorrectC;
                  const isRight = submitted && isCorrectC;
                  
                  return (
                    <button 
                      key={idx} 
                      className={`shard p-8 text-xl text-right transition-all font-mono duration-300 relative overflow-hidden group
                        ${submitted ? 'cursor-default opacity-80' : 'cursor-pointer hover:-translate-x-2'}
                        ${selected === idx && !submitted ? 'border-[var(--acid-green)] shadow-[var(--glow-acid)]' : ''}
                        ${isRight ? 'border-[var(--neon-emerald)] bg-[rgba(0,255,136,0.2)]' : ''}
                        ${isWrong ? 'border-[var(--danger-crimson)] bg-[rgba(255,0,85,0.1)] opacity-50' : ''}
                      `}
                      onClick={() => handleSelect(idx)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="opacity-50 text-sm">[{idx + 1}]</span>
                        <div className="flex-1 mr-6">{choice}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Actions / Feedback */}
              <div className="mt-8 flex gap-6">
                {!submitted ? (
                  <>
                    <button 
                      className={`cyber-btn ${selected !== null ? '' : 'opacity-50 pointer-events-none grayscale'}`} 
                      onClick={selected !== null ? () => handleSelect(selected) : undefined}
                    >
                      [ INITIATE_VERIFICATION ]
                    </button>
                    <button className="cyber-btn cyber-btn-ghost text-[var(--warning-amber)] border-[var(--warning-amber)] hover:bg-[var(--warning-amber)]" onClick={handleHint}>
                      <Bot size={16} /> [ REQUEST_AI_ASSIST ]
                    </button>
                  </>
                ) : (
                  <button className="cyber-btn" onClick={handleNextQuestion}>
                    [ PROCEED_NEXT_NODE ] <ChevronLeft size={16} />
                  </button>
                )}
              </div>

              {/* Explanation Panel */}
              <AnimatePresence>
                {submitted && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`mt-8 shard p-8 border-l-4 ${isCorrect ? 'border-[var(--neon-emerald)]' : 'border-[var(--danger-crimson)]'}`}>
                    <div className="t-mono-label mb-2">SYSTEM_ANALYSIS // {isCorrect ? 'SUCCESS' : 'FAILURE'}</div>
                    <div className="font-mono">{question.explanation}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

        </div>

        {/* Right: The Hardware Keypad & AI Link */}
        <div className="w-[320px] flex-shrink-0 flex flex-col gap-8">
          
          <CalculatorCard />

          <div className="shard p-8 flex flex-col gap-6">
            <div className="t-mono-label flex items-center gap-2">
              <Bot size={14} /> AI_ENGINE_STATUS
            </div>
            {loadingHint ? (
              <div className="text-[var(--acid-green)] font-mono animate-pulse">PROCESSING_QUERY...</div>
            ) : hint ? (
              <div className="font-mono text-sm border-r-2 border-[var(--neon-emerald)] pr-4 italic">"{hint}"</div>
            ) : (
              <div className="font-mono text-sm opacity-50">ENGINE_IDLE. AWAITING_PROMPT.</div>
            )}
          </div>

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
        const expr = eqValue.replace(/×/g, "*").replace(/÷/g, "/").replace(/π/g, "Math.PI").replace(/sin\(/g, "Math.sin(").replace(/cos\(/g, "Math.cos(").replace(/tan\(/g, "Math.tan(").replace(/log\(/g, "Math.log10(").replace(/√\(/g, "Math.sqrt(").replace(/\^/g, "**");
        const result = new Function("return " + expr)();
        setEqValue(Number.isFinite(result) ? Number(result.toFixed(5)).toString() : "Error");
      } catch {
        setEqValue("Error");
      }
    } 
    else if (["sin", "cos", "tan", "log", "√"].includes(key)) setEqValue(v => (v === "Error" ? "" : v) + key + "(");
    else if (key === "x²") setEqValue(v => (v === "Error" ? "" : v) + "^2");
    else if (key === "xⁿ") setEqValue(v => (v === "Error" ? "" : v) + "^");
    else setEqValue(v => (v === "Error" ? "" : v) + key);
  };

  return (
    <div className="shard p-8">
      <div className="t-mono-label flex items-center justify-between mb-4">
        <span>HARDWARE_CALCULATOR</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded bg-[var(--danger-crimson)] cursor-pointer" onClick={() => setEqValue("")} />
          <div className="w-2 h-2 rounded bg-[var(--warning-amber)]" />
          <div className="w-2 h-2 rounded bg-[var(--neon-emerald)]" />
        </div>
      </div>
      
      <div className="bg-[rgba(0,0,0,0.5)] border border-[var(--neon-emerald)] font-mono text-[var(--neon-emerald)] text-xl mb-6 p-4 min-h-[60px] text-left dir-ltr flex items-center justify-end overflow-hidden shadow-[var(--glow-emerald)]">
        {eqValue || <span className="opacity-30">0.0000</span>}
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {["x²","xⁿ","√","π","sin","cos","tan","log"].map(k => (
          <button key={k} className="h-12 bg-[rgba(0,255,136,0.1)] hover:bg-[rgba(0,255,136,0.3)] text-[var(--acid-green)] font-mono font-bold transition-colors" style={{clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)'}} onClick={() => handleKeyPress(k)}>{k}</button>
        ))}
        {["(",")","C","del","7","8","9","÷","4","5","6","×","1","2","3","-","0",".","=","+"].map(k => (
          <button 
            key={k} 
            className={`h-12 font-mono font-bold transition-all ${
              k === "=" ? "bg-[var(--neon-emerald)] text-[var(--bg-deep)] shadow-[var(--glow-emerald)]" : 
              k === "C" ? "bg-[rgba(255,0,85,0.2)] text-[var(--danger-crimson)]" : 
              "bg-[var(--bg-panel)] text-[var(--text-bright)] hover:bg-[rgba(0,255,136,0.2)] hover:text-[var(--neon-emerald)] border border-[rgba(0,255,136,0.1)]"
            }`}
            style={{clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)'}}
            onClick={() => handleKeyPress(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
