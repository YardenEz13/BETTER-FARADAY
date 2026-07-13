import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell, BookOpen, FileText, Flame, Trophy, Sparkles, Target, Check,
} from "./electric";
import { SparkBurst } from "./electric";

type Urgency = "urgent" | "info" | "celebration";
interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  urgency: Urgency;
  linkTo: string | null;
  createdAt: number;
  dueAt: number | null;
  read: boolean;
}

// ── Hebrew relative-time phrasing ──
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return "עכשיו";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "כרגע";
  if (mins < 60) return `לפני ${mins} ${mins === 1 ? "דקה" : "דקות"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours === 2 ? "שעתיים" : hours === 1 ? "שעה" : `${hours} שעות`}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days === 2 ? "יומיים" : days === 1 ? "יום" : `${days} ימים`}`;
  const weeks = Math.floor(days / 7);
  return `לפני ${weeks === 1 ? "שבוע" : weeks === 2 ? "שבועיים" : `${weeks} שבועות`}`;
}

// ── Relative deadline phrasing (future) ──
function dueTime(dueAt: number): string {
  const diff = dueAt - Date.now();
  if (diff < 0) return "באיחור";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 12) return "עד היום";
  if (hours < 24) return "עד מחר";
  const days = Math.floor(hours / 24);
  if (days < 7) return `עוד ${days === 2 ? "יומיים" : days === 1 ? "יום" : `${days} ימים`}`;
  const weeks = Math.floor(days / 7);
  return `עוד ${weeks === 1 ? "שבוע" : weeks === 2 ? "שבועיים" : `${weeks} שבועות`}`;
}

function kindIcon(kind: string, urgency: Urgency) {
  const cls =
    urgency === "urgent" ? "text-tertiary" : urgency === "celebration" ? "text-primary" : "text-secondary";
  switch (kind) {
    case "homework": return <BookOpen size={20} className={cls} />;
    case "pdf": return <FileText size={20} className={cls} />;
    case "streak": return <Flame size={20} className="text-tertiary" />;
    case "level": return <Trophy size={20} className="text-primary" />;
    case "goal": return <Target size={20} className="text-primary" />;
    default: return <Sparkles size={20} className={cls} />;
  }
}

function NotificationRow({
  n, reducedMotion, onClick,
}: {
  n: NotificationItem;
  reducedMotion: boolean;
  onClick: () => void;
}) {
  const accent =
    n.urgency === "urgent"
      ? { border: "var(--color-tertiary)", bg: "color-mix(in srgb, var(--color-tertiary) 8%, transparent)" }
      : n.read
        ? { border: "var(--color-outline)", bg: "transparent" }
        : { border: "color-mix(in srgb, var(--color-primary) 30%, var(--color-outline))", bg: "color-mix(in srgb, var(--color-primary) 5%, transparent)" };

  const timeLabel = n.dueAt != null ? dueTime(n.dueAt) : relativeTime(n.createdAt);

  return (
    <button
      onClick={onClick}
      dir="rtl"
      className="relative w-full flex items-start gap-3 p-3.5 rounded-2xl border-2 text-right transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
      style={{ borderColor: accent.border, background: accent.bg, boxShadow: "var(--shadow-clay)" }}
    >
      {/* Icon bubble */}
      <div
        className="relative w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center border-2 bg-surface"
        style={{ borderColor: accent.border }}
      >
        {kindIcon(n.kind, n.urgency)}
        {n.urgency === "celebration" && !reducedMotion && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <SparkBurst />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-on-surface leading-tight">{n.title}</span>
          {!n.read && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" style={{ boxShadow: "0 0 6px var(--color-primary)" }} />
          )}
        </div>
        <p className="font-medium text-xs text-on-surface-variant leading-snug mt-1">{n.body}</p>
        <span
          className={`inline-block mt-1.5 text-[11px] font-semibold ${n.urgency === "urgent" ? "text-tertiary" : "text-on-surface-variant"}`}
        >
          {timeLabel}
        </span>
      </div>
    </button>
  );
}

function PanelBody({
  notifications, reducedMotion, unreadCount, onRowClick, onMarkAll,
}: {
  notifications: NotificationItem[];
  reducedMotion: boolean;
  unreadCount: number;
  onRowClick: (n: NotificationItem) => void;
  onMarkAll: () => void;
}) {
  return (
    <div dir="rtl" className="flex flex-col gap-3 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-on-surface" style={{ fontFamily: "'Assistant', sans-serif" }}>
          התראות
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border-2 border-primary/25 hover:bg-primary/15 transition-all cursor-pointer"
          >
            <Check size={13} />
            סמן הכל כנקרא
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-container border-2 border-outline flex items-center justify-center mb-3">
            <Bell size={26} className="text-on-surface-variant" />
          </div>
          <p className="font-bold text-on-surface text-sm">הכל שקט ⚡</p>
          <p className="font-medium text-on-surface-variant text-xs mt-1">אין התראות</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notifications.map((n) => (
            <NotificationRow key={n.id} n={n} reducedMotion={reducedMotion} onClick={() => onRowClick(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationCenter({ studentId }: { studentId: string }) {
  const sid = studentId as Id<"students">;
  const notifications = useQuery(api.notifications.getNotifications, { studentId: sid });
  const markRead = useMutation(api.notifications.markRead);
  const navigate = useNavigate();
  const reducedMotion = !!useReducedMotion();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside tap/click (pointerdown covers touch too)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const list = notifications ?? [];
  const unreadCount = list.filter((n) => !n.read).length;
  const hasUrgentUnread = list.some((n) => !n.read && n.urgency === "urgent");

  const handleRowClick = async (n: NotificationItem) => {
    if (!n.read) await markRead({ studentId: sid, keys: [n.id] });
    setOpen(false);
    if (n.linkTo) navigate(n.linkTo);
  };

  const handleMarkAll = async () => {
    const keys = list.filter((n) => !n.read).map((n) => n.id);
    if (keys.length > 0) await markRead({ studentId: sid, keys });
  };

  return (
    <div className="relative" ref={rootRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`התראות${unreadCount > 0 ? ` — ${unreadCount} חדשות` : ""}`}
        className={`relative w-9 h-9 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all border-2 border-outline hover:border-primary cursor-pointer ${
          hasUrgentUnread && !reducedMotion ? "notif-bell-pulse" : ""
        }`}
        style={{ boxShadow: "var(--shadow-clay)" }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="num absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-extrabold flex items-center justify-center border-2 border-surface"
            style={{ boxShadow: hasUrgentUnread ? "0 0 8px var(--color-tertiary)" : "0 0 6px var(--color-primary)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown — anchored under the bell on desktop; on the phone it pins
          just below the header, full-width. No bottom sheet, no backdrop: the
          header stays visible instead of blacking out behind a scrim. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="fixed inset-x-3 top-[76px] md:absolute md:inset-x-auto md:left-0 md:top-auto md:mt-2 w-auto md:w-[22rem] max-h-[60vh] md:max-h-[70vh] overflow-y-auto overscroll-contain rounded-3xl border-2 border-outline bg-surface z-[80]"
            style={{ boxShadow: "var(--shadow-clay), 0 12px 40px rgba(0,0,0,0.15)" }}
          >
            <PanelBody
              notifications={list}
              reducedMotion={reducedMotion}
              unreadCount={unreadCount}
              onRowClick={handleRowClick}
              onMarkAll={handleMarkAll}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
