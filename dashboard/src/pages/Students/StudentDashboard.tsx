import { Link } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, StatsCard } from '@/components';
import { getFileUrl } from '@/lib/backend';
import { useStudentProfile, useStudentAttendance } from '@/queries/students.queries';
import { ClipboardList, User, CalendarDays, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import Loading from '@/components/Loading';

function StudentDashboard() {
  const { user } = useAuth();
  const student = user && user.role === 'student' ? user : null;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const { data: profile, isLoading: profileLoading } = useStudentProfile(currentYear);
  const { data: attendance, isLoading: attendanceLoading } = useStudentAttendance({
    month: currentMonth,
    year: currentYear,
  });

  if (!student) return null;

  if (profileLoading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loading />
      </div>
    );
  }

  const displayProfile = profile ?? null;
  const stats = attendance?.stats;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader title="Student Dashboard" description="Your classes, records, and quick links." />

      <section className="border-border bg-muted/30 rounded-2xl border p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {displayProfile?.image || student.image ? (
            <img
              src={getFileUrl(displayProfile?.image ?? student.image ?? '')}
              alt={student.name}
              className="border-border aspect-[7/9] w-24 rounded-md border object-cover shadow-sm"
            />
          ) : (
            <div className="border-border bg-muted text-muted-foreground flex aspect-[7/9] w-24 items-center justify-center rounded-md border text-3xl font-bold">
              {student.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-primary text-sm font-medium">Welcome back</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{student.name}</h2>
            <p className="text-muted-foreground mt-1 text-sm">Login ID {student.login_id}</p>

            {displayProfile ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">Class {displayProfile.class}</Badge>
                <Badge variant="secondary">Section {displayProfile.section}</Badge>
                <Badge variant="secondary">Roll {displayProfile.roll}</Badge>
                {displayProfile.group ? (
                  <Badge variant="outline">{displayProfile.group}</Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild variant="default" className="gap-2">
              <Link to="/student/profile">
                <User className="h-4 w-4" />
                My profile
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/student/result">
                <ClipboardList className="h-4 w-4" />
                My results
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="text-primary h-4 w-4" />
          <h3 className="text-sm font-semibold">This month&apos;s attendance</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatsCard
            label="Present"
            value={stats?.present ?? 0}
            color="emerald"
            icon={<CheckCircle2 className="h-4 w-4" />}
            loading={attendanceLoading}
          />
          <StatsCard
            label="Absent"
            value={stats?.absent ?? 0}
            color="red"
            icon={<XCircle className="h-4 w-4" />}
            loading={attendanceLoading}
          />
          <StatsCard
            label="Marked days"
            value={stats?.total ?? 0}
            color="blue"
            icon={<CalendarDays className="h-4 w-4" />}
            loading={attendanceLoading}
          />
          <StatsCard
            label="Attendance rate"
            value={stats?.attendanceRate != null ? `${stats.attendanceRate}%` : '—'}
            color="indigo"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={attendanceLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/student/profile"
          className="group border-border hover:border-primary/40 hover:bg-primary/5 rounded-xl border p-5 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-lg p-2">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="group-hover:text-primary font-semibold transition-colors">
                View full profile
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Personal details, parents&apos; contact, and address on file.
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/student/profile?tab=attendance"
          className="group border-border hover:border-primary/40 hover:bg-primary/5 rounded-xl border p-5 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="group-hover:text-primary font-semibold transition-colors">
                Attendance record
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Monthly calendar and history of marked school days.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default StudentDashboard;
