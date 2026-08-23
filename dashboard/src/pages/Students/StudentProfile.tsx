import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, CalendarDays } from 'lucide-react';
import { PageHeader, SectionCard, TabNav } from '@/components';
import type { TabItem } from '@/components';
import Loading from '@/components/Loading';
import { StudentProfileView } from '@/components/students/StudentProfileView';
import { StudentAttendanceView } from '@/components/students/StudentAttendanceView';
import { useStudentProfile } from '@/queries/students.queries';

function StudentProfile() {
  const currentYear = new Date().getFullYear();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const activeTab = searchParams.get('tab') === 'attendance' ? 'attendance' : 'profile';

  const setActiveTab = (tabId: string) => {
    if (tabId === 'attendance') {
      setSearchParams({ tab: 'attendance' });
    } else {
      setSearchParams({});
    }
  };

  const { data: profile, isLoading, isError } = useStudentProfile(selectedYear);

  const tabs: TabItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="h-4 w-4" />,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <CalendarDays className="h-4 w-4" />,
    },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loading />
        <p className="text-muted-foreground mt-4 text-sm">Loading your profile…</p>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="p-6">
        <PageHeader title="My Profile" description="We could not load your profile right now." />
        <p className="text-muted-foreground text-sm">
          Try refreshing the page. If this keeps happening, contact your class teacher.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="My Profile"
        description="Your school record, contact details, and attendance history."
      >
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Academic year</span>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            aria-label="Academic year"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </PageHeader>

      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'profile' ? (
        <SectionCard
          title="Student information"
          icon={<User className="text-primary h-5 w-5" />}
          description="Details recorded by the school office."
        >
          <StudentProfileView student={profile} />
        </SectionCard>
      ) : (
        <SectionCard
          title="Attendance"
          icon={<CalendarDays className="text-primary h-5 w-5" />}
          description="See which days you were marked present, absent, or run awayed."
          noPadding
        >
          <div className="p-4 sm:p-6">
            <StudentAttendanceView key={selectedYear} initialYear={selectedYear} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default StudentProfile;
