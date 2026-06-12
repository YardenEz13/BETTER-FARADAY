import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, Circle, Bot, Zap, ChevronRight
} from "lucide-react";
import CompoundQuestionRenderer from "../components/CompoundQuestionRenderer";
import LegacyHomeworkRenderer from "../components/LegacyHomeworkRenderer";
import AIChatPanel from "../components/AIChatPanel";

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
  const [chatOpen, setChatOpen] = useState(false);

  if (!student || !homework) return null;

  const currentHw = hwMeta?.find((h) => h._id === homeworkId);
  const isDeadlinePassed = currentHw ? Date.now() > currentHw.deadline : false;

  const completedCount = homework.filter((q) => q.status === "submitted").length;
  const totalCount = homework.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeAssignment = activeQuestionIdx !== null ? homework[activeQuestionIdx] : null;
  const activeQuestion = activeAssignment?.questionData;

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] relative overflow-hidden flex flex-col">
      {/* ── Return Link ── */}
      <button className="fixed top-6 left-6 z-40 btn btn-primary btn-ghost" onClick={() => navigate(`/student/${studentId}/homework`)}>
        <ArrowLeft size={16} /> [ BACK_TO_LIST ]
      </button>

      {/* Main Container */}
      <div className="max-w-[1400px] w-full mx-auto pt-32 px-8 relative z-10 pb-20 flex gap-12 flex-col lg:flex-row">
        
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
                    onClick={() => setActiveQuestionIdx(null)}
                  >
                    <ChevronRight size={16} /> [ RETURN_TO_QUESTIONS ]
                  </button>

                  <CompoundQuestionRenderer
                    question={activeQuestion as any}
                    assignedQuestionId={activeAssignment._id}
                    onComplete={() => setActiveQuestionIdx(null)}
                    aiChatTrigger={() => setChatOpen(true)}
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
                    onClick={() => setActiveQuestionIdx(null)}
                  >
                    <ChevronRight size={16} /> [ RETURN_TO_QUESTIONS ]
                  </button>

                  <LegacyHomeworkRenderer
                    question={activeQuestion as any}
                    assignedQuestionId={activeAssignment._id}
                    onComplete={() => setActiveQuestionIdx(null)}
                    aiChatTrigger={() => setChatOpen(true)}
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
                  <h1 className="hud-title text-6xl mb-4" data-text={currentHw?.title || "TASK_LIST"}>
                    {currentHw?.title || "TASK_LIST"}
                  </h1>
                  <p className="font-mono text-[var(--color-primary)] opacity-80 text-lg uppercase tracking-widest">
                    {student.name}, {totalCount} שאלות להשלמה.
                    {isDeadlinePassed && <span className="text-[var(--color-danger)] ml-4 font-bold"> — עבר המועד!</span>}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="glass p-8 mb-12 relative overflow-hidden">
                  <div className="flex justify-between items-end mb-4">
                    <div className="label-mono text-[var(--color-primary)] text-lg">התקדמות סנכרון</div>
                    <div className="font-title text-4xl text-[var(--color-primary)]">{progress}%</div>
                  </div>
                  <div className="w-full h-3 bg-[var(--bg-inset)] relative border border-[var(--border-default)] rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 right-0 h-full bg-[var(--color-primary)] shadow-[var(--glow-primary)] transition-all duration-700 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-4 label-mono text-[var(--text-muted)]">
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
                        className={`glass p-6 border transition-all relative overflow-hidden flex flex-col gap-4 ${status !== "submitted" ? "cursor-pointer hover:border-[var(--border-strong)]" : "border-[var(--color-success)] bg-[var(--color-success-muted)]"}`}
                        onClick={() => status !== "submitted" && setActiveQuestionIdx(idx)}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        {/* Status glow bar */}
                        <div className="absolute top-0 right-0 bottom-0 w-1" style={{ 
                          backgroundColor: status === "submitted" ? 'var(--color-success)' : status === "in_progress" ? 'var(--color-warning)' : 'var(--color-primary)',
                          boxShadow: status === "submitted" ? 'var(--glow-primary)' : 'none'
                        }} />

                        <div className="flex items-center gap-6 pl-4 pr-6">
                          <div style={{ color: status === "submitted" ? 'var(--color-primary)' : status === "in_progress" ? 'var(--color-warning)' : 'var(--color-primary-light)' }}>
                            {status === "submitted" ? (
                              <CheckCircle2 size={24} />
                            ) : status === "in_progress" ? (
                              <Clock size={24} />
                            ) : (
                              <Circle size={24} />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="text-2xl font-black font-title tracking-widest text-[var(--text-primary)] mb-1">
                              שאלה {idx + 1}
                              {isCompound && <span className="ml-3 text-[var(--color-primary-light)] text-sm border border-[var(--color-primary-light)] px-2 py-0.5 rounded-sm">581</span>}
                            </div>
                            <div className="font-mono text-sm opacity-60">
                              {isCompound
                                ? `${(qData as any).sections?.length || 0} סעיפים · רמה ${(qData as any).difficulty || "?"}`
                                : qData ? (qData as any).stem?.slice(0, 60) + "..." : "שאלה"
                              }
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="label-mono px-3 py-1 bg-[rgba(255,255,255,0.05)] border border-[var(--border-default)]">
                              {aq.personalizedReason}
                            </div>
                            {status === "submitted" && aq.score !== undefined && (
                              <div
                                className="font-title text-3xl"
                                style={{ color: aq.score >= 70 ? "var(--color-primary)" : aq.score >= 40 ? "var(--color-warning)" : "#ff4b4b" }}
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
                              <span key={tag} className="label-mono text-[10px] px-2 py-1 bg-[rgba(180,255,0,0.05)] border border-[rgba(180,255,0,0.2)] text-[var(--color-primary-light)]">{tag}</span>
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
            <div className="label-mono text-[var(--color-primary)] border-b border-[var(--border-subtle)] pb-2 flex items-center gap-2">
              <Zap size={16} /> נתוני משימה
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-[var(--text-primary)]">הושלמו</span>
              <span className="text-3xl font-black text-[var(--color-primary)]">{completedCount} / {totalCount}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-[var(--text-primary)]">ציון ממוצע</span>
              <span className="text-3xl font-black" style={{ 
                color: homework.filter((q) => q.score !== undefined).length > 0
                  ? (() => {
                    const avg = homework.filter((q) => q.score !== undefined).reduce((s, q) => s + (q.score ?? 0), 0) /
                      homework.filter((q) => q.score !== undefined).length;
                    return avg >= 70 ? "var(--color-success)" : avg >= 40 ? "var(--color-warning)" : "var(--color-danger)";
                  })()
                  : "var(--text-disabled)"
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
            <div className="glass p-6 border-[var(--color-warning)] bg-[var(--color-warning-muted)]">
              <div className="label-mono text-[var(--color-warning)] mb-3">הערות המורה</div>
              <div className="font-mono text-sm leading-relaxed text-[var(--color-warning)]">{currentHw.teacherNotes}</div>
            </div>
          )}

          {/* AI Tutor CTA */}
          <div className="glass p-8 border border-[var(--color-primary)] bg-[var(--color-primary-muted)] relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-10">
              <Bot size={120} color="var(--color-primary)" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 border border-[var(--color-primary)] flex items-center justify-center bg-[var(--color-primary)] text-black">
                <Bot size={20} />
              </div>
              <div className="font-title text-3xl tracking-wider text-[var(--color-primary)]">מורה AI פאראדיי</div>
            </div>
            
            <div className="font-mono text-sm leading-relaxed text-[var(--text-primary)] opacity-80 mb-8 relative z-10">
              נתקעת? פאראדיי מחובר כעת לרשת ויכול לכוון אותך צעד-אחר-צעד, ללא חשיפת התשובה הסופית.
            </div>
            
            <button className="btn btn-primary w-full justify-center relative z-10" onClick={() => setChatOpen(true)}>
              [ INITIATE_AI_ASSIST ]
            </button>
          </div>

        </div>
      </div>

      {/* AI Chat Panel */}
      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId!}
        agentType="homework"
        questionStem={activeQuestion ? ("preamble" in activeQuestion ? (activeQuestion as any).preamble : (activeQuestion as any).stem) : undefined}
        questionId={activeAssignment?.questionId || undefined}
      />
    </div>
  );
}
