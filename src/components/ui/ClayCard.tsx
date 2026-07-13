import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

export type ClayCardPadding = "none" | "sm" | "md" | "lg";

export interface ClayCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the hover lift / press effect. Off by default for static content. */
  interactive?: boolean;
  padding?: ClayCardPadding;
}

const PADDING_CLASS: Record<ClayCardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

/**
 * The signature clay surface (.clay-card): solid bg, 2px border, offset press
 * shadow. `interactive` keeps the class's hover/active transform; otherwise
 * transforms are suppressed so static cards don't wiggle.
 */
export const ClayCard = forwardRef<HTMLDivElement, ClayCardProps>(function ClayCard(
  { interactive = false, padding = "md", className = "", children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`clay-card ${PADDING_CLASS[padding]} ${interactive ? "cursor-pointer" : "hover:transform-none active:transform-none hover:shadow-(--shadow-clay) active:shadow-(--shadow-clay)"} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

export default ClayCard;
