import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef, memo, lazy, Suspense } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { gsap, useScrollReveal } from "../lib/gsapUtils";
import {
  LogOut, BookOpen, Bot, Play, Flame, Check,
  MessageSquare, CheckCircle as CheckCircle2, MapIcon as Map, Activity, Package, Palette, Star,
  RotateCcw,
} from "../components/electric";
import AIChatPanel from "../components/AIChatPanel";
import CyberAvatar from "../components/CyberAvatar";
import { ThemeToggle } from "../components/ThemeContext";

const MathPlayground = lazy(() => import("../components/playground/MathPlayground"));
import ThemeSelector, { HOMEWORK_THEMES } from "../components/ThemeSelector";
import { ElectricBolt, ElectricAtom, Battery } from "../components/electric";
import { SkeletonCard } from "../components/SkeletonCard";
import FaradayCanvas from "../components/FaradayCanvas";

/* ── Serpentine path geometry (per the "Learning Map" design spec) ──
   x is a percentage (0-100) of the path container's width, y is px. The wave
   alternates the node past center every other step (sin period of 4), so the
   circuit zig-zags across the available width instead of running straight down.
   Node slot height is fixed at the largest tier (active, 82px) so every node —
   whatever size it actually renders at — stays vertically centered on the wire. */
const PATH_AMPLITUDE_PCT = 30;
const PATH_NODE_GAP = 160;
const PATH_NODE_SLOT = 82;
const PATH_NODE_CENTER = PATH_NODE_SLOT / 2;

const SKILL_NODE_SIZE = { locked: 58, completed: 64, active: 82 } as const;
const SKILL_ICON_SIZE = { locked: 22, completed: 30, active: 26 } as const;

function buildWirePoints(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    x: 50 + PATH_AMPLITUDE_PCT * Math.sin((idx * Math.PI) / 2),
    y: idx * PATH_NODE_GAP + PATH_NODE_CENTER,
  }));
}

/* Straight zig-zag segments through the given points — the spec's wire is a
   crisp lightning-bolt line, not a curve. */
function buildWirePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

/* ── A single station on the learning circuit ── */
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
  const tier = isCompleted ? "completed" : isActive ? "active" : "locked";
  const size = SKILL_NODE_SIZE[tier];
  const iconSize = SKILL_ICON_SIZE[tier];

  // stagger-pop as the station scrolls into view
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef, { y: 18, scale: 0.55, ease: "back.out(1.9)", duration: 0.6, delay: (idx % 4) * 0.08, start: "top 94%" });

  return (
    <div ref={rootRef} className="flex flex-col items-center relative">
      {/* Field lines — lines of force radiating from the charged (active) node */}
      {tier === "active" && !reducedMotion && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ top: PATH_NODE_CENTER, zIndex: 0 }}
          aria-hidden
        >
          <span className="field-ring absolute left-0 top-0 w-[120px] h-[120px] rounded-full border-2 border-primary/50" />
          <span className="field-ring field-ring--2 absolute left-0 top-0 w-[120px] h-[120px] rounded-full border-2 border-primary/40" />
        </div>
      )}

      {/* Node slot — fixed height so the wire always meets the node's true center,
          regardless of which of the three sizes actually renders inside it. */}
      <div className="flex items-center justify-center" style={{ width: PATH_NODE_SLOT, height: PATH_NODE_SLOT }}>
        <button
          className={`relative rounded-full flex items-center justify-center transition-transform cursor-pointer hover:-translate-y-1 active:translate-y-1 z-10 ${tier === "active" && !reducedMotion ? "skill-node-pulse" : ""} ${tier === "completed" && !reducedMotion ? "skill-node-charged" : ""}`}
          style={{
            width: size,
            height: size,
            filter: tier === "locked" ? "grayscale(0.7)" : undefined,
            background: tier === "completed" ? "var(--color-primary)" : "var(--color-surface)",
            border: tier === "locked" ? "2px solid var(--color-outline)" : tier === "active" ? "5px solid var(--color-primary)" : "none",
            boxShadow: tier === "completed"
              ? "0 0 22px 4px color-mix(in srgb, var(--color-primary) 40%, transparent)"
              : tier === "active"
                ? "0 0 24px 4px color-mix(in srgb, var(--color-primary) 34%, transparent), inset 0 0 12px color-mix(in srgb, var(--color-primary) 20%, transparent)"
                : "none",
          }}
          onClick={onClick}
          aria-label={nameHe}
        >
          {tier === "completed" ? (
            <Check size={iconSize} strokeWidth={3} className="text-primary-dark" />
          ) : (
            <Play size={iconSize} className={`fill-current ${tier === "active" ? "text-primary" : "text-on-surface-variant"}`} />
          )}
        </button>
      </div>

      {/* Topic label — opaque chip so it reads as a station floating over the circuit */}
      <div className="mt-2 text-center max-w-[168px] relative z-10">
        <div
          className={`inline-block rounded-xl px-2.5 py-1 text-sm font-bold leading-tight bg-surface border-[1.5px] ${tier === "locked" ? "border-outline text-on-surface-variant" : "text-on-surface"}`}
          style={tier === "locked" ? undefined : { borderColor: "color-mix(in srgb, var(--color-primary) 33%, transparent)" }}
        >
          {nameHe}
        </div>
        {progress > 0 && (
          <div className={`num font-mono text-xs mt-1 ${isCompleted ? "text-primary font-bold" : "text-on-surface-variant"}`}>
            {progress}%
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Daily-goal ring + weekday streak strip ──
   Both derive from the real streak: the ring shows days active this week
   (capped at 7), and the strip lights the weekdays covered by the streak. */
function WeeklyStreakCard({ streak }: { streak: number }) {
  const days = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
  const today = new Date().getDay(); // 0 = Sunday → matches days[]
  const activeThisWeek = Math.min(today + 1, streak, 7);
  const R = 25;
  const CIRC = 2 * Math.PI * R;
  const ratio = Math.min(activeThisWeek / 7, 1);

  return (
    <div
      className="rounded-[22px] p-5 border-2 border-outline backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--color-surface) 85%, transparent)", boxShadow: "var(--shadow-clay)" }}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-[60px] h-[60px] flex-shrink-0">
          <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="30" cy="30" r={R} fill="none" stroke="var(--color-outline)" strokeWidth="7" />
            <circle
              cx="30" cy="30" r={R} fill="none" stroke="var(--color-primary)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - ratio)} style={{ transition: "stroke-dashoffset 0.7s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="num font-bold text-[15px] text-primary">{activeThisWeek}/7</span>
          </div>
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-[15px] text-on-surface mb-0.5" style={{ fontFamily: "'Assistant', sans-serif" }}>עקביות שבועית</h4>
          <p className="font-medium text-xs text-on-surface-variant leading-snug">
            {activeThisWeek >= 7
              ? "שבוע מושלם — כל הכבוד! ✨"
              : `${activeThisWeek} ${activeThisWeek === 1 ? "יום פעיל" : "ימים פעילים"} השבוע`}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3.5 border-t-2 border-outline">
        <span className="font-semibold text-[11px] text-on-surface-variant">השבוע</span>
        <div className="flex gap-2">
          {days.map((d, i) => {
            const filled = i <= today && today - i < streak;
            const isToday = i === today;
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className={`font-semibold text-[10px] ${isToday ? "text-primary" : "text-on-surface-variant"}`}>{d}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: filled ? "var(--color-primary)" : "var(--color-outline)",
                    boxShadow: isToday && filled ? "0 0 0 2.5px color-mix(in srgb, var(--color-primary) 30%, transparent)" : "none",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Skeleton mirroring the page layout — hero band, map stations, stats sidebar. */
function StudentHomeSkeleton() {
  return (
    <div dir="rtl" className="relative min-h-screen bg-background overflow-x-hidden">
      <div className="page-shell pt-[84px] pb-24 flex flex-col xl:flex-row gap-8">
        <section className="flex-1 flex flex-col items-center">
          <div className="shimmer w-full max-w-4xl rounded-3xl mb-10" style={{ height: 96 }} />
          <div className="flex flex-col gap-12 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2.5"
                style={{ transform: `translateX(${i % 2 === 0 ? -48 : 48}px)` }}
              >
                <div className="shimmer rounded-full" style={{ width: 64, height: 64 }} />
                <div className="shimmer rounded-xl" style={{ width: 96, height: 18 }} />
              </div>
            ))}
          </div>
        </section>
        <aside className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-4">
          <SkeletonCard variant="kpi" />
          <SkeletonCard variant="student-card" />
          <SkeletonCard variant="student-card" />
        </aside>
      </div>
    </div>
  );
}

export default function StudentHome() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const onboarding = useQuery(api.onboarding.getOnboardingState, { studentId: studentId as Id<"students"> });
  const topics = useQuery(api.topics.list);
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const xpSummary = useQuery(api.xp.getXpSummary, { studentId: studentId as Id<"students"> });
  const streakStatus = useQuery(api.streaks.getStreakStatus, { studentId: studentId as Id<"students"> });
  const reviewDeck = useQuery(api.review.getReviewDeck, { studentId: studentId as Id<"students"> });
  const [chatOpen, setChatOpen] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const reducedMotion = !!useReducedMotion();

  // The circuit wire draws itself from the first station to the last on mount
  const wireRef = useRef<SVGPathElement>(null);
  const topicCount = topics?.length ?? 0;
  useEffect(() => {
    const path = wireRef.current;
    if (!path || reducedMotion) return;
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      duration: 1.8,
      ease: "power2.inOut",
      onComplete: () => gsap.set(path, { strokeDasharray: "none", clearProps: "strokeDashoffset" }),
    });
    return () => { tween.kill(); };
  }, [topicCount, reducedMotion]);

  // Don't flash the map while onboarding state loads; redirect new students to
  // the welcome wizard before rendering anything.
  if (!student || !topics || onboarding === undefined) return <StudentHomeSkeleton />;
  if (onboarding?.needed) return <Navigate to={`/student/${studentId}/welcome`} replace />;

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

  const xpBalance = xpSummary?.balance ?? totalXP;
  const reviewCount = reviewDeck?.length ?? 0;
  const streakInDanger = !!streakStatus?.inDanger;
  const freezesAvailable = streakStatus?.freezesAvailable ?? 0;

  const nodeStates = topics.map((topic) => {
    const progress = getProgress(topic._id);
    const isCompleted = progress >= 80;
    const isActive = !isCompleted && (completedTopics === topics.indexOf(topic) || progress > 0);
    return { isCompleted, isActive, progress };
  });

  const wirePoints = buildWirePoints(topics.length);
  const wireHeight = (topics.length - 1) * PATH_NODE_GAP + PATH_NODE_CENTER + 90;
  const fullWireD = buildWirePath(wirePoints);
  const chargedWireD = completedTopics > 0 ? buildWirePath(wirePoints.slice(0, completedTopics + 1)) : "";
  /* One extra segment past the charged prefix reads as "reaching toward" the
     next station — a dimmer green rather than the full bright/flowing charge. */
  const nextWireD = completedTopics > 0 && completedTopics < topics.length - 1
    ? buildWirePath(wirePoints.slice(completedTopics, completedTopics + 2))
    : "";

  const currentThemeLabel = student.homeworkTheme
    ? HOMEWORK_THEMES.find(t => t.id === student.homeworkTheme)?.label ?? student.homeworkTheme
    : null;

  return (
    <div className="relative min-h-screen bg-background text-on-background overflow-x-hidden" dir="rtl">

      {/* ── Magnetic lines-of-force field (full-bleed backdrop) ── */}
      <FaradayCanvas variant="linesOfForce" style={{ zIndex: 0 }} />

      {/* ── Top Navigation ── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-3 border-b-2 border-outline backdrop-blur-md"
        style={{ boxShadow: 'var(--shadow-clay)', background: 'color-mix(in srgb, var(--color-surface) 88%, transparent)' }}
      >
        {/* Left: back + student info */}
        <div className="flex items-center gap-3">
          <button
            className="w-9 h-9 md:w-9 md:h-9 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all border-2 border-outline hover:border-primary cursor-pointer"
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
              {/* Mobile shows XP under the name (matches the phone design); desktop keeps the theme label */}
              <div className="num font-bold text-primary text-[10px] md:hidden">{totalXP.toLocaleString()} XP</div>
              <div className="hidden md:block">
                {student.homeworkTheme ? (
                  <div className="font-semibold text-primary text-[10px] tracking-wide">{currentThemeLabel}</div>
                ) : (
                  <div className="font-medium text-on-surface-variant text-[10px]">בחר נושא ✨</div>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Center: stats */}
        <div className="hidden md:flex items-center gap-3">
          <div className="stat-chip">
            <ElectricBolt tone="spark" size={18} glow={0.55} animated={false} />
            <span>{totalXP.toLocaleString()} XP</span>
          </div>
          <div className="stat-chip">
            <Flame className="text-tertiary" size={15} />
            <span className="font-bold">{student.streak} ימים</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Mobile streak chip (matches the phone design — desktop has the center stats) */}
          <div className="flex md:hidden items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary/12 border-2 border-tertiary/30" style={{ boxShadow: 'var(--shadow-clay)' }}>
            <Flame className="text-tertiary" size={14} />
            <span className="num font-bold text-sm text-on-surface">{student.streak}</span>
          </div>
          <ThemeToggle />
          <button
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-surface text-on-surface-variant border-2 border-outline hover:border-primary hover:text-primary rounded-full font-semibold transition-all text-sm cursor-pointer"
            style={{ boxShadow: 'var(--shadow-clay)' }}
            onClick={() => navigate(`/student/${studentId}/homework`)}
          >
            <BookOpen size={15} className="text-primary" />
            <span>שיעורי בית</span>
          </button>
          <button
            className="flex items-center justify-center gap-2 px-4 py-2.5 min-w-[44px] min-h-[44px] bg-primary text-on-primary rounded-full font-semibold text-sm border-2 border-primary-dark transition-all hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
            style={{ boxShadow: 'var(--shadow-clay-primary)' }}
            onClick={() => setChatOpen(true)}
          >
            <Bot size={16} />
            <span className="hidden sm:inline">AI מורה</span>
          </button>
        </div>
      </motion.header>

      {/* ── Main Content ── */}
      <div className="page-shell relative z-10 pt-[68px] pb-24 md:pb-10 flex flex-col xl:flex-row gap-8 min-h-screen py-6">

        {/* ── Learning Map ── */}
        <section className="flex-1 relative flex flex-col items-center">
          {/* Streak-in-danger banner (amber / tertiary) */}
          {streakInDanger && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl mb-4 rounded-2xl border-2 border-tertiary/40 bg-tertiary/12 px-5 py-3.5 flex items-center gap-3"
              style={{ boxShadow: 'var(--shadow-clay)' }}
              role="alert"
            >
              <Flame className="text-tertiary flex-shrink-0" size={22} />
              <div className="flex-1 text-right">
                <div className="font-bold text-on-surface text-sm">
                  🔥 הרצף שלך בסכנה! פתרו שאלה אחת היום כדי לשמור עליו
                </div>
                {freezesAvailable > 0 && (
                  <div className="font-medium text-on-surface-variant text-xs mt-0.5">
                    יש לך {freezesAvailable} {freezesAvailable === 1 ? "הקפאה" : "הקפאות"}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Quick actions — shop + review entry points */}
          <div className="w-full max-w-4xl mb-4 flex flex-wrap gap-3">
            <button
              onClick={() => navigate(`/student/${studentId}/shop`)}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full bg-surface border-2 border-outline hover:border-primary hover:text-primary transition-all font-semibold text-sm cursor-pointer"
              style={{ boxShadow: 'var(--shadow-clay)' }}
            >
              <ElectricBolt tone="spark" size={17} glow={0.5} animated={false} />
              <span>החנות</span>
              <span className="num font-bold text-primary">{xpBalance.toLocaleString()}</span>
            </button>
            {reviewCount > 0 && (
              <button
                onClick={() => navigate(`/student/${studentId}/review`)}
                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full bg-secondary/10 border-2 border-secondary/30 hover:border-secondary text-secondary transition-all font-semibold text-sm cursor-pointer"
                style={{ boxShadow: 'var(--shadow-clay)' }}
              >
                <RotateCcw size={16} />
                <span>חזרה על טעויות</span>
                <span className="num font-bold px-2 py-0.5 rounded-full bg-secondary text-white text-xs">{reviewCount}</span>
              </button>
            )}
          </div>

          {/* Section header — circuit-field hero band */}
          <div className="relative w-full max-w-4xl mb-8 rounded-3xl overflow-hidden border-2 border-outline backdrop-blur-md"
            style={{ background: 'color-mix(in srgb, var(--color-surface) 82%, transparent)', boxShadow: 'var(--shadow-clay)' }}>
            <div className="relative z-10 flex items-center justify-between px-6 py-6">
              <div>
                <h1 className="font-bold text-2xl text-on-surface mb-1" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  מפת הלמידה שלי
                </h1>
                <p className="font-medium text-on-surface-variant text-sm translate-y-2">
                  יחידה {completedTopics + 1} מתוך {topics.length} · כל שאלה מקרבת אותך ליעד
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
                        {isCompleted ? `✓ הושלם · ${progress}%` : progress > 0 ? `${progress}% — תמשיך מכאן` : "מוכן? בוא נתחיל ▶"}
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

          {/* ── DESKTOP: serpentine field-line learning path (signature) ──
              Nodes zig-zag across the section's width instead of stacking in a
              thin vertical column; a curved SVG wire connects their true centers. */}
          <div className="hidden md:block relative w-full md:max-w-[30rem] lg:max-w-[36rem] xl:max-w-[42rem] mx-auto py-12">
            <div className="relative w-full" style={{ height: wireHeight }}>
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                viewBox={`0 0 100 ${wireHeight}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {/* base track — uncharged, matches the spec's dim atmospheric line */}
                <path ref={wireRef} d={fullWireD} fill="none" stroke="var(--color-outline)" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

                {/* one segment past the charged prefix reads as "reaching toward" the next
                    station — a dimmer green blend, no glow, no flow */}
                {nextWireD && (
                  <path
                    d={nextWireD}
                    fill="none"
                    stroke="color-mix(in srgb, var(--color-primary) 35%, var(--color-outline) 65%)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* charged (completed) portion — stacked translucent strokes fake a glow.
                    A true feGaussianBlur would smear anisotropically here since the viewBox
                    is scaled non-uniformly (preserveAspectRatio="none") for the fluid width. */}
                {chargedWireD && (
                  <>
                    <path d={chargedWireD} fill="none" stroke="var(--color-primary)" strokeWidth="18" strokeLinecap="round" opacity={0.16} vectorEffect="non-scaling-stroke" />
                    <path d={chargedWireD} fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round" opacity={0.3} vectorEffect="non-scaling-stroke" />
                    <path d={chargedWireD} fill="none" stroke="var(--color-primary)" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    {!reducedMotion && (
                      <path
                        d={chargedWireD}
                        fill="none"
                        stroke="var(--color-inverse-primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="10 22"
                        className="wire-current-path"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </>
                )}
              </svg>

              {topics.map((topic, idx) => {
                const { isCompleted, isActive, progress } = nodeStates[idx];
                const { x, y } = wirePoints[idx];
                return (
                  <div
                    key={topic._id}
                    className="absolute"
                    style={{ left: `${x}%`, top: y - PATH_NODE_CENTER, transform: 'translateX(-50%)' }}
                  >
                    <SkillNode
                      nameHe={topic.nameHe}
                      idx={idx}
                      isCompleted={isCompleted}
                      isActive={isActive}
                      progress={progress}
                      reducedMotion={reducedMotion}
                      onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}
                    />
                  </div>
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
              className="rounded-3xl p-6 border-2 border-outline backdrop-blur-md"
              style={{ background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)', boxShadow: 'var(--shadow-clay)' }}
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
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <Battery size={20} tone="spark" glow={0.5} />
                    {totalXP.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Daily goal + weekday streak */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <WeeklyStreakCard streak={student.streak} />
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
              className="rounded-2xl p-5 border-2 border-outline backdrop-blur-md"
              style={{ background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)', boxShadow: 'var(--shadow-clay)' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary border-2 border-primary-dark flex-shrink-0 flex items-center justify-center"
                  style={{ boxShadow: 'var(--shadow-clay-primary)' }}>
                  <ElectricAtom tone="ghost" size={24} glow={0.6} />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface mb-1.5 text-sm" style={{ fontFamily: "'Assistant', sans-serif" }}>מייקל פאראדיי</h4>
                  <p className="font-medium text-on-surface-variant leading-relaxed text-sm">
                    אהלן! אתה בכיוון הנכון.{completedTopics > 0 ? ` כבר ${completedTopics} נושאים מאחוריך — ` : ' '}
                    בוא נמשיך. תקוע על משהו? אני כאן עם רמז.
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
                <ElectricBolt tone="spark" size={20} glow={0.55} animated={false} />
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
        onOpenPlayground={() => setPlaygroundOpen(true)}
      />

      <Suspense fallback={null}>
        <MathPlayground isOpen={playgroundOpen} onClose={() => setPlaygroundOpen(false)} />
      </Suspense>
    </div>
  );
}


