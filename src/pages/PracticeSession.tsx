import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronLeft, Zap, Bot, Activity,
  CheckCircle as CheckCircle2, XCircle, ArrowRight, Clock, Star
} from "../components/electric";
import { useFaraday } from "../components/chat/FaradayProvider";
import FaradayAvatar from "../components/FaradayAvatar";
import FaradayReaction, { type FaradayReactionKind } from "../components/FaradayReaction";
import SessionRecap from "../components/SessionRecap";
import FaradayCanvas from "../components/FaradayCanvas";
import { ThemeToggle } from "../components/ThemeContext";
import MathText from "../components/MathText";
import { Lightbulb as ElectricBulb, Battery, SparkBurst } from "../components/electric";
import { ElectricLoader } from "../components/electric/ElectricLoader";
import { log } from "../lib/logger";
import { gsap, prefersReducedMotion } from "../lib/gsapUtils";
import { fireConfetti, fireStreak } from "../lib/celebrations";
import { spark as playSpark, buzz as playBuzz } from "../lib/sfx";

const CHARGE_MAX = 5; // correct answers in a row for a "fully charged" streak

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
    questionKey,
  });

  const [activeQuestion, setActiveQuestion] = useState<Doc<"questions"> | null>(null);

  useEffect(() => {
    if (question && !activeQuestion) setActiveQuestion(question);
  }, [question, activeQuestion]);

  useEffect(() => { setActiveQuestion(null); }, [topicId]);

  const submitAttempt = useMutation(api.attempts.submitAttempt);
  const endSession    = useMutation(api.goals.endSession);
  const generateHint  = useMutation(api.ai.generateHint);

  const [sessionId, setSessionId]     = useState<Id<"sessions"> | null>(null);
  const [recapId, setRecapId]         = useState<Id<"sessions"> | null>(null);
  const [showRecap, setShowRecap]     = useState(false);

  const [selected, setSelected]             = useState<number | null>(null);
  const [submitted, setSubmitted]           = useState(false);
  const [reviewPhase, setReviewPhase]       = useState(false);
  const [countdown, setCountdown]           = useState(0);
  const [showHint, setShowHint]             = useState(false);
  const [hint, setHint]                     = useState<string | null>(null);
  const [loadingHint, setLoadingHint]       = useState(false);
  const [hintsUsed, setHintsUsed]           = useState(0);
  const [elapsed, setElapsed]               = useState(0);
  const [sessionXP, setSessionXP]           = useState(0);
  const [earnedXP, setEarnedXP]             = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const startTimeRef = useRef(Date.now());
  const transitionLockRef = useRef(false); // prevents click-through to next question
  const faraday = useFaraday();
  const chatOpen = faraday.isOpen;
  const [combo, setCombo]                   = useState(0); // session charge / correct streak
  // Proactive Faraday — consecutive misses trigger a help nudge (once per session)
  const [, setWrongStreak]                  = useState(0);
  const [showNudge, setShowNudge]           = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  // Faraday personality pop-in reacting to the last answer
  const [reaction, setReaction] = useState<{ kind: FaradayReactionKind; count?: number } | null>(null);
  const reducedMotion = !!useReducedMotion();

  const openChat = () => faraday.open({
    studentId: studentId!,
    agentType: "practice",
    questionStem: activeQuestion?.stem,
    topicName: currentTopic?.nameHe,
    topicId,
    questionId: activeQuestion?._id,
  });
  // Keep Faraday's context on the current question while the panel is open.
  const { updateContext } = faraday;
  useEffect(() => {
    updateContext({ questionStem: activeQuestion?.stem, questionId: activeQuestion?._id });
  }, [activeQuestion?._id, activeQuestion?.stem, updateContext]);
  const questionCardRef = useRef<HTMLDivElement>(null);
  const xpChipRef = useRef<HTMLDivElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);

  /* Choices pop in one after another, right behind the stem letters
     (the stem itself letter-jumps via MathText's animateLetters). */
  useLayoutEffect(() => {
    const el = choicesRef.current;
    if (!el || !activeQuestion || reducedMotion) return;
    const items = el.children;
    if (items.length === 0) return;
    const tween = gsap.fromTo(
      items,
      { autoAlpha: 0, y: 26, scale: 0.94 },
      {
        autoAlpha: 1, y: 0, scale: 1,
        duration: 0.5, delay: 0.35, stagger: 0.09, ease: "back.out(1.9)",
        // hand transforms back to Framer Motion's hover/tap scaling
        onComplete: () => gsap.set(items, { clearProps: "transform,opacity,visibility" }),
      },
    );
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion?._id]);

  /* Brief green/red glow on the question card after an answer. */
  const flashCard = (kind: "correct" | "wrong") => {
    const card = questionCardRef.current;
    if (!card || reducedMotion) return;
    const cls = kind === "correct" ? "answer-glow-correct" : "answer-glow-wrong";
    card.classList.add(cls);
    setTimeout(() => card.classList.remove(cls), 900);
  };

  /* Gentle clay wiggle on a wrong answer — x ±6px over ~0.35s, no harsh flood.
     The error shadow flash is handled separately by flashCard("wrong"). */
  const shakeCard = () => {
    const card = questionCardRef.current;
    if (!card || reducedMotion) return;
    gsap.fromTo(
      card,
      { x: 0 },
      { keyframes: { x: [-6, 6, -4, 4, 0] }, duration: 0.35, ease: "power1.inOut", clearProps: "x" },
    );
  };

  /* The earned XP flies from the answered option to the XP counter (MotionPath). */
  const flyXP = (fromRect: DOMRect, amount: number) => {
    const target = xpChipRef.current;
    if (!target || reducedMotion) return;
    const t = target.getBoundingClientRect();
    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top;
    const el = document.createElement("div");
    el.textContent = `+${amount}`;
    el.className = "num";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      `position:fixed;left:${startX}px;top:${startY}px;z-index:10000;pointer-events:none;` +
      "font-weight:800;font-size:20px;color:var(--color-tertiary);text-shadow:0 0 10px rgba(255,176,46,.55);";
    document.body.appendChild(el);
    const dx = t.left + t.width / 2 - startX;
    const dy = t.top + t.height / 2 - startY;
    gsap.to(el, {
      motionPath: { path: [{ x: 0, y: 0 }, { x: dx * 0.4, y: Math.min(dy, 0) - 90 }, { x: dx, y: dy }], curviness: 1.4 },
      duration: 0.95,
      ease: "power1.in",
      scale: 0.5,
      onComplete: () => {
        el.remove();
        gsap.fromTo(target, { scale: 1.28 }, { scale: 1, duration: 0.4, ease: "elastic.out(1.4, 0.4)" });
      },
    });
    gsap.to(el, { opacity: 0, duration: 0.2, delay: 0.78 });
  };

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [questionKey]);

  // Countdown timer during review phase
  useEffect(() => {
    if (!reviewPhase || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [reviewPhase, countdown]);

  useEffect(() => {
    if (activeQuestion) {
      setSelected(null); setSubmitted(false); setReviewPhase(false);
      setCountdown(0); setShowHint(false);
      setHint(null); setHintsUsed(0); setElapsed(0);
      startTimeRef.current = Date.now(); setShowCelebration(false); setEarnedXP(0);
    }
  }, [activeQuestion?._id]);

  if (!student || !currentTopic) return null;

  const handleSelect = async (idx: number, choiceEl?: HTMLElement) => {
    if (submitted || !activeQuestion || transitionLockRef.current) return;
    setSelected(idx); setSubmitted(true);
    const isCorrect = idx === activeQuestion.correctIndex;
    setQuestionsAnswered(q => q + 1);
    const newCombo = isCorrect ? combo + 1 : 0;
    setCombo(newCombo);
    const comboBonus = isCorrect ? Math.min(newCombo, CHARGE_MAX) * 10 : 0; // charged-streak reward
    const xpGained = isCorrect
      ? (activeQuestion.difficulty * 50) + (hintsUsed === 0 ? 30 : 0) + comboBonus
      : 0;
    log.practice("answer submitted", {
      questionId: activeQuestion._id, choiceIndex: idx, isCorrect,
      xpGained, combo: newCombo, hintsUsed, difficulty: activeQuestion.difficulty,
    });
    if (isCorrect) {
      setSessionXP(x => x + xpGained);
      setEarnedXP(xpGained);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1800);
      flashCard("correct");
      playSpark();
      if (choiceEl && !reducedMotion) {
        const r = choiceEl.getBoundingClientRect();
        fireConfetti(r.left + r.width / 2, r.top + r.height / 2);
        flyXP(r, xpGained);
      }
      if (newCombo >= 3) fireStreak(newCombo);
      setWrongStreak(0);
      // Faraday reacts: streak milestone always, otherwise ~1-in-3 on plain correct
      if (newCombo === 3 || newCombo === 5 || newCombo === 10) {
        setReaction({ kind: "streak", count: newCombo });
      } else if (Math.random() < 1 / 3) {
        setReaction({ kind: "correct" });
      }
    } else {
      flashCard("wrong");
      playBuzz();
      shakeCard();
      // Faraday reacts on every wrong answer with a gentle, growth-minded line
      setReaction({ kind: "wrong" });
      // Proactive Faraday: after two misses in a row he offers help himself.
      setWrongStreak(w => {
        const next = w + 1;
        if (next >= 2 && !chatOpen && !nudgeDismissed) setShowNudge(true);
        return next;
      });
    }
    // Enter review phase with 5-second minimum
    setReviewPhase(true);
    setCountdown(5);
    const res = await submitAttempt({
      studentId: studentId as Id<"students">, questionId: activeQuestion._id,
      topicId: topicId as Id<"topics">, choiceIndex: idx, isCorrect,
      timeMs: Date.now() - startTimeRef.current, hintsUsed, difficulty: activeQuestion.difficulty,
    });
    if (res?.sessionId) setSessionId(res.sessionId);
    log.practice("attempt persisted to Convex", { questionId: activeQuestion._id, dailyGoalReached: res?.dailyGoalReached });
  };

  const handleHint = async () => {
    if (!activeQuestion || loadingHint) return;
    log.practice("hint requested", { questionId: activeQuestion._id, hintsUsedSoFar: hintsUsed });
    setShowHint(true); setLoadingHint(true); setHintsUsed(h => h + 1);
    const r = await generateHint({
      studentId: studentId as Id<"students">, questionId: activeQuestion._id,
      studentInput: selected !== null ? activeQuestion.choices[selected] : "",
    });
    setHint(r.hint); setLoadingHint(false);
    log.practice("hint received from AI", { questionId: activeQuestion._id, hintLength: r.hint?.length ?? 0 });
  };

  const handleNextQuestion = () => {
    if (countdown > 0) return; // enforce 5s minimum
    log.practice("advancing to next question", { questionsAnswered, sessionXP });
    transitionLockRef.current = true;
    setTimeout(() => { transitionLockRef.current = false; }, 400);
    setReviewPhase(false);
    setActiveQuestion(null);
    setQuestionKey(k => k + 1);
  };

  // End the session → freeze the window and show the recap. If the student
  // never answered anything, skip straight back to the map.
  const handleEndSession = async () => {
    if (questionsAnswered === 0) {
      navigate(`/student/${studentId}`);
      return;
    }
    const id = await endSession({ studentId: studentId as Id<"students"> });
    setRecapId((id as Id<"sessions"> | null) ?? sessionId);
    setShowRecap(true);
  };

  // "עוד סיבוב" — dismiss the recap and start a fresh session/question.
  const handleNewSession = () => {
    setShowRecap(false);
    setRecapId(null);
    setSessionId(null);
    setCombo(0);
    setSessionXP(0);
    setQuestionsAnswered(0);
    setReviewPhase(false);
    setActiveQuestion(null);
    setQuestionKey(k => k + 1);
  };

  const isCorrect = submitted && selected === activeQuestion?.correctIndex;
  const timerStr  = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">

      {/* ── Faraday-effect polarization field (full-bleed backdrop) ── */}
      <FaradayCanvas variant="effect" style={{ position: 'fixed', zIndex: 0 }} />

      {/* ── Top nav ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 border-b-2 border-outline backdrop-blur-xl"
        style={{ boxShadow: 'var(--shadow-sm)', background: 'color-mix(in srgb, var(--color-surface) 88%, transparent)' }}
      >
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button className="btn-icon flex-shrink-0" onClick={handleEndSession} aria-label="סיום הסבב">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-on-surface truncate">{currentTopic.nameHe}</div>
            <div className="label-mono text-[0.6rem]">מצב תרגול</div>
          </div>
        </div>

        {/* Session stats */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Charge meter — builds with each correct answer in a row */}
          <ChargeMeter combo={combo} max={CHARGE_MAX} />
          {/* Questions chip */}
          <div className="stat-chip">
            <Activity size={13} className="text-primary" />
            <span key={questionsAnswered} className="num font-bold text-sm text-on-surface pop">{questionsAnswered}</span>
            <span className="text-xs text-on-surface-variant">שאלות</span>
          </div>
          {/* XP chip — the number pops on every increment (keyed re-mount) */}
          <div className="stat-chip" ref={xpChipRef}>
            <Zap size={13} className="text-tertiary" />
            <span key={sessionXP} className="num font-bold text-sm text-tertiary pop">+{sessionXP}</span>
            <span className="text-xs text-on-surface-variant">XP</span>
          </div>
          <ThemeToggle />
          {questionsAnswered > 0 && (
            <button
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-surface text-on-surface-variant border-2 border-outline hover:border-primary hover:text-primary font-semibold text-sm transition-all cursor-pointer"
              style={{ boxShadow: 'var(--shadow-clay)' }}
              onClick={handleEndSession}
            >
              <CheckCircle2 size={14} className="text-primary" />
              סיים סבב
            </button>
          )}
          {/* Icon-only on phones — the labeled pill overflowed the narrow header */}
          <button
            className="btn-clay-primary !p-0 w-11 h-11 sm:w-auto sm:h-auto sm:!px-4 sm:!py-2 text-sm justify-center flex-shrink-0"
            onClick={openChat}
            aria-label="שאל את פאראדיי"
          >
            <Bot size={16} />
            <span className="hidden sm:inline">שאל את פאראדיי</span>
          </button>
        </div>
      </motion.header>

      {/* ── Main arena ── */}
      <div
        className={`relative z-10 min-h-screen flex flex-col transition-[padding] duration-300 ${
          chatOpen
            ? 'justify-start pt-[112px] pb-[64vh] lg:pb-16 lg:pt-24 lg:ps-[min(464px,44vw)]'
            : 'justify-center pt-24 pb-16'
        }`}
      >
        <div className="page-shell flex gap-6 items-start">

        {/* Left: Question area */}
        <div className="flex-1 flex flex-col gap-5">

          {/* Mobile streak bar — the header ChargeMeter is desktop-only, so the
              correct-answer streak still has a home on small screens. */}
          <div className="sm:hidden rounded-2xl border-2 border-outline bg-surface px-4 py-3" style={{ boxShadow: 'var(--shadow-clay)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-on-surface-variant">רצף תשובות</span>
              <span className="num text-xs font-extrabold text-primary flex items-center gap-1">
                {Math.min(combo, CHARGE_MAX)} / {CHARGE_MAX} <Zap size={12} />
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: CHARGE_MAX }).map((_, i) => {
                const on = i < Math.min(combo, CHARGE_MAX);
                const full = combo >= CHARGE_MAX;
                return (
                  <span
                    key={i}
                    className="flex-1 rounded-full transition-all duration-300"
                    style={{ height: 7, background: on ? 'var(--color-primary)' : 'var(--color-outline)', boxShadow: on && full ? '0 0 6px var(--color-inverse-primary)' : 'none' }}
                  />
                );
              })}
            </div>
          </div>

          {!activeQuestion && question === undefined ? (
            <div className="clay-card p-16 flex flex-col items-center justify-center text-center">
              <ElectricLoader fullscreen={false} size={48} label="טוען שאלה..." />
            </div>
          ) : !activeQuestion && question === null ? (
            <div className="clay-card p-16 flex flex-col items-center justify-center text-center">
              <CheckCircle2 size={48} className="text-primary mb-4" />
              <h2 className="font-display font-bold text-on-surface mb-3" style={{ fontSize: '1.6rem' }}>כיסית את כל הנושא! ⚡</h2>
              <p className="text-sm text-on-surface-variant mb-8">
                אין עוד שאלות כאן — סימן שאתה שולט בחומר. קדימה לנושא הבא.
              </p>
              <button className="btn-clay-primary px-8 py-4 text-base" onClick={() => navigate(`/student/${studentId}`)}>
                חזרה למפת הלמידה
              </button>
            </div>
          ) : activeQuestion ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeQuestion._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Question card */}
                <div
                  ref={questionCardRef}
                  className="clay-card relative overflow-hidden p-5 md:p-8 backdrop-blur-md"
                  style={{ background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)' }}
                >
                  {/* Top accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-2xl" />

                  {/* Meta row */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="badge">שאלה #{questionsAnswered + 1}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-surface-container border-2 border-outline text-on-surface-variant">
                        {'★'.repeat(Math.max(0, activeQuestion.difficulty || 1))}{'☆'.repeat(Math.max(0, 3 - (activeQuestion.difficulty || 1)))} רמה {activeQuestion.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                      <Clock size={14} />
                      <span className="font-medium">{timerStr}</span>
                    </div>
                  </div>

                  {/* Stem — letters jump in one by one via animateLetters */}
                  <div className="text-lg md:text-xl leading-relaxed font-semibold text-on-surface mb-8">
                    <MathText animateLetters>{activeQuestion.stem}</MathText>
                  </div>

                  {/* Celebration — electric spark discharge on a correct answer */}
                  <AnimatePresence>
                    {showCelebration && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                      >
                        {!reducedMotion && <SparkBurst />}
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 1.3, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                          className="relative flex flex-col items-center"
                        >
                          <span
                            className="font-display font-black text-primary text-5xl md:text-6xl"
                            style={{ textShadow: '0 0 24px rgba(91,255,159,0.6)' }}
                          >
                            ✓ מעולה!
                          </span>
                          {combo >= 2 && (
                            <span
                              className="num mt-2 px-3 py-1 rounded-full text-sm font-bold bg-primary text-on-primary"
                              style={{ boxShadow: '0 0 16px rgba(91,255,159,0.6)' }}
                            >
                              רצף ×{combo}
                            </span>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Choices */}
                  <div ref={choicesRef} className="flex flex-col gap-3 mb-6">
                    {activeQuestion.choices.map((choice: string, idx: number) => {
                      const isThisCorrect = idx === activeQuestion.correctIndex;
                      const isSelected    = selected === idx;
                      const isWrong       = submitted && isSelected && !isThisCorrect;
                      const isRight       = submitted && isThisCorrect;
                      const isInactive    = submitted && !isRight && !isWrong;

                      // Determine classes based on state
                      let cardClasses = "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-right transition-all duration-200 border-2 font-medium cursor-pointer select-none";
                      let badgeClasses = "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm";

                      if (isRight) {
                        cardClasses += " bg-primary border-primary text-white";
                        badgeClasses += " bg-white/20 text-white";
                      } else if (isWrong) {
                        cardClasses += " bg-error border-error text-white";
                        badgeClasses += " bg-white/20 text-white";
                      } else if (isSelected && !submitted) {
                        cardClasses += " bg-primary/10 border-primary text-on-surface";
                        badgeClasses += " bg-primary/20 text-primary";
                      } else if (isInactive) {
                        cardClasses += " bg-surface border-outline-variant text-on-surface-variant opacity-50";
                        badgeClasses += " bg-surface-container text-on-surface-variant";
                      } else {
                        cardClasses += " bg-surface border-outline text-on-surface hover:border-primary hover:bg-primary/5";
                        badgeClasses += " bg-surface-container text-on-surface-variant";
                        if (!submitted) { cardClasses += " cursor-pointer"; }
                      }

                      return (
                        <motion.button
                          key={idx}
                          whileHover={!submitted ? { scale: 1.01 } : {}}
                          whileTap={!submitted ? { scale: 0.99 } : {}}
                          className={cardClasses}
                          style={{ boxShadow: isRight || isWrong ? 'none' : 'var(--shadow-clay)', cursor: submitted ? 'default' : 'pointer' }}
                          onClick={(e) => handleSelect(idx, e.currentTarget)}
                        >
                          <div className={badgeClasses}>
                            {isRight && <CheckCircle2 size={16} className="text-white" />}
                            {isWrong && <XCircle size={16} className="text-white" />}
                            {!isRight && !isWrong && String.fromCharCode(65 + idx)}
                          </div>
                          <span className="flex-1"><MathText>{choice}</MathText></span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Hint button (pre-submit) */}
                  {!submitted && (
                    <div className="flex items-center gap-3">
                      <button
                        className="btn-clay-ghost"
                        onClick={handleHint}
                        disabled={loadingHint}
                      >
                        <ElectricBulb size={17} tone="current" animated={false} glow={0.4} />
                        {loadingHint ? 'טוען רמז...' : 'רמז מ-AI'}
                      </button>
                    </div>
                  )}

                  {/* Hint panel */}
                  <AnimatePresence>
                    {(showHint && hint) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 overflow-hidden"
                      >
                        <div className="p-4 rounded-2xl flex items-start gap-3 bg-tertiary/10 border-2 border-tertiary/30">
                          <ElectricBulb size={18} tone="amber" glow={0.55} className="mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-on-surface-variant leading-relaxed">{hint}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Review Phase: Full Explanation Panel ── */}
                  <AnimatePresence>
                    {reviewPhase && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35 }}
                        className={`mt-6 rounded-2xl overflow-hidden border-2 ${isCorrect ? 'border-primary/40 bg-primary/5' : 'border-error/40 bg-error/5'}`}
                      >
                        {/* Review header */}
                        <div className={`flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b-2 ${isCorrect ? 'bg-primary/10 border-primary/20' : 'bg-error/10 border-error/20'}`}>
                          <div className="flex items-center gap-3 flex-wrap">
                            {isCorrect
                              ? <CheckCircle2 size={22} className="text-primary" />
                              : <XCircle size={22} className="text-error" />}
                            <span className={`font-bold text-lg font-display ${isCorrect ? 'text-primary' : 'text-error'}`}>
                              {isCorrect ? '✓ תשובה נכונה!' : '✗ תשובה שגויה'}
                            </span>
                            {isCorrect && earnedXP > 0 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-tertiary/15 text-tertiary border border-tertiary/30">
                                <Zap size={11} /> +{earnedXP} XP
                              </span>
                            )}
                          </div>
                          {/* Countdown / Next button */}
                          <button
                            onClick={handleNextQuestion}
                            disabled={countdown > 0}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all border-2 ${
                              countdown > 0
                                ? 'bg-surface-container border-outline text-on-surface-variant cursor-not-allowed opacity-70'
                                : 'bg-primary border-primary text-white cursor-pointer'
                            }`}
                            style={countdown === 0 ? { boxShadow: 'var(--shadow-clay-primary)' } : undefined}
                          >
                            {countdown > 0 ? (
                              <><Clock size={14} /> {countdown}s...</>
                            ) : (
                              <>שאלה הבאה <ArrowRight size={14} /></>
                            )}
                          </button>
                        </div>

                        <div className="p-6 flex flex-col gap-5">
                          {/* If wrong: show correct answer */}
                          {!isCorrect && (
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/8 border-2 border-primary/20">
                              <CheckCircle2 size={16} className="text-primary flex-shrink-0 mt-0.5" />
                              <div>
                                <div className="text-xs font-semibold mb-1 text-primary">התשובה הנכונה:</div>
                                <div className="font-medium text-on-surface">
                                  <MathText>{activeQuestion.choices[activeQuestion.correctIndex]}</MathText>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <ElectricBulb size={17} tone="amber" glow={0.5} />
                              <span className="text-sm font-semibold text-on-surface-variant">הסבר:</span>
                            </div>
                            <p className="text-base leading-relaxed text-on-surface" style={{ lineHeight: 1.75 }}>
                              <MathText>{activeQuestion.explanation ?? ""}</MathText>
                            </p>
                          </div>

                          {/* Solution Steps */}
                          {activeQuestion.solutionSteps && activeQuestion.solutionSteps.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Star size={15} className="text-primary" />
                                <span className="text-sm font-semibold text-on-surface-variant">שלבי פתרון:</span>
                              </div>
                              <ol className="flex flex-col gap-2.5">
                                {activeQuestion.solutionSteps.map((step: string, i: number) => (
                                  <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant" style={{ lineHeight: 1.6 }}>
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary/10 text-primary border border-primary/30">
                                      {i + 1}
                                    </span>
                                    <MathText>{step}</MathText>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {/* Right: Calculator */}
        <div className="w-[300px] flex-shrink-0 hidden lg:block">
          <CalculatorCard />
        </div>
        </div>
      </div>

      {/* Proactive Faraday — floats in after two misses in a row */}
      <AnimatePresence>
        {showNudge && !chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="fixed bottom-6 inset-x-3 sm:inset-x-auto sm:start-6 z-[90] sm:max-w-[22rem] rounded-3xl border-2 border-primary/40 bg-surface p-4 flex items-start gap-3"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
            role="status"
          >
            <div className="w-11 h-11 rounded-full bg-primary/10 border-2 border-primary/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <FaradayAvatar px={40} fill />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-on-surface">פרופסור פאראדיי שם לב שקצת קשה כאן ⚡</div>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">בוא נפרק את השאלה יחד, צעד אחר צעד — בלי לחשוף את התשובה.</p>
              <div className="flex gap-2 mt-2.5">
                <button
                  className="btn-clay-primary !px-3.5 !py-1.5 !text-xs"
                  onClick={() => { setShowNudge(false); setNudgeDismissed(true); openChat(); }}
                >
                  <Bot size={13} /> שאל את פאראדיי
                </button>
                <button
                  className="px-3 py-1.5 rounded-xl border-2 border-outline text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer"
                  onClick={() => { setShowNudge(false); setNudgeDismissed(true); }}
                >
                  לא עכשיו
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Faraday personality pop-in — reacts to the last answer, auto-dismisses */}
      <FaradayReaction
        kind={reaction?.kind ?? "correct"}
        streakCount={reaction?.count}
        visible={!!reaction}
        onDone={() => setReaction(null)}
      />

      <AnimatePresence>
        {showRecap && (
          <SessionRecap
            studentId={studentId as Id<"students">}
            sessionId={recapId}
            onNewSession={handleNewSession}
            onBackToMap={() => navigate(`/student/${studentId}`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Charge meter — a segmented gauge that fills with each correct answer in a row ── */
function ChargeMeter({ combo, max }: { combo: number; max: number }) {
  const level = Math.min(combo, max);
  const full = level >= max;
  // the bolt grows a notch with every correct answer and springs back on a miss
  const boltRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = boltRef.current;
    if (!el || prefersReducedMotion()) return;
    const restScale = 1 + level * 0.06;
    if (combo === 0) {
      gsap.to(el, { scale: 1, duration: 0.35, ease: "power2.out" });
    } else {
      gsap.fromTo(el, { scale: restScale + 0.3 }, { scale: restScale, duration: 0.55, ease: "elastic.out(1.3, 0.4)" });
    }
  }, [combo, level]);
  return (
    <div
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border-2 border-outline"
      style={{ boxShadow: 'var(--shadow-clay)' }}
      title="טעינת אנרגיה — רצף תשובות נכונות"
    >
      <span ref={boltRef} className={`inline-flex rounded-full ${full ? "glow-breathe" : ""}`}>
        <Battery size={18} tone="spark" glow={full ? 0.9 : 0.3} animated={full} />
      </span>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-4 rounded-full transition-all duration-300"
            style={{
              background: i < level ? 'var(--color-primary)' : 'var(--color-outline)',
              boxShadow: i < level && full ? '0 0 6px var(--color-inverse-primary)' : 'none',
            }}
          />
        ))}
      </div>
      {full && <span className="num text-[10px] font-bold text-primary">מלא!</span>}
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
        const expr = eqValue
          .replace(/×/g, "*").replace(/÷/g, "/")
          .replace(/π/g, "Math.PI")
          .replace(/sin\(/g, "Math.sin(").replace(/cos\(/g, "Math.cos(")
          .replace(/tan\(/g, "Math.tan(").replace(/log\(/g, "Math.log10(")
          .replace(/√\(/g, "Math.sqrt(").replace(/\^/g, "**");
        const result = new Function("return " + expr)();
        setEqValue(Number.isFinite(result) ? Number(result.toFixed(5)).toString() : "Error");
      } catch { setEqValue("Error"); }
    }
    else if (["sin", "cos", "tan", "log", "√"].includes(key)) setEqValue(v => (v === "Error" ? "" : v) + key + "(");
    else if (key === "x²") setEqValue(v => (v === "Error" ? "" : v) + "^2");
    else if (key === "xⁿ") setEqValue(v => (v === "Error" ? "" : v) + "^");
    else setEqValue(v => (v === "Error" ? "" : v) + key);
  };

  return (
    <div
      className="clay-card p-5 sticky top-24 backdrop-blur-md"
      style={{ background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)' }}
    >
      <div className="label-mono mb-4 text-on-surface-variant">מחשבון מדעי</div>

      {/* Display */}
      <div className="rounded-xl px-4 py-3 mb-4 overflow-hidden bg-surface-container-low border-2 border-outline" style={{ minHeight: 52 }}>
        <span
          className="text-on-surface block text-right"
          style={{
            fontFamily: 'Assistant, sans-serif',
            fontSize: eqValue.length > 12 ? '0.85rem' : '1.2rem',
            direction: 'ltr',
          }}
        >
          {eqValue || <span className="text-on-surface-variant opacity-40">0</span>}
        </span>
      </div>

      {/* Scientific row */}
      <div className="grid grid-cols-4 gap-1.5 mb-1.5">
        {["x²", "xⁿ", "√", "π", "sin", "cos", "tan", "log"].map(k => (
          <button
            key={k}
            onClick={() => handleKeyPress(k)}
            className="h-9 rounded-xl text-xs font-semibold transition-all duration-150 bg-primary/10 border-2 border-primary/30 text-primary hover:bg-primary/20 active:scale-95"
          >
            {k}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {["(", ")", "C", "del", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "=", "+"].map(k => {
          const isEquals  = k === "=";
          const isClear   = k === "C";
          const isOp      = ["÷", "×", "-", "+", "(", ")"].includes(k);
          const isDel     = k === "del";

          let btnClass = "h-10 rounded-xl font-semibold text-sm transition-all duration-150 border-2 active:scale-95 cursor-pointer";
          if (isEquals) btnClass += " bg-primary border-primary text-white col-span-1";
          else if (isClear) btnClass += " bg-error/10 border-error/30 text-error hover:bg-error/20";
          else if (isDel) btnClass += " bg-surface-container-high border-outline text-on-surface-variant hover:bg-surface-container";
          else if (isOp) btnClass += " bg-secondary/10 border-secondary/30 text-secondary hover:bg-secondary/20";
          else btnClass += " bg-surface border-outline text-on-surface hover:bg-surface-container";

          return (
            <button
              key={k}
              onClick={() => handleKeyPress(k)}
              className={btnClass}
              style={isEquals ? { boxShadow: 'var(--shadow-clay-primary)' } : { boxShadow: 'var(--shadow-clay)' }}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}


