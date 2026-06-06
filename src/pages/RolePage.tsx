import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2, ArrowLeft, Zap } from "lucide-react";
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
    <div className="min-h-screen w-full flex flex-col overflow-hidden relative">

      {/* ── Green corner accent ── */}
      <div className="absolute top-0 right-0 w-[380px] h-[380px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top right, rgba(74,222,128,0.10) 0%, transparent 65%)',
        }} />
      <div className="absolute bottom-0 left-0 w-[280px] h-[280px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at bottom left, rgba(251,191,36,0.05) 0%, transparent 65%)',
        }} />

      {/* ── Topbar ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-8 py-5 relative z-10"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--g-400)', boxShadow: '0 0 20px rgba(74,222,128,0.35)' }}>
            <Zap size={18} color="#020A04" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            FARADAY Logic
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          מתמטיקה 581 · v4.1
        </div>
      </motion.div>

      {/* ── Main content — split layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row">

        {/* LEFT — Big headline */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="lg:w-[45%] flex flex-col justify-center px-8 lg:px-16 py-16 relative"
          style={{ borderLeft: '1px solid var(--border-subtle)' }}
        >
          {/* Live status pill */}
          <div className="inline-flex items-center gap-2.5 mb-10 self-start px-4 py-2 rounded-full"
            style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid var(--border-primary)' }}>
            <div className="pulse-dot" style={{ width: 6, height: 6 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--g-300)', letterSpacing: '0.1em' }}>
              מערכת פעילה · {students?.length ?? '—'} תלמידים
            </span>
          </div>

          {/* Hero text */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--g-400)', letterSpacing: '0.18em', marginBottom: '12px' }}>
              // IDENTITY_SELECT
            </div>
            <h1 className="heading-display" style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)', lineHeight: 1 }}>
              <span className="text-gradient-hero">פלטפורמת</span>
              <br />
              <span style={{ color: 'var(--g-400)' }}>הלמידה</span>
              <br />
              <span style={{ color: 'var(--text-primary)' }}>המתקדמת</span>
            </h1>
          </div>

          {/* Descriptors */}
          <div className="mt-10 flex flex-col gap-3">
            {[
              { icon: '◆', text: 'תרגול אדפטיבי לפי רמתך' },
              { icon: '◆', text: 'AI מורה אישי בזמן אמת' },
              { icon: '◆', text: 'מעקב ביצועים כיתתי חי' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--g-500)', fontSize: '0.5rem', flexShrink: 0 }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>

          {/* Decorative data line */}
          <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 2 }}>
              SYS_STATUS  <span style={{ color: 'var(--g-400)' }}>ONLINE</span>{' · '}
              TOPICS  <span style={{ color: 'var(--g-300)' }}>LOADED</span>{' · '}
              AI_ENGINE  <span style={{ color: 'var(--g-400)' }}>READY</span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT — Role selection */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="lg:flex-1 flex flex-col justify-center px-8 lg:px-16 py-16 gap-6"
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 4 }}>
            // SELECT_MODE
          </div>

          {/* Loading indicator */}
          <AnimatePresence>
            {seeding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg overflow-hidden"
                style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid var(--border-primary)' }}
              >
                <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--g-400)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--g-300)' }}>
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
            className="glass relative overflow-hidden"
            style={{ padding: '28px 32px' }}
          >
            <div className="green-line-top" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g-500)', letterSpacing: '0.12em', marginBottom: 4 }}>
                  MODE_01
                </div>
                <h2 className="heading-display" style={{ fontSize: '1.5rem' }}>כניסת תלמיד</h2>
              </div>
              <span className="badge badge-primary">Student</span>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 20 }}>
              בחר את שמך והתחל לתרגל — ה-AI ממתין לשאלות שלך.
            </p>

            <StudentSelector students={students} />
          </motion.div>

          {/* Teacher card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass card-hover relative overflow-hidden"
            style={{ padding: '24px 32px' }}
            onClick={() => navigate("/teacher")}
          >
            {/* Amber accent line for teacher */}
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, var(--g-600), var(--amber))' }} />

            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--amber)', letterSpacing: '0.12em', marginBottom: 4 }}>
                  MODE_02
                </div>
                <h2 className="heading-display" style={{ fontSize: '1.5rem' }}>מרכז פיקוד מורה</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4 }}>
                  מפת חום · ניתוח AI · ניהול שיעורי בית
                </p>
              </div>
              <button className="btn btn-accent flex-shrink-0" onClick={() => navigate("/teacher")}>
                כניסה
                <ArrowLeft size={15} />
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
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 w-full" />)}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>
        // AVAILABLE_AGENTS
      </div>
      <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {students.map((s, i) => {
          const hue = [...s.name].reduce((h, c) => c.charCodeAt(0) * 31 + ((h << 5) - h), 0);
          const h = Math.abs(hue) % 360;
          return (
            <motion.button
              key={s._id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-right group transition-all duration-200"
              style={{
                background: 'rgba(74,222,128,0.03)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.background = 'rgba(74,222,128,0.07)';
                el.style.borderColor = 'var(--border-primary)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                el.style.background = 'rgba(74,222,128,0.03)';
                el.style.borderColor = 'var(--border-subtle)';
              }}
              onClick={() => navigate(`/student/${s._id}`)}
            >
              {/* Colourful initial avatar */}
              <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{
                  background: `hsl(${h}, 40%, 18%)`,
                  color: `hsl(${h}, 70%, 65%)`,
                  border: `1px solid hsl(${h}, 45%, 28%)`,
                  fontFamily: 'var(--font-display)',
                }}>
                {s.name.slice(0, 1)}
              </div>
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                {s.name}
              </span>
              <ArrowLeft size={13} style={{ color: 'var(--g-400)', opacity: 0, transition: 'opacity 0.15s' }}
                className="group-hover:opacity-100" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
