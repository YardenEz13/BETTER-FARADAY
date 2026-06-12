import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2, ArrowLeft, Zap, Users, Shield, Cpu, Target, Bot, LineChart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  return (
    <div className="min-h-screen w-full flex flex-col overflow-hidden relative bg-background text-on-background font-body-md" dir="rtl">

      {/* ── Colorful Atmospheric Elements ── */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-tertiary/10 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Topbar ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-8 py-5 relative z-10 border-b border-outline-variant/30 bg-surface/50 backdrop-blur-md"
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-on-primary shadow-[0_0_20px_var(--color-primary)]">
            <Zap size={20} strokeWidth={2.5} />
          </div>
          <span className="font-label-lg text-primary tracking-tighter">
            FARADAY Logic
          </span>
        </div>

        <div className="font-label-md text-on-surface-variant tracking-widest bg-surface-container-high px-4 py-1.5 rounded-full border border-outline-variant/50">
          מתמטיקה 581 · v4.1
        </div>
      </motion.div>

      {/* ── Main content — split layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10">

        {/* LEFT — Big headline */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="lg:w-[45%] flex flex-col justify-center px-8 lg:px-16 py-16 relative border-l border-outline-variant/30"
        >
          {/* Live status pill */}
          <div className="inline-flex items-center gap-2.5 mb-10 self-start px-4 py-2 rounded-full bg-primary/10 border border-primary/30 shadow-[0_0_15px_var(--color-primary)]">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
            <span className="font-label-md text-primary tracking-wider">
              מערכת פעילה · {students?.length ?? '—'} תלמידים
            </span>
          </div>

          {/* Hero text */}
          <div>
            <div className="font-label-md text-secondary tracking-widest mb-3">
              // IDENTITY_SELECT
            </div>
            <h1 className="font-headline-xl text-on-surface leading-tight" style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)', fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 900 }}>
              <span className="text-primary drop-shadow-[0_0_15px_var(--color-primary)]">פלטפורמת</span>
              <br />
              <span className="text-gradient-warm">הלמידה</span>
              <br />
              <span className="text-on-surface">המתקדמת</span>
            </h1>
          </div>

          {/* Descriptors */}
          <div className="mt-10 flex flex-col gap-4">
            {[
              { Icon: Target, text: 'תרגול אדפטיבי לפי רמתך', color: 'text-primary' },
              { Icon: Bot, text: 'AI מורה אישי בזמן אמת', color: 'text-tertiary' },
              { Icon: LineChart, text: 'מעקב ביצועים כיתתי חי', color: 'text-secondary' },
            ].map(({ Icon, text, color }) => (
              <div key={text} className="flex items-center gap-3 font-label-lg text-on-surface-variant">
                <Icon className={`${color} drop-shadow-[0_0_8px_var(--color-${color.split('-')[1]})] w-6 h-6`} />
                {text}
              </div>
            ))}
          </div>

          {/* Decorative data line */}
          <div className="mt-12 pt-8 border-t border-outline-variant/30">
            <div className="font-label-md text-on-surface-variant leading-loose flex flex-wrap gap-4">
              <span>SYS_STATUS <span className="text-primary font-bold">ONLINE</span></span>
              <span>TOPICS <span className="text-tertiary font-bold">LOADED</span></span>
              <span>AI_ENGINE <span className="text-secondary font-bold">READY</span></span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT — Role selection */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="lg:flex-1 flex flex-col justify-center px-8 lg:px-16 py-16 gap-6"
        >
          <div className="font-label-md text-on-surface-variant tracking-widest mb-1">
            // SELECT_MODE
          </div>

          {/* Loading indicator */}
          <AnimatePresence>
            {seeding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg overflow-hidden bg-primary/10 border border-primary/30"
              >
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="font-label-md text-primary">
                  טוען נתוני כיתה...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Student card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl bg-surface-container/60 backdrop-blur-xl border border-primary/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_var(--color-primary)] transition-shadow duration-500"
            style={{ padding: '32px' }}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary opacity-90 shadow-[0_0_15px_var(--color-primary)]" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="font-label-md text-primary tracking-widest mb-2">
                  MODE_01
                </div>
                <h2 className="font-headline-lg text-on-surface flex items-center gap-2" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>
                  <Users className="text-primary" size={28} />
                  כניסת תלמיד
                </h2>
              </div>
              <span className="px-3 py-1 bg-primary text-on-primary rounded-full font-label-lg shadow-[0_0_10px_var(--color-primary)]">Student</span>
            </div>

            <p className="font-body-lg text-on-surface-variant mb-6">
              בחר את שמך והתחל לתרגל — ה-AI ממתין לשאלות שלך.
            </p>

            <StudentSelector students={students} />
          </motion.div>

          {/* Teacher card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative overflow-hidden rounded-2xl bg-surface-container/60 backdrop-blur-xl border border-tertiary/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_var(--color-tertiary)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
            style={{ padding: '32px' }}
            onClick={() => navigate("/teacher")}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-tertiary opacity-90 shadow-[0_0_15px_var(--color-tertiary)]" />

            <div className="flex items-center justify-between">
              <div>
                <div className="font-label-md text-tertiary tracking-widest mb-2">
                  MODE_02
                </div>
                <h2 className="font-headline-lg text-on-surface flex items-center gap-2" style={{ fontFamily: "'Yarden', 'Assistant', sans-serif", fontWeight: 700 }}>
                  <Shield className="text-tertiary" size={28} />
                  מרכז פיקוד מורה
                </h2>
                <p className="font-body-md text-on-surface-variant mt-2">
                  מפת חום · ניתוח AI · ניהול שיעורי בית
                </p>
              </div>
              <button className="flex items-center gap-2 px-6 py-3 bg-tertiary text-on-tertiary rounded-xl font-label-lg shadow-[0_0_15px_var(--color-tertiary)] group-hover:scale-105 transition-transform" onClick={() => navigate("/teacher")}>
                כניסה
                <ArrowLeft size={18} />
              </button>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

function StudentSelector({ students }: { students: any[] | undefined }) {
  const navigate = useNavigate();

  if (!students) return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map(i => <div key={i} className="h-12 w-full rounded-xl bg-surface-container-highest animate-pulse" />)}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="font-label-md text-on-surface-variant tracking-widest mb-1">
        // AVAILABLE_AGENTS
      </div>
      <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
        {students.map((s, i) => {
          const hue = [...s.name].reduce((h, c) => c.charCodeAt(0) * 31 + ((h << 5) - h), 0);
          const h = Math.abs(hue) % 360;
          return (
            <motion.button
              key={s._id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="w-full flex items-center gap-4 px-5 py-3 rounded-xl text-right group transition-all duration-200 bg-surface border border-outline-variant/40 hover:border-primary/60 hover:bg-primary/10 hover:shadow-[0_0_15px_var(--color-primary)]"
              onClick={() => navigate(`/student/${s._id}`)}
            >
              {/* Colourful initial avatar */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-headline-md shadow-sm"
                style={{
                  background: `hsl(${h}, 50%, 15%)`,
                  color: `hsl(${h}, 80%, 70%)`,
                  border: `1px solid hsl(${h}, 60%, 30%)`,
                }}>
                {s.name.slice(0, 1)}
              </div>
              <span className="flex-1 font-label-lg text-on-surface group-hover:text-primary transition-colors">
                {s.name}
              </span>
              <ArrowLeft size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

