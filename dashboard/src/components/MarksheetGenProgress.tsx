import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isMarksheetGenComplete,
  isMarksheetQueueActive,
  formatBundleScope,
  type MarksheetGenStatus,
} from '@/queries/marks.queries';

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
  const bundleQueueActive = status.bundles.pending + status.bundles.generating > 0;
  const staleItems = status.bundles.staleItems ?? [];
  const showBundleSection =
    showBundles && (status.bundles.total > 0 || bundleStale > 0 || bundleQueueActive);

  if (!showStudentProgress) {
    if (!showBundleSection) return null;
    return (
      <div className={cn('space-y-2', className)}>
        {bundleQueueActive && (
          <p className="text-muted-foreground text-xs">
            Class bundles generating… {status.bundles.done}/{status.bundles.total}
          </p>
        )}
        {bundleStale > 0 && !bundleQueueActive && staleItems.length > 0 && (
          <div className="space-y-0.5 text-xs text-amber-600 dark:text-amber-500">
            <p className="font-medium">Outdated — refresh on download:</p>
            <ul className="list-disc pl-4">
              {staleItems.map((item) => (
                <li key={`${item.class}-${item.section}`}>{formatBundleScope(item)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const pct = Math.round((status.done / status.total) * 100);
  const complete = isMarksheetGenComplete(status);
  const inProgress = isMarksheetQueueActive(status);
  const studentInProgress = status.pending + status.generating > 0;
  const bundleAllFresh =
    status.bundles.total > 0 &&
    !bundleQueueActive &&
    bundleStale === 0 &&
    status.bundles.done >= status.bundles.total;

  if (compact) {
    const label = complete
      ? 'Marksheets ready'
      : bundleQueueActive && !studentInProgress
        ? 'Class bundles'
        : 'Generating marksheets';
    const countLabel =
      bundleQueueActive && !studentInProgress
        ? `${status.bundles.done}/${status.bundles.total}`
        : `${status.done}/${status.total}`;
    const barPct =
      bundleQueueActive && !studentInProgress && status.bundles.total > 0
        ? Math.round((status.bundles.done / status.bundles.total) * 100)
        : pct;
    return (
      <div className={cn('mt-2 w-40', className)}>
        <div className="text-muted-foreground mb-0.5 flex justify-between text-[10px] font-medium">
          <span>{label}</span>
          <span className="tabular-nums">{countLabel}</span>
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full transition-[width,background-color] duration-500',
              complete ? 'bg-green-500' : 'bg-primary',
            )}
            style={{ width: `${barPct}%` }}
          />
        </div>
        {status.failed > 0 && (
          <div className="text-destructive mt-0.5 text-[10px]">{status.failed} failed</div>
        )}
        {bundleQueueActive && studentInProgress && status.bundles.total > 0 && (
          <div className="text-muted-foreground mt-0.5 text-[10px] tabular-nums">
            Bundles {status.bundles.done}/{status.bundles.total}
          </div>
        )}
        {bundleStale > 0 && !bundleQueueActive && staleItems.length > 0 && (
          <ul className="mt-1 max-w-44 list-disc space-y-0.5 pl-3 text-[10px] text-amber-600 dark:text-amber-500">
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
    <div className={cn('border-border bg-muted/30 space-y-3 rounded-lg border p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {!complete && inProgress && (
            <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
          )}
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">
              {complete
                ? 'Marksheets ready'
                : bundleQueueActive && !studentInProgress
                  ? 'Generating class bundles in background'
                  : 'Generating marksheets in background'}
            </p>
            {!complete && inProgress && (
              <p className="text-muted-foreground text-xs">
                Downloads wait for a fresh PDF — this may take a minute.
              </p>
            )}
          </div>
        </div>
        <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
          {bundleQueueActive && !studentInProgress
            ? `${status.bundles.done}/${status.bundles.total}`
            : `${status.done}/${status.total}`}
        </span>
      </div>

      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-[width,background-color] duration-500',
            complete ? 'bg-green-500' : 'bg-primary',
          )}
          style={{
            width: `${
              bundleQueueActive && !studentInProgress && status.bundles.total > 0
                ? Math.round((status.bundles.done / status.bundles.total) * 100)
                : pct
            }%`,
          }}
        />
      </div>

      {showBundleSection && (
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              {bundleQueueActive
                ? 'Class bundles generating'
                : bundleStale > 0
                  ? 'Class bundles outdated'
                  : bundleAllFresh
                    ? 'Class bundles ready'
                    : 'Class bundles'}
            </span>
            {status.bundles.total > 0 && (
              <span className="tabular-nums">
                {status.bundles.done}/{status.bundles.total}
              </span>
            )}
          </div>
          {bundleStale > 0 && !bundleQueueActive && staleItems.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-600 dark:text-amber-500">
              {staleItems.map((item) => (
                <li key={`${item.class}-${item.section}`}>
                  {formatBundleScope(item)} — refreshes on download
                </li>
              ))}
            </ul>
          )}
          {status.bundles.failed > 0 && (
            <div className="text-destructive space-y-1 text-xs">
              <p>
                {status.bundles.failed} bundle
                {status.bundles.failed === 1 ? '' : 's'} failed to generate
              </p>
              {(status.bundles.failedItems?.length ?? 0) > 0 && (
                <ul className="list-disc pl-4">
                  {status.bundles.failedItems!.map((item) => (
                    <li key={`fail-${item.class}-${item.section}`}>
                      {formatBundleScope(item)}
                      {item.error ? ` — ${item.error}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {status.failed > 0 && (
        <p className="text-destructive text-xs">
          {status.failed} marksheet{status.failed === 1 ? '' : 's'} failed to generate
        </p>
      )}
    </div>
  );
}
