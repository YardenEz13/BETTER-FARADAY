import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Activity, AlertTriangle, FileText, Bot, TrendingUp, Search, Bell, MonitorPlay, Zap, Terminal, Menu, LogOut, BookOpen } from "lucide-react";

import { HeatmapView } from "./HeatmapView";
import { AIChatAnalyticsView } from "./AIChatAnalyticsView";
import { StudentPowerMapView } from "./StudentPowerMapView";
import { HomeworkManagementView } from "./HomeworkManagementView";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const classroom = useQuery(api.classroom.getFirstClassroom);
  const heatmap = useQuery(api.classroom.getClassroomHeatmap, classroom ? { classroomId: classroom._id } : "skip");
  const aiAnalytics = useQuery(api.aiChat.getTeacherChatAnalytics, classroom ? { classroomId: classroom._id } : "skip");
  const dashboardStats = useQuery(api.classroom.getDashboardStats, classroom ? { classroomId: classroom._id } : "skip");
  const liveAlerts = useQuery(api.classroom.getLiveAlerts, classroom ? { classroomId: classroom._id } : "skip");
  
  const [activeTab, setActiveTab] = useState<"heatmap" | "aiChats" | "powerMap" | "homework">("heatmap");
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);

  if (!heatmap) return (
    <div className="min-h-screen flex items-center justify-center text-[var(--neon-emerald)] font-mono text-2xl animate-pulse">
      INITIALIZING COMMAND CENTER...
    </div>
  );

  const counts = heatmap.reduce((acc, s) => { acc[s.status]++; return acc; }, { green: 0, yellow: 0, red: 0 });

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white relative overflow-hidden flex flex-col ">
      
      {/* ── Ambient Background ── */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[80vw] h-[80vh] bg-[radial-gradient(ellipse_at_top_right,_var(--neon-emerald)_0%,_transparent_70%)] opacity-5" />
        <div className="absolute bottom-0 left-0 w-[50vw] h-[50vh] bg-[radial-gradient(ellipse_at_bottom_left,_var(--laser-cyan)_0%,_transparent_70%)] opacity-5" />
      </div>

      {/* ── HUD Top Navigation ── */}
      <header className="relative z-40 border-b border-[var(--neon-emerald)] bg-[rgba(2,8,5,0.85)] backdrop-blur-xl h-20 px-8 flex items-center justify-between">
        
        {/* Brand & Stats */}
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate("/")}>
            <div className="w-10 h-10 border-2 border-[var(--neon-emerald)] rotate-45 flex items-center justify-center shadow-[var(--glow-emerald)]">
              <Zap size={20} className="-rotate-45 text-[var(--neon-emerald)]" />
            </div>
            <div>
              <div className="font-mono text-2xl font-black text-white tracking-widest leading-none">FARADAY</div>
              <div className="font-mono text-[10px] text-[var(--neon-emerald)] tracking-[0.3em] uppercase mt-1">COMMAND_CENTER</div>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-6 font-mono text-sm">
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--text-muted)]">ACTIVE_STUDENTS</span>
              <span className="text-[var(--neon-emerald)] text-lg">{heatmap.length}</span>
            </div>
            <div className="w-px h-8 bg-[rgba(0,255,136,0.2)]" />
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--text-muted)]">SYSTEM_STATUS</span>
              <span className="text-[var(--acid-green)] text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--acid-green)] animate-pulse" /> OPTIMAL
              </span>
            </div>
          </div>
        </div>

        {/* Tab Links */}
        <nav className="flex items-center gap-2 bg-[rgba(0,255,136,0.05)] border border-[rgba(0,255,136,0.2)] p-1 rounded-md" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
          <TabButton icon={<Activity size={16} />} label="HEATMAP" active={activeTab === 'heatmap'} onClick={() => setActiveTab('heatmap')} />
          <TabButton icon={<Bot size={16} />} label="AI_TELEMETRY" active={activeTab === 'aiChats'} onClick={() => setActiveTab('aiChats')} />
          <TabButton icon={<TrendingUp size={16} />} label="POWER_MAP" active={activeTab === 'powerMap'} onClick={() => setActiveTab('powerMap')} />
          <TabButton icon={<FileText size={16} />} label="HOMEWORK" active={activeTab === 'homework'} onClick={() => setActiveTab('homework')} />
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Search size={20} className="text-[var(--text-muted)] group-hover:text-[var(--neon-emerald)] transition-colors absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="SEARCH_DATABASE..." className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,255,136,0.3)] pl-10 pr-4 py-2 font-mono text-sm text-[var(--neon-emerald)] placeholder:text-[rgba(0,255,136,0.2)] outline-none focus:border-[var(--neon-emerald)] transition-colors w-[250px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }} />
          </div>
          <button className="text-[var(--text-muted)] hover:text-[var(--warning-amber)] transition-colors relative">
            <Bell size={22} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--danger-crimson)] rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--danger-crimson)] rounded-full" />
          </button>
          <button className="text-[var(--text-muted)] hover:text-white transition-colors" onClick={() => navigate("/")}>
            <LogOut size={22} />
          </button>
        </div>

      </header>

      {/* ── Main Content Area ── */}
      <main className="relative z-10 flex-1 overflow-x-hidden overflow-y-auto w-full">
        {/* We use a full-width container to maximize screen real estate */}
        <div className="w-full min-h-full p-8 flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'heatmap' ? (
              <motion.div key="heatmap" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="flex-1 flex w-full">
                <HeatmapView heatmap={heatmap} counts={counts} classroom={classroom} dashboardStats={dashboardStats} liveAlerts={liveAlerts} onStudentClick={(id: Id<"students">) => { setSelectedStudentId(id); setActiveTab('powerMap'); }} />
              </motion.div>
            ) : activeTab === 'aiChats' ? (
              <motion.div key="aiChats" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="flex-1 flex w-full">
                <AIChatAnalyticsView analytics={aiAnalytics} />
              </motion.div>
            ) : activeTab === 'powerMap' ? (
              <motion.div key="powerMap" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="flex-1 flex w-full">
                <StudentPowerMapView studentId={selectedStudentId} onBack={() => setActiveTab('heatmap')} />
              </motion.div>
            ) : (
              <motion.div key="homework" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="flex-1 flex w-full">
                <HomeworkManagementView classroomId={classroom?._id ?? null} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 font-mono text-sm transition-all duration-300 ${
        active 
          ? 'bg-[rgba(0,255,136,0.15)] text-[var(--neon-emerald)] border-b-2 border-[var(--neon-emerald)] shadow-[0_0_15px_rgba(0,255,136,0.2)]' 
          : 'text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] border-b-2 border-transparent'
      }`}
      style={active ? { clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' } : {}}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
