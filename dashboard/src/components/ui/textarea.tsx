import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Base
        "w-full px-3 py-2 text-sm border rounded-lg outline-none transition-[color,box-shadow] resize-none",
        // Colors (light + dark)
        "bg-white dark:bg-gray-700",
        "border-border dark:border-gray-600",
        "text-gray-900 dark:text-white",
        "placeholder:text-gray-400 dark:placeholder:text-muted-foreground",
        // Focus
        "focus:ring-2 focus:ring-primary/20 focus:border-transparent",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Validation
        "aria-invalid:ring-2 aria-invalid:ring-red-400 aria-invalid:border-red-400",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
