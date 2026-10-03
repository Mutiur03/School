import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SortOrder = 'asc' | 'desc';

interface ColumnHeaderMenuProps {
  label: string;
  /** Current sort on this column; omit `onSort` for columns that can't sort. */
  sortOrder?: SortOrder | null;
  onSort?: (order: SortOrder | null) => void;
  /** Checkbox filter. */
  options?: { value: string; label: string }[];
  selected?: string[];
  onSelectedChange?: (values: string[]) => void;
  /** Free-text filter box instead of checkboxes. */
  filterInput?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: 'text' | 'number';
  };
  align?: 'start' | 'end';
}

// Radix menus jump to items on typed letters; keep keystrokes inside the text boxes.
const keepKeys = (e: React.KeyboardEvent) => {
  if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();
};

/** Table header: label opens a filter menu; the arrow beside it toggles sort. */
export function ColumnHeaderMenu({
  label,
  sortOrder,
  onSort,
  options,
  selected = [],
  onSelectedChange,
  filterInput,
  align = 'start',
}: ColumnHeaderMenuProps) {
  const [query, setQuery] = useState('');
  const filterActive = selected.length > 0 || Boolean(filterInput?.value);
  const SortIcon =
    sortOrder === 'asc' ? ArrowUp : sortOrder === 'desc' ? ArrowDown : ChevronsUpDown;
  const q = query.trim().toLowerCase();
  const visible = options?.filter((o) => o.label.toLowerCase().includes(q)) ?? [];

  const toggle = (value: string) =>
    onSelectedChange?.(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  // Click cycles: unsorted → ascending → descending → unsorted.
  const nextSort: SortOrder | null =
    sortOrder === 'asc' ? 'desc' : sortOrder === 'desc' ? null : 'asc';
  const headerButton =
    'hover:bg-background hover:text-foreground focus-visible:ring-ring rounded transition-colors focus-visible:outline-none focus-visible:ring-2';

  return (
    <div className="-mx-1.5 inline-flex items-center gap-0.5">
      {/* Sort-only column: plain label, no filter menu. */}
      {!options && !filterInput ? (
        <span className="px-1.5 py-1">{label}</span>
      ) : (
        <DropdownMenu modal={false} onOpenChange={(open) => !open && setQuery('')}>
          <DropdownMenuTrigger
            className={cn(
              headerButton,
              'data-[state=open]:bg-background data-[state=open]:text-foreground inline-flex items-center gap-1.5 px-1.5 py-1 text-xs font-semibold uppercase tracking-wider',
              filterActive && 'text-foreground',
            )}
          >
            {label}
            <Filter
              className={cn(
                'h-3.5 w-3.5',
                filterActive ? 'fill-primary text-primary' : 'text-muted-foreground',
              )}
            />
            {filterActive && <span className="sr-only">(filtered)</span>}
          </DropdownMenuTrigger>

          <DropdownMenuContent align={align} className="w-60">
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            {options ? (
              <>
                <div className="max-h-56 overflow-y-auto">
                  {visible.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-1.5 text-sm">No matches</p>
                  ) : (
                    visible.map((o) => (
                      <DropdownMenuItem
                        key={o.value}
                        // Keep the menu open so several values can be ticked.
                        onSelect={(e) => {
                          e.preventDefault();
                          toggle(o.value);
                        }}
                      >
                        <input
                          type="checkbox"
                          readOnly
                          tabIndex={-1}
                          aria-hidden
                          checked={selected.includes(o.value)}
                          className="pointer-events-none h-4 w-4"
                        />
                        <span className="truncate">{o.label}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
                {options.length > 6 && (
                  <div className="p-1">
                    <Input
                      type="search"
                      aria-label={`Search ${label}`}
                      placeholder="Or search…"
                      className="h-8"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={keepKeys}
                    />
                  </div>
                )}
              </>
            ) : filterInput ? (
              <div className="p-1">
                <Input
                  type={filterInput.type === 'number' ? 'number' : 'search'}
                  inputMode={filterInput.type === 'number' ? 'numeric' : undefined}
                  min={filterInput.type === 'number' ? 1 : undefined}
                  aria-label={`Filter ${label}`}
                  placeholder={filterInput.placeholder}
                  className="h-8"
                  value={filterInput.value}
                  onChange={(e) => filterInput.onChange(e.target.value)}
                  onKeyDown={keepKeys}
                />
              </div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {onSort && (
        <button
          type="button"
          onClick={() => onSort(nextSort)}
          aria-label={`Sort by ${label}: ${
            sortOrder === 'asc' ? 'ascending' : sortOrder === 'desc' ? 'descending' : 'none'
          }`}
          title={
            nextSort === 'asc'
              ? 'Sort ascending'
              : nextSort === 'desc'
                ? 'Sort descending'
                : 'Clear sort'
          }
          className={cn(
            headerButton,
            'pointer-coarse:p-2.5 p-1',
            sortOrder ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <SortIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default ColumnHeaderMenu;
