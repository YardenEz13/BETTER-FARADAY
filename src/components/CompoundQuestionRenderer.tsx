import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Lightbulb, Check, X, Send, Lock, Clock, Bot, ArrowRight } from "lucide-react";
import MathText from "./MathText";

interface Section {
  label: string;
  prompt: string;
  dependsOn?: string[];
  answerType: string;
  correctAnswer: string;
  solutionSteps: string[];
  hints: string[];
  points: number;
  skillsTested: string[];
}

interface CompoundQuestionData {
  _id: Id<"compoundQuestions">;
  preamble: string;
  preambleParams: { symbol: string; displayHe: string; type: string; value?: string }[];
  sections: Section[];
  difficulty: number;
  tags: string[];
  fullSolution: string;
}

interface Props {
  question: CompoundQuestionData;
  assignedQuestionId: Id<"assignedQuestions">;
  onComplete: () => void;
  aiChatTrigger?: () => void;
  /** AI-generated preamble override (themed version). If undefined, original is shown. */
  overridePreamble?: string;
}

export default function CompoundQuestionRenderer({ question, assignedQuestionId, onComplete, aiChatTrigger, overridePreamble }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [hintsRevealed, setHintsRevealed] = useState<Record<string, number>>({});
  const [expandedSection, setExpandedSection] = useState<string>("א");
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});
  const [sectionTimes, setSectionTimes] = useState<Record<string, number>>({});
  const [sectionStartTime, setSectionStartTime] = useState(Date.now());

  const submitAnswer = useMutation(api.homework.submitAnswer);
  const finalizeSubmission = useMutation(api.homework.finalizeSubmission);

  const isSectionUnlocked = (section: Section) => {
    if (!section.dependsOn || section.dependsOn.length === 0) return true;
    return section.dependsOn.every((dep) => submitted[dep]);
  };

  const handleRevealHint = (label: string, maxHints: number) => {
    const current = hintsRevealed[label] ?? 0;
    if (current < maxHints) {
      setHintsRevealed((prev) => ({ ...prev, [label]: current + 1 }));
    }
  };

  const handleSubmitSection = async (section: Section) => {
    const answer = answers[section.label]?.trim();
    if (!answer) return;

    const timeMs = Date.now() - sectionStartTime;
    setSectionTimes((prev) => ({ ...prev, [section.label]: timeMs }));

    const correctLower = section.correctAnswer.toLowerCase().replace(/\s+/g, "");
    const answerLower = answer.toLowerCase().replace(/\s+/g, "");
    const isCorrect = correctLower.includes(answerLower) || answerLower.includes(correctLower) || answerLower.length > 5;

    setSubmitted((prev) => ({ ...prev, [section.label]: true }));
    setResults((prev) => ({ ...prev, [section.label]: isCorrect }));

    await submitAnswer({
      assignedQuestionId,
      sectionLabel: section.label,
      studentAnswer: answer,
      isCorrect,
      timeMs,
      hintsUsed: hintsRevealed[section.label] ?? 0,
    });

    // We do NOT auto-expand the next section here anymore,
    // so the student has time to review the solution steps and feedback.
  };

  const handleFinalize = async () => {
    await finalizeSubmission({ assignedQuestionId });
    onComplete();
  };

  const allSubmitted = question.sections.every((s) => submitted[s.label]);
  const correctCount = Object.values(results).filter(Boolean).length;
  const totalPoints = question.sections.reduce((s, sec) => s + sec.points, 0);
  const earnedPoints = question.sections.reduce(
    (s, sec) => s + (results[sec.label] ? sec.points : 0), 0
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Preamble ── */}
      <motion.div
        className="glass p-8 bg-[var(--bg-surface)] border border-[var(--border-default)] relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-none ${i < question.difficulty ? "bg-[var(--color-primary-light)] shadow-[var(--glow-acid)]" : "bg-white opacity-20"}`} />
              ))}
            </div>
            <span className="label-mono opacity-80">רמה {question.difficulty}</span>
          </div>

          <div className="flex gap-2">
            {question.tags.map((tag) => (
              <span key={tag} className="label-mono px-3 py-1 bg-[color-mix(in srgb, var(--color-on-surface) 5%, transparent)] border border-[var(--border-default)]">{tag}</span>
            ))}
          </div>
        </div>

        <div className="text-xl leading-relaxed text-[var(--text-primary)] mb-6"><MathText>{overridePreamble ?? question.preamble}</MathText></div>

        {question.preambleParams.length > 0 && (
          <div className="flex flex-wrap gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border-default)]">
            {question.preambleParams.map((p) => (
              <span key={p.symbol} className="label-mono text-[var(--color-primary-light)]">
                {p.displayHe} <span className="opacity-50 ml-1">({p.type === "find" ? "למציאה" : p.type === "given" ? "נתון" : "טווח"})</span>
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Sections ── */}
      <div className="flex flex-col gap-4">
        {question.sections.map((section, idx) => {
          const unlocked = isSectionUnlocked(section);
          const isExpanded = expandedSection === section.label;
          const isSubmitted = submitted[section.label];
          const isCorrect = results[section.label];
          const hintCount = hintsRevealed[section.label] ?? 0;

          return (
            <motion.div
              key={section.label}
              className={`shard transition-all border ${!unlocked ? "border-[var(--border-default)] bg-[var(--bg-surface)] opacity-60" : isSubmitted ? (isCorrect ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)]" : "border-[var(--color-danger)] bg-[color-mix(in srgb, var(--color-danger) 2%, transparent)]") : "border-[var(--color-primary-light)] bg-[var(--bg-surface)] shadow-[0_0_15px_rgba(180,255,0,0.05)]"}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
            >
              {/* Section Header */}
              <div
                className={`p-6 flex justify-between items-center ${unlocked ? "cursor-pointer" : ""}`}
                onClick={() => unlocked && setExpandedSection(isExpanded ? "" : section.label)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 flex items-center justify-center border font-title text-xl ${!unlocked ? "border-[var(--border-default)] text-[#1a3324]" : isSubmitted ? (isCorrect ? "border-[var(--color-primary)] text-[var(--color-primary)] bg-[color-mix(in srgb, var(--color-primary) 10%, transparent)]" : "border-[var(--color-danger)] text-[var(--color-danger)] bg-[color-mix(in srgb, var(--color-danger) 10%, transparent)]") : "border-[var(--color-primary-light)] text-[var(--color-primary-light)] bg-[rgba(180,255,0,0.1)]"}`}>
                    {!unlocked ? <Lock size={14} /> : isSubmitted ? (isCorrect ? <Check size={16} /> : <X size={16} />) : section.label}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--text-primary)] tracking-wider">סעיף {section.label}׳</div>
                    <div className="label-mono opacity-60 text-[10px]">{section.points} נקודות סנכרון</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex gap-2">
                    {section.skillsTested.slice(0, 2).map((skill) => (
                      <span key={skill} className="label-mono px-2 py-0.5 bg-[color-mix(in srgb, var(--color-on-surface) 5%, transparent)] border border-[var(--border-default)] text-[10px]">{skill}</span>
                    ))}
                  </div>
                  {unlocked && (isExpanded ? <ChevronUp size={20} className="text-[var(--color-primary-light)]" /> : <ChevronDown size={20} className="opacity-50" />)}
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && unlocked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-6 pb-6 overflow-hidden border-t border-[var(--border-default)] pt-6"
                  >
                    <div className="text-lg mb-6 leading-relaxed text-[var(--text-primary)]"><MathText>{section.prompt}</MathText></div>

                    {section.dependsOn && section.dependsOn.length > 0 && (
                      <div className="label-mono text-[var(--color-warning)] mb-6 p-4 border border-[var(--color-warning)] bg-[rgba(255,170,0,0.05)] flex items-center gap-2">
                        <Lightbulb size={16} /> סעיף זה מתבסס על התוצאה מסעיף {section.dependsOn.join(", ")}׳
                      </div>
                    )}

                    {!isSubmitted && (
                      <div className="flex flex-col gap-4">
                        <textarea
                          className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 text-[var(--text-primary)] font-mono focus:border-[var(--color-primary-light)] focus:outline-none transition-colors"
                          placeholder="[ INSERT_SOLUTION_HERE ]"
                          value={answers[section.label] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [section.label]: e.target.value }))}
                          rows={3}
                          dir="rtl"
                        />
                        <div className="flex flex-wrap gap-4 mt-2">
                          <button
                            className={`btn btn-primary ${!answers[section.label]?.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handleSubmitSection(section)}
                            disabled={!answers[section.label]?.trim()}
                          >
                            <Send size={16} /> [ SUBMIT ]
                          </button>

                          {section.hints.length > 0 && (
                            <button
                              className="btn btn-primary btn-ghost"
                              onClick={() => handleRevealHint(section.label, section.hints.length)}
                              disabled={hintCount >= section.hints.length}
                            >
                              <Lightbulb size={16} />
                              [ REQUEST_HINT ] ({hintCount}/{section.hints.length})
                            </button>
                          )}

                          {aiChatTrigger && (
                            <button className="btn btn-primary btn-ghost" onClick={aiChatTrigger}>
                              <Bot size={16} /> [ AI_ASSIST ]
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {hintCount > 0 && (
                      <div className="flex flex-col gap-3 mt-6">
                        {section.hints.slice(0, hintCount).map((hint, i) => (
                          <motion.div
                            key={i}
                            className="p-4 border border-[var(--color-accent)] bg-[var(--color-accent-muted)] label-mono flex items-start gap-3 text-[var(--text-primary)] normal-case"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <Lightbulb size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
                            <span className="leading-relaxed"><MathText>{hint}</MathText></span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {isSubmitted && (
                      <motion.div
                        className={`p-6 mt-6 border flex flex-col gap-4 ${isCorrect ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]" : "border-[var(--color-danger)] bg-[var(--color-danger-muted)] text-[var(--color-danger)]"}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <div className="flex items-center gap-3 font-title text-2xl tracking-wider">
                          {isCorrect ? (
                            <><Check size={24} /> סנכרון נתונים מלא! התשובה נכונה 🎉</>
                          ) : (
                            <><X size={24} /> אנומליה זוהתה בנתונים — התשובה שגויה.</>
                          )}
                        </div>

                        <button
                          className="btn btn-primary btn-ghost self-start mt-2"
                          onClick={() => setShowSolution((prev) => ({ ...prev, [section.label]: !prev[section.label] }))}
                        >
                          {showSolution[section.label] ? "[ HIDE_SOLUTION ]" : "[ REVEAL_SOLUTION ]"}
                        </button>

                        <AnimatePresence>
                          {showSolution[section.label] && (
                            <motion.div
                              className="flex flex-col gap-3 mt-4"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                            >
                              {section.solutionSteps.map((step, i) => (
                                <div key={i} className="flex gap-4 items-start p-4 bg-[var(--bg-surface)] border border-[color-mix(in srgb, var(--color-on-surface) 10%, transparent)] text-[var(--text-primary)]">
                                  <span className="w-6 h-6 flex items-center justify-center bg-white text-black font-bold shrink-0">{i + 1}</span>
                                  <span className="leading-relaxed text-lg"><MathText>{step}</MathText></span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {idx < question.sections.length - 1 && (
                          <button
                            className="btn btn-primary mt-4 self-end flex items-center gap-2"
                            onClick={() => {
                              const next = question.sections[idx + 1];
                              setExpandedSection(next.label);
                              setSectionStartTime(Date.now());
                            }}
                          >
                            המשך לסעיף הבא <ArrowRight size={16} />
                          </button>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── Score Summary ── */}
      {allSubmitted && (
        <motion.div
          className="glass p-8 mt-8 border border-[var(--color-accent)] bg-[var(--color-accent-muted)] flex flex-col items-center text-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="font-title text-6xl text-[var(--color-accent)] shadow-[var(--glow-cyan)] tracking-widest">{earnedPoints}/{totalPoints}</div>
            <div className="label-mono opacity-80">נקודות סנכרון</div>
          </div>
          
          <div className="flex flex-wrap gap-6 justify-center label-mono opacity-60">
            <div className="flex items-center gap-2"><Check size={16} className="text-[var(--color-primary)]" /> {correctCount}/{question.sections.length} סעיפים נכונים</div>
            <div className="flex items-center gap-2"><Clock size={16} className="text-[var(--color-accent)]" /> {Object.values(sectionTimes).reduce((s, t) => s + t, 0) > 0 ? Math.round(Object.values(sectionTimes).reduce((s, t) => s + t, 0) / 60000) : 0} דקות סה"כ</div>
            <div className="flex items-center gap-2"><Lightbulb size={16} className="text-[var(--color-warning)]" /> {Object.values(hintsRevealed).reduce((s, h) => s + h, 0)} רמזים שומשו</div>
          </div>
          
          <button className="btn btn-primary mt-4" onClick={handleFinalize}>
            [ CONTINUE_TO_NEXT ] ➜
          </button>
        </motion.div>
      )}
    </div>
  );
}

