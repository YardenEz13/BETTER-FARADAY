/**
 * Loading placeholders swept by the `.shimmer` gradient. `Skeleton` is the
 * generic block; `SkeletonCard` keeps the pre-built clay-card shapes
 * (formerly src/components/SkeletonCard.tsx); `SkeletonText`,
 * `SkeletonCircle` and `SkeletonClayCard` were folded in from the former
 * src/components/ClaySkeleton.tsx. Purely presentational.
 */
import type { CSSProperties, ReactNode } from "react";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Border radius in px, or "full" for a pill/circle. Default 8. */
  rounded?: number | "full";
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width, height = 12, rounded = 8, className = "", style }: SkeletonProps) {
  return (
    <div
      className={`shimmer ${className}`}
      style={{ width, height, borderRadius: rounded === "full" ? 9999 : rounded, ...style }}
      aria-hidden
    />
  );
}

/** A stack of text-line shimmers; the last line is shortened. */
export function SkeletonText({
  lines = 3,
  lineHeight = 12,
  gap = 8,
  lastWidth = "60%",
  className = "",
}: {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastWidth?: number | string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`} style={{ gap }} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 ? lastWidth : "100%"} rounded="full" />
      ))}
    </div>
  );
}

/** A circular shimmer (avatar / node placeholder). */
export function SkeletonCircle({ size = 48, className = "" }: { size?: number; className?: string }) {
  return <Skeleton width={size} height={size} rounded="full" className={`flex-shrink-0 ${className}`} />;
}

/** A clay-card container with skeleton content inside (defaults to a
 * generic avatar + two text blocks if no children are supplied). */
export function SkeletonClayCard({
  className = "",
  children,
  padding = "16px 18px",
}: {
  className?: string;
  children?: ReactNode;
  padding?: number | string;
}) {
  return (
    <div className={`clay-card ${className}`} style={{ padding }} aria-hidden>
      {children ?? (
        <>
          <div className="flex items-center gap-3">
            <SkeletonCircle size={40} />
            <div className="flex-1">
              <SkeletonText lines={2} lastWidth="45%" />
            </div>
          </div>
          <div className="mt-4">
            <SkeletonText lines={2} lastWidth="70%" />
          </div>
        </>
      )}
    </div>
  );
}

export type SkeletonVariant = "kpi" | "student-card" | "mastery-cell";

export function SkeletonCard({ variant = "kpi", className = "" }: { variant?: SkeletonVariant; className?: string }) {
  if (variant === "mastery-cell") {
    return <div className={`shimmer rounded-lg ${className}`} style={{ minHeight: 38 }} aria-hidden />;
  }

  if (variant === "student-card") {
    return (
      <div
        className={`rounded-2xl bg-surface p-3.5 border-2 border-outline ${className}`}
        style={{ boxShadow: "var(--shadow-clay)" }}
        aria-hidden
      >
        <div className="flex items-center gap-2.5">
          <Skeleton width={36} height={36} rounded={12} className="flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton width="65%" height={13} />
            <Skeleton width="40%" height={9} />
          </div>
          <Skeleton width={34} height={22} />
        </div>
        <div className="flex gap-[3px] mt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={7} rounded="full" style={{ flex: 1 }} />
          ))}
        </div>
        <div className="mt-3">
          <Skeleton width="55%" height={10} />
        </div>
      </div>
    );
  }

  // kpi
  return (
    <div className={`clay-card ${className}`} style={{ padding: "14px 15px" }} aria-hidden>
      <div className="flex items-start justify-between gap-2.5">
        <Skeleton width={34} height={34} rounded={12} />
        <Skeleton width={38} height={16} />
      </div>
      <div className="mt-3">
        <Skeleton width="52%" height={26} />
      </div>
      <div className="flex items-end justify-between gap-2 mt-2">
        <Skeleton width="38%" height={11} />
        <Skeleton width={54} height={18} />
      </div>
    </div>
  );
}

export default Skeleton;
