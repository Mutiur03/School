// import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  filterStaleBundlesForContext,
  formatBundleScope,
  type StaleBundleItem,
} from "@/queries/marks.queries";

interface BundleStalePreviewProps {
  items: StaleBundleItem[] | undefined;
  classNum?: string | number;
  sectionFilter?: string;
  /** inline = single line for table cells; default = block with list */
  variant?: "inline" | "block";
  className?: string;
}

export function BundleStalePreview({
  items,
  classNum,
  sectionFilter,
  variant = "block",
  className,
}: BundleStalePreviewProps) {
  const filtered = filterStaleBundlesForContext(items, classNum, sectionFilter);
  if (filtered.length === 0) return null;

  if (variant === "inline") {
    return (
      <ul
        className={cn(
          "text-[10px] text-amber-600 dark:text-amber-500 list-disc pl-3 space-y-0.5 leading-tight",
          className,
        )}
      >
        {filtered.map((item) => (
          <li key={`${item.class}-${item.section}`}>
            {formatBundleScope(item)} — refresh on download
          </li>
        ))}
      </ul>
    );
  }

  return (
    // <div
    //   className={cn(
    //     "flex items-start gap-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
    //     className,
    //   )}
    // >
    //   <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
    //   <div className="min-w-0 space-y-1">
    //     <p className="font-medium">
    //       {filtered.length === 1
    //         ? "This bundle will refresh on next download:"
    //         : "These bundles will refresh on next download:"}
    //     </p>
    //     <ul className="list-disc pl-4 space-y-0.5 text-amber-700 dark:text-amber-300">
    //       {filtered.map((item) => (
    //         <li key={`${item.class}-${item.section}`}>
    //           {formatBundleScope(item)}
    //         </li>
    //       ))}
    //     </ul>
    //   </div>
    // </div>
    <></>
  );
}
