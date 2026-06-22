import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2, ArrowLeft, Zap, Users, Shield, Target, Bot, LineChart } from "lucide-react";
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
    <div className="min-h-screen w-full flex flex-col overflow-hidden relative bg-background text-on-background" dir="rtl">

      {/* ── Top bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-6 py-4 bg-surface border-b-2 border-outline relative z-10"
        style={{ boxShadow: 'var(--shadow-clay)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-2xl bg-primary border-2 border-primary-dark text-white"
            style={{ boxShadow: 'var(--shadow-clay-primary)' }}>
            <Zap size={20} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-xl text-on-surface tracking-tight" style={{ fontFamily: "'Assistant', sans-serif" }}>
            FARADAY <span className="text-primary">Logic</span>
          </span>
        </div>

        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container border-2 border-outline text-sm font-semibold text-on-surface-variant"
          style={{ boxShadow: 'var(--shadow-clay)' }}>
          מתמטיקה 581 · v4.1
        </div>
      </motion.div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10">

        {/* RIGHT (RTL) — Hero text */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="lg:w-[45%] flex flex-col justify-center px-8 lg:px-16 py-16 relative overflow-hidden border-l-2 border-outline bg-gradient-to-br from-surface to-primary/5"
        >
          {/* ── Ambient electric field (signature backdrop) ── */}
          <div className="absolute inset-0 circuit-grid opacity-[0.35] pointer-events-none" aria-hidden />
          <div className="absolute -top-24 left-[-80px] w-[440px] h-[440px] pointer-events-none" aria-hidden>
            <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 70%)' }} />
            <span className="field-ring absolute left-1/2 top-1/2 w-60 h-60 rounded-full border-2 border-primary/30" />
            <span className="field-ring field-ring--2 absolute left-1/2 top-1/2 w-60 h-60 rounded-full border-2 border-primary/25" />
          </div>
          <div className="absolute bottom-20 left-24 w-2.5 h-2.5 rounded-full bg-primary charge-drift pointer-events-none" style={{ boxShadow: '0 0 10px var(--color-inverse-primary)' }} aria-hidden />
          <div className="absolute top-32 left-1/3 w-2 h-2 rounded-full bg-secondary charge-drift pointer-events-none" style={{ animationDelay: '1.6s', boxShadow: '0 0 8px var(--color-secondary)' }} aria-hidden />

          {/* Live status pill */}
          <div className="relative z-10 inline-flex items-center gap-2.5 mb-10 self-start px-4 py-2 rounded-full bg-primary/10 border-2 border-primary/30"
            style={{ boxShadow: '0 2px 0 0 rgba(23,201,100,0.2)' }}>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-sm text-primary">
              מערכת פעילה · {students?.length ?? '—'} תלמידים
            </span>
          </div>

          {/* Hero text */}
          <div className="relative z-10">
            <h1 className="font-display font-black text-on-surface leading-tight" style={{ fontSize: 'clamp(2.6rem, 5vw, 4.2rem)' }}>
              תכיר את התלמידים שלך
              <br />
              <span className="text-primary">מחדש</span>
            </h1>
            <p className="mt-4 text-on-surface-variant text-lg font-medium leading-relaxed">
              AI שמלמד בדיוק ברמה שלך
            </p>
          </div>

          {/* Feature list */}
          <div className="relative z-10 mt-10 flex flex-col gap-4">
            {[
              { Icon: Target, text: 'תרגול אדפטיבי לפי רמתך', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
              { Icon: Bot, text: 'AI מורה אישי בזמן אמת', color: 'text-secondary', bg: 'bg-secondary/10 border-secondary/20' },
              { Icon: LineChart, text: 'מעקב ביצועים כיתתי חי', color: 'text-tertiary', bg: 'bg-tertiary/10 border-tertiary/20' },
            ].map(({ Icon, text, color, bg }) => (
              <div key={text} className="flex items-center gap-3 font-semibold text-on-surface-variant">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 flex-shrink-0 ${bg}`}>
                  <Icon className={`${color} w-5 h-5`} />
                </div>
                {text}
              </div>
            ))}
          </div>
        </motion.div>

        {/* LEFT (RTL) — Role selection */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="lg:flex-1 flex flex-col justify-center px-8 lg:px-16 py-16 gap-6"
        >
          <div className="font-semibold text-on-surface-variant mb-1">בחר מצב כניסה</div>

          {/* Loading indicator */}
          <AnimatePresence>
            {seeding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl overflow-hidden bg-primary/10 border-2 border-primary/30"
              >
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="font-semibold text-sm text-primary">טוען נתוני כיתה...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Student card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-3xl bg-surface border-2 border-outline p-8"
            style={{ boxShadow: 'var(--shadow-clay)' }}
          >
            {/* Green top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary rounded-t-3xl" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-semibold text-xs text-primary mb-1.5 uppercase tracking-widest">תלמידים</div>
                <h2 className="font-bold text-2xl text-on-surface flex items-center gap-2" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                    <Users className="text-primary" size={20} />
                  </div>
                  כניסת תלמיד
                </h2>
              </div>
            </div>

            <p className="text-on-surface-variant mb-5 font-medium text-sm">
              בחר את שמך והתחל לתרגל — ה-AI ממתין לשאלות שלך.
            </p>

            <StudentSelector students={students} />
          </motion.div>

          {/* Teacher card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative overflow-hidden rounded-3xl bg-surface border-2 border-secondary/40 p-8 hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
            style={{ boxShadow: '0 4px 0 0 rgba(123,97,255,0.3), 0 1px 4px rgba(0,0,0,0.06)' }}
            onClick={() => navigate("/teacher")}
          >
            {/* Blue top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-secondary rounded-t-3xl" />

            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-secondary mb-1.5 uppercase tracking-widest">מורים</div>
                <h2 className="font-bold text-2xl text-on-surface flex items-center gap-2" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 border-2 border-secondary/30 flex items-center justify-center">
                    <Shield className="text-secondary" size={20} />
                  </div>
                  מרכז פיקוד מורה
                </h2>
                <p className="font-medium text-on-surface-variant mt-2 text-sm">
                  מפת חום · ניתוח AI · ניהול שיעורי בית
                </p>
              </div>
              <button
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-on-secondary rounded-2xl font-semibold text-sm border-2 border-secondary group-hover:scale-105 transition-transform"
                style={{ boxShadow: 'var(--shadow-clay-secondary)' }}
                onClick={() => navigate("/teacher")}
              >
                כניסה
                <ArrowLeft size={16} />
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
      {[1, 2, 3].map(i => (
        <div key={i} className="h-14 w-full rounded-2xl bg-surface-container animate-pulse border-2 border-outline" />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="font-semibold text-xs text-on-surface-variant mb-1 uppercase tracking-widest">בחר תלמיד</div>
      <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {students.map((s, i) => {
          const hue = [...s.name].reduce((h, c) => c.charCodeAt(0) * 31 + ((h << 5) - h), 0);
          const h = Math.abs(hue) % 360;
          return (
            <motion.button
              key={s._id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-right group transition-all duration-200 bg-surface border-2 border-outline hover:border-primary hover:bg-primary/5 active:scale-95 cursor-pointer"
              style={{ boxShadow: 'var(--shadow-clay)' }}
              onClick={() => navigate(`/student/${s._id}`)}
            >
              {/* Colored initial avatar */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold border-2"
                style={{
                  background: `hsl(${h}, 50%, 88%)`,
                  color: `hsl(${h}, 60%, 30%)`,
                  borderColor: `hsl(${h}, 50%, 72%)`,
                }}
              >
                {s.name.slice(0, 1)}
              </div>
              <span className="flex-1 font-semibold text-on-surface group-hover:text-primary transition-colors">
                {s.name}
              </span>
              <ArrowLeft size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}


