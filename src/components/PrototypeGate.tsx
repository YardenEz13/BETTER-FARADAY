import { useState, useEffect } from "react";
import { Lock, Unlock } from "./electric";

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
    <div className="min-h-screen w-full flex items-center justify-center p-8 bg-background"
    >
      <div className="clay-card p-12 max-w-[32rem] w-full border-2 border-primary bg-primary/5 relative overflow-hidden shadow-2xl rounded-2xl">
        {/* Green accent bar */}
        <div className="absolute top-0 right-0 w-1 h-full bg-primary rounded-r-2xl" />

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-primary bg-primary/10 text-primary mb-5">
            <Lock size={32} />
          </div>
          <h1 className="font-display text-5xl font-black tracking-widest text-on-surface mb-2">RESTRICTED</h1>
          <p className="label-mono opacity-70">FARADAY LOGIC // PROTOTYPE ACCESS</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="label-mono text-on-surface">שם משתמש</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface border-2 border-outline rounded-xl px-4 py-4 text-on-surface font-mono focus:border-primary focus:outline-none transition-colors text-center text-lg"
              placeholder="Username"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="label-mono text-on-surface">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border-2 border-outline rounded-xl px-4 py-4 text-on-surface font-mono focus:border-primary focus:outline-none transition-colors text-center tracking-widest text-xl"
              placeholder="******"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="text-error label-mono border border-error bg-error/10 p-3 text-center rounded-xl">
              ACCESS DENIED. INCORRECT CREDENTIALS.
            </div>
          )}

          <button type="submit" className="btn-clay-primary justify-center mt-4 py-4 text-lg tracking-widest hover:scale-[1.02] transition-transform">
            <Unlock size={20} /> [ AUTHENTICATE ]
          </button>
        </form>
      </div>
    </div>
  );
}
