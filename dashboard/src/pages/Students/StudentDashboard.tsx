import { Link } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatsCard } from "@/components";
import { getFileUrl } from "@/lib/backend";
import {
  useStudentProfile,
  useStudentAttendance,
} from "@/queries/students.queries";
import {
  ClipboardList,
  User,
  CalendarDays,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import Loading from "@/components/Loading";

function StudentDashboard() {
  const { user } = useAuth();
  const student = user && user.role === "student" ? user : null;
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
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Student Dashboard"
        description="Your classes, records, and quick links."
      />

      <section
        className="rounded-2xl border border-border bg-muted/30 p-6 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {displayProfile?.image || student.image ? (
            <img
              src={getFileUrl(displayProfile?.image ?? student.image ?? "")}
              alt={student.name}
              className="w-24 aspect-[7/9] object-cover rounded-md border border-border shadow-sm"
            />
          ) : (
            <div className="w-24 aspect-[7/9] rounded-md border border-border bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground">
              {student.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">Welcome back</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              {student.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Login ID {student.login_id}
            </p>

            {displayProfile ? (
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary">Class {displayProfile.class}</Badge>
                <Badge variant="secondary">Section {displayProfile.section}</Badge>
                <Badge variant="secondary">Roll {displayProfile.roll}</Badge>
                {displayProfile.group ? (
                  <Badge variant="outline">{displayProfile.group}</Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">This month&apos;s attendance</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            value={stats?.attendanceRate != null ? `${stats.attendanceRate}%` : "—"}
            color="indigo"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={attendanceLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/student/profile"
          className="group rounded-xl border border-border p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold group-hover:text-primary transition-colors">
                View full profile
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Personal details, parents&apos; contact, and address on file.
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/student/profile?tab=attendance"
          className="group rounded-xl border border-border p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold group-hover:text-primary transition-colors">
                Attendance record
              </p>
              <p className="text-sm text-muted-foreground mt-1">
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
