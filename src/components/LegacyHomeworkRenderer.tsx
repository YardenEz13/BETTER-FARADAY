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
    <div className="flex flex-col gap-6">
      <motion.div
        className="shard p-8 bg-[rgba(0,0,0,0.4)] border border-[#1a3324] relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-none ${i < question.difficulty ? "bg-[var(--acid-green)] shadow-[var(--glow-acid)]" : "bg-white opacity-20"}`} />
            ))}
          </div>
          <span className="t-mono-label opacity-80">רמה {question.difficulty} (שאלה רגילה)</span>
        </div>

        <div className="text-xl leading-relaxed text-white"><MathText>{question.stem}</MathText></div>
      </motion.div>

      <div className="flex flex-col gap-4">
        <motion.div
          className={`shard p-8 border ${isSubmitted ? (isCorrect ? "border-[var(--neon-emerald)] bg-[rgba(0,255,136,0.05)]" : "border-[#ff4b4b] bg-[rgba(255,75,75,0.05)]") : "border-[#1a3324] bg-[rgba(0,0,0,0.6)]"}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="grid gap-4 mb-8">
            {question.choices.map((choice, idx) => {
              let btnClass = "shard flex justify-start p-6 text-right h-auto w-full transition-all border cursor-pointer font-mono text-lg ";
              if (isSubmitted) {
                if (idx === question.correctIndex) btnClass += "border-[var(--neon-emerald)] bg-[rgba(0,255,136,0.1)] text-[var(--neon-emerald)] shadow-[var(--glow-emerald)]";
                else if (idx === selectedIndex) btnClass += "border-[#ff4b4b] bg-[rgba(255,75,75,0.1)] text-[#ff4b4b]";
                else btnClass += "border-[#1a3324] bg-[rgba(0,0,0,0.4)] opacity-50";
              } else if (idx === selectedIndex) {
                btnClass += "border-[var(--acid-green)] bg-[rgba(180,255,0,0.1)] text-[var(--acid-green)] shadow-[var(--glow-acid)]";
              } else {
                btnClass += "border-[#1a3324] bg-[rgba(0,0,0,0.4)] hover:border-[var(--acid-green)] text-white";
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
                className={`cyber-btn ${selectedIndex === null ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleSubmit}
                disabled={selectedIndex === null}
              >
                <Send size={16} /> [ SUBMIT_ANSWER ]
              </button>
              {aiChatTrigger && (
                <button className="cyber-btn cyber-btn-ghost" onClick={aiChatTrigger}>
                  <Bot size={16} /> [ AI_ASSIST ]
                </button>
              )}
            </div>
          )}

          {isSubmitted && (
            <motion.div
              className={`p-6 mt-4 border flex items-center gap-4 fw-700 text-lg ${isCorrect ? "border-[var(--neon-emerald)] text-[var(--neon-emerald)] bg-[rgba(0,255,136,0.05)]" : "border-[#ff4b4b] text-[#ff4b4b] bg-[rgba(255,75,75,0.05)]"}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {isCorrect ? (
                <><Check size={24} /> כל הכבוד! הפתרון תואם למאגר.</>
              ) : (
                <><X size={24} /> שגיאה בזיהוי. התשובה הנכונה היא: {question.choices[question.correctIndex]}</>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>

      {isSubmitted && (
        <motion.div
          className="shard p-8 border border-[var(--laser-cyan)] bg-[rgba(0,240,255,0.05)] flex flex-col items-center justify-center text-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="font-title text-6xl text-[var(--laser-cyan)] shadow-[var(--glow-cyan)] tracking-widest">{isCorrect ? "100" : "0"}</div>
            <div className="t-mono-label opacity-80">נקודות סנכרון</div>
          </div>
          <button className="cyber-btn" onClick={handleFinalize}>
            [ CONTINUE_TO_NEXT ] ➜
          </button>
        </motion.div>
      )}
    </div>
  );
}
