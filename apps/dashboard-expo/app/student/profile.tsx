/**
 * My Profile, replicating dashboard/src/pages/Students/StudentProfile.tsx (Profile tab) and
 * components/students/StudentProfileView.tsx: Academic year selector, the photo card (name,
 * Login ID, Class / Section / Roll / group / Stipend / Active badges) and the Personal, Contact
 * and Address sections. The web page's Attendance tab is the separate Attendance screen here.
 * Live data: GET /api/students/me?year (student only; the server takes the id from the token).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CalendarDays, User } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { fileUrl, Photo, ProfileBadges } from '@/features/student/components';
import { formatDate } from '@/features/student/format';
import { useMyProfile } from '@/features/student/hooks';
import { studentYears, type StudentProfile } from '@/lib/api';

const THIS_YEAR = new Date().getFullYear();

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View className="border-border flex-row justify-between gap-4 border-b py-2">
      <Text size="sm" color="mutedForeground">
        {label}
      </Text>
      <Text size="sm" weight="medium" className="shrink text-right">
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="border-border min-w-[260px] flex-1 rounded-lg border p-4">
      <Text
        size="xs"
        weight="semibold"
        caps
        color="mutedForeground"
        className="mb-2 tracking-wider"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function ProfileView({ p }: { p: StudentProfile }) {
  const address = [p.village, p.post_office, p.upazila, p.district].some(Boolean);
  return (
    <View className="gap-4">
      <View className="border-border bg-muted/30 flex-row flex-wrap items-start gap-5 rounded-xl border p-5">
        <Photo name={p.name} url={fileUrl(p.image)} width={112} />
        <View className="min-w-[200px] flex-1">
          <Text size="xl" weight="bold">
            {p.name}
          </Text>
          <Text size="sm" color="mutedForeground" tabular>
            Login ID {p.login_id}
          </Text>
          <ProfileBadges
            profile={p}
            extra={
              <>
                {p.has_stipend ? <Badge variant="outline" label="Stipend" /> : null}
                <StatusBadge status={p.available ? 'active' : 'inactive'} />
              </>
            }
          />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-4">
        <Section title="Personal">
          <InfoRow label="Date of birth" value={p.dob ? formatDate(p.dob) : null} />
          <InfoRow label="Religion" value={p.religion || 'N/A'} />
          <InfoRow label="Father's name" value={p.father_name} />
          <InfoRow label="Mother's name" value={p.mother_name} />
        </Section>
        <Section title="Contact">
          <InfoRow label="Father's phone" value={p.father_phone || 'N/A'} />
          <InfoRow label="Mother's phone" value={p.mother_phone || 'N/A'} />
        </Section>
      </View>
      {address ? (
        <Section title="Address">
          <InfoRow label="Village" value={p.village} />
          <InfoRow label="Post office" value={p.post_office} />
          <InfoRow label="Upazila" value={p.upazila} />
          <InfoRow label="District" value={p.district} />
        </Section>
      ) : null}
    </View>
  );
}

export default function StudentProfileScreen() {
  // The sessions this student was really enrolled in (the profile lists them). Until one is
  // chosen, the server's own pick for "now" decides: this year, else the latest enrollment.
  const base = useMyProfile(THIS_YEAR);
  const years = studentYears(
    (base.data?.enrollments ?? []).map((e) => e.year),
    THIS_YEAR,
  );
  const [picked, setYear] = useState<number | null>(null);
  const year = picked !== null && years.includes(picked) ? picked : (years[0] ?? THIS_YEAR);
  const q = useMyProfile(year);
  return (
    <PageLayout
      title="My Profile"
      description="Your school record, contact details, and attendance history."
      actions={
        <>
          <Select
            label="Academic year"
            size="sm"
            value={year}
            onChange={setYear}
            options={(years.length ? years : [year]).map((y) => ({
              value: y,
              label: `Academic year ${y}`,
            }))}
          />
          <Button
            variant="outline"
            size="sm"
            icon={CalendarDays}
            label="Attendance"
            onPress={() => router.navigate(`/student/attendance?year=${year}` as never)}
          />
        </>
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="We could not load your profile right now."
          message="Try refreshing the page. If this keeps happening, contact your class teacher."
          onRetry={() => void q.refetch()}
        />
      ) : (
        <SectionCard
          title="Student information"
          description="Details recorded by the school office."
          icon={<Icon icon={User} size={20} color="primary" />}
          testID="student-profile"
        >
          {q.data ? <ProfileView p={q.data} /> : <Skeleton height={240} />}
        </SectionCard>
      )}
    </PageLayout>
  );
}
