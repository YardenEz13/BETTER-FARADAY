import { useState, useEffect, useMemo } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Send, Bot, Loader as Loader2, AlertTriangle } from "../components/electric";
import { Lightbulb as ElectricBulb } from "../components/electric";
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

export default function ProofSectionRenderer({
  sectionLabel,
  proofMeta,
  proofSteps,
  hints,
  assignedQuestionId,
  onSectionComplete,
  aiChatTrigger,
}: Props) {
  const [stepInputs, setStepInputs] = useState<Record<number, { claim: string; reason: string }>>({});
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // The whole proof is graded in ONE Gemini call, only when the student submits
  // it — not one call per step. A 3-step proof used to cost 3+ calls (one per
  // step, plus retries); now it costs exactly one call per submit attempt.
  const gradeSection = useAction(api.proofGrading.gradeProofSection);
  const savedSteps = useQuery(api.proofGrading.getSavedSteps, { assignedQuestionId, sectionLabel });

  // Progress is keyed by POSITION in this stepIndex-sorted array, never by the
  // raw stepIndex field — a packet-imported proof once numbered its steps
  // 1,2,3 instead of the requested 0-based 0,1,2 (model non-compliance), and
  // trusting the raw value directly made every step permanently unreachable.
  const orderedSteps = useMemo(
    () => [...proofSteps].sort((a, b) => a.stepIndex - b.stepIndex),
    [proofSteps],
  );

  // Hydrate from previously saved progress so reload / navigation doesn't lose work.
  useEffect(() => {
    if (hydrated || savedSteps === undefined) return;
    if (savedSteps.length > 0) {
      const results: Record<number, StepResult> = {};
      const inputs: Record<number, { claim: string; reason: string }> = {};
      for (const s of savedSteps) {
        const pos = orderedSteps.findIndex((st) => st.stepIndex === s.stepIndex);
        if (pos === -1) continue;
        results[pos] = {
          claimCorrect: !!s.claimCorrect,
          reasonCorrect: !!s.reasonCorrect,
          stepScore: s.stepScore,
          feedback: s.feedback ?? "",
        };
        inputs[pos] = { claim: s.studentClaim, reason: s.studentReason };
      }
      setStepResults(results);
      setStepInputs(inputs);
      const allGraded = orderedSteps.length > 0 && orderedSteps.every((_, pos) => results[pos]);
      if (allGraded) {
        const allCorrect = orderedSteps.every((_, pos) => results[pos].stepScore >= 0.5);
        setCompleted(allCorrect);
        if (allCorrect) onSectionComplete(true);
      }
    }
    setHydrated(true);
    // onSectionComplete intentionally omitted from deps (stable callback, run-once hydration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSteps, hydrated, orderedSteps]);

  const setInput = (pos: number, field: "claim" | "reason", value: string) => {
    setStepInputs((prev) => ({
      ...prev,
      [pos]: { ...prev[pos], [field]: value },
    }));
  };

  const allFilled = orderedSteps.every((_, pos) => {
    const input = stepInputs[pos];
    return input?.claim?.trim() && input?.reason?.trim();
  });

  const handleCheckProof = async () => {
    if (!allFilled) return;
    setIsGrading(true);
    setGradeError(null);
    try {
      const results = await gradeSection({
        assignedQuestionId,
        sectionLabel,
        steps: orderedSteps.map((step, pos) => ({
          stepIndex: step.stepIndex,
          studentClaim: stepInputs[pos].claim.trim(),
          studentReason: stepInputs[pos].reason.trim(),
        })),
      });

      const nextResults: Record<number, StepResult> = {};
      results.forEach((r, pos) => {
        nextResults[pos] = {
          claimCorrect: r.claimCorrect,
          reasonCorrect: r.reasonCorrect,
          stepScore: r.stepScore,
          feedback: r.feedback,
        };
      });
      setStepResults(nextResults);

      const allCorrect = results.every((r) => r.stepScore >= 0.5);
      if (allCorrect) {
        setCompleted(true);
        onSectionComplete(true);
      }
    } catch {
      // Gemini overloaded / network — nothing saved, let the student retry.
      setGradeError("הבדיקה נכשלה זמנית (העומס על השרת גבוה). נסה לבדוק את ההוכחה שוב.");
    } finally {
      setIsGrading(false);
    }
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

      {/* ── Proof steps — all open for editing at once; graded together on submit ── */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[2fr_3fr] gap-3 px-4 label-mono text-xs text-on-surface/50">
          <div>הצדקה / משפט</div>
          <div>טענה</div>
        </div>

        {orderedSteps.map((step, pos) => {
          const result = stepResults[pos];
          const input = stepInputs[pos] ?? { claim: "", reason: "" };
          const rowTone =
            result?.stepScore === 1
              ? "border-primary/50 bg-primary/5"
              : result?.stepScore === 0.5
                ? "border-yellow-400/50 bg-yellow-400/5"
                : result?.stepScore === 0
                  ? "border-error/50 bg-error/5"
                  : "border-outline";

          return (
            <motion.div
              key={step.stepIndex}
              className={`flex flex-col gap-4 p-4 border rounded-xl ${rowTone}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pos * 0.05 }}
            >
              <div className="flex items-center gap-2 label-mono text-xs text-on-surface/50">
                <span className="w-6 h-6 rounded-full border border-outline flex items-center justify-center text-on-surface/70">
                  {pos + 1}
                </span>
                {result?.stepScore === 1 && <Check size={14} className="text-primary" />}
                {result?.stepScore === 0.5 && <span className="text-yellow-400 text-xs">½</span>}
                {result?.stepScore === 0 && <X size={14} className="text-error" />}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="label-mono text-[10px] text-on-surface/50">טענה (מה אנחנו יודעים)</label>
                  <textarea
                    className="bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface text-sm focus:border-primary focus:outline-none transition-colors resize-none"
                    placeholder="לדוגמה: AO = OC"
                    rows={2}
                    dir="rtl"
                    value={input.claim}
                    onChange={(e) => setInput(pos, "claim", e.target.value)}
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
                    onChange={(e) => setInput(pos, "reason", e.target.value)}
                    disabled={isGrading}
                  />
                </div>
              </div>

              {/* Gemini feedback for this step (after a check) */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    className={`p-3 rounded-lg border text-sm label-mono normal-case ${
                      result.stepScore === 1
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : result.stepScore === 0.5
                          ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-400"
                          : "border-error/40 bg-error/10 text-error"
                    }`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {result.claimCorrect && !result.reasonCorrect && (
                      <div className="mb-1">✓ הטענה נכונה — בדוק את ההצדקה</div>
                    )}
                    {!result.claimCorrect && result.reasonCorrect && (
                      <div className="mb-1">✓ ההצדקה נכונה — בדוק את הטענה</div>
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

      {/* ── Hints (apply to the whole proof) ── */}
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
                <ElectricBulb size={18} tone="amber" glow={0.55} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed"><MathText>{hint}</MathText></span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Actions ── */}
      {!completed && (
        <div className="flex flex-wrap gap-3 items-center">
          <button
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            onClick={handleCheckProof}
            disabled={isGrading || !allFilled}
          >
            {isGrading ? (
              <><Loader2 size={14} className="animate-spin" /> בודק את ההוכחה...</>
            ) : (
              <><Send size={14} /> בדוק את ההוכחה</>
            )}
          </button>

          {hints.length > 0 && (
            <button
              className="btn btn-primary btn-ghost flex items-center gap-2"
              onClick={() => setHintsRevealed((h) => Math.min(h + 1, hints.length))}
              disabled={hintsRevealed >= hints.length}
            >
              <ElectricBulb size={16} tone="current" animated={false} glow={0.4} /> רמז ({hintsRevealed}/{hints.length})
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
      )}

      {/* Transient grading error (e.g. Gemini 503) */}
      {gradeError && (
        <div className="p-3 rounded-lg border border-error/40 bg-error/10 text-error text-sm label-mono normal-case flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{gradeError}</span>
        </div>
      )}

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
