import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TablePaginationProps = {
  page: number;
  totalPages: number;
  limit: number;
  loading?: boolean;
  totalFiltered?: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  limitOptions?: number[];
  className?: string;
};

export function TablePagination({
  page,
  totalPages,
  limit,
  loading,
  totalFiltered,
  onPageChange,
  onLimitChange,
  limitOptions = [25, 50, 100, 200],
  className,
}: TablePaginationProps) {
  if (totalPages <= 0 && !totalFiltered) return null;

  const currentPage = page;
  const maxVisible = 7;

  const pageButtons = (() => {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  })();

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="text-muted-foreground text-sm">
        {totalFiltered != null ? (
          <>
            <span className="tabular-nums">{totalFiltered.toLocaleString()}</span> total
            {totalPages > 0 ? (
              <>
                {' '}
                · page <span className="tabular-nums">{page}</span> of{' '}
                <span className="tabular-nums">{totalPages}</span>
              </>
            ) : null}
          </>
        ) : (
          <>
            Page <span className="tabular-nums">{page}</span> of{' '}
            <span className="tabular-nums">{totalPages}</span>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Rows</span>
          <select
            className="bg-card border-border text-foreground focus:ring-primary/30 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            value={limit}
            disabled={loading}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {limitOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </Button>
          {pageButtons.map((p, idx) =>
            p === '...' ? (
              <span key={idx} className="text-muted-foreground px-1 text-sm">
                …
              </span>
            ) : (
              <Button
                key={idx}
                type="button"
                size="sm"
                variant={p === currentPage ? 'default' : 'outline'}
                disabled={loading}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
