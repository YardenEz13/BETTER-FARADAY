import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BookOpen, FileText, Map as MapIcon,
  Clock, CheckCircle2, Circle, Bot, Zap, ChevronRight
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
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="app-sidebar">
        <div className="app-brand">
          <span>FARADAY</span> Logic
        </div>
        <button className="new-proof-btn" onClick={() => navigate(`/student/${studentId}`)}>
          <ArrowLeft size={16} /> חזרה לדף הבית
        </button>
        <div className="flex-col" style={{ gap: 4, flex: 1 }}>
          <button className="nav-item" onClick={() => navigate(`/student/${studentId}`)}>
            <MapIcon size={18} /> מפת למידה
          </button>
          <button className="nav-item">
            <BookOpen size={18} /> תרגול
          </button>
          <button className="nav-item active">
            <FileText size={18} /> שיעורי בית
          </button>
        </div>
        <div className="flex-col" style={{ gap: 4, marginTop: "auto" }}>
          <button className="nav-item" onClick={() => navigate("/")}>
            <ArrowLeft size={18} /> התנתקות
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="app-content-wrapper">
        <header className="app-topbar">
          <div className="topbar-links">
            <div className="topbar-link active">שיעורי בית</div>
          </div>
          <div className="topbar-actions">
            <div className="avatar" style={{ width: 28, height: 28, background: student.avatarColor, fontSize: "0.8rem" }}>
              {student.name.slice(0, 1)}
            </div>
          </div>
        </header>

        <div className="app-main">
          {/* ── Center: Question or List ── */}
          <div className="app-center">
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
                      className="power-map-back mb-6"
                      onClick={() => setActiveQuestionIdx(null)}
                    >
                      <ChevronRight size={16} /> חזרה לרשימה
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
                      className="power-map-back mb-6"
                      onClick={() => setActiveQuestionIdx(null)}
                    >
                      <ChevronRight size={16} /> חזרה לרשימה
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
                  <div className="mb-10">
                    <div className="t-mini-title" style={{ color: "var(--primary-dim)", marginBottom: 8 }}>
                      שיעורי בית
                    </div>
                    <h1 className="t-h1">{currentHw?.title || "שיעורי בית"}</h1>
                    <p className="t-sub">
                      {student.name}, יש לך {totalCount} שאלות להשלמה.
                      {isDeadlinePassed && (
                        <span style={{ color: "var(--danger)", fontWeight: 700 }}> — עבר המועד!</span>
                      )}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="card p-5 mb-8">
                    <div className="flex justify-between items-center mb-3">
                      <div className="t-mini-title mb-0">התקדמות</div>
                      <div className="fw-800" style={{ color: "var(--primary-dim)" }}>{progress}%</div>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                      <div
                        style={{
                          width: `${progress}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, var(--primary), var(--primary-dim))",
                          borderRadius: "var(--r-sm)",
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-faint">
                      <span>{completedCount} מתוך {totalCount} הושלמו</span>
                      {currentHw && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          מועד: {new Date(currentHw.deadline).toLocaleDateString("he-IL", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question cards */}
                  <motion.div
                    className="flex-col gap-4"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
                    }}
                  >
                    {homework.map((aq, idx) => {
                      const qData = aq.questionData;
                      const isCompound = qData && "sections" in qData;
                      const status = aq.status;

                      return (
                        <motion.div
                          key={aq._id}
                          className={`hw-question-card ${status}`}
                          onClick={() => status !== "submitted" && setActiveQuestionIdx(idx)}
                          variants={{
                            hidden: { opacity: 0, x: -20 },
                            visible: { opacity: 1, x: 0 },
                          }}
                          whileHover={status !== "submitted" ? { scale: 1.01, y: -2 } : {}}
                          style={{ cursor: status !== "submitted" ? "pointer" : "default" }}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`hw-status-icon ${status}`}>
                              {status === "submitted" ? (
                                <CheckCircle2 size={20} />
                              ) : status === "in_progress" ? (
                                <Clock size={20} />
                              ) : (
                                <Circle size={20} />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="fw-800" style={{ fontSize: "1rem", marginBottom: 4 }}>
                                שאלה {idx + 1}
                                {isCompound && (
                                  <span className="cq-badge-581">581</span>
                                )}
                              </div>
                              <div className="text-sm text-muted">
                                {isCompound
                                  ? `${(qData as any).sections?.length || 0} סעיפים · רמה ${(qData as any).difficulty || "?"}`
                                  : qData ? (qData as any).stem?.slice(0, 60) + "..." : "שאלה"
                                }
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="context-chip" style={{ fontSize: "0.7rem" }}>
                                {aq.personalizedReason}
                              </div>
                              {status === "submitted" && aq.score !== undefined && (
                                <div
                                  className="fw-900 font-title"
                                  style={{
                                    fontSize: "1.3rem",
                                    color: aq.score >= 70 ? "var(--success)" : aq.score >= 40 ? "var(--warning)" : "var(--danger)",
                                  }}
                                >
                                  {aq.score}%
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Tags for compound */}
                          {isCompound && (
                            <div className="flex gap-2 mt-2" style={{ paddingRight: 52 }}>
                              {((qData as any).tags || []).slice(0, 3).map((tag: string) => (
                                <span key={tag} className="cq-skill-tag">{tag}</span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right Panel ── */}
          <div className="app-right-panel" style={{ padding: "24px 20px" }}>
            <div className="t-mini-title mb-4 text-default flex items-center gap-2">
              <Zap size={16} color="var(--primary-dim)" /> סטטיסטיקות
            </div>

            <div className="card p-4 mb-4">
              <div className="stat-label">שאלות שהושלמו</div>
              <div className="stat-value text-primary">{completedCount}/{totalCount}</div>
            </div>

            <div className="card p-4 mb-4">
              <div className="stat-label">ציון ממוצע</div>
              <div className="stat-value" style={{
                color: homework.filter((q) => q.score !== undefined).length > 0
                  ? (() => {
                    const avg = homework.filter((q) => q.score !== undefined).reduce((s, q) => s + (q.score ?? 0), 0) /
                      homework.filter((q) => q.score !== undefined).length;
                    return avg >= 70 ? "var(--success)" : avg >= 40 ? "var(--warning)" : "var(--danger)";
                  })()
                  : "var(--text-faint)"
              }}>
                {homework.filter((q) => q.score !== undefined).length > 0
                  ? Math.round(homework.filter((q) => q.score !== undefined).reduce((s, q) => s + (q.score ?? 0), 0) /
                    homework.filter((q) => q.score !== undefined).length) + "%"
                  : "—"
                }
              </div>
            </div>

            {currentHw?.teacherNotes && (
              <div className="card p-4 mb-4">
                <div className="stat-label">הערות המורה</div>
                <div className="text-sm text-muted lh-relaxed">{currentHw.teacherNotes}</div>
              </div>
            )}

            {/* AI Tutor CTA */}
            <div className="card p-5" style={{ background: "linear-gradient(135deg, rgba(129, 140, 248, 0.15), rgba(192, 132, 252, 0.1))", borderColor: "rgba(129, 140, 248, 0.3)" }}>
              <div className="flex items-center gap-3 mb-3">
                <Bot size={24} color="var(--primary)" />
                <div className="fw-800">מורה AI פאראדיי</div>
              </div>
              <div className="text-sm text-muted mb-4">
                נתקעת? פאראדיי יכוון אותך צעד-אחר-צעד בלי לחשוף את התשובה.
              </div>
              <button className="btn btn-primary btn-full" onClick={() => setChatOpen(true)}>
                <Bot size={16} /> פתח צ׳אט
              </button>
            </div>
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
