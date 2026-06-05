import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { ChevronRight, TrendingUp, Zap, ArrowRight } from "lucide-react";
import CyberAvatar from "../components/CyberAvatar";

export function StudentPowerMapView({ studentId, onBack }: { studentId: Id<"students"> | null; onBack: () => void }) {
  const powerMap = useQuery(
    api.powerMap.getStudentPowerMap,
    studentId ? { studentId } : "skip"
  );
  const briefs = useQuery(
    api.sessionBriefs.getBriefsForStudent,
    studentId ? { studentId } : "skip"
  );
  const student = useQuery(
    api.classroom.get,
    studentId ? { id: studentId } : "skip"
  );

  if (!studentId) {
    return (
      <div className="flex-col w-full h-full p-10 items-center justify-center">
        <button className="cyber-btn mb-6" onClick={onBack}>
          <ChevronRight size={16} /> חזרה למפת חום
        </button>
        <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-12 text-center w-full max-w-4xl mx-auto mt-8">
          <TrendingUp size={64} className="text-[var(--neon-emerald)] mb-6 mx-auto" style={{ filter: "drop-shadow(0 0 10px var(--neon-emerald))" }} />
          <div className="text-[var(--laser-cyan)] text-2xl font-black mb-4">בחר תלמיד</div>
          <div className="text-[var(--neon-emerald)] opacity-80 text-lg">
            לחץ על כרטיסיית תלמיד במפת החום כדי לראות את הפרופיל שלו
          </div>
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    const mins = Math.round(ms / 60000);
    return mins < 60 ? `${mins} דק'` : `${Math.floor(mins / 60)} שע' ${mins % 60} דק'`;
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex w-full h-full gap-8 p-8 overflow-hidden">
      {/* Center/Main: Power Map - Expansive */}
      <div className="flex-1 flex-col overflow-y-auto pr-4 pb-20">
        <button className="cyber-btn mb-8 w-fit flex items-center gap-2" onClick={onBack}>
          <ChevronRight size={16} /> חזרה למפת חום
        </button>

        {/* Student header */}
        <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-8 mb-10 flex items-center gap-8 w-full shadow-[0_0_30px_rgba(0,255,136,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-[var(--neon-emerald)] shadow-[0_0_15px_var(--neon-emerald)]"></div>
          {student && (
            <CyberAvatar name={student.name} size={80} />
          )}
          <div>
            <div className="text-[var(--laser-cyan)] mb-2" style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "3rem", textShadow: "0 0 15px rgba(0,255,255,0.5)" }}>
              {student?.name || "..."}
            </div>
            <div className="t-mono-label text-[var(--neon-emerald)] text-lg opacity-90">
              פרופיל למידה מצטבר
            </div>
          </div>
        </div>

        {/* Topic Mastery Heatmap */}
        <div className="t-mini-title text-[var(--laser-cyan)] mb-6 text-2xl border-b border-[rgba(0,255,255,0.2)] pb-2">מפת שליטה בנושאים</div>
        {powerMap?.topicMastery && powerMap.topicMastery.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-12 w-full">
            {powerMap.topicMastery.map((t: any) => (
              <div key={t.topicId} className={`shard p-8 bg-[rgba(0,255,136,0.05)] border transition-all hover:scale-105 hover:shadow-[0_0_20px_var(--neon-emerald)] ${t.masteryScore >= 70 ? 'border-[var(--neon-emerald)]' : t.masteryScore >= 40 ? 'border-[var(--warning)]' : 'border-[var(--danger)]'}`}>
                <div className="text-[var(--laser-cyan)] mb-2" style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: "3.5rem", lineHeight: 1, textShadow: "0 0 15px rgba(0,255,255,0.4)" }}>
                  {t.masteryScore}%
                </div>
                <div className="text-[var(--neon-emerald)] font-bold text-xl mt-4 mb-2 leading-tight">{t.topicName}</div>
                <div className="t-mono-label text-[var(--neon-emerald)] opacity-70 mt-2 text-sm">
                  {t.sessionCount} שיחות · דיוק {t.avgAccuracy.toFixed(1)}/5
                </div>
                <div className="t-mono-label mt-3 font-bold" style={{ color: t.trend === 'improving' ? 'var(--neon-emerald)' : t.trend === 'declining' ? 'var(--danger)' : 'var(--laser-cyan)' }}>
                  {t.trend === 'improving' ? '↑ משתפר' : t.trend === 'declining' ? '↓ יורד' : '─ יציב'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-10 text-center text-[var(--neon-emerald)] opacity-50 mb-12 w-full text-xl">
            אין מספיק נתונים עדיין
          </div>
        )}

        {/* Progress Velocity */}
        <div className="t-mini-title text-[var(--laser-cyan)] mb-6 text-2xl border-b border-[rgba(0,255,255,0.2)] pb-2">מהירות התקדמות</div>
        {powerMap?.progressVelocity?.weeklySnapshots && powerMap.progressVelocity.weeklySnapshots.length > 0 ? (
          <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-8 mb-12 w-full shadow-[0_0_20px_rgba(0,255,136,0.05)]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-10">
                <div className="flex flex-col">
                  <span className="t-mono-label text-[var(--neon-emerald)] opacity-70 mb-1 text-sm">שינוי דיוק</span>
                  <span className="font-black text-3xl" style={{ color: powerMap.progressVelocity.accuracyDelta > 0 ? "var(--neon-emerald)" : powerMap.progressVelocity.accuracyDelta < 0 ? "var(--danger)" : "var(--laser-cyan)", textShadow: "0 0 15px currentColor" }}>
                    {powerMap.progressVelocity.accuracyDelta > 0 ? "+" : ""}{powerMap.progressVelocity.accuracyDelta}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="t-mono-label text-[var(--neon-emerald)] opacity-70 mb-1 text-sm">שינוי עצמאות</span>
                  <span className="font-black text-3xl" style={{ color: powerMap.progressVelocity.autonomyDelta > 0 ? "var(--neon-emerald)" : powerMap.progressVelocity.autonomyDelta < 0 ? "var(--danger)" : "var(--laser-cyan)", textShadow: "0 0 15px currentColor" }}>
                    {powerMap.progressVelocity.autonomyDelta > 0 ? "+" : ""}{powerMap.progressVelocity.autonomyDelta}
                  </span>
                </div>
              </div>
              <div className="t-mono-label text-[var(--neon-emerald)] opacity-70 text-lg border border-[rgba(0,255,136,0.3)] px-4 py-2 bg-[rgba(0,0,0,0.3)]">
                {powerMap.progressVelocity.overall} שיחות/שבוע
              </div>
            </div>
            <div className="flex-col gap-5">
              {powerMap.progressVelocity.weeklySnapshots.map((w: any, i: number) => (
                <div key={i} className="flex items-center gap-6">
                  <div className="t-mono-label text-[var(--laser-cyan)] w-20 flex-shrink-0 text-base">
                    שבוע {i + 1}
                  </div>
                  <div className="flex-1 flex gap-1 h-8 bg-[rgba(0,0,0,0.5)] p-1 border border-[rgba(0,255,136,0.3)] relative">
                    <div className="h-full relative" style={{ width: `${(w.avgAccuracy / 5) * 100}%`, background: "linear-gradient(90deg, transparent, var(--neon-emerald))", boxShadow: "inset 0 0 10px var(--neon-emerald)" }}>
                        <div className="absolute top-0 right-0 w-2 h-full bg-[var(--laser-cyan)] shadow-[0_0_10px_var(--laser-cyan)]"></div>
                    </div>
                  </div>
                  <div className="text-[var(--laser-cyan)] font-black w-12 text-center text-xl" style={{ textShadow: "0 0 10px rgba(0,255,255,0.5)" }}>
                    {w.avgAccuracy.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-10 text-center text-[var(--neon-emerald)] opacity-50 mb-12 w-full text-xl">
            אין מספיק נתונים לתרשים מהירות
          </div>
        )}

        {/* Session Briefs Timeline */}
        <div className="t-mini-title text-[var(--laser-cyan)] mb-6 text-2xl border-b border-[rgba(0,255,255,0.2)] pb-2">סיכומים פדגוגיים</div>
        {briefs && briefs.length > 0 ? (
          <motion.div
            className="flex-col gap-8 mb-12 w-full"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
          >
            {briefs.map((brief: any) => (
              <motion.div
                key={brief._id}
                className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-8 w-full relative overflow-hidden"
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
                whileHover={{
                  scale: 1.005,
                  boxShadow: '0 0 25px rgba(0,255,136,0.2)'
                }}
              >
                {/* Decorative glowing edge */}
                <div className="absolute top-0 right-0 w-2 h-full bg-[var(--neon-emerald)] shadow-[0_0_15px_var(--neon-emerald)]"></div>

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-[var(--laser-cyan)] font-black text-2xl mb-1" style={{ textShadow: "0 0 10px rgba(0,255,255,0.3)" }}>
                      {brief.totalCycles > 1 ? `${brief.totalCycles} סבבים · ` : ""}{brief.totalMessages} הודעות · {formatDuration(brief.totalDurationMs)}
                    </div>
                    <div className="t-mono-label text-[var(--neon-emerald)] opacity-70 text-base">
                      {formatDate(brief.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="text-[var(--neon-emerald)] text-lg mb-6 leading-relaxed">
                  <strong className="text-[var(--laser-cyan)]">גישה:</strong> {brief.approach}
                </div>

                {brief.frictionPoints.length > 0 && (
                  <div className="mb-6 bg-[rgba(255,50,50,0.05)] border border-[rgba(255,50,50,0.3)] border-r-4 border-r-[var(--danger)] p-4 shadow-[0_0_15px_rgba(255,50,50,0.1)]">
                    <div className="t-mono-label text-[var(--danger)] mb-3 text-lg font-bold">נקודות חיכוך:</div>
                    {brief.frictionPoints.map((f: string, i: number) => (
                      <div key={i} className="text-[var(--danger)] text-base ml-3 opacity-90 mb-1">• {f}</div>
                    ))}
                  </div>
                )}

                <div className="flex gap-10 mb-6 bg-[rgba(0,0,0,0.3)] p-6 border border-[rgba(0,255,136,0.2)]">
                  <div className="flex-1">
                    <span className="t-mono-label text-[var(--neon-emerald)] opacity-90 block mb-3 text-base">עצמאות</span>
                    <div className="flex gap-2 h-4">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`flex-1 border ${n <= brief.autonomyLevel ? 'bg-[var(--neon-emerald)] border-[var(--neon-emerald)] shadow-[0_0_10px_var(--neon-emerald)]' : 'bg-[rgba(0,0,0,0.5)] border-[rgba(0,255,136,0.2)]'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="t-mono-label text-[var(--laser-cyan)] opacity-90 block mb-3 text-base">דיוק</span>
                    <div className="flex gap-2 h-4">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`flex-1 border ${n <= brief.solutionAccuracy ? 'bg-[var(--laser-cyan)] border-[var(--laser-cyan)] shadow-[0_0_10px_var(--laser-cyan)]' : 'bg-[rgba(0,0,0,0.5)] border-[rgba(0,255,255,0.2)]'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-[var(--neon-emerald)] bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.3)] p-4 mb-6 flex items-start gap-4 text-lg">
                  <Zap size={24} className="text-[var(--laser-cyan)] flex-shrink-0 mt-1" style={{ filter: "drop-shadow(0 0 10px var(--laser-cyan))" }} />
                  <div>
                    <strong className="text-[var(--laser-cyan)]">תובנה:</strong> {brief.keyInsight}
                  </div>
                </div>

                {brief.missingConcepts && brief.missingConcepts.length > 0 && (
                  <div className="mb-6">
                    <div className="t-mono-label text-[var(--danger)] mb-3 text-base font-bold">🧩 מושגים חסרים:</div>
                    <div className="flex gap-3 flex-wrap">
                      {brief.missingConcepts.map((c: string, i: number) => (
                        <span key={i} className="t-mono-label bg-[rgba(255,50,50,0.1)] text-[var(--danger)] border border-[var(--danger)] px-4 py-2 shadow-[0_0_10px_rgba(255,50,50,0.2)] text-base">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {brief.teacherActionItem && (
                  <div className="bg-[rgba(0,255,255,0.1)] border border-[var(--laser-cyan)] p-4 mb-6 text-[var(--laser-cyan)] text-lg shadow-[0_0_15px_rgba(0,255,255,0.15)] border-r-4">
                    <strong>🎯 פעולה נדרשת:</strong> {brief.teacherActionItem}
                  </div>
                )}

                {brief.detailedStruggleAnalysis && (
                  <div className="text-[var(--neon-emerald)] opacity-80 text-base mb-6 p-5 border border-dashed border-[rgba(0,255,136,0.4)] bg-[rgba(0,0,0,0.2)] leading-relaxed">
                    <strong className="text-[var(--laser-cyan)] block mb-2 text-lg">📋 ניתוח קשיים:</strong> {brief.detailedStruggleAnalysis}
                  </div>
                )}

                {brief.nextSteps && brief.nextSteps.length > 0 && (
                  <div className="mb-6 bg-[rgba(0,255,136,0.05)] p-4 border border-[rgba(0,255,136,0.2)]">
                    <div className="t-mono-label text-[var(--neon-emerald)] mb-3 text-lg font-bold">📌 צעדים הבאים:</div>
                    {brief.nextSteps.map((step: string, i: number) => (
                      <div key={i} className="text-[var(--neon-emerald)] text-base opacity-90 ml-3 mb-2 flex items-center gap-2">
                        <ChevronRight size={14} className="text-[var(--laser-cyan)]" /> {step}
                      </div>
                    ))}
                  </div>
                )}

                {brief.studentQuotes && brief.studentQuotes.length > 0 && (
                  <div className="mb-6 p-5 bg-[rgba(0,0,0,0.4)] border-r-4 border-[var(--laser-cyan)] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                    <div className="t-mono-label text-[var(--laser-cyan)] opacity-70 mb-3 text-base">💬 ציטוטים מהתלמיד:</div>
                    {brief.studentQuotes.map((q: string, i: number) => (
                      <div key={i} className="text-[var(--neon-emerald)] italic text-lg mb-3 leading-relaxed">"{q}"</div>
                    ))}
                  </div>
                )}

                {brief.recommendedAction && (
                  <div className="text-[var(--laser-cyan)] flex items-center gap-3 mt-4 bg-[rgba(0,255,255,0.05)] p-4 border border-[rgba(0,255,255,0.3)] text-lg">
                    <ArrowRight size={20} className="text-[var(--neon-emerald)]" style={{ filter: "drop-shadow(0 0 5px var(--neon-emerald))" }} />
                    <strong>המלצה:</strong> {brief.recommendedAction}
                  </div>
                )}

                {brief.selfAssessment && (
                  <div className="mt-6 p-4 italic text-[var(--neon-emerald)] opacity-80 border-t border-[rgba(0,255,136,0.3)] text-lg text-center font-serif">
                    "{brief.selfAssessment}"
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-12 text-center text-[var(--neon-emerald)] opacity-50 mb-12 w-full text-xl">
            אין סיכומים פדגוגיים עדיין
          </div>
        )}
      </div>

      {/* Right panel: Engagement - Wide and expansive sidebar */}
      <div className="w-[480px] flex-shrink-0 flex-col gap-8 pb-20 overflow-y-auto pr-2">
        <div className="t-mini-title text-[var(--laser-cyan)] text-2xl border-b border-[rgba(0,255,255,0.2)] pb-2">מטריקות מעורבות</div>

        {powerMap?.engagement ? (
          <div className="flex-col gap-8 w-full">
            <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-8 w-full relative overflow-hidden">
               <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--laser-cyan)] to-[var(--neon-emerald)] opacity-50"></div>
              <div className="t-mono-label text-[var(--laser-cyan)] mb-6 text-lg border-b border-[rgba(0,255,255,0.2)] pb-2 inline-block">סטטיסטיקות</div>
              <div className="flex-col gap-6 text-[var(--neon-emerald)]">
                <div className="flex justify-between items-center bg-[rgba(0,0,0,0.3)] p-4 border border-[rgba(0,255,136,0.2)]">
                  <span className="opacity-90 text-lg">סה"כ שיחות</span>
                  <span className="font-black text-3xl text-[var(--laser-cyan)] shadow-[0_0_15px_var(--laser-cyan)]">{powerMap.engagement.totalSessions}</span>
                </div>
                <div className="flex justify-between items-center bg-[rgba(0,0,0,0.3)] p-4 border border-[rgba(0,255,136,0.2)]">
                  <span className="opacity-90 text-lg">סה"כ הודעות</span>
                  <span className="font-black text-3xl text-[var(--laser-cyan)] shadow-[0_0_15px_var(--laser-cyan)]">{powerMap.engagement.totalMessages}</span>
                </div>
                <div className="flex justify-between items-center bg-[rgba(0,0,0,0.3)] p-4 border border-[rgba(0,255,136,0.2)]">
                  <span className="opacity-90 text-lg">משך ממוצע</span>
                  <span className="font-black text-3xl text-[var(--laser-cyan)] shadow-[0_0_15px_var(--laser-cyan)]">{formatDuration(powerMap.engagement.avgSessionDuration)}</span>
                </div>
              </div>
            </div>

            <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-8 w-full">
              <div className="t-mono-label text-[var(--laser-cyan)] mb-4 text-lg border-b border-[rgba(0,255,255,0.2)] pb-2 inline-block">סגנון למידה</div>
              <div className="text-[var(--neon-emerald)] font-black text-4xl mb-4 mt-2" style={{ textShadow: "0 0 20px var(--neon-emerald)" }}>
                {powerMap.engagement.inquiryStyle === "explorer" ? "חוקר" : powerMap.engagement.inquiryStyle === "direct" ? "ישיר" : "פסיבי"}
              </div>
              <div className="text-[var(--laser-cyan)] opacity-90 text-lg leading-relaxed bg-[rgba(0,0,0,0.3)] p-4 border border-[rgba(0,255,255,0.2)]">
                {powerMap.engagement.inquiryStyle === "explorer"
                  ? "שואל שאלות עומק ומציג עבודה עצמית. ממשיך לחקור מעבר לנדרש."
                  : powerMap.engagement.inquiryStyle === "direct"
                    ? "שואל שאלות ממוקדות ועניינית. חותר לפתרון מהיר וישיר."
                    : "ממתין להנחיות, מעט יוזמה עצמית. צריך עידוד ודחיפה."}
              </div>
            </div>

            <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-8 w-full flex flex-col items-center justify-center text-center">
              <div className="t-mono-label text-[var(--laser-cyan)] mb-4 text-lg w-full text-right border-b border-[rgba(0,255,255,0.2)] pb-2">מגמת תסכול</div>
              <div className="font-black text-5xl py-6" style={{
                color: powerMap.engagement.frustrationTrend === "decreasing" ? "var(--neon-emerald)"
                  : powerMap.engagement.frustrationTrend === "increasing" ? "var(--danger)"
                    : "var(--laser-cyan)",
                textShadow: "0 0 20px currentColor"
              }}>
                {powerMap.engagement.frustrationTrend === "decreasing" ? "↓ יורד"
                  : powerMap.engagement.frustrationTrend === "increasing" ? "↑ עולה"
                    : "─ יציב"}
              </div>
              <div className="t-mono-label text-[var(--neon-emerald)] opacity-70 mt-2">
                 {powerMap.engagement.frustrationTrend === "decreasing" ? "מגמה חיובית"
                  : powerMap.engagement.frustrationTrend === "increasing" ? "דורש התערבות"
                    : "מצב סטטי"}
              </div>
            </div>

            {powerMap.engagement.inquiryEvolution && powerMap.engagement.inquiryEvolution.length > 1 && (
              <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-8 w-full">
                <div className="t-mono-label text-[var(--laser-cyan)] mb-6 text-lg border-b border-[rgba(0,255,255,0.2)] pb-2 inline-block">אבולוציית סגנון</div>
                <div className="flex-col gap-4">
                  {powerMap.engagement.inquiryEvolution.map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 bg-[rgba(0,0,0,0.3)] p-3 border border-[rgba(0,255,136,0.1)]">
                      <div className="w-8 t-mono-label text-[var(--laser-cyan)] opacity-70">#{i+1}</div>
                      <div className="rounded-none shadow-[0_0_10px_currentColor]" style={{
                        background: e.style === "explorer" ? "var(--neon-emerald)" : e.style === "direct" ? "var(--laser-cyan)" : "var(--warning)",
                        color: e.style === "explorer" ? "var(--neon-emerald)" : e.style === "direct" ? "var(--laser-cyan)" : "var(--warning)",
                        width: 16, height: 16
                      }} />
                      <span className="text-[var(--neon-emerald)] opacity-100 font-bold text-lg">
                        {e.style === "explorer" ? "חוקר" : e.style === "direct" ? "ישיר" : "פסיבי"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="shard bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] p-12 text-center text-[var(--neon-emerald)] opacity-50 w-full text-xl">
            אין נתוני מעורבות עדיין
          </div>
        )}
      </div>
    </div>
  );
}
