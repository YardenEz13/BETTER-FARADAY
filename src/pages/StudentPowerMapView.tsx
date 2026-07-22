import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronRight, ArrowRight, ChevronDown, MessageSquare, Bot, GraduationCap } from "../components/electric";
import CyberAvatar from "../components/CyberAvatar";
import FaradayCanvas from "../components/FaradayCanvas";
import { ElectricBolt } from "../components/electric";
import MathText from "../components/MathText";
import { useCountUp } from "../lib/gsapUtils";
import { formatDateHe as formatDate, formatDurationHe as formatDuration } from "../lib/dates";

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
  const recentChats = useQuery(
    api.aiChat.getRecentChatsWithMessages,
    studentId ? { studentId, limit: 5 } : "skip"
  );
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  // Which topic cell is expanded into its session-brief drill-down.
  const [openTopicId, setOpenTopicId] = useState<Id<"topics"> | null>(null);
  const topicBriefs = useQuery(
    api.sessionBriefs.getBriefsForStudentTopic,
    studentId && openTopicId ? { studentId, topicId: openTopicId } : "skip"
  );
  const recentAttempts = useQuery(
    api.attempts.getRecentAttempts,
    studentId ? { studentId } : "skip"
  );

  // GSAP count-up on the engagement tallies. Hooks run before the early return
  // so their order stays stable; guarded for the pre-load render.
  const totalSessionsRef = useCountUp<HTMLSpanElement>(powerMap?.engagement?.totalSessions ?? 0, { grouped: false });
  const totalMessagesRef = useCountUp<HTMLSpanElement>(powerMap?.engagement?.totalMessages ?? 0, { grouped: false });

  if (!studentId) {
    return (
      <div className="flex flex-col w-full min-h-[calc(100vh-6rem)] p-10 items-center justify-center bg-background text-on-background font-body-md" dir="rtl">
        <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors mb-6 shadow-sm font-label-md" onClick={onBack}>
          <ChevronRight size={16} /> חזרה למפת חום
        </button>
        <div className="bg-surface border border-outline-variant rounded-2xl p-12 text-center w-full max-w-4xl mx-auto mt-8 shadow-sm">
          <ElectricBolt size={64} glow={1} className="mb-6 mx-auto block" />
          <div className="text-on-surface font-headline-lg mb-4">בחר תלמיד</div>
          <div className="text-on-surface-variant font-body-lg">
            לחץ על כרטיסיית תלמיד במפת החום כדי לראות את הפרופיל שלו
          </div>
        </div>
      </div>
    );
  }

  // First chat is open by default; "__none__" means the user explicitly collapsed it.
  const effectiveOpen =
    openChatId === null ? recentChats?.[0]?._id ?? null : openChatId === "__none__" ? null : openChatId;
  const toggleChat = (id: string) =>
    setOpenChatId((prev) => {
      const cur = prev === null ? recentChats?.[0]?._id ?? null : prev === "__none__" ? null : prev;
      return cur === id ? "__none__" : id;
    });

  const SENTIMENT: Record<string, { he: string; color: string }> = {
    frustrated: { he: "מתוסכל", color: "var(--color-error)" },
    neutral: { he: "ניטרלי", color: "var(--color-secondary)" },
    confident: { he: "בטוח", color: "var(--color-primary)" },
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full gap-6 lg:gap-8 p-4 lg:p-8 overflow-y-auto lg:overflow-hidden bg-background text-on-background font-body-md" dir="rtl">
      {/* Center/Main: Power Map - Expansive */}
      <div className="flex-1 min-w-0 lg:overflow-y-auto pr-0 lg:pr-4 pb-10 lg:pb-20">
        <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors mb-8 w-fit shadow-sm font-label-md" onClick={onBack}>
          <ChevronRight size={16} /> חזרה למפת חום
        </button>

        {/* Student header — the constellation canvas reads as "this student's
            skills, mapped", which is exactly what the panel below it is. */}
        <div className="bg-surface border border-outline-variant rounded-2xl p-8 mb-10 flex items-center gap-8 w-full shadow-sm relative overflow-hidden">
          <FaradayCanvas variant="constellation" style={{ opacity: 0.5 }} />
          <div className="absolute top-0 right-0 w-2 h-full bg-primary shadow-sm z-10"></div>
          {student && (
            <div className="relative z-10 w-20 h-20 rounded-full border-4 border-surface shadow-md overflow-hidden bg-primary-container">
               <CyberAvatar name={student.name} size={80} />
            </div>
          )}
          <div className="relative z-10">
            <div className="text-on-surface mb-2 font-headline-xl">
              {student?.name || "..."}
            </div>
            <div className="font-label-lg text-on-surface-variant opacity-90">
              פרופיל למידה מצטבר
            </div>
          </div>
        </div>

        {/* Topic Mastery Heatmap */}
        <div className="font-headline-md text-on-surface mb-6 border-b border-outline-variant pb-2">מפת שליטה בנושאים</div>
        {powerMap?.topicMastery && powerMap.topicMastery.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12 w-full">
            {powerMap.topicMastery.map((t: any) => {
              const tierVar = t.masteryScore >= 70 ? 'var(--color-primary)' : t.masteryScore >= 40 ? 'var(--color-secondary)' : 'var(--color-error)';
              const intensity = Math.max(0, Math.min(100, t.masteryScore)) / 100;
              const open = openTopicId === t.topicId;
              return (
                <button
                  key={t.topicId}
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenTopicId(open ? null : t.topicId)}
                  className="intensity-cell bg-surface rounded-2xl border-2 p-6 text-start transition-all hover:-translate-y-1 cursor-pointer"
                  style={{
                    borderColor: open ? tierVar : `color-mix(in srgb, ${tierVar} 45%, transparent)`,
                    boxShadow: `var(--shadow-clay), 0 0 ${Math.round(6 + intensity * 22)}px color-mix(in srgb, ${tierVar} ${Math.round(18 + intensity * 32)}%, transparent)`,
                  }}
                >
                  <div className="num font-black text-4xl mb-2" style={{ color: tierVar }}>{t.masteryScore}%</div>
                  <div className="text-on-surface font-bold text-sm mb-2 leading-tight">{t.topicName}</div>
                  <div className="num text-xs text-on-surface-variant mt-2">
                    {t.sessionCount} שיחות · דיוק {t.avgAccuracy.toFixed(1)}/5
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-4">
                    <span className="text-sm font-semibold" style={{ color: t.trend === 'improving' ? 'var(--color-primary)' : t.trend === 'declining' ? 'var(--color-error)' : 'var(--color-secondary)' }}>
                      {t.trend === 'improving' ? '↑ משתפר' : t.trend === 'declining' ? '↓ יורד' : '─ יציב'}
                    </span>
                    <ChevronDown size={14} className={`text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface border border-outline-variant rounded-2xl p-10 text-center text-on-surface-variant opacity-70 mb-12 w-full font-body-lg shadow-sm">
            אין מספיק נתונים עדיין
          </div>
        )}

        {/* Drill-down: every Faraday session recorded for the selected topic */}
        <AnimatePresence initial={false}>
          {openTopicId && (
            <motion.div
              key={openTopicId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden -mt-8 mb-12 w-full"
            >
              <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm">
                <div className="font-headline-sm text-on-surface mb-4">שיחות בנושא זה</div>
                {topicBriefs === undefined ? (
                  <div className="text-on-surface-variant opacity-70 font-body-md">טוען…</div>
                ) : topicBriefs.length === 0 ? (
                  <div className="text-on-surface-variant opacity-70 font-body-md">אין עדיין שיחות מתועדות בנושא זה.</div>
                ) : (
                  <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
                    {topicBriefs.slice(0, 10).map((b) => (
                      <li key={b._id} className="flex items-start gap-3 bg-surface-container-low border border-outline-variant rounded-xl p-3">
                        <MessageSquare size={15} className="text-secondary flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-on-surface leading-snug">
                            <MathText>{b.keyInsight || "שיחה ללא סיכום"}</MathText>
                          </div>
                          <div className="num text-xs text-on-surface-variant mt-1">
                            {formatDate(b.createdAt)} · {b.totalMessages} הודעות · אוטונומיה {b.autonomyLevel}/5
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Velocity */}
        <div className="font-headline-md text-on-surface mb-6 border-b border-outline-variant pb-2">מהירות התקדמות</div>
        {powerMap?.progressVelocity?.weeklySnapshots && powerMap.progressVelocity.weeklySnapshots.length > 0 ? (
          <div className="bg-surface border border-outline-variant rounded-2xl p-8 mb-12 w-full shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-10">
                <div className="flex flex-col">
                  <span className="font-label-md text-on-surface-variant mb-1">שינוי דיוק</span>
                  <span className={`num font-headline-lg ${powerMap.progressVelocity.accuracyDelta > 0 ? "text-primary" : powerMap.progressVelocity.accuracyDelta < 0 ? "text-error" : "text-secondary"}`}>
                    {powerMap.progressVelocity.accuracyDelta > 0 ? "+" : ""}{powerMap.progressVelocity.accuracyDelta}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-md text-on-surface-variant mb-1">שינוי עצמאות</span>
                  <span className={`num font-headline-lg ${powerMap.progressVelocity.autonomyDelta > 0 ? "text-primary" : powerMap.progressVelocity.autonomyDelta < 0 ? "text-error" : "text-secondary"}`}>
                    {powerMap.progressVelocity.autonomyDelta > 0 ? "+" : ""}{powerMap.progressVelocity.autonomyDelta}
                  </span>
                </div>
              </div>
              <div className="num font-label-lg text-on-surface bg-surface-container border-2 border-outline px-4 py-2 rounded-full">
                {powerMap.progressVelocity.overall} שיחות/שבוע
              </div>
            </div>
            <div className="flex-col gap-4">
              {powerMap.progressVelocity.weeklySnapshots.map((w: any, i: number) => (
                <div key={i} className="flex items-center gap-6">
                  <div className="font-label-lg text-on-surface-variant w-20 flex-shrink-0">
                    שבוע {i + 1}
                  </div>
                  <div className="flex-1 flex gap-1 h-6 bg-surface-container-low rounded-full overflow-hidden border border-outline-variant relative">
                    <div className="h-full bg-primary" style={{ width: `${(w.avgAccuracy / 5) * 100}%` }}></div>
                  </div>
                  <div className="num text-on-surface font-bold w-12 text-center">
                    {w.avgAccuracy.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-outline-variant rounded-2xl p-10 text-center text-on-surface-variant opacity-70 mb-12 w-full font-body-lg shadow-sm">
            אין מספיק נתונים לתרשים מהירות
          </div>
        )}

        {/* Session Briefs Timeline */}
        <div className="font-headline-md text-on-surface mb-6 border-b border-outline-variant pb-2">סיכומים פדגוגיים</div>
        {briefs && briefs.length > 0 ? (
          <motion.div
            className="flex flex-col gap-6 mb-12 w-full"
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
                className="bg-surface border border-outline-variant rounded-2xl p-8 w-full relative overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <div className="absolute top-0 right-0 w-2 h-full bg-secondary shadow-sm"></div>

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-on-surface font-headline-md mb-1">
                      {brief.totalCycles > 1 ? `${brief.totalCycles} סבבים · ` : ""}{brief.totalMessages} הודעות · {formatDuration(brief.totalDurationMs)}
                    </div>
                    <div className="font-label-md text-on-surface-variant">
                      {formatDate(brief.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="text-on-surface font-body-lg mb-6 leading-relaxed">
                  <strong className="font-bold">גישה:</strong> {brief.approach}
                </div>

                {brief.frictionPoints.length > 0 && (
                  <div className="mb-6 bg-error-container/30 border border-error/20 border-r-4 border-r-error p-4 rounded-l-xl">
                    <div className="font-label-lg text-error mb-2">נקודות חיכוך:</div>
                    {brief.frictionPoints.map((f: string, i: number) => (
                      <div key={i} className="text-on-surface font-body-md ml-3 mb-1">• {f}</div>
                    ))}
                  </div>
                )}

                <div className="flex gap-8 mb-6 bg-surface-container-low p-6 border border-outline-variant rounded-xl">
                  <div className="flex-1">
                    <span className="font-label-lg text-on-surface-variant block mb-3">עצמאות</span>
                    <div className="flex gap-2 h-3">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`flex-1 rounded-full ${n <= brief.autonomyLevel ? 'bg-primary' : 'bg-surface-variant'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="font-label-lg text-on-surface-variant block mb-3">דיוק</span>
                    <div className="flex gap-2 h-3">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`flex-1 rounded-full ${n <= brief.solutionAccuracy ? 'bg-secondary' : 'bg-surface-variant'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-on-surface bg-secondary-container/30 border border-secondary/30 p-5 rounded-xl mb-6 flex items-start gap-4 font-body-lg">
                  <ElectricBolt size={24} tone="violet" glow={0.7} animated={false} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">תובנה:</strong> {brief.keyInsight}
                  </div>
                </div>

                {brief.missingConcepts && brief.missingConcepts.length > 0 && (
                  <div className="mb-6">
                    <div className="font-label-lg text-error mb-3">🧩 מושגים חסרים:</div>
                    <div className="flex gap-2 flex-wrap">
                      {brief.missingConcepts.map((c: string, i: number) => (
                        <span key={i} className="font-label-md bg-error-container text-on-error-container px-3 py-1.5 rounded-full">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {brief.teacherActionItem && (
                  <div className="bg-primary-container/20 border border-primary p-5 rounded-xl mb-6 text-on-surface font-body-lg border-r-4">
                    <strong className="font-bold text-primary">🎯 פעולה נדרשת:</strong> {brief.teacherActionItem}
                  </div>
                )}

                {brief.detailedStruggleAnalysis && (
                  <div className="text-on-surface-variant font-body-md mb-6 p-5 border border-dashed border-outline bg-surface-container-low rounded-xl leading-relaxed">
                    <strong className="text-on-surface block mb-2 font-headline-sm">📋 ניתוח קשיים:</strong> {brief.detailedStruggleAnalysis}
                  </div>
                )}

                {brief.nextSteps && brief.nextSteps.length > 0 && (
                  <div className="mb-6 bg-surface-container p-5 rounded-xl border border-outline-variant">
                    <div className="font-label-lg text-on-surface mb-3">📌 צעדים הבאים:</div>
                    {brief.nextSteps.map((step: string, i: number) => (
                      <div key={i} className="text-on-surface font-body-md ml-3 mb-2 flex items-center gap-2">
                        <ChevronRight size={16} className="text-secondary" /> {step}
                      </div>
                    ))}
                  </div>
                )}

                {brief.studentQuotes && brief.studentQuotes.length > 0 && (
                  <div className="mb-6 p-5 bg-surface-container-highest border-r-4 border-secondary rounded-l-xl">
                    <div className="font-label-lg text-secondary mb-3">💬 ציטוטים מהתלמיד:</div>
                    {brief.studentQuotes.map((q: string, i: number) => (
                      <div key={i} className="text-on-surface italic font-body-lg mb-2">"{q}"</div>
                    ))}
                  </div>
                )}

                {brief.recommendedAction && (
                  <div className="text-on-surface flex items-center gap-3 mt-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant font-body-lg">
                    <ArrowRight size={20} className="text-primary" />
                    <strong>המלצה:</strong> {brief.recommendedAction}
                  </div>
                )}

                {brief.selfAssessment && (
                  <div className="mt-6 p-5 italic text-on-surface-variant border-t border-outline-variant font-body-lg text-center font-serif bg-surface-container-lowest rounded-b-2xl -mx-8 -mb-8">
                    "{brief.selfAssessment}"
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="bg-surface border border-outline-variant rounded-2xl p-12 text-center text-on-surface-variant opacity-70 mb-12 w-full font-body-lg shadow-sm">
            אין סיכומים פדגוגיים עדיין
          </div>
        )}

        {/* Recent AI Conversations — the actual transcripts */}
        <div className="font-headline-md text-on-surface mb-6 border-b border-outline-variant pb-2 flex items-center gap-3">
          שיחות AI אחרונות
          {recentChats && recentChats.length > 0 && (
            <span className="num text-sm font-bold text-secondary bg-secondary/10 border border-secondary/25 px-2.5 py-0.5 rounded-full">{recentChats.length}</span>
          )}
        </div>
        {recentChats && recentChats.length > 0 ? (
          <div className="flex flex-col gap-4 mb-12 w-full">
            {recentChats.map((chat) => {
              const open = effectiveOpen === chat._id;
              const isHomework = chat.agentType === "homework";
              const sent = chat.sentiment ? SENTIMENT[chat.sentiment] : null;
              return (
                <div key={chat._id} className="bg-surface border border-outline-variant rounded-2xl w-full shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleChat(chat._id)}
                    className="w-full flex items-center gap-4 p-5 text-right hover:bg-surface-container-low transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--color-secondary) 14%, transparent)", color: "var(--color-secondary)" }}>
                      {isHomework ? <GraduationCap size={20} /> : <Bot size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-on-surface text-base truncate">
                        {chat.title || (isHomework ? "עזרה בשיעורי בית" : "תרגול עם פאראדיי")}
                      </div>
                      <div className="num text-xs text-on-surface-variant mt-0.5 flex items-center gap-2 flex-wrap">
                        {chat.topicName && <><span>{chat.topicName}</span><span>·</span></>}
                        <span>{formatDate(chat.startedAt)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {chat.messageCount}</span>
                      </div>
                    </div>
                    {sent && (
                      <span className="font-label-md px-3 py-1 rounded-full flex-shrink-0 whitespace-nowrap" style={{ background: `color-mix(in srgb, ${sent.color} 12%, transparent)`, color: sent.color }}>
                        {sent.he}
                      </span>
                    )}
                    <ChevronDown size={20} className={`text-on-surface-variant flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-4 border-t border-outline-variant flex flex-col gap-3 max-h-[460px] overflow-y-auto">
                          {chat.messages.filter((m) => m.role !== "system").length === 0 && (
                            <div className="text-on-surface-variant text-sm py-4 text-center">אין הודעות בשיחה זו</div>
                          )}
                          {chat.messages.map((m, i) => {
                            if (m.role === "system") return null;
                            const isUser = m.role === "user";
                            return (
                              <div key={i} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                                <div
                                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? "bg-primary text-white rounded-br-sm" : "bg-surface-container border border-outline-variant text-on-surface rounded-bl-sm"}`}
                                >
                                  <MathText>{m.content}</MathText>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface border border-outline-variant rounded-2xl p-10 text-center text-on-surface-variant opacity-70 mb-12 w-full font-body-lg shadow-sm">
            אין שיחות AI עדיין
          </div>
        )}
      </div>

      {/* Right panel: Engagement - Wide and expansive sidebar */}
      <div className="w-full lg:w-[420px] lg:flex-shrink-0 flex flex-col gap-6 pb-10 lg:pb-20 lg:overflow-y-auto">
        {/* Raw answer stream — the briefs above are AI-summarised, this is what
            the student actually submitted, newest first. */}
        <div className="font-headline-md text-on-surface border-b border-outline-variant pb-2">תרגול אחרון</div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-5 w-full shadow-sm">
          {recentAttempts === undefined ? (
            <div className="text-on-surface-variant opacity-70 font-body-md">טוען…</div>
          ) : recentAttempts.length === 0 ? (
            <div className="text-on-surface-variant opacity-70 font-body-md">התלמיד עוד לא פתר שאלות.</div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {recentAttempts.slice(0, 20).map((a) => (
                  <span
                    key={a._id}
                    title={`${a.isCorrect ? "נכון" : "שגוי"} · ${formatDate(a._creationTime)}`}
                    className="w-3.5 h-3.5 rounded-[4px] flex-shrink-0"
                    style={{ background: a.isCorrect ? "var(--color-primary)" : "var(--color-error)" }}
                  />
                ))}
              </div>
              <div className="num text-xs text-on-surface-variant">
                {recentAttempts.filter((a) => a.isCorrect).length}/{recentAttempts.length} נכונות
                {" · "}העדכני ביותר {formatDate(recentAttempts[0]._creationTime)}
              </div>
            </>
          )}
        </div>

        <div className="font-headline-md text-on-surface border-b border-outline-variant pb-2">מטריקות מעורבות</div>

        {powerMap?.engagement ? (
          <div className="flex flex-col gap-6 w-full">
            <div className="bg-surface border border-outline-variant rounded-2xl p-6 w-full relative overflow-hidden shadow-sm">
               <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary to-primary"></div>
              <div className="font-headline-sm text-on-surface mb-5 inline-block">סטטיסטיקות</div>
              <div className="flex-col gap-4 text-on-surface">
                <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                  <span className="font-body-md text-on-surface-variant">סה"כ שיחות</span>
                  <span ref={totalSessionsRef} className="num font-bold text-lg text-primary">{powerMap.engagement.totalSessions}</span>
                </div>
                <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                  <span className="font-body-md text-on-surface-variant">סה"כ הודעות</span>
                  <span ref={totalMessagesRef} className="num font-bold text-lg text-primary">{powerMap.engagement.totalMessages}</span>
                </div>
                <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                  <span className="font-body-md text-on-surface-variant">משך ממוצע</span>
                  <span className="num font-bold text-lg text-primary">{formatDuration(powerMap.engagement.avgSessionDuration)}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-outline-variant rounded-2xl p-6 w-full shadow-sm">
              <div className="font-headline-sm text-on-surface mb-4">סגנון למידה</div>
              <div className="text-primary font-headline-xl mb-3">
                {powerMap.engagement.inquiryStyle === "explorer" ? "חוקר" : powerMap.engagement.inquiryStyle === "direct" ? "ישיר" : "פסיבי"}
              </div>
              <div className="text-on-surface-variant font-body-md bg-surface-container-low p-4 rounded-xl border border-outline-variant leading-relaxed">
                {powerMap.engagement.inquiryStyle === "explorer"
                  ? "שואל שאלות עומק ומציג עבודה עצמית. ממשיך לחקור מעבר לנדרש."
                  : powerMap.engagement.inquiryStyle === "direct"
                    ? "שואל שאלות ממוקדות ועניינית. חותר לפתרון מהיר וישיר."
                    : "ממתין להנחיות, מעט יוזמה עצמית. צריך עידוד ודחיפה."}
              </div>
            </div>

            <div className="bg-surface border border-outline-variant rounded-2xl p-6 w-full flex flex-col items-center justify-center text-center shadow-sm">
              <div className="font-headline-sm text-on-surface mb-4 w-full text-right">מגמת תסכול</div>
              <div className={`font-headline-xl py-4 ${powerMap.engagement.frustrationTrend === "decreasing" ? "text-primary" : powerMap.engagement.frustrationTrend === "increasing" ? "text-error" : "text-secondary"}`}>
                {powerMap.engagement.frustrationTrend === "decreasing" ? "↓ יורד"
                  : powerMap.engagement.frustrationTrend === "increasing" ? "↑ עולה"
                    : "─ יציב"}
              </div>
              <div className="font-label-md text-on-surface-variant">
                 {powerMap.engagement.frustrationTrend === "decreasing" ? "מגמה חיובית"
                  : powerMap.engagement.frustrationTrend === "increasing" ? "דורש התערבות"
                    : "מצב סטטי"}
              </div>
            </div>

            {powerMap.engagement.inquiryEvolution && powerMap.engagement.inquiryEvolution.length > 1 && (
              <div className="bg-surface border border-outline-variant rounded-2xl p-6 w-full shadow-sm">
                <div className="font-headline-sm text-on-surface mb-5">אבולוציית סגנון</div>
                <div className="flex-col gap-3">
                  {powerMap.engagement.inquiryEvolution.map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant">
                      <div className="w-8 font-label-md text-on-surface-variant">#{i+1}</div>
                      <div className="rounded-full w-4 h-4" style={{
                        background: e.style === "explorer" ? "var(--color-primary)" : e.style === "direct" ? "var(--color-secondary)" : "var(--color-tertiary)",
                      }} />
                      <span className="text-on-surface font-headline-sm">
                        {e.style === "explorer" ? "חוקר" : e.style === "direct" ? "ישיר" : "פסיבי"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-surface border border-outline-variant rounded-2xl p-10 text-center text-on-surface-variant opacity-70 w-full font-body-lg shadow-sm">
            אין נתוני מעורבות עדיין
          </div>
        )}
      </div>
    </div>
  );
}

