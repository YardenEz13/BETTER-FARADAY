import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Target, TrendingUp, Zap, Trophy, BookOpen, CheckCircle2, Flame, ChevronLeft } from "lucide-react";

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
        <span className="font-label-md text-on-surface-variant">טוען נתוני התקדמות...</span>
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
    if (percent >= 80) return { label: "הושלם", color: "bg-primary text-on-primary", badge: "bg-primary/15 border-primary/40 text-primary" };
    if (percent > 0) return { label: "פתוח", color: "bg-tertiary-container/60 text-on-tertiary-container", badge: "bg-tertiary-container/20 border-tertiary-container text-on-tertiary-container" };
    return { label: "טרם התחיל", color: "bg-surface-container-high text-on-surface-variant", badge: "bg-surface-container border-outline-variant/50 text-on-surface-variant" };
  };

  const getCircleIcon = (percent: number, idx: number) => {
    if (percent >= 80) return (
      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-[0_4px_0_var(--color-primary-container)] flex-shrink-0">
        <CheckCircle2 className="text-on-primary text-2xl" />
      </div>
    );
    return (
      <div className="w-16 h-16 rounded-full border-4 border-tertiary-container flex items-center justify-center font-bold text-tertiary text-xl flex-shrink-0">
        {idx + 1}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md overflow-x-hidden" dir="rtl">

      {/* Atmospheric decoration */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-tertiary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Top navigation */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 w-full z-50 flex flex-wrap justify-between items-center px-8 md:px-12 py-4 min-h-[80px] gap-4 bg-background/90 backdrop-blur-xl border-b border-outline-variant shadow-sm"
      >
        <div className="flex items-center gap-4 ">
          <button
            className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/30"
            onClick={() => navigate(`/student/${studentId}`)}
          >
            <ArrowRight size={18} />
          </button>
          <div className="h-6 w-px bg-outline-variant/50" />
          <div>
            <h1 className="font-headline-md text-on-surface leading-tight" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>ההתקדמות האקדמית שלי</h1>
            <p className="font-label-md text-on-surface-variant">{student.name} · מתמטיקה 581</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/30 shadow-sm">
            <Zap className="text-primary" />
            <span className="font-label-lg text-on-surface">{totalXP.toLocaleString()} XP</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/30 shadow-sm">
            <Flame className="text-tertiary" />
            <span className="font-label-lg text-on-surface font-bold">{student.streak} ימים</span>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="pt-8 pb-24 px-6 md:px-12 w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 min-h-[calc(100vh-80px)]">

        {/* ── Topic list (8 cols) ── */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="font-headline-md text-on-surface" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>נושאי הקורס</h2>
              <p className="font-body-sm text-on-surface-variant">מתמטיקה בדידה ומבני נתונים</p>
            </div>
            <span className="font-label-lg bg-surface-container text-on-surface-variant px-3 py-1 rounded-full border border-outline-variant/30">
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
                  transition={{ delay: idx * 0.08 }}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg group cursor-pointer"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                  onClick={() => setExpandedTopic(isExpanded ? null : topic._id)}
                >
                  <div className="p-8 flex items-center gap-8">
                    {/* Icon circle */}
                    {getCircleIcon(percent, idx)}

                    {/* Content */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-label-md px-2 py-0.5 rounded border text-xs ${status.badge}`}>
                          {status.label}
                        </span>
                        <h3 className="font-headline-sm text-on-surface truncate" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif" }}>
                          {topic.nameHe || topic.name}
                        </h3>
                      </div>
                      <p className="font-body-sm text-on-surface-variant mb-3">{topic.name}</p>

                      {/* Progress bar */}
                      <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full progress-fill-gradient rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ delay: idx * 0.08 + 0.3, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0 text-left flex flex-col items-center gap-1">
                      <div className={`font-headline-md font-bold ${percent >= 80 ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontFamily: "'Yarden', 'Assistant', sans-serif" }}>
                        {percent}%
                      </div>
                      <div className="font-label-md text-on-surface-variant">הצלחה</div>
                    </div>

                    {/* Chevron */}
                    <button className="flex-shrink-0 p-2 rounded-full hover:bg-surface-variant/50 transition-all text-on-surface-variant">
                      <ChevronLeft size={24} style={{ transform: isExpanded ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-outline-variant/30 bg-surface-container-low px-8 py-6 flex items-center justify-between gap-4 flex-wrap"
                      >
                        <div className="flex gap-6">
                          <div className="flex items-center gap-2 text-on-surface-variant">
                            <Target size={16} className="text-primary" />
                            <span className="font-body-sm">{correct} תשובות נכונות מתוך {total}</span>
                          </div>
                        </div>
                        <button
                          className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-lg hover:scale-105 transition-all shadow-sm"
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
        <div className="lg:col-span-4 space-y-6">

          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-8 shadow-sm"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-headline-sm text-on-surface" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>סיכום למידה</h2>
              <TrendingUp size={20} className="text-primary" />
            </div>
            <div className="space-y-5">
              {/* Topics completed */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-label-lg text-on-surface-variant">נושאים שהושלמו</span>
                  <span className="font-label-lg font-bold">{completedTopics} / {topics.length}</span>
                </div>
                <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden">
                  <motion.div
                    className="progress-fill-gradient"
                    initial={{ width: 0 }}
                    animate={{ width: `${(completedTopics / Math.max(topics.length, 1)) * 100}%` }}
                    transition={{ delay: 0.4, duration: 0.7 }}
                  />
                </div>
              </div>

              {/* Overall accuracy */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-label-lg text-on-surface-variant">דיוק כולל</span>
                  <span className="font-label-lg font-bold text-primary">{overallAcc}%</span>
                </div>
                <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden">
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
              <div className="pt-4 border-t border-outline-variant/40 flex justify-between items-center">
                <span className="font-label-lg text-on-surface-variant">שאלות שנענו</span>
                <span className="font-headline-sm font-bold text-tertiary">{totalAttempts}</span>
              </div>
            </div>
          </motion.div>

          {/* XP & Streak Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="relative rounded-2xl overflow-hidden p-8 text-on-primary flex flex-col items-center justify-center min-h-[260px] shadow-lg"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-primary z-0" />
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-fixed-dim rounded-full opacity-20 blur-3xl z-0" />
            <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-primary-container rounded-full opacity-10 blur-2xl z-0" />

            <div className="relative z-10 text-center w-full">
              <p className="font-label-lg opacity-90 mb-2 uppercase tracking-widest text-sm">נקודות ניסיון</p>
              <h2 className="text-5xl font-black mb-1">{totalXP.toLocaleString()}</h2>
              <p className="font-body-md opacity-80 mb-8">XP סה"כ</p>

              <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex items-center justify-center gap-3">
                <Flame className="text-3xl text-yellow-300" />
                <div className="text-right">
                  <p className="font-headline-sm font-bold leading-none">{student.streak} ימים ברצף</p>
                  <p className="font-label-md opacity-80 mt-1">אתה בדרך הנכונה!</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Achievement card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-surface-container-lowest rounded-2xl border-2 border-dashed border-outline-variant/60 p-6 flex items-center gap-6 cursor-pointer hover:bg-surface-container hover:border-primary/30 transition-all"
            onClick={() => navigate(`/student/${studentId}/homework`)}
          >
            <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
              <Trophy size={22} className="text-on-surface-variant" />
            </div>
            <div>
              <h4 className="font-label-lg text-on-surface">הישג חדש מחכה!</h4>
              <p className="font-body-sm text-on-surface-variant mt-0.5">
                {completedTopics < topics.length
                  ? `סיים עוד נושא אחד לקבלת תג "המתמיד"`
                  : `כל הכבוד! השלמת את כל הנושאים 🎉`}
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
              className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/40 hover:border-primary/40 hover:bg-primary/5 transition-all"
              onClick={() => navigate(`/student/${studentId}`)}
            >
              <BookOpen size={20} className="text-primary" />
              <span className="font-label-md text-on-surface">מפת למידה</span>
            </button>
            <button
              className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/40 hover:border-secondary/40 hover:bg-secondary/5 transition-all"
              onClick={() => navigate(`/student/${studentId}/homework`)}
            >
              <Zap size={20} className="text-secondary" />
              <span className="font-label-md text-on-surface">שיעורי בית</span>
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

