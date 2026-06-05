import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, FileText, Map as MapIcon,
  Clock, CheckCircle2, Circle, Zap, ChevronLeft, AlertTriangle, Bot
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
    <div className="min-h-screen bg-[var(--bg-deep)] text-white relative overflow-hidden flex flex-col">
      {/* ── Return Link ── */}
      <button className="fixed top-6 left-6 z-40 cyber-btn cyber-btn-ghost" onClick={() => navigate(`/student/${studentId}`)}>
        <ArrowLeft size={16} /> [ SYSTEM_RETURN ]
      </button>

      <div className="max-w-[1200px] w-full mx-auto pt-32 px-8 relative z-10 flex flex-col gap-16 pb-20">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <h1 className="hud-title text-6xl mb-4" data-text="ASSIGNED_TASKS">ASSIGNED_TASKS</h1>
          <div className="t-mono-label text-[var(--acid-green)] tracking-widest uppercase mb-6 border-b border-[var(--acid-green)] pb-2 inline-block">
            שיעורי הבית של {student.name}
          </div>
          <p className="font-mono text-lg text-white opacity-60 max-w-2xl text-center">
            כל משימות הלמידה שהוקצו לך על ידי המערכת. התחל לפתור כדי לסנכרן נתונים למאגר.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-start w-full">
          
          {/* Main List */}
          <div className="flex-1 w-full flex flex-col gap-6">
            {!homeworkList || homeworkList.length === 0 ? (
              <div className="shard p-12 text-center flex flex-col items-center justify-center bg-[rgba(0,0,0,0.4)] border-[#1a3324]">
                <FileText size={64} className="text-[#1a3324] mb-6" />
                <div className="hud-title text-4xl text-[#1a3324]" data-text="NO_TASKS">NO_TASKS</div>
                <div className="t-mono-label mt-4 opacity-50">המערכת לא איתרה משימות פתוחות.</div>
              </div>
            ) : (
              homeworkList.map((hw, idx) => {
                const isExpired = Date.now() > hw.deadline;
                const isGraded = hw.status === "graded";
                const isClosed = hw.status === "closed";
                const daysLeft = Math.max(0, Math.ceil((hw.deadline - Date.now()) / (1000 * 60 * 60 * 24)));

                return (
                  <motion.div
                    key={hw._id}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="shard p-6 cursor-pointer border border-[#1a3324] bg-[rgba(0,0,0,0.6)] hover:border-[var(--neon-emerald)] hover:bg-[rgba(0,255,136,0.05)] transition-all flex flex-col gap-4 relative overflow-hidden"
                    onClick={() => navigate(`/student/${studentId}/homework/${hw._id}`)}
                  >
                    {/* Glowing side bar for status */}
                    <div className="absolute top-0 right-0 bottom-0 w-1" style={{ 
                      backgroundColor: isGraded ? 'var(--neon-emerald)' : isClosed ? 'var(--warning-amber)' : 'var(--acid-green)',
                      boxShadow: isGraded ? 'var(--glow-emerald)' : isClosed ? 'none' : 'var(--glow-acid)'
                    }} />

                    <div className="flex justify-between items-start pl-8 pr-4">
                      <div>
                        <div className="text-2xl font-black font-title tracking-wider text-white mb-2">{hw.title}</div>
                        <div className="flex gap-4">
                          <span className="t-mono-label flex items-center gap-2 opacity-80">
                            <Zap size={14} /> {hw.questionCount} שאלות
                          </span>
                          <span className="t-mono-label flex items-center gap-2 opacity-80" style={{ color: isExpired ? '#ff4b4b' : 'inherit' }}>
                            <Clock size={14} />
                            {isExpired ? 'עבר המועד' : `נשארו ${daysLeft} ימים`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {isExpired && !isGraded && (
                          <span className="t-mono-label px-3 py-1 border border-[#ff4b4b] text-[#ff4b4b] bg-[rgba(255,75,75,0.05)] flex items-center gap-2">
                            <AlertTriangle size={12} /> באיחור
                          </span>
                        )}
                        {isGraded && (
                          <span className="t-mono-label px-3 py-1 border border-[var(--neon-emerald)] text-[var(--neon-emerald)] bg-[rgba(0,255,136,0.05)] flex items-center gap-2">
                            <CheckCircle2 size={12} /> הושלם
                          </span>
                        )}
                        {!isExpired && !isGraded && !isClosed && (
                          <span className="t-mono-label px-3 py-1 border border-[var(--acid-green)] text-[var(--acid-green)] bg-[rgba(180,255,0,0.05)]">
                            פתוח
                          </span>
                        )}
                      </div>
                    </div>

                    {hw.teacherNotes && (
                      <div className="mt-2 p-4 bg-[rgba(0,0,0,0.5)] border border-[#1a3324] font-mono text-sm opacity-80 flex gap-3 items-start pr-4">
                        <span className="text-[var(--neon-emerald)]">📝</span> {hw.teacherNotes}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Right Panel / Stats */}
          <div className="w-full lg:w-[350px] flex flex-col gap-6">
            <div className="shard p-8 border border-[var(--laser-cyan)] bg-[rgba(0,240,255,0.02)] flex flex-col gap-6">
              <div className="t-mono-label text-[var(--laser-cyan)] border-b border-[var(--laser-cyan)] pb-2 flex items-center gap-2">
                <Zap size={16} /> סטטוס משימות
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-white">פתוחות</span>
                <span className="text-3xl font-black text-[var(--acid-green)]">
                  {homeworkList?.filter((h) => h.status === "active").length ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">הושלמו</span>
                <span className="text-3xl font-black text-[var(--neon-emerald)]">
                  {homeworkList?.filter((h) => h.status === "graded").length ?? 0}
                </span>
              </div>
            </div>

            <div className="shard p-8 border border-[#1a3324] bg-[rgba(0,255,136,0.05)] relative overflow-hidden">
              <div className="absolute -top-4 -right-4 opacity-10">
                <Bot size={100} color="var(--neon-emerald)" />
              </div>
              <div className="t-mono-label text-[var(--neon-emerald)] mb-4">טיפ מערכת 💡</div>
              <p className="font-mono text-sm leading-relaxed text-white opacity-80">
                התחילו מהסעיף הראשון בכל שאלה. האלגוריתם מנתח את הפתרון שלכם ולומד את דרך החשיבה שלכם שלב אחר שלב.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
