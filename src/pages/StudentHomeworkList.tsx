import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, FileText, Clock, CheckCircle as CheckCircle2,
  Zap, AlertTriangle, Edit, Scissors, ChevronLeft,
} from "../components/electric";
import { ThemeToggle } from "../components/ThemeContext";
import { ElectricBolt, ElectricAtom, Lightbulb as ElectricBulb } from "../components/electric";

export default function StudentHomeworkList() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const homeworkList = useQuery(
    api.homework.getHomeworkForClassroom,
    student?.classroomId ? { classroomId: student.classroomId } : "skip"
  );
  const pdfAssignments = useQuery(
    api.pdfAssignments.listForStudent,
    studentId ? { studentId: studentId as Id<"students"> } : "skip"
  );

  if (!student) return null;

  const activeCount = homeworkList?.filter((h) => h.status === "active").length ?? 0;
  const gradedCount = homeworkList?.filter((h) => h.status === "graded").length ?? 0;

  return (
    <div
      className="min-h-screen bg-background text-on-background flex flex-col"
      style={{ fontFamily: "'Assistant', sans-serif" }}
      dir="rtl"
    >
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 bg-surface border-b-2 border-outline px-4 md:px-8 py-4 flex items-center justify-between"
        style={{ boxShadow: 'var(--shadow-clay)' }}
      >
        <div className="flex items-center gap-3">
          <button
            className="w-9 h-9 rounded-full border-2 border-outline bg-surface flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all"
            style={{ boxShadow: 'var(--shadow-clay)' }}
            onClick={() => navigate(`/student/${studentId}`)}
            aria-label="חזרה"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-on-surface leading-tight">שיעורי הבית</h1>
            <p className="text-xs text-on-surface-variant">{student.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Assignment count badge */}
          {homeworkList && homeworkList.length > 0 && (
            <div
              className="flex items-center gap-2 px-4 py-2 bg-surface rounded-full border-2 border-outline text-sm font-semibold text-on-surface"
              style={{ boxShadow: 'var(--shadow-clay)' }}
            >
              <BookOpen size={15} className="text-primary" />
              {homeworkList.length} משימות
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-8 py-8 flex flex-col lg:flex-row gap-8 flex-1">

        {/* ── Main List ── */}
        <div className={`flex-1 w-full flex flex-col gap-4 ${(!homeworkList || homeworkList.length === 0) && (!pdfAssignments || pdfAssignments.length === 0) ? 'justify-center' : ''}`}>

          {/* Personal PDF assignments */}
          {pdfAssignments && pdfAssignments.length > 0 && pdfAssignments.map((a, idx) => {
            const done = a.answeredCount >= a.partCount && a.partCount > 0;
            const isExpired = a.deadline ? Date.now() > a.deadline : false;
            const daysLeft = a.deadline ? Math.max(0, Math.ceil((a.deadline - Date.now()) / (1000 * 60 * 60 * 24))) : null;
            const pct = a.partCount > 0 ? Math.round((a.answeredCount / a.partCount) * 100) : 0;
            return (
              <motion.div
                key={a._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="bg-surface rounded-2xl border-2 overflow-hidden cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ borderColor: done ? 'var(--color-primary)' : 'var(--color-secondary)', boxShadow: 'var(--shadow-clay)' }}
                onClick={() => navigate(`/student/${studentId}/pdf/${a._id}`)}
              >
                <div className="flex">
                  <div className={`w-1.5 flex-shrink-0 ${done ? 'bg-primary' : 'bg-secondary'}`} />
                  <div className="flex-1 p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center flex-shrink-0">
                          <Scissors size={18} className="text-secondary" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-base text-on-surface group-hover:text-primary transition-colors truncate">{a.title}</div>
                          <div className="flex gap-4 mt-1.5 flex-wrap">
                            <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                              <FileText size={13} className="text-secondary" /> {a.questionCount} שאלות{a.partCount > a.questionCount ? ` · ${a.partCount} סעיפים` : ""}
                            </span>
                            {daysLeft !== null && (
                              <span className={`text-xs flex items-center gap-1.5 ${isExpired && !done ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                                <Clock size={13} /> {isExpired ? 'עבר המועד' : `נשארו ${daysLeft} ימים`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {done ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container border-2 border-primary">
                            <CheckCircle2 size={13} /> הושלם
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container border-2 border-secondary">
                            המשך <ChevronLeft size={13} />
                          </span>
                        )}
                      </div>
                    </div>
                    {/* progress bar */}
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-container-high">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: done ? 'var(--color-primary)' : 'var(--color-secondary)' }} />
                      </div>
                      <span className="num text-xs font-bold text-on-surface-variant">{a.answeredCount}/{a.partCount}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Empty state */}
          {(!homeworkList || homeworkList.length === 0) && (!pdfAssignments || pdfAssignments.length === 0) ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface rounded-3xl p-16 flex flex-col items-center justify-center border-2 border-outline text-center"
              style={{ boxShadow: 'var(--shadow-clay)' }}
            >
              <div className="w-20 h-20 rounded-3xl bg-surface-container-high flex items-center justify-center mb-6 border-2 border-outline">
                <FileText size={36} className="text-on-surface-variant" />
              </div>
              <div className="font-bold text-xl text-on-surface mb-2">הכל נקי כאן 🎉</div>
              <div className="text-on-surface-variant text-sm max-w-[20rem]">
                אין משימות פתוחות כרגע. ברגע שהמורה ישלח אחת — היא תופיע כאן.
              </div>
            </motion.div>
          ) : (
            (homeworkList ?? []).map((hw, idx) => {
              const isExpired = Date.now() > hw.deadline;
              const isGraded = hw.status === "graded";
              const isClosed = hw.status === "closed";
              const daysLeft = Math.max(0, Math.ceil((hw.deadline - Date.now()) / (1000 * 60 * 60 * 24)));

              // Explicit conditional classes — no dynamic interpolation
              const stripColor = isGraded
                ? 'bg-primary'
                : (isClosed || isExpired)
                  ? 'bg-error'
                  : 'bg-tertiary';

              const cardBorderColor = isGraded
                ? 'var(--color-primary)'
                : (isClosed || isExpired)
                  ? 'var(--color-error)'
                  : 'var(--color-outline)';

              return (
                <motion.div
                  key={hw._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="bg-surface rounded-2xl border-2 overflow-hidden cursor-pointer group transition-all hover:-translate-y-0.5"
                  style={{ borderColor: cardBorderColor, boxShadow: 'var(--shadow-clay)' }}
                  onClick={() => navigate(`/student/${studentId}/homework/${hw._id}`)}
                >
                  <div className="flex">
                    {/* Right-side color strip (RTL) */}
                    <div className={`w-1.5 flex-shrink-0 ${stripColor}`} />

                    <div className="flex-1 p-5 flex flex-col gap-3">
                      {/* Title + badges row */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                            {hw.title}
                          </div>
                          {/* Meta row */}
                          <div className="flex gap-4 mt-1.5">
                            <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                              <Zap size={13} className={
                                isGraded ? 'text-primary'
                                : (isClosed || isExpired) ? 'text-error'
                                : 'text-tertiary'
                              } />
                              {hw.questionCount} שאלות
                            </span>
                            <span className={`text-xs flex items-center gap-1.5 ${isExpired && !isGraded ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                              <Clock size={13} />
                              {isExpired ? 'עבר המועד' : `נשארו ${daysLeft} ימים`}
                            </span>
                          </div>
                        </div>

                        {/* Status badge — explicit, no dynamic classes */}
                        <div className="flex-shrink-0">
                          {isGraded && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container border-2 border-primary">
                              <CheckCircle2 size={13} /> הושלם
                            </span>
                          )}
                          {(isClosed || (isExpired && !isGraded)) && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-error-container text-on-error-container border-2 border-error">
                              <AlertTriangle size={13} /> באיחור
                            </span>
                          )}
                          {!isExpired && !isGraded && !isClosed && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container border-2 border-tertiary">
                              פתוח
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Teacher notes */}
                      {hw.teacherNotes && (
                        <div className="mt-1 p-3 rounded-xl bg-surface-container border-2 border-outline flex gap-2.5 items-start text-sm text-on-surface-variant">
                          <Edit size={15} className="text-primary flex-shrink-0 mt-0.5" />
                          {hw.teacherNotes}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <div className="w-full lg:w-[300px] flex-shrink-0 flex flex-col gap-5">

          {/* Task status card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface rounded-2xl p-6 border-2 border-outline"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            <div className="font-bold text-on-surface mb-5 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center">
                <ElectricBolt size={18} tone="spark" glow={0.5} animated={false} />
              </div>
              סטטוס משימות
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">פתוחות</span>
                <span className="num font-bold text-2xl text-tertiary">{activeCount}</span>
              </div>
              <div className="h-px bg-outline" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">הושלמו</span>
                <span className="num font-bold text-2xl text-primary">{gradedCount}</span>
              </div>
            </div>
          </motion.div>

          {/* AI tip card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-surface rounded-2xl p-6 border-2 border-outline relative overflow-hidden"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            {/* Decorative Bot watermark */}
            <div className="absolute -bottom-4 -left-4 opacity-[0.06]">
              <ElectricAtom size={100} tone="amber" glow={1} animated={false} />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-tertiary-container flex items-center justify-center">
                  <ElectricBulb size={18} tone="amber" glow={0.5} />
                </div>
                <span className="font-bold text-sm text-tertiary">טיפ מהמערכת</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                התחילו מהסעיף הראשון בכל שאלה. האלגוריתם מנתח את הפתרון שלכם ולומד את דרך החשיבה שלכם שלב אחר שלב.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

