/**
 * Session marksheet preview, replicating dashboard/src/pages/Admin/ShowMarkSheet.tsx
 * (/finalmarkSheet/:studentId/:year): the student's year result with previous / year-end /
 * total marks per subject, continuous assessment, totals, GPA, result and position, plus the
 * official PDF. Opens as a popup from Year-End Promotion ("Preview session marksheet").
 * Live data: GET /api/marks/students/:id/session?year (Nest; the server checks access),
 * PDF: GET /api/marksheets/students/:id/session?year.
 */
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Download } from '@/components/ui/icons';
import { StickyTable, frozenEdge, stickyCell, stickyHeader } from '@/components/ui/StickyTable';
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

export function SessionMarksheetDialog({
  student,
  year,
  onClose,
}: {
  student: { id: number; name: string } | null;
  year: number;
  onClose: () => void;
}) {
  const { promotions } = useApi();
  const { resolution } = useTenant();
  const files = useFileTasks();
  const id = student?.id ?? 0;
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'session-marksheet', id, year),
    queryFn: ({ signal }) => promotions.sessionPreview(id, year, signal),
    enabled: !!student,
  });
  const m = q.data;
  const heads = m ? sessionMarkHeads(m) : [];
  const hasData = !!m && m.examRows.length > 0;

  const row = (r: SessionRow, i: number) => (
    <View key={`${r.subject}-${i}`} className="border-border bg-card flex-row border-b">
      <View className="bg-card w-44 px-3 py-2" style={[stickyCell(0), frozenEdge]}>
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
    <Dialog
      open={student !== null}
      onClose={onClose}
      title={student ? `${student.name} · Marksheet` : 'Marksheet'}
      description={m ? sessionSummary(m, String(year)) : undefined}
      size="full"
      testID="session-marksheet-dialog"
      footer={
        <>
          <Button variant="outline" label="Close" onPress={onClose} />
          {hasData ? (
            <Button
              icon={Download}
              label={files.busy ? 'Downloading…' : 'Download PDF'}
              disabled={!!files.busy}
              onPress={() =>
                files.pdf(
                  'pdf',
                  () => promotions.sessionPdf(id, year),
                  pdfFileName(['session-marksheet', m!.student.name, year]),
                  'Failed to download PDF. Please try again.',
                )
              }
              testID="marksheet-pdf"
            />
          ) : null}
        </>
      }
    >
      {q.isError ? (
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
        <View
          className="border-border overflow-hidden rounded-lg border"
          testID="session-marksheet"
        >
          <StickyTable testID="marksheet-table" maxHeight="50vh">
            <View className="flex-1">
              <View className="bg-muted border-border flex-row border-b" style={stickyHeader}>
                <View
                  className="bg-muted w-44 justify-end px-3 py-2"
                  style={[stickyCell(0, true), frozenEdge]}
                >
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
                <View className="bg-muted w-44 px-3 py-2.5" style={[stickyCell(0), frozenEdge]}>
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
          </StickyTable>
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
        </View>
      )}
    </Dialog>
  );
}
