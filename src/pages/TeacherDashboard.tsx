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

  if (!heatmap) return (
    <div className="min-h-screen flex items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        טוען נתוני כיתה...
      </span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-void)' }}>

      {/* ── Ambient ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)' }} />
      </div>

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-40 flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{
          background: 'rgba(5,11,24,0.85)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Brand + live stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--g-400)', boxShadow: '0 0 20px rgba(74,222,128,0.35)' }}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                FARADAY Logic
              </div>
              <div className="label-mono" style={{ color: 'var(--g-400)', fontSize: '0.58rem' }}>// מרכז פיקוד</div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1" style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '24px', marginRight: '0' }}>
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
              <div className="pulse-dot" style={{ width: 6, height: 6 }} />
              <span className="label-mono" style={{ color: 'var(--color-success)', fontSize: '0.6rem' }}>Live</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden lg:flex items-center gap-4">
            <HeaderStat value={heatmap.length} label="תלמידים" icon={<Users size={13} />} />
            <HeaderStat value={counts.green} label="שולטים" color="var(--color-success)" />
            <HeaderStat value={counts.yellow} label="מתקשים" color="var(--color-warning)" />
            <HeaderStat value={counts.red} label="בסיכון" color="var(--color-danger)" />
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
              }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10" style={{ color: activeTab === tab.id ? 'var(--color-primary-light)' : 'var(--text-muted)' }}>
                {tab.icon}
              </span>
              <span className="relative z-10 hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button className="btn-icon relative" style={{ color: hasAlerts ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
            <Bell size={18} />
            {hasAlerts && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{ background: 'var(--color-danger)', boxShadow: '0 0 6px var(--color-danger)' }} />
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

function HeaderStat({ value, label, icon, color }: { value: any; label: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon && <span style={{ color: color ?? 'var(--text-secondary)' }}>{icon}</span>}
      <span className="font-bold text-sm" style={{ color: color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
