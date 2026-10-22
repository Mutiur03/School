/** Port of SkippedAlert in dashboard/src/pages/Admin/PromotionPreviewDialog.tsx: who is left out, and how to fix it. */
import { View } from 'react-native';
import { Notice } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import type { SkippedStudent } from '@/lib/api';

const REASON: Record<SkippedStudent['reason'], { title: string; fix: string }> = {
  held: { title: 'Result held', fix: 'Release their result on this page to include them.' },
  no_result: {
    title: 'No result yet',
    fix: 'Generate results or set Passed/Failed for them first.',
  },
};

export function SkippedStudents({
  students,
  action,
}: {
  students: readonly SkippedStudent[];
  action: 'promoted' | 'graduated';
}) {
  if (!students.length) return null;
  return (
    <Notice
      title={`${students.length} student${students.length === 1 ? '' : 's'} will not be ${action}.`}
    >
      <View className="gap-2">
        <Text size="sm" className="text-amber-800">
          Inactive (TC) students are never included and are not counted here.
        </Text>
        {(Object.keys(REASON) as SkippedStudent['reason'][]).map((reason) => {
          const list = students.filter((s) => s.reason === reason);
          if (!list.length) return null;
          return (
            <View key={reason} className="gap-0.5">
              <Text size="sm" className="text-amber-800">
                <Text size="sm" weight="semibold" className="text-amber-800">
                  {`${REASON[reason].title} (${list.length}): `}
                </Text>
                {REASON[reason].fix}
              </Text>
              {list.map((s) => (
                <Text key={s.enrollment_id} size="xs" className="pl-3 text-amber-800">
                  {`• ${s.name} — class ${s.class}${s.section}, roll ${s.roll}`}
                </Text>
              ))}
            </View>
          );
        })}
      </View>
    </Notice>
  );
}
