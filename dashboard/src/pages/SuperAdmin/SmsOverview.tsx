import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  MessageSquare,
  RefreshCw,
  Search,
  ChevronRight,
  Wallet,
  ServerCog,
  Cloud,
  TriangleAlert,
} from 'lucide-react';
import { PageHeader, SectionCard, SchoolLogo, StatsCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

interface SchoolSmsRow {
  school_id: number;
  school_name: string;
  logo?: string | null;
  configured: boolean;
  self_hosted: boolean;
  is_active: boolean;
  service_type: string | null;
  sender_id: string | null;
  estimated_sms: number | null;
  balance_message?: string | null;
}

interface SmsOverviewResponse {
  system: { estimated_sms: number | null; message?: string };
  schools: SchoolSmsRow[];
}

const LOW_BALANCE_THRESHOLD = 200;

function apiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || fallback;
  return fallback;
}

function ModeBadge({ row }: { row: SchoolSmsRow }) {
  if (!row.configured) {
    return (
      <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
        Not configured
      </span>
    );
  }
  if (row.self_hosted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <ServerCog size={12} aria-hidden="true" />
        Self-hosted
      </span>
    );
  }
  return (
    <span className="text-primary border-primary/20 bg-primary/10 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
      <Cloud size={12} aria-hidden="true" />
      Shared account
    </span>
  );
}

function SmsRowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-36" />
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-24 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-4 py-3 text-right">
        <Skeleton className="ml-auto h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-16 rounded-full" />
      </td>
      <td className="px-4 py-3" />
    </tr>
  );
}

export default function SmsOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<SmsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (hasLoadedOnce.current) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get<{ data: SmsOverviewResponse }>('/api/schools/sms-overview');
      setData(res.data.data);
    } catch (error) {
      setLoadError(true);
      toast.error(apiError(error, 'Could not load SMS overview'));
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const schools = data?.schools ?? [];

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.school_name.toLowerCase().includes(q));
  }, [schools, search]);

  const summary = useMemo(() => {
    const selfHosted = schools.filter((s) => s.self_hosted).length;
    const shared = schools.filter((s) => s.configured && !s.self_hosted).length;
    const needsAttention = schools.filter(
      (s) => !s.configured || (s.estimated_sms !== null && s.estimated_sms < LOW_BALANCE_THRESHOLD),
    ).length;
    return { selfHosted, shared, needsAttention };
  }, [schools]);

  const goToSchool = (schoolId: number) => {
    navigate(`/super_admin/settings/school?school=${schoolId}&tab=sms`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="SMS Management"
        description="Shared account balance and every school's SMS provider status."
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={loading || refreshing}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          Refresh
        </Button>
      </PageHeader>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load SMS overview</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Check your connection and try again.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Shared account balance"
          value={data?.system.estimated_sms ?? '—'}
          color="blue"
          icon={<Wallet size={20} aria-hidden="true" />}
          loading={loading}
        />
        <StatsCard
          label="Schools on shared account"
          value={summary.shared}
          color="default"
          icon={<Cloud size={20} aria-hidden="true" />}
          loading={loading}
        />
        <StatsCard
          label="Self-hosted schools"
          value={summary.selfHosted}
          color="emerald"
          icon={<ServerCog size={20} aria-hidden="true" />}
          loading={loading}
        />
        <StatsCard
          label="Needs attention"
          value={summary.needsAttention}
          color={summary.needsAttention > 0 ? 'amber' : 'default'}
          icon={<TriangleAlert size={20} aria-hidden="true" />}
          loading={loading}
        />
      </div>

      {data?.system.message && !loading && (
        <p className="text-muted-foreground -mt-2 text-xs">{data.system.message}</p>
      )}

      <SectionCard
        title="Schools"
        description={`${filteredSchools.length} of ${schools.length}`}
        icon={<MessageSquare size={20} aria-hidden="true" />}
        noPadding
        headerAction={
          <div className="relative w-full sm:w-64">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schools…"
              className="pl-9"
              aria-label="Search schools"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs font-medium">
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Sender ID</th>
                <th className="px-4 py-3 text-right font-medium">Est. SMS</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading && schools.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => <SmsRowSkeleton key={i} />)
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-4 py-10 text-center text-sm">
                    {search ? 'No schools match your search.' : 'No schools found.'}
                  </td>
                </tr>
              ) : (
                filteredSchools.map((row) => {
                  const low =
                    row.estimated_sms !== null && row.estimated_sms < LOW_BALANCE_THRESHOLD;
                  return (
                    <tr
                      key={row.school_id}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => goToSchool(row.school_id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <SchoolLogo logo={row.logo} className="h-8 w-8" />
                          <span className="truncate font-medium text-gray-900 dark:text-white">
                            {row.school_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ModeBadge row={row} />
                      </td>
                      <td className="text-muted-foreground px-4 py-3">{row.sender_id || '—'}</td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-medium tabular-nums',
                          low
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-900 dark:text-white',
                        )}
                      >
                        {row.estimated_sms ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight
                          className="text-muted-foreground ml-auto h-4 w-4"
                          aria-hidden="true"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
