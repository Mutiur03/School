/** Notice list helpers (dashboard/src/pages/Admin/Notice.tsx): search, newest-first, summary. */
import type { Notice } from '@/lib/api';
import { plural } from '@/features/admin/errors';
import { formatDay } from '@/features/holidays/model';

export const noticeDay = (n: Pick<Notice, 'created_at'>) => n.created_at.slice(0, 10);

export function filterNotices(list: readonly Notice[], query: string): Notice[] {
  const q = query.trim().toLowerCase();
  const out = q ? list.filter((n) => n.title.toLowerCase().includes(q)) : [...list];
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function noticeSummary(list: readonly Notice[]): string {
  const latest = list.reduce<string | null>(
    (max, n) => (!max || n.created_at > max ? n.created_at : max),
    null,
  );
  return [plural(list.length, 'notice'), latest ? `latest ${formatDay(latest.slice(0, 10))}` : null]
    .filter(Boolean)
    .join(' · ');
}
