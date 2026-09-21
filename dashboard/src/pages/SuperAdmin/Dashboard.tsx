import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  MessageSquare,
  TriangleAlert,
  Clock3,
} from 'lucide-react';
import { PageHeader, SectionCard, StatsCard } from '@/components';
import { Button } from '@/components/ui/button';

type SubscriptionSummary = {
  status?: string | null;
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
};

type SchoolRow = {
  id: number;
  name: string;
  subscription?: SubscriptionSummary | null;
};

const DAY_MS = 86_400_000;
const SOON_DAYS = 14;

function daysUntil(iso: string | null | undefined) {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / DAY_MS);
}

export default function SuperAdminDashboard() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{ data: SchoolRow[] }>('/api/schools');
      setSchools(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let trialing = 0;
    let pastDue = 0;
    let expiredOrLocked = 0;
    let trialsEndingSoon = 0;

    for (const school of schools) {
      const status = school.subscription?.status ?? null;
      if (status === 'trialing') {
        trialing += 1;
        const days = daysUntil(school.subscription?.trial_ends_at);
        if (days !== null && days >= 0 && days <= SOON_DAYS) trialsEndingSoon += 1;
      } else if (status === 'past_due') {
        pastDue += 1;
      } else if (status === 'expired' || status === 'suspended' || status === 'cancelled') {
        expiredOrLocked += 1;
      }
    }

    return {
      total: schools.length,
      trialing,
      pastDue,
      expiredOrLocked,
      trialsEndingSoon,
      attention: pastDue + expiredOrLocked + trialsEndingSoon,
    };
  }, [schools]);

  const links = [
    {
      title: 'Schools',
      description: 'Create tenants and edit branding, billing, admins, and SMS.',
      href: '/super_admin/settings/school',
      icon: Building2,
      action: 'Open schools',
    },
    {
      title: 'Exam types',
      description: 'Global exam catalog and which types each school can use.',
      href: '/super_admin/settings/exams',
      icon: ClipboardList,
      action: 'Open exam types',
    },
    {
      title: 'SMS',
      description: 'Shared balance and per-school provider setup.',
      href: '/super_admin/settings/sms',
      icon: MessageSquare,
      action: 'Open SMS',
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Overview"
        description="Fleet health across all school tenants."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Schools" value={stats.total} color="blue" icon={<Building2 size={20} />} loading={loading} />
        <StatsCard
          label="On free trial"
          value={stats.trialing}
          color="default"
          icon={<Clock3 size={20} />}
          loading={loading}
        />
        <StatsCard
          label="Trials ending ≤14d"
          value={stats.trialsEndingSoon}
          color={stats.trialsEndingSoon > 0 ? 'amber' : 'default'}
          icon={<Clock3 size={20} />}
          loading={loading}
        />
        <StatsCard
          label="Needs attention"
          value={stats.attention}
          color={stats.attention > 0 ? 'amber' : 'default'}
          icon={<TriangleAlert size={20} />}
          loading={loading}
        />
      </div>

      <p className="text-muted-foreground -mt-2 text-xs">
        Needs attention = past due + locked/expired/suspended/cancelled + trials ending within 14
        days ({stats.pastDue} past due, {stats.expiredOrLocked} locked).
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ title, description, href, icon: Icon, action }) => (
          <SectionCard key={href} title={title} icon={<Icon size={20} />}>
            <p className="text-muted-foreground mb-4 text-sm">{description}</p>
            <Button asChild className="w-full sm:w-auto">
              <Link to={href}>
                {action}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
