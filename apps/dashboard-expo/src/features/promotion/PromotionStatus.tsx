/** Port of dashboard/src/pages/Admin/PromotionStatus.tsx: badges next to the session picker + the status panel above the steps. */
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  GraduationCap,
  Users,
  type LucideIcon,
} from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
import type { PromotionStats } from '@/lib/api';
import { cn } from '@/lib/utils';
import { runText } from './model';

function Chip({
  icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: 'green' | 'sky' | 'muted';
}) {
  const box =
    tone === 'green'
      ? 'border-emerald-300 bg-emerald-50'
      : tone === 'sky'
        ? 'border-sky-300 bg-sky-50'
        : 'border-border';
  const text =
    tone === 'green'
      ? 'text-emerald-800'
      : tone === 'sky'
        ? 'text-sky-800'
        : 'text-muted-foreground';
  return (
    <View
      className={cn('flex-row items-center gap-1 self-center rounded-full border px-2 py-0.5', box)}
    >
      <Icon icon={icon} size={14} color={tone === 'muted' ? 'mutedForeground' : undefined} />
      <Text size="xs" weight="medium" className={text}>
        {label}
      </Text>
    </View>
  );
}

/** Next to the session picker: is this session already promoted / graduated? */
export function PromotionBadges({ stats }: { stats?: PromotionStats }) {
  if (!stats) return null;
  return (
    <>
      {stats.promoted ? (
        <Chip icon={CheckCircle2} tone="green" label={`Promoted → ${stats.newYear}`} />
      ) : (
        <Chip icon={CircleDashed} tone="muted" label="Not promoted yet" />
      )}
      {stats.class10.graduated > 0 ? (
        <Chip icon={GraduationCap} tone="sky" label="Class 10 graduated" />
      ) : null}
    </>
  );
}

function Line({
  icon,
  title,
  meta,
  done,
}: {
  icon: LucideIcon;
  title: string;
  meta: string;
  done: boolean;
}) {
  return (
    <View className="min-w-[240px] flex-1 flex-row items-start gap-2.5">
      <View className="mt-0.5">
        <Icon icon={icon} size={20} color={done ? undefined : 'mutedForeground'} />
      </View>
      <View className="min-w-0 flex-1">
        <Text size="sm" weight="semibold" color={done ? undefined : 'mutedForeground'}>
          {title}
        </Text>
        <Text size="xs" color="mutedForeground" tabular>
          {meta}
        </Text>
      </View>
    </View>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Above the step cards: when each run happened, who ran it, and what still needs attention. */
export function PromotionStatus({ stats }: { stats?: PromotionStats }) {
  if (!stats || (!stats.promoted && stats.class10.graduated === 0)) return null;
  const { newYear, awaiting_roll: waiting, unplaced } = stats;
  const graduated = stats.class10.graduated;
  return (
    <SectionCard testID="promotion-status">
      <View className="flex-row flex-wrap gap-4">
        {stats.promoted ? (
          <Line
            done
            icon={CheckCircle2}
            title={`Classes 6–9 promoted to ${newYear}`}
            meta={`${runText(stats.promotion_run)} · ${stats.next_year_enrollments} active students in ${newYear}`}
          />
        ) : (
          <Line
            done={false}
            icon={Users}
            title="Classes 6–9 not promoted yet"
            meta="Generate pass/fail, then Review & promote."
          />
        )}
        {graduated > 0 ? (
          <Line
            done
            icon={GraduationCap}
            title={`Class 10 graduated · ${graduated} alumni`}
            meta={runText(stats.graduation_run)}
          />
        ) : (
          <Line
            done={false}
            icon={GraduationCap}
            title="Class 10 not graduated yet"
            meta="Review & graduate when class 10 results are final."
          />
        )}
      </View>
      {stats.promoted && (waiting > 0 || unplaced > 0) ? (
        <View className="border-border mt-3 gap-1.5 border-t pt-3">
          {waiting > 0 ? (
            <View className="flex-row gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text size="sm" className="min-w-0 flex-1 text-amber-800">
                {`${waiting} failed class-6 ${plural(waiting, 'student', 'students')} still ${plural(waiting, 'has', 'have')} no ${newYear} roll. Import the admissions, then tap Assign retained.`}
              </Text>
            </View>
          ) : null}
          {unplaced > 0 ? (
            <View className="flex-row gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text size="sm" className="min-w-0 flex-1 text-amber-800">
                {`${unplaced} ${plural(unplaced, 'student', 'students')} with a result ${plural(unplaced, 'has', 'have')} no ${newYear} class yet (results changed after promotion). Run Review & promote again — only auto-promoted students are renumbered.`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </SectionCard>
  );
}
