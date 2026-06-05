import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { Zap, Flame, Target, Lock, ChevronLeft, Bot, Activity } from "lucide-react";
import AIChatPanel from "../components/AIChatPanel";
import CyberAvatar from "../components/CyberAvatar";

export default function StudentHome() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const student = useQuery(api.classroom.get, { id: studentId as Id<"students"> });
  const topics = useQuery(api.topics.list);
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const [chatOpen, setChatOpen] = useState(false);

  if (!student || !topics) return null;

  const getProgress = (topicId: string) => {
    const d = stats?.byTopic[topicId] as { correct: number; total: number } | undefined;
    if (!d || d.total === 0) return 0;
    return Math.round((d.correct / d.total) * 100);
  };

  const totalAttempts = stats?.totalAttempts ?? 0;
  const overallAcc = totalAttempts > 0 
    ? Math.round((topics.reduce((s, t) => s + (stats?.byTopic[t._id]?.correct || 0), 0) / totalAttempts) * 100) 
    : 0;

  const totalXP = (student.streak * 10) + (totalAttempts * 25);

  return (
    <div className="min-h-screen relative overflow-x-hidden pb-32">
      
      {/* ── Floating HUD Overlays ── */}
      
      {/* Top Left - Profile & Rank */}
      <div className="fixed top-6 left-6 z-40 flex items-center gap-6">
        <CyberAvatar name={student.name} size={48} />
        <div className="hidden md:block">
          <div className="t-mono-label">AGENT_ID: {student.name}</div>
          <div className="font-mono text-sm opacity-80">CLASS: 581_PRIME</div>
        </div>
      </div>

      {/* Top Right - Global Stats */}
      <div className="fixed top-6 right-6 z-40 flex gap-6">
        <div className="shard px-6 py-3 flex items-center gap-3">
          <Zap size={16} className="text-[var(--acid-green)]" />
          <div>
            <div className="t-mono-label opacity-60">NET_XP</div>
            <div className="font-mono font-bold">{totalXP}</div>
          </div>
        </div>
        <div className="shard px-6 py-3 flex items-center gap-3">
          <Flame size={16} className="text-[var(--danger-crimson)]" />
          <div>
            <div className="t-mono-label opacity-60">STREAK</div>
            <div className="font-mono font-bold">{student.streak}</div>
          </div>
        </div>
        <div className="shard px-6 py-3 flex items-center gap-3">
          <Target size={16} className="text-[var(--laser-cyan)]" />
          <div>
            <div className="t-mono-label opacity-60">ACCURACY</div>
            <div className="font-mono font-bold">{overallAcc}%</div>
          </div>
        </div>
      </div>

      {/* Bottom Left - Return / Teacher Link */}
      <button className="fixed bottom-6 left-6 z-40 cyber-btn cyber-btn-ghost" onClick={() => navigate("/teacher")}>
        [ SYSTEM_OVERRIDE : TEACHER ]
      </button>

      {/* Bottom Right - AI Assistant Trigger */}
      <button className="fixed bottom-6 right-6 z-40 cyber-btn" onClick={() => setChatOpen(true)}>
        <Bot size={18} />
        [ INITIATE_AI_UPLINK ]
      </button>

      {/* ── Main Content: Two-Column Layout ── */}
      <div className="max-w-[1600px] mx-auto pt-32 px-8 relative z-10 flex flex-col lg:flex-row gap-16 items-start">
        
        {/* LEFT COLUMN: Holographic Data Core (Decorative & Stats) */}
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center sticky top-32 h-[calc(100vh-160px)]">
          
          <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
            {/* Ambient Glow */}
            <div className="absolute inset-0 bg-[var(--neon-emerald)] rounded-full blur-[100px] opacity-10 animate-pulse"></div>
            
            {/* Spinning Rings */}
            <div className="absolute inset-4 border-2 border-dashed border-[var(--neon-emerald)] rounded-full opacity-30 animate-[spin_20s_linear_infinite]"></div>
            <div className="absolute inset-12 border border-[var(--acid-green)] rounded-full opacity-20 animate-[spin_15s_linear_infinite_reverse]"></div>
            <div className="absolute inset-20 border-4 border-t-transparent border-b-transparent border-[var(--laser-cyan)] rounded-full opacity-40 animate-[spin_10s_linear_infinite]"></div>
            
            {/* Core Data Block */}
            <div className="shard p-8 bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] backdrop-blur-md z-10 text-center flex flex-col items-center shadow-[0_0_50px_rgba(0,255,136,0.1)]">
              <h1 className="hud-title text-5xl mb-2" data-text="SYSTEM_SYNC">SYSTEM_SYNC</h1>
              <div className="t-mono-label text-[var(--acid-green)] tracking-widest uppercase mb-6 border-b border-[var(--acid-green)] pb-2 inline-block">
                Neural Learning Core Active
              </div>
              
              <div className="flex flex-col gap-6 w-full">
                <div className="flex justify-between items-center bg-[rgba(0,0,0,0.5)] px-4 py-2 border border-[#1a3324]">
                  <span className="t-mono-label opacity-60">MODULES_ONLINE</span>
                  <span className="font-mono text-[var(--neon-emerald)] font-bold">{topics.length}</span>
                </div>
                <div className="flex justify-between items-center bg-[rgba(0,0,0,0.5)] px-4 py-2 border border-[#1a3324]">
                  <span className="t-mono-label opacity-60">GLOBAL_ACCURACY</span>
                  <span className="font-mono text-[var(--laser-cyan)] font-bold">{overallAcc}%</span>
                </div>
                <div className="flex justify-between items-center bg-[rgba(0,0,0,0.5)] px-4 py-2 border border-[#1a3324]">
                  <span className="t-mono-label opacity-60">TOTAL_ATTEMPTS</span>
                  <span className="font-mono text-white font-bold">{totalAttempts}</span>
                </div>
              </div>

              {/* Decorative Bar Chart */}
              <div className="mt-8 w-full h-12 flex items-end justify-between gap-1 opacity-50">
                {[40, 70, 45, 90, 60, 30, 80, 100, 50, 75].map((h, i) => (
                  <div key={i} className="w-full bg-[var(--neon-emerald)]" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>
          </div>
          
        </div>

        {/* RIGHT COLUMN: The Vertical Neural Timeline */}
        <div className="flex-1 w-full relative">
          
          <div className="mb-12 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
            <div>
              <h2 className="hud-title text-5xl" data-text="LEARNING CORE">LEARNING CORE</h2>
              <p className="font-mono mt-2 text-[var(--neon-emerald)] opacity-80 uppercase tracking-widest">
                Select a module to begin data assimilation.
              </p>
            </div>
            <button 
              className="cyber-btn"
              onClick={() => navigate(`/student/${studentId}/homework`)}
            >
              [ ASSIGNED_HOMEWORK ]
            </button>
          </div>

          <div className="relative pl-0 md:pl-12">
            {/* Glowing central line (Aligned right in RTL layout, meaning it's physically on the right side of the items if we use border, or left if we position it) 
                Wait, in RTL, right is start. Let's place the line on the right edge. */}
            <div className="absolute top-0 bottom-0 right-0 w-1 bg-[var(--neon-emerald)] opacity-20 shadow-[var(--glow-emerald)] hidden md:block"></div>

            <div className="flex flex-col gap-8">
              {topics.map((topic, idx) => {
                const progress = getProgress(topic._id);
                const isLocked = false;

                return (
                  <div key={topic._id} className="relative flex items-center w-full justify-start pr-0 md:pr-12">
                    
                    {/* Timeline Node Point */}
                    <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 w-6 h-6 bg-[var(--bg-deep)] border-2 border-[var(--neon-emerald)] rotate-45 hidden md:flex items-center justify-center z-10">
                      <div className="w-2 h-2 bg-[var(--acid-green)] rounded-full animate-pulse"></div>
                    </div>

                    {/* Horizontal Connection Line */}
                    <div className="absolute top-1/2 -translate-y-1/2 h-[1px] bg-[var(--neon-emerald)] opacity-40 right-0 w-12 hidden md:block"></div>

                    <div className={`w-full shard p-8 group cursor-pointer hover:border-[var(--acid-green)] hover:bg-[rgba(0,255,136,0.02)] transition-all ${isLocked ? 'opacity-40 grayscale' : ''}`} onClick={() => navigate(`/student/${studentId}/practice/${topic._id}`)}>
                      
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="t-mono-label mb-1 flex items-center gap-2">
                            {isLocked ? <Lock size={12}/> : <Activity size={12}/>}
                            MODULE_0{idx + 1}
                          </div>
                          <h2 className="text-2xl font-bold font-title uppercase tracking-wide text-white">{topic.nameHe}</h2>
                        </div>
                        <div className="text-left">
                          <div className="font-mono text-2xl font-bold text-[var(--neon-emerald)]">{progress}%</div>
                          <div className="t-mono-label text-[10px] opacity-70">{progress >= 100 ? 'SYNC_COMPLETE' : 'SYNCING...'}</div>
                        </div>
                      </div>

                      <p className="font-mono text-sm opacity-60 mb-6 line-clamp-2 leading-relaxed">
                        {topic.description}
                      </p>

                      <div className="w-full bg-[#0a1a12] h-2 relative overflow-hidden border border-[#1a3324]">
                        <div className="absolute top-0 right-0 h-full bg-[var(--neon-emerald)] shadow-[0_0_10px_var(--neon-emerald)]" style={{width: `${progress}%`}}></div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId!}
        agentType="homework"
      />
    </div>
  );
}
