import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground placeholder:text-base selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-sm border bg-transparent text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "px-4 py-2 border border-border bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
        // "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      // className={cn(
      //   "w-full px-4 py-2 border border-border rounded-sm bg-popover text-popover-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
      //   className
      // )}
      {...props}
    />
  )
}

export { Input }
