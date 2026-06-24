import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Check, X, Send, Bot, Smartphone } from "lucide-react";
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
  onQrBridge?: () => void;
  overrideStem?: string;
}

export default function LegacyHomeworkRenderer({ question, assignedQuestionId, onComplete, aiChatTrigger, onQrBridge, overrideStem }: Props) {
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
    <div className="flex flex-col gap-6 font-sans">
      <motion.div
        className="bg-surface p-8 rounded-3xl border-2 border-outline relative overflow-hidden"
        style={{ boxShadow: 'var(--shadow-clay)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full border-2 ${i < question.difficulty ? "bg-primary border-primary-dark" : "bg-surface-container border-outline"}`} />
            ))}
          </div>
          <span className="font-bold text-on-surface-variant text-sm uppercase tracking-widest">רמה {question.difficulty}</span>
        </div>

        <div className="text-xl leading-relaxed text-on-surface font-medium" style={{ fontFamily: "'Assistant', sans-serif" }}>
          <MathText>{overrideStem ?? question.stem}</MathText>
        </div>
      </motion.div>

      <div className="flex flex-col gap-4">
        <motion.div
          className={`p-8 rounded-3xl border-2 ${isSubmitted ? (isCorrect ? "border-primary bg-primary/10" : "border-error bg-error/10") : "border-outline bg-surface"}`}
          style={{ boxShadow: 'var(--shadow-clay)' }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="grid gap-4 mb-8">
            {question.choices.map((choice, idx) => {
              let btnClass = "flex justify-start p-6 text-right h-auto w-full transition-all border-2 rounded-2xl cursor-pointer text-lg font-medium ";
              
              if (isSubmitted) {
                if (idx === question.correctIndex) {
                  btnClass += "border-primary bg-primary/15 text-primary";
                } else if (idx === selectedIndex) {
                  btnClass += "border-error bg-error/15 text-error";
                } else {
                  btnClass += "border-outline bg-surface opacity-50";
                }
              } else if (idx === selectedIndex) {
                btnClass += "border-primary bg-primary/10 text-primary";
              } else {
                btnClass += "border-outline bg-surface hover:border-primary text-on-surface hover:bg-primary/5 hover:-translate-y-0.5 active:translate-y-0";
              }

              return (
                <button
                  key={idx}
                  className={btnClass}
                  style={isSubmitted ? {} : { boxShadow: idx === selectedIndex ? '0 0 0 1px var(--color-primary)' : 'var(--shadow-sm)' }}
                  onClick={() => !isSubmitted && setSelectedIndex(idx)}
                  disabled={isSubmitted}
                >
                  <MathText>{choice}</MathText>
                </button>
              );
            })}
          </div>

          {!isSubmitted && (
            <div className="flex gap-4 flex-wrap">
              <button
                className={`flex-1 flex justify-center items-center gap-2 px-6 py-4 rounded-2xl font-bold text-lg border-2 transition-all ${
                  selectedIndex === null
                    ? 'bg-surface-container text-on-surface-variant border-outline cursor-not-allowed'
                    : 'bg-primary text-white border-primary-dark hover:-translate-y-1 active:translate-y-0.5 cursor-pointer'
                }`}
                style={selectedIndex !== null ? { boxShadow: 'var(--shadow-clay-primary)' } : {}}
                onClick={handleSubmit}
                disabled={selectedIndex === null}
              >
                <Send size={20} /> בדוק תשובה
              </button>
              {aiChatTrigger && (
                <button
                  className="flex justify-center items-center gap-2 px-6 py-4 rounded-2xl font-bold text-lg border-2 bg-surface text-secondary border-outline hover:border-secondary transition-all cursor-pointer hover:-translate-y-1 active:translate-y-0.5"
                  style={{ boxShadow: 'var(--shadow-clay)' }}
                  onClick={aiChatTrigger}
                >
                  <Bot size={20} /> מורה AI
                </button>
              )}
              {onQrBridge && (
                <button
                  className="flex justify-center items-center gap-2 px-6 py-4 rounded-2xl font-bold text-lg border-2 bg-surface text-primary border-outline hover:border-primary transition-all cursor-pointer hover:-translate-y-1 active:translate-y-0.5"
                  style={{ boxShadow: 'var(--shadow-clay)' }}
                  onClick={onQrBridge}
                >
                  <Smartphone size={20} /> צלם מהטלפון
                </button>
              )}
            </div>
          )}

          {isSubmitted && (
            <motion.div
              className={`p-6 mt-4 border-2 rounded-2xl flex items-center gap-4 font-bold text-lg ${isCorrect ? "border-primary text-primary bg-primary/15" : "border-error text-error bg-error/15"}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {isCorrect ? (
                <><Check size={28} strokeWidth={3} /> מצוין! תשובה נכונה.</>
              ) : (
                <><X size={28} strokeWidth={3} /> לא מדויק. התשובה הנכונה היא: {question.choices[question.correctIndex]}</>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>

      {isSubmitted && (
        <motion.div
          className="bg-secondary/10 p-8 border-2 border-secondary/30 rounded-3xl flex flex-col items-center justify-center text-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="font-black text-6xl text-secondary" style={{ fontFamily: "'Assistant', sans-serif" }}>{isCorrect ? "100" : "0"}</div>
            <div className="font-bold text-on-surface-variant uppercase tracking-widest text-sm">נקודות אנרגיה</div>
          </div>
          <button 
            className="px-8 py-4 bg-secondary text-white rounded-2xl font-bold text-lg border-2 border-secondary-dark hover:-translate-y-1 active:translate-y-0.5 transition-all cursor-pointer"
            style={{ boxShadow: 'var(--shadow-clay-secondary)' }}
            onClick={handleFinalize}
          >
            המשך לשאלה הבאה ➜
          </button>
        </motion.div>
      )}
    </div>
  );
}

