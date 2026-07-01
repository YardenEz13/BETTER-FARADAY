import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowRight, TrendingUp, Zap, Trophy, BookOpen, CheckCircle as CheckCircle2, Flame, ChevronLeft } from "../components/electric";
import { ThemeToggle } from "../components/ThemeContext";
import { ElectricBolt, SignalWave, Lens } from "../components/electric";

export default function LearningProgress() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topics = useQuery(api.topics.list);
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  if (!student || !topics) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-on-surface-variant text-sm" style={{ fontFamily: 'Assistant, sans-serif' }}>טוען נתוני התקדמות...</span>
      </div>
    </div>
  );

  const getTopicStats = (topicId: string) => {
    const d = stats?.byTopic[topicId] as { correct: number; total: number } | undefined;
    if (!d || d.total === 0) return { correct: 0, total: 0, percent: 0 };
    const percent = Math.round((d.correct / d.total) * 100);
    return { ...d, percent };
  };

  const totalAttempts = stats?.totalAttempts ?? 0;
  const allCorrect = topics.reduce((s, t) => s + (stats?.byTopic[t._id]?.correct || 0), 0);
  const overallAcc = totalAttempts > 0 ? Math.round((allCorrect / totalAttempts) * 100) : 0;
  const completedTopics = topics.filter(t => getTopicStats(t._id).percent >= 80).length;
  const totalXP = (student.streak * 100) + (totalAttempts * 25) + (allCorrect * 50);

  const getStatusLabel = (percent: number) => {
    if (percent >= 80) return { label: "הושלם", badge: "bg-primary/15 border-primary/40 text-primary" };
    if (percent > 0) return { label: "פתוח", badge: "bg-tertiary/15 border-tertiary/40 text-tertiary" };
    return { label: "טרם התחיל", badge: "bg-surface-container-high border-outline-variant/50 text-on-surface-variant" };
  };

  const getCircleIcon = (percent: number, idx: number) => {
    if (percent >= 80) return (
      <div
        className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
        style={{ boxShadow: 'var(--shadow-clay-primary)' }}
      >
        <CheckCircle2 size={22} className="text-white" />
      </div>
    );
    return (
      <div
        className="w-14 h-14 rounded-full bg-surface-container-high border-2 border-outline flex items-center justify-center font-bold text-on-surface-variant text-lg flex-shrink-0"
        style={{ boxShadow: 'var(--shadow-clay)', fontFamily: 'Assistant, sans-serif' }}
      >
        {idx + 1}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-background overflow-x-hidden" dir="rtl" style={{ fontFamily: 'Assistant, sans-serif' }}>

      {/* Atmospheric decoration */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Top navigation */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 w-full z-50 flex flex-wrap justify-between items-center px-6 md:px-10 py-4 min-h-[72px] gap-4 bg-background/90 backdrop-blur-xl border-b-2 border-outline-variant"
        style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-3">
          {/* Ghost clay back button */}
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border-2 border-outline-variant text-on-surface-variant hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all font-semibold text-sm"
            style={{ boxShadow: 'var(--shadow-clay)' }}
            onClick={() => navigate(`/student/${studentId}`)}
          >
            <ArrowRight size={16} />
            <span>חזרה</span>
          </button>
          <div className="h-6 w-px bg-outline-variant/50" />
          <div>
            <h1 className="font-bold text-on-surface text-lg leading-tight" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>ההתקדמות האקדמית שלי</h1>
            <p className="text-on-surface-variant text-sm">{student.name} · מתמטיקה 581</p>
          </div>
        </div>

        {/* Stat chips row */}
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeToggle />
          {/* XP chip */}
          <div
            className="flex items-center gap-2 bg-primary/10 border-2 border-primary/30 px-3 py-1.5 rounded-2xl"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            <ElectricBolt size={18} tone="spark" glow={0.5} animated={false} />
            <span className="num font-bold text-primary text-sm">{totalXP.toLocaleString()} XP</span>
          </div>
          {/* Streak chip */}
          <div
            className="flex items-center gap-2 bg-tertiary/10 border-2 border-tertiary/30 px-3 py-1.5 rounded-2xl"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            <Flame size={15} className="text-tertiary" />
            <span className="num font-bold text-tertiary text-sm">{student.streak} ימים</span>
          </div>
          {/* Accuracy chip */}
          <div
            className="flex items-center gap-2 bg-secondary/10 border-2 border-secondary/30 px-3 py-1.5 rounded-2xl"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            <Lens size={18} tone="violet" glow={0.5} />
            <span className="num font-bold text-secondary text-sm">{overallAcc}% דיוק</span>
          </div>
          {/* Completed chip */}
          <div
            className="flex items-center gap-2 bg-surface-container border-2 border-outline px-3 py-1.5 rounded-2xl"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            <Trophy size={15} className="text-on-surface-variant" />
            <span className="num font-bold text-on-surface text-sm">{completedTopics}/{topics.length} נושאים</span>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="page-shell page-shell--wide pt-8 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[calc(100vh-72px)]">

        {/* ── Topic list (8 cols) ── */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="font-bold text-on-surface text-xl" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>נושאי הקורס</h2>
              <p className="text-on-surface-variant text-sm">מתמטיקה בדידה ומבני נתונים</p>
            </div>
            <span className="text-sm font-semibold bg-surface-container border-2 border-outline text-on-surface-variant px-3 py-1.5 rounded-2xl" style={{ boxShadow: 'var(--shadow-clay)' }}>
              סמסטר א'
            </span>
          </div>

          <AnimatePresence>
            {topics.map((topic, idx) => {
              const { correct, total, percent } = getTopicStats(topic._id);
              const status = getStatusLabel(percent);
              const isExpanded = expandedTopic === topic._id;

              return (
                <motion.div
                  key={topic._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  className="bg-surface rounded-2xl border-2 border-outline overflow-hidden transition-all duration-300 hover:border-primary/40 group cursor-pointer"
                  style={{ boxShadow: 'var(--shadow-clay)' }}
                  onClick={() => setExpandedTopic(isExpanded ? null : topic._id)}
                >
                  <div className="p-6 flex items-center gap-6">
                    {/* Icon circle */}
                    {getCircleIcon(percent, idx)}

                    {/* Content */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${status.badge}`}>
                          {status.label}
                        </span>
                        <h3 className="font-bold text-on-surface text-base truncate" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif" }}>
                          {topic.nameHe || topic.name}
                        </h3>
                      </div>
                      <p className="text-on-surface-variant text-sm mb-3">{topic.name}</p>

                      {/* Progress bar — thick, colored */}
                      <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden border border-outline-variant/30">
                        <motion.div
                          className="h-full progress-fill-gradient rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ delay: idx * 0.07 + 0.25, duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[52px]">
                      <div className={`num text-2xl font-black ${percent >= 80 ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {percent}%
                      </div>
                      <div className="text-on-surface-variant text-xs">הצלחה</div>
                    </div>

                    {/* Chevron */}
                    <button className="flex-shrink-0 p-2 rounded-full hover:bg-surface-container transition-all text-on-surface-variant">
                      <ChevronLeft size={22} style={{ transform: isExpanded ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="border-t-2 border-outline bg-surface-container-low px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
                      >
                        <div className="flex gap-5 flex-wrap">
                          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                            <Lens size={18} tone="spark" glow={0.5} />
                            <span>{correct} תשובות נכונות מתוך {total}</span>
                          </div>
                        </div>
                        <button
                          className="px-5 py-2.5 bg-primary text-white rounded-2xl font-bold text-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                          style={{ boxShadow: 'var(--shadow-clay-primary)', fontFamily: 'Assistant, sans-serif' }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/student/${studentId}/practice/${topic._id}`); }}
                        >
                          {percent > 0 ? "המשך לתרגל" : "התחל תרגול"}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Right sidebar (4 cols) ── */}
        <div className="lg:col-span-4 space-y-5">

          {/* XP & Streak — large clay hero card with green gradient */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="relative rounded-2xl overflow-hidden p-8 text-white flex flex-col items-center justify-center min-h-[240px]"
            style={{ boxShadow: 'var(--shadow-clay-primary)' }}
          >
            <div className="absolute inset-0 bg-primary z-0" />
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl z-0" />
            <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-white/5 rounded-full blur-2xl z-0" />

            <div className="relative z-10 text-center w-full">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">נקודות ניסיון</p>
              <h2 className="num text-5xl font-black mb-1">{totalXP.toLocaleString()}</h2>
              <p className="text-white/70 text-sm mb-7">XP סה"כ</p>

              <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-center gap-3 border border-white/20">
                <Flame size={28} className="text-yellow-300" />
                <div className="text-right">
                  <p className="font-black text-lg leading-none" style={{ fontFamily: 'Assistant, sans-serif' }}>{student.streak} ימים ברצף</p>
                  <p className="text-white/70 text-sm mt-0.5">אל תשבור את הרצף 🔥</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-surface rounded-2xl border-2 border-outline p-6"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-on-surface text-base" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>סיכום למידה</h2>
              <SignalWave size={20} tone="spark" glow={0.5} animated={false} />
            </div>
            <div className="space-y-5">
              {/* Topics completed */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-on-surface-variant text-sm">נושאים שהושלמו</span>
                  <span className="num font-bold text-sm text-on-surface">{completedTopics} / {topics.length}</span>
                </div>
                <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden border border-outline-variant/30">
                  <motion.div
                    className="h-full progress-fill-gradient rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(completedTopics / Math.max(topics.length, 1)) * 100}%` }}
                    transition={{ delay: 0.4, duration: 0.7 }}
                  />
                </div>
              </div>

              {/* Overall accuracy */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-on-surface-variant text-sm">דיוק כולל</span>
                  <span className="num font-bold text-sm text-primary">{overallAcc}%</span>
                </div>
                <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden border border-outline-variant/30">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(to left, var(--color-tertiary), var(--color-secondary))' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${overallAcc}%` }}
                    transition={{ delay: 0.5, duration: 0.7 }}
                  />
                </div>
              </div>

              {/* Divider + answered questions */}
              <div className="pt-4 border-t-2 border-outline-variant/40 flex justify-between items-center">
                <span className="text-on-surface-variant text-sm">שאלות שנענו</span>
                <span className="num font-black text-xl text-tertiary">{totalAttempts}</span>
              </div>
            </div>
          </motion.div>

          {/* Achievement card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-surface rounded-2xl border-2 border-dashed border-outline-variant/70 p-5 flex items-center gap-5 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
            style={{ boxShadow: 'var(--shadow-clay)' }}
            onClick={() => navigate(`/student/${studentId}/homework`)}
          >
            <div
              className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center flex-shrink-0 border-2 border-outline"
              style={{ boxShadow: 'var(--shadow-clay)' }}
            >
              <Trophy size={20} className="text-tertiary" />
            </div>
            <div>
              <h4 className="font-bold text-on-surface text-sm">הישג חדש במרחק נגיעה!</h4>
              <p className="text-on-surface-variant text-xs mt-0.5">
                {completedTopics < topics.length
                  ? `עוד נושא אחד והתג "המתמיד" שלך`
                  : `כל הכבוד! כבשת את כל הנושאים 🎉`}
              </p>
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 }}
            className="grid grid-cols-2 gap-3"
          >
            <button
              className="flex flex-col items-center gap-2 p-4 bg-surface rounded-2xl border-2 border-outline hover:border-primary/50 hover:bg-primary/5 transition-all font-semibold text-sm text-on-surface"
              style={{ boxShadow: 'var(--shadow-clay)' }}
              onClick={() => navigate(`/student/${studentId}`)}
            >
              <BookOpen size={20} className="text-primary" />
              מפת למידה
            </button>
            <button
              className="flex flex-col items-center gap-2 p-4 bg-surface rounded-2xl border-2 border-outline hover:border-secondary/50 hover:bg-secondary/5 transition-all font-semibold text-sm text-on-surface"
              style={{ boxShadow: 'var(--shadow-clay)' }}
              onClick={() => navigate(`/student/${studentId}/homework`)}
            >
              <ElectricBolt size={22} tone="violet" glow={0.5} animated={false} />
              שיעורי בית
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

