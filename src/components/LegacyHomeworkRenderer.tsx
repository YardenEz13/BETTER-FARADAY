import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Check, X, Send, Bot } from "lucide-react";
import MathText from "./MathText";

interface LegacyQuestionData {
  _id: Id<"questions">;
  stem: string;
  choices: string[];
  correctIndex: number;
  difficulty: number;
  topicId: Id<"topics">;
}

interface Props {
  question: LegacyQuestionData;
  assignedQuestionId: Id<"assignedQuestions">;
  onComplete: () => void;
  aiChatTrigger?: () => void;
}

export default function LegacyHomeworkRenderer({ question, assignedQuestionId, onComplete, aiChatTrigger }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [startTime] = useState(Date.now());

  const submitAnswer = useMutation(api.homework.submitAnswer);
  const finalizeSubmission = useMutation(api.homework.finalizeSubmission);

  const handleSubmit = async () => {
    if (selectedIndex === null) return;

    const timeMs = Date.now() - startTime;
    const correct = selectedIndex === question.correctIndex;
    
    setIsCorrect(correct);
    setIsSubmitted(true);

    await submitAnswer({
      assignedQuestionId,
      sectionLabel: "שאלה יחידה",
      studentAnswer: question.choices[selectedIndex],
      isCorrect: correct,
      timeMs,
      hintsUsed: 0,
    });
  };

  const handleFinalize = async () => {
    await finalizeSubmission({ assignedQuestionId });
    onComplete();
  };

  return (
    <div className="compound-question">
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
          <span>רמה {question.difficulty} (שאלה רגילה)</span>
        </div>

        <div className="cq-preamble-text"><MathText>{question.stem}</MathText></div>
      </motion.div>

      <div className="cq-sections">
        <motion.div
          className={`cq-section ${isSubmitted ? (isCorrect ? "correct" : "incorrect") : ""}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="cq-section-body pt-5">
            <div className="grid gap-3 mb-6">
              {question.choices.map((choice, idx) => {
                let btnClass = "btn btn-outline flex justify-start p-4 text-right";
                if (isSubmitted) {
                  if (idx === question.correctIndex) btnClass += " bg-success text-white border-success";
                  else if (idx === selectedIndex) btnClass += " bg-danger text-white border-danger";
                  else btnClass += " opacity-50";
                } else if (idx === selectedIndex) {
                  btnClass += " bg-primary-alpha border-primary";
                }

                return (
                  <button
                    key={idx}
                    className={btnClass}
                    onClick={() => !isSubmitted && setSelectedIndex(idx)}
                    disabled={isSubmitted}
                  >
                    <MathText>{choice}</MathText>
                  </button>
                );
              })}
            </div>

            {!isSubmitted && (
              <div className="flex gap-4">
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={selectedIndex === null}
                >
                  <Send size={16} /> שלח תשובה
                </button>
                {aiChatTrigger && (
                  <button className="btn btn-ghost" onClick={aiChatTrigger}>
                    <Bot size={16} /> עזרה מהמורה
                  </button>
                )}
              </div>
            )}

            {isSubmitted && (
              <motion.div
                className={`cq-result ${isCorrect ? "correct" : "incorrect"}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="cq-result-header">
                  {isCorrect ? (
                    <><Check size={20} /> כל הכבוד! תשובה נכונה 🎉</>
                  ) : (
                    <><X size={20} /> התשובה הנכונה היא: {question.choices[question.correctIndex]}</>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {isSubmitted && (
        <motion.div
          className="cq-summary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="cq-summary-score">
            <div className="cq-summary-number">{isCorrect ? "100" : "0"}</div>
            <div className="cq-summary-label">נקודות</div>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleFinalize}>
            סיים והמשך לשאלה הבאה ➜
          </button>
        </motion.div>
      )}
    </div>
  );
}
