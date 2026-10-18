import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Same helper as dashboard/src/lib/utils.ts: merge conditional class names, last one wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
