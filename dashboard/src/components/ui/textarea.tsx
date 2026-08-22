import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Base
        'w-full resize-none rounded-lg border px-3 py-2 text-sm transition-[color,box-shadow] outline-none',
        // Colors (light + dark)
        'bg-white dark:bg-gray-700',
        'border-border dark:border-gray-600',
        'text-gray-900 dark:text-white',
        'dark:placeholder:text-muted-foreground placeholder:text-gray-400',
        // Focus
        'focus:ring-primary/20 focus:border-transparent focus:ring-2',
        // Disabled
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Validation
        'aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-400',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
