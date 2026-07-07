import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft, Check, Lock, Palette, Star, Package, Flame,
  ElectricBolt, Battery, SparkBurst,
} from "../components/electric";
import { ThemeToggle } from "../components/ThemeContext";
import FaradayCanvas from "../components/FaradayCanvas";

/* ── Animated count-up number that pops on change ── */
function AnimatedBalance({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const [display, setDisplay] = useState(value);
  const chipRef = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (reducedMotion) { setDisplay(value); prev.current = value; return; }
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const duration = 650;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // pop
    const el = chipRef.current;
    if (el) {
      el.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }],
        { duration: 450, easing: "cubic-bezier(.34,1.56,.64,1)" },
      );
    }
    return () => cancelAnimationFrame(raf);
  }, [value, reducedMotion]);

  return (
    <span ref={chipRef} className="num inline-block font-black tabular-nums">
      {display.toLocaleString()}
    </span>
  );
}

/* ── Category metadata (Hebrew headers + icon) ── */
const CATEGORY_META: Record<string, { label: string; icon: JSX.Element }> = {
  avatar_color: { label: "צבעי דמות", icon: <Palette size={18} className="text-secondary" /> },
  theme:        { label: "ערכות נושא", icon: <Star size={18} className="text-primary" /> },
  streak_freeze:{ label: "הקפאות רצף", icon: <Flame size={18} className="text-tertiary" /> },
  badge:        { label: "תגים", icon: <Package size={18} className="text-primary" /> },
};
const CATEGORY_ORDER = ["avatar_color", "theme", "streak_freeze", "badge"];

type ShopItem = {
  _id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  price: number;
  value: string | null;
  owned: boolean;
  equipped: boolean;
};

function ItemIcon({ icon }: { icon: string }) {
  // emoji vs lucide-name — the electric family covers the shop's names; emoji renders as-is.
  const map: Record<string, JSX.Element> = {
    palette: <Palette size={24} className="text-secondary" />,
    star: <Star size={24} className="text-primary" />,
    flame: <Flame size={24} className="text-tertiary" />,
    package: <Package size={24} className="text-primary" />,
    bolt: <ElectricBolt size={24} tone="spark" glow={0.5} animated={false} />,
    zap: <ElectricBolt size={24} tone="spark" glow={0.5} animated={false} />,
  };
  const key = icon?.toLowerCase?.() ?? "";
  if (map[key]) return map[key];
  // treat as emoji / raw text
  return <span className="text-2xl leading-none" aria-hidden>{icon}</span>;
}

function ShopCard({
  item, balance, reducedMotion, onBought, onError,
}: {
  item: ShopItem;
  balance: number;
  reducedMotion: boolean;
  onBought: () => void;
  onError: (msg: string) => void;
}) {
  const { studentId } = useParams<{ studentId: string }>();
  const purchase = useMutation(api.shop.purchaseItem);
  const equip = useMutation(api.shop.equipItem);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const equippable = item.category === "avatar_color" || item.category === "theme";
  const alwaysBuyable = item.category === "streak_freeze";
  const affordable = balance >= item.price;
  const missing = item.price - balance;
  const disabled = (item.owned && !alwaysBuyable) || (!affordable && !alwaysBuyable) || busy;

  const shake = () => {
    const el = cardRef.current;
    if (!el || reducedMotion) return;
    el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" },
       { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
      { duration: 360, easing: "ease-in-out" },
    );
  };

  const handleEquip = async () => {
    if (busy || item.equipped) return;
    setBusy(true);
    try {
      await equip({ studentId: studentId as Id<"students">, itemId: item._id as Id<"shopItems"> });
      if (!reducedMotion) { setBurst(true); setTimeout(() => setBurst(false), 700); }
    } catch (e) {
      shake();
      const msg = e instanceof Error ? e.message : "משהו השתבש. נסו שוב.";
      onError(msg.replace(/^\[.*?\]\s*/, "").replace(/Uncaught Error:\s*/i, "").trim());
    } finally {
      setBusy(false);
    }
  };

  const handleBuy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await purchase({ studentId: studentId as Id<"students">, itemId: item._id as Id<"shopItems"> });
      if (!reducedMotion) { setBurst(true); setTimeout(() => setBurst(false), 700); }
      onBought();
    } catch (e) {
      shake();
      const msg = e instanceof Error ? e.message : "משהו השתבש. נסו שוב.";
      // Convex wraps the thrown message; strip the framework prefix for a clean Hebrew toast.
      onError(msg.replace(/^\[.*?\]\s*/, "").replace(/Uncaught Error:\s*/i, "").trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden rounded-3xl border-2 p-5 flex flex-col gap-4 transition-all
        ${item.equipped ? "border-primary bg-primary/10" : item.owned && !alwaysBuyable ? "border-primary/40 bg-primary/5" : "border-outline bg-surface"}`}
      style={{ boxShadow: item.owned && !alwaysBuyable ? "var(--shadow-clay-primary)" : "var(--shadow-clay)" }}
    >
      {burst && !reducedMotion && <SparkBurst />}

      <div className="flex items-start gap-3">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border-2
          ${item.owned && !alwaysBuyable ? "bg-primary/15 border-primary/30" : "bg-surface-container border-outline"}`}>
          <ItemIcon icon={item.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-on-surface leading-tight">{item.name}</h3>
          <p className="text-sm text-on-surface-variant font-medium leading-snug mt-0.5">{item.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        {/* price chip */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary/12 border-2 border-tertiary/30 num font-bold text-sm text-on-surface">
          <ElectricBolt size={15} tone="spark" glow={0.5} animated={false} />
          {item.price.toLocaleString()}
        </span>

        {item.owned && equippable ? (
          item.equipped ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-semibold text-sm"
              style={{ boxShadow: "var(--shadow-clay-primary)" }}>
              <Check size={15} strokeWidth={3} /> בשימוש
            </span>
          ) : (
            <button
              onClick={handleEquip}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-surface text-primary border-2 border-primary font-semibold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
              style={{ boxShadow: "var(--shadow-clay)" }}
            >
              {busy ? "מחיל…" : "החל"}
            </button>
          )
        ) : item.owned && !alwaysBuyable ? (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary/10 border-2 border-primary/30 text-primary font-semibold text-sm">
            <Check size={15} strokeWidth={3} /> ברשותך
          </span>
        ) : disabled && !affordable && !alwaysBuyable ? (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-container border-2 border-outline text-on-surface-variant font-semibold text-xs">
            <Lock size={13} /> חסר לך {missing.toLocaleString()} נק׳
          </span>
        ) : (
          <button
            onClick={handleBuy}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-semibold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
            style={{ boxShadow: "var(--shadow-clay-primary)" }}
          >
            {busy ? "רוכש…" : "קנייה"}
          </button>
        )}
      </div>

      {/* owned count for consumables (streak freezes) */}
      {alwaysBuyable && item.owned && (
        <div className="text-xs font-semibold text-tertiary flex items-center gap-1.5">
          <Flame size={12} /> יש לך הקפאות זמינות
        </div>
      )}
    </div>
  );
}

export default function XpShop() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const reducedMotion = !!useReducedMotion();
  const shop = useQuery(api.shop.getShop, { studentId: studentId as Id<"students"> });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const grouped = (() => {
    const items = (shop?.items ?? []) as ShopItem[];
    const byCat: Record<string, ShopItem[]> = {};
    for (const it of items) (byCat[it.category] ??= []).push(it);
    return byCat;
  })();

  return (
    <div dir="rtl" className="relative min-h-screen bg-background text-on-background overflow-x-hidden">
      <FaradayCanvas variant="linesOfForce" style={{ zIndex: 0 }} />

      {/* Top nav */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b-2 border-outline backdrop-blur-md"
        style={{ boxShadow: "var(--shadow-clay)", background: "color-mix(in srgb, var(--color-surface) 88%, transparent)" }}
      >
        <div className="flex items-center gap-4">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all border-2 border-outline hover:border-primary cursor-pointer"
            onClick={() => navigate(`/student/${studentId}`)}
            aria-label="חזרה"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div className="font-bold text-on-surface leading-tight" style={{ fontFamily: "'Assistant', sans-serif" }}>חנות האנרגיה</div>
            <div className="label-mono text-[0.6rem]">XP SHOP</div>
          </div>
        </div>
        <ThemeToggle />
      </motion.header>

      <div className="page-shell relative z-10 pt-[92px] pb-24">

        {/* Hero balance header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border-2 border-outline p-7 mb-8 overflow-hidden relative backdrop-blur-md"
          style={{ background: "color-mix(in srgb, var(--color-surface) 84%, transparent)", boxShadow: "var(--shadow-clay)" }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="label-mono text-on-surface-variant mb-1">היתרה שלך</div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary border-2 border-primary-dark flex items-center justify-center flex-shrink-0"
                  style={{ boxShadow: "var(--shadow-clay-primary)" }}>
                  <Battery size={26} tone="ghost" glow={0.6} />
                </div>
                <span className="text-4xl md:text-5xl text-primary" style={{ fontFamily: "'Assistant', sans-serif" }}>
                  <AnimatedBalance value={shop?.balance ?? 0} reducedMotion={reducedMotion} />
                </span>
                <span className="text-lg font-bold text-on-surface-variant self-end mb-1">נק׳</span>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-on-surface-variant font-medium">הרווחת</div>
                <div className="num font-bold text-on-surface text-lg">{(shop?.earned ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-on-surface-variant font-medium">הוצאת</div>
                <div className="num font-bold text-on-surface text-lg">{(shop?.spent ?? 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Loading skeleton */}
        {!shop && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer rounded-3xl" style={{ height: 168 }} />
            ))}
          </div>
        )}

        {/* Categories */}
        {shop && CATEGORY_ORDER.filter(c => grouped[c]?.length).map((cat) => (
          <section key={cat} className="mb-10">
            <div className="flex items-center gap-2.5 mb-4">
              {CATEGORY_META[cat]?.icon}
              <h2 className="font-bold text-lg text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
                {CATEGORY_META[cat]?.label ?? cat}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[cat].map((item) => (
                <ShopCard
                  key={item._id}
                  item={item}
                  balance={shop.balance}
                  reducedMotion={reducedMotion}
                  onBought={() => { /* useQuery is reactive — balance updates live */ }}
                  onError={setToast}
                />
              ))}
            </div>
          </section>
        ))}

        {shop && (shop.items?.length ?? 0) === 0 && (
          <div className="text-center py-16 text-on-surface-variant font-medium">החנות תיפתח בקרוב ✨</div>
        )}
      </div>

      {/* Error toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl bg-error text-white font-semibold text-sm border-2 border-error"
          style={{ boxShadow: "var(--shadow-clay)" }}
          role="alert"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}
