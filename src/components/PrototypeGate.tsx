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
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
      <div className="shard p-8 max-w-md w-full border border-[var(--neon-emerald)] bg-[rgba(0,255,136,0.02)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1 h-full bg-[var(--neon-emerald)] shadow-[var(--glow-emerald)]"></div>
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 border border-[var(--neon-emerald)] bg-[rgba(0,255,136,0.1)] text-[var(--neon-emerald)] mb-4">
            <Lock size={32} />
          </div>
          <h1 className="hud-title text-5xl mb-2" data-text="RESTRICTED">RESTRICTED</h1>
          <p className="t-mono-label opacity-70">FARADAY LOGIC // PROTOTYPE ACCESS</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="t-mono-label text-white">שם משתמש</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.5)] border border-[#1a3324] p-4 text-white font-mono focus:border-[var(--neon-emerald)] focus:outline-none transition-colors text-center"
              placeholder="Username"
              dir="ltr"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="t-mono-label text-white">סיסמה</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.5)] border border-[#1a3324] p-4 text-white font-mono focus:border-[var(--neon-emerald)] focus:outline-none transition-colors text-center tracking-widest"
              placeholder="******"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="text-[#ff4b4b] t-mono-label border border-[#ff4b4b] bg-[rgba(255,75,75,0.05)] p-3 text-center">
              ACCESS DENIED. INCORRECT CREDENTIALS.
            </div>
          )}

          <button type="submit" className="cyber-btn justify-center mt-4">
            <Unlock size={18} /> [ AUTHENTICATE ]
          </button>
        </form>
      </div>
    </div>
  );
}
