import type { HTMLAttributes, ReactNode } from "react";

export type StatTone = "default" | "primary" | "secondary" | "tertiary" | "error";

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  /** The numeric readout — rendered in the mono .num "voltmeter" face. */
  value: ReactNode;
  label: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  size?: "md" | "lg";
}

const TONE_CLASS: Record<StatTone, string> = {
  default: "text-on-surface",
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  error: "text-error",
};

/** KPI readout: mono tabular number + label-mono caption underneath. */
export function Stat({ value, label, icon, tone = "default", size = "md", className = "", ...rest }: StatProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`} {...rest}>
      <div className={`num flex items-center gap-1.5 font-bold ${size === "lg" ? "text-headline-xl" : "text-headline-md"} ${TONE_CLASS[tone]}`}>
        {icon && <span className="inline-flex shrink-0" aria-hidden>{icon}</span>}
        {value}
      </div>
      <div className="label-mono">{label}</div>
    </div>
  );
}

export default Stat;
