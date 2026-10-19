/**
 * Session marksheet preview, replicating dashboard/src/pages/Admin/ShowMarkSheet.tsx
 * (/finalmarkSheet/:studentId/:year): the student's year result with previous / year-end /
 * total marks per subject, continuous assessment, totals, GPA, result and position, plus the
 * official PDF. Reached from Year-End Promotion ("Preview session marksheet").
 * Live data: GET /api/marks/students/:id/session?year (Nest; the server checks access),
 * PDF: GET /api/marksheets/students/:id/session?year.
 */
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Download } from '@/components/ui/icons';
import { ScrollView } from '@/components/ui/ScrollView';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useFileTasks } from '@/features/content/ui';
import { pdfFileName } from '@/lib/files/pdf-name';
import { sessionMarkHeads, type SessionMarksheet, type SessionRow } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const CELL = 'w-24 px-2 py-2';

function Cell({ value, tint, bold }: { value: string; tint?: boolean; bold?: boolean }) {
  return (
    <View className={cn(CELL, tint && 'bg-primary/5')}>
      <Text
        size="sm"
        tabular
        weight={bold ? 'semibold' : undefined}
        color={value === '-' ? 'mutedForeground' : undefined}
        className="text-center"
      >
        {value === '-' ? '—' : value}
      </Text>
    </View>
  );
}

export function sessionSummary(m: SessionMarksheet, year: string) {
  return [
    m.student.name || 'Unnamed student',
    `Class ${m.student.class}${m.student.section ? ` ${m.student.section}` : ''}`,
    `Roll ${m.student.roll}`,
    `Session ${m.student.year || year}`,
    m.position ? `Position ${m.position}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function SessionMarksheetScreen() {
  const { studentId, year } = useLocalSearchParams<{ studentId: string; year: string }>();
  const id = Number(studentId);
  const y = Number(year);
  const valid = Number.isInteger(id) && id > 0 && /^\d{4}$/.test(String(year));
  const { promotions } = useApi();
  const { resolution } = useTenant();
  const router = useRouter();
  const files = useFileTasks();
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'session-marksheet', id, y),
    queryFn: ({ signal }) => promotions.sessionPreview(id, y, signal),
    enabled: valid,
  });
  const m = q.data;
  const heads = m ? sessionMarkHeads(m) : [];
  const hasData = !!m && m.examRows.length > 0;

  const row = (r: SessionRow) => (
    <View key={r.subject} className="border-border bg-card flex-row border-b">
      <View className="w-44 px-3 py-2">
        <Text size="sm" weight="medium">
          {r.subject}
        </Text>
      </View>
      {[...r.marks, r.fullMark, r.passMark, r.grade, r.gp].map((v, i) => (
        <Cell key={i} value={v} tint={heads[i] === m?.yearEndExam} />
      ))}
    </View>
  );

  return (
    <PageLayout
      title="Marksheet"
      description={
        !valid
          ? 'Invalid student ID or year.'
          : q.isPending
            ? 'Loading…'
            : m
              ? sessionSummary(m, String(year))
              : 'Preview the student’s session result and download the official PDF.'
      }
      actions={
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            icon={ArrowLeft}
            label="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/promotion'))}
          />
          {hasData ? (
            <Button
              icon={Download}
              label={files.busy ? 'Downloading…' : 'Download PDF'}
              disabled={!!files.busy}
              onPress={() =>
                files.pdf(
                  'pdf',
                  () => promotions.sessionPdf(id, y),
                  pdfFileName(['session-marksheet', m!.student.name, y]),
                  'Failed to download PDF. Please try again.',
                )
              }
              testID="marksheet-pdf"
            />
          ) : null}
        </View>
      }
      onRefresh={valid ? () => void q.refetch() : undefined}
      refreshing={q.isRefetching}
    >
      {!valid ? (
        <EmptyState message="Invalid student ID or year." />
      ) : q.isError ? (
        <ErrorState
          title="Marks sheet not found"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending ? (
        <Skeleton height={280} />
      ) : !hasData || !m ? (
        <EmptyState message="No marksheet data available." />
      ) : (
        <SectionCard noPadding testID="session-marksheet">
          <ScrollView horizontal contentContainerClassName="min-w-full">
            <View className="flex-1">
              <View className="bg-muted border-border flex-row border-b">
                <View className="w-44 justify-end px-3 py-2">
                  <Text size="xs" weight="semibold" className="uppercase text-gray-700">
                    Subject
                  </Text>
                </View>
                {[...heads, 'Full', 'Pass', 'Grade', 'GP'].map((h, i) => (
                  <View key={`${h}-${i}`} className={cn(CELL, 'justify-end')}>
                    <Text
                      size="xs"
                      weight="semibold"
                      className={cn(
                        'text-center',
                        i < heads.length ? '' : 'uppercase',
                        h === m.yearEndExam ? 'text-primary' : 'text-gray-700',
                      )}
                    >
                      {h}
                    </Text>
                  </View>
                ))}
              </View>
              {m.examRows.map(row)}
              <View className="bg-muted/60 border-border flex-row border-b">
                <View className="w-44 px-3 py-2.5">
                  <Text size="sm" weight="semibold">
                    Total
                  </Text>
                </View>
                {m.totals.map((v, i) => (
                  <Cell key={i} value={v} bold />
                ))}
              </View>
              {m.continuousRows.length ? (
                <>
                  <View className="bg-card px-3 py-2">
                    <Text size="xs" weight="semibold" color="mutedForeground" className="uppercase">
                      Continuous assessment
                    </Text>
                  </View>
                  {m.continuousRows.map(row)}
                </>
              ) : null}
            </View>
          </ScrollView>
          <View className="border-border flex-row flex-wrap gap-y-3 border-t p-4">
            {(
              [
                ['Grand total', m.grandTotal],
                ['GPA', m.gpa],
                ['Result', m.failed ? 'Failed' : 'Passed'],
                ['Failed subjects', String(m.failCount)],
                ['Position', m.position ? String(m.position) : '—'],
              ] as const
            ).map(([label, value]) => (
              <View key={label} className="w-1/2 sm:w-1/5">
                <Text size="xs" color="mutedForeground">
                  {label}
                </Text>
                <Text
                  weight="semibold"
                  tabular
                  color={label === 'Result' && m.failed ? 'destructive' : undefined}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>
      )}
    </PageLayout>
  );
}
