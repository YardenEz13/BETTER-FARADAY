import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { RefreshCw, CheckCircle2, TrendingUp, XCircle } from "lucide-react";
import CyberAvatar from "../components/CyberAvatar";

export function HeatmapView({ heatmap, counts, classroom, dashboardStats, liveAlerts, onStudentClick }: { heatmap: any[]; counts: { green: number; yellow: number; red: number }; classroom: any; dashboardStats: any; liveAlerts: any; onStudentClick: (id: Id<"students">) => void }) {
  const pendingLevels = useQuery(api.levels.getPendingSuggestions, classroom ? { classroomId: classroom._id } : "skip");
  const resolveLevel = useMutation(api.levels.resolveSuggestion);

  return (
    <div className="w-full h-full flex flex-col xl:flex-row gap-6 p-6 min-h-screen bg-[#050b08] text-[#c0f8d1]">
      {/* עמודה מרכזית: רשת מפת חום */}
      <div className="flex-1 flex flex-col">

        <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
          <div className="flex-1">
            <h1 className="text-5xl font-black mb-4 text-[var(--neon-emerald)] drop-shadow-[0_0_15px_rgba(0,255,136,0.5)] tracking-tighter uppercase leading-tight">
              מפת חום<br />כיתתית<br />בזמן אמת
            </h1>
            <p className="t-mono-label text-lg text-[var(--acid-green)]">
              מעקב חי אחרי {heatmap.length} תלמידים ב<span className="text-[var(--neon-emerald)] font-bold">{classroom?.name ?? "כיתה"}</span>.
            </p>
          </div>

          {/* תיבת מקרא סטטוסים */}
          <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] flex items-center gap-8 p-6 shadow-[0_0_20px_rgba(0,255,136,0.1)]">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 t-mono-label mb-1 text-[var(--neon-emerald)]">
                <div className="w-3 h-3 bg-[var(--neon-emerald)] shadow-[0_0_10px_var(--neon-emerald)]" /> שולט
              </div>
              <div className="text-xl font-bold text-[var(--acid-green)]">({counts.green})</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 t-mono-label mb-1 text-[#f5d44f]">
                <div className="w-3 h-3 bg-[#f5d44f] shadow-[0_0_10px_#f5d44f]" /> מתקשה
              </div>
              <div className="text-xl font-bold text-[#f5d44f]">({counts.yellow})</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 t-mono-label mb-1 text-[#ff4b4b]">
                <div className="w-3 h-3 bg-[#ff4b4b] shadow-[0_0_10px_#ff4b4b]" style={{ height: 16, width: 4 }} /> סיכון גבוה
              </div>
              <div className="text-xl font-bold text-[#ff4b4b]">({counts.red})</div>
            </div>
          </div>
        </div>

        {/* שורת מסננים */}
        <div className="flex justify-between items-end mb-6">
          <div className="flex gap-6">
            <div>
              <div className="t-mono-label text-[var(--neon-emerald)] mb-2">רמת סיכון</div>
              <div className="flex gap-3">
                <button className="cyber-btn w-12 h-12 flex items-center justify-center bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] hover:bg-[var(--neon-emerald)] hover:text-black transition-all">
                  <div className="w-4 h-4 bg-[var(--neon-emerald)] shadow-[0_0_10px_var(--neon-emerald)]" />
                </button>
                <button className="cyber-btn w-12 h-12 flex items-center justify-center bg-[rgba(245,212,79,0.05)] border border-[#f5d44f] hover:bg-[#f5d44f] hover:text-black transition-all">
                  <div className="w-4 h-4 bg-[#f5d44f] shadow-[0_0_10px_#f5d44f]" />
                </button>
                <button className="cyber-btn w-12 h-12 flex items-center justify-center bg-[rgba(255,75,75,0.05)] border border-[#ff4b4b] hover:bg-[#ff4b4b] hover:text-black transition-all">
                  <div className="w-2 h-5 bg-[#ff4b4b] shadow-[0_0_10px_#ff4b4b]" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            <button className="cyber-btn flex items-center gap-2 px-6 h-12 bg-[rgba(0,255,136,0.1)] border border-[var(--neon-emerald)] text-[var(--neon-emerald)] hover:bg-[var(--neon-emerald)] hover:text-black transition-all font-bold uppercase tracking-wider">
              <RefreshCw size={18} /> ריענון הנתונים
            </button>
          </div>
        </div>

        {/* רשת תלמידים */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12 w-full"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {heatmap.map(({ student, status, currentTopicName, isStuck, recentAttempts }) => {
            const filled = recentAttempts ? recentAttempts.filter((a: any) => a.isCorrect).length : 0;
            const total = recentAttempts ? recentAttempts.length : 0;
            const attemptsArr = recentAttempts ? [...recentAttempts].reverse() : []; 
            
            const statusColor = status === 'red' ? '#ff4b4b' : status === 'green' ? 'var(--neon-emerald)' : '#f5d44f';
            const statusBg = status === 'red' ? 'rgba(255,75,75,0.05)' : status === 'green' ? 'rgba(0,255,136,0.05)' : 'rgba(245,212,79,0.05)';

            return (
              <motion.div
                key={student._id}
                className="shard p-6 relative overflow-hidden cursor-pointer flex flex-col justify-between"
                onClick={() => onStudentClick(student._id)}
                style={{ 
                  backgroundColor: statusBg,
                  border: `1px solid ${statusColor}`,
                  boxShadow: `0 0 15px ${statusBg}`
                }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                whileHover={{
                  scale: 1.02,
                  boxShadow: `0 0 25px ${statusColor}40`,
                }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute top-0 right-0 w-full h-1" style={{ backgroundColor: statusColor, opacity: 0.8 }} />
                
                <div className="flex items-start gap-4 mb-4">
                  <CyberAvatar name={student.name} size={48} />
                  <div className="flex-1">
                    <div className="flex justify-between w-full mb-1">
                      <div className="t-mono-label text-xs uppercase tracking-wider" style={{ color: statusColor }}>
                        {status === 'red' ? 'בסיכון' : status === 'green' ? 'שולט' : 'מתקשה'}
                      </div>
                    </div>
                    <div className="font-bold text-lg leading-tight text-white">{student.name}</div>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-3">
                  <div className="flex-1">
                    <div className="t-mono-label text-[var(--acid-green)] mb-1 truncate max-w-[150px]" title={currentTopicName || 'נושא פעיל'}>
                      {currentTopicName || 'נושא פעיל'}
                    </div>
                    <div className="text-xs text-[var(--neon-emerald)] opacity-80">
                      {filled}/{total || 0} {isStuck && <span className="text-[#ff4b4b] font-bold ml-2 shadow-[0_0_5px_#ff4b4b] bg-[#ff4b4b] bg-opacity-20 px-1">תקוע</span>}
                    </div>
                  </div>
                  {status === "green" && <div className="t-mono-label text-[var(--neon-emerald)] tracking-widest">מצוין</div>}
                </div>

                <div className="flex gap-1 w-full h-2 mt-2 bg-[#0a1510] border border-[#1a3324] p-[1px]">
                  {attemptsArr.length > 0 ? attemptsArr.map((a: any, i: number) => (
                    <div key={i} className="h-full flex-1" style={{ background: a.isCorrect ? 'var(--neon-emerald)' : '#ff4b4b', boxShadow: a.isCorrect ? '0 0 5px var(--neon-emerald)' : '0 0 5px #ff4b4b' }} title={a.isCorrect ? 'נכון' : 'שגוי'} />
                  )) : (
                    <div className="h-full w-full bg-[#1a3324]" title="אין נתונים עדיין" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* פאנל ימני: תובנות */}
      <div className="w-full xl:w-[400px] flex flex-col gap-6">
        <div className="t-mono-label text-[var(--neon-emerald)] text-xl border-b border-[var(--neon-emerald)] pb-2 mb-2 uppercase tracking-widest">תובנות בזמן אמת</div>

        {/* כרטיס התערבות דחופה */}
        {liveAlerts && liveAlerts.length > 0 ? (
          <div className="shard p-8 bg-[rgba(255,75,75,0.05)] border border-[#ff4b4b] shadow-[0_0_20px_rgba(255,75,75,0.15)] relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-9xl text-[#ff4b4b] opacity-10 font-black">!</div>
            <div className="flex items-center gap-3 t-mono-label mb-4 text-[#ff4b4b] text-lg uppercase tracking-wider">
              <span className="text-2xl font-black">!</span> התערבות דחופה
            </div>
            <p className="text-sm text-[#ffbaba] mb-6 leading-relaxed relative z-10">
              <strong className="text-white text-base">{liveAlerts[0].count} תלמידים</strong> נתקעים ב<strong className="text-white text-base">{liveAlerts[0].topicName}</strong>. 
              <br/><span className="italic opacity-80 mt-2 block">"{liveAlerts[0].questionStem}"</span>
            </p>
            <button className="cyber-btn w-full py-3 bg-[#ff4b4b] text-black font-black uppercase tracking-widest hover:bg-white hover:text-[#ff4b4b] transition-all shadow-[0_0_15px_#ff4b4b]">
              שליחת טיפ לכיתה
            </button>
          </div>
        ) : (
          <div className="shard p-8 text-center bg-[rgba(0,255,136,0.02)] border border-[var(--neon-emerald)] opacity-70">
            <div className="flex items-center justify-center gap-3 t-mono-label mb-2 text-[var(--neon-emerald)]">
              <CheckCircle2 size={24} /> הכל מתנהל כשורה
            </div>
            <p className="text-sm text-[var(--acid-green)] opacity-60">אין התראות דחופות כרגע.</p>
          </div>
        )}

        {/* Level Suggestions */}
        <div className="t-mono-label mt-4 mb-2 text-[var(--neon-emerald)] flex items-center gap-3 text-lg uppercase tracking-wider">
          <TrendingUp size={20} className="text-[var(--acid-green)]" /> הצעות לקידום רמה
        </div>
        {pendingLevels && pendingLevels.length > 0 ? (
          <div className="flex flex-col gap-6 mb-4">
            {pendingLevels.map((s, i) => (
              <div key={i} className="shard p-6 bg-[rgba(0,255,136,0.03)] border border-[var(--neon-emerald)] hover:bg-[rgba(0,255,136,0.08)] transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-[var(--neon-emerald)] bg-opacity-20 text-[var(--neon-emerald)] font-bold border border-[var(--neon-emerald)]">
                      {(s.studentName || '?')[0]}
                    </div>
                    <div>
                      <div className="text-base font-bold text-white">{s.studentName}</div>
                      <div className="t-mono-label text-xs text-[var(--acid-green)] mt-1">רמה {s.currentLevel} <span className="text-[var(--neon-emerald)]">→</span> רמה {s.suggestedLevel}</div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-[#a0d8b3] mb-4 opacity-80">{s.reason}</div>
                <div className="flex gap-3">
                  <button className="cyber-btn flex-1 py-2 bg-[rgba(0,255,136,0.1)] border border-[var(--neon-emerald)] text-[var(--neon-emerald)] hover:bg-[var(--neon-emerald)] hover:text-black transition-all flex items-center justify-center gap-2" onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'approved' })}>
                    <CheckCircle2 size={16} /> אישור
                  </button>
                  <button className="cyber-btn flex-1 py-2 bg-transparent border border-[#ff4b4b] text-[#ff4b4b] hover:bg-[#ff4b4b] hover:text-black transition-all flex items-center justify-center gap-2" onClick={() => resolveLevel({ suggestionId: s._id as any, action: 'rejected' })}>
                    <XCircle size={16} /> דחייה
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="shard p-6 text-center text-[var(--acid-green)] opacity-50 border border-dashed border-[var(--acid-green)]">
            אין הצעות קידום כרגע.
          </div>
        )}

        {/* אבני דרך אחרונות */}
        <div className="t-mono-label mt-4 mb-2 text-[var(--neon-emerald)] text-lg uppercase tracking-wider">אבני דרך אחרונות</div>
        {dashboardStats?.milestones?.length > 0 ? (
          <div className="shard p-6 bg-[#050b08] border border-[var(--neon-emerald)] flex flex-col gap-6">
            {dashboardStats.milestones.map((m: any, i: number) => {
              const diffSec = Math.floor((Date.now() - m.timestamp) / 1000);
              const diffMin = Math.floor(diffSec / 60);
              const timeStr = diffSec < 60 ? `לפני ${diffSec} שניות` : `לפני ${diffMin} דקות`;
              
              const mColor = m.isCorrect ? 'var(--neon-emerald)' : '#ff4b4b';

              return (
                <div key={i} className="flex gap-4 items-start relative before:absolute before:left-[5px] before:top-6 before:bottom-[-20px] before:w-[1px] before:bg-[#1a3324] last:before:hidden">
                  <div className="w-3 h-3 mt-1 z-10" style={{ backgroundColor: mColor, boxShadow: `0 0 10px ${mColor}`, transform: m.isCorrect ? 'rotate(45deg)' : 'none' }} />
                  <div>
                    <div className="text-base text-white"><strong className="text-[var(--acid-green)]">{m.studentName}</strong> {m.action} <span className="text-xs opacity-60 ml-2">({m.topicName})</span></div>
                    <div className="t-mono-label text-xs mt-1" style={{ color: mColor }}>{timeStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="shard p-6 text-center text-[var(--acid-green)] opacity-50 border border-dashed border-[var(--acid-green)]">
            אין אירועים עדיין
          </div>
        )}

        {/* כרטיס מהירות הפעלה גלובלית */}
        <div className="shard p-8 bg-[rgba(0,255,136,0.02)] border-l-4 border-l-[var(--neon-emerald)] border-t border-b border-r border-[#1a3324]">
          <div className="t-mono-label text-[var(--acid-green)] mb-3 uppercase tracking-widest">מהירות שיעור גלובלית</div>
          <div className="font-black text-6xl text-white mb-2 tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
            {dashboardStats?.globalSpeed || 0} <span className="text-xl text-[var(--neon-emerald)] font-normal tracking-normal uppercase ml-2">פעולות/דקה</span>
          </div>
          <div className="text-sm text-[#8ab098]">
            מבוסס על ממוצע כיתתי בשעה האחרונה
          </div>
        </div>

      </div>
    </div>
  );
}
