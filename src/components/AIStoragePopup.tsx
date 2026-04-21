import { useState, useEffect } from "react";
import { Database, Zap, HardDrive, CheckCircle } from "lucide-react";

interface AIStoragePopupProps {
  onConsent: () => void;
}

export default function AIStoragePopup({ onConsent }: AIStoragePopupProps) {
  const [show, setShow] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!navigator.storage || !navigator.storage.persist) {
      onConsent();
      return;
    }

    navigator.storage.persisted().then((isPersisted) => {
      if (isPersisted) {
        onConsent();
      } else {
        setShow(true);
      }
    });
  }, [onConsent]);

  const handleConsent = async () => {
    setAsking(true);
    try {
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }
    } catch (e) {
      console.error("Storage persist request failed:", e);
    }
    setShow(false);
    onConsent();
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(12px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        direction: "rtl"
      }}
    >
      <div 
        className="card" 
        style={{
          maxWidth: 480,
          background: "linear-gradient(145deg, var(--surface-highest), var(--surface-high))",
          border: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          padding: 32,
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "absolute", top: -80, right: -40, width: 200, height: 200, borderRadius: "50%", background: "var(--primary-alpha)", filter: "blur(50px)", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: "var(--r-md)", background: "rgba(162, 255, 194, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-dim)" }}>
              <HardDrive size={32} />
            </div>
            <div>
              <h2 className="t-h2" style={{ margin: 0, fontSize: "1.4rem" }}>אחסון מודל AI מקומי</h2>
              <div className="t-sub" style={{ margin: 0, fontSize: "0.9rem", color: "var(--primary-dim)" }}>שיפור ביצועים וטעינה מהירה</div>
            </div>
          </div>

          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 24, fontSize: "0.95rem" }}>
            האפליקציה משתמשת במודל בינה מלאכותית מתקדם (Gemma 3n) הפועל מקומית על המחשב שלך כדי לעזור לך במתמטיקה. 
            <strong> המודל דורש כ-3.5GB פנויים. </strong>
          </p>

          <p style={{ color: "var(--text)", lineHeight: 1.6, marginBottom: 32, fontSize: "0.95rem" }}>
            כדי שלא תצטרך להוריד את המודל מחדש בכל פעם שאתה נכנס למערכת, אנו מבקשים אישור לאחסון קבוע (Persistent Storage) בדפדפן.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button 
              className="new-proof-btn" 
              style={{ width: "100%", margin: 0, display: "flex", justifyContent: "center", gap: 8, fontSize: "1rem", padding: "14px 24px" }}
              onClick={handleConsent}
              disabled={asking}
            >
              {asking ? "מאשר..." : (
                <>
                  <CheckCircle size={18} />
                  אשר אחסון קבוע והמשך
                </>
              )}
            </button>
            <button 
              style={{ width: "100%", padding: "12px 24px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--surface-highest)", borderRadius: "var(--r-md)", cursor: "pointer", fontSize: "0.95rem", transition: "all 0.2s" }}
              onClick={() => {
                setShow(false);
                onConsent(); // Let them proceed, browser might clear storage later though
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
               המשך ללא אחסון קבוע (הורדה חוזרת תיתכן)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
