import { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";

export default function PrototypeGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("faraday_prototype_auth") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "BDIKA" && password === "123456") {
      localStorage.setItem("faraday_prototype_auth", "true");
      setIsAuthenticated(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg-void)] flex items-center justify-center p-8">
      <div className="glass p-12 max-w-[32rem] w-full border border-[var(--color-primary)] bg-[var(--color-primary-muted)] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-1 h-full bg-[var(--color-primary)] shadow-[var(--glow-primary)]"></div>
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 border border-[var(--color-primary)] bg-[color-mix(in srgb, var(--color-primary) 10%, transparent)] text-[var(--color-primary)] mb-4">
            <Lock size={32} />
          </div>
          <h1 className="hud-title text-5xl mb-2" data-text="RESTRICTED">RESTRICTED</h1>
          <p className="label-mono opacity-70">FARADAY LOGIC // PROTOTYPE ACCESS</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <label className="label-mono text-[var(--text-primary)]">שם משתמש</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] p-5 text-[var(--text-primary)] font-mono focus:border-[var(--color-primary)] focus:outline-none transition-colors text-center text-lg"
              placeholder="Username"
              dir="ltr"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="label-mono text-[var(--text-primary)]">סיסמה</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] p-5 text-[var(--text-primary)] font-mono focus:border-[var(--color-primary)] focus:outline-none transition-colors text-center tracking-widest text-xl"
              placeholder="******"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="text-[var(--color-danger)] label-mono border border-[var(--color-danger)] bg-[var(--color-danger-muted)] p-3 text-center">
              ACCESS DENIED. INCORRECT CREDENTIALS.
            </div>
          )}

          <button type="submit" className="btn btn-primary justify-center mt-6 py-4 text-lg tracking-widest hover:scale-[1.02] transition-transform">
            <Unlock size={20} /> [ AUTHENTICATE ]
          </button>
        </form>
      </div>
    </div>
  );
}

