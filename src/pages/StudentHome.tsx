import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Flame, Target, ChevronLeft, Bot, BookOpen,
  CheckCircle2, Lock, PlayCircle, LogOut, ChevronRight
} from "lucide-react";
import AIChatPanel from "../components/AIChatPanel";
import CyberAvatar from "../components/CyberAvatar";

export default function StudentHome() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topics = useQuery(api.topics.list);
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const [chatOpen, setChatOpen] = useState(false);

  if (!student || !topics) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        <span className="label-mono" style={{ color: 'var(--text-muted)' }}>טוען...</span>
      </div>
    </div>
  );

  const getProgress = (topicId: string) => {
    const d = stats?.byTopic[topicId] as { correct: number; total: number } | undefined;
    if (!d || d.total === 0) return 0;
    return Math.round((d.correct / d.total) * 100);
  };

  const totalAttempts = stats?.totalAttempts ?? 0;
  const correctTotal = topics.reduce((s, t) => s + (stats?.byTopic[t._id]?.correct || 0), 0);
  const overallAcc = totalAttempts > 0 ? Math.round((correctTotal / totalAttempts) * 100) : 0;
  const totalXP = (student.streak * 100) + (totalAttempts * 25) + (correctTotal * 50);
  const completedTopics = topics.filter(t => getProgress(t._id) >= 80).length;

  return (
    <div className="min-h-screen relative overflow-x-hidden">

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[20%] left-[-5%] w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 70%)' }} />
      </div>

      {/* ── Top Navigation Bar ── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(5,11,24,0.80)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Left: Back + Logo */}
        <div className="flex items-center gap-4">
          <button className="btn-icon" onClick={() => navigate("/")}>
            <LogOut size={16} />
          </button>
          <div className="w-px h-6" style={{ background: 'var(--border-subtle)' }} />
          <div className="flex items-center gap-3">
            <CyberAvatar name={student.name} size={36} />
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{student.name}</div>
              <div className="label-mono" style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>כיתה 581</div>
            </div>
          </div>
        </div>

        {/* Center: Stats Pills */}
        <div className="hidden md:flex items-center gap-3">
          <StatPill icon={<Zap size={13} />} value={totalXP.toLocaleString()} label="XP" color="var(--color-primary-light)" />
          <StatPill icon={<Flame size={13} />} value={student.streak} label="ימים רצופים" color="var(--color-warning)" />
          <StatPill icon={<Target size={13} />} value={`${overallAcc}%`} label="דיוק" color="var(--color-success)" />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-sm hidden md:flex items-center gap-2"
            onClick={() => navigate(`/student/${studentId}/homework`)}
          >
            <BookOpen size={14} />
            שיעורי בית
          </button>
          <button
            className="btn btn-primary btn-sm flex items-center gap-2"
            onClick={() => setChatOpen(true)}
          >
            <Bot size={14} />
            AI מורה
          </button>
        </div>
      </motion.header>

      {/* ── Main Content ── */}
      <div className="relative z-10 max-w-[1400px] mx-auto pt-24 px-6 pb-16 flex flex-col lg:flex-row gap-8">

        {/* LEFT: Sidebar stats */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="hidden lg:flex flex-col gap-5 w-[280px] flex-shrink-0 sticky top-24 h-fit"
        >
          {/* Progress overview card */}
          <div className="glass p-6">
            <div className="label-mono mb-4">// סיכום למידה</div>

            <div className="flex flex-col gap-4">
              <ProgressStat
                label="נושאים שהושלמו"
                value={`${completedTopics} / ${topics.length}`}
                progress={(completedTopics / Math.max(topics.length, 1)) * 100}
                color="var(--color-success)"
              />
              <ProgressStat
                label="דיוק כולל"
                value={`${overallAcc}%`}
                progress={overallAcc}
                color="var(--color-primary)"
              />
              <ProgressStat
                label="שאלות שנוסו"
                value={totalAttempts.toLocaleString()}
                progress={Math.min((totalAttempts / 200) * 100, 100)}
                color="var(--color-accent)"
              />
            </div>
          </div>

          {/* XP card */}
          <div className="glass p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, var(--g-600), var(--g-400), var(--amber))' }} />
            <div className="label-mono mb-2">נקודות ניסיון</div>
            <div className="stat-value mb-1" style={{ fontSize: '2.2rem', color: 'var(--color-primary-light)' }}>
              {totalXP.toLocaleString()}
            </div>
            <div className="label-mono" style={{ color: 'var(--text-muted)' }}>XP סה"כ</div>

            <div className="mt-4 flex items-center gap-2">
              <Flame size={14} style={{ color: 'var(--color-warning)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {student.streak} ימים ברצף
              </span>
            </div>
          </div>

          {/* Teacher link */}
          <button
            className="btn btn-ghost w-full flex items-center justify-center gap-2"
            onClick={() => navigate("/teacher")}
          >
            <LogOut size={14} />
            <span>עמוד מורה</span>
          </button>
        </motion.aside>

        {/* RIGHT: Topic skill tree */}
        <div className="flex-1 min-w-0">

          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h1 className="heading-display mb-2" style={{ fontSize: '2rem', fontFamily: 'var(--font-display)' }}>מסלול הלמידה שלך</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              בחר נושא להתחיל לתרגל — ה-AI שלך ימתין לשאלות.
            </p>
          </motion.div>

          {/* Topic list */}
          <div className="flex flex-col gap-4">
            {topics.map((topic, idx) => {
              const progress = getProgress(topic._id);
              const isCompleted = progress >= 80;
              const isStarted = progress > 0;

              let statusColor = 'var(--color-primary)';
              let statusLabel = 'לא התחלת';
              let StatusIcon = PlayCircle;

              if (isCompleted) {
                statusColor = 'var(--color-success)';
                statusLabel = 'הושלם';
                StatusIcon = CheckCircle2;
              } else if (isStarted) {
                statusColor = 'var(--color-warning)';
                statusLabel = 'בתהליך';
                StatusIcon = PlayCircle;
              }

              return (
                <motion.div
                  key={topic._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.06 }}
                  className="glass card-hover shine-on-hover relative overflow-hidden cursor-pointer group"
                  style={{ padding: '24px 28px' }}
                  onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}
                >
                  {/* Left accent bar */}
                  <div className="absolute top-0 bottom-0 right-0 w-[3px] rounded-full transition-all duration-300"
                    style={{ background: statusColor, opacity: isCompleted ? 1 : isStarted ? 0.8 : 0.3 }} />

                  <div className="flex items-center gap-5">

                    {/* Index circle */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: isCompleted ? 'var(--color-success-muted)' : isStarted ? 'var(--color-warning-muted)' : 'var(--color-primary-muted)',
                        border: `1.5px solid ${statusColor}`,
                        color: statusColor,
                      }}>
                      {isCompleted ? <CheckCircle2 size={18} /> : <span>{idx + 1}</span>}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="label-mono" style={{ color: statusColor, fontSize: '0.6rem' }}>
                              נושא {idx + 1}
                            </span>
                            <span className="badge" style={{
                              background: `${statusColor}18`,
                              borderColor: `${statusColor}40`,
                              color: statusColor,
                              fontSize: '0.6rem',
                            }}>
                              {statusLabel}
                            </span>
                          </div>
                          <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                            {topic.nameHe}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-left">
                            <div className="font-bold text-lg" style={{ color: statusColor, fontFamily: 'var(--font-mono)' }}>
                              {progress}%
                            </div>
                            <div className="label-mono" style={{ fontSize: '0.55rem' }}>הצלחה</div>
                          </div>
                          <ChevronLeft size={18} style={{ color: 'var(--text-muted)' }}
                            className="transition-transform duration-200 group-hover:-translate-x-1" />
                        </div>
                      </div>

                      {topic.description && (
                        <p className="text-sm mb-3 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                          {topic.description}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="progress-track" style={{ height: '5px' }}>
                        <div className="progress-fill" style={{
                          width: `${progress}%`,
                          background: isCompleted
                            ? `linear-gradient(90deg, var(--color-success), #34D399)`
                            : isStarted
                            ? `linear-gradient(90deg, var(--color-warning), #FCD34D)`
                            : `linear-gradient(90deg, var(--color-primary), var(--color-accent))`,
                          boxShadow: `0 0 8px ${statusColor}50`,
                        }} />
                      </div>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>

        </div>
      </div>

      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId!}
        agentType="homework"
      />
    </div>
  );
}

function StatPill({ icon, value, label, color }: { icon: React.ReactNode; value: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <span style={{ color }}>{icon}</span>
      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function ProgressStat({ label, value, progress, color }: { label: string; value: string; progress: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-bold text-sm" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</span>
      </div>
      <div className="progress-track" style={{ height: '4px' }}>
        <div className="progress-fill" style={{
          width: `${Math.min(progress, 100)}%`,
          background: color,
          boxShadow: `0 0 8px ${color}50`,
          transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>
    </div>
  );
}
