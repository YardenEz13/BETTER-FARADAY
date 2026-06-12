import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, FileText, Map as MapIcon, Clock, CheckCircle2, Circle, Zap, ChevronLeft, AlertTriangle, Bot, Edit, Lightbulb } from "lucide-react";

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
    <div className="min-h-screen bg-background text-on-background relative overflow-hidden flex flex-col font-body-md" dir="rtl">

      {/* ── Colorful Atmospheric Elements ── */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Return Link ── */}
      <button className="fixed top-6 left-6 z-40 flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-full border border-outline-variant/30 font-label-lg transition-all shadow-sm backdrop-blur-md" onClick={() => navigate(`/student/${studentId}`)}>
        <ArrowLeft size={16} /> <span className="tracking-widest">SYSTEM_RETURN</span>
      </button>

      <div className="max-w-[1200px] w-full mx-auto pt-32 px-8 relative z-10 flex flex-col gap-16 pb-20">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <h1 className="font-headline-xl text-primary drop-shadow-[0_0_15px_var(--color-primary)] mb-4 text-[4rem]">ASSIGNED_TASKS</h1>
          <div className="font-label-lg text-secondary tracking-widest uppercase mb-6 border-b border-secondary/30 pb-2 inline-block px-8">
            שיעורי הבית של {student.name}
          </div>
          <p className="font-body-lg text-on-surface-variant max-w-2xl text-center">
            כל משימות הלמידה שהוקצו לך על ידי המערכת. התחל לפתור כדי לסנכרן נתונים למאגר.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-start w-full">
          
          {/* Main List */}
          <div className="flex-1 w-full flex flex-col gap-6">
            {!homeworkList || homeworkList.length === 0 ? (
              <div className="bg-surface-container rounded-2xl p-12 text-center flex flex-col items-center justify-center border border-outline-variant/30 shadow-sm">
                <FileText size={64} className="text-outline mb-6" />
                <div className="font-headline-lg text-on-surface-variant tracking-widest">NO_TASKS</div>
                <div className="font-label-md mt-4 text-on-surface-variant opacity-70">המערכת לא איתרה משימות פתוחות.</div>
              </div>
            ) : (
              homeworkList.map((hw, idx) => {
                const isExpired = Date.now() > hw.deadline;
                const isGraded = hw.status === "graded";
                const isClosed = hw.status === "closed";
                const daysLeft = Math.max(0, Math.ceil((hw.deadline - Date.now()) / (1000 * 60 * 60 * 24)));

                const colorVariant = isGraded ? 'secondary' : isClosed ? 'error' : isExpired ? 'error' : 'primary';

                return (
                  <motion.div
                    key={hw._id}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`bg-surface-container rounded-2xl p-6 cursor-pointer border border-outline-variant hover:border-${colorVariant}/50 hover:bg-${colorVariant}/5 transition-all flex flex-col gap-4 relative overflow-hidden shadow-sm group hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)]`}
                    onClick={() => navigate(`/student/${studentId}/homework/${hw._id}`)}
                  >
                    {/* Glowing side bar for status */}
                    <div className={`absolute top-0 right-0 bottom-0 w-2 bg-${colorVariant} shadow-[0_0_15px_var(--color-${colorVariant})] opacity-80 group-hover:opacity-100 transition-opacity`} />

                    <div className="flex justify-between items-start pl-8 pr-6">
                      <div>
                        <div className="font-headline-lg text-on-surface mb-3 group-hover:text-primary transition-colors">{hw.title}</div>
                        <div className="flex gap-6">
                          <span className="font-label-md flex items-center gap-2 text-on-surface-variant">
                            <Zap size={16} className={`text-${colorVariant}`} /> {hw.questionCount} שאלות
                          </span>
                          <span className={`font-label-md flex items-center gap-2 ${isExpired && !isGraded ? 'text-error' : 'text-on-surface-variant'}`}>
                            <Clock size={16} />
                            {isExpired ? 'עבר המועד' : `נשארו ${daysLeft} ימים`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {isExpired && !isGraded && (
                          <span className="font-label-md px-4 py-1.5 rounded-full border border-error text-error bg-error/10 flex items-center gap-2 shadow-[0_0_10px_var(--color-error)]">
                            <AlertTriangle size={14} /> באיחור
                          </span>
                        )}
                        {isGraded && (
                          <span className="font-label-md px-4 py-1.5 rounded-full border border-secondary text-secondary bg-secondary/10 flex items-center gap-2 shadow-[0_0_10px_var(--color-secondary)]">
                            <CheckCircle2 size={14} /> הושלם
                          </span>
                        )}
                        {!isExpired && !isGraded && !isClosed && (
                          <span className="font-label-md px-4 py-1.5 rounded-full border border-primary text-primary bg-primary/10 shadow-[0_0_10px_var(--color-primary)]">
                            פתוח
                          </span>
                        )}
                      </div>
                    </div>

                    {hw.teacherNotes && (
                      <div className="mt-4 p-4 rounded-xl bg-surface border border-outline-variant/50 font-body-sm text-on-surface-variant flex gap-3 items-start pr-4 mx-6">
                        <Edit className="text-primary  text-sm" /> 
                        {hw.teacherNotes}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Right Panel / Stats */}
          <div className="w-full lg:w-[350px] flex flex-col gap-6">
            <div className="bg-primary-container/10 rounded-2xl p-8 border border-primary/30 flex flex-col gap-6 shadow-[0_0_20px_var(--color-primary-container)]">
              <div className="font-label-lg text-primary border-b border-primary/30 pb-3 flex items-center gap-2">
                <Zap size={18} /> סטטוס משימות
              </div>

              <div className="flex justify-between items-center">
                <span className="font-headline-sm text-on-surface">פתוחות</span>
                <span className="font-headline-xl text-primary drop-shadow-[0_0_10px_var(--color-primary)]">
                  {homeworkList?.filter((h) => h.status === "active").length ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-headline-sm text-on-surface">הושלמו</span>
                <span className="font-headline-xl text-secondary drop-shadow-[0_0_10px_var(--color-secondary)]">
                  {homeworkList?.filter((h) => h.status === "graded").length ?? 0}
                </span>
              </div>
            </div>

            <div className="bg-tertiary-container/10 rounded-2xl p-8 border border-tertiary/30 relative overflow-hidden shadow-sm">
              <div className="absolute -top-4 -right-4 opacity-10">
                <Bot size={120} className="text-tertiary" />
              </div>
              <div className="font-label-lg text-tertiary mb-4 flex items-center gap-2">
                <Lightbulb className="" />
                טיפ מערכת
              </div>
              <p className="font-body-md leading-relaxed text-on-surface-variant">
                התחילו מהסעיף הראשון בכל שאלה. האלגוריתם מנתח את הפתרון שלכם ולומד את דרך החשיבה שלכם שלב אחר שלב.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

