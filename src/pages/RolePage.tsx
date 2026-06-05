import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2, Terminal, ShieldAlert } from "lucide-react";

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
    <div className="min-h-screen w-full flex items-center justify-center p-8 relative overflow-hidden">
      
      {/* HUD Accents */}
      <div className="absolute top-8 right-8 t-mono-label opacity-50">SYS.INIT // FARADAY LOGIC</div>
      <div className="absolute bottom-8 left-8 t-mono-label opacity-50">v3.0.0_BETA</div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col gap-16">
        {/* Massive Glitching Title */}
        <div className="text-center">
          <div className="t-mono-label mb-4 opacity-70 tracking-[5px]">-- IDENTITY SELECTION --</div>
          <h1 className="hud-title" data-text="FARADAY LOGIC">FARADAY LOGIC</h1>
          <p className="font-mono text-[var(--laser-cyan)] mt-4 max-w-lg mx-auto opacity-80 text-sm">
            ACCESSING NEURAL PATHWAYS. PLEASE SELECT YOUR DESIGNATION TO PROCEED WITH SYSTEM INTEGRATION.
          </p>
        </div>

        {seeding && (
          <div className="shard p-4 text-center font-mono text-[var(--neon-emerald)] flex items-center justify-center gap-3">
            <Loader2 className="animate-spin" size={18} />
            INITIALIZING CORE DATABANKS...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
          
          {/* Asymmetric line connecting them */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-[var(--neon-emerald)] opacity-20 pointer-events-none hidden md:block"></div>

          {/* Student Terminal */}
          <div className="shard p-8 flex flex-col group hover:border-[var(--neon-emerald)] transition-colors duration-500">
            <div className="flex items-center gap-4 mb-6 text-[var(--neon-emerald)]">
              <Terminal size={32} />
              <h2 className="text-3xl font-bold font-mono tracking-widest">STUDENT_</h2>
            </div>
            <p className="font-mono text-sm opacity-70 mb-8 flex-1 leading-relaxed">
              &gt; Enter the learning matrix.<br/>
              &gt; Adaptive problem solving active.<br/>
              &gt; AI assistance ready.
            </p>
            
            <StudentSelector students={students} />
          </div>

          {/* Teacher Terminal */}
          <div className="shard p-8 flex flex-col group hover:border-[var(--acid-green)] transition-colors duration-500 border-[rgba(180,255,0,0.2)]">
            <div className="flex items-center gap-4 mb-6 text-[var(--acid-green)]">
              <ShieldAlert size={32} />
              <h2 className="text-3xl font-bold font-mono tracking-widest" style={{color: 'var(--acid-green)'}}>OVERSEER_</h2>
            </div>
            <p className="font-mono text-sm opacity-70 mb-8 flex-1 leading-relaxed">
              &gt; Global telemetry access.<br/>
              &gt; Real-time cognitive tracking.<br/>
              &gt; Deployment commands active.
            </p>
            
            <button
              className="cyber-btn mt-auto"
              style={{background: 'var(--acid-green)', color: 'var(--bg-deep)'}}
              onClick={() => navigate("/teacher")}
            >
              [ INITIALIZE_DASHBOARD ]
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function StudentSelector({ students }: { students: any[] | undefined }) {
  const navigate = useNavigate();

  if (!students) return (
    <div className="font-mono text-[var(--neon-emerald)] animate-pulse">AWAITING CONNECTION...</div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="t-mono-label mb-2 opacity-50">AVAILABLE_IDENTITIES:</div>
      <div className="max-h-[160px] overflow-y-auto pr-2 flex flex-col gap-2">
        {students.map((s) => (
          <button
            key={s._id}
            className="cyber-btn cyber-btn-ghost justify-start w-full"
            onClick={() => navigate(`/student/${s._id}`)}
          >
            [CONNECT] :: {s.name.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
