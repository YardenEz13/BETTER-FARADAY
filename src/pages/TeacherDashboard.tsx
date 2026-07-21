import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { useCountUp, useStaggerReveal, useAnimatedValue, type StaggerRevealOptions } from "../lib/gsapUtils";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, LogOut, Users, LayoutGrid, Activity, Bot, BookOpen,
  Moon, Sun, Lightbulb, Send, X, AlertTriangle, Flame, CheckCircle as CheckCircle2,
  Zap, GraduationCap, ElectricBolt, Trophy, Copy, QrCode, Trash2, Sparkles,
  Inductor, TrendingUp, ArrowDown,
} from "../components/electric";
import { QRCodeSVG } from "qrcode.react";

import { AIChatAnalyticsView } from "./AIChatAnalyticsView";
import { HomeworkManagementView } from "./HomeworkManagementView";
import LiveClassPanel from "../components/LiveClassPanel";
import AiReactorPanel from "../components/AiReactorPanel";
import { StudentPowerMapView } from "./StudentPowerMapView";
import { ClayButton, ProgressBar, SegTabs, Skeleton, SkeletonCard, ToastStack, useToasts } from "../components/ui";
import FaradayCanvas from "../components/FaradayCanvas";
import FaradayTour, { type TourStep } from "../components/FaradayTour";
import { useTheme } from "../components/ThemeContext";
import { errorMessage } from "../lib/errors";
import {
  CommandCenterData, CCStudent, CCStatus, CCTone,
  STATUS, LANES, toneColor, avatarStyle, cellColor, segColor, accColor,
  Avatar, Sparkline, Radar, Gauge, MiniRing,
} from "../components/commandCenter";

type View = "triage" | "mastery" | "pulse" | "aiChats" | "homework" | "profile";
type Sort = "risk" | "acc" | "name";
type MasteryMode = "grid" | "radar" | "power";

const NAV: { id: View; label: string; short: string; Icon: typeof Users }[] = [
  { id: "triage", label: "לוח מיון", short: "מיון", Icon: Users },
  { id: "mastery", label: "מפת שליטה", short: "שליטה", Icon: LayoutGrid },
  { id: "pulse", label: "דופק הכיתה", short: "דופק", Icon: Activity },
  { id: "aiChats", label: "שיחות AI", short: "שיחות", Icon: Bot },
  { id: "homework", label: "שיעורי בית", short: "ש״ב", Icon: BookOpen },
];

const RISK_ORDER: Record<CCStatus, number> = { risk: 0, watch: 1, thriving: 2 };

const TOUR_KEY = "faraday_teacher_tour_done";

/** The guided tour walks every teacher view. Each step switches to the view that
 *  owns its target via `onEnter`; the tour waits for that view to mount. */
function teacherTour(setView: (v: View) => void): TourStep[] {
  const on = (v: View) => () => setView(v);
  return [
    {
      key: "health",
      title: "בריאות הכיתה",
      body: "מדד אחד שמסכם את מצב הכיתה כרגע — ממוצע ההצלחה של כל התלמידים בזמן אמת.",
      onEnter: on("triage"),
    },
    {
      key: "kpis",
      title: "המדדים המהירים",
      body: "התלמידים בסיכון, הפעילות היומית והמומנטום — הכול במבט אחד לפני שצוללים פנימה.",
      onEnter: on("triage"),
    },
    {
      key: "nav",
      title: "חמשת המסכים",
      body: "מכאן עוברים בין המסכים — ואנחנו נעשה את זה עכשיו יחד, מסך אחרי מסך.",
      onEnter: on("triage"),
    },
    {
      key: "triage-lanes",
      title: "לוח המיון",
      body: "התלמידים מסודרים לשלושה מסלולים: דורשי התערבות, במעקב, ומשגשגים. לחיצה על תלמיד פותחת את הכרטיס המלא שלו.",
      onEnter: on("triage"),
    },
    {
      key: "mastery-grid",
      title: "מפת השליטה",
      body: "מפת חום של תלמיד מול נושא. כל תא הוא רמת השליטה — כך מזהים נושא שכל הכיתה מתקשה בו, לא רק תלמיד בודד.",
      onEnter: on("mastery"),
    },
    {
      key: "pulse-hero",
      title: "דופק הכיתה",
      body: "אנרגיית הכיתה בזמן אמת — כמה תלמידים פעילים עכשיו, כמה שאלות AI נשאלו, ולאן המגמה הולכת.",
      onEnter: on("pulse"),
    },
    {
      key: "ai-chat-card",
      title: "שיחות ה-AI של התלמידים",
      body: "כל שיחה עם פרופסור פאראדיי נשמרת. פתחנו לכם אחת לדוגמה — אפשר לקרוא את ההתכתבות, לראות רמת בלבול וסנטימנט, ולהבין איפה בדיוק התלמיד נתקע.",
      onEnter: on("aiChats"),
      clickOnArrive: '[data-tour="ai-chat-card"]',
    },
    {
      key: "hw-create",
      title: "יצירת מטלה",
      body: "פתחנו את תפריט היצירה: מטלה אדפטיבית שמתאימה שאלות לכל תלמיד, מטלת PDF אישית, או ייבוא חוברת שלמה — ידנית או אוטומטית עם AI.",
      onEnter: on("homework"),
      clickOnArrive: '[data-tour-click="hw-create"]',
    },
    {
      key: "live",
      title: "שיעור חי",
      body: "פותח מצב שידור: שאלה משותפת למסך של כל הכיתה ותשובות שנכנסות מולכם בזמן אמת.",
      onEnter: on("triage"),
    },
  ];
}

function sortStudents(list: CCStudent[], sort: Sort): CCStudent[] {
  const arr = [...list];
  if (sort === "name") return arr.sort((a, b) => a.name.localeCompare(b.name, "he"));
  if (sort === "acc") return arr.sort((a, b) => b.acc - a.acc);
  return arr.sort((a, b) => RISK_ORDER[a.status] - RISK_ORDER[b.status] || a.acc - b.acc);
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const classroom = useQuery(api.classroom.getFirstClassroom);
  const data = useQuery(api.commandCenter.getCommandCenter, classroom ? { classroomId: classroom._id } : "skip");
  const aiAnalytics = useQuery(api.aiChat.getTeacherChatAnalytics, classroom ? { classroomId: classroom._id } : "skip");
  const digest = useQuery(api.digest.getLatestDigest, classroom ? { classroomId: classroom._id } : "skip");

  const [view, setView] = useState<View>("triage");
  const [masteryView, setMasteryView] = useState<MasteryMode>("grid");
  const [sort, setSort] = useState<Sort>("risk");
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [sel, setSel] = useState<CCStudent | null>(null);
  const [profileId, setProfileId] = useState<Id<"students"> | null>(null);
  const { toasts, push, dismiss } = useToasts(2600);
  const [liveOpen, setLiveOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Phone vs. desktop — drives the bottom-sheet drawer (mobile) vs side drawer (desktop)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobile(m.matches);
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);

  // keep `sel` in sync with fresh data
  const selLive = useMemo(
    () => (sel && data ? data.students.find((s) => s.id === sel.id) ?? null : null),
    [sel, data]
  );

  function fire(msg: string) { push("success", msg); }

  // ── Faraday onboarding tour ── first visit only; wait for data so the
  // data-tour targets exist before the tour measures them.
  const [tourOpen, setTourOpen] = useState(false);
  // stable identity: the tour effect keys off the current step object, so a
  // fresh array each render would re-run it forever
  const tourSteps = useMemo(() => teacherTour(setView), []);
  // depend on the boolean, not `data` — Convex hands back a new object on every
  // real-time update, which would restart the timer before it ever fires
  const dataReady = !!data;
  useEffect(() => {
    if (!dataReady) return;
    let seen: string | null = null;
    try { seen = localStorage.getItem(TOUR_KEY); } catch { /* storage disabled */ }
    if (seen) return;
    const t = window.setTimeout(() => setTourOpen(true), 650);
    return () => window.clearTimeout(t);
  }, [dataReady]);
  const closeTour = () => {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* storage disabled */ }
    setTourOpen(false);
  };

  if (!data) return <TeacherDashboardSkeleton />;

  const onCommandView = view === "triage" || view === "mastery" || view === "pulse";

  return (
    <div dir="rtl" className="relative min-h-screen flex flex-col bg-background">
      <FaradayCanvas variant="induction" style={{ position: "fixed", zIndex: 0 }} />
      <div className="circuit-grid" style={{ position: "fixed", inset: 0, opacity: 0.5, pointerEvents: "none", zIndex: 0 }} />

      {/* ══════════ COMMAND BAR ══════════ */}
      <motion.header
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 flex items-center gap-4 flex-wrap px-4 md:px-6 py-3 border-b-2 border-outline backdrop-blur-xl"
        style={{ background: "color-mix(in srgb, var(--color-surface) 86%, transparent)", boxShadow: "var(--shadow-clay)" }}
      >
        {/* brand + health ring */}
        <div className="flex items-center gap-3 flex-1 min-w-[220px]">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10 border-2 border-primary/25 text-primary glow-primary flex-shrink-0">
              <ElectricBolt size={22} tone="spark" glow={1} />
            </div>
            <div>
              <div className="font-display font-extrabold text-headline-sm leading-none text-on-surface">מה מצבנו?</div>
              <div className="text-label-md text-on-surface-variant mt-0.5">
                {data.classroom?.name ?? "כיתה"} · <span className="num">{data.students.length}</span> תלמידים
              </div>
            </div>
          </div>

          {/* class-health pill */}
          <div data-tour="health" className="hidden sm:flex items-center gap-2.5 ms-1 ps-2 pe-3.5 py-1.5 rounded-full bg-surface-container-low border-2 border-outline shadow-(--shadow-clay)">
            <span className="relative inline-flex items-center justify-center w-[38px] h-[38px]">
              <MiniRing pct={data.classAvg} />
              <span className="num absolute font-extrabold text-label-md text-primary">{data.classAvg}</span>
            </span>
            <div className="leading-tight">
              <div className="num font-extrabold text-[15px] text-on-surface">{data.healthLabel}</div>
              <div className="text-label-sm font-bold uppercase tracking-wide text-on-surface-variant">בריאות הכיתה</div>
            </div>
          </div>
        </div>

        {/* segmented nav — desktop only; mobile uses the bottom tab bar */}
        <nav data-tour="nav" className="order-2 hidden lg:block">
          <SegTabs
            label="ניווט לוח המורה"
            tabs={NAV.map((tab) => ({ id: tab.id, icon: <tab.Icon size={16} />, label: tab.label }))}
            value={view === "profile" ? "triage" : view}
            onChange={setView}
          />
        </nav>

        {/* actions */}
        <div className="order-2 lg:order-3 flex items-center gap-2 ms-auto lg:ms-0">
          <button
            data-tour="live"
            className="flex items-center gap-2 px-3.5 py-2 rounded-full border-2 font-bold text-sm cursor-pointer transition-all hover:-translate-y-0.5"
            style={{ borderColor: "color-mix(in srgb, var(--color-error) 45%, var(--color-outline))", color: "var(--color-error)", boxShadow: "var(--shadow-clay)" }}
            onClick={() => setLiveOpen(true)}
          >
            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
            <span className="hidden sm:inline">שיעור חי</span>
          </button>
          <span className="stat-chip hidden md:inline-flex" style={{ cursor: "default" }}>
            <span className="charge-drift" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary)" }} />
            זמן אמת
          </span>
          <button className="btn-icon" onClick={() => setTourOpen(true)} aria-label="הצג סיור היכרות" title="סיור היכרות">
            <span className="font-bold text-sm leading-none">?</span>
          </button>
          <button className="btn-icon" onClick={toggleTheme} aria-label="מצב תצוגה">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="btn-icon relative" aria-label="התראות">
            <Bell size={17} className={data.atRisk > 0 ? "text-error" : "text-on-surface-variant"} />
            {data.atRisk > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-error border-2 border-surface" />}
          </button>
          <button className="btn-icon" onClick={() => navigate("/")} title="יציאה"><LogOut size={16} /></button>
        </div>
      </motion.header>

      {/* ══════════ MAIN ══════════ */}
      <main className="relative z-10 flex-1 overflow-auto">
        <div className="page-shell page-shell--wide pb-28 lg:pb-24 pt-5">
          {onCommandView && <div data-tour="kpis"><KpiRibbon kpis={data.kpis} /></div>}

          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              {view === "triage" && <TriageView data={data} digest={digest ?? undefined} classroomId={classroom?._id ?? null} leaderboardEnabled={classroom ? classroom.leaderboardEnabled !== false : true} onSelect={setSel} onSelectId={(id) => { const s = data.students.find((st) => st.id === id); if (s) setSel(s); }} fire={fire} onReview={() => setSort("risk")} />}
              {view === "mastery" && (
                <MasteryView
                  data={data}
                  classroomId={classroom?._id ?? null}
                  masteryView={masteryView} setMasteryView={setMasteryView}
                  sort={sort} setSort={setSort}
                  onlyRisk={onlyRisk} setOnlyRisk={setOnlyRisk}
                  onSelect={setSel}
                />
              )}
              {view === "pulse" && <PulseView data={data} onSelect={setSel} />}
              {view === "aiChats" && <div className="-mx-4 md:-mx-6"><AIChatAnalyticsView analytics={aiAnalytics} /></div>}
              {view === "homework" && <div className="-mx-4 md:-mx-6"><HomeworkManagementView classroomId={classroom?._id ?? null} /></div>}
              {view === "profile" && profileId && (
                <div className="-mx-4 md:-mx-6">
                  <StudentPowerMapView studentId={profileId} onBack={() => { setProfileId(null); setView("triage"); }} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ══════════ DRAWER ══════════ */}
      <AnimatePresence>
        {selLive && (
          <StudentDrawer
            s={selLive}
            topics={data.topics}
            isMobile={isMobile}
            onClose={() => setSel(null)}
            onProfile={() => { setProfileId(selLive.id as Id<"students">); setSel(null); setView("profile"); }}
            fire={fire}
          />
        )}
      </AnimatePresence>

      {/* ══════════ LIVE CLASS (שיעור חי) ══════════ */}
      {liveOpen && classroom?._id && (
        <LiveClassPanel classroomId={classroom._id} onClose={() => setLiveOpen(false)} />
      )}

      {/* ══════════ TOAST ══════════ */}
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <FaradayTour open={tourOpen} onClose={closeTour} steps={tourSteps} />

      {/* ══════════ MOBILE BOTTOM TAB BAR ══════════ */}
      <nav
        data-tour="nav"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around items-stretch px-1 pt-1.5 border-t-2 border-outline"
        style={{ background: "color-mix(in srgb, var(--color-surface) 92%, transparent)", backdropFilter: "blur(14px)", paddingBottom: "calc(6px + env(safe-area-inset-bottom))", boxShadow: "0 -4px 0 0 var(--color-outline)" }}
      >
        {NAV.map((tab) => {
          const active = view === tab.id || (tab.id === "triage" && view === "profile");
          return (
            <button
              key={tab.id}
              onClick={() => { setProfileId(null); setView(tab.id); }}
              className={`flex flex-col items-center justify-center gap-1 min-w-[56px] flex-1 py-1.5 rounded-xl transition-colors ${active ? "text-primary bg-primary/10" : "text-on-surface-variant"}`}
            >
              <tab.Icon size={21} />
              <span className="text-label-sm font-bold whitespace-nowrap">{tab.short}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ───────────────────────── LOADING SKELETON ───────────────────────── */
function TeacherDashboardSkeleton() {
  return (
    <div dir="rtl" className="relative min-h-screen bg-background">
      <div className="page-shell page-shell--wide pt-6 pb-24">
        {/* KPI ribbon */}
        <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} variant="kpi" />)}
        </div>
        {/* triage lanes */}
        <div className="flex flex-wrap gap-3.5">
          {Array.from({ length: 3 }).map((_, lane) => (
            <div key={lane} className="flex flex-col gap-2.5" style={{ flex: "1 1 230px", minWidth: 220 }}>
              <Skeleton height={42} rounded={12} />
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} variant="student-card" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── GSAP HELPERS ───────────────────────── */
/* Container whose children stagger-reveal as they scroll into view. */
function StaggerList({ className, style, children, options }: {
  className?: string; style?: React.CSSProperties; children: React.ReactNode; options?: StaggerRevealOptions;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useStaggerReveal(ref, options);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

/* KPI number that counts up from 0 when scrolled into view. */
function KpiValue({ value, suffix }: { value: number; suffix?: string }) {
  const ref = useCountUp<HTMLDivElement>(value, { suffix });
  return <div ref={ref} className="num font-extrabold leading-none mt-3 text-[28px]" />;
}

/* ───────────────────────── KPI RIBBON ───────────────────────── */
function KpiRibbon({ kpis }: { kpis: CommandCenterData["kpis"] }) {
  const ICON: Record<string, typeof Users> = { students: Users, mastery: Zap, active: Activity, ai: Bot, aiUsage: Sparkles, risk: AlertTriangle };
  return (
    <div
      className="flex md:grid gap-3 md:gap-3.5 mb-5 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}
    >
      {kpis.map((k) => {
        const Icon = ICON[k.key] ?? Zap;
        const color = toneColor(k.tone as CCTone);
        const delta = k.spark && k.spark.length >= 2 ? k.spark[k.spark.length - 1] - k.spark[0] : null;
        return (
          <motion.div key={k.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="clay-card flex-shrink-0 w-[150px] md:w-auto px-[15px] py-3.5">
            <div className="flex items-start justify-between gap-2.5">
              <span className="inline-flex items-center justify-center rounded-xl w-[34px] h-[34px]" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                <Icon size={17} />
              </span>
              {delta !== null && delta !== 0 && (
                <span className={`num text-label-md font-bold px-1.5 py-0.5 rounded-md ${delta > 0 ? "text-primary bg-primary/12" : "text-error bg-error/12"}`}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                </span>
              )}
            </div>
            <KpiValue value={k.value} suffix={(k as { suffix?: string }).suffix ?? ""} />
            <div className="flex items-end justify-between gap-2 mt-1">
              <span className="text-label-lg text-on-surface-variant">{k.label}</span>
              <Sparkline values={k.spark} color={color} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── WEEKLY DIGEST ───────────────────────── */
type DigestDoc = NonNullable<FunctionReturnType<typeof api.digest.getLatestDigest>>;

function relDayHe(ms: number): string {
  const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

const ACTION_TONE: Record<string, string> = {
  high: "var(--color-error)",
  medium: "var(--color-tertiary)",
  low: "var(--color-primary)",
};

// Small delta bar chart for per-topic accuracy (this week %, colored by trend).
function TopicDeltaBars({ topics }: { topics: DigestDoc["payload"]["topicDeltas"] }) {
  const withData = topics.filter((t) => t.attempts > 0);
  if (withData.length === 0) return null;
  return (
    <div className="flex items-end gap-2.5 mt-1" style={{ height: 96 }}>
      {withData.map((t) => {
        const up = t.delta > 0, down = t.delta < 0;
        const col = up ? "var(--color-primary)" : down ? "var(--color-error)" : "var(--color-tertiary)";
        return (
          <div key={t.topicId} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${t.name} · ${t.pct}%`}>
            {t.delta !== 0 && (
              <span className="num text-[10px] font-bold" style={{ color: col }}>{up ? "+" : ""}{t.delta}</span>
            )}
            <div className="w-full rounded-t-md rounded-b-sm" style={{ height: `${Math.max(6, t.pct * 0.6)}px`, background: col, boxShadow: `0 0 8px color-mix(in srgb, ${col} 40%, transparent)` }} />
            <span className="num text-[11px] font-extrabold" style={{ color: col }}>{t.pct}%</span>
            <span className="text-[10px] font-semibold text-on-surface-variant text-center leading-tight w-full truncate">{t.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function DigestStudentChip({ c, tone, onClick }: {
  c: DigestDoc["payload"]["struggling"][number]; tone: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="fdr-lift flex items-center gap-2.5 w-full text-start rounded-xl bg-surface p-2.5" style={{ border: "2px solid var(--color-outline)", borderInlineStartWidth: 5, borderInlineStartColor: tone }}>
      <span style={avatarStyle(c.avatarColor, 32, 9, 12)}>{(c.name?.trim()?.[0] ?? "?")}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[13px] truncate">{c.name}</div>
        <div className="text-[11px] text-on-surface-variant truncate">{c.reason}</div>
      </div>
      {c.trend !== 0 && (
        <span className="num text-[12px] font-bold flex-shrink-0" style={{ color: c.trend > 0 ? "var(--color-primary)" : "var(--color-error)" }}>{c.trend > 0 ? "+" : ""}{c.trend}</span>
      )}
    </button>
  );
}

function WeeklyDigest({ digest, classroomId, onSelectStudent, fire }: {
  digest?: DigestDoc; classroomId: Id<"classrooms"> | null;
  onSelectStudent: (id: string) => void; fire: (m: string) => void;
}) {
  const regenerate = useMutation(api.digest.regenerateDigest);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!classroomId || busy) return;
    setBusy(true);
    try {
      await regenerate({ classroomId });
      fire("התקציר השבועי עודכן");
    } catch {
      fire("עדכון התקציר נכשל");
    } finally {
      setBusy(false);
    }
  }

  // Empty state — no digest generated yet.
  if (!digest) {
    return (
      <div className="clay-card circuit-grid relative overflow-hidden mb-4.5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start" style={{ padding: 22, marginBottom: 18 }}>
        <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ width: 52, height: 52, background: "color-mix(in srgb, var(--color-secondary) 14%, transparent)", color: "var(--color-secondary)" }}>
          <GraduationCap size={26} />
        </span>
        <div className="flex-1">
          <div className="font-display font-extrabold text-[17px]">תקציר שבועי</div>
          <p className="text-[13px] text-on-surface-variant mt-0.5">התקציר הראשון ייווצר ביום ראשון. אפשר גם ליצור אותו עכשיו.</p>
        </div>
        <button className="btn-clay-primary flex-shrink-0" style={{ padding: "0.6rem 1.1rem", fontSize: 13.5 }} onClick={run} disabled={busy || !classroomId}>
          {busy ? "יוצר…" : "צור תקציר עכשיו"}
        </button>
      </div>
    );
  }

  const p = digest.payload;
  const t = p.totals;
  return (
    <div className="clay-card circuit-grid relative overflow-hidden mb-4.5" style={{ padding: 22, marginBottom: 18 }}>
      {/* header */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ width: 44, height: 44, background: "color-mix(in srgb, var(--color-secondary) 14%, transparent)", color: "var(--color-secondary)" }}>
          <GraduationCap size={23} />
        </span>
        <div className="flex-1 min-w-[160px]">
          <div className="font-display font-extrabold text-[18px] leading-none">תקציר שבועי</div>
          <div className="text-[11.5px] font-semibold text-on-surface-variant mt-1">7 הימים האחרונים · עודכן {relDayHe(digest.generatedAt)}</div>
        </div>
        <button className="btn-clay-ghost flex items-center gap-1.5 flex-shrink-0" style={{ padding: "0.5rem 0.9rem", fontSize: 12.5 }} onClick={run} disabled={busy}>
          <Zap size={14} className={busy ? "animate-pulse" : ""} /> {busy ? "מרענן…" : "רענן תקציר"}
        </button>
      </div>

      {/* headline numbers */}
      <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
        {[
          { l: "פעילים השבוע", v: `${t.activeStudents}/${t.totalStudents}`, col: "var(--color-secondary)", delta: null as number | null },
          { l: "דיוק כיתתי", v: `${t.accuracy}%`, col: accColor(t.accuracy), delta: t.accuracyDelta },
          { l: "תרגולים", v: `${t.attempts}`, col: "var(--color-on-surface)", delta: null },
          { l: "השלמת ש״ב", v: `${t.homeworkCompletion}%`, col: t.homeworkCompletion >= 70 ? "var(--color-primary)" : "var(--color-tertiary)", delta: null },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-surface-container-low border-2 border-outline" style={{ padding: "11px 13px" }}>
            <div className="text-[11px] font-bold text-on-surface-variant">{k.l}</div>
            <div className="flex items-end gap-1.5">
              <div className="num font-extrabold text-[22px]" style={{ color: k.col }}>{k.v}</div>
              {k.delta !== null && k.delta !== 0 && (
                <span className="num text-[11px] font-bold mb-1" style={{ color: k.delta > 0 ? "var(--color-primary)" : "var(--color-error)" }}>{k.delta > 0 ? "▲" : "▼"}{Math.abs(k.delta)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4.5" style={{ gap: 18 }}>
        {/* students */}
        <div className="flex-1 flex flex-col gap-3" style={{ flexBasis: 300, minWidth: 260 }}>
          {p.struggling.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-[12.5px] font-extrabold text-on-surface-variant"><AlertTriangle size={14} className="text-error" /> דורשים תשומת לב</div>
              <div className="flex flex-col gap-2">
                {p.struggling.map((c) => <DigestStudentChip key={c.studentId} c={c} tone="var(--color-error)" onClick={() => onSelectStudent(c.studentId)} />)}
              </div>
            </div>
          )}
          {p.improving.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-[12.5px] font-extrabold text-on-surface-variant"><Flame size={14} className="text-primary" /> בשיפור</div>
              <div className="flex flex-col gap-2">
                {p.improving.map((c) => <DigestStudentChip key={c.studentId} c={c} tone="var(--color-primary)" onClick={() => onSelectStudent(c.studentId)} />)}
              </div>
            </div>
          )}
        </div>

        {/* actions + topic bars */}
        <div className="flex-1 flex flex-col gap-4" style={{ flexBasis: 320, minWidth: 260 }}>
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-[12.5px] font-extrabold text-on-surface-variant"><Lightbulb size={14} tone="current" animated={false} glow={0.4} /> פעולות מומלצות</div>
            <div className="flex flex-col gap-2">
              {p.recommendedActions.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-surface-container-low border-2 border-outline p-2.5">
                  <span className="mt-1 flex-shrink-0" style={{ width: 8, height: 8, borderRadius: "50%", background: ACTION_TONE[a.priority] ?? "var(--color-primary)", boxShadow: `0 0 8px ${ACTION_TONE[a.priority] ?? "var(--color-primary)"}` }} />
                  <span className="text-[12.5px] font-semibold text-on-surface leading-snug">{a.text}</span>
                </div>
              ))}
            </div>
          </div>
          {p.topicDeltas.some((t) => t.attempts > 0) && (
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[12.5px] font-extrabold text-on-surface-variant"><Zap size={14} className="text-primary" /> דיוק לפי נושא · שינוי שבועי</div>
              <TopicDeltaBars topics={p.topicDeltas} />
            </div>
          )}
        </div>
      </div>

      {p.notableEvents.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-3.5" style={{ borderTop: "2px solid var(--color-outline)" }}>
          {p.notableEvents.map((e, i) => (
            <span key={i} className="stat-chip" style={{ cursor: "default", fontSize: 11.5 }}>
              {e.kind === "streak" ? <Flame size={13} className="text-tertiary" /> : e.kind === "level" ? <GraduationCap size={13} className="text-secondary" /> : <CheckCircle2 size={13} className="text-primary" />}
              <strong>{e.who}</strong> {e.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* Pending level-ups awaiting teacher sign-off.
 * levels.evaluateStudentLevel writes a suggestion whenever a student's power
 * map clears the bar; the weekly digest only *mentions* them as a static chip.
 * This is where they get approved or rejected — nothing else in the app can
 * resolve one, so a pending suggestion would otherwise sit forever. */
function PendingLevelsPanel({ classroomId, fire }: {
  classroomId: Id<"classrooms"> | null; fire: (m: string) => void;
}) {
  const pending = useQuery(api.levels.getPendingSuggestions, classroomId ? { classroomId } : "skip");
  const resolve = useMutation(api.levels.resolveSuggestion);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Nothing pending is the common case — stay out of the way entirely.
  if (!pending || pending.length === 0) return null;

  const decide = async (id: Id<"levelSuggestions">, action: "approved" | "rejected", name: string) => {
    if (busyId) return;
    setBusyId(id);
    setErr(null);
    try {
      await resolve({ suggestionId: id, action });
      fire(action === "approved" ? `${name} עלה/תה רמה` : `העלאת הרמה של ${name} נדחתה`);
    } catch (e) {
      setErr(errorMessage(e, "עדכון הרמה נכשל. נסו שוב."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="clay-card mb-4.5 p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <GraduationCap size={18} className="text-secondary" />
        <span className="font-display font-extrabold text-[15px] text-on-surface">מוכנים לרמה הבאה</span>
        <span className="num font-extrabold text-label-md rounded-full text-on-secondary px-2.5 py-[2px] bg-secondary">{pending.length}</span>
      </div>

      {err && (
        <div role="alert" className="flex items-center gap-2 text-xs font-semibold px-3 py-2 mb-3 rounded-xl border-2"
          style={{ borderColor: "var(--color-error)", color: "var(--color-error)", background: "color-mix(in srgb, var(--color-error) 8%, transparent)" }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {pending.map((s) => (
          <div key={s._id} className="flex items-center gap-3 flex-wrap px-3 py-2.5 rounded-xl bg-surface-container-low border-2 border-outline">
            <span className="flex-1 min-w-[160px] text-[13px] text-on-surface">
              <strong>{s.studentName}</strong>
              <span className="text-on-surface-variant"> · רמה </span>
              <span className="num">{s.currentLevel}</span>
              <span className="text-on-surface-variant"> → </span>
              <span className="num font-extrabold text-secondary">{s.suggestedLevel}</span>
              {s.reason && <span className="text-on-surface-variant"> · {s.reason}</span>}
            </span>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => decide(s._id, "approved", s.studentName)}
                disabled={busyId === s._id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
              >
                <CheckCircle2 size={14} /> אשר
              </button>
              <button
                onClick={() => decide(s._id, "rejected", s.studentName)}
                disabled={busyId === s._id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors disabled:opacity-50"
                style={{ borderColor: "color-mix(in srgb, var(--color-error) 45%, var(--color-outline))", color: "var(--color-error)" }}
              >
                <X size={12} /> דחה
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Small clay toggle row — teacher master switch for the weekly class leaderboard */
function LeaderboardToggleRow({ classroomId, enabled, fire }: {
  classroomId: Id<"classrooms"> | null; enabled: boolean; fire: (m: string) => void;
}) {
  const setEnabled = useMutation(api.leaderboard.setClassroomLeaderboard);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!classroomId || busy) return;
    setBusy(true);
    try {
      await setEnabled({ classroomId, enabled: !enabled });
      fire(!enabled ? "טבלת המובילים הופעלה" : "טבלת המובילים כובתה");
    } catch {
      fire("עדכון טבלת המובילים נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="clay-card flex items-center gap-3.5 mb-4.5" style={{ padding: "14px 18px", marginBottom: 18 }}>
      <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ width: 40, height: 40, background: "color-mix(in srgb, var(--color-tertiary) 15%, transparent)", color: "var(--color-tertiary)" }}>
        <Trophy size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-extrabold text-[15px]">טבלת מובילים שבועית</div>
        <div className="text-[12px] text-on-surface-variant font-semibold mt-0.5">
          {enabled ? "פעיל — התלמידים רואים את ליגת השבוע" : "כבוי — הטבלה מוסתרת מהתלמידים"}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={busy || !classroomId}
        role="switch"
        aria-checked={enabled}
        aria-label="טבלת מובילים שבועית"
        className="relative w-12 h-7 rounded-full border-2 flex-shrink-0 transition-colors cursor-pointer disabled:opacity-60"
        style={{
          background: enabled ? "var(--color-primary)" : "var(--color-surface-container)",
          borderColor: enabled ? "var(--color-primary-dark)" : "var(--color-outline)",
        }}
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white transition-all"
          style={{ insetInlineStart: enabled ? "calc(100% - 22px)" : "2px" }}
        />
      </button>
    </div>
  );
}

/* ───────────────────────── TRIAGE ───────────────────────── */

function TriageView({ data, digest, classroomId, leaderboardEnabled, onSelect, onSelectId, fire, onReview }: {
  data: CommandCenterData; digest?: DigestDoc; classroomId: Id<"classrooms"> | null; leaderboardEnabled: boolean;
  onSelect: (s: CCStudent) => void; onSelectId: (id: string) => void; fire: (m: string) => void; onReview: () => void;
}) {
  const urgentNames = data.students.filter((s) => s.status === "risk").slice(0, 3).map((s) => s.name).join(" · ");
  return (
    <div>
      <WeeklyDigest digest={digest} classroomId={classroomId} onSelectStudent={onSelectId} fire={fire} />

      <PendingLevelsPanel classroomId={classroomId} fire={fire} />

      <LeaderboardToggleRow classroomId={classroomId} enabled={leaderboardEnabled} fire={fire} />

      {data.atRisk > 0 && (
        <div className="fdr-urgent flex items-center gap-3.5 flex-wrap mb-4.5 px-4 py-3.5 rounded-2xl" style={{ background: "color-mix(in srgb, var(--color-error) 10%, var(--color-surface))", border: "2px solid color-mix(in srgb, var(--color-error) 55%, var(--color-outline))" }}>
          <span className="flex items-center justify-center rounded-xl flex-shrink-0 w-10 h-10 bg-error text-on-error" style={{ boxShadow: "0 4px 0 0 color-mix(in srgb, var(--color-error) 45%, transparent)" }}><AlertTriangle size={20} /></span>
          <div className="flex-1 min-w-[180px]">
            <div className="font-extrabold text-[15px] text-on-surface">דרושה התערבות מיידית</div>
            <div className="text-[12.5px] text-on-surface-variant mt-0.5"><span className="num">{data.atRisk}</span> תלמידים מתחת לסף · {urgentNames}</div>
          </div>
          <ClayButton className="px-4 py-2 text-body-sm" onClick={onReview}>סקור עכשיו</ClayButton>
        </div>
      )}

      <div className="flex flex-wrap gap-4.5 items-start">
        <div data-tour="triage-lanes" className="flex-1 flex flex-wrap gap-3.5" style={{ flexBasis: 640, minWidth: 280 }}>
          {LANES.map((lane) => {
            const list = sortStudents(data.students.filter((s) => s.status === lane.key), "acc")
              .sort((a, b) => (lane.key === "thriving" ? b.acc - a.acc : a.acc - b.acc));
            const color = STATUS[lane.key].color;
            return (
              <div key={lane.key} style={{ flex: "1 1 230px", minWidth: 220 }}>
                <div className="flex items-center gap-2.5 mb-3 px-3 py-2 rounded-xl bg-surface border-2 border-outline shadow-(--shadow-clay)">
                  <span className="w-[9px] h-[9px] rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span className="font-display font-extrabold text-[15px]">{lane.he}</span>
                  <span className="num font-extrabold text-body-sm ms-auto rounded-full text-white px-2.5 py-[2px]" style={{ background: color }}>{list.length}</span>
                </div>
                <StaggerList className="flex flex-col gap-2.5" options={{ stagger: 0.04, y: 34 }}>
                  {list.length === 0 && <div className="text-[12px] text-on-surface-variant px-2 py-3">אין תלמידים</div>}
                  {list.map((s) => <StudentCard key={s.id} s={s} topics={data.topics} onSelect={onSelect} fire={fire} />)}
                </StaggerList>
              </div>
            );
          })}
        </div>

        {/* alerts */}
        <div className="clay-card p-5" style={{ flex: "1 1 290px", minWidth: 280 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-extrabold text-[16px]">התראות בזמן אמת</span>
            <span className="charge-drift" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary)" }} />
          </div>
          <p className="text-[12.5px] text-on-surface-variant mb-4">אירועים חיים מהכיתה</p>
          <div className="flex flex-col gap-1">
            {data.alerts.length === 0 && <div className="text-[12.5px] text-on-surface-variant py-2">אין התראות חדשות</div>}
            {data.alerts.map((a, i) => {
              const ALERT_ICON = { error: AlertTriangle, primary: CheckCircle2, tertiary: Flame, secondary: Bot } as const;
              const Icon = ALERT_ICON[a.tone as keyof typeof ALERT_ICON] ?? CheckCircle2;
              const c = toneColor(a.tone as CCTone);
              return (
                <div key={i} className="flex gap-3 py-2.5 px-1">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className="flex items-center justify-center rounded-lg w-[30px] h-[30px]" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, border: `2px solid color-mix(in srgb, ${c} 28%, transparent)` }}><Icon size={15} /></span>
                    {i < data.alerts.length - 1 && <span className="w-0.5 flex-1 bg-outline mt-[3px] min-h-2" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-body-sm">{a.who}</span>
                      <span className="num text-[11px] text-on-surface-variant whitespace-nowrap">{a.timeLabel}</span>
                    </div>
                    <p className="text-[12.5px] text-on-surface-variant mt-0.5 leading-snug">{a.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentCard({ s, topics, onSelect, fire }: { s: CCStudent; topics: CommandCenterData["topics"]; onSelect: (s: CCStudent) => void; fire: (m: string) => void }) {
  const c = STATUS[s.status].color;
  return (
    <div
      className="fdr-lift cursor-pointer rounded-2xl bg-surface p-3.5 border-2 border-outline shadow-(--shadow-clay)"
      style={{ borderInlineStartWidth: 5, borderInlineStartColor: c }}
      onClick={() => onSelect(s)}
    >
      <div className="flex items-center gap-2.5">
        <Avatar s={s} size={36} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] truncate">{s.name}</div>
          <div className="text-[11px] text-on-surface-variant mt-px">{s.lastLabel}</div>
        </div>
        <div className="text-center leading-none">
          <div className="num font-extrabold text-[18px]" style={{ color: accColor(s.acc) }}>{s.acc}<span className="text-[11px]">%</span></div>
          {s.trend !== 0 && <span className="num text-[11px] font-bold" style={{ color: s.trend > 0 ? "var(--color-primary)" : "var(--color-error)" }}>{s.trend > 0 ? "+" : ""}{s.trend}</span>}
        </div>
      </div>
      {/* mastery segments */}
      <div className="flex gap-[3px] mt-3">
        {s.mastery.map((m, i) => (
          <span key={i} title={`${topics[i]?.name ?? ""} · ${m.attempts > 0 ? m.pct + "%" : "אין נתון"}`} style={{ flex: 1, height: 7, borderRadius: 99, background: segColor(m.pct, m.attempts > 0) }} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[11px] font-semibold text-on-surface-variant me-auto truncate">
          {s.weak ? <>חולשה: {s.weak.name} · <span className="num">{s.weak.pct}%</span></> : "אין מספיק נתונים"}
        </span>
        <button onClick={(e) => { e.stopPropagation(); fire(`רמז נשלח אל ${s.name}`); }} title="שלח רמז" className="flex items-center justify-center rounded-lg w-[30px] h-[30px] border-2 border-outline bg-surface text-tertiary"><Lightbulb size={17} tone="current" animated={false} glow={0.4} /></button>
        <button onClick={(e) => { e.stopPropagation(); fire(`הודעה נשלחה אל ${s.name}`); }} title="שלח הודעה" className="flex items-center justify-center rounded-lg w-[30px] h-[30px] border-2 border-outline bg-surface text-secondary"><Send size={15} /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── MASTERY ───────────────────────── */
function MasteryView({ data, classroomId, masteryView, setMasteryView, sort, setSort, onlyRisk, setOnlyRisk, onSelect }: {
  data: CommandCenterData; classroomId: Id<"classrooms"> | null;
  masteryView: MasteryMode; setMasteryView: (v: MasteryMode) => void;
  sort: Sort; setSort: (s: Sort) => void; onlyRisk: boolean; setOnlyRisk: (b: boolean) => void; onSelect: (s: CCStudent) => void;
}) {
  let students = data.students;
  if (onlyRisk) students = students.filter((s) => s.status !== "thriving");
  students = sortStudents(students, sort);

  return (
    <div>
      {/* controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <SegTabs
          label="תצוגת שליטה"
          tabs={[
            { id: "grid", icon: <LayoutGrid size={14} />, label: "מפת חום" },
            { id: "radar", icon: <GraduationCap size={14} />, label: "רדאר" },
            { id: "power", icon: <Inductor size={14} />, label: "מפת עוצמה" },
          ]}
          value={masteryView}
          onChange={setMasteryView}
        />
        <span className="hidden sm:block w-px h-[26px] bg-outline" />
        <span className="text-body-sm font-bold text-on-surface-variant hidden sm:inline">מיון</span>
        <SegTabs
          label="מיון תלמידים"
          tabs={(["risk", "acc", "name"] as Sort[]).map((sKey) => ({
            id: sKey,
            label: sKey === "risk" ? "סיכון" : sKey === "acc" ? "דיוק" : "א־ב",
          }))}
          value={sort}
          onChange={setSort}
        />
        <button onClick={() => setOnlyRisk(!onlyRisk)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-[12.5px] font-bold ${onlyRisk ? "border-primary bg-primary/10 text-primary" : "border-outline bg-surface text-on-surface-variant"}`}>
          <span className="inline-flex items-center justify-center rounded w-4 h-4 border-2 border-current text-label-sm">{onlyRisk ? "✓" : ""}</span>
          רק דורשי תשומת לב
        </button>
        <span className="num text-label-lg font-normal text-on-surface-variant ms-auto hidden md:inline">{students.length} תלמידים</span>
      </div>

      {/* topic strip */}
      <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(124px, 1fr))" }}>
        {data.topicAverages.map((t) => {
          const col = t.pct >= 78 ? "var(--color-primary)" : t.pct >= 55 ? "var(--color-tertiary)" : "var(--color-error)";
          return (
            <div key={t.topicId} className="fdr-lift bg-surface border-2 border-outline rounded-xl px-[11px] py-2.5 shadow-(--shadow-clay)">
              <div className="text-[11.5px] font-bold text-on-surface-variant truncate">{t.name}</div>
              <div className="num font-extrabold my-1 text-[19px]" style={{ color: t.attempts > 0 ? col : "var(--color-on-surface-variant)" }}>{t.attempts > 0 ? `${t.pct}%` : "—"}</div>
              <ProgressBar value={t.pct} color={col} label={t.name} className="h-[7px]" />
            </div>
          );
        })}
      </div>

      {masteryView === "power" ? (
        <ClassPowerMap classroomId={classroomId} />
      ) : masteryView === "grid" ? (
        <MasteryGrid data={data} students={students} onSelect={onSelect} />
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))" }}>
          {students.map((s) => (
            <div key={s.id} className="clay-card fdr-lift cursor-pointer p-3.5" onClick={() => onSelect(s)}>
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar s={s} size={32} radius={9} fs={13} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-body-sm truncate">{s.name}</div>
                  <div className="text-[10.5px] font-bold" style={{ color: STATUS[s.status].color }}>{STATUS[s.status].he}</div>
                </div>
                <span className="num font-extrabold text-[14px]" style={{ color: accColor(s.acc) }}>{s.acc}%</span>
              </div>
              <Radar values={s.mastery.map((m) => m.pct)} labels={data.topics.map((t) => t.name)} showLabels stroke={STATUS[s.status].color} fill={`color-mix(in srgb, ${STATUS[s.status].color} 22%, transparent)`} glow={`color-mix(in srgb, ${STATUS[s.status].color} 50%, transparent)`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── CLASS POWER MAP ─────────────────────────
 * Mastery as the AI tutor sees it. The heat-map/radar modes score students on
 * answer accuracy; this one reads studentPowerMap, which is recomputed from
 * Faraday session briefs — so a student who answers correctly but leans on
 * hints shows up weak here and strong there. Only students who have actually
 * talked to Faraday have a row.
 */
function ClassPowerMap({ classroomId }: { classroomId: Id<"classrooms"> | null }) {
  const maps = useQuery(api.powerMap.getClassroomPowerMaps, classroomId ? { classroomId } : "skip");

  if (maps === undefined) {
    return (
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} variant="student-card" />)}
      </div>
    );
  }
  if (maps.length === 0) {
    return (
      <div className="clay-card p-8 text-center">
        <Inductor size={40} glow={0.6} className="mx-auto mb-3 text-on-surface-variant" />
        <div className="font-display font-extrabold text-[16px] text-on-surface mb-1">אין עדיין מפות עוצמה</div>
        <p className="text-[13px] text-on-surface-variant m-0">מפת העוצמה נבנית משיחות עם פאראדיי. ברגע שתלמידים יתחילו לשוחח, הנתונים יופיעו כאן.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {maps.map((m) => {
        const ranked = [...m.topicMastery].sort((a, b) => b.masteryScore - a.masteryScore);
        const best = ranked[0];
        const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
        const avg = ranked.length
          ? Math.round(ranked.reduce((s, t) => s + t.masteryScore, 0) / ranked.length)
          : 0;
        const col = avg >= 70 ? "var(--color-primary)" : avg >= 40 ? "var(--color-tertiary)" : "var(--color-error)";
        return (
          <div key={m._id} className="clay-card p-3.5">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-[13px] flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${m.avatarColor ?? col} 20%, var(--color-surface))`, border: `2px solid ${m.avatarColor ?? col}` }}>
                {m.studentName.charAt(0)}
              </span>
              <span className="font-extrabold text-[14px] text-on-surface truncate flex-1 min-w-0">{m.studentName}</span>
              <span className="num font-extrabold text-[17px] flex-shrink-0" style={{ color: col }}>{avg}%</span>
            </div>
            <ProgressBar value={avg} color={col} label={`עוצמה ממוצעת של ${m.studentName}`} className="h-[7px] mb-3" />
            <div className="flex flex-col gap-1.5 text-[12px]">
              {best && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <TrendingUp size={13} className="flex-shrink-0" style={{ color: "var(--color-primary)" }} />
                  <span className="text-on-surface-variant flex-shrink-0">חזק ב־</span>
                  <span className="text-on-surface font-bold truncate">{best.topicName}</span>
                  <span className="num text-on-surface-variant flex-shrink-0">{best.masteryScore}%</span>
                </div>
              )}
              {worst && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <ArrowDown size={13} className="flex-shrink-0" style={{ color: "var(--color-error)" }} />
                  <span className="text-on-surface-variant flex-shrink-0">חלש ב־</span>
                  <span className="text-on-surface font-bold truncate">{worst.topicName}</span>
                  <span className="num text-on-surface-variant flex-shrink-0">{worst.masteryScore}%</span>
                </div>
              )}
              <div className="num text-[11px] text-on-surface-variant mt-1">
                {m.engagement.totalSessions} שיחות · {m.progressVelocity.overall} בשבוע
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MasteryGrid({ data, students, onSelect }: { data: CommandCenterData; students: CCStudent[]; onSelect: (s: CCStudent) => void }) {
  const cols = data.topics.length;
  const template = `minmax(150px, 200px) repeat(${cols}, minmax(46px, 1fr))`;
  // heat cells fill in a start-to-end cascade as the grid scrolls into view
  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(gridRef, { selector: ".mg-cell", stagger: 0.006, y: 0, scale: 0.55, duration: 0.35, ease: "power2.out" });
  return (
    <div ref={gridRef} data-tour="mastery-grid" className="clay-card p-4 overflow-x-auto">
      <div style={{ minWidth: 120 + cols * 60 }}>
        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: template }}>
          <div className="text-label-md font-bold text-on-surface-variant flex items-end ps-1 pb-1.5">תלמיד · שליטה כוללת</div>
          {data.topics.map((t) => (
            <div key={t.id} className="text-[10.5px] font-bold text-center text-on-surface-variant flex items-end justify-center pb-1.5 leading-tight" title={t.name}>{t.name}</div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {students.map((s) => (
            <div key={s.id} className="grid gap-1.5" style={{ gridTemplateColumns: template }}>
              <div className="fdr-lift cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-xl bg-surface-container-low border-2 border-outline" onClick={() => onSelect(s)}>
                <Avatar s={s} size={28} radius={8} fs={12} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[12px] truncate">{s.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--color-surface-container-high)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${s.acc}%`, background: accColor(s.acc) }} /></span>
                    <span className="num text-[11px] font-bold text-on-surface-variant">{s.acc}</span>
                  </div>
                </div>
              </div>
              {s.mastery.map((m, i) => {
                const cc = cellColor(m.pct, m.attempts > 0);
                return (
                  <div key={i} onClick={() => onSelect(s)} className="mg-cell num flex items-center justify-center cursor-pointer rounded-lg font-bold text-[12px]" style={{ background: cc.bg, color: cc.fg, boxShadow: cc.glow, minHeight: 38 }}>
                    {m.attempts > 0 ? m.pct : "—"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 flex-wrap text-[12px] text-on-surface-variant">
          {[["שליטה מלאה", "var(--color-primary)"], ["טובה", "color-mix(in srgb, var(--color-primary) 48%, var(--color-surface))"], ["חלקית", "color-mix(in srgb, var(--color-tertiary) 52%, var(--color-surface))"], ["דורש התערבות", "color-mix(in srgb, var(--color-error) 42%, var(--color-surface))"]].map(([lbl, bg]) => (
            <span key={lbl} className="inline-flex items-center gap-1.5"><span style={{ width: 16, height: 16, borderRadius: 5, background: bg }} /> {lbl}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── PULSE ───────────────────────── */
function PulseView({ data, onSelect }: { data: CommandCenterData; onSelect: (s: CCStudent) => void }) {
  const ticker = data.ticker.length > 0 ? data.ticker : [{ tone: "primary" as CCTone, who: "המערכת", text: "ממתינה לפעילות" }];
  // one shared 0→target charge-up drives the gauge, its readout, and the reactor dials
  const animAvg = useAnimatedValue(data.classAvg);
  const chargeRatio = data.classAvg > 0 ? animAvg / data.classAvg : 1;
  return (
    <div>
      {/* energy hero */}
      <div data-tour="pulse-hero" className="clay-card circuit-grid flex items-center justify-center gap-12 flex-wrap relative overflow-hidden mb-4.5 p-[30px]">
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 220, height: 220 }}>
          <div className="field-ring" style={{ position: "absolute", left: "50%", top: "50%", width: 200, height: 200, borderRadius: "50%", border: "2px solid var(--color-primary)" }} />
          <div className="field-ring field-ring--2" style={{ position: "absolute", left: "50%", top: "50%", width: 200, height: 200, borderRadius: "50%", border: "2px solid var(--color-primary)" }} />
          <Gauge pct={animAvg} />
          <div className="absolute z-[2] text-center">
            <div className="num font-extrabold text-primary leading-none text-[52px]">{Math.round(animAvg)}<span className="text-[24px]">%</span></div>
            <div className="text-label-lg font-bold text-on-surface-variant mt-1">אנרגיית הכיתה</div>
          </div>
        </div>
        <div className="flex flex-col gap-3.5" style={{ minWidth: 200 }}>
          <div className="font-display font-extrabold" style={{ fontSize: 22 }}>{data.classAvg >= 65 ? "הכיתה טעונה" : "הכיתה צוברת מתח"}</div>
          <p className="text-[13.5px] text-on-surface-variant m-0 max-w-[280px] leading-relaxed">מבט חי על זרם הלמידה — ככל שהטבעת ירוקה ומלאה יותר, כך הכיתה פעילה ומדויקת יותר.</p>
          <div className="flex gap-2.5 flex-wrap">
            <span className="stat-chip cursor-default"><Activity size={15} className="text-primary" /> <span className="num">{data.activeNow}</span> פעילים</span>
            <span className="stat-chip cursor-default"><Bot size={15} className="text-secondary" /> <span className="num">{data.aiToday}</span> שאלות AI</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4.5 flex-wrap items-start">
        {/* topic reactors */}
        <div className="clay-card p-[22px]" style={{ flex: "1 1 460px" }}>
          <div className="font-display font-extrabold text-[16px] mb-4">ריאקטורי נושאים</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))" }}>
            {data.topicAverages.map((t) => {
              const col = t.pct >= 80 ? "var(--color-primary)" : t.pct >= 45 ? "var(--color-tertiary)" : "var(--color-error)";
              const has = t.attempts > 0;
              return (
                <div key={t.topicId} className="flex flex-col items-center gap-2">
                  <div className="relative" style={{ width: 72, height: 72, borderRadius: "50%", background: has ? `conic-gradient(${col} ${t.pct * 3.6 * chargeRatio}deg, var(--color-surface-container-high) 0)` : "var(--color-surface-container-high)" }}>
                    <div className="absolute inset-[9px] rounded-full flex items-center justify-center" style={{ background: "var(--color-surface)" }}>
                      <span className="num font-extrabold text-[15px]" style={{ color: has ? col : "var(--color-on-surface-variant)" }}>{has ? t.pct : "—"}</span>
                    </div>
                    {has && <span className="charge-drift" style={{ position: "absolute", top: -2, left: "50%", marginLeft: -3, width: 6, height: 6, borderRadius: "50%", background: col, boxShadow: `0 0 8px ${col}` }} />}
                  </div>
                  <span className="text-[11px] font-bold text-on-surface-variant text-center leading-tight">{t.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* constellation */}
        <div className="clay-card p-[22px]" style={{ flex: "1 1 380px" }}>
          <div className="font-display font-extrabold text-[16px] mb-1">קונסטלציית תלמידים</div>
          <p className="text-[12px] text-on-surface-variant mb-4">גודל וזוהר = רמת שליטה · הקש לפרטים</p>
          <StaggerList className="flex flex-wrap gap-3 justify-center items-center" style={{ minHeight: 150 }}
            options={{ random: true, scale: 0, y: 14, ease: "back.out(2.4)", stagger: 0.05, duration: 0.6 }}>
            {data.students.map((s) => {
              const col = STATUS[s.status].color;
              const size = 32 + Math.round((s.acc / 100) * 34);
              return (
                <div key={s.id} onClick={() => onSelect(s)} title={s.name} className="fdr-lift cursor-pointer flex items-center justify-center font-extrabold"
                  style={{ width: size, height: size, borderRadius: "50%", fontSize: size * 0.34, color: `color-mix(in srgb, ${col} 80%, var(--color-on-surface))`, background: `color-mix(in srgb, ${col} 20%, var(--color-surface))`, border: `2px solid ${col}`, boxShadow: s.status === "thriving" ? `0 0 14px color-mix(in srgb, ${col} 55%, transparent)` : "none" }}>
                  {s.initial}
                </div>
              );
            })}
          </StaggerList>
        </div>
      </div>

      <AiReactorPanel />

      {/* ticker */}
      <div className="clay-card mt-4.5 overflow-hidden">
        <div className="flex items-center">
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 font-extrabold text-[12.5px] px-[18px] py-[13px] bg-primary text-on-primary">
            <span className="charge-drift w-2 h-2 rounded-full bg-on-primary" /> חי
          </span>
          <div className="flex-1 overflow-hidden">
            <div className="cc-marquee inline-flex whitespace-nowrap" style={{ gap: 36, paddingInline: 24 }}>
              {[...ticker, ...ticker].map((tk, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-body-sm">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: toneColor(tk.tone as CCTone) }} />
                  <strong>{tk.who}</strong> <span className="text-on-surface-variant">{tk.text}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── DRAWER ───────────────────────── */
function StudentDrawer({ s, topics, isMobile, onClose, onProfile, fire }: { s: CCStudent; topics: CommandCenterData["topics"]; isMobile: boolean; onClose: () => void; onProfile: () => void; fire: (m: string) => void }) {
  const c = STATUS[s.status].color;
  return (
    <div className="fixed inset-0 z-[60]">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0" style={{ background: "color-mix(in srgb, var(--color-background) 55%, transparent)", backdropFilter: "blur(3px)" }} />
      <motion.div
        initial={isMobile ? { y: "100%" } : { x: "-100%" }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: "100%" } : { x: "-100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className={isMobile
          ? "absolute inset-x-0 bottom-0 max-h-[90%] overflow-y-auto rounded-t-[28px] border-2 border-outline px-5 pt-3 pb-6"
          : "absolute inset-y-0 start-0 overflow-y-auto p-6"}
        style={isMobile
          ? { background: "var(--color-surface)", boxShadow: "var(--shadow-lg)" }
          : { width: 420, maxWidth: "92vw", background: "var(--color-surface)", borderInlineEnd: "2px solid var(--color-outline)", boxShadow: "var(--shadow-lg)" }}
      >
        {isMobile && <div className="w-11 h-1.5 rounded-full bg-outline mx-auto mb-3.5" />}
        <div className="flex items-center gap-3 mb-4.5">
          <span style={avatarStyle(s.avatarColor, 46, 13, 18)}>{s.initial}</span>
          <div className="flex-1">
            <div className="font-display font-extrabold text-headline-md">{s.name}</div>
            <span className="text-label-lg font-bold" style={{ color: c }}>{STATUS[s.status].he}</span>
          </div>
          <ClayButton variant="icon" onClick={onClose} aria-label="סגור" className="w-[38px] h-[38px]"><X size={17} /></ClayButton>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4.5">
          {[
            { l: "דיוק כללי", v: `${s.acc}%`, col: accColor(s.acc) },
            { l: "מגמה שבועית", v: `${s.trend > 0 ? "+" : ""}${s.trend}`, col: s.trend > 0 ? "var(--color-primary)" : s.trend < 0 ? "var(--color-error)" : "var(--color-on-surface)" },
            { l: "רצף", v: `${s.streak}`, col: "var(--color-tertiary)" },
            { l: "דקות היום", v: `${s.minutes}`, col: "var(--color-on-surface)" },
          ].map((t) => (
            <div key={t.l} className="bg-surface-container-low border-2 border-outline rounded-[13px] px-[13px] py-[11px]">
              <div className="text-label-md font-bold text-on-surface-variant">{t.l}</div>
              <div className="num font-extrabold text-[22px]" style={{ color: t.col }}>{t.v}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center py-2">
          <div className="w-full max-w-[280px]">
            <Radar values={s.mastery.map((m) => m.pct)} labels={topics.map((t) => t.name)} size={230} showLabels stroke={c} fill={`color-mix(in srgb, ${c} 26%, transparent)`} glow={`color-mix(in srgb, ${c} 50%, transparent)`} />
          </div>
        </div>

        <div className="flex gap-2 mt-3.5">
          <ClayButton variant="secondary" className="flex-1 px-2 py-[0.6rem] text-body-sm" onClick={() => fire(`רמז נשלח אל ${s.name}`)}>שלח רמז</ClayButton>
          <ClayButton variant="ghost" className="flex-1 px-2 py-[0.6rem] text-body-sm" onClick={() => fire(`הודעה נשלחה אל ${s.name}`)}>הודעה</ClayButton>
          <ClayButton className="flex-1 px-2 py-[0.6rem] text-body-sm" onClick={onProfile}>פרופיל מלא</ClayButton>
        </div>

        <ParentLinkSection studentId={s.id as Id<"students">} studentName={s.name} fire={fire} />
      </motion.div>
    </div>
  );
}

/* ─────────── PARENT LINK (capability URL for the weekly parent report) ─────────── */
function ParentLinkSection({ studentId, studentName, fire }: { studentId: Id<"students">; studentName: string; fire: (m: string) => void }) {
  const create = useMutation(api.parentReports.createParentLink);
  const revoke = useMutation(api.parentReports.revokeParentLink);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const r = await create({ studentId });
      setUrl(`${window.location.origin}${r.path}`);
    } catch {
      fire("יצירת הקישור נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for insecure contexts / older browsers.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    fire("הקישור הועתק");
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRevoke = async () => {
    if (!window.confirm(`לבטל את קישור ההורים של ${studentName}? הקישור הקיים יפסיק לעבוד.`)) return;
    setBusy(true);
    try {
      await revoke({ studentId });
      setUrl(null);
      setShowQr(false);
      fire("הקישור בוטל");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "2px solid var(--color-outline)" }}>
      <div className="flex items-center gap-1.5 mb-2.5 text-on-surface-variant">
        <Users size={14} />
        <span className="text-[12px] font-bold">קישור להורים</span>
      </div>

      {!url ? (
        <button
          className="btn-clay-secondary w-full"
          style={{ padding: "0.6rem 0.5rem", fontSize: 13 }}
          disabled={busy}
          onClick={handleGenerate}
        >
          {busy ? "יוצר…" : "צור קישור לדוח שבועי"}
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div
            className="text-[11px] px-3 py-2 rounded-lg break-all font-mono"
            style={{ background: "var(--color-surface-container-low)", border: "2px solid var(--color-outline)", direction: "ltr", textAlign: "left" }}
          >
            {url}
          </div>
          <div className="flex gap-2">
            <button className="btn-clay-primary flex-1 flex items-center justify-center gap-1.5" style={{ padding: "0.5rem", fontSize: 12 }} onClick={handleCopy}>
              <Copy size={14} /> {copied ? "הועתק!" : "העתק"}
            </button>
            <button className="btn-clay-ghost flex items-center justify-center gap-1.5" style={{ padding: "0.5rem 0.7rem", fontSize: 12 }} onClick={() => setShowQr((v) => !v)}>
              <QrCode size={14} /> QR
            </button>
            <button className="btn-clay-ghost flex items-center justify-center gap-1.5" style={{ padding: "0.5rem 0.7rem", fontSize: 12, color: "var(--color-error)" }} disabled={busy} onClick={handleRevoke}>
              <Trash2 size={14} /> בטל קישור
            </button>
          </div>
          {showQr && (
            <div className="flex justify-center py-2">
              <div className="rounded-xl bg-white p-3 shadow-inner">
                <QRCodeSVG value={url} size={160} level="M" includeMargin={false} />
              </div>
            </div>
          )}
          <p className="text-[11px] text-on-surface-variant leading-snug">
            שתפו את הקישור עם ההורים בלבד — הוא אישי לתלמיד/ה וניתן לביטול בכל עת.
          </p>
        </div>
      )}
    </div>
  );
}
