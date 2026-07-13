import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "primary" | "secondary" | "tertiary" | "error" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  primary: "", // .badge default: primary-container
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  error: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container-high text-on-surface-variant",
};

/** Small rounded status badge over .badge, with container-color tones. */
export function Badge({ tone = "primary", icon, className = "", children, ...rest }: BadgeProps) {
  return (
    <span className={`badge ${TONE_CLASS[tone]} ${className}`} {...rest}>
      {icon && <span className="inline-flex shrink-0" aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
