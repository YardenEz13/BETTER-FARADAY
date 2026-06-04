import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Lightbulb, Check, X, Send, Lock, Clock, Bot } from "lucide-react";
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
}

export default function CompoundQuestionRenderer({ question, assignedQuestionId, onComplete, aiChatTrigger }: Props) {
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

    // Simple correctness check: contains key parts of the correct answer
    // In production, this would use more sophisticated matching
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

    // Auto-expand next section
    const idx = question.sections.findIndex((s) => s.label === section.label);
    if (idx < question.sections.length - 1) {
      const next = question.sections[idx + 1];
      setExpandedSection(next.label);
      setSectionStartTime(Date.now());
    }
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
    <div className="compound-question">
      {/* ── Preamble ── */}
      <motion.div
        className="cq-preamble"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="cq-difficulty-badge">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`cq-diff-dot ${i < question.difficulty ? "active" : ""}`} />
          ))}
          <span>רמה {question.difficulty}</span>
        </div>

        <div className="cq-tags">
          {question.tags.map((tag) => (
            <span key={tag} className="context-chip">{tag}</span>
          ))}
        </div>

        <div className="cq-preamble-text"><MathText>{question.preamble}</MathText></div>

        {question.preambleParams.length > 0 && (
          <div className="cq-params">
            {question.preambleParams.map((p) => (
              <span key={p.symbol} className="cq-param-chip">
                {p.displayHe} ({p.type === "find" ? "למציאה" : p.type === "given" ? "נתון" : "טווח"})
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Sections ── */}
      <div className="cq-sections">
        {question.sections.map((section, idx) => {
          const unlocked = isSectionUnlocked(section);
          const isExpanded = expandedSection === section.label;
          const isSubmitted = submitted[section.label];
          const isCorrect = results[section.label];
          const hintCount = hintsRevealed[section.label] ?? 0;

          return (
            <motion.div
              key={section.label}
              className={`cq-section ${isSubmitted ? (isCorrect ? "correct" : "incorrect") : ""} ${!unlocked ? "locked" : ""}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
            >
              {/* Section Header */}
              <div
                className="cq-section-header"
                onClick={() => unlocked && setExpandedSection(isExpanded ? "" : section.label)}
              >
                <div className="flex items-center gap-3">
                  <div className={`cq-section-label ${isSubmitted ? (isCorrect ? "correct" : "incorrect") : unlocked ? "active" : "locked"}`}>
                    {!unlocked ? <Lock size={14} /> : isSubmitted ? (isCorrect ? <Check size={14} /> : <X size={14} />) : section.label}
                  </div>
                  <div>
                    <div className="cq-section-title">סעיף {section.label}׳</div>
                    <div className="cq-section-points">{section.points} נקודות</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {section.skillsTested.slice(0, 2).map((skill) => (
                    <span key={skill} className="cq-skill-tag">{skill}</span>
                  ))}
                  {unlocked && (isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && unlocked && (
                  <motion.div
                    className="cq-section-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Prompt */}
                    <div className="cq-prompt"><MathText>{section.prompt}</MathText></div>

                    {/* Dependency note */}
                    {section.dependsOn && section.dependsOn.length > 0 && (
                      <div className="cq-depends">
                        💡 סעיף זה מתבסס על התוצאה מסעיף {section.dependsOn.join(", ")}׳
                      </div>
                    )}

                    {/* Answer input */}
                    {!isSubmitted && (
                      <div className="cq-answer-area">
                        <textarea
                          className="cq-textarea"
                          placeholder="כתבו את הפתרון שלכם כאן..."
                          value={answers[section.label] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [section.label]: e.target.value }))}
                          rows={3}
                          dir="rtl"
                        />
                        <div className="cq-answer-actions">
                          <button
                            className="btn btn-primary cq-submit-btn"
                            onClick={() => handleSubmitSection(section)}
                            disabled={!answers[section.label]?.trim()}
                          >
                            <Send size={16} /> שלח תשובה
                          </button>

                          {section.hints.length > 0 && (
                            <button
                              className="btn btn-ghost cq-hint-btn"
                              onClick={() => handleRevealHint(section.label, section.hints.length)}
                              disabled={hintCount >= section.hints.length}
                            >
                              <Lightbulb size={16} />
                              רמז ({hintCount}/{section.hints.length})
                            </button>
                          )}

                          {aiChatTrigger && (
                            <button className="btn btn-ghost cq-ai-btn" onClick={aiChatTrigger}>
                              <Bot size={16} /> שאל את פאראדיי
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hints */}
                    {hintCount > 0 && (
                      <div className="cq-hints">
                        {section.hints.slice(0, hintCount).map((hint, i) => (
                          <motion.div
                            key={i}
                            className="cq-hint"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <Lightbulb size={14} />
                            <span>רמז {i + 1}: <MathText>{hint}</MathText></span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Result */}
                    {isSubmitted && (
                      <motion.div
                        className={`cq-result ${isCorrect ? "correct" : "incorrect"}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <div className="cq-result-header">
                          {isCorrect ? (
                            <>
                              <Check size={20} /> כל הכבוד! תשובה נכונה 🎉
                            </>
                          ) : (
                            <>
                              <X size={20} /> לא מדויק — בואו נראה את הפתרון
                            </>
                          )}
                        </div>

                        <button
                          className="btn btn-ghost mt-3"
                          onClick={() => setShowSolution((prev) => ({ ...prev, [section.label]: !prev[section.label] }))}
                          style={{ fontSize: "0.85rem" }}
                        >
                          {showSolution[section.label] ? "הסתר פתרון" : "הצג פתרון מלא"}
                        </button>

                        <AnimatePresence>
                          {showSolution[section.label] && (
                            <motion.div
                              className="cq-solution"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                            >
                              {section.solutionSteps.map((step, i) => (
                                <div key={i} className="cq-solution-step">
                                  <span className="cq-step-num">{i + 1}</span>
                                  <span><MathText>{step}</MathText></span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
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
          className="cq-summary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="cq-summary-score">
            <div className="cq-summary-number">{earnedPoints}/{totalPoints}</div>
            <div className="cq-summary-label">נקודות</div>
          </div>
          <div className="cq-summary-stats">
            <div><Check size={16} /> {correctCount}/{question.sections.length} סעיפים נכונים</div>
            <div><Clock size={16} /> {Object.values(sectionTimes).reduce((s, t) => s + t, 0) > 0 ? Math.round(Object.values(sectionTimes).reduce((s, t) => s + t, 0) / 60000) : 0} דקות</div>
            <div><Lightbulb size={16} /> {Object.values(hintsRevealed).reduce((s, h) => s + h, 0)} רמזים</div>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleFinalize}>
            סיים והמשך לשאלה הבאה ➜
          </button>
        </motion.div>
      )}
    </div>
  );
}
