import { useCallback, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { AlertTriangle, CreditCard, Loader2, LockKeyhole, LogOut, RefreshCw } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import type { SubscriptionAccess } from '@/types/billing';

type TenantRole = 'admin' | 'teacher' | 'student';

function LockedScreen({ role }: { role: TenantRole }) {
  const { logout } = useAuth();
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-slate-950">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
          <LockKeyhole className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Subscription access locked</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          The annual subscription and its 10-day grace period have ended. Contact your school
          administrator to renew access.
        </p>
        {role === 'admin' ? (
          <Button asChild className="mt-6">
            <Link to="/admin/settings/billing">
              <CreditCard className="mr-2 h-4 w-4" /> View billing
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" className="mt-6" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        )}
      </div>
    </main>
  );
}

export default function SubscriptionGate({
  role,
  children,
}: {
  role: TenantRole;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [access, setAccess] = useState<SubscriptionAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadAccess = useCallback(async () => {
    try {
      const response = await axios.get<{ data: SubscriptionAccess }>(
        '/api/schools/subscription-access',
      );
      setAccess(response.data.data);
      setFailed(false);
    } catch (error) {
      // 402 with payload still means "locked" — keep the session, show lock UI.
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 402 &&
        error.response.data?.data
      ) {
        setAccess(error.response.data.data);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccess();
    const interval = window.setInterval(loadAccess, 60_000);
    const onLocked = (event: Event) => {
      const detail = (event as CustomEvent<SubscriptionAccess>).detail;
      if (detail) setAccess(detail);
    };
    window.addEventListener('subscription-locked', onLocked);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('subscription-locked', onLocked);
    };
  }, [loadAccess, user?.id]);

  if (loading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (failed || !access) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-3 text-lg font-semibold">Unable to verify subscription</h1>
          <p className="text-muted-foreground mt-2 text-sm">Check your connection and try again.</p>
          <Button type="button" variant="outline" className="mt-5" onClick={loadAccess}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </div>
      </main>
    );
  }

  if (access.is_locked) {
    if (role === 'admin' && location.pathname !== '/admin/settings/billing') {
      return <Navigate to="/admin/settings/billing" replace />;
    }
    if (role !== 'admin') return <LockedScreen role={role} />;
  }

  return (
    <>
      {children}
      {access.access_state === 'grace' ? (
        <aside className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">
            {access.status === 'past_due' ? 'Payment overdue' : 'Subscription grace period'}
          </p>
          <p className="mt-1">
            {access.grace_days_remaining} day{access.grace_days_remaining === 1 ? '' : 's'} left
            before access locks.
          </p>
          {role === 'admin' ? (
            <Link
              className="mt-2 inline-block font-semibold underline"
              to="/admin/settings/billing"
            >
              View billing
            </Link>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
