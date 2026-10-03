import React from 'react';
import { cn } from '@/lib/utils';
import { Eye, Pencil, Trash2, Upload, RotateCw } from 'lucide-react';

type ActionVariant = 'blue' | 'emerald' | 'gray' | 'red' | 'amber';
type ActionType = 'view' | 'edit' | 'delete' | 'photo' | 'reactivate';

// Quiet ghost buttons: neutral at rest, colour only on hover so rows of actions don't shout.
const variantClasses: Record<ActionVariant, string> = {
  blue: 'hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300',
  emerald: 'hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300',
  gray: 'hover:bg-muted hover:text-foreground',
  red: 'hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300',
  amber: 'hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300',
};

const actionDefaults: Record<
  ActionType,
  { variant: ActionVariant; icon: React.ReactNode; label: string }
> = {
  view: { variant: 'blue', icon: <Eye size={14} />, label: 'View' },
  edit: { variant: 'emerald', icon: <Pencil size={14} />, label: 'Edit' },
  delete: { variant: 'red', icon: <Trash2 size={14} />, label: 'Delete' },
  photo: { variant: 'gray', icon: <Upload size={14} />, label: 'Photo' },
  reactivate: { variant: 'amber', icon: <RotateCw size={14} />, label: 'Reactivate' },
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action?: ActionType;
  variant?: ActionVariant;
  icon?: React.ReactNode;
  label?: string;
  asLabel?: boolean;
  htmlFor?: string;
  /** Show only the icon; the label becomes the tooltip and accessible name. */
  iconOnly?: boolean;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    { action, variant, icon, label, className, children, asLabel, htmlFor, iconOnly, ...props },
    ref,
  ) => {
    const defaults = action ? actionDefaults[action] : null;
    const resolvedVariant = variant ?? defaults?.variant ?? 'gray';
    const resolvedIcon = icon ?? defaults?.icon;
    const resolvedLabel = label ?? defaults?.label;

    const base = cn(
      'text-muted-foreground inline-flex cursor-pointer items-center gap-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
      iconOnly ? 'h-8 w-8 justify-center' : 'px-2.5 py-1.5',
    );

    const content = (
      <>
        {resolvedIcon}
        {iconOnly ? null : (resolvedLabel ?? children)}
      </>
    );
    const a11y = iconOnly ? { title: resolvedLabel, 'aria-label': resolvedLabel } : {};

    if (asLabel) {
      return (
        <label
          htmlFor={htmlFor}
          className={cn(base, variantClasses[resolvedVariant], className)}
          {...a11y}
        >
          {content}
        </label>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn(base, variantClasses[resolvedVariant], className)}
        {...a11y}
        {...props}
      >
        {content}
      </button>
    );
  },
);

ActionButton.displayName = 'ActionButton';

export default ActionButton;
