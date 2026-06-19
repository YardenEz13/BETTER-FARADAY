import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, BookOpen, BarChart2, Bot, Play, Zap, Flame, Check,
  Lock, MessageSquare, CheckCircle2, Map, Activity, Package, Palette,
} from "lucide-react";
import AIChatPanel from "../components/AIChatPanel";
import CyberAvatar from "../components/CyberAvatar";
import ThemePicker, { HOMEWORK_THEMES } from "../components/ThemePicker";

export default function StudentHome() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topics = useQuery(api.topics.list);
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const [chatOpen, setChatOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  if (!student || !topics) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin shadow-[0_0_15px_var(--color-primary)]" />
        <span className="font-label-md text-primary tracking-widest">טוען נתונים אישיים...</span>
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

  // Determine node states
  const nodeStates = topics.map((topic, idx) => {
    const progress = getProgress(topic._id);
    const isCompleted = progress >= 80;
    const isActive = !isCompleted && (idx === 0 || getProgress(topics[idx - 1]._id) >= 80);
    return { isCompleted, isActive, isLocked: !isCompleted && !isActive, progress };
  });

  // Current theme label
  const currentThemeLabel = student.homeworkTheme
    ? HOMEWORK_THEMES.find(t => t.id === student.homeworkTheme)?.label ?? student.homeworkTheme
    : null;

  // Offset pattern for zigzag layout (desktop)
  const offsets = [48, -48, 32, -40, 56, -32, 40, -56, 48, -48];

  return (
    <div className="min-h-screen bg-background text-on-background overflow-x-hidden font-body-md" dir="rtl">

      {/* ── Atmospheric elements ── */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-secondary/5 blur-[180px] rounded-full pointer-events-none -z-10" />

      {/* ── Top Navigation ── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/40 shadow-sm"
      >
        {/* Left: back + brand */}
        <div className="flex items-center gap-3">
          <button
            className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
            onClick={() => navigate("/")}
          >
            <LogOut size={18} />
          </button>
          {/* Avatar — click opens theme picker */}
          <button
            className="flex items-center gap-2.5 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/30 hover:border-primary/40 transition-all active:scale-95"
            onClick={() => setThemePickerOpen(true)}
          >
            <div className="relative">
              <CyberAvatar name={student.name} size={32} />
              {student.homeworkTheme && (
                <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center border border-surface">
                  <span className="text-[8px]">✨</span>
                </div>
              )}
            </div>
            <div>
              <div className="font-label-lg text-on-surface leading-tight">{student.name}</div>
              {student.homeworkTheme ? (
                <div className="font-label-md text-primary tracking-wide" style={{ fontSize: "10px" }}>
                  {currentThemeLabel}
                </div>
              ) : (
                <div className="font-label-md text-on-surface-variant" style={{ fontSize: "10px" }}>
                  הגדר נושא ✨
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Center: stats (desktop only) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="stat-chip">
            <Zap className="text-primary" size={16} />
            <span className="text-on-surface">{totalXP.toLocaleString()} XP</span>
          </div>
          <div className="stat-chip">
            <Flame className="text-tertiary" size={16} />
            <span className="text-on-surface font-bold">{student.streak} ימים</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-surface-container text-on-surface border border-outline-variant/50 hover:border-primary/50 hover:bg-primary/5 rounded-full font-label-lg transition-all shadow-sm text-sm"
            onClick={() => navigate(`/student/${studentId}/homework`)}
          >
            <BookOpen size={15} className="text-primary" />
            <span>שיעורי בית</span>
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-full font-label-lg shadow-[0_0_15px_var(--color-primary)] hover:scale-105 transition-all text-sm"
            onClick={() => setChatOpen(true)}
          >
            <Bot size={16} />
            <span className="hidden sm:inline">AI מורה</span>
          </button>
        </div>
      </motion.header>

      {/* ── Main content ── */}
      <div className="pt-[68px] pb-24 md:pb-10 flex flex-col xl:flex-row gap-8 min-h-screen px-4 md:px-12 py-6 w-full max-w-[1600px] mx-auto">

        {/* ── Learning Map Canvas ── */}
        <section className="flex-1 relative flex flex-col items-center">
          {/* Section header */}
          <div className="w-full max-w-4xl mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-headline-lg text-on-surface mb-1" style={{ fontFamily: "'Assistant', sans-serif", fontWeight: 700 }}>
                מפת הלמידה שלי
              </h1>
              <p className="font-body-md text-on-surface-variant text-sm">
                יחידה {completedTopics + 1} מתוך {topics.length} · המשך את המסע שלך
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex bg-surface-container-high rounded-full px-4 py-2 items-center gap-3 border border-outline-variant shadow-sm">
                <Flame className="text-secondary" size={18} />
                <span className="font-label-lg text-on-surface font-bold">{student.streak} ימים</span>
              </div>
            </div>
          </div>

          {/* ── MOBILE: thumb-friendly card list ── */}
          <div className="flex md:hidden flex-col gap-3 w-full max-w-sm">
            {topics.map((topic, idx) => {
              const { isCompleted, isActive, isLocked, progress } = nodeStates[idx];
              return (
                <motion.div
                  key={topic._id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                >
                  <button
                    disabled={isLocked}
                    onClick={() => !isLocked && navigate(`/student/${studentId}/practice/${topic._id}`)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-95
                      ${isActive
                        ? "border-primary bg-primary/10 shadow-[0_0_16px_var(--color-primary)/40]"
                        : isCompleted
                          ? "border-primary/30 bg-surface-container"
                          : "border-outline-variant/30 bg-surface-container opacity-60"
                      }`}
                  >
                    {/* Icon bubble */}
                    <div className={`w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center text-2xl
                      ${isActive
                        ? "bg-primary shadow-[0_0_12px_var(--color-primary)]"
                        : isCompleted
                          ? "bg-primary/20"
                          : "bg-surface-variant"
                      }`}
                    >
                      {isActive ? (
                        <Play className="text-on-primary fill-current" size={24} />
                      ) : isCompleted ? (
                        <Check className="text-primary" size={24} />
                      ) : (
                        <Lock className="text-on-surface-variant" size={20} />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-right">
                      <div className={`font-label-lg text-base ${isActive ? "text-primary" : isCompleted ? "text-on-surface" : "text-on-surface-variant"}`}>
                        {topic.nameHe}
                      </div>
                      <div className="text-xs text-on-surface-variant mt-0.5">
                        {isActive ? "לחץ להתחיל ▶" : isCompleted ? `✓ הושלם · ${progress}%` : "נעול"}
                      </div>
                      {/* Progress bar for in-progress topics */}
                      {!isLocked && progress > 0 && progress < 80 && (
                        <div className="mt-2 w-full bg-surface-variant rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Active pulse dot */}
                    {isActive && (
                      <div className="relative flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
                      </div>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* ── DESKTOP: original zigzag skill tree ── */}
          <div className="hidden md:flex relative w-full max-w-lg py-12 flex-col items-center">
            {/* SVG winding path background */}
            <svg
              className="absolute top-0 left-1/2 -ml-[75px] w-[150px] pointer-events-none"
              style={{ height: `${topics.length * 120 + 80}px` }}
              viewBox={`0 0 150 ${topics.length * 120 + 80}`}
              preserveAspectRatio="none"
            >
              <path
                d={generatePath(topics.length, false)}
                fill="none"
                stroke="var(--color-surface-container-highest)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d={generatePath(completedTopics + 1, true)}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.6"
              />
            </svg>

            {/* Nodes */}
            <div className="w-full flex flex-col gap-[72px] relative z-10 pt-4">
              {topics.map((topic, idx) => {
                const { isCompleted, isActive, isLocked, progress } = nodeStates[idx];
                const xOffset = offsets[idx % offsets.length];

                return (
                  <motion.div
                    key={topic._id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.07 }}
                    className="flex flex-col items-center relative"
                    style={{ transform: `translateX(${xOffset}px)` }}
                  >
                    {isActive ? (
                      <div className="relative group cursor-pointer mb-4 mt-2" onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}>
                        <div className="absolute inset-[-8px] bg-primary rounded-full opacity-30 animate-ping" />
                        <div className="relative w-20 h-20 bg-surface rounded-full flex items-center justify-center ring-4 ring-primary group-hover:scale-105 group-active:scale-95 transition-all duration-300 overflow-hidden shadow-[0_6px_0_var(--color-primary-container)]">
                          <div className="absolute inset-0 bg-primary/10" />
                          <Play className="text-primary w-10 h-10 z-10 fill-current" />
                        </div>
                        <div className="absolute -right-36 top-1/2 -translate-y-1/2 bg-surface-container-high py-3 px-6 rounded-xl border-2 border-primary/40 shadow-lg w-max max-w-[240px] text-center z-20">
                          <span className="font-label-lg text-on-surface block font-bold mb-1 whitespace-normal leading-snug">{topic.nameHe}</span>
                          <span className="text-xs text-primary block mt-1">התחל שיעור</span>
                          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-surface-container-high border-r-2 border-t-2 border-primary/40 rotate-45" />
                        </div>
                      </div>
                    ) : isCompleted ? (
                      <div
                        className="group relative w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-[0_4px_0_var(--color-primary-container)] group-hover:-translate-y-1 group-active:translate-y-1 group-active:shadow-none transition-all cursor-pointer z-10"
                        onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}
                      >
                        <Check className="text-on-primary text-3xl" />
                        <div className="absolute -top-10 bg-surface-container py-1 px-3 rounded-lg border border-outline-variant opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          <span className="font-label-md text-on-surface">{topic.nameHe}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-surface-variant rounded-full flex items-center justify-center shadow-[0_4px_0_var(--color-surface-container)] z-10 border border-outline-variant/30 opacity-70">
                        <Lock className="text-on-surface-variant text-2xl" />
                      </div>
                    )}

                    {!isLocked && !isActive && progress > 0 && progress < 80 && (
                      <div className="mt-2 bg-surface-container py-0.5 px-2 rounded-full border border-outline-variant">
                        <span className="font-label-md text-primary">{progress}%</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── AI Assistant & Stats Sidebar ── */}
        <aside className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-5">
          <div className="sticky top-20 space-y-5">

            {/* Stats Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant shadow-lg relative overflow-hidden"
            >
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              <h3 className="font-headline-md text-on-surface mb-5 relative z-10" style={{ fontFamily: "'Assistant', sans-serif" }}>סקירת מעבדה</h3>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-on-surface-variant text-sm">נושאים שהושלמו</span>
                  <span className="font-headline-md text-primary">{completedTopics} / {topics.length}</span>
                </div>
                <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
                  <div className="progress-fill-gradient h-full rounded-full transition-all duration-700" style={{ width: `${(completedTopics / Math.max(topics.length, 1)) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-on-surface-variant text-sm">דיוק כולל</span>
                  <span className="font-headline-md text-secondary">{overallAcc}%</span>
                </div>
                <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overallAcc}%`, background: 'linear-gradient(to left, var(--color-tertiary), var(--color-secondary))' }} />
                </div>
                <div className="pt-3 flex items-center justify-between border-t border-outline-variant/50">
                  <span className="font-body-md text-on-surface-variant text-sm">נקודות אנרגיה</span>
                  <span className="font-body-md text-primary font-bold flex items-center gap-1">
                    <Zap size={15} />
                    {totalXP.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Theme badge (if set) */}
            {student.homeworkTheme && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setThemePickerOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/30 rounded-2xl hover:bg-primary/15 transition-all text-right"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Palette size={18} className="text-primary" />
                </div>
                <div>
                  <div className="font-label-lg text-primary text-sm">נושא שיעורי הבית</div>
                  <div className="font-body-md text-on-surface text-sm">{currentThemeLabel}</div>
                </div>
              </motion.button>
            )}

            {/* AI Assistant Bubble */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-surface-container rounded-2xl p-5 border-2 border-primary/20 relative overflow-visible"
              style={{ boxShadow: '0 0 20px rgba(116, 222, 79, 0.08)' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-container/30 border border-primary flex-shrink-0 flex items-center justify-center glow-primary">
                  <Bot className="text-primary" size={22} />
                </div>
                <div>
                  <h4 className="font-label-lg text-primary mb-1.5" style={{ fontFamily: "'Assistant', sans-serif", fontWeight: 700 }}>פרופסור פאראדיי</h4>
                  <p className="font-body-md text-on-surface leading-relaxed text-sm">
                    שלום! ראיתי שאתה מתקדם יפה. {completedTopics > 0 ? `השלמת ${completedTopics} נושאים — ` : ''}
                    מוכן להמשיך? אני כאן אם תצטרך רמז!
                  </p>
                  <button
                    className="mt-4 px-4 py-2 bg-transparent border-2 border-primary text-primary rounded-xl font-label-lg hover:bg-primary/10 transition-colors flex items-center gap-2 text-sm"
                    onClick={() => setChatOpen(true)}
                  >
                    <MessageSquare size={16} />
                    שאל שאלה
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Mobile stats row */}
            <div className="flex md:hidden items-center justify-around bg-surface-container rounded-2xl p-4 border border-outline-variant gap-4">
              <div className="flex items-center gap-2">
                <Zap className="text-primary" size={18} />
                <span className="font-label-lg text-on-surface">{totalXP.toLocaleString()} XP</span>
              </div>
              <div className="w-px h-6 bg-outline-variant" />
              <div className="flex items-center gap-2">
                <Flame className="text-secondary" size={18} />
                <span className="font-label-lg text-on-surface">{student.streak} ימים</span>
              </div>
              <div className="w-px h-6 bg-outline-variant" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-tertiary" size={18} />
                <span className="font-label-lg text-on-surface">{completedTopics}/{topics.length}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant z-50 flex justify-around items-center px-2 py-2 shadow-[0_-4px_12px_color-mix(in_srgb,var(--color-on-background)_15%,transparent)]">
        <button className="flex flex-col items-center gap-1 text-primary min-w-[56px] py-1" onClick={() => navigate(`/student/${studentId}`)}>
          <Map size={22} />
          <span className="font-label-md" style={{ fontSize: "10px" }}>מפה</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors min-w-[56px] py-1" onClick={() => setChatOpen(true)}>
          <Bot size={22} />
          <span className="font-label-md" style={{ fontSize: "10px" }}>מורה AI</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors min-w-[56px] py-1" onClick={() => navigate(`/student/${studentId}/progress`)}>
          <Activity size={22} />
          <span className="font-label-md" style={{ fontSize: "10px" }}>התקדמות</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors min-w-[56px] py-1" onClick={() => navigate(`/student/${studentId}/homework`)}>
          <Package size={22} />
          <span className="font-label-md" style={{ fontSize: "10px" }}>שיעורי בית</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors min-w-[56px] py-1" onClick={() => setThemePickerOpen(true)}>
          <Palette size={22} />
          <span className="font-label-md" style={{ fontSize: "10px" }}>נושא</span>
        </button>
      </nav>

      {/* Theme Picker */}
      <ThemePicker
        isOpen={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        studentId={studentId!}
        currentTheme={student.homeworkTheme}
      />

      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId!}
        agentType="homework"
      />
    </div>
  );
}

/** Generate a winding SVG path for the skill tree */
function generatePath(nodeCount: number, _active: boolean): string {
  if (nodeCount <= 0) return "";
  const stepH = 120;
  const cx = 75;
  const amplitude = 50;
  let d = `M ${cx},20`;
  for (let i = 0; i < nodeCount; i++) {
    const y1 = 20 + i * stepH;
    const y2 = y1 + stepH;
    const xOff = i % 2 === 0 ? amplitude : -amplitude;
    d += ` C ${cx + xOff},${y1 + 40} ${cx + xOff},${y2 - 40} ${cx},${y2}`;
  }
  return d;
}
