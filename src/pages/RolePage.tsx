import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2, ArrowLeft, Zap, Users, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FaradayCanvas from "../components/FaradayCanvas";
import { ElectricBolt, ElectricAtom, SignalWave } from "../components/electric";
import type { ElectricIconProps, ElectricTone } from "../components/electric";

/**
 * RolePage — role-select entry point.
 *
 * "Live Wire" redesign: a full-bleed Faraday-cage canvas sits behind a
 * glassmorphic two-column shell — a hero on the inline-start and a translucent
 * role panel (student + teacher cards) on the inline-end. The cage animation is
 * the most on-brand background for a product named after Faraday: external field
 * noise is excluded from a shielded interior.
 */
export default function RolePage() {
  const navigate = useNavigate();
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const seedDatabase = useMutation(api.seed.seedDatabase);
  const students = useQuery(api.classroom.list);

  useEffect(() => {
    if (students && students.length === 0 && !seeded && !seeding) {
      setSeeding(true);
      seedDatabase().then(() => { setSeeded(true); setSeeding(false); });
    }
    if (students && students.length > 0) setSeeded(true);
  }, [students, seeded, seeding]);

  const features: { Icon: (p: ElectricIconProps) => JSX.Element; text: string; tone: ElectricTone; bg: string }[] = [
    { Icon: ElectricBolt, text: "תרגול אדפטיבי לפי רמתך", tone: "spark", bg: "bg-primary/10 border-primary/25 text-primary" },
    { Icon: ElectricAtom, text: "AI מורה אישי בזמן אמת", tone: "violet", bg: "bg-secondary/10 border-secondary/25 text-secondary" },
    { Icon: SignalWave, text: "מעקב ביצועים כיתתי חי", tone: "amber", bg: "bg-tertiary/10 border-tertiary/25 text-tertiary" },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-on-surface" dir="rtl">
      {/* ── Full-bleed cage field (z-1) ── */}
      <FaradayCanvas variant="cage" style={{ zIndex: 1 }} />

      {/* ── UI overlay (z-2) ── */}
      <div className="relative z-[2] flex min-h-screen flex-col">
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between px-6 py-5 lg:px-12"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-primary-dark bg-primary text-white"
              style={{ boxShadow: "var(--shadow-clay-primary)" }}
            >
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
              FARADAY <span className="text-primary">Logic</span>
            </span>
          </div>
          <span
            className="rounded-full border-2 border-outline bg-surface/70 px-4 py-1.5 text-sm font-semibold text-on-surface-variant backdrop-blur"
            style={{ boxShadow: "var(--shadow-clay)" }}
          >
            מתמטיקה 581 · v4.1
          </span>
        </motion.nav>

        {/* Body grid: hero (1.18fr) + role panel (0.82fr) */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1.18fr_0.82fr]">
          {/* Hero (inline-start / right in RTL) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="flex flex-col justify-center px-8 py-12 lg:px-16"
          >
            <span className="mb-6 inline-flex items-center gap-2.5 self-start rounded-full border-2 border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ boxShadow: "0 0 9px var(--color-primary)" }} />
              מערכת פעילה · {students?.length ?? "—"} תלמידים מחוברים
            </span>

            <h1 className="font-display font-bold leading-[1.03] text-on-surface" style={{ fontSize: "clamp(2.7rem, 5vw, 3.6rem)" }}>
              מרחב למידה
              <br />
              <span className="text-primary">מוגן מרעש</span>
            </h1>
            <p className="mt-5 max-w-[27rem] text-lg font-medium leading-relaxed text-on-surface-variant">
              הפרעות חיצוניות נחסמות בגבול הכלוב — בפנים נשאר רק מה שחשוב. בחר כיצד להיכנס.
            </p>

            <div className="mt-9 flex flex-col gap-4">
              {features.map(({ Icon, text, tone, bg }) => (
                <div key={text} className="flex items-center gap-3 font-semibold text-on-surface-variant">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 ${bg}`}>
                    <Icon size={22} tone={tone} glow={0.7} />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Role panel (inline-end / left in RTL) — glassmorphic */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="flex flex-col justify-center gap-4 border-outline px-6 py-12 lg:border-s-2 lg:px-10"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 78%, transparent)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
            }}
          >
            <div className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              SELECT MODE · בחר כניסה
            </div>

            {/* Seeding indicator */}
            <AnimatePresence>
              {seeding && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-primary/30 bg-primary/10 px-4 py-3"
                >
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span className="text-sm font-semibold text-primary">טוען נתוני כיתה...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Student card */}
            <div
              className="relative overflow-hidden rounded-[22px] border-2 border-outline bg-surface p-6 transition-transform duration-150 hover:-translate-y-0.5"
              style={{ boxShadow: "var(--shadow-clay)" }}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-primary" />
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/10 text-primary">
                  <Users size={18} />
                </span>
                <span className="text-xl font-extrabold text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  כניסת תלמיד
                </span>
              </div>
              <p className="mb-4 text-sm font-medium text-on-surface-variant">
                בחר את שמך והתחל לתרגל — ה‑AI ממתין לשאלות.
              </p>
              <StudentSelector students={students} />
            </div>

            {/* Teacher card */}
            <button
              type="button"
              onClick={() => navigate("/teacher")}
              className="group relative overflow-hidden rounded-[22px] border-2 border-secondary/40 bg-surface p-6 text-right transition-transform duration-150 hover:-translate-y-0.5"
              style={{ boxShadow: "0 4px 0 0 color-mix(in srgb, var(--color-secondary) 32%, var(--color-outline)), 0 2px 10px rgba(20,40,30,.05)" }}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-secondary" />
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-secondary/30 bg-secondary/10 text-secondary">
                  <Shield size={18} />
                </span>
                <span className="text-xl font-extrabold text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  מרכז פיקוד מורה
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-on-surface-variant">מפת חום · ניתוח AI · שיעורי בית</p>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-white transition-transform group-hover:scale-105"
                  style={{ boxShadow: "var(--shadow-clay-secondary)" }}
                >
                  כניסה
                  <ArrowLeft size={15} strokeWidth={2.4} />
                </span>
              </div>
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StudentSelector({ students }: { students: any[] | undefined }) {
  const navigate = useNavigate();

  if (!students) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-xl border-2 border-outline bg-surface-container" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex max-h-[232px] flex-col gap-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
      {students.map((s, i) => {
        const hue = [...s.name].reduce((acc: number, c: string) => c.charCodeAt(0) * 31 + ((acc << 5) - acc), 0);
        const h = Math.abs(hue) % 360;
        return (
          <motion.button
            key={s._id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => navigate(`/student/${s._id}`)}
            className="group flex w-full items-center gap-3 rounded-xl border-2 border-outline bg-surface px-3 py-2.5 text-right transition-all duration-200 hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold"
              style={{ background: `hsl(${h}, 50%, 88%)`, color: `hsl(${h}, 60%, 30%)`, borderColor: `hsl(${h}, 50%, 72%)` }}
            >
              {s.name.slice(0, 1)}
            </span>
            <span className="flex-1 font-semibold text-on-surface transition-colors group-hover:text-primary">{s.name}</span>
            <ArrowLeft size={15} className="-translate-x-2 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </motion.button>
        );
      })}
    </div>
  );
}
