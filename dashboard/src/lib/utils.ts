import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Local calendar date → yyyy-MM-dd (avoids UTC shift from toISOString). */
export const formatYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Parse date-only strings as local midnight (same idea as date-fns parseISO). */
export const parseLocalDate = (s: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
};

export const formatDay = (d: Date | string) =>
  (typeof d === 'string' ? parseLocalDate(d) : d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const formatDayLong = (d: Date | string) =>
  (typeof d === 'string' ? parseLocalDate(d) : d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export function getInitials(name: string | undefined): string {
  if (!name) return '👤';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '👤';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const formatDateWithTime = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

export const getErrorMessage = (error: any) => {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    // If it's Zod issues (array of objects with message property)
    if (typeof data.errors[0] === 'object' && data.errors[0].message) {
      return data.errors.map((err: any) => err.message).join('. ');
    }
    // If it's a simple array of strings
    return data.errors.join('. ');
  }
  return data?.message || error.message || 'Network error. Please try again.';
};
