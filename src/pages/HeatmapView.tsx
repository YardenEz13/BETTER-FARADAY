import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { CheckCircle2, TrendingUp, XCircle, AlertTriangle, ChevronRight, Clock } from "lucide-react";
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

  return (
    <div className="flex flex-col xl:flex-row gap-0 min-h-full">

      {/* ── Main: Student grid ── */}
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-auto">

        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="heading-display" style={{ fontSize: '1.6rem' }}>
              מפת החום הכיתתית
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
              מעקב חי אחרי {heatmap.length} תלמידים · {classroom?.name ?? "כיתה"}
            </p>
          </div>

          {/* Status legend */}
          <div className="flex items-center gap-2">
            <LegendChip count={counts.green}  label="שולטים"  color="var(--color-success)" />
            <LegendChip count={counts.yellow} label="מתקשים"  color="var(--color-warning)" />
            <LegendChip count={counts.red}    label="בסיכון"  color="var(--color-danger)" />
          </div>
        </div>

        {/* Progress mini-bars — class overview */}
        <div className="glass p-4 flex items-center gap-6">
          <div className="flex-1">
            <div className="label-mono mb-2" style={{ fontSize: '0.6rem' }}>פילוח הכיתה</div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(counts.green / total) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-r-full"
                style={{ background: 'var(--color-success)', minWidth: counts.green > 0 ? '4px' : '0' }}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(counts.yellow / total) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="h-full"
                style={{ background: 'var(--color-warning)', minWidth: counts.yellow > 0 ? '4px' : '0' }}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(counts.red / total) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className="h-full rounded-l-full"
                style={{ background: 'var(--color-danger)', minWidth: counts.red > 0 ? '4px' : '0' }}
              />
            </div>
          </div>
          <div className="text-left">
            <div className="stat-value" style={{ fontSize: '1.8rem', color: 'var(--color-primary-light)' }}>
              {dashboardStats?.globalSpeed ?? 0}
            </div>
            <div className="label-mono">פעולות/דקה</div>
          </div>
        </div>

        {/* Student cards grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
        >
          {heatmap.map(({ student, status, currentTopicName, isStuck, recentAttempts }) => {
            const filled   = recentAttempts ? recentAttempts.filter((a: any) => a.isCorrect).length : 0;
            const total    = recentAttempts ? recentAttempts.length : 0;
            const attempts = recentAttempts ? [...recentAttempts].reverse() : [];

            const colorMap = {
              green:  { main: 'var(--color-success)',  muted: 'var(--color-success-muted)',  glow: 'rgba(16,185,129,0.15)' },
              yellow: { main: 'var(--color-warning)',  muted: 'var(--color-warning-muted)',  glow: 'rgba(245,158,11,0.15)' },
              red:    { main: 'var(--color-danger)',   muted: 'var(--color-danger-muted)',   glow: 'rgba(239,68,68,0.15)'  },
            };
            const c = colorMap[status as keyof typeof colorMap] ?? colorMap.green;
            const labelMap = { green: 'שולט', yellow: 'מתקשה', red: 'בסיכון' };
            const accuracy = total > 0 ? Math.round((filled / total) * 100) : null;

            return (
              <motion.div
                key={student._id}
                className="glass card-hover shine-on-hover relative overflow-hidden cursor-pointer group"
                style={{ padding: '20px' }}
                onClick={() => onStudentClick(student._id)}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                {/* Status indicator strip (top) */}
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: c.main, opacity: 0.7 }} />

                {/* Status badge (top-left) */}
                <div className="absolute top-3 left-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`${status === 'red' ? 'pulse-dot-danger' : status === 'yellow' ? 'pulse-dot-warning' : 'pulse-dot'}`}
                      style={{ width: 6, height: 6, minWidth: 6, borderRadius: '50%', background: c.main }} />
                    <span className="label-mono" style={{ color: c.main, fontSize: '0.58rem' }}>
                      {labelMap[status as keyof typeof labelMap]}
                    </span>
                  </div>
                </div>

                {/* Main content */}
                <div className="flex items-start gap-3 mt-4 mb-4">
                  <CyberAvatar name={student.name} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base leading-tight truncate mb-0.5"
                      style={{ color: 'var(--text-primary)' }}>
                      {student.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {currentTopicName || '—'}
                    </div>
                  </div>
                  {accuracy !== null && (
                    <div className="text-left flex-shrink-0">
                      <div className="font-bold text-base" style={{ color: c.main, fontFamily: 'var(--font-mono)' }}>
                        {accuracy}%
                      </div>
                      <div className="label-mono" style={{ fontSize: '0.55rem' }}>דיוק</div>
                    </div>
                  )}
                </div>

                {/* Stuck badge */}
                {isStuck && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-3"
                    style={{ background: 'var(--color-danger-muted)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <AlertTriangle size={10} style={{ color: 'var(--color-danger)' }} />
                    <span className="label-mono" style={{ color: 'var(--color-danger)', fontSize: '0.58rem' }}>תקוע</span>
                  </div>
                )}

                {/* Attempt mini-bars */}
                {attempts.length > 0 && (
                  <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mt-1">
                    {attempts.map((a: any, i: number) => (
                      <div key={i} className="flex-1 h-full rounded-full"
                        style={{
                          background: a.isCorrect ? 'var(--color-success)' : 'var(--color-danger)',
                          opacity: 0.7 + (i / attempts.length) * 0.3,
                        }} />
                    ))}
                  </div>
                )}

                {/* Hover arrow */}
                <ChevronRight size={14} className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }} />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Right panel: Insights ── */}
      <div className="w-full xl:w-[360px] flex-shrink-0 p-6 flex flex-col gap-5 overflow-auto"
        style={{ borderRight: '1px solid var(--border-subtle)' }}>

        <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>תובנות בזמן אמת</h3>

        {/* Urgent alert */}
        {liveAlerts && liveAlerts.length > 0 ? (
          <div className="glass-danger p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'var(--color-danger)' }} />
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={15} style={{ color: 'var(--color-danger)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--color-danger)' }}>התערבות דחופה</span>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{liveAlerts[0].count} תלמידים</strong> נתקעים ב
              <strong style={{ color: 'var(--text-primary)' }}>{liveAlerts[0].topicName}</strong>.
              {liveAlerts[0].questionStem && (
                <em className="block mt-1 opacity-70">"{liveAlerts[0].questionStem}"</em>
              )}
            </p>
            <button className="btn btn-danger btn-sm w-full">שליחת טיפ לכיתה</button>
          </div>
        ) : (
          <div className="glass-success p-4 flex items-center gap-3">
            <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
            <div>
              <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>הכל מתנהל כשורה</div>
              <div className="label-mono" style={{ fontSize: '0.6rem' }}>אין התראות דחופות</div>
            </div>
          </div>
        )}

        {/* Level suggestions */}
        {pendingLevels && pendingLevels.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} style={{ color: 'var(--color-primary-light)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>הצעות קידום רמה</span>
              <span className="badge badge-primary" style={{ marginRight: 'auto' }}>{pendingLevels.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {pendingLevels.map((s, i) => (
                <div key={i} className="glass p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <CyberAvatar name={s.studentName || '?'} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.studentName}</div>
                      <div className="label-mono" style={{ fontSize: '0.6rem', color: 'var(--color-primary-light)' }}>
                        רמה {s.currentLevel} → רמה {s.suggestedLevel}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{s.reason}</p>
                  <div className="flex gap-2">
                    <button className="btn btn-success btn-sm flex-1"
                      onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'approved' })}>
                      <CheckCircle2 size={13} /> אישור
                    </button>
                    <button className="btn btn-ghost btn-sm flex-1"
                      onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'rejected' })}>
                      <XCircle size={13} /> דחייה
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent milestones */}
        {dashboardStats?.milestones?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>אבני דרך אחרונות</span>
            </div>
            <div className="glass p-4 flex flex-col gap-4">
              {dashboardStats.milestones.map((m: any, i: number) => {
                const diffSec = Math.floor((Date.now() - m.timestamp) / 1000);
                const diffMin = Math.floor(diffSec / 60);
                const timeStr = diffSec < 60 ? `לפני ${diffSec}ש` : `לפני ${diffMin}ד`;
                const mColor  = m.isCorrect ? 'var(--color-success)' : 'var(--color-danger)';

                return (
                  <div key={i} className="flex items-start gap-3 relative">
                    {i < dashboardStats.milestones.length - 1 && (
                      <div className="absolute right-[7px] top-4 bottom-[-16px] w-px"
                        style={{ background: 'var(--border-subtle)' }} />
                    )}
                    <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: mColor, boxShadow: `0 0 8px ${mColor}60` }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{m.studentName}</strong>{' '}
                        {m.action}
                        <span className="text-xs opacity-60 mr-1">({m.topicName})</span>
                      </div>
                      <div className="label-mono mt-0.5" style={{ color: mColor, fontSize: '0.58rem' }}>{timeStr}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function LegendChip({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-bold text-sm" style={{ color, fontFamily: 'var(--font-mono)' }}>{count}</span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}
