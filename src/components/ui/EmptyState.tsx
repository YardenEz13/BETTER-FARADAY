import { useState, type HTMLAttributes, type ReactNode } from "react";
import { randomQuote } from "../../data/faradayQuotes";

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

/** Centered empty/zero-data state: icon disc, title, muted description, CTA. */
export function EmptyState({ icon, title, description, action, quote = false, className = "", ...rest }: EmptyStateProps) {
  const [q] = useState(randomQuote);
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-10 px-6 ${className}`} {...rest}>
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
      {quote && <div className="italic text-body-sm text-on-surface-variant/70 max-w-sm mt-1">{q.he}</div>}
    </div>
  );
}

export default EmptyState;
