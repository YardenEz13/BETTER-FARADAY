import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Bot, TrendingUp, FileText,
  Bell, LogOut, Sparkles, Users, Zap
} from "lucide-react";

import { HeatmapView } from "./HeatmapView";
import { AIChatAnalyticsView } from "./AIChatAnalyticsView";
import { StudentPowerMapView } from "./StudentPowerMapView";
import { HomeworkManagementView } from "./HomeworkManagementView";
import { ElectricLoader } from "../components/electric";

type TabId = "heatmap" | "aiChats" | "powerMap" | "homework";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "heatmap",  label: "מפת חום",       icon: <Activity size={16} /> },
  { id: "aiChats",  label: "שיחות AI",      icon: <Bot size={16} /> },
  { id: "powerMap", label: "מפת כוח",       icon: <TrendingUp size={16} /> },
  { id: "homework", label: "שיעורי בית",    icon: <FileText size={16} /> },
];

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const classroom    = useQuery(api.classroom.getFirstClassroom);
  const heatmap      = useQuery(api.classroom.getClassroomHeatmap, classroom ? { classroomId: classroom._id } : "skip");
  const aiAnalytics  = useQuery(api.aiChat.getTeacherChatAnalytics, classroom ? { classroomId: classroom._id } : "skip");
  const dashboardStats = useQuery(api.classroom.getDashboardStats, classroom ? { classroomId: classroom._id } : "skip");
  const liveAlerts   = useQuery(api.classroom.getLiveAlerts, classroom ? { classroomId: classroom._id } : "skip");

  const [activeTab, setActiveTab]         = useState<TabId>("heatmap");
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);

  const hasAlerts = liveAlerts && liveAlerts.length > 0;
  const counts = heatmap
    ? heatmap.reduce((acc, s) => { acc[s.status]++; return acc; }, { green: 0, yellow: 0, red: 0 })
    : { green: 0, yellow: 0, red: 0 };

  if (!heatmap) return <ElectricLoader label="טוען נתוני כיתה..." />;

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Ambient glow ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[400px] rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(23,201,100,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(123,97,255,0.06) 0%, transparent 70%)' }} />
      </div>

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-40 flex items-center justify-between px-6 py-4 flex-shrink-0 bg-surface border-b-2 border-outline backdrop-blur-xl"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Brand + live stats */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary glow-primary">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-sm text-on-surface font-display tracking-tight">
                FARADAY Logic
              </div>
              <div className="label-mono text-primary" style={{ fontSize: '0.58rem' }}>// מרכז פיקוד</div>
            </div>
          </div>

          {/* Live badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border-2 border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="label-mono text-primary text-[0.6rem]">Live</span>
          </div>

          {/* Quick stats */}
          <div className="hidden lg:flex items-center gap-3">
            <HeaderStat value={heatmap.length} label="תלמידים" icon={<Users size={13} />} />
            <HeaderStat value={counts.green}  label="שולטים"  colorClass="text-primary" />
            <HeaderStat value={counts.yellow} label="מתקשים"  colorClass="text-tertiary" />
            <HeaderStat value={counts.red}    label="בסיכון"  colorClass="text-error" />
          </div>
        </div>

        {/* ── Tab navigation (pill style) ── */}
        <nav className="flex items-center gap-1 p-1.5 rounded-2xl bg-surface-container border-2 border-outline">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-150 focus:outline-none"
              style={{
                color: activeTab === tab.id ? 'white' : undefined,
              }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-xl bg-primary"
                  style={{ boxShadow: 'var(--shadow-clay-primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-10 transition-colors duration-150 ${activeTab === tab.id ? 'text-white' : 'text-on-surface-variant'}`}>
                {tab.icon}
              </span>
              <span className={`relative z-10 hidden md:inline transition-colors duration-150 ${activeTab === tab.id ? 'text-white' : 'text-on-surface-variant'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button className="btn-icon relative" aria-label="התראות">
            <Bell size={18} className={hasAlerts ? 'text-error' : 'text-on-surface-variant'} />
            {hasAlerts && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-error border-2 border-surface" />
            )}
          </button>
          <button className="btn-icon" onClick={() => navigate("/")} title="יציאה">
            <LogOut size={16} />
          </button>
        </div>
      </motion.header>

      {/* ── Main content ── */}
      <main className="relative z-10 flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 overflow-auto"
          >
            {activeTab === "heatmap" && (
              <HeatmapView
                heatmap={heatmap}
                counts={counts}
                classroom={classroom}
                dashboardStats={dashboardStats}
                liveAlerts={liveAlerts}
                onStudentClick={(id: Id<"students">) => {
                  setSelectedStudentId(id);
                  setActiveTab("powerMap");
                }}
              />
            )}
            {activeTab === "aiChats" && <AIChatAnalyticsView analytics={aiAnalytics} />}
            {activeTab === "powerMap" && (
              <StudentPowerMapView
                studentId={selectedStudentId}
                onBack={() => setActiveTab("heatmap")}
              />
            )}
            {activeTab === "homework" && <HomeworkManagementView classroomId={classroom?._id ?? null} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function HeaderStat({
  value, label, icon, colorClass,
}: {
  value: any;
  label: string;
  icon?: React.ReactNode;
  colorClass?: string;
}) {
  return (
    <div className="stat-chip">
      {icon && <span className={colorClass ?? 'text-on-surface-variant'}>{icon}</span>}
      <span className={`num font-bold text-sm ${colorClass ?? 'text-on-surface'}`}>{value}</span>
      <span className="text-xs text-on-surface-variant">{label}</span>
    </div>
  );
}

