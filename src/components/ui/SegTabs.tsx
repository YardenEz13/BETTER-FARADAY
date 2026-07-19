import { useId } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export interface SegTab<T extends string> {
  id: T;
  label: ReactNode;
  /** Optional leading icon; receives no props — pass a sized element. */
  icon?: ReactNode;
  /** Optional trailing count badge (e.g. open items). */
  count?: number;
}

export interface SegTabsProps<T extends string> {
  tabs: ReadonlyArray<SegTab<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Accessible name for the tab list. */
  label?: string;
  className?: string;
}

/**
 * Clay segmented control: recessed track + primary pill that springs between
 * segments (framer-motion layoutId). Matches the TeacherDashboard nav pattern.
 */
export function SegTabs<T extends string>({ tabs, value, onChange, label, className = "" }: SegTabsProps<T>) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex items-center gap-1 p-1.5 rounded-2xl bg-surface-container-low border-2 border-outline overflow-x-auto no-scrollbar ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-body-sm font-semibold whitespace-nowrap flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {active && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-primary"
                style={{ boxShadow: "var(--shadow-clay-primary)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            {tab.icon && (
              <span className={`relative z-10 inline-flex ${active ? "text-on-primary" : "text-on-surface-variant"}`} aria-hidden>
                {tab.icon}
              </span>
            )}
            <span className={`relative z-10 ${active ? "text-on-primary" : "text-on-surface-variant"}`}>{tab.label}</span>
            {tab.count != null && (
              <span
                className={`relative z-10 font-mono rounded-full px-2 ${
                  active ? "bg-on-primary/20 text-on-primary" : "bg-surface-container-high text-on-surface-variant"
                }`}
                style={{ fontSize: "0.72rem", lineHeight: "1.2rem" }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegTabs;
