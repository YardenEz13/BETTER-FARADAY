import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading icon or emoji. */
  icon?: ReactNode;
  /** Highlights the chip with the primary color (pressed/selected filter). */
  selected?: boolean;
}

/**
 * Pill stat/filter chip over .stat-chip. Rendered as a button; pass
 * `disabled` for purely decorative chips if needed.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { icon, selected = false, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      aria-pressed={rest["aria-pressed"] ?? (selected || undefined)}
      className={`stat-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary text-primary" : ""} ${className}`}
      {...rest}
    >
      {icon && <span className="inline-flex shrink-0" aria-hidden>{icon}</span>}
      {children}
    </button>
  );
});

export default Chip;
