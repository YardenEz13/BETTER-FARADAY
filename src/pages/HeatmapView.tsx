import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { CheckCircle2, TrendingUp, XCircle, AlertTriangle, ChevronRight, Clock, Users, Target, Flag, LineChart, Grid, Radio, History } from "lucide-react";
import CyberAvatar from "../components/CyberAvatar";

export function HeatmapView({
  heatmap,
  counts,
  classroom,
  dashboardStats,
  liveAlerts,
  onStudentClick,
}: {
  heatmap: any[];
  counts: { green: number; yellow: number; red: number };
  classroom: any;
  dashboardStats: any;
  liveAlerts: any;
  onStudentClick: (id: Id<"students">) => void;
}) {
  const pendingLevels = useQuery(api.levels.getPendingSuggestions, classroom ? { classroomId: classroom._id } : "skip");
  const resolveLevel  = useMutation(api.levels.resolveSuggestion);

  const total = heatmap.length || 1;
  const masteryPercentage = Math.round((counts.green / total) * 100) || 0;

  return (
    <div className="flex flex-col gap-6 min-h-full font-body-md" dir="rtl">
      
      {/* Top Metrics Bento (From Stitch Design) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="glass rounded-xl p-6 flex flex-col justify-between h-40 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
          <div className="relative z-10 flex justify-between items-start">
            <h3 className="font-headline-sm text-on-surface">תלמידים פעילים</h3>
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/50">
              <Users className="text-primary" />
            </div>
          </div>
          <div className="relative z-10 flex items-end gap-3">
            <span className="font-headline-xl text-primary leading-none">{total}</span>
            <span className="font-body-sm text-on-surface-variant mb-1">/ {total} רשומים</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass rounded-xl p-6 flex flex-col justify-between h-40 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
          <div className="relative z-10 flex justify-between items-start">
            <h3 className="font-headline-sm text-on-surface">שליטה כיתתית</h3>
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/50">
              <LineChart className="text-primary" />
            </div>
          </div>
          <div className="relative z-10 flex items-end gap-3">
            <span className="font-headline-xl text-on-surface leading-none">{masteryPercentage}%</span>
            <span className="font-body-sm text-primary flex items-center mb-1 bg-primary/10 px-2 py-0.5 rounded-full">
              <TrendingUp className="text-[16px] mr-1" />
              +2% השבוע
            </span>
          </div>
        </div>

        {/* Metric 3 (Next Goal) */}
        <div className="glass rounded-xl p-6 flex flex-col justify-between h-40 relative overflow-hidden group border-tertiary/30 hover:border-tertiary transition-all">
          <div className="absolute inset-0 bg-tertiary/10 group-hover:bg-tertiary/20 transition-colors" />
          <div className="relative z-10 flex justify-between items-start">
            <h3 className="font-headline-sm text-tertiary">יעד קרוב</h3>
            <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border border-tertiary/30">
              <Flag className="text-tertiary" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="font-headline-md text-on-surface leading-tight">מבחן מסכם באלגברה</p>
            <p className="font-body-sm text-on-surface-variant mt-1">בעוד 4 ימים</p>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Heatmap Visualization (Spans 8 cols) */}
        <div className="lg:col-span-8 glass rounded-xl p-6 flex flex-col shadow-lg">
          <div className="flex justify-between items-center mb-6 border-b border-outline-variant/30 pb-4">
            <h2 className="font-headline-md text-on-surface flex items-center gap-3">
              <Grid className="text-secondary" />
              מפת חום - שליטה נושאית
            </h2>
            <div className="flex gap-4">
              <LegendChip count={counts.green} label="שולטים" colorClass="bg-primary shadow-[0_0_15px_var(--color-primary)]" textClass="text-primary" />
              <LegendChip count={counts.yellow} label="מתקשים" colorClass="bg-tertiary shadow-[0_0_15px_var(--color-tertiary)]" textClass="text-tertiary" />
              <LegendChip count={counts.red} label="בסיכון" colorClass="bg-error shadow-[0_0_15px_var(--color-error)]" textClass="text-error" />
            </div>
          </div>

          {/* Student cards grid */}
          <motion.div
            className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pr-2"
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
          >
            {heatmap.map(({ student, status, currentTopicName, isStuck, recentAttempts }) => {
              const filled   = recentAttempts ? recentAttempts.filter((a: any) => a.isCorrect).length : 0;
              const totalAttempts = recentAttempts ? recentAttempts.length : 0;
              const attempts = recentAttempts ? [...recentAttempts].reverse() : [];

              // High-color mapping based on Stitch
              const colorMap = {
                green:  { 
                  main: 'text-primary border-primary/40', 
                  bg: 'bg-primary/10 hover:bg-primary/20', 
                  bar: 'bg-primary', 
                  glow: 'shadow-[0_0_20px_var(--color-primary)]' 
                },
                yellow: { 
                  main: 'text-tertiary border-tertiary/40', 
                  bg: 'bg-tertiary/10 hover:bg-tertiary/20', 
                  bar: 'bg-tertiary', 
                  glow: 'shadow-[0_0_20px_var(--color-tertiary)]' 
                },
                red:    { 
                  main: 'text-error border-error/40', 
                  bg: 'bg-error/10 hover:bg-error/20', 
                  bar: 'bg-error', 
                  glow: 'shadow-[0_0_20px_var(--color-error)]' 
                },
              };
              
              const c = colorMap[status as keyof typeof colorMap] ?? colorMap.green;
              const labelMap = { green: 'שולט', yellow: 'מתקשה', red: 'בסיכון' };
              const accuracy = totalAttempts > 0 ? Math.round((filled / totalAttempts) * 100) : null;

              return (
                <motion.div
                  key={student._id}
                  className={`relative overflow-hidden cursor-pointer group ${c.bg} border ${c.main.split(' ')[1]} rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:${c.glow}`}
                  onClick={() => onStudentClick(student._id)}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                >
                  {/* Status indicator strip (top) */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${c.bar} opacity-90`} />

                  {/* Status badge (top-left) */}
                  <div className="absolute top-4 left-4">
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${c.main.split(' ')[1]} bg-surface/50 backdrop-blur-sm`}>
                      <div className={`w-2 h-2 rounded-full ${c.bar}`} />
                      <span className={`font-label-md text-xs ${c.main.split(' ')[0]}`}>
                        {labelMap[status as keyof typeof labelMap]}
                      </span>
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="flex items-start gap-4 mt-6 mb-4">
                    <CyberAvatar name={student.name} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="font-label-lg text-on-surface truncate mb-1">
                        {student.name}
                      </div>
                      <div className="text-xs text-on-surface-variant truncate">
                        {currentTopicName || '—'}
                      </div>
                    </div>
                    {accuracy !== null && (
                      <div className={`text-left flex-shrink-0 bg-surface/50 backdrop-blur-sm px-2 py-1 rounded-lg border ${c.main.split(' ')[1]}`}>
                        <div className={`font-bold text-sm ${c.main.split(' ')[0]}`}>
                          {accuracy}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stuck badge */}
                  {isStuck && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-3 bg-error/20 border border-error/40">
                      <AlertTriangle size={14} className="text-error" />
                      <span className="font-label-md text-xs text-error font-bold">תקוע</span>
                    </div>
                  )}

                  {/* Attempt mini-bars */}
                  {attempts.length > 0 && (
                    <div className="flex gap-1 h-2 rounded-full overflow-hidden mt-2 bg-surface/40">
                      {attempts.map((a: any, i: number) => (
                        <div key={i} className={`flex-1 h-full rounded-full ${a.isCorrect ? 'bg-primary' : 'bg-error'}`}
                          style={{ opacity: 0.6 + (i / attempts.length) * 0.4 }} />
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Live Insights Feed (Spans 4 cols) */}
        <div className="lg:col-span-4 glass rounded-xl p-6 flex flex-col shadow-lg">
          <div className="flex justify-between items-center mb-6 border-b border-outline-variant/30 pb-4">
            <h2 className="font-headline-md text-on-surface flex items-center gap-3">
              <Radio className="text-primary" />
              עדכונים חיים
            </h2>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto pr-2 max-h-[80vh]">

            {/* Urgent alert */}
            {liveAlerts && liveAlerts.length > 0 ? (
              <div className="flex gap-3 p-4 rounded-xl bg-error/10 border-l-4 border-l-error border border-error/20 hover:bg-error/15 transition-colors shadow-[0_0_15px_var(--color-error)]">
                <div className="mt-1">
                  <AlertTriangle className="text-error" />
                </div>
                <div>
                  <h4 className="font-label-lg text-error mb-1">התערבות דחופה</h4>
                  <p className="font-body-sm text-on-surface-variant">
                    <strong className="text-on-surface">{liveAlerts[0].count} תלמידים</strong> נתקעים ב-
                    <strong className="text-on-surface"> {liveAlerts[0].topicName}</strong>.
                    {liveAlerts[0].questionStem && (
                      <em className="block mt-2 opacity-80 text-xs">"{liveAlerts[0].questionStem}"</em>
                    )}
                  </p>
                  <button className="mt-4 w-full py-2 bg-error text-on-error rounded-lg font-label-md hover:bg-error/80 transition-colors shadow-[0_0_10px_var(--color-error)]">
                    שליחת טיפ לכיתה
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 p-4 rounded-xl bg-primary/10 border-l-4 border-l-primary border border-primary/20">
                <div className="mt-1">
                  <CheckCircle2 className="text-primary" />
                </div>
                <div>
                  <h4 className="font-label-lg text-primary">הכל מתנהל כשורה</h4>
                  <p className="font-body-sm text-on-surface-variant mt-1">אין התראות דחופות כרגע.</p>
                </div>
              </div>
            )}

            {/* Level suggestions */}
            {pendingLevels && pendingLevels.length > 0 && (
              <div className="mt-2">
                <h3 className="font-label-lg text-on-surface mb-3 flex items-center gap-2">
                  <TrendingUp className="text-tertiary text-sm" />
                  הצעות קידום רמה
                </h3>
                <div className="flex flex-col gap-3">
                  {pendingLevels.map((s, i) => (
                    <div key={i} className="flex flex-col gap-2 p-4 rounded-xl bg-surface-container-high border border-tertiary/30 hover:border-tertiary/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <CyberAvatar name={s.studentName || '?'} size={32} />
                        <div className="flex-1 min-w-0">
                          <div className="font-label-md text-on-surface truncate">{s.studentName}</div>
                          <div className="text-[10px] text-tertiary font-bold">
                            רמה {s.currentLevel} → {s.suggestedLevel}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed mt-1">{s.reason}</p>
                      <div className="flex gap-2 mt-2">
                        <button className="flex-1 py-1.5 bg-primary text-on-primary rounded-md font-label-md text-xs hover:brightness-110 transition-all shadow-[0_0_10px_var(--color-primary)]"
                          onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'approved' })}>
                          אישור
                        </button>
                        <button className="flex-1 py-1.5 bg-surface text-on-surface border border-outline-variant rounded-md font-label-md text-xs hover:bg-surface-container-highest transition-colors"
                          onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'rejected' })}>
                          דחייה
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent milestones */}
            {dashboardStats?.milestones?.length > 0 && (
              <div className="mt-4">
                <h3 className="font-label-lg text-on-surface mb-3 flex items-center gap-2">
                  <History className="text-secondary text-sm" />
                  פעילות אחרונה
                </h3>
                <div className="flex flex-col gap-4 pl-2">
                  {dashboardStats.milestones.map((m: any, i: number) => {
                    const diffSec = Math.floor((Date.now() - m.timestamp) / 1000);
                    const diffMin = Math.floor(diffSec / 60);
                    const timeStr = diffSec < 60 ? `לפני ${diffSec}ש` : `לפני ${diffMin}ד`;
                    const isCorrect = m.isCorrect;

                    return (
                      <div key={i} className="flex gap-4 relative">
                        {i < dashboardStats.milestones.length - 1 && (
                          <div className="absolute right-[5px] top-6 bottom-[-16px] w-px bg-outline-variant/30" />
                        )}
                        <div className="mt-1 flex-shrink-0 z-10 bg-background rounded-full">
                          <div className={`w-3 h-3 rounded-full ${isCorrect ? 'bg-primary shadow-[0_0_10px_var(--color-primary)]' : 'bg-error shadow-[0_0_10px_var(--color-error)]'}`} />
                        </div>
                        <div className="bg-surface-container-low rounded-lg p-2.5 w-full border border-outline-variant/30">
                          <p className="font-body-sm text-on-surface-variant">
                            <strong className="text-on-surface font-label-md mr-1">{m.studentName}</strong>
                            {m.action} <span className="opacity-70">({m.topicName})</span>
                          </p>
                          <span className={`text-[10px] font-label-md mt-1 block ${isCorrect ? 'text-primary' : 'text-error'}`}>
                            {timeStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function LegendChip({ count, label, colorClass, textClass }: { count: number; label: string; colorClass: string; textClass: string }) {
  return (
    <div className="flex items-center gap-2 bg-surface-container/50 px-3 py-1.5 rounded-full border border-outline-variant/50">
      <div className={`w-3 h-3 rounded-full ${colorClass}`} />
      <span className={`font-headline-sm ${textClass}`}>{count}</span>
      <span className="text-xs text-on-surface-variant">{label}</span>
    </div>
  );
}


