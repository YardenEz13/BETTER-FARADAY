import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, memo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LogOut, BookOpen, BarChart2, Bot, Play, Zap, Flame, Check,
  MessageSquare, CheckCircle2, Map, Activity, Package, Palette, Star,
} from "lucide-react";
import AIChatPanel from "../components/AIChatPanel";
import CyberAvatar from "../components/CyberAvatar";
import ThemeSelector, { HOMEWORK_THEMES } from "../components/ThemeSelector";
import { ElectricField } from "../components/electric";

/* ── A single station on the learning circuit ──
   Active node = a "charged" particle: pulsing field-line rings radiate from it. */
const SkillNode = memo(function SkillNode({
  nameHe, idx, isCompleted, isActive, progress, reducedMotion, onClick,
}: {
  nameHe: string;
  idx: number;
  isCompleted: boolean;
  isActive: boolean;
  progress: number;
  reducedMotion: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.07, type: 'spring', stiffness: 260, damping: 20 }}
      className="flex flex-col items-center relative"
    >
      {/* Field lines — lines of force radiating from the charged node */}
      {isActive && !reducedMotion && (
        <div className="absolute left-1/2 top-[36px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }} aria-hidden>
          <span className="field-ring absolute left-0 top-0 w-[104px] h-[104px] rounded-full border-2 border-primary/50" />
          <span className="field-ring field-ring--2 absolute left-0 top-0 w-[104px] h-[104px] rounded-full border-2 border-primary/40" />
        </div>
      )}

      {/* Node circle */}
      <button
        className={`relative w-[72px] h-[72px] rounded-full flex items-center justify-center border-4 transition-all cursor-pointer hover:-translate-y-1 active:translate-y-1 z-10
          ${isCompleted
            ? "bg-primary border-primary-dark text-white"
            : isActive
              ? "bg-surface border-primary text-primary"
              : "bg-surface border-outline text-on-surface-variant hover:border-primary"
          }`}
        style={{
          boxShadow: isCompleted
            ? 'var(--shadow-clay-primary)'
            : isActive
              ? '0 4px 0 0 var(--color-primary-dark), 0 0 22px rgba(91,255,159,0.5)'
              : 'var(--shadow-clay)',
        }}
        onClick={onClick}
        aria-label={nameHe}
      >
        {isCompleted ? (
          <Check size={30} strokeWidth={3} />
        ) : (
          <Play size={26} className="fill-current" />
        )}
      </button>

      {/* Topic label — opaque chip so it reads as a station floating over the circuit */}
      <div className="mt-3 text-center max-w-[150px] relative z-10">
        <div className={`inline-block bg-surface rounded-xl px-3 py-1 font-semibold text-sm leading-tight ${isCompleted ? 'text-primary' : 'text-on-surface'}`}>
          {nameHe}
        </div>
        {progress > 0 && (
          <div className={`num text-xs font-semibold mt-1.5 px-2 py-0.5 rounded-full inline-block ${isCompleted ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
            {progress}%
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default function StudentHome() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topics = useQuery(api.topics.list);
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const [chatOpen, setChatOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'stats'>('map');
  const reducedMotion = !!useReducedMotion();

  if (!student || !topics) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="font-semibold text-primary tracking-widest text-sm">טוען נתונים אישיים...</span>
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

  const nodeStates = topics.map((topic) => {
    const progress = getProgress(topic._id);
    const isCompleted = progress >= 80;
    const isActive = !isCompleted && (completedTopics === topics.indexOf(topic) || progress > 0);
    return { isCompleted, isActive, progress };
  });

  const currentThemeLabel = student.homeworkTheme
    ? HOMEWORK_THEMES.find(t => t.id === student.homeworkTheme)?.label ?? student.homeworkTheme
    : null;

  return (
    <div className="min-h-screen bg-background text-on-background overflow-x-hidden" dir="rtl">

      {/* ── Top Navigation ── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-3 bg-surface border-b-2 border-outline"
        style={{ boxShadow: 'var(--shadow-clay)' }}
      >
        {/* Left: back + student info */}
        <div className="flex items-center gap-3">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all border-2 border-outline hover:border-primary cursor-pointer"
            onClick={() => navigate("/")}
            aria-label="יציאה"
          >
            <LogOut size={16} />
          </button>

          {/* Avatar + name — opens theme picker */}
          <button
            className="flex items-center gap-2.5 bg-surface-container px-3 py-1.5 rounded-full border-2 border-outline hover:border-primary/50 transition-all active:scale-95 cursor-pointer"
            style={{ boxShadow: 'var(--shadow-clay)' }}
            onClick={() => setThemePickerOpen(true)}
          >
            <div className="relative">
              <CyberAvatar name={student.name} size={32} />
              {student.homeworkTheme && (
                <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center border-2 border-surface">
                  <Star size={7} className="text-white fill-white" />
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-on-surface leading-tight">{student.name}</div>
              {student.homeworkTheme ? (
                <div className="font-semibold text-primary text-[10px] tracking-wide">{currentThemeLabel}</div>
              ) : (
                <div className="font-medium text-on-surface-variant text-[10px]">בחר נושא ✨</div>
              )}
            </div>
          </button>
        </div>

        {/* Center: stats */}
        <div className="hidden md:flex items-center gap-3">
          <div className="stat-chip">
            <Zap className="text-primary" size={15} />
            <span>{totalXP.toLocaleString()} XP</span>
          </div>
          <div className="stat-chip">
            <Flame className="text-tertiary" size={15} />
            <span className="font-bold">{student.streak} ימים</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-surface text-on-surface-variant border-2 border-outline hover:border-primary hover:text-primary rounded-full font-semibold transition-all text-sm cursor-pointer"
            style={{ boxShadow: 'var(--shadow-clay)' }}
            onClick={() => navigate(`/student/${studentId}/homework`)}
          >
            <BookOpen size={15} className="text-primary" />
            <span>שיעורי בית</span>
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm border-2 border-primary-dark transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
            style={{ boxShadow: 'var(--shadow-clay-primary)' }}
            onClick={() => setChatOpen(true)}
          >
            <Bot size={16} />
            <span className="hidden sm:inline">AI מורה</span>
          </button>
        </div>
      </motion.header>

      {/* ── Main Content ── */}
      <div className="pt-[68px] pb-24 md:pb-10 flex flex-col xl:flex-row gap-8 min-h-screen px-6 md:px-16 py-6 w-full max-w-[1600px] mx-auto">

        {/* ── Learning Map ── */}
        <section className="flex-1 relative flex flex-col items-center">
          {/* Section header — circuit-field hero band */}
          <div className="relative w-full max-w-4xl mb-8 rounded-3xl overflow-hidden border-2 border-outline"
            style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-clay)' }}>
            <ElectricField intensity={0.6} density="normal" style={{ zIndex: 0 }} />
            <div className="relative z-10 flex items-center justify-between px-6 py-6">
              <div>
                <h1 className="font-bold text-2xl text-on-surface mb-1" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  מפת הלמידה שלי
                </h1>
                <p className="font-medium text-on-surface-variant text-sm translate-y-2">
                  יחידה {completedTopics + 1} מתוך {topics.length} · המשך את המסע שלך
                </p>
              </div>
              <div className="hidden sm:flex bg-surface rounded-full px-4 py-2 items-center gap-2.5 border-2 border-outline font-semibold text-sm"
                style={{ boxShadow: 'var(--shadow-clay)' }}>
                <Flame className="text-tertiary" size={18} />
                <span className="text-on-surface font-bold">{student.streak} ימים רצוף</span>
              </div>
            </div>
          </div>

          {/* ── MOBILE: card list ── */}
          <div className="flex md:hidden flex-col gap-3 w-full max-w-[24rem]">
            {topics.map((topic, idx) => {
              const { isCompleted, isActive, progress } = nodeStates[idx];
              return (
                <motion.div
                  key={topic._id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                >
                  <button
                    onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-95 cursor-pointer
                      ${isCompleted
                        ? "border-primary/40 bg-primary/5"
                        : isActive
                          ? "border-primary bg-surface"
                          : "border-outline bg-surface"
                      }`}
                    style={{ boxShadow: isCompleted || isActive ? 'var(--shadow-clay-primary)' : 'var(--shadow-clay)' }}
                  >
                    {/* Icon bubble */}
                    <div className={`w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center border-2
                      ${isCompleted
                        ? "bg-primary border-primary-dark"
                        : isActive
                          ? "bg-surface border-primary"
                          : "bg-surface-container border-outline"
                      }`}>
                      {isCompleted ? (
                        <Check className="text-white" size={24} strokeWidth={3} />
                      ) : (
                        <Play className={`${isActive ? 'text-primary' : 'text-on-surface-variant'} fill-current`} size={20} />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-right">
                      <div className={`font-semibold text-base ${isCompleted ? "text-on-surface" : isActive ? "text-on-surface" : "text-on-surface-variant"}`}>
                        {topic.nameHe}
                      </div>
                      <div className="text-xs text-on-surface-variant mt-0.5 font-medium">
                        {isCompleted ? `✓ הושלם · ${progress}%` : progress > 0 ? `${progress}% הושלם` : "לחץ להתחיל ▶"}
                      </div>
                      {progress > 0 && progress < 80 && (
                        <div className="mt-2 w-full bg-surface-container rounded-full h-2 overflow-hidden border border-outline">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* ── DESKTOP: field-line learning path (signature) ── */}
          <div className="hidden md:flex relative w-full max-w-[24rem] py-12 flex-col items-center">
            <div className="w-full flex flex-col gap-[80px] relative pt-4">

              {/* The circuit — a living wire carrying charge toward the next lesson */}
              <div
                className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-[5px] pointer-events-none"
                style={{ zIndex: 0 }}
                aria-hidden
              >
                {/* base track */}
                <div className="absolute inset-0 rounded-full bg-outline" />
                {/* charged (completed) portion */}
                <div
                  className="absolute top-0 left-0 right-0 rounded-full"
                  style={{
                    height: `${Math.min(completedTopics / Math.max(topics.length - 1, 1), 1) * 100}%`,
                    background: 'var(--color-primary)',
                  }}
                >
                  {/* flowing current */}
                  {!reducedMotion && <div className="wire-current absolute inset-0 rounded-full" />}
                  {/* traveling charge pulse — arrives at the active lesson */}
                  {!reducedMotion && completedTopics > 0 && (
                    <div
                      className="charge-pulse absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full"
                      style={{
                        background: 'var(--color-inverse-primary)',
                        boxShadow: '0 0 12px 2px var(--color-inverse-primary)',
                      }}
                    />
                  )}
                </div>
              </div>

              {topics.map((topic, idx) => {
                const { isCompleted, isActive, progress } = nodeStates[idx];
                return (
                  <SkillNode
                    key={topic._id}
                    nameHe={topic.nameHe}
                    idx={idx}
                    isCompleted={isCompleted}
                    isActive={isActive}
                    progress={progress}
                    reducedMotion={reducedMotion}
                    onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Stats Sidebar ── */}
        <aside className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-5">
          <div className="sticky top-20 space-y-4">

            {/* Progress Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface rounded-3xl p-6 border-2 border-outline"
              style={{ boxShadow: 'var(--shadow-clay)' }}
            >
              <h3 className="font-bold text-on-surface mb-5" style={{ fontFamily: "'Assistant', sans-serif" }}>סקירת התקדמות</h3>
              <div className="space-y-4">
                {/* Completed topics */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-on-surface-variant text-sm">נושאים שהושלמו</span>
                    <span className="font-bold text-primary">{completedTopics} / {topics.length}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill-gradient" style={{ width: `${(completedTopics / Math.max(topics.length, 1)) * 100}%` }} />
                  </div>
                </div>

                {/* Accuracy */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-on-surface-variant text-sm">דיוק כולל</span>
                    <span className="font-bold text-secondary">{overallAcc}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${overallAcc}%`, background: 'linear-gradient(to left, var(--color-secondary), var(--color-primary))' }} />
                  </div>
                </div>

                {/* XP */}
                <div className="pt-3 flex items-center justify-between border-t-2 border-outline">
                  <span className="font-medium text-on-surface-variant text-sm">נקודות אנרגיה</span>
                  <span className="font-bold text-primary flex items-center gap-1">
                    <Zap size={15} />
                    {totalXP.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Theme badge */}
            {student.homeworkTheme && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setThemePickerOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-primary/10 border-2 border-primary/30 rounded-2xl hover:bg-primary/15 transition-all text-right cursor-pointer"
                style={{ boxShadow: '0 3px 0 0 rgba(23,201,100,0.2)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 border-2 border-primary/30">
                  <Palette size={18} className="text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-primary text-sm">נושא שיעורי הבית</div>
                  <div className="font-medium text-on-surface text-sm">{currentThemeLabel}</div>
                </div>
              </motion.button>
            )}

            {/* AI Assistant */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-surface rounded-2xl p-5 border-2 border-outline"
              style={{ boxShadow: 'var(--shadow-clay)' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary border-2 border-primary-dark flex-shrink-0 flex items-center justify-center"
                  style={{ boxShadow: 'var(--shadow-clay-primary)' }}>
                  <Bot className="text-white" size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface mb-1.5 text-sm" style={{ fontFamily: "'Assistant', sans-serif" }}>פרופסור פאראדיי</h4>
                  <p className="font-medium text-on-surface-variant leading-relaxed text-sm">
                    שלום! ראיתי שאתה מתקדם יפה.{completedTopics > 0 ? ` השלמת ${completedTopics} נושאים — ` : ' '}
                    מוכן להמשיך? אני כאן אם תצטרך רמז!
                  </p>
                  <button
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm border-2 border-primary-dark cursor-pointer"
                    style={{ boxShadow: 'var(--shadow-clay-primary)' }}
                    onClick={() => setChatOpen(true)}
                  >
                    <MessageSquare size={15} />
                    שאל שאלה
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Mobile stats row */}
            <div className="flex md:hidden items-center justify-around bg-surface rounded-2xl p-4 border-2 border-outline gap-4"
              style={{ boxShadow: 'var(--shadow-clay)' }}>
              <div className="flex items-center gap-2">
                <Zap className="text-primary" size={18} />
                <span className="font-bold text-on-surface text-sm">{totalXP.toLocaleString()} XP</span>
              </div>
              <div className="w-0.5 h-6 bg-outline" />
              <div className="flex items-center gap-2">
                <Flame className="text-tertiary" size={18} />
                <span className="font-bold text-on-surface text-sm">{student.streak} ימים</span>
              </div>
              <div className="w-0.5 h-6 bg-outline" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-primary" size={18} />
                <span className="font-bold text-on-surface text-sm">{completedTopics}/{topics.length}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface border-t-2 border-outline z-50 flex justify-around items-center px-2 py-2"
        style={{ boxShadow: '0 -4px 0 0 var(--color-outline), 0 -1px 8px rgba(0,0,0,0.06)' }}>
        {[
          { icon: Map, label: 'מפה', action: () => navigate(`/student/${studentId}`), active: true },
          { icon: Bot, label: 'מורה AI', action: () => setChatOpen(true), active: false },
          { icon: Activity, label: 'התקדמות', action: () => navigate(`/student/${studentId}/progress`), active: false },
          { icon: Package, label: 'שיעורי בית', action: () => navigate(`/student/${studentId}/homework`), active: false },
          { icon: Palette, label: 'נושא', action: () => setThemePickerOpen(true), active: false },
        ].map(({ icon: Icon, label, action, active }) => (
          <button
            key={label}
            className={`flex flex-col items-center gap-1 min-w-[56px] py-1.5 px-2 rounded-2xl transition-all cursor-pointer
              ${active
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:text-primary'
              }`}
            onClick={action}
          >
            <Icon size={22} />
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        ))}
      </nav>

      {/* Theme Selector */}
      <ThemeSelector
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


