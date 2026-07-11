import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle as CheckCircle2, CircleIcon as Circle, Bot, ChevronRight
} from "../components/electric";
import { ThemeToggle } from "../components/ThemeContext";
import CompoundQuestionRenderer from "../components/CompoundQuestionRenderer";
import LegacyHomeworkRenderer from "../components/LegacyHomeworkRenderer";
import { useFaraday } from "../components/chat/FaradayProvider";
import { Sparkles, Eye, EyeOff } from "../components/electric";
import { ElectricAtom, ElectricBolt } from "../components/electric";

export default function StudentHomework() {
  const { studentId, homeworkId } = useParams<{ studentId: string; homeworkId: string }>();
  const navigate = useNavigate();

  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const homework = useQuery(
    api.homework.getStudentHomework,
    studentId && homeworkId
      ? { homeworkId: homeworkId as Id<"homework">, studentId: studentId as Id<"students"> }
      : "skip"
  );
  const hwMeta = useQuery(
    api.homework.getHomeworkForClassroom,
    student?.classroomId ? { classroomId: student.classroomId } : "skip"
  );

  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const faraday = useFaraday();
  const chatOpen = faraday.isOpen;

  // Keep Faraday's context on the question the student is viewing.
  const ctxAssignment = activeQuestionIdx !== null ? homework?.[activeQuestionIdx] : null;
  const ctxQuestion = ctxAssignment?.questionData;
  const ctxStem = ctxQuestion
    ? ("preamble" in ctxQuestion ? (ctxQuestion as { preamble?: string }).preamble : (ctxQuestion as { stem?: string }).stem)
    : undefined;
  const ctxQuestionId = ctxAssignment?.questionId ?? undefined;
  const { updateContext } = faraday;
  useEffect(() => {
    updateContext({ questionStem: ctxStem, questionId: ctxQuestionId });
  }, [ctxStem, ctxQuestionId, updateContext]);

  const openChat = (requestBridge = false) => faraday.open({
    studentId: studentId!,
    agentType: "homework",
    questionStem: ctxStem,
    questionId: ctxQuestionId,
    requestBridge,
  });

  if (!student || !homework) return null;

  const currentHw = hwMeta?.find((h) => h._id === homeworkId);
  const isDeadlinePassed = currentHw ? Date.now() > currentHw.deadline : false;

  const completedCount = homework.filter((q) => q.status === "submitted").length;
  const totalCount = homework.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeAssignment = activeQuestionIdx !== null ? homework[activeQuestionIdx] : null;
  const activeQuestion = activeAssignment?.questionData;

  return (
    <div className="min-h-screen bg-background text-on-surface relative overflow-hidden flex flex-col">
      {/* ── Return Link ── */}
      <button className="fixed top-6 left-6 z-40 btn btn-primary btn-ghost" onClick={() => navigate(`/student/${studentId}/homework`)}>
        <ArrowLeft size={16} /> חזרה לרשימה
      </button>
      <ThemeToggle className="btn-icon fixed top-6 right-6 z-40" />

      {/* Main Container */}
      <div
        className="page-shell page-shell--wide pt-32 relative z-10 flex gap-12 flex-col lg:flex-row"
        style={{ paddingBottom: chatOpen ? '58vh' : '80px', transition: 'padding 0.3s ease' }}
      >
        
        {/* LEFT COLUMN: Main List or Active Question */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {activeQuestionIdx !== null && activeQuestion && activeAssignment ? (
              "sections" in activeQuestion ? (
                /* ── Active Compound Question ── */
                <motion.div
                  key="compound"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <button
                    className="btn btn-primary btn-ghost mb-8"
                    onClick={() => { setActiveQuestionIdx(null); setShowOriginal(false); }}
                  >
                    <ChevronRight size={16} /> חזרה לרשימה
                  </button>

                  {/* Personalization banner */}
                  {activeAssignment.themeApplied && (
                    <div className="mb-4 flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10">
                      <div className="flex items-center gap-2 text-primary">
                        <Sparkles size={14} />
                        <span className="text-sm font-semibold">שאלה זו עוצבה לנושא: {activeAssignment.themeApplied}</span>
                      </div>
                      <button
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-primary text-primary transition-all"
                        onClick={() => setShowOriginal(p => !p)}
                      >
                        {showOriginal ? <><EyeOff size={12} /> הסתר מקורי</> : <><Eye size={12} /> הצג מקורי</>}
                      </button>
                    </div>
                  )}

                  <CompoundQuestionRenderer
                    question={activeQuestion as any}
                    assignedQuestionId={activeAssignment._id}
                    onComplete={() => { setActiveQuestionIdx(null); setShowOriginal(false); }}
                    aiChatTrigger={() => openChat()}
                    onQrBridge={() => openChat(true)}
                    overridePreamble={!showOriginal ? activeAssignment.personalizedPreamble : undefined}
                  />
                </motion.div>
              ) : (
                /* ── Active Legacy Question ── */
                <motion.div
                  key="legacy"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <button
                    className="btn btn-primary btn-ghost mb-8"
                    onClick={() => { setActiveQuestionIdx(null); setShowOriginal(false); }}
                  >
                    <ChevronRight size={16} /> חזרה לרשימה
                  </button>

                  {/* Personalization banner */}
                  {activeAssignment.themeApplied && (
                    <div className="mb-4 flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10">
                      <div className="flex items-center gap-2 text-primary">
                        <Sparkles size={14} />
                        <span className="text-sm font-semibold">שאלה זו עוצבה לנושא: {activeAssignment.themeApplied}</span>
                      </div>
                      <button
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-primary text-primary transition-all"
                        onClick={() => setShowOriginal(p => !p)}
                      >
                        {showOriginal ? <><EyeOff size={12} /> הסתר מקורי</> : <><Eye size={12} /> הצג מקורי</>}
                      </button>
                    </div>
                  )}

                  <LegacyHomeworkRenderer
                    question={activeQuestion as any}
                    assignedQuestionId={activeAssignment._id}
                    onComplete={() => { setActiveQuestionIdx(null); setShowOriginal(false); }}
                    aiChatTrigger={() => openChat()}
                    onQrBridge={() => openChat(true)}
                    overrideStem={!showOriginal ? activeAssignment.personalizedStem : undefined}
                  />
                </motion.div>
              )
            ) : (
              /* ── Question List ── */
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-12">
                  <h1 className="font-display text-6xl font-black text-on-surface mb-4">
                    {currentHw?.title || "רשימת המשימות"}
                  </h1>
                  <p className="font-mono text-primary opacity-80 text-lg uppercase tracking-widest">
                    {student.name}, {totalCount} שאלות מחכות לך.
                    {isDeadlinePassed && <span className="text-error ml-4 font-bold"> — עבר המועד!</span>}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="glass p-8 mb-12 relative overflow-hidden">
                  <div className="flex justify-between items-end mb-4">
                    <div className="label-mono text-primary text-lg">ההתקדמות שלך</div>
                    <div className="num font-black text-4xl text-primary">{progress}%</div>
                  </div>
                  <div className="w-full h-3 bg-surface-container-low relative border border-outline rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 right-0 h-full bg-primary transition-all duration-700 ease-out rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-4 label-mono text-on-surface-variant">
                    <span>{completedCount} מתוך {totalCount} הושלמו</span>
                    {currentHw && (
                      <span className="flex items-center gap-2">
                        <Clock size={14} />
                        מועד: {new Date(currentHw.deadline).toLocaleDateString("he-IL", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Question cards */}
                <div className="flex flex-col gap-6">
                  {homework.map((aq, idx) => {
                    const qData = aq.questionData;
                    const isCompound = qData && "sections" in qData;
                    const status = aq.status;

                    return (
                      <motion.div
                        key={aq._id}
                        className={`glass p-6 border transition-all relative overflow-hidden flex flex-col gap-4 ${status !== "submitted" ? "cursor-pointer hover:border-primary" : "border-primary bg-primary/10"}`}
                        onClick={() => status !== "submitted" && setActiveQuestionIdx(idx)}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        {/* Status accent bar */}
                        <div className="absolute top-0 right-0 bottom-0 w-1" style={{
                          backgroundColor: status === "submitted" ? 'var(--color-primary)' : status === "in_progress" ? 'var(--color-tertiary)' : 'var(--color-primary)',
                          boxShadow: status === "submitted" ? '0 0 12px rgba(23,201,100,0.4)' : 'none'
                        }} />

                        <div className="flex items-center gap-6 pl-4 pr-6">
                          <div style={{ color: status === "submitted" ? 'var(--color-primary)' : status === "in_progress" ? 'var(--color-tertiary)' : 'var(--color-primary)' }}>
                            {status === "submitted" ? (
                              <CheckCircle2 size={24} />
                            ) : status === "in_progress" ? (
                              <Clock size={24} />
                            ) : (
                              <Circle size={24} />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="text-2xl font-black font-display text-on-surface mb-1">
                              שאלה {idx + 1}
                              {isCompound && <span className="ml-3 text-primary/80 text-sm border border-primary/40 px-2 py-0.5 rounded-sm">581</span>}
                            </div>
                            <div className="font-mono text-sm text-on-surface-variant opacity-60">
                              {isCompound
                                ? (aq.personalizedPreamble
                                    ? aq.personalizedPreamble.slice(0, 70) + "..."
                                    : `${(qData as any).sections?.length || 0} סעיפים · רמה ${(qData as any).difficulty || "-"}`)
                                : qData
                                  ? (aq.personalizedStem ?? (qData as any).stem ?? "").slice(0, 70) + "..."
                                  : "שאלה"
                              }
                            </div>
                            {/* Theme badge */}
                            {aq.themeApplied && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-primary">
                                <Sparkles size={11} />
                                <span>ערוך לנושא: {aq.themeApplied}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="label-mono px-3 py-1 bg-surface-container-low border border-outline">
                              {aq.personalizedReason}
                            </div>
                            {status === "submitted" && aq.score !== undefined && (
                              <div
                                className="num font-black text-3xl"
                                style={{ color: aq.score >= 70 ? "var(--color-primary)" : aq.score >= 40 ? "var(--color-tertiary)" : "var(--color-error)" }}
                              >
                                {aq.score}%
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tags for compound */}
                        {isCompound && ((qData as any).tags || []).length > 0 && (
                          <div className="flex gap-2 mt-2 pr-[72px]">
                            {((qData as any).tags || []).slice(0, 3).map((tag: string) => (
                              <span key={tag} className="label-mono text-[10px] px-2 py-1 bg-primary/5 border border-primary/20 text-primary/80">{tag}</span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT COLUMN: Stats / AI ── */}
        <div className="w-full lg:w-[400px] flex flex-col gap-8">
          
          <div className="glass p-8 flex flex-col gap-6">
            <div className="label-mono text-primary border-b border-outline-variant pb-2 flex items-center gap-2">
              <ElectricBolt size={18} tone="spark" glow={0.5} /> נתוני משימה
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-on-surface">הושלמו</span>
              <span className="num text-3xl font-black text-primary">{completedCount} / {totalCount}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-on-surface">ציון ממוצע</span>
              <span className="num text-3xl font-black" style={{
                color: homework.filter((q) => q.score !== undefined).length > 0
                  ? (() => {
                    const avg = homework.filter((q) => q.score !== undefined).reduce((s, q) => s + (q.score ?? 0), 0) /
                      homework.filter((q) => q.score !== undefined).length;
                    return avg >= 70 ? "var(--color-primary)" : avg >= 40 ? "var(--color-tertiary)" : "var(--color-error)";
                  })()
                  : undefined
              }}>
                {homework.filter((q) => q.score !== undefined).length > 0
                  ? Math.round(homework.filter((q) => q.score !== undefined).reduce((s, q) => s + (q.score ?? 0), 0) /
                    homework.filter((q) => q.score !== undefined).length) + "%"
                  : "—"
                }
              </span>
            </div>
          </div>

          {currentHw?.teacherNotes && (
            <div className="glass p-6 border border-tertiary/50 bg-tertiary/10">
              <div className="label-mono text-tertiary mb-3">הערות המורה</div>
              <div className="font-mono text-sm leading-relaxed text-tertiary">{currentHw.teacherNotes}</div>
            </div>
          )}

          {/* AI Tutor CTA */}
          <div className="glass p-8 border border-primary bg-primary/5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-10">
              <ElectricAtom size={120} glow={1} animated={false} />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl border border-primary flex items-center justify-center bg-primary text-white">
                <ElectricAtom size={22} tone="ghost" glow={0.6} />
              </div>
              <div className="font-display text-3xl text-primary">פרופסור פאראדיי</div>
            </div>

            <div className="font-mono text-sm leading-relaxed text-on-surface opacity-80 mb-8 relative z-10">
              נתקעת? פאראדיי כאן כדי לכוון אותך צעד אחר צעד — בלי לחשוף את התשובה הסופית.
            </div>

            <button className="btn btn-primary w-full justify-center relative z-10" onClick={() => openChat()}>
              שאל את פאראדיי
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}

