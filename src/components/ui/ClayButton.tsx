import { forwardRef } from "react";
import type { ButtonHTMLAttributes, PointerEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { click as playClick } from "../../lib/sfx";

export type ClayButtonVariant = "primary" | "secondary" | "ghost" | "icon";
export type ClayButtonSize = "sm" | "md" | "lg";

export interface ClayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ClayButtonVariant;
  /** Ignored for variant="icon" (fixed 40px square). */
  size?: ClayButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ClayButtonVariant, string> = {
  primary: "btn-clay-primary",
  secondary: "btn-clay-secondary",
  ghost: "btn-clay-ghost",
  icon: "btn-icon",
};

/* Utility classes append after the component-layer base, so they win the cascade. */
const SIZE_CLASS: Record<ClayButtonSize, string> = {
  sm: "px-4 py-2 text-label-lg rounded-xl",
  md: "", // base .btn-clay-* padding (px-6 py-3)
  lg: "px-8 py-4 text-body-lg",
};

/**
 * Typed wrapper over the clay button classes (.btn-clay-primary / -secondary /
 * -ghost / .btn-icon). No new visuals — just an API with loading + disabled.
 */
export const ClayButton = forwardRef<HTMLButtonElement, ClayButtonProps>(
  function ClayButton(
    { variant = "primary", size = "md", loading = false, disabled, className = "", children, onPointerDown, ...rest },
    ref,
  ) {
    const sizeClass = variant === "icon" ? "" : SIZE_CLASS[size];
    const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
      if (!(disabled || loading)) playClick();
      onPointerDown?.(e);
    };
    return (
      <button
        ref={ref}
        type={rest.type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onPointerDown={handlePointerDown}
        className={`${VARIANT_CLASS[variant]} ${sizeClass} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...rest}
      >
        {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

export default ClayButton;
