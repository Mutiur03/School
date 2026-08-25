'use client';

import type { FieldErrors, FieldValues } from 'react-hook-form';

export type FormErrorItem = { id: string; message: string };

function humanize(path: string) {
  return path
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function flattenFieldErrors(errors: FieldErrors<FieldValues>, parent = ''): FormErrorItem[] {
  const items: FormErrorItem[] = [];
  for (const [key, value] of Object.entries(errors ?? {})) {
    if (!value || typeof value !== 'object') continue;
    const path = parent ? `${parent}.${key}` : key;
    if ('message' in value && value.message) {
      items.push({ id: path, message: `${humanize(path)}: ${String(value.message)}` });
    } else {
      items.push(...flattenFieldErrors(value as FieldErrors<FieldValues>, path));
    }
  }
  return items;
}

/** Pull messages from API error payloads (message / errors / error). */
export function extractApiErrorItems(data: unknown): FormErrorItem[] {
  if (!data || typeof data !== 'object') return [];
  const body = data as Record<string, unknown>;
  const items: FormErrorItem[] = [];

  if (Array.isArray(body.errors)) {
    for (const [i, e] of body.errors.entries()) {
      if (typeof e === 'string') {
        items.push({ id: `api-${i}`, message: e });
        continue;
      }
      if (!e || typeof e !== 'object') continue;
      const issue = e as { message?: string; path?: unknown; existingRecord?: unknown };
      if (!issue.message) continue;
      // Skip duplicate payloads — those use DuplicateWarning
      if (issue.existingRecord !== undefined) continue;
      const path = Array.isArray(issue.path)
        ? issue.path.join('.')
        : typeof issue.path === 'string'
          ? issue.path
          : '';
      items.push({
        id: path || `api-${i}`,
        message: path ? `${humanize(path)}: ${issue.message}` : String(issue.message),
      });
    }
  }

  if (items.length === 0) {
    if (
      typeof body.message === 'string' &&
      body.message &&
      body.message !== 'Duplicate information found'
    ) {
      items.push({ id: 'api', message: body.message });
    } else if (typeof body.error === 'string') {
      items.push({ id: 'api', message: body.error });
    } else if (body.error && typeof body.error === 'object' && 'message' in body.error) {
      items.push({ id: 'api', message: String((body.error as { message: unknown }).message) });
    }
  }

  return items;
}

type FormErrorSummaryProps = {
  errors?: FieldErrors<FieldValues>;
  apiErrors?: FormErrorItem[] | string | null;
};

function FormErrorSummary({ errors, apiErrors }: FormErrorSummaryProps) {
  const fieldItems = errors ? flattenFieldErrors(errors) : [];
  const fromApi: FormErrorItem[] =
    typeof apiErrors === 'string'
      ? apiErrors
        ? [{ id: 'api', message: apiErrors }]
        : []
      : (apiErrors ?? []);

  const seen = new Set<string>();
  const items = [...fromApi, ...fieldItems].filter((item) => {
    if (seen.has(item.message)) return false;
    seen.add(item.message);
    return true;
  });

  if (items.length === 0) return null;

  return (
    <div
      id="form-error-summary"
      role="alert"
      aria-live="assertive"
      className="mb-4 scroll-mt-28 rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 font-semibold text-red-800">
            Please fix the following {items.length === 1 ? 'error' : 'errors'}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {items.map((item) => (
              <li key={item.id}>{item.message}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default FormErrorSummary;

export function scrollToFormErrorSummary() {
  // After paint so the summary exists once RHF/API error state commits
  setTimeout(() => {
    const el = document.getElementById('form-error-summary');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 50);
}
