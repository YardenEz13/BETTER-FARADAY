import { ElectricAtom } from "./icons";
import type { ElectricTone } from "./icons";

/**
 * On-theme loading indicator: a slowly-rotating electric atom (its electron
 * already orbits) over an optional label. Drop-in replacement for the generic
 * border-spinner used across the app's data-loading states.
 */
export interface ElectricLoaderProps {
  size?: number;
  label?: string;
  tone?: ElectricTone;
  /** wrap in a full-height centered container (default true) */
  fullscreen?: boolean;
  className?: string;
}

export function ElectricLoader({
  size = 56,
  label,
  tone = "spark",
  fullscreen = true,
  className = "",
}: ElectricLoaderProps) {
  const inner = (
    <div className="flex flex-col items-center gap-4" dir="rtl">
      <span className="inline-flex animate-[spin_6s_linear_infinite]">
        <ElectricAtom size={size} glow={1} tone={tone} />
      </span>
      {label && (
        <span className="text-sm font-semibold text-primary tracking-widest">{label}</span>
      )}
    </div>
  );
  if (!fullscreen) return <div className={className}>{inner}</div>;
  return (
    <div className={`min-h-screen bg-background flex items-center justify-center ${className}`}>
      {inner}
    </div>
  );
}

export default ElectricLoader;
