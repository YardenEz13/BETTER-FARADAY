/**
 * @deprecated Moved to ui/Skeleton — import from "./ui" instead.
 * Kept as a compat shim: `ClaySkeleton.Block` etc. still work, but new code
 * should use the named exports from "../components/ui".
 */
import { Skeleton, SkeletonText, SkeletonCircle, SkeletonClayCard } from "./ui/Skeleton";

export { SkeletonText, SkeletonCircle, SkeletonClayCard };
export { Skeleton as SkeletonBlock };

const ClaySkeleton = {
  Block: Skeleton,
  Text: SkeletonText,
  Circle: SkeletonCircle,
  Card: SkeletonClayCard,
};

export default ClaySkeleton;
