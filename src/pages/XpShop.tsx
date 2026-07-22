import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft, Check, X, Lock, Palette, Star, Package, Flame, Trophy,
  ElectricBolt, Battery, SparkBurst,
  ELECTRIC_ICONS, type ElectricIconName,
} from "../components/electric";
import { computeAchievements, type Achievement } from "../lib/achievements";
import { errorMessage } from "../lib/errors";
import { ThemeToggle } from "../components/ThemeContext";
import { ToastStack, useToasts } from "../components/ui/Toast";
import FaradayCanvas from "../components/FaradayCanvas";
import { fireConfetti } from "../lib/celebrations";

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
  title:        { label: "תארים", icon: <Trophy size={18} className="text-secondary" /> },
  streak_freeze:{ label: "הקפאות רצף", icon: <Flame size={18} className="text-tertiary" /> },
  xp_boost:     { label: "מגברי אנרגיה", icon: <Battery size={18} tone="spark" glow={0.5} /> },
  badge:        { label: "תגים", icon: <Package size={18} className="text-primary" /> },
};
const CATEGORY_ORDER = ["avatar_color", "theme", "title", "xp_boost", "streak_freeze", "badge"];

type ShopItem = {
  _id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  price: number;
  value: string | null;
  /** Re-buyable charge (freeze / boost) rather than a one-time unlock. */
  consumable: boolean;
  /** Writes its value into a student field when equipped. */
  equippable: boolean;
  owned: boolean;
  equipped: boolean;
};

// Shop rows store an icon *name* (seeded server-side) or a raw emoji. Names are
// resolved through the shared ELECTRIC_ICONS registry rather than a local map,
// so a new seeded name works without touching this file.
const ICON_TONE: Partial<Record<ElectricIconName, string>> = {
  palette: "text-secondary",
  flame: "text-tertiary",
};

function ItemIcon({ icon }: { icon: string }) {
  const key = icon?.toLowerCase?.() ?? "";
  const name = (Object.keys(ELECTRIC_ICONS) as ElectricIconName[]).find((n) => n.toLowerCase() === key);
  if (name) {
    const Icon = ELECTRIC_ICONS[name];
    return <Icon size={24} className={ICON_TONE[name] ?? "text-primary"} animated={false} glow={0.5} />;
  }
  // An unrecognised *name* would otherwise render as literal English text in an
  // all-Hebrew card — fall back to a generic reward glyph. Anything non-ASCII
  // is an emoji and renders as-is.
  if (/^[\x20-\x7e]+$/.test(icon ?? "")) return <Star size={24} className="text-primary" animated={false} glow={0.5} />;
  return <span className="text-2xl leading-none" aria-hidden>{icon}</span>;
}

function ShopCard({
  item, balance, charge, reducedMotion, onBought, onError,
}: {
  item: ShopItem;
  balance: number;
  /** Live charge state for consumables ("יש לך 2 הקפאות"), else null. */
  charge: string | null;
  reducedMotion: boolean;
  onBought: () => void;
  onError: (msg: string) => void;
}) {
  const { studentId } = useParams<{ studentId: string }>();
  const purchase = useMutation(api.shop.purchaseItem);
  const equip = useMutation(api.shop.equipItem);
  const unequip = useMutation(api.shop.unequipItem);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const equippable = item.equippable;
  const alwaysBuyable = item.consumable;
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
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Avatar colours always have one active, so there is nothing to revert to —
  // every other equippable (theme, title) can be taken back off.
  const removable = item.category !== "avatar_color";
  const handleUnequip = async () => {
    if (busy || !item.equipped) return;
    setBusy(true);
    try {
      await unequip({ studentId: studentId as Id<"students">, category: item.category });
    } catch (e) {
      shake();
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleBuy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await purchase({ studentId: studentId as Id<"students">, itemId: item._id as Id<"shopItems"> });
      if (!reducedMotion) {
        setBurst(true);
        setTimeout(() => setBurst(false), 700);
        // Confetti pops from the purchased card itself
        const r = cardRef.current?.getBoundingClientRect();
        if (r) fireConfetti(r.left + r.width / 2, r.top + r.height / 2);
      }
      onBought();
    } catch (e) {
      shake();
      onError(errorMessage(e));
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
            removable ? (
              <button
                onClick={handleUnequip}
                disabled={busy}
                title="הסרה"
                className="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-semibold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
                style={{ boxShadow: "var(--shadow-clay-primary)" }}
              >
                <Check size={15} strokeWidth={3} className="group-hover:hidden" />
                <X size={13} strokeWidth={3} className="hidden group-hover:inline" />
                <span className="group-hover:hidden">{busy ? "מסיר…" : "בשימוש"}</span>
                <span className="hidden group-hover:inline">הסר</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-on-primary border-2 border-primary-dark font-semibold text-sm"
                style={{ boxShadow: "var(--shadow-clay-primary)" }}>
                <Check size={15} strokeWidth={3} /> בשימוש
              </span>
            )
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

      {/* live charge state for consumables (freezes held, boost still running) */}
      {charge && (
        <div className="text-xs font-semibold text-tertiary flex items-center gap-1.5">
          <Flame size={12} /> {charge}
        </div>
      )}
    </div>
  );
}

/* Live charge state shown under a consumable card. Read at render time — the
   shop query re-runs on every purchase, which is when this actually changes. */
function chargeLabel(item: ShopItem, freezes: number, boostUntil: number | null): string | null {
  if (item.category === "streak_freeze") {
    return freezes > 0 ? `יש לך ${freezes} ${freezes === 1 ? "הקפאה" : "הקפאות"}` : null;
  }
  if (item.category === "xp_boost") {
    const hours = Math.ceil(((boostUntil ?? 0) - Date.now()) / 3_600_000);
    if (hours <= 0) return null;
    return hours >= 48 ? `מגבר פעיל עוד ${Math.round(hours / 24)} ימים` : `מגבר פעיל עוד ${hours} שעות`;
  }
  return null;
}

/* One achievement tile — earned tiles glow, the rest show how close they are. */
function AchievementTile({ a }: { a: Achievement }) {
  return (
    <div
      className={`rounded-2xl border-2 p-3.5 flex flex-col gap-2 shadow-(--shadow-clay) ${a.earned ? "border-tertiary/50 bg-tertiary/10" : "border-outline bg-surface"}`}
      title={a.desc}
    >
      <div className={`flex items-center gap-2 ${a.earned ? "" : "opacity-45 grayscale"}`}>
        <ItemIcon icon={a.icon} />
        <span className="font-bold text-sm text-on-surface leading-tight">{a.name}</span>
      </div>
      <p className="text-xs font-medium text-on-surface-variant leading-snug">{a.desc}</p>
      {a.earned ? (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-tertiary mt-auto">
          <Check size={13} strokeWidth={3} /> הושג
        </span>
      ) : (
        <div className="mt-auto">
          <div className="h-1.5 rounded-full bg-surface-container border border-outline overflow-hidden">
            <div className="h-full bg-primary transition-all duration-700" style={{ width: `${a.pct}%` }} />
          </div>
          <div className="num text-[11px] font-semibold text-on-surface-variant mt-1">
            {a.value.toLocaleString()} / {a.goal.toLocaleString()}
          </div>
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
  // Achievements are derived, not stored — these three subscriptions are the
  // same ones the home screen already holds, so there is nothing extra to keep
  // in sync (see src/lib/achievements.ts).
  const xpSummary = useQuery(api.xp.getXpSummary, { studentId: studentId as Id<"students"> });
  const stats = useQuery(api.attempts.getStudentStats, { studentId: studentId as Id<"students"> });
  const streakStatus = useQuery(api.streaks.getStreakStatus, { studentId: studentId as Id<"students"> });
  const { toasts, push, dismiss } = useToasts(3200);

  const byTopic = Object.values(stats?.byTopic ?? {}) as Array<{ correct: number; total: number }>;
  const achievements = computeAchievements({
    xp: xpSummary?.earned ?? 0,
    streak: streakStatus?.streak ?? 0,
    attempts: stats?.totalAttempts ?? 0,
    correct: byTopic.reduce((s, t) => s + t.correct, 0),
    topicsCompleted: byTopic.filter((t) => t.total > 0 && t.correct / t.total >= 0.8).length,
  });

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
                  charge={chargeLabel(item, shop.freezes, shop.boostUntil)}
                  reducedMotion={reducedMotion}
                  onBought={() => { /* useQuery is reactive — balance updates live */ }}
                  onError={(msg) => push("error", "הקנייה לא הושלמה", msg)}
                />
              ))}
            </div>
          </section>
        ))}

        {shop && (shop.items?.length ?? 0) === 0 && (
          <div className="text-center py-16 text-on-surface-variant font-medium">החנות תיפתח בקרוב ✨</div>
        )}

        {/* ── Achievements — earned by playing, never bought ── */}
        <section className="mb-4">
          <div className="flex items-center gap-2.5 mb-1">
            <Trophy size={18} className="text-tertiary" />
            <h2 className="font-bold text-lg text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>הישגים</h2>
            <span className="num font-bold text-sm text-tertiary px-2.5 py-0.5 rounded-full bg-tertiary/12 border-2 border-tertiary/30">
              {achievements.earnedCount}/{achievements.total}
            </span>
          </div>
          <p className="text-sm font-medium text-on-surface-variant mb-4">
            {achievements.next
              ? `היעד הבא: ${achievements.next.name} — ${achievements.next.value.toLocaleString()} מתוך ${achievements.next.goal.toLocaleString()}`
              : "כל ההישגים הושלמו — אגדה 🏆"}
          </p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {achievements.list.map((a) => <AchievementTile key={a.key} a={a} />)}
          </div>
        </section>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
