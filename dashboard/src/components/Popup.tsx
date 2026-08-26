import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type PopupSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

interface PopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  size?: PopupSize;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const sizeClasses: Record<PopupSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  full: 'sm:max-w-5xl',
};

/** Thin Radix Dialog wrapper — keeps the old Popup API. */
const Popup = ({
  open,
  onOpenChange,
  children,
  size = 'full',
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: PopupProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'max-h-[90vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto p-0',
          sizeClasses[size],
          className,
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default Popup;
