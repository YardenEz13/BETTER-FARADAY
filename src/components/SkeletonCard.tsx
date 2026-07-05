/**
 * Skeleton placeholders matching the clay-card shape, swept by the `.shimmer`
 * gradient while real data loads. Purely presentational.
 */
export type SkeletonVariant = "kpi" | "student-card" | "mastery-cell";

function Bar({ w, h = 12, rounded = 8 }: { w: number | string; h?: number; rounded?: number }) {
  return <div className="shimmer" style={{ width: w, height: h, borderRadius: rounded }} />;
}

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
          <div className="shimmer rounded-xl flex-shrink-0" style={{ width: 36, height: 36 }} />
          <div className="flex-1 flex flex-col gap-1.5">
            <Bar w="65%" h={13} />
            <Bar w="40%" h={9} />
          </div>
          <Bar w={34} h={22} />
        </div>
        <div className="flex gap-[3px] mt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ flex: 1, height: 7, borderRadius: 99 }} />
          ))}
        </div>
        <div className="mt-3">
          <Bar w="55%" h={10} />
        </div>
      </div>
    );
  }

  // kpi
  return (
    <div className={`clay-card ${className}`} style={{ padding: "14px 15px" }} aria-hidden>
      <div className="flex items-start justify-between gap-2.5">
        <div className="shimmer rounded-xl" style={{ width: 34, height: 34 }} />
        <Bar w={38} h={16} />
      </div>
      <div className="mt-3">
        <Bar w="52%" h={26} />
      </div>
      <div className="flex items-end justify-between gap-2 mt-2">
        <Bar w="38%" h={11} />
        <Bar w={54} h={18} />
      </div>
    </div>
  );
}

export default SkeletonCard;
