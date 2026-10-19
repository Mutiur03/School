/**
 * Teacher home, replicating dashboard/src/pages/Teachers/TeacherDashboard.tsx ("My Profile"):
 * photo (or initials), name, email, phone, designation, address and the digital signature, all
 * from the signed-in session. Expo addition: the classes the teacher is class teacher of this
 * year (the same session `levels` the marks pickers use).
 */
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Icon } from '@/components/ui/Icon';
import { User } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
import { fileUrl } from '@/features/student/components';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useSession } from '@/session/ApiProvider';
import { initials, teacherProfile } from './profile';
import { useClassScope } from './useClassScope';

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <Text size="sm">
      <Text size="sm" weight="medium">
        {label}:
      </Text>{' '}
      {value ?? '—'}
    </Text>
  );
}

export function TeacherProfileScreen() {
  const { user } = useSession();
  const t = teacherProfile(user);
  const scope = useClassScope();
  const mobile = useBreakpoint() === 'mobile';
  const year = new Date().getFullYear();
  const size = mobile ? 128 : 192;
  const photo = fileUrl(t?.image);
  const signature = fileUrl(t?.signature);
  const classes = scope?.label(year) ?? '';

  return (
    <PageLayout title="My Profile" description="Your teacher profile and contact information.">
      {t ? (
        <SectionCard title="Profile" icon={<Icon icon={User} size={20} />}>
          <View
            className={mobile ? 'items-center gap-6' : 'flex-row items-start gap-6'}
            testID="teacher-profile"
          >
            <View
              className="border-border bg-muted items-center justify-center overflow-hidden rounded-full border-4"
              style={{ width: size, height: size }}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  accessibilityLabel="Profile"
                  style={{ width: size, height: size }}
                  resizeMode="cover"
                />
              ) : (
                <Text weight="bold" color="mutedForeground" className="text-4xl">
                  {initials(t.name)}
                </Text>
              )}
            </View>
            <View className={mobile ? 'w-full gap-4' : 'min-w-0 flex-1 gap-4'}>
              <Text weight="bold" className="text-3xl">
                {t.name}
              </Text>
              <View className="gap-1">
                <Line label="Email" value={t.email || null} />
                <Line label="Phone" value={t.phone} />
                <Line label="Designation" value={t.designation} />
                <Line label="Class teacher of" value={classes || 'No class assigned this year'} />
              </View>
              <Text size="sm">
                <Text size="sm" weight="semibold">
                  Address:
                </Text>{' '}
                {t.address ?? 'Not specified'}
              </Text>
              {signature ? (
                <View className="border-border gap-2 border-t pt-6">
                  <Text size="xs" weight="bold" color="mutedForeground" className="uppercase">
                    Digital Signature
                  </Text>
                  <View className="border-border bg-muted/30 h-20 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed p-2">
                    <Image
                      source={{ uri: signature }}
                      accessibilityLabel="Teacher Signature"
                      style={{ width: 144, height: 64 }}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </SectionCard>
      ) : null}
    </PageLayout>
  );
}
