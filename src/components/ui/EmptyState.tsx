import type { HTMLAttributes, ReactNode } from "react";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Sized icon element (e.g. <Inbox size={28} />) or emoji. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Call-to-action, usually a <ClayButton>. */
  action?: ReactNode;
}

/** Centered empty/zero-data state: icon disc, title, muted description, CTA. */
export function EmptyState({ icon, title, description, action, className = "", ...rest }: EmptyStateProps) {
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
    </div>
  );
}

export default EmptyState;
