import React from 'react';
import { Download, Loader2, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ErrorMessage,
  Popup,
  SectionCard,
  filterSelectClassName as selectClass,
} from '@/components';
import ActionButton from '@/components/ActionButton';
import { cn, formatMoney } from '@/lib/utils';

/** Shared bits for the Accounts pages (same look as Holidays). */

export const Field = ({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn('space-y-1.5', className)}>
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
    {error && <ErrorMessage message={error} />}
  </div>
);

export const PageTitle = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) => (
  <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
    </div>
    {children && <div className="flex flex-wrap items-end gap-2">{children}</div>}
  </header>
);

export const FormPopup = ({
  open,
  onClose,
  title,
  onSubmit,
  saving,
  disabled,
  submitLabel,
  size = 'lg',
  footerNote,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  saving?: boolean;
  disabled?: boolean;
  submitLabel: string;
  size?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
  footerNote?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Popup open={open} onOpenChange={(o) => !o && onClose()} size={size} aria-label={title}>
    <form onSubmit={onSubmit} noValidate>
      <div className="border-border flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">{children}</div>
      <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
        {footerNote && <div className="mr-auto text-sm">{footerNote}</div>}
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || disabled}>
          {saving && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  </Popup>
);

export const RowActions = ({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  // modal={false}: items open dialogs; a modal menu would leave pointer-events locked
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <ActionButton iconOnly label="More actions" icon={<MoreHorizontal size={16} />} />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuLabel className="truncate normal-case tracking-normal">
        {label}
      </DropdownMenuLabel>
      <DropdownMenuItem onSelect={onEdit}>
        <Pencil /> Edit
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={onDelete}>
        <Trash2 /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const th =
  'text-foreground/70 bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wider';
export const td = 'px-4 py-2 text-sm';
export const num = 'px-4 py-2 text-right text-sm tabular-nums whitespace-nowrap';

/** Card + horizontally scrollable table with the standard header row. */
export const DataTable = ({
  columns,
  children,
  minWidth = '40rem',
  footer,
}: {
  columns: { label: string; className?: string }[];
  children: React.ReactNode;
  minWidth?: string;
  footer?: React.ReactNode;
}) => (
  <SectionCard noPadding className="min-w-0">
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <thead>
          <tr className="border-border border-b">
            {columns.map((c) => (
              <th key={c.label} className={cn(th, c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">{children}</tbody>
        {footer && <tfoot className="border-border bg-muted/50 border-t-2">{footer}</tfoot>}
      </table>
    </div>
  </SectionCard>
);

/** Loading / error / empty placeholder rows; renders nothing when there is data. */
export const StateRows = ({
  colSpan,
  loading,
  error,
  empty,
  emptyText,
}: {
  colSpan: number;
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyText: React.ReactNode;
}) => {
  if (loading)
    return Array.from({ length: 5 }, (_, i) => (
      <tr key={i}>
        <td colSpan={colSpan} className="px-4 py-2">
          <Skeleton className="h-8 w-full" />
        </td>
      </tr>
    ));
  if (!error && !empty) return null;
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted-foreground px-4 py-12 text-center text-sm">
        {error ? "Couldn't load data. Try again in a moment." : emptyText}
      </td>
    </tr>
  );
};

export const Money = ({ value, className }: { value: number; className?: string }) => (
  <span className={cn('tabular-nums', value < 0 && 'text-destructive', className)}>
    {formatMoney(value)}
  </span>
);

export const DateInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <label className="block space-y-1">
    <span className="text-muted-foreground block text-xs font-medium">{label}</span>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(selectClass, 'w-40')}
    />
  </label>
);

export const ExportButton = ({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) => (
  <Button type="button" variant="outline" onClick={onClick} disabled={disabled}>
    <Download /> Export Excel
  </Button>
);
