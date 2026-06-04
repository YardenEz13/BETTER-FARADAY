import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
// No useState used
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, FileText, Map as MapIcon,
  Clock, CheckCircle2, Circle, Zap, ChevronLeft, AlertTriangle
} from "lucide-react";

export default function StudentHomeworkList() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const homeworkList = useQuery(
    api.homework.getHomeworkForClassroom,
    student?.classroomId ? { classroomId: student.classroomId } : "skip"
  );

  if (!student) return null;

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

      {/* ── Main ── */}
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
          <div className="app-center">
            <div className="mb-10">
              <div className="t-mini-title" style={{ color: "var(--primary-dim)", marginBottom: 8 }}>
                שלום {student.name} 👋
              </div>
              <h1 className="t-h1">שיעורי הבית שלך</h1>
              <p className="t-sub">
                כל שיעורי הבית שקיבלת מהמורה מופיעים כאן. לחצו על שיעור כדי להתחיל לפתור.
              </p>
            </div>

            <motion.div
              className="flex-col gap-4"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
              }}
            >
              {!homeworkList || homeworkList.length === 0 ? (
                <div className="card p-10 text-center">
                  <FileText size={48} color="var(--text-faint)" style={{ margin: "0 auto 16px" }} />
                  <div className="fw-700 text-lg mb-2">אין שיעורי בית כרגע</div>
                  <div className="t-sub">המורה טרם הקצה שיעורי בית. חזרו מאוחר יותר!</div>
                </div>
              ) : (
                homeworkList.map((hw) => {
                  const isExpired = Date.now() > hw.deadline;
                  const isGraded = hw.status === "graded";
                  const isClosed = hw.status === "closed";
                  const daysLeft = Math.max(0, Math.ceil((hw.deadline - Date.now()) / (1000 * 60 * 60 * 24)));

                  return (
                    <motion.div
                      key={hw._id}
                      className="hw-question-card"
                      onClick={() => navigate(`/student/${studentId}/homework/${hw._id}`)}
                      variants={{
                        hidden: { opacity: 0, x: -20 },
                        visible: { opacity: 1, x: 0 },
                      }}
                      whileHover={{ scale: 1.01, y: -2 }}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`hw-status-icon ${isGraded ? "submitted" : isClosed ? "in_progress" : "pending"}`}>
                          {isGraded ? (
                            <CheckCircle2 size={22} />
                          ) : isClosed ? (
                            <Clock size={22} />
                          ) : (
                            <Circle size={22} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="fw-800" style={{ fontSize: "1.1rem", marginBottom: 4 }}>
                            {hw.title}
                          </div>
                          <div className="text-sm text-muted flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Zap size={14} color="var(--primary-dim)" /> {hw.questionCount} שאלות
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {isExpired ? (
                                <span style={{ color: "var(--danger)" }}>עבר המועד</span>
                              ) : (
                                `נשארו ${daysLeft} ימים`
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isExpired && !isGraded && (
                            <span className="badge badge-danger">
                              <AlertTriangle size={12} /> באיחור
                            </span>
                          )}
                          {isGraded && (
                            <span className="badge badge-success">
                              <CheckCircle2 size={12} /> הוערך
                            </span>
                          )}
                          {!isExpired && !isGraded && !isClosed && (
                            <span className="badge badge-primary">פתוח</span>
                          )}
                          <ChevronLeft size={18} color="var(--text-muted)" />
                        </div>
                      </div>

                      {hw.teacherNotes && (
                        <div className="text-sm text-muted mt-3" style={{ paddingRight: 56 }}>
                          📝 {hw.teacherNotes}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          </div>

          {/* Right panel: Quick stats */}
          <div className="app-right-panel" style={{ padding: "24px 20px" }}>
            <div className="t-mini-title mb-4 text-default flex items-center gap-2">
              <Zap size={16} color="var(--primary-dim)" /> סיכום מהיר
            </div>

            <div className="card p-4 mb-4">
              <div className="stat-label">שיעורי בית פתוחים</div>
              <div className="stat-value text-primary">
                {homeworkList?.filter((h) => h.status === "active").length ?? 0}
              </div>
            </div>

            <div className="card p-4 mb-4">
              <div className="stat-label">שיעורי בית שהושלמו</div>
              <div className="stat-value text-success">
                {homeworkList?.filter((h) => h.status === "graded").length ?? 0}
              </div>
            </div>

            <div className="card p-4" style={{ background: "var(--primary-dim)", color: "#000" }}>
              <div className="t-mini-title" style={{ color: "rgba(0,0,0,0.5)" }}>טיפ יומי 💡</div>
              <div style={{ fontWeight: 800, lineHeight: 1.4 }}>
                התחילו מהסעיף הראשון. כל סעיף בנוי על הקודם — אל תדלגו!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
