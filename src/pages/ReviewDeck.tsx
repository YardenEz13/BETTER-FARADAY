import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronLeft, Check, CheckCircle as CheckCircle2, XCircle, ArrowRight, Sparkles,
  Lightbulb as ElectricBulb, SparkBurst,
} from "../components/electric";
import { ThemeToggle } from "../components/ThemeContext";
import FaradayCanvas from "../components/FaradayCanvas";
import MathText from "../components/MathText";
import { fireStreak } from "../lib/celebrations";

type Card = {
  questionId: string;
  stem: string;
  choices: string[];
  correctIndex: number;
  hint?: string;
  explanation?: string;
  topicName?: string;
  missCount?: number;
  difficulty?: number;
};

function CheerfulEmpty({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-20 h-20 rounded-3xl bg-primary/12 border-2 border-primary/30 flex items-center justify-center mb-6"
        style={{ boxShadow: "var(--shadow-clay-primary)" }}>
        <Sparkles size={36} className="text-primary" />
      </div>
      <h2 className="font-bold text-2xl text-on-surface mb-2" style={{ fontFamily: "'Assistant', sans-serif" }}>
        אין טעויות לחזור עליהן! ✨
      </h2>
      <p className="text-on-surface-variant font-medium max-w-[26rem] mb-8 leading-relaxed">
        כל הכבוד — הדף נקי. תמשיכו לתרגל, וכל שאלה שתתקשו בה תופיע כאן לחזרה חכמה.
      </p>
      <button
        onClick={onBack}
        className="px-6 py-3 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
        style={{ boxShadow: "var(--shadow-clay-primary)" }}
      >
        חזרה למפת הלמידה
      </button>
    </div>
  );
}

export default function ReviewDeck() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const reducedMotion = !!useReducedMotion();
  const deck = useQuery(api.review.getReviewDeck, { studentId: studentId as Id<"students"> }) as Card[] | undefined;
  const recordResult = useMutation(api.review.recordReviewResult);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [burst, setBurst] = useState(false);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const shake = () => {
    const el = cardRef.current;
    if (!el || reducedMotion) return;
    el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" },
       { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
      { duration: 360, easing: "ease-in-out" },
    );
  };

  const cards = deck ?? [];
  const card = cards[index];
  const total = cards.length;

  const handlePick = async (idx: number) => {
    if (answered || !card) return;
    setSelected(idx);
    setAnswered(true);
    const isCorrect = idx === card.correctIndex;
    if (isCorrect) {
      setCorrectCount(c => c + 1);
      if (!reducedMotion) { setBurst(true); setTimeout(() => setBurst(false), 700); }
    } else {
      shake();
    }
    try {
      await recordResult({ studentId: studentId as Id<"students">, questionId: card.questionId as Id<"questions">, isCorrect });
    } catch { /* non-blocking — feedback already shown */ }
  };

  const handleNext = () => {
    if (index + 1 >= total) {
      setDone(true);
      fireStreak(Math.min(Math.max(correctCount, 1), 6)); // deck cleared — celebrate by how well it went
      return;
    }
    setIndex(i => i + 1);
    setSelected(null);
    setAnswered(false);
  };

  const isCorrect = answered && selected === card?.correctIndex;

  return (
    <div dir="rtl" className="relative min-h-screen bg-background text-on-background overflow-x-hidden">
      <FaradayCanvas variant="effect" style={{ position: "fixed", zIndex: 0 }} />

      {/* Top nav */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b-2 border-outline backdrop-blur-md"
        style={{ boxShadow: "var(--shadow-clay)", background: "color-mix(in srgb, var(--color-surface) 88%, transparent)" }}
      >
        <div className="flex items-center gap-4">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all border-2 border-outline hover:border-primary cursor-pointer"
            onClick={() => navigate(`/student/${studentId}`)}
            aria-label="חזרה"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div className="font-bold text-on-surface leading-tight" style={{ fontFamily: "'Assistant', sans-serif" }}>חזרה על טעויות</div>
            <div className="label-mono text-[0.6rem]">REVIEW</div>
          </div>
        </div>
        <ThemeToggle />
      </motion.header>

      <div className="page-shell relative z-10 pt-[100px] pb-24 max-w-[44rem] mx-auto">

        {/* loading */}
        {deck === undefined && (
          <div className="shimmer rounded-3xl" style={{ height: 360 }} />
        )}

        {/* empty state */}
        {deck && total === 0 && (
          <div className="rounded-3xl border-2 border-outline bg-surface" style={{ boxShadow: "var(--shadow-clay)" }}>
            <CheerfulEmpty onBack={() => navigate(`/student/${studentId}`)} />
          </div>
        )}

        {/* completed all cards */}
        {deck && total > 0 && done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-3xl border-2 border-primary/40 bg-primary/5 p-10 text-center overflow-hidden"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            {!reducedMotion && <SparkBurst />}
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-primary border-2 border-primary-dark flex items-center justify-center mx-auto mb-6"
                style={{ boxShadow: "var(--shadow-clay-primary)" }}>
                <Check size={40} strokeWidth={3} className="text-white" />
              </div>
              <h2 className="font-bold text-2xl text-on-surface mb-2" style={{ fontFamily: "'Assistant', sans-serif" }}>סיימת את החזרה! ⚡</h2>
              <p className="text-on-surface-variant font-medium mb-8">
                {correctCount} מתוך {total} נכונות. כל חזרה מחזקת את החומר.
              </p>
              <button
                onClick={() => navigate(`/student/${studentId}`)}
                className="px-6 py-3 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
                style={{ boxShadow: "var(--shadow-clay-primary)" }}
              >
                חזרה למפת הלמידה
              </button>
            </div>
          </motion.div>
        )}

        {/* active card */}
        {deck && total > 0 && !done && card && (
          <>
            {/* progress dots */}
            <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === index ? 22 : 9,
                    height: 9,
                    background: i < index ? "var(--color-primary)" : i === index ? "var(--color-primary)" : "var(--color-outline)",
                    opacity: i > index ? 0.6 : 1,
                  }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={card.questionId}
                ref={cardRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-3xl border-2 border-outline p-7 backdrop-blur-md"
                style={{ background: "color-mix(in srgb, var(--color-surface) 85%, transparent)", boxShadow: "var(--shadow-clay)" }}
              >
                {burst && !reducedMotion && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"><SparkBurst /></div>
                )}

                {/* meta */}
                <div className="flex items-center justify-between mb-5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-surface-container border-2 border-outline text-on-surface-variant">
                    {card.topicName ?? "חזרה"}
                  </span>
                  <span className="num text-xs font-bold text-on-surface-variant">{index + 1} / {total}</span>
                </div>

                {/* stem */}
                <div className="text-xl leading-relaxed font-semibold text-on-surface mb-7">
                  <MathText>{card.stem}</MathText>
                </div>

                {/* choices */}
                <div className="flex flex-col gap-3">
                  {card.choices.map((choice, idx) => {
                    const isThisCorrect = idx === card.correctIndex;
                    const isSelected = selected === idx;
                    const isWrong = answered && isSelected && !isThisCorrect;
                    const isRight = answered && isThisCorrect;
                    const isInactive = answered && !isRight && !isWrong;

                    let cls = "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-right transition-all duration-200 border-2 font-medium select-none";
                    let badge = "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm";
                    if (isRight) { cls += " bg-primary border-primary text-white"; badge += " bg-white/20 text-white"; }
                    else if (isWrong) { cls += " bg-error border-error text-white"; badge += " bg-white/20 text-white"; }
                    else if (isInactive) { cls += " bg-surface border-outline-variant text-on-surface-variant opacity-50"; badge += " bg-surface-container text-on-surface-variant"; }
                    else { cls += " bg-surface border-outline text-on-surface hover:border-primary hover:bg-primary/5 cursor-pointer"; badge += " bg-surface-container text-on-surface-variant"; }

                    return (
                      <motion.button
                        key={idx}
                        whileHover={!answered ? { scale: 1.01 } : {}}
                        whileTap={!answered ? { scale: 0.99 } : {}}
                        disabled={answered}
                        className={cls}
                        style={{ boxShadow: isRight || isWrong ? "none" : "var(--shadow-clay)", cursor: answered ? "default" : "pointer" }}
                        onClick={() => handlePick(idx)}
                      >
                        <div className={badge}>
                          {isRight && <CheckCircle2 size={16} className="text-white" />}
                          {isWrong && <XCircle size={16} className="text-white" />}
                          {!isRight && !isWrong && String.fromCharCode(65 + idx)}
                        </div>
                        <span className="flex-1"><MathText>{choice}</MathText></span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* feedback + explanation */}
                <AnimatePresence>
                  {answered && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`mt-6 rounded-2xl overflow-hidden border-2 ${isCorrect ? "border-primary/40 bg-primary/5" : "border-error/40 bg-error/5"}`}
                    >
                      <div className={`flex items-center justify-between px-5 py-3.5 border-b-2 ${isCorrect ? "bg-primary/10 border-primary/20" : "bg-error/10 border-error/20"}`}>
                        <span className={`flex items-center gap-2 font-bold ${isCorrect ? "text-primary" : "text-error"}`}>
                          {isCorrect ? <><CheckCircle2 size={20} /> יפה, נכון!</> : <><XCircle size={20} /> לא נורא — ננסה לזכור</>}
                        </span>
                        <button
                          onClick={handleNext}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary border-2 border-primary text-white font-semibold text-sm cursor-pointer"
                          style={{ boxShadow: "var(--shadow-clay-primary)" }}
                        >
                          {index + 1 >= total ? "סיום" : "הבא"} <ArrowRight size={14} />
                        </button>
                      </div>
                      <div className="p-5 flex flex-col gap-4">
                        {!isCorrect && (
                          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/8 border-2 border-primary/20">
                            <CheckCircle2 size={16} className="text-primary flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-semibold mb-1 text-primary">התשובה הנכונה:</div>
                              <div className="font-medium text-on-surface"><MathText>{card.choices[card.correctIndex]}</MathText></div>
                            </div>
                          </div>
                        )}
                        {card.explanation && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ElectricBulb size={17} tone="amber" glow={0.5} />
                              <span className="text-sm font-semibold text-on-surface-variant">הסבר:</span>
                            </div>
                            <p className="text-base leading-relaxed text-on-surface" style={{ lineHeight: 1.75 }}>
                              <MathText>{card.explanation}</MathText>
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
