import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight, Trophy, Zap, Star, SparkBurst, Sparkles,
} from "../components/electric";
import { ThemeToggle } from "../components/ThemeContext";
import CyberAvatar from "../components/CyberAvatar";
import FaradayCanvas from "../components/FaradayCanvas";
import ClaySkeleton from "../components/ClaySkeleton";
import { useCountUp } from "../lib/gsapUtils";
import { fireStreak } from "../lib/celebrations";

type Row = {
  rank: number;
  studentId: string;
  name: string;
  avatarColor: string;
  weeklyXp: number;
  isMe: boolean;
};

// Podium accents: #1 amber/tertiary (energy), #2 violet/secondary, #3 primary.
const PODIUM = [
  { color: "var(--color-tertiary)", label: "מקום ראשון", h: 132 },
  { color: "var(--color-secondary)", label: "מקום שני", h: 104 },
  { color: "var(--color-primary)", label: "מקום שלישי", h: 84 },
] as const;

// ── Countdown to the next Sunday-00:00 (Israel) reset ──
function useResetCountdown(weekStart: number | undefined) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!weekStart) return;
    const end = weekStart + 7 * 86_400_000;
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(d > 0 ? `עוד ${d} ימים ו-${h} שעות` : h > 0 ? `עוד ${h} שעות ו-${m} דקות` : `עוד ${m} דקות`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [weekStart]);
  return label;
}

/** GSAP-driven XP odometer — counts up on reveal and re-tweens on live updates. */
function CountUpXp({ value }: { value: number }) {
  const ref = useCountUp<HTMLSpanElement>(value, { duration: 1 });
  return <span ref={ref}>{value.toLocaleString()}</span>;
}

function PodiumCard({ row, place, reducedMotion }: { row: Row; place: number; reducedMotion: boolean }) {
  const p = PODIUM[place];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + place * 0.08, type: "spring", stiffness: 260, damping: 22 }}
      className="flex flex-col items-center justify-end flex-1 min-w-0"
    >
      {/* avatar + crown */}
      <div className="relative mb-2">
        {place === 0 && (
          <Star size={22} className="absolute -top-5 left-1/2 -translate-x-1/2 text-tertiary" style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-tertiary) 60%, transparent))" }} />
        )}
        <div className="rounded-full p-[3px]" style={{ background: p.color, boxShadow: `0 0 18px 2px color-mix(in srgb, ${p.color} 40%, transparent)` }}>
          <CyberAvatar name={row.name} size={place === 0 ? 60 : 50} color={row.avatarColor} />
        </div>
        {place === 0 && !reducedMotion && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <SparkBurst />
          </div>
        )}
      </div>
      <div className="text-center max-w-full px-1 mb-2">
        <div className="font-bold text-sm text-on-surface truncate">{row.name}</div>
        <div className="num font-extrabold flex items-center justify-center gap-1 text-sm" style={{ color: p.color }}>
          <Zap size={13} /> <CountUpXp value={row.weeklyXp} />
        </div>
      </div>
      {/* pedestal */}
      <div
        className="w-full rounded-t-2xl border-2 border-b-0 flex items-start justify-center pt-2"
        style={{
          height: p.h,
          background: `color-mix(in srgb, ${p.color} 12%, var(--color-surface))`,
          borderColor: `color-mix(in srgb, ${p.color} 40%, var(--color-outline))`,
          boxShadow: "var(--shadow-clay)",
        }}
      >
        <span className="num font-extrabold text-2xl" style={{ color: p.color }}>{row.rank}</span>
      </div>
    </motion.div>
  );
}

function RankRow({ row, reducedMotion }: { row: Row; reducedMotion: boolean }) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(row.rank, 12) * 0.03 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${
        row.isMe ? "border-primary bg-primary/8" : "border-outline bg-surface"
      }`}
      style={{ boxShadow: row.isMe ? "var(--shadow-clay-primary)" : "var(--shadow-clay)" }}
    >
      <span className={`num font-extrabold text-lg w-7 text-center flex-shrink-0 ${row.isMe ? "text-primary" : "text-on-surface-variant"}`}>
        {row.rank}
      </span>
      <CyberAvatar name={row.name} size={38} color={row.avatarColor} />
      <span className="font-bold text-on-surface flex-1 truncate">
        {row.name}
        {row.isMe && <span className="text-primary font-semibold text-xs me-2">· את/ה</span>}
      </span>
      <span className="num font-extrabold flex items-center gap-1 text-on-surface flex-shrink-0">
        <Zap size={15} className="text-primary" />
        <CountUpXp value={row.weeklyXp} />
      </span>
    </motion.div>
  );
}

function LeaderboardSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div dir="rtl" className="page-shell pt-6 pb-24">
      <button onClick={onBack} className="flex items-center gap-1 text-on-surface-variant mb-6 cursor-pointer">
        <ChevronRight size={20} /> חזרה
      </button>
      <div className="flex items-end justify-center gap-3 mb-8 max-w-[26rem] mx-auto">
        {[104, 132, 84].map((h, i) => <ClaySkeleton.Block key={i} height={h} width="32%" rounded={16} />)}
      </div>
      <div className="flex flex-col gap-2.5 max-w-[32rem] mx-auto">
        {Array.from({ length: 6 }).map((_, i) => <ClaySkeleton.Block key={i} height={62} rounded={16} />)}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const reducedMotion = !!useReducedMotion();
  const sid = studentId as Id<"students">;

  const student = useQuery(api.classroom.get, { id: sid });
  const board = useQuery(
    api.leaderboard.getWeeklyLeaderboard,
    student?.classroomId ? { classroomId: student.classroomId, studentId: sid } : "skip",
  );
  const setVisibility = useMutation(api.leaderboard.setLeaderboardVisibility);

  const countdown = useResetCountdown(board?.weekStart);
  const hidden = student?.hideFromLeaderboard === true;
  const back = () => navigate(`/student/${studentId}`);

  // Once per visit: being #1 deserves fireworks.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (board?.myRank === 1 && !celebratedRef.current) {
      celebratedRef.current = true;
      fireStreak(5);
    }
  }, [board?.myRank]);

  if (student === undefined || board === undefined) return <LeaderboardSkeleton onBack={back} />;

  // Classroom disabled → friendly empty state.
  if (board && !board.enabled) {
    return (
      <div dir="rtl" className="relative min-h-screen bg-background text-on-background">
        <FaradayCanvas variant="linesOfForce" style={{ zIndex: 0 }} />
        <div className="page-shell relative z-10 pt-6 pb-24 flex flex-col items-center text-center">
          <button onClick={back} className="self-start flex items-center gap-1 text-on-surface-variant mb-8 hover:text-primary transition-colors cursor-pointer">
            <ChevronRight size={20} /> חזרה
          </button>
          <div className="w-20 h-20 rounded-3xl bg-secondary/12 border-2 border-secondary/30 flex items-center justify-center mb-6 mt-10" style={{ boxShadow: "var(--shadow-clay)" }}>
            <Trophy size={36} className="text-secondary" />
          </div>
          <h1 className="font-bold text-2xl text-on-surface mb-2" style={{ fontFamily: "'Assistant', sans-serif" }}>ליגת השבוע כבויה</h1>
          <p className="text-on-surface-variant font-medium max-w-[26rem] leading-relaxed">
            המורה עדיין לא הפעיל/ה את טבלת המובילים בכיתה. בינתיים — כל שאלה שתפתרו נספרת! ✨
          </p>
        </div>
      </div>
    );
  }

  const rows = board?.rows ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const myRank = board?.myRank ?? null;

  return (
    <div dir="rtl" className="relative min-h-screen bg-background text-on-background overflow-x-hidden">
      <FaradayCanvas variant="linesOfForce" style={{ zIndex: 0 }} />

      <div className="page-shell relative z-10 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={back} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <ChevronRight size={20} /> חזרה
          </button>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-tertiary/15 border-2 border-tertiary/30 flex items-center justify-center flex-shrink-0" style={{ boxShadow: "var(--shadow-clay)" }}>
            <Trophy size={26} className="text-tertiary" />
          </div>
          <div>
            <h1 className="font-bold text-2xl text-on-surface leading-tight" style={{ fontFamily: "'Assistant', sans-serif" }}>ליגת השבוע</h1>
            <p className="text-xs text-on-surface-variant font-medium">מתאפס ביום ראשון · {countdown}</p>
          </div>
        </div>

        {/* My rank chip */}
        {myRank !== null && (
          <div className="mt-4 mb-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 border-2 border-primary/30 w-fit" style={{ boxShadow: "var(--shadow-clay)" }}>
            <Sparkles size={16} className="text-primary" />
            <span className="font-bold text-primary text-sm">המיקום שלך: #{myRank}</span>
          </div>
        )}
        {myRank === null && hidden && (
          <div className="mt-4 mb-6 text-sm text-on-surface-variant font-medium">את/ה מוסתר/ת מהטבלה — אף אחד לא רואה אותך כאן.</div>
        )}

        <div className="max-w-[34rem] mx-auto">
          {/* Podium */}
          {podium.length > 0 && (
            <div className="flex items-end justify-center gap-2 sm:gap-3 mb-6 pt-6">
              {/* reorder so #1 is centered: 2, 1, 3 */}
              {[podium[1], podium[0], podium[2]].map((r, i) =>
                r ? <PodiumCard key={r.studentId} row={r} place={r.rank - 1} reducedMotion={reducedMotion} /> : <div key={i} className="flex-1" />,
              )}
            </div>
          )}

          {/* Ranked rows */}
          <div className="flex flex-col gap-2.5">
            {rest.map((r) => <RankRow key={r.studentId} row={r} reducedMotion={reducedMotion} />)}
          </div>

          {/* Opt-out toggle */}
          <div className="mt-8 flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 border-outline bg-surface" style={{ boxShadow: "var(--shadow-clay)" }}>
            <div className="min-w-0">
              <div className="font-bold text-sm text-on-surface">הסתר אותי מהטבלה</div>
              <div className="text-xs text-on-surface-variant font-medium mt-0.5">לא תופיע/י ברשימה של חברי הכיתה</div>
            </div>
            <button
              onClick={() => setVisibility({ studentId: sid, hidden: !hidden })}
              role="switch"
              aria-checked={hidden}
              aria-label="הסתר אותי מהטבלה"
              className="relative w-12 h-7 rounded-full border-2 flex-shrink-0 transition-colors cursor-pointer"
              style={{
                background: hidden ? "var(--color-primary)" : "var(--color-surface-container)",
                borderColor: hidden ? "var(--color-primary-dark)" : "var(--color-outline)",
              }}
            >
              <span
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white transition-all"
                style={{ insetInlineStart: hidden ? "calc(100% - 22px)" : "2px" }}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
