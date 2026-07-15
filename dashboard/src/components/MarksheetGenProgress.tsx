import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isMarksheetGenComplete,
  formatBundleScope,
  type MarksheetGenStatus,
} from "@/queries/marks.queries";

interface MarksheetGenProgressProps {
  status: MarksheetGenStatus | null | undefined;
  compact?: boolean;
  className?: string;
  showBundles?: boolean;
  /** When false, only bundle stale / queue info is shown (student bar hidden). */
  showStudentProgress?: boolean;
}

export function MarksheetGenProgress({
  status,
  compact = false,
  className,
  showBundles = true,
  showStudentProgress = true,
}: MarksheetGenProgressProps) {
  if (!status || status.total === 0) return null;

  const bundleStale = status.bundles.stale ?? 0;
  const bundleQueueActive =
    status.bundles.pending + status.bundles.generating > 0;
  const staleItems = status.bundles.staleItems ?? [];
  const showBundleSection =
    showBundles &&
    (status.bundles.total > 0 || bundleStale > 0 || bundleQueueActive);

  if (!showStudentProgress) {
    if (!showBundleSection) return null;
    return (
      <div className={cn("space-y-2", className)}>
        {bundleQueueActive && (
          <p className="text-xs text-muted-foreground">
            Class bundles generating… {status.bundles.done}/
            {status.bundles.total}
          </p>
        )}
        {bundleStale > 0 && !bundleQueueActive && staleItems.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5">
            <p className="font-medium">Outdated — refresh on download:</p>
            <ul className="list-disc pl-4">
              {staleItems.map((item) => (
                <li key={`${item.class}-${item.section}`}>
                  {formatBundleScope(item)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const pct = Math.round((status.done / status.total) * 100);
  const complete = isMarksheetGenComplete(status);
  const inProgress = status.pending + status.generating > 0;
  const bundleAllFresh =
    status.bundles.total > 0 &&
    !bundleQueueActive &&
    bundleStale === 0 &&
    status.bundles.done >= status.bundles.total;

  if (compact) {
    return (
      <div className={cn("mt-2 w-40", className)}>
        <div className="flex justify-between text-[10px] font-medium text-muted-foreground mb-0.5">
          <span>
            {complete ? "Marksheets ready" : "Generating marksheets"}
          </span>
          <span className="tabular-nums">
            {status.done}/{status.total}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-500",
              complete ? "bg-green-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {status.failed > 0 && (
          <div className="text-[10px] text-destructive mt-0.5">
            {status.failed} failed
          </div>
        )}
        {bundleStale > 0 && !bundleQueueActive && staleItems.length > 0 && (
          <ul
            className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 list-disc pl-3 space-y-0.5 max-w-44"
          >
            {staleItems.map((item) => (
              <li key={`${item.class}-${item.section}`} className="leading-tight">
                {formatBundleScope(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {!complete && inProgress && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {complete
                ? "Marksheets ready"
                : "Generating marksheets in background"}
            </p>
            {!complete && inProgress && (
              <p className="text-xs text-muted-foreground">
                Downloads wait for a fresh PDF — this may take a minute.
              </p>
            )}
          </div>
        </div>
        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
          {status.done}/{status.total}
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-500",
            complete ? "bg-green-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {showBundleSection && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {bundleQueueActive
                ? "Class bundles generating"
                : bundleStale > 0
                  ? "Class bundles outdated"
                  : bundleAllFresh
                    ? "Class bundles ready"
                    : "Class bundles"}
            </span>
            {status.bundles.total > 0 && (
              <span className="tabular-nums">
                {status.bundles.done}/{status.bundles.total}
              </span>
            )}
          </div>
          {bundleStale > 0 && !bundleQueueActive && staleItems.length > 0 && (
            <ul className="text-xs text-amber-600 dark:text-amber-500 list-disc pl-4 space-y-0.5">
              {staleItems.map((item) => (
                <li key={`${item.class}-${item.section}`}>
                  {formatBundleScope(item)} — refreshes on download
                </li>
              ))}
            </ul>
          )}
          {status.bundles.failed > 0 && (
            <p className="text-xs text-destructive">
              {status.bundles.failed} bundle
              {status.bundles.failed === 1 ? "" : "s"} failed to generate
            </p>
          )}
        </div>
      )}

      {status.failed > 0 && (
        <p className="text-xs text-destructive">
          {status.failed} marksheet{status.failed === 1 ? "" : "s"} failed to generate
        </p>
      )}
    </div>
  );
}
