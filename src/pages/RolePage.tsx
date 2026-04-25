import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2, BarChart2, BookOpen, ChevronLeft, Zap } from "lucide-react";
import { px } from "framer-motion";

export default function RolePage() {
  const navigate = useNavigate();
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const seedDatabase = useMutation(api.seed.seedDatabase);
  const students = useQuery(api.classroom.list);
  const classroom = useQuery(api.classroom.getFirstClassroom);

  useEffect(() => {
    if (students && students.length === 0 && !seeded && !seeding) {
      setSeeding(true);
      seedDatabase().then(() => { setSeeded(true); setSeeding(false); });
    }
    if (students && students.length > 0) setSeeded(true);
  }, [students, seeded, seeding]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--s8)", position: "relative", overflow: "hidden" }}>

      {/* Cosmic background glow */}
      <div style={{ position: "fixed", top: -100, right: -100, width: 800, height: 800, background: "radial-gradient(circle, rgba(129, 140, 248, 0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -100, left: -100, width: 600, height: 600, background: "radial-gradient(circle, rgba(45, 212, 191, 0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Content — Level 0 */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1000 }}>

        {/* Header */}
        <div className="fade-in-up text-center" style={{ marginBottom: 64 }}>
          <div className="section-label" style={{ justifyContent: "center" }}>
            כיתה י״א · שאלון 581 · 5 יחידות לימוד
          </div>
          <h1 className="t-display" style={{ color: "var(--text)", marginBottom: "var(--s4)" }}>
            מתמטיקה{" "}
            <span style={{ color: "var(--primary)", textShadow: "0 0 30px rgba(129,140,248,0.5)" }}>581</span>
          </h1>
          <p className="t-body" style={{ maxWidth: 640, margin: "0 auto", fontSize: "1.15rem", lineHeight: 1.8 }}>
            פלטפורמת למידה אדפטיבית חכמה המבוססת על אלגוריתם הלמידה FARADAY Logic
          </p>
          {seeding && (
            <div className="flex items-center justify-center gap-2 t-label" style={{ marginTop: "var(--s4)", color: "var(--text-faint)" }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              מאתחל את מערכת הלוגיקה...
            </div>
          )}
        </div>

        {/* Cards — Level 2 (surface-high) with no 1px borders per spec */}
        <div className="fade-in-up" style={{ animationDelay: "0.1s", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 48 }}>

          {/* Student Panel */}
          <div className="role-card student-card stripe-left stripe-primary">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s4)", marginBottom: "var(--s6)" }}>
              <div className="role-card-icon" style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-dim))" }}>
                <BookOpen size={28} color="#ffffff" />
              </div>
              <div>
                <div className="t-label" style={{ color: "var(--text-faint)", marginBottom: 2 }}>חיבור לרשת הלמידה</div>
                <h2 className="t-headline" style={{ marginBottom: 0, fontSize: "1.35rem" }}>אני תלמיד/ה</h2>
              </div>
            </div>

            <p className="t-body" style={{ marginBottom: "var(--s6)", flex: 1 }}>
              תרגל שאלות בהתאמה אישית, קבל רמזים חכמים מבוססי-לוגיקה כשאתה תקוע, ועקוב אחרי ההתקדמות המבנית בכל נושא.
            </p>

            <div className="flex gap-2 flex-wrap" style={{ marginBottom: "var(--s6)" }}>
              <span className="badge badge-success">רמה מותאמת</span>
              <span className="badge badge-primary">רמזים חכמים</span>
              <span className="badge badge-neutral">מסלול למידה</span>
            </div>

            <StudentSelector classroom={classroom} students={students} />
          </div>

          {/* Teacher Panel */}
          <div className="role-card teacher-card stripe-left stripe-yellow">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s4)", marginBottom: "var(--s6)" }}>
              <div className="role-card-icon" style={{ background: "linear-gradient(135deg, var(--warning), #f59e0b)" }}>
                <BarChart2 size={28} color="#ffffff" />
              </div>
              <div>
                <div className="t-label" style={{ color: "var(--text-faint)", marginBottom: 2 }}>ממשק אנליטיקה</div>
                <h2 className="t-headline" style={{ marginBottom: 0, fontSize: "1.35rem" }}>אני מורה</h2>
              </div>
            </div>

            <p className="t-body" style={{ marginBottom: "var(--s6)", flex: 1 }}>
              עקוב אחרי הכיתה בזמן אמת דרך מפת החום. קבל התראות כשתלמידים תקועים, וצפה בנתוני ביצועים מפורטים לפי מודול.
            </p>

            <div className="flex gap-2 flex-wrap" style={{ marginBottom: "var(--s6)", marginTop: 10 }}>
              <span className="badge badge-amber">מפת חום חיה</span>
              <span className="badge badge-danger">התראות מיידיות</span>
              <span className="badge badge-neutral">תובנות</span>
            </div>

            <button
              id="teacher-enter-btn"
              className="btn btn-ghost btn-full"
              onClick={() => navigate("/teacher")}
            >
              הפעלת לוח מחוונים
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center t-label" style={{ marginTop: 48, color: "var(--text-faint)" }}>
          משרד החינוך | שאלון 581 | כיתה י״א
        </p>
      </div>
    </div>
  );
}

function StudentSelector({ classroom, students }: { classroom: any; students: any[] | undefined }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (!students) return (
    <button className="btn btn-primary btn-full" disabled>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
      טוען...
    </button>
  );

  if (!expanded) return (
    <button id="student-select-btn" className="btn btn-primary btn-full" onClick={() => setExpanded(true)}>
      <Zap size={16} />
      חיבור לחשבון
      <ChevronLeft size={16} />
    </button>
  );

  return (
    <div className="fade-in">
      <p className="t-label" style={{ marginBottom: "var(--s3)", color: "var(--text-muted)" }}>
        {classroom?.name ?? "הכיתה"} — בחר/י זהות לוגית:
      </p>
      {/* "Recessed" area for inputs / lists per spec */}
      <div className="card-recessed no-scrollbar" style={{ padding: "var(--s2)", maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
        {students.map((s) => (
          <button
            key={s._id}
            id={`student-${s._id}`}
            className="btn btn-text"
            style={{ justifyContent: "flex-start", gap: "var(--s3)", padding: "var(--s2) var(--s3)", color: "var(--text)" }}
            onClick={() => navigate(`/student/${s._id}`)}
          >
            <span className="avatar" style={{ width: 32, height: 32, fontSize: "0.85rem", background: s.avatarColor }}>
              {s.name.slice(0, 1)}
            </span>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
