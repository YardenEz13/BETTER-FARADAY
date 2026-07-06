/**
 * ClaySkeleton — clay-shaped shimmer loading primitives.
 *
 * Surface-coloured placeholders swept by the shared `.shimmer` gradient
 * (defined in index.css). The sweep is automatically frozen under
 * `prefers-reduced-motion: reduce` by the global rule, so these render as
 * static clay blocks for motion-sensitive users.
 *
 * Radii/borders mirror the clay system (`.clay-card`, `--shadow-clay`). Purely
 * presentational — always `aria-hidden`.
 */

type Sizeable = number | string;

/** A single clay-shaped shimmer block. */
export function SkeletonBlock({
  width = "100%",
  height = 16,
  rounded = 12,
  className = "",
  style,
}: {
  width?: Sizeable;
  height?: Sizeable;
  rounded?: Sizeable;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`shimmer ${className}`}
      style={{ width, height, borderRadius: rounded, ...style }}
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
  lastWidth?: Sizeable;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`} style={{ gap }} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? lastWidth : "100%"}
          rounded={99}
        />
      ))}
    </div>
  );
}

/** A circular shimmer (avatar / node placeholder). */
export function SkeletonCircle({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`shimmer flex-shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: "50%" }}
      aria-hidden
    />
  );
}

/** A clay-card container with skeleton content inside. */
export function SkeletonClayCard({
  className = "",
  children,
  padding = "16px 18px",
}: {
  className?: string;
  children?: React.ReactNode;
  padding?: Sizeable;
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

const ClaySkeleton = {
  Block: SkeletonBlock,
  Text: SkeletonText,
  Circle: SkeletonCircle,
  Card: SkeletonClayCard,
};

export default ClaySkeleton;
