import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Shield } from "../components/electric";
import { log } from "../lib/logger";
import { motion } from "framer-motion";
import FaradayCanvas from "../components/FaradayCanvas";
import { ThemeToggle } from "../components/ThemeContext";
import { ElectricBolt, ElectricAtom, SignalWave } from "../components/electric";
import type { ElectricIconProps, ElectricTone } from "../components/electric";
import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion, useMagneticHover, useStaggerReveal } from "../lib/gsapUtils";

/* Hero headline words slide up into place one after another (manual split). */
function SplitWords({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      el.querySelectorAll(".sw-word"),
      { autoAlpha: 0, y: "0.9em" },
      { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.08, delay },
    );
    return () => { tween.kill(); };
  }, [text, delay]);
  return (
    <span ref={ref} className={className}>
      {text.split(" ").map((word, i, arr) => (
        <span key={i}>
          <span className="sw-word inline-block will-change-transform">{word}</span>
          {i < arr.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/* Feature row: icon springs in from the inline side, text fades in 100ms later. */
function FeatureItem({ Icon, text, tone, bg, index }: {
  Icon: (p: ElectricIconProps) => JSX.Element; text: string; tone: ElectricTone; bg: string; index: number;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const icon = iconRef.current, label = textRef.current;
    if (!icon || !label || prefersReducedMotion()) return;
    const delay = 0.45 + index * 0.14;
    const tl = gsap.timeline({ delay });
    tl.fromTo(icon, { autoAlpha: 0, x: 42, scale: 0.6 }, { autoAlpha: 1, x: 0, scale: 1, duration: 0.7, ease: "back.out(2)" })
      .fromTo(label, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0.1);
    return () => { tl.kill(); };
  }, [index]);
  return (
    <div className="flex items-center gap-3 font-semibold text-on-surface-variant">
      <div ref={iconRef} className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 ${bg}`}>
        <Icon size={22} tone={tone} glow={0.7} />
      </div>
      <span ref={textRef}>{text}</span>
    </div>
  );
}

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
  const students = useQuery(api.classroom.list);

  // 3D tilt on the two role cards
  const studentCardRef = useRef<HTMLDivElement>(null);
  const teacherCardRef = useRef<HTMLButtonElement>(null);
  useMagneticHover(studentCardRef, { strength: 0.03, tilt: 4 });
  useMagneticHover(teacherCardRef, { strength: 0.05, tilt: 5 });

  const features: { Icon: (p: ElectricIconProps) => JSX.Element; text: string; tone: ElectricTone; bg: string }[] = [
    { Icon: ElectricBolt, text: "תרגול שמתכוונן לרמה שלך — שאלה־שאלה", tone: "spark", bg: "bg-primary/10 border-primary/25 text-primary" },
    { Icon: ElectricAtom, text: "מורה AI אישי, זמין בכל רגע", tone: "violet", bg: "bg-secondary/10 border-secondary/25 text-secondary" },
    { Icon: SignalWave, text: "מעקב חי אחרי כל הכיתה", tone: "amber", bg: "bg-tertiary/10 border-tertiary/25 text-tertiary" },
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
              <ElectricBolt size={22} tone="ghost" glow={0.6} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
              FARADAY <span className="text-primary">Logic</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="rounded-full border-2 border-outline bg-surface/70 px-4 py-1.5 text-sm font-semibold text-on-surface-variant backdrop-blur"
              style={{ boxShadow: "var(--shadow-clay)" }}
            >
              מתמטיקה 581 · v4.1
            </span>
            <ThemeToggle />
          </div>
        </motion.nav>

        {/* Body grid: hero (1.18fr) + role panel (0.82fr) */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1.18fr_0.82fr]">
          {/* Hero (inline-start / right in RTL) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="flex flex-col justify-center px-6 pt-4 pb-2 lg:px-16 lg:py-12"
          >
            <span className="mb-4 lg:mb-6 inline-flex items-center gap-2.5 self-start rounded-full border-2 border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ boxShadow: "0 0 9px var(--color-primary)" }} />
              מערכת פעילה · {students?.length ?? "—"} תלמידים מחוברים
            </span>

            <h1 className="font-display font-bold leading-[1.03] text-on-surface" style={{ fontSize: "clamp(2.4rem, 11vw, 3.6rem)" }}>
              <SplitWords text="פלטפורמת הלמידה" delay={0.25} />
              <br />
              <SplitWords text="שמותאמת עבורך" className="text-primary" delay={0.45} />
            </h1>
            <p className="mt-4 lg:mt-5 max-w-[27rem] text-base lg:text-lg font-medium leading-relaxed text-on-surface-variant">
              <span className="lg:hidden">בחר כיצד להיכנס — ה‑AI ממתין לשאלות.</span>
              <span className="hidden lg:inline">למידת מתמטיקה מעולם לא הייתה נגישה ופשוטה יותר.</span>
            </p> (feat: analytics views, geometry seeding, and config updates)
            </p>

            {/* Feature list is desktop-only — on mobile the role cards come first (matches the phone design) */}
            <div className="mt-9 hidden lg:flex flex-col gap-4">
              {features.map((f, i) => (
                <FeatureItem key={f.text} {...f} index={i} />
              ))}
            </div>
          </motion.div>

          {/* Role panel (inline-end / left in RTL) — glassmorphic */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="flex flex-col justify-center gap-3.5 border-outline px-6 pt-2 pb-8 lg:gap-4 lg:border-s-2 lg:px-10 lg:py-12"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 78%, transparent)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
            }}
          >
            <div className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              SELECT MODE · בחר כניסה
            </div>

            {/* Student card */}
            <div
              ref={studentCardRef}
              className="relative overflow-hidden rounded-[22px] border-2 border-outline bg-surface p-6"
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
              ref={teacherCardRef}
              type="button"
              onClick={() => { log.auth("teacher login clicked"); navigate("/teacher"); }}
              className="group relative overflow-hidden rounded-[22px] border-2 border-secondary/40 bg-surface p-6 text-right"
              style={{ boxShadow: "0 4px 0 0 color-mix(in srgb, var(--color-secondary) 32%, var(--color-outline)), 0 2px 10px rgba(20,40,30,.05)" }}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-secondary" />
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-secondary/30 bg-secondary/10 text-secondary">
                  <Shield size={18} />
                </span>
                <span className="text-xl font-extrabold text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  כניסת מורה
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

function StudentSelector({ students }: { students: StudentEntry[] | undefined }) {
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
    <StudentButtonList students={students} onPick={(s) => { log.auth("student login", { studentId: s._id, name: s.name }); navigate(`/student/${s._id}`); }} />
  );
}

interface StudentEntry { _id: string; name: string }

function StudentButtonList({ students, onPick }: { students: StudentEntry[]; onPick: (s: StudentEntry) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(listRef, { stagger: 0.04, y: 14, duration: 0.4 });
  return (
    <div ref={listRef} className="flex max-h-[232px] flex-col gap-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
      {students.map((s) => (
        <StudentButton key={s._id} student={s} onPick={() => onPick(s)} />
      ))}
    </div>
  );
}

function StudentButton({ student, onPick }: { student: StudentEntry; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useMagneticHover(ref, { strength: 0.14 });
  const hue = [...student.name].reduce((acc: number, c: string) => c.charCodeAt(0) * 31 + ((acc << 5) - acc), 0);
  const h = Math.abs(hue) % 360;
  return (
    <button
      ref={ref}
      onClick={onPick}
      className="group flex w-full items-center gap-3 rounded-xl border-2 border-outline bg-surface px-3 py-2.5 text-right transition-colors duration-200 hover:border-primary hover:bg-primary/5"
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold"
        style={{ background: `hsl(${h}, 50%, 88%)`, color: `hsl(${h}, 60%, 30%)`, borderColor: `hsl(${h}, 50%, 72%)` }}
      >
        {student.name.slice(0, 1)}
      </span>
      <span className="flex-1 font-semibold text-on-surface transition-colors group-hover:text-primary">{student.name}</span>
      <ArrowLeft size={15} className="-translate-x-2 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
    </button>
  );
}
