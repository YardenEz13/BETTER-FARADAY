import { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Check, X, Send, Lock, Clock, Bot, ArrowRight, Smartphone, RefreshCw } from "../components/electric";
import { Lightbulb as ElectricBulb } from "../components/electric";
import { log } from "../lib/logger";
import { countOf, minuteCount } from "../lib/hebrew";
import MathText from "./MathText";
import ProofSectionRenderer from "./ProofSectionRenderer";
import MathAnswerInput from "./MathAnswerInput";
import { matchAnswer, AUTO_GRADED_TYPES } from "../../convex/answerMatch";

// Answer types that get the visual LaTeX editor. Everything else (free text)
// keeps the plain textarea; proofs use ProofSectionRenderer. Same set the
// grader auto-decides, so the editor appears exactly where it is checkable.
const MATH_ANSWER_TYPES = AUTO_GRADED_TYPES;

// The local `normalizeMath` + `... || answerLower.length > 5` checker is gone.
// It graded any answer over five characters as correct and rejected the LaTeX
// the MathField emits against the plain-Unicode stored answer. The verdict now
// comes from the server, which decides with convex/answerMatch — imported here
// only so the student gets an instant optimistic result from identical code.

interface ProofStep {
  stepIndex: number;
  expectedClaim: string;
  expectedReason: string;
  clueIfWrong?: string;
}

interface ProofMeta {
  given: string;
  toProve: string;
  diagramDescription?: string;
  diagramSvg?: string;
}

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
  proofMeta?: ProofMeta;
  proofSteps?: ProofStep[];
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

interface ExistingAnswer {
  sectionLabel: string;
  studentAnswer: string;
  isCorrect?: boolean;
  attempts?: number;
}

interface Props {
  question: CompoundQuestionData;
  assignedQuestionId: Id<"assignedQuestions">;
  onComplete: () => void;
  aiChatTrigger?: () => void;
  onQrBridge?: () => void;
  /** AI-generated preamble override (themed version). If undefined, original is shown. */
  overridePreamble?: string;
  /** Previously-saved section answers, so reopening a question restores progress. */
  existingAnswers?: ExistingAnswer[];
}

export default function CompoundQuestionRenderer({ question, assignedQuestionId, onComplete, aiChatTrigger, onQrBridge, overridePreamble, existingAnswers }: Props) {
  // Hydrate local state from any previously-saved answers so partial progress
  // isn't lost when a student leaves and reopens the question.
  const prior = existingAnswers ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => Object.fromEntries(prior.map((a) => [a.sectionLabel, a.studentAnswer])),
  );
  const [submitted, setSubmitted] = useState<Record<string, boolean>>(
    () => Object.fromEntries(prior.map((a) => [a.sectionLabel, true])),
  );
  const [results, setResults] = useState<Record<string, boolean>>(
    () => Object.fromEntries(prior.map((a) => [a.sectionLabel, !!a.isCorrect])),
  );
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(prior.map((a) => [a.sectionLabel, a.attempts ?? 1])),
  );
  const [hintsRevealed, setHintsRevealed] = useState<Record<string, number>>({});
  // Resume on the first not-yet-answered section (falls back to the first one).
  const [expandedSection, setExpandedSection] = useState<string>(
    () => question.sections.find((s) => !prior.some((a) => a.sectionLabel === s.label))?.label
      ?? question.sections[0]?.label ?? "א",
  );
  // What the checker made of each answer: any note it attached (a rounded
  // answer is accepted with one), and how it read the input back — so a
  // mis-parse is visible instead of an unexplained wrong mark.
  const [verdictNotes, setVerdictNotes] = useState<Record<string, string>>({});
  const [readAs, setReadAs] = useState<Record<string, string>>({});
  const [adjudicating, setAdjudicating] = useState<Record<string, boolean>>({});
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});
  const [sectionTimes, setSectionTimes] = useState<Record<string, number>>({});
  const [sectionStartTime, setSectionStartTime] = useState(Date.now());

  const submitAnswer = useMutation(api.homework.submitAnswer);
  const adjudicateAnswer = useAction(api.answerCheck.adjudicateAnswer);
  const finalizeSubmission = useMutation(api.homework.finalizeSubmission);
  const figureUrl = useQuery(api.compoundQuestions.getFigureUrl, { id: question._id });

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

    // Optimistic: the very checker the server is about to run, so the result
    // appears instantly and is then confirmed rather than replaced.
    const local = matchAnswer(section.correctAnswer, answer, section.answerType);

    const attempts = (attemptCounts[section.label] ?? 0) + 1;
    setAttemptCounts((prev) => ({ ...prev, [section.label]: attempts }));
    setSubmitted((prev) => ({ ...prev, [section.label]: true }));
    setResults((prev) => ({ ...prev, [section.label]: local.correct }));
    setReadAs((prev) => ({ ...prev, [section.label]: local.readAs }));
    setVerdictNotes((prev) => ({ ...prev, [section.label]: local.note ?? "" }));

    log.homework("section submitted", { section: section.label, isCorrect: local.correct, verdict: local.verdict, attempts, timeMs, hintsUsed: hintsRevealed[section.label] ?? 0 });

    const graded = await submitAnswer({
      assignedQuestionId,
      sectionLabel: section.label,
      studentAnswer: answer,
      timeMs,
      hintsUsed: hintsRevealed[section.label] ?? 0,
    });
    // The server reads the stored correctAnswer; the client only has a copy of
    // it, so the server's verdict wins.
    setResults((prev) => ({ ...prev, [section.label]: graded.isCorrect }));
    setReadAs((prev) => ({ ...prev, [section.label]: graded.readAs }));
    setVerdictNotes((prev) => ({ ...prev, [section.label]: graded.note ?? "" }));
    log.homework("section persisted to Convex", { section: section.label, verdict: graded.verdict });

    // The maths could not be parsed on one side or the other — worth one AI
    // opinion before telling a student they are wrong. Never fires on a
    // confidently wrong answer; that would spend the budget re-doing arithmetic.
    if (graded.canAdjudicate) {
      setAdjudicating((prev) => ({ ...prev, [section.label]: true }));
      try {
        const verdict = await adjudicateAnswer({
          assignedQuestionId,
          sectionLabel: section.label,
          studentAnswer: answer,
        });
        if (verdict.decided) {
          setResults((prev) => ({ ...prev, [section.label]: verdict.isCorrect }));
          setVerdictNotes((prev) => ({ ...prev, [section.label]: verdict.note ?? "" }));
        }
      } catch {
        // Gemini unreachable — the deterministic verdict already stands.
      } finally {
        setAdjudicating((prev) => ({ ...prev, [section.label]: false }));
      }
    }

    // We do NOT auto-expand the next section here anymore,
    // so the student has time to review the solution steps and feedback.
  };

  // Unlimited retries: reopen a wrong section for another attempt. The previous
  // answer stays in the field and the attempt counter is preserved; the next
  // submit bumps it (surfaced to the teacher as "attempts/correct").
  const handleRetrySection = (section: Section) => {
    setSubmitted((prev) => ({ ...prev, [section.label]: false }));
    setShowSolution((prev) => ({ ...prev, [section.label]: false }));
    setSectionStartTime(Date.now());
    setExpandedSection(section.label);
  };

  const handleFinalize = async () => {
    log.homework("finalizing homework submission", { assignedQuestionId, totalSections: question.sections.length });
    await finalizeSubmission({ assignedQuestionId, totalSections: question.sections.length });
    log.homework("homework finalized");
    onComplete();
  };

  const answeredCount = question.sections.filter((s) => submitted[s.label]).length;
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
        className="clay-card p-8 bg-surface border border-outline relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-sm ${i < question.difficulty ? "bg-primary/80" : "bg-on-surface/15"}`} />
              ))}
            </div>
            <span className="label-mono opacity-80">רמה {question.difficulty}</span>
          </div>

          <div className="flex gap-2">
            {question.tags.map((tag) => (
              <span key={tag} className="label-mono px-3 py-1 bg-surface-container-low border border-outline">{tag}</span>
            ))}
          </div>
        </div>

        {figureUrl && (
          <div className="flex justify-center mb-6 p-4 bg-white border border-outline rounded-xl">
            <img src={figureUrl} alt="שרטוט השאלה" className="max-w-full rounded" style={{ maxHeight: 420 }} />
          </div>
        )}

        <div className="text-xl leading-relaxed text-on-surface mb-6"><MathText animateLetters>{overridePreamble ?? question.preamble}</MathText></div>

        {question.preambleParams.length > 0 && (
          <div className="flex flex-wrap gap-3 p-4 bg-surface border border-outline">
            {question.preambleParams.map((p) => (
              <span key={p.symbol} className="label-mono text-primary/80">
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
              className={`shard transition-all border ${!unlocked ? "border-outline bg-surface opacity-60" : isSubmitted ? (isCorrect ? "border-primary bg-primary/10" : "border-error bg-error/10") : "border-primary/40 bg-surface"}`}
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
                  <div className={`w-8 h-8 flex items-center justify-center border font-display text-xl ${!unlocked ? "border-outline text-on-surface-variant/40" : isSubmitted ? (isCorrect ? "border-primary text-primary bg-primary/10" : "border-error text-error bg-error/10") : "border-primary/60 text-primary/80 bg-primary/10"}`}>
                    {!unlocked ? <Lock size={14} /> : isSubmitted ? (isCorrect ? <Check size={16} /> : <X size={16} />) : section.label}
                  </div>
                  <div>
                    <div className="font-bold text-on-surface tracking-wider">סעיף {section.label}׳</div>
                    <div className="label-mono opacity-60 text-[10px]">{countOf(section.points, "נקודת סנכרון אחת", "שתי נקודות סנכרון", "נקודות סנכרון")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex gap-2">
                    {section.skillsTested.slice(0, 2).map((skill) => (
                      <span key={skill} className="label-mono px-2 py-0.5 bg-surface-container-low border border-outline text-[10px]">{skill}</span>
                    ))}
                  </div>
                  {unlocked && (isExpanded ? <ChevronUp size={20} className="text-primary/80" /> : <ChevronDown size={20} className="opacity-50" />)}
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
                    className="px-6 pb-6 overflow-hidden border-t border-outline pt-6"
                  >
                    <div className="text-lg mb-6 leading-relaxed text-on-surface"><MathText animateLetters>{section.prompt}</MathText></div>

                    {section.dependsOn && section.dependsOn.length > 0 && (
                      <div className="label-mono text-tertiary mb-6 p-4 border border-tertiary/40 bg-tertiary/10 flex items-center gap-2">
                        <ElectricBulb size={18} tone="amber" glow={0.55} className="shrink-0" /> סעיף זה מתבסס על התוצאה מסעיף {section.dependsOn.join(", ")}׳
                      </div>
                    )}

                    {!isSubmitted && section.answerType === "proof" && section.proofSteps && section.proofMeta ? (
                      <ProofSectionRenderer
                        sectionLabel={section.label}
                        proofMeta={section.proofMeta}
                        proofSteps={section.proofSteps}
                        hints={section.hints}
                        assignedQuestionId={assignedQuestionId}
                        onSectionComplete={(isCorrect) => {
                          setSubmitted((prev) => ({ ...prev, [section.label]: true }));
                          setResults((prev) => ({ ...prev, [section.label]: isCorrect }));
                        }}
                        aiChatTrigger={aiChatTrigger}
                      />
                    ) : !isSubmitted ? (
                      <div className="flex flex-col gap-4">
                        {MATH_ANSWER_TYPES.has(section.answerType) ? (
                          <MathAnswerInput
                            value={answers[section.label] ?? ""}
                            onChange={(latex) => setAnswers((prev) => ({ ...prev, [section.label]: latex }))}
                            onEnter={() => handleSubmitSection(section)}
                          />
                        ) : (
                          <textarea
                            className="w-full bg-surface border-2 border-outline rounded-xl px-4 py-3 text-on-surface font-mono focus:border-primary focus:outline-none transition-colors"
                            placeholder="הפתרון כאן…"
                            value={answers[section.label] ?? ""}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [section.label]: e.target.value }))}
                            rows={3}
                            dir="rtl"
                          />
                        )}
                        {attemptCounts[section.label] > 0 && (
                          <div className="label-mono text-[10px] text-tertiary">
                            ניסיון {(attemptCounts[section.label] ?? 0) + 1}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 mt-2">
                          <button
                            className={`btn-clay-primary ${!answers[section.label]?.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handleSubmitSection(section)}
                            disabled={!answers[section.label]?.trim()}
                          >
                            <Send size={16} /> בדיקת תשובה
                          </button>

                          {section.hints.length > 0 && (
                            <button
                              className="btn-clay-ghost"
                              onClick={() => handleRevealHint(section.label, section.hints.length)}
                              disabled={hintCount >= section.hints.length}
                            >
                              <ElectricBulb size={18} tone="current" animated={false} glow={0.4} />
                              רמז ({hintCount}/{section.hints.length})
                            </button>
                          )}

                          {aiChatTrigger && (
                            <button className="btn-clay-ghost" onClick={aiChatTrigger}>
                              <Bot size={16} /> שאל את פאראדיי
                            </button>
                          )}

                          {onQrBridge && (
                            <button className="btn-clay-ghost" onClick={onQrBridge}>
                              <Smartphone size={16} /> צילום מהטלפון
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {hintCount > 0 && (
                      <div className="flex flex-col gap-3 mt-6">
                        {section.hints.slice(0, hintCount).map((hint, i) => (
                          <motion.div
                            key={i}
                            className="p-4 border border-tertiary/30 bg-tertiary/10 label-mono flex items-start gap-3 text-on-surface normal-case rounded-xl"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <ElectricBulb size={18} tone="amber" glow={0.55} className="shrink-0 mt-0.5" />
                            <span className="leading-relaxed"><MathText>{hint}</MathText></span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {isSubmitted && (
                      <motion.div
                        className={`p-6 mt-6 border flex flex-col gap-4 rounded-2xl ${isCorrect ? "border-primary bg-primary/10 text-primary" : "border-error bg-error/10 text-error"}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <div className="flex items-center gap-3 font-display text-2xl tracking-wider">
                          {isCorrect ? (
                            <><Check size={24} /> סנכרון נתונים מלא! התשובה נכונה 🎉</>
                          ) : (
                            <><X size={24} /> אנומליה זוהתה בנתונים — התשובה שגויה.</>
                          )}
                        </div>

                        {adjudicating[section.label] && (
                          <div className="label-mono text-xs opacity-70">בודקים שוב, רגע…</div>
                        )}

                        {/* What the checker understood. A wrong mark caused by a
                            mis-typed formula is otherwise indistinguishable from
                            a wrong answer. */}
                        {readAs[section.label] && (
                          <div dir="ltr" className="label-mono normal-case text-xs opacity-70 text-start">
                            נקרא כ: {readAs[section.label]}
                          </div>
                        )}

                        {verdictNotes[section.label] && (
                          <div className="text-body-sm opacity-90">{verdictNotes[section.label]}</div>
                        )}

                        {(attemptCounts[section.label] ?? 0) > 1 && (
                          <div className="label-mono text-xs opacity-70">
                            מספר ניסיונות: {attemptCounts[section.label]}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3 mt-2">
                          <button
                            className="btn-clay-ghost self-start"
                            onClick={() => setShowSolution((prev) => ({ ...prev, [section.label]: !prev[section.label] }))}
                          >
                            {showSolution[section.label] ? "הסתר פתרון" : "הצג פתרון"}
                          </button>

                          {!isCorrect && (
                            <button
                              className="btn-clay-ghost self-start"
                              onClick={() => handleRetrySection(section)}
                            >
                              <RefreshCw size={16} /> ניסיון חוזר
                            </button>
                          )}
                        </div>

                        <AnimatePresence>
                          {showSolution[section.label] && (
                            <motion.div
                              className="flex flex-col gap-3 mt-4"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                            >
                              {section.solutionSteps.map((step, i) => (
                                <div key={i} className="flex gap-4 items-start p-4 bg-surface border border-outline rounded-xl text-on-surface">
                                  <span className="w-6 h-6 flex items-center justify-center bg-primary text-white font-bold shrink-0 rounded-full text-sm">{i + 1}</span>
                                  <span className="leading-relaxed text-lg"><MathText>{step}</MathText></span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {idx < question.sections.length - 1 && (
                          <button
                            className="btn-clay-primary mt-4 self-end flex items-center gap-2"
                            onClick={() => {
                              const next = question.sections[idx + 1];
                              setExpandedSection(next.label);
                              setSectionStartTime(Date.now());
                            }}
                          >
                            לסעיף הבא <ArrowRight size={16} />
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

      {/* ── Partial submit ── */}
      {/* Let a student hand in an unfinished question without losing what they
          did. Score is computed over ALL sections, so blanks count as missed. */}
      {!allSubmitted && answeredCount > 0 && (
        <motion.div
          className="clay-card p-6 mt-4 border border-tertiary/50 bg-tertiary/10 flex flex-col sm:flex-row items-center justify-between gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="label-mono text-tertiary text-sm">
            ענית על {answeredCount} מתוך {question.sections.length} סעיפים. ההתקדמות נשמרת אוטומטית — אפשר לחזור ולהשלים אחר כך, או להגיש חלקית עכשיו (לאחר הגשה לא ניתן לשנות).
          </div>
          <button className="btn-clay-ghost shrink-0" onClick={handleFinalize}>
            שמירה והגשה חלקית
          </button>
        </motion.div>
      )}

      {/* ── Score Summary ── */}
      {allSubmitted && (
        <motion.div
          className="clay-card p-8 mt-8 border border-secondary bg-secondary/10 flex flex-col items-center text-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="font-display text-6xl text-secondary tracking-widest">{earnedPoints}/{totalPoints}</div>
            <div className="label-mono opacity-80">נקודות סנכרון</div>
          </div>
          
          <div className="flex flex-wrap gap-6 justify-center label-mono opacity-60">
            <div className="flex items-center gap-2"><Check size={16} className="text-primary" /> {correctCount}/{question.sections.length} סעיפים נכונים</div>
            <div className="flex items-center gap-2"><Clock size={16} className="text-secondary" /> {minuteCount(Object.values(sectionTimes).reduce((s, t) => s + t, 0) > 0 ? Math.round(Object.values(sectionTimes).reduce((s, t) => s + t, 0) / 60000) : 0)} סה"כ</div>
            <div className="flex items-center gap-2"><ElectricBulb size={18} tone="amber" glow={0.5} /> {Object.values(hintsRevealed).reduce((s, h) => s + h, 0)} רמזים שומשו</div>
          </div>
          
          <button className="btn-clay-primary mt-4" onClick={handleFinalize}>
            לשאלה הבאה
          </button>
        </motion.div>
      )}
    </div>
  );
}
