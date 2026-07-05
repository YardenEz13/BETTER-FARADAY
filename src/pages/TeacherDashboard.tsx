import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { useCountUp, useStaggerReveal, useAnimatedValue, type StaggerRevealOptions } from "../lib/gsapUtils";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, LogOut, Users, LayoutGrid, Activity, Bot, BookOpen,
  Moon, Sun, Lightbulb, Send, X, AlertTriangle, Flame, CheckCircle as CheckCircle2,
  Zap, GraduationCap, ElectricBolt
} from "../components/electric";

import { AIChatAnalyticsView } from "./AIChatAnalyticsView";
import { HomeworkManagementView } from "./HomeworkManagementView";
import { StudentPowerMapView } from "./StudentPowerMapView";
import { SkeletonCard } from "../components/SkeletonCard";
import FaradayCanvas from "../components/FaradayCanvas";
import { useTheme } from "../components/ThemeContext";
import {
  CommandCenterData, CCStudent, CCStatus, CCTone,
  STATUS, LANES, toneColor, avatarStyle, cellColor, segColor, accColor,
  Avatar, Sparkline, Radar, Gauge, MiniRing,
} from "../components/commandCenter";

type View = "triage" | "mastery" | "pulse" | "aiChats" | "homework" | "profile";
type Sort = "risk" | "acc" | "name";

const NAV: { id: View; label: string; short: string; Icon: typeof Users }[] = [
  { id: "triage", label: "לוח מיון", short: "מיון", Icon: Users },
  { id: "mastery", label: "מפת שליטה", short: "שליטה", Icon: LayoutGrid },
  { id: "pulse", label: "דופק הכיתה", short: "דופק", Icon: Activity },
  { id: "aiChats", label: "שיחות AI", short: "שיחות", Icon: Bot },
  { id: "homework", label: "שיעורי בית", short: "ש״ב", Icon: BookOpen },
];

const RISK_ORDER: Record<CCStatus, number> = { risk: 0, watch: 1, thriving: 2 };

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

  const [view, setView] = useState<View>("triage");
  const [masteryView, setMasteryView] = useState<"grid" | "radar">("grid");
  const [sort, setSort] = useState<Sort>("risk");
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [sel, setSel] = useState<CCStudent | null>(null);
  const [profileId, setProfileId] = useState<Id<"students"> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // keep `sel` in sync with fresh data
  const selLive = useMemo(
    () => (sel && data ? data.students.find((s) => s.id === sel.id) ?? null : null),
    [sel, data]
  );

  function fire(msg: string) { setToast(msg); }

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
              <div className="font-display font-extrabold text-[17px] leading-none text-on-surface">מה מצבנו?</div>
              <div className="text-[11px] font-semibold text-on-surface-variant mt-0.5">
                {data.classroom?.name ?? "כיתה"} · <span className="num">{data.students.length}</span> תלמידים
              </div>
            </div>
          </div>

          {/* class-health pill */}
          <div className="hidden sm:flex items-center gap-2.5 ms-1 ps-2 pe-3.5 py-1.5 rounded-full bg-surface-container-low border-2 border-outline" style={{ boxShadow: "var(--shadow-clay)" }}>
            <span className="relative inline-flex items-center justify-center" style={{ width: 38, height: 38 }}>
              <MiniRing pct={data.classAvg} />
              <span className="num absolute font-extrabold text-[11px] text-primary">{data.classAvg}</span>
            </span>
            <div className="leading-tight">
              <div className="num font-extrabold text-[15px] text-on-surface">{data.healthLabel}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">בריאות הכיתה</div>
            </div>
          </div>
        </div>

        {/* segmented nav — desktop only; mobile uses the bottom tab bar */}
        <nav className="order-2 hidden lg:flex items-center gap-1 p-1.5 rounded-2xl bg-surface-container-low border-2 border-outline overflow-x-auto no-scrollbar">
          {NAV.map((tab) => {
            const active = view === tab.id || (tab.id === "triage" && view === "profile");
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap focus:outline-none flex-shrink-0"
              >
                {active && (
                  <motion.div layoutId="cc-tab" className="absolute inset-0 rounded-xl bg-primary" style={{ boxShadow: "var(--shadow-clay-primary)" }} transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                )}
                <span className="relative z-10 flex items-center"><tab.Icon size={16} className={active ? "text-white" : "text-on-surface-variant"} /></span>
                <span className={`relative z-10 hidden md:inline ${active ? "text-white" : "text-on-surface-variant"}`}>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* actions */}
        <div className="order-2 lg:order-3 flex items-center gap-2 ms-auto lg:ms-0">
          <span className="stat-chip hidden md:inline-flex" style={{ cursor: "default" }}>
            <span className="charge-drift" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary)" }} />
            זמן אמת
          </span>
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
          {onCommandView && <KpiRibbon kpis={data.kpis} />}

          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              {view === "triage" && <TriageView data={data} onSelect={setSel} fire={fire} onReview={() => setSort("risk")} />}
              {view === "mastery" && (
                <MasteryView
                  data={data}
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

      {/* ══════════ TOAST ══════════ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 12, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-[90] flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-[13.5px]"
            style={{ background: "var(--color-inverse-surface)", color: "var(--color-inverse-on-surface)", boxShadow: "var(--shadow-lg)" }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary)" }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════ MOBILE BOTTOM TAB BAR ══════════ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around items-stretch px-1 pt-1.5 border-t-2 border-outline"
        style={{ background: "color-mix(in srgb, var(--color-surface) 92%, transparent)", backdropFilter: "blur(14px)", paddingBottom: "calc(6px + env(safe-area-inset-bottom))", boxShadow: "0 -4px 0 0 var(--color-outline)" }}
      >
        {NAV.map((tab) => {
          const active = view === tab.id || (tab.id === "triage" && view === "profile");
          return (
            <button
              key={tab.id}
              onClick={() => { setProfileId(null); setView(tab.id); }}
              className={`flex flex-col items-center justify-center gap-1 min-w-[56px] flex-1 py-1.5 rounded-xl transition-colors ${active ? "text-primary" : "text-on-surface-variant"}`}
              style={active ? { background: "color-mix(in srgb, var(--color-primary) 10%, transparent)" } : undefined}
            >
              <tab.Icon size={21} />
              <span className="text-[10px] font-bold whitespace-nowrap">{tab.short}</span>
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
              <div className="shimmer rounded-xl" style={{ height: 42 }} />
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
  return <div ref={ref} className="num font-extrabold leading-none mt-3" style={{ fontSize: 28 }} />;
}

/* ───────────────────────── KPI RIBBON ───────────────────────── */
function KpiRibbon({ kpis }: { kpis: CommandCenterData["kpis"] }) {
  const ICON: Record<string, typeof Users> = { students: Users, mastery: Zap, active: Activity, ai: Bot, risk: AlertTriangle };
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
          <motion.div key={k.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="clay-card flex-shrink-0 w-[150px] md:w-auto" style={{ padding: "14px 15px" }}>
            <div className="flex items-start justify-between gap-2.5">
              <span className="inline-flex items-center justify-center rounded-xl" style={{ width: 34, height: 34, background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                <Icon size={17} />
              </span>
              {delta !== null && delta !== 0 && (
                <span className="num text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: delta > 0 ? "var(--color-primary)" : "var(--color-error)", background: `color-mix(in srgb, ${delta > 0 ? "var(--color-primary)" : "var(--color-error)"} 12%, transparent)` }}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                </span>
              )}
            </div>
            <KpiValue value={k.value} suffix={(k as { suffix?: string }).suffix ?? ""} />
            <div className="flex items-end justify-between gap-2 mt-1">
              <span className="text-[12px] font-semibold text-on-surface-variant">{k.label}</span>
              <Sparkline values={k.spark} color={color} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── TRIAGE ───────────────────────── */
function TriageView({ data, onSelect, fire, onReview }: { data: CommandCenterData; onSelect: (s: CCStudent) => void; fire: (m: string) => void; onReview: () => void }) {
  const urgentNames = data.students.filter((s) => s.status === "risk").slice(0, 3).map((s) => s.name).join(" · ");
  return (
    <div>
      {data.atRisk > 0 && (
        <div className="fdr-urgent flex items-center gap-3.5 flex-wrap mb-4.5 px-4 py-3.5 rounded-2xl" style={{ background: "color-mix(in srgb, var(--color-error) 10%, var(--color-surface))", border: "2px solid color-mix(in srgb, var(--color-error) 55%, var(--color-outline))", marginBottom: 18 }}>
          <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 40, height: 40, background: "var(--color-error)", color: "#fff", boxShadow: "0 4px 0 0 color-mix(in srgb, var(--color-error) 45%, transparent)" }}><AlertTriangle size={20} /></span>
          <div className="flex-1 min-w-[180px]">
            <div className="font-extrabold text-[15px] text-on-surface">דרושה התערבות מיידית</div>
            <div className="text-[12.5px] text-on-surface-variant mt-0.5"><span className="num">{data.atRisk}</span> תלמידים מתחת לסף · {urgentNames}</div>
          </div>
          <button className="btn-clay-primary" style={{ padding: "0.5rem 1rem", fontSize: 13 }} onClick={onReview}>סקור עכשיו</button>
        </div>
      )}

      <div className="flex flex-wrap gap-4.5 items-start" style={{ gap: 18 }}>
        <div className="flex-1 flex flex-wrap gap-3.5" style={{ flexBasis: 640, minWidth: 280 }}>
          {LANES.map((lane) => {
            const list = sortStudents(data.students.filter((s) => s.status === lane.key), "acc")
              .sort((a, b) => (lane.key === "thriving" ? b.acc - a.acc : a.acc - b.acc));
            const color = STATUS[lane.key].color;
            return (
              <div key={lane.key} style={{ flex: "1 1 230px", minWidth: 220 }}>
                <div className="flex items-center gap-2.5 mb-3 px-3 py-2 rounded-xl bg-surface border-2 border-outline" style={{ boxShadow: "var(--shadow-clay)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span className="font-display font-extrabold text-[15px]">{lane.he}</span>
                  <span className="num font-extrabold text-[13px] ms-auto" style={{ color: "#fff", background: color, padding: "2px 10px", borderRadius: 99 }}>{list.length}</span>
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
        <div className="clay-card" style={{ flex: "1 1 290px", minWidth: 280, padding: 20 }}>
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
                    <span className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, border: `2px solid color-mix(in srgb, ${c} 28%, transparent)` }}><Icon size={15} /></span>
                    {i < data.alerts.length - 1 && <span style={{ width: 2, flex: 1, background: "var(--color-outline)", marginTop: 3, minHeight: 8 }} />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-[13px]">{a.who}</span>
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
      className="fdr-lift cursor-pointer rounded-2xl bg-surface p-3.5"
      style={{ border: "2px solid var(--color-outline)", borderInlineStartWidth: 5, borderInlineStartColor: c, boxShadow: "var(--shadow-clay)" }}
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
        <button onClick={(e) => { e.stopPropagation(); fire(`רמז נשלח אל ${s.name}`); }} title="שלח רמז" className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, border: "2px solid var(--color-outline)", background: "var(--color-surface)", color: "var(--color-tertiary)" }}><Lightbulb size={17} tone="current" animated={false} glow={0.4} /></button>
        <button onClick={(e) => { e.stopPropagation(); fire(`הודעה נשלחה אל ${s.name}`); }} title="שלח הודעה" className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, border: "2px solid var(--color-outline)", background: "var(--color-surface)", color: "var(--color-secondary)" }}><Send size={15} /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── MASTERY ───────────────────────── */
function MasteryView({ data, masteryView, setMasteryView, sort, setSort, onlyRisk, setOnlyRisk, onSelect }: {
  data: CommandCenterData; masteryView: "grid" | "radar"; setMasteryView: (v: "grid" | "radar") => void;
  sort: Sort; setSort: (s: Sort) => void; onlyRisk: boolean; setOnlyRisk: (b: boolean) => void; onSelect: (s: CCStudent) => void;
}) {
  let students = data.students;
  if (onlyRisk) students = students.filter((s) => s.status !== "thriving");
  students = sortStudents(students, sort);

  const segBtn = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 10, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: 13, fontFamily: "var(--font-body)",
    background: active ? "var(--color-primary)" : "transparent", color: active ? "#fff" : "var(--color-on-surface-variant)",
    boxShadow: active ? "var(--shadow-clay-primary)" : "none",
  });

  return (
    <div>
      {/* controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-1.5 p-1.5 rounded-2xl bg-surface-container-low border-2 border-outline">
          <button style={segBtn(masteryView === "grid")} onClick={() => setMasteryView("grid")}><LayoutGrid size={14} /> מפת חום</button>
          <button style={segBtn(masteryView === "radar")} onClick={() => setMasteryView("radar")}><GraduationCap size={14} /> רדאר</button>
        </div>
        <span className="hidden sm:block" style={{ width: 1, height: 26, background: "var(--color-outline)" }} />
        <span className="text-[13px] font-bold text-on-surface-variant hidden sm:inline">מיון</span>
        <div className="flex gap-1.5 p-1 rounded-xl bg-surface-container-low border-2 border-outline">
          {(["risk", "acc", "name"] as Sort[]).map((sKey) => (
            <button key={sKey} style={{ ...segBtn(sort === sKey), padding: "6px 11px", fontSize: 12.5 }} onClick={() => setSort(sKey)}>
              {sKey === "risk" ? "סיכון" : sKey === "acc" ? "דיוק" : "א־ב"}
            </button>
          ))}
        </div>
        <button onClick={() => setOnlyRisk(!onlyRisk)} className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-[12.5px] font-bold" style={{ borderColor: onlyRisk ? "var(--color-primary)" : "var(--color-outline)", background: onlyRisk ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--color-surface)", color: onlyRisk ? "var(--color-primary)" : "var(--color-on-surface-variant)" }}>
          <span className="inline-flex items-center justify-center rounded" style={{ width: 16, height: 16, border: "2px solid currentColor", fontSize: 10 }}>{onlyRisk ? "✓" : ""}</span>
          רק דורשי תשומת לב
        </button>
        <span className="num text-[12px] text-on-surface-variant ms-auto hidden md:inline">{students.length} תלמידים</span>
      </div>

      {/* topic strip */}
      <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(124px, 1fr))" }}>
        {data.topicAverages.map((t) => {
          const col = t.pct >= 78 ? "var(--color-primary)" : t.pct >= 55 ? "var(--color-tertiary)" : "var(--color-error)";
          return (
            <div key={t.topicId} className="fdr-lift bg-surface border-2 border-outline rounded-xl" style={{ padding: "10px 11px", boxShadow: "var(--shadow-clay)" }}>
              <div className="text-[11.5px] font-bold text-on-surface-variant truncate">{t.name}</div>
              <div className="num font-extrabold my-1" style={{ fontSize: 19, color: t.attempts > 0 ? col : "var(--color-on-surface-variant)" }}>{t.attempts > 0 ? `${t.pct}%` : "—"}</div>
              <div style={{ height: 7, borderRadius: 99, background: "var(--color-surface-container-high)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${t.pct}%`, borderRadius: 99, background: col }} />
              </div>
            </div>
          );
        })}
      </div>

      {masteryView === "grid" ? (
        <MasteryGrid data={data} students={students} onSelect={onSelect} />
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))" }}>
          {students.map((s) => (
            <div key={s.id} className="clay-card fdr-lift cursor-pointer" style={{ padding: 14 }} onClick={() => onSelect(s)}>
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar s={s} size={32} radius={9} fs={13} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] truncate">{s.name}</div>
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

function MasteryGrid({ data, students, onSelect }: { data: CommandCenterData; students: CCStudent[]; onSelect: (s: CCStudent) => void }) {
  const cols = data.topics.length;
  const template = `minmax(150px, 200px) repeat(${cols}, minmax(46px, 1fr))`;
  // heat cells fill in a start-to-end cascade as the grid scrolls into view
  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(gridRef, { selector: ".mg-cell", stagger: 0.006, y: 0, scale: 0.55, duration: 0.35, ease: "power2.out" });
  return (
    <div ref={gridRef} className="clay-card" style={{ padding: 16, overflowX: "auto" }}>
      <div style={{ minWidth: 120 + cols * 60 }}>
        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: template }}>
          <div className="text-[11px] font-bold text-on-surface-variant flex items-end ps-1 pb-1.5">תלמיד · שליטה כוללת</div>
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
      <div className="clay-card circuit-grid flex items-center justify-center gap-12 flex-wrap relative overflow-hidden mb-4.5" style={{ padding: 30, marginBottom: 18 }}>
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 220, height: 220 }}>
          <div className="field-ring" style={{ position: "absolute", left: "50%", top: "50%", width: 200, height: 200, borderRadius: "50%", border: "2px solid var(--color-primary)" }} />
          <div className="field-ring field-ring--2" style={{ position: "absolute", left: "50%", top: "50%", width: 200, height: 200, borderRadius: "50%", border: "2px solid var(--color-primary)" }} />
          <Gauge pct={animAvg} />
          <div className="absolute z-[2] text-center">
            <div className="num font-extrabold text-primary leading-none" style={{ fontSize: 52 }}>{Math.round(animAvg)}<span style={{ fontSize: 24 }}>%</span></div>
            <div className="text-[12px] font-bold text-on-surface-variant mt-1">אנרגיית הכיתה</div>
          </div>
        </div>
        <div className="flex flex-col gap-3.5" style={{ minWidth: 200 }}>
          <div className="font-display font-extrabold" style={{ fontSize: 22 }}>{data.classAvg >= 65 ? "הכיתה טעונה" : "הכיתה צוברת מתח"}</div>
          <p className="text-[13.5px] text-on-surface-variant m-0 max-w-[280px] leading-relaxed">מבט חי על זרם הלמידה — ככל שהטבעת ירוקה ומלאה יותר, כך הכיתה פעילה ומדויקת יותר.</p>
          <div className="flex gap-2.5 flex-wrap">
            <span className="stat-chip" style={{ cursor: "default" }}><Activity size={15} className="text-primary" /> <span className="num">{data.activeNow}</span> פעילים</span>
            <span className="stat-chip" style={{ cursor: "default" }}><Bot size={15} className="text-secondary" /> <span className="num">{data.aiToday}</span> שאלות AI</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4.5 flex-wrap items-start" style={{ gap: 18 }}>
        {/* topic reactors */}
        <div className="clay-card" style={{ flex: "1 1 460px", padding: 22 }}>
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
        <div className="clay-card" style={{ flex: "1 1 380px", padding: 22 }}>
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

      {/* ticker */}
      <div className="clay-card mt-4.5 overflow-hidden" style={{ padding: 0, marginTop: 18 }}>
        <div className="flex items-center">
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 font-extrabold text-[12.5px]" style={{ padding: "13px 18px", background: "var(--color-primary)", color: "var(--color-on-primary)" }}>
            <span className="charge-drift" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-on-primary)" }} /> חי
          </span>
          <div className="flex-1 overflow-hidden">
            <div className="cc-marquee inline-flex whitespace-nowrap" style={{ gap: 36, paddingInline: 24 }}>
              {[...ticker, ...ticker].map((tk, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-[13px]">
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: toneColor(tk.tone as CCTone) }} />
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
        <div className="flex items-center gap-3 mb-4.5" style={{ marginBottom: 18 }}>
          <span style={avatarStyle(s.avatarColor, 46, 13, 18)}>{s.initial}</span>
          <div className="flex-1">
            <div className="font-display font-extrabold text-[20px]">{s.name}</div>
            <span className="text-[12px] font-bold" style={{ color: c }}>{STATUS[s.status].he}</span>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="סגור" style={{ width: 38, height: 38 }}><X size={17} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4.5" style={{ marginBottom: 18 }}>
          {[
            { l: "דיוק כללי", v: `${s.acc}%`, col: accColor(s.acc) },
            { l: "מגמה שבועית", v: `${s.trend > 0 ? "+" : ""}${s.trend}`, col: s.trend > 0 ? "var(--color-primary)" : s.trend < 0 ? "var(--color-error)" : "var(--color-on-surface)" },
            { l: "רצף", v: `${s.streak}`, col: "var(--color-tertiary)" },
            { l: "דקות היום", v: `${s.minutes}`, col: "var(--color-on-surface)" },
          ].map((t) => (
            <div key={t.l} style={{ background: "var(--color-surface-container-low)", border: "2px solid var(--color-outline)", borderRadius: 13, padding: "11px 13px" }}>
              <div className="text-[11px] font-bold text-on-surface-variant">{t.l}</div>
              <div className="num font-extrabold text-[22px]" style={{ color: t.col }}>{t.v}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center py-2">
          <div style={{ width: "100%", maxWidth: 280 }}>
            <Radar values={s.mastery.map((m) => m.pct)} labels={topics.map((t) => t.name)} size={230} showLabels stroke={c} fill={`color-mix(in srgb, ${c} 26%, transparent)`} glow={`color-mix(in srgb, ${c} 50%, transparent)`} />
          </div>
        </div>

        <div className="flex gap-2 mt-3.5">
          <button className="btn-clay-secondary flex-1" style={{ padding: "0.6rem 0.5rem", fontSize: 13 }} onClick={() => fire(`רמז נשלח אל ${s.name}`)}>שלח רמז</button>
          <button className="btn-clay-ghost flex-1" style={{ padding: "0.6rem 0.5rem", fontSize: 13 }} onClick={() => fire(`הודעה נשלחה אל ${s.name}`)}>הודעה</button>
          <button className="btn-clay-primary flex-1" style={{ padding: "0.6rem 0.5rem", fontSize: 13 }} onClick={onProfile}>פרופיל מלא</button>
        </div>
      </motion.div>
    </div>
  );
}
