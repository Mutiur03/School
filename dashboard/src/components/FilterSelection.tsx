import React from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared native &lt;select&gt; styling for filter dropdowns */
export const filterSelectClassName =
  'border-input bg-background focus-visible:ring-primary h-9 w-full min-w-0 rounded-md border px-2 py-1.5 text-sm shadow-sm focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Optional compact styling for search inputs inside filter fields */
export const filterInputClassName = 'h-9 rounded-md px-2.5 py-1.5 text-sm';

/** Fields wrap; selects share a row (2–3 across) on mobile */
export const filterGridClassName = 'flex w-full min-w-0 flex-wrap items-center gap-2';

export const filterFieldClassName =
  'min-w-[calc(33.333%-0.375rem)] flex-1 basis-[calc(33.333%-0.375rem)] sm:basis-auto sm:min-w-[7.5rem] sm:max-w-[11rem]';

export const filterFieldWideClassName =
  'w-full min-w-0 basis-full sm:basis-auto sm:min-w-[12rem] sm:flex-[1.75] sm:max-w-[20rem]';

export interface FilterFieldProps {
  label: string;
  htmlFor?: string;
  className?: string;
  /** Wider field for search — full width on mobile */
  wide?: boolean;
  children: React.ReactNode;
}

export function FilterField({ label, htmlFor, className, wide, children }: FilterFieldProps) {
  return (
    <div className={cn(wide ? filterFieldWideClassName : filterFieldClassName, className)}>
      <label htmlFor={htmlFor} className="sr-only">
        {label}
      </label>
      {children}
    </div>
  );
}

export interface FilterSelectionProps {
  children: React.ReactNode;
  gridClassName?: string;
  className?: string;
  headerAction?: React.ReactNode;
}

/**
 * Compact filter bar.
 * Mobile: search full-width → selects in one row → actions full-width.
 * Desktop: title + fields + actions on one line when space allows.
 */
export function FilterSelection({
  children,
  gridClassName = filterGridClassName,
  className,
  headerAction,
}: FilterSelectionProps) {
  return (
    <div
      className={cn(
        'bg-card border-border rounded-xl border px-3 py-2.5 shadow-sm sm:px-4',
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <Filter size={18} className="text-primary shrink-0" />
          <span className="text-foreground text-sm font-semibold whitespace-nowrap">
            Filter Selection
          </span>
        </div>

        <div className={cn(gridClassName, 'min-w-0 flex-1')}>{children}</div>

        {headerAction ? (
          <div className="flex w-full shrink-0 gap-2 sm:w-auto [&_button]:min-w-0 [&_button]:flex-1 [&_button]:justify-center [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs sm:[&_button]:flex-initial sm:[&_button]:text-sm [&>*]:flex [&>*]:w-full [&>*]:flex-1 [&>*]:gap-2 sm:[&>*]:w-auto sm:[&>*]:flex-initial">
            {headerAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default FilterSelection;
