import { useState, useEffect } from "react";
import { Lock, Unlock } from "./electric";
import { randomQuote } from "../data/faradayQuotes";
import FaradayCanvas from "./FaradayCanvas";
import { ThemeToggle } from "./ThemeContext";
import { motion } from "framer-motion";

export default function PrototypeGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [quote] = useState(randomQuote);

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
    <div className="relative min-h-screen w-full flex items-center justify-center p-6 bg-background overflow-hidden" dir="rtl">
      {/* Subtle mouse-reactive Faraday background lines */}
      <FaradayCanvas variant="linesOfForce" style={{ zIndex: 0, opacity: 0.5 }} />

      {/* Global theme switcher accessible on the gate page */}
      <div className="absolute top-6 left-6 z-20">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="clay-card p-10 lg:p-12 max-w-[30rem] w-full border-2 border-outline bg-surface relative overflow-hidden rounded-[22px] z-10"
        style={{ boxShadow: "var(--shadow-clay)" }}
      >
        {/* Top brand accent bar matching rest of Faraday cards */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-primary" />

        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-primary/20 bg-primary/10 text-primary mb-5"
            style={{ boxShadow: "0 0 15px rgba(23, 201, 100, 0.15)" }}
          >
            <Lock size={32} tone="spark" glow={0.8} />
          </div>
          <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-on-surface mb-2">כניסה לבדיקת פיילוט</h1>
          <p className="label-mono opacity-70">אל תגלה לאף אחד... אבל השם משתמש נמצא בפנים</p>
          <p className="label-mono opacity-50 mt-4 text-sm normal-case tracking-normal leading-relaxed">{quote}</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="label-mono text-on-surface">שם משתמש</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-container-low border-2 border-outline rounded-2xl px-4 py-3.5 text-on-surface font-mono focus:border-primary focus:bg-surface focus:outline-none transition-all text-center text-lg shadow-inner"
              placeholder="BDIKA"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="label-mono text-on-surface">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low border-2 border-outline rounded-2xl px-4 py-3.5 text-on-surface font-mono focus:border-primary focus:bg-surface focus:outline-none transition-all text-center tracking-widest text-xl shadow-inner"
              placeholder="******"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="text-error label-mono border-2 border-error/30 bg-error/10 p-3 text-center rounded-2xl">
              מה קרה לך החלקת על השכל?
            </div>
          )}

          <button type="submit" className="btn-clay-primary justify-center mt-4 py-4 text-lg tracking-widest hover:scale-[1.02] transition-transform">
            <Unlock size={20} tone="ghost" glow={0.5} /> כניסה זמנית
          </button>
        </form>
      </motion.div>
    </div>
  );
}
