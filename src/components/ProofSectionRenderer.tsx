import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Lock, Send, Lightbulb, Bot, Loader2, AlertTriangle } from "lucide-react";
import MathText from "./MathText";

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

interface StepResult {
  claimCorrect: boolean;
  reasonCorrect: boolean;
  stepScore: number;
  feedback: string;
}

interface Props {
  sectionLabel: string;
  proofMeta: ProofMeta;
  proofSteps: ProofStep[];
  hints: string[];
  assignedQuestionId: Id<"assignedQuestions">;
  onSectionComplete: (isCorrect: boolean) => void;
  aiChatTrigger?: () => void;
}

type StepStatus = "locked" | "active" | "correct" | "partial" | "incorrect";

function getStepStatus(idx: number, currentStep: number, results: Record<number, StepResult>): StepStatus {
  if (idx > currentStep) return "locked";
  const r = results[idx];
  if (!r) return "active";
  if (r.stepScore === 1) return "correct";
  if (r.stepScore === 0.5) return "partial";
  return "incorrect";
}

export default function ProofSectionRenderer({
  sectionLabel,
  proofMeta,
  proofSteps,
  hints,
  assignedQuestionId,
  onSectionComplete,
  aiChatTrigger,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepInputs, setStepInputs] = useState<Record<number, { claim: string; reason: string }>>({});
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const gradeStep = useAction(api.proofGrading.gradeProofStep);
  const savedSteps = useQuery(api.proofGrading.getSavedSteps, { assignedQuestionId, sectionLabel });

  // Hydrate from previously saved progress so reload / navigation doesn't lose work.
  useEffect(() => {
    if (hydrated || savedSteps === undefined) return;
    if (savedSteps.length > 0) {
      const results: Record<number, StepResult> = {};
      const inputs: Record<number, { claim: string; reason: string }> = {};
      for (const s of savedSteps) {
        results[s.stepIndex] = {
          claimCorrect: !!s.claimCorrect,
          reasonCorrect: !!s.reasonCorrect,
          stepScore: s.stepScore,
          feedback: s.feedback ?? "",
        };
        inputs[s.stepIndex] = { claim: s.studentClaim, reason: s.studentReason };
      }
      setStepResults(results);
      setStepInputs(inputs);
      // current step = first index that isn't passed yet
      let cur = 0;
      while (cur < proofSteps.length && results[cur] && results[cur].stepScore >= 0.5) cur++;
      setCurrentStep(cur);
      if (cur >= proofSteps.length) {
        setCompleted(true);
        // Tell parent so it marks the section submitted (lets the student finalize).
        const allCorrect = proofSteps.every((s) => results[s.stepIndex]?.stepScore >= 0.5);
        onSectionComplete(allCorrect);
      }
    }
    setHydrated(true);
    // onSectionComplete intentionally omitted from deps (stable callback, run-once hydration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSteps, hydrated, proofSteps.length]);

  const handleSubmitStep = async (stepIdx: number) => {
    const input = stepInputs[stepIdx];
    if (!input?.claim?.trim() || !input?.reason?.trim()) return;

    setIsGrading(true);
    setGradeError(null);
    try {
      const result = await gradeStep({
        assignedQuestionId,
        sectionLabel,
        stepIndex: stepIdx,
        studentClaim: input.claim.trim(),
        studentReason: input.reason.trim(),
      });

      setStepResults((prev) => ({ ...prev, [stepIdx]: result }));

      if (result.stepScore >= 0.5) {
        const nextStep = stepIdx + 1;
        if (nextStep >= proofSteps.length) {
          // All steps done
          const allCorrect = Object.values({ ...stepResults, [stepIdx]: result }).every(
            (r) => r.stepScore >= 0.5
          );
          setCompleted(true);
          onSectionComplete(allCorrect);
        } else {
          setCurrentStep(nextStep);
        }
      }
      // If stepScore === 0: stay on current step, show feedback
    } catch {
      // Gemini overloaded / network — step NOT saved, let student retry.
      setGradeError("הבדיקה נכשלה זמנית (העומס על השרת גבוה). נסה לשלוח את הצעד שוב.");
    } finally {
      setIsGrading(false);
    }
  };

  const setInput = (stepIdx: number, field: "claim" | "reason", value: string) => {
    setStepInputs((prev) => ({
      ...prev,
      [stepIdx]: { ...prev[stepIdx], [field]: value },
    }));
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* ── Diagram ── */}
      {proofMeta.diagramSvg && (
        <div className="flex justify-center p-4 bg-surface-container-low border border-outline/50 rounded-xl">
          <div
            className="w-full"
            style={{ maxWidth: 340 }}
            dangerouslySetInnerHTML={{ __html: proofMeta.diagramSvg }}
          />
        </div>
      )}

      {/* ── Given / To Prove header ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-surface-container-low border border-outline rounded-xl">
          <div className="label-mono text-primary mb-2 text-xs">נתון</div>
          <div className="text-on-surface leading-relaxed">
            <MathText>{proofMeta.given}</MathText>
          </div>
        </div>
        <div className="p-4 bg-primary/5 border border-primary/30 rounded-xl">
          <div className="label-mono text-primary mb-2 text-xs">להוכיח</div>
          <div className="text-on-surface font-semibold leading-relaxed">
            <MathText>{proofMeta.toProve}</MathText>
          </div>
        </div>
      </div>

      {/* ── Step progress dots ── */}
      <div className="flex items-center gap-3 justify-center">
        {proofSteps.map((_, idx) => {
          const status = getStepStatus(idx, currentStep, stepResults);
          return (
            <div key={idx} className="flex items-center gap-3">
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  status === "correct"
                    ? "border-primary bg-primary text-white"
                    : status === "partial"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-400"
                    : status === "incorrect"
                    ? "border-error bg-error/20 text-error"
                    : status === "active"
                    ? "border-primary/80 bg-primary/10 text-primary"
                    : "border-outline bg-surface text-on-surface/30"
                }`}
                animate={status === "active" ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {status === "correct" ? (
                  <Check size={14} />
                ) : status === "incorrect" ? (
                  <X size={14} />
                ) : status === "locked" ? (
                  <Lock size={12} />
                ) : (
                  idx + 1
                )}
              </motion.div>
              {idx < proofSteps.length - 1 && (
                <div className={`h-0.5 w-8 ${idx < currentStep ? "bg-primary" : "bg-outline"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Proof steps table ── */}
      <div className="flex flex-col gap-3">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_3fr_auto] gap-3 px-4 label-mono text-xs text-on-surface/50">
          <div>הצדקה / משפט</div>
          <div>טענה</div>
          <div className="w-8" />
        </div>

        {proofSteps.map((step) => {
          const status = getStepStatus(step.stepIndex, currentStep, stepResults);
          const result = stepResults[step.stepIndex];
          const input = stepInputs[step.stepIndex] ?? { claim: "", reason: "" };

          if (status === "locked") {
            return (
              <div
                key={step.stepIndex}
                className="grid grid-cols-[2fr_3fr_auto] gap-3 p-4 border border-outline rounded-xl opacity-40"
              >
                <div className="flex items-center gap-2 text-on-surface/40 text-sm">
                  <Lock size={12} /> ממתין...
                </div>
                <div className="text-on-surface/40 text-sm">ממתין...</div>
                <div className="w-8" />
              </div>
            );
          }

          if (status === "correct" || status === "partial") {
            return (
              <motion.div
                key={step.stepIndex}
                className={`grid grid-cols-[2fr_3fr_auto] gap-3 p-4 border rounded-xl ${
                  status === "correct"
                    ? "border-primary/40 bg-primary/5"
                    : "border-yellow-400/40 bg-yellow-400/5"
                }`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-on-surface text-sm leading-relaxed">
                  <MathText>{input.reason || "—"}</MathText>
                </div>
                <div className="text-on-surface text-sm leading-relaxed">
                  <MathText>{input.claim || "—"}</MathText>
                </div>
                <div className="flex items-center">
                  {status === "correct" ? (
                    <Check size={16} className="text-primary" />
                  ) : (
                    <span className="text-yellow-400 text-xs">½</span>
                  )}
                </div>
              </motion.div>
            );
          }

          // Active or incorrect (retry)
          return (
            <motion.div
              key={step.stepIndex}
              className={`flex flex-col gap-4 p-4 border rounded-xl ${
                status === "incorrect"
                  ? "border-error/50 bg-error/5"
                  : "border-primary/50 bg-primary/5"
              }`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="label-mono text-[10px] text-on-surface/50">טענה (מה אנחנו יודעים)</label>
                  <textarea
                    className="bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface text-sm focus:border-primary focus:outline-none transition-colors resize-none"
                    placeholder="לדוגמה: AO = OC"
                    rows={2}
                    dir="rtl"
                    value={input.claim}
                    onChange={(e) => setInput(step.stepIndex, "claim", e.target.value)}
                    disabled={isGrading}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label-mono text-[10px] text-on-surface/50">הצדקה (שם המשפט)</label>
                  <textarea
                    className="bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface text-sm focus:border-primary focus:outline-none transition-colors resize-none"
                    placeholder="לדוגמה: זוויות קודקוד שוות"
                    rows={2}
                    dir="rtl"
                    value={input.reason}
                    onChange={(e) => setInput(step.stepIndex, "reason", e.target.value)}
                    disabled={isGrading}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <button
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                  onClick={() => handleSubmitStep(step.stepIndex)}
                  disabled={isGrading || !input.claim?.trim() || !input.reason?.trim()}
                >
                  {isGrading ? (
                    <><Loader2 size={14} className="animate-spin" /> בודק...</>
                  ) : (
                    <><Send size={14} /> שלח צעד</>
                  )}
                </button>

                {hints.length > 0 && (
                  <button
                    className="btn btn-primary btn-ghost flex items-center gap-2"
                    onClick={() => setHintsRevealed((h) => Math.min(h + 1, hints.length))}
                    disabled={hintsRevealed >= hints.length}
                  >
                    <Lightbulb size={14} /> רמז ({hintsRevealed}/{hints.length})
                  </button>
                )}

                {aiChatTrigger && (
                  <button
                    className="btn btn-primary btn-ghost flex items-center gap-2"
                    onClick={aiChatTrigger}
                  >
                    <Bot size={14} /> שאל את פאראדיי
                  </button>
                )}
              </div>

              {/* Transient grading error (e.g. Gemini 503) */}
              {gradeError && (
                <div className="p-3 rounded-lg border border-error/40 bg-error/10 text-error text-sm label-mono normal-case flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{gradeError}</span>
                </div>
              )}

              {/* Gemini step feedback */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    className={`p-3 rounded-lg border text-sm label-mono normal-case ${
                      result.stepScore === 0
                        ? "border-error/40 bg-error/10 text-error"
                        : "border-yellow-400/40 bg-yellow-400/10 text-yellow-400"
                    }`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {result.claimCorrect && !result.reasonCorrect && (
                      <div className="text-primary mb-1">✓ הטענה נכונה — בדוק את ההצדקה</div>
                    )}
                    {!result.claimCorrect && result.reasonCorrect && (
                      <div className="text-yellow-400 mb-1">✓ ההצדקה נכונה — בדוק את הטענה</div>
                    )}
                    <div>{result.feedback}</div>
                    {step.clueIfWrong && result.stepScore === 0 && (
                      <div className="mt-2 opacity-70">💡 {step.clueIfWrong}</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── Hints ── */}
      <AnimatePresence>
        {hintsRevealed > 0 && (
          <motion.div
            className="flex flex-col gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {hints.slice(0, hintsRevealed).map((hint, i) => (
              <motion.div
                key={i}
                className="p-4 border border-tertiary/30 bg-tertiary/10 label-mono flex items-start gap-3 text-on-surface normal-case rounded-xl"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Lightbulb size={16} className="text-tertiary shrink-0 mt-0.5" />
                <span className="leading-relaxed"><MathText>{hint}</MathText></span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Completion banner ── */}
      <AnimatePresence>
        {completed && (
          <motion.div
            className="p-6 border border-primary bg-primary/10 rounded-2xl flex items-center gap-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Check size={28} className="text-primary shrink-0" />
            <div>
              <div className="font-display text-primary text-xl tracking-wider">ההוכחה הושלמה!</div>
              <div className="label-mono opacity-70 text-sm mt-1">
                {Object.values(stepResults).filter((r) => r.stepScore === 1).length}/{proofSteps.length} צעדים מלאים
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
