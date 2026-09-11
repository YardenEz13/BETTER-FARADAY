import { useState, type HTMLAttributes, type ReactNode } from "react";
import { randomQuote } from "../../data/faradayQuotes";
import { ElectricField } from "../electric";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Sized icon element (e.g. <Inbox size={28} />) or emoji. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Call-to-action, usually a <ClayButton>. */
  action?: ReactNode;
  /** Show a small italic rotating Faraday quote under the description. */
  quote?: boolean;
}

/** Centered empty/zero-data state: icon disc, title, muted description, CTA.
 *
 * Carries the field-line backdrop. An empty state is the one place with room
 * for it and nothing to compete with, and routing it through this primitive is
 * what puts a backdrop on the screens that never mounted a canvas of their own.
 * Sparse and faint on purpose: it is behind the one message the screen has. */
export function EmptyState({ icon, title, description, action, quote = false, className = "", ...rest }: EmptyStateProps) {
  const [q] = useState(randomQuote);
  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-center text-center gap-3 py-10 px-6 ${className}`}
      {...rest}
    >
      <ElectricField className="electric-field" intensity={0.3} density="sparse" />
      <div className="relative z-10 flex flex-col items-center gap-3">
      {icon && (
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-container-low border-2 border-outline text-on-surface-variant"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div className="text-headline-sm text-on-surface">{title}</div>
      {description && <div className="text-body-sm text-on-surface-variant max-w-sm">{description}</div>}
      {action && <div className="mt-1">{action}</div>}
      {quote && <div className="italic text-body-sm text-on-surface-variant/70 max-w-sm mt-1">{q}</div>}
      </div>
    </div>
  );
}

export default EmptyState;
