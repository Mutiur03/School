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
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { pdfFileName } from '@/lib/files/pdf-name';
import { sessionMarkHeads, type SessionMarksheet, type SessionRow } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

// Value columns share the width left after the subject column (never narrower than 88px, so a
// small screen scrolls instead of squeezing); content is centred both ways.
export const CELL = 'min-w-[88px] flex-1 items-center justify-center px-2 py-2.5';
export const SUBJECT = 'w-48 justify-center px-3 py-2.5';

export function Cell({ value, tint, bold }: { value: string; tint?: boolean; bold?: boolean }) {
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

/** Phone: one block per subject, its values as label/value pairs that wrap (no sideways scroll). */
export function SubjectBlock({
  title,
  pairs,
  bold,
}: {
  title: string;
  pairs: readonly (readonly [string, string])[];
  bold?: boolean;
}) {
  return (
    <View className={cn('border-border gap-1.5 border-b px-3 py-2.5', bold && 'bg-muted')}>
      <Text size="sm" weight="semibold">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {pairs.map(([label, value]) => (
          <View key={label} className="min-w-[56px]">
            <Text size="xs" color="mutedForeground" numberOfLines={1}>
              {label}
            </Text>
            <Text size="sm" tabular weight={bold ? 'semibold' : undefined}>
              {value === '-' ? '—' : value}
            </Text>
          </View>
        ))}
      </View>
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

/** `studentId` null = disabled (no student picked yet). */
export function useSessionSheet(studentId: number | null, year: number) {
  const { promotions } = useApi();
  const { resolution } = useTenant();
  return useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'session-marksheet', studentId, year),
    queryFn: ({ signal }) => promotions.sessionPreview(studentId!, year, signal),
    enabled: studentId !== null,
  });
}

/** Session table (previous + year-end) and the grand total / GPA / result / position line. */
export function SessionMarksheetView({
  m,
  maxHeight,
}: {
  m: SessionMarksheet;
  maxHeight?: string;
}) {
  const phone = useBreakpoint() === 'mobile';
  const heads = sessionMarkHeads(m);
  const pairsOf = (r: { fullMark: string; marks: string[] }) =>
    [['Full', r.fullMark], ...heads.map((h, i) => [h, r.marks[i] ?? '-'] as const)] as const;
  const spanned = (r: SessionRow) =>
    [
      ['Grade', r.grade],
      ['GP', r.gp],
      ['Highest', r.highestMark],
    ] as const;
  // Phone: a main subject lists its papers first, then the subject's grade / GP / highest.
  const blocks = (r: SessionRow, i: number) =>
    r.papers.length
      ? [
          ...r.papers.map((p, j) => (
            <SubjectBlock key={`${r.subject}-${i}-${j}`} title={p.subject} pairs={pairsOf(p)} />
          )),
          <SubjectBlock key={`${r.subject}-${i}`} title={r.subject} pairs={spanned(r)} />,
        ]
      : [
          <SubjectBlock
            key={`${r.subject}-${i}`}
            title={r.subject}
            pairs={[...pairsOf(r), ...spanned(r)]}
          />,
        ];
  // Full + marks columns per line; grade / GP / highest span a main subject's paper lines (PDF).
  const lineCount = 1 + heads.length;
  const row = (r: SessionRow, i: number) => {
    const lines = r.papers.length ? r.papers : [r];
    return (
      <View key={`${r.subject}-${i}`} className="border-border bg-card flex-row border-b">
        <View
          style={{
            flexGrow: lineCount,
            flexShrink: 0,
            // Basis = subject column + the cells' 16px padding, so the share of spare width matches the header.
            flexBasis: 192 + lineCount * 16,
            minWidth: 192 + lineCount * 88,
          }}
        >
          {lines.map((l, j) => (
            <View key={j} className={cn('flex-row', j > 0 && 'border-border border-t')}>
              <View className={cn('bg-card', SUBJECT)} style={[stickyCell(0), frozenEdge]}>
                <Text size="sm" weight="medium">
                  {l.subject}
                </Text>
              </View>
              {[l.fullMark, ...l.marks].map((v, k) => (
                <Cell key={k} value={v} tint={heads[k - 1] === m.yearEndExam} />
              ))}
            </View>
          ))}
        </View>
        {[r.grade, r.gp, r.highestMark].map((v, k) => (
          <Cell key={k} value={v} />
        ))}
      </View>
    );
  };

  return (
    <View className="border-border overflow-hidden rounded-lg border" testID="session-marksheet">
      {phone ? (
        <View testID="marksheet-table">
          {m.examRows.flatMap(blocks)}
          <SubjectBlock
            title="Total"
            bold
            pairs={[
              ['Full', m.totalFull],
              ...heads.map((h, i) => [h, m.totals[i] ?? '-'] as const),
              ['Highest', m.classHighestTotal],
            ]}
          />
          {m.continuousRows.length ? (
            <>
              <View className="px-3 pb-1 pt-4">
                <Text size="xs" weight="semibold" color="mutedForeground" className="uppercase">
                  Continuous Assessment
                </Text>
              </View>
              {m.continuousRows.flatMap(blocks)}
            </>
          ) : null}
        </View>
      ) : (
        <StickyTable testID="marksheet-table" maxHeight={maxHeight}>
          <View className="flex-1">
            <View className="bg-muted border-border flex-row border-b" style={stickyHeader}>
              <View className={cn('bg-muted', SUBJECT)} style={[stickyCell(0, true), frozenEdge]}>
                <Text size="xs" weight="semibold" className="uppercase text-gray-700">
                  Subject
                </Text>
              </View>
              {['Full', ...heads, 'Grade', 'GP', 'Highest'].map((h, i) => (
                <View key={`${h}-${i}`} className={cn(CELL, h === m.yearEndExam && 'bg-primary/5')}>
                  <Text
                    size="xs"
                    weight="semibold"
                    className={cn(
                      'text-center uppercase',
                      h === m.yearEndExam ? 'text-primary' : 'text-gray-700',
                    )}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </View>
            {m.examRows.map(row)}
            <View className="bg-muted border-border flex-row border-b">
              <View className={cn('bg-muted', SUBJECT)} style={[stickyCell(0), frozenEdge]}>
                <Text size="sm" weight="semibold">
                  Total
                </Text>
              </View>
              {[m.totalFull, ...m.totals, '-', '-', m.classHighestTotal].map((v, i) => (
                <Cell key={i} value={v} bold tint={heads[i - 1] === m.yearEndExam} />
              ))}
            </View>
            {m.continuousRows.length ? (
              <>
                <View className="bg-card border-border border-b px-3 pb-2 pt-4">
                  <Text size="xs" weight="semibold" color="mutedForeground" className="uppercase">
                    Continuous Assessment
                  </Text>
                </View>
                {m.continuousRows.map(row)}
              </>
            ) : null}
          </View>
        </StickyTable>
      )}
      <View className="border-border flex-row flex-wrap gap-y-3 border-t p-4">
        {(
          [
            ['Grand total', `${m.grandTotal} / ${m.grandFull}`],
            ['GPA', m.gpa],
            ['Result', m.result ?? 'Not generated yet'],
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
  );
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
  const files = useFileTasks();
  const id = student?.id ?? 0;
  const q = useSessionSheet(student?.id ?? null, year);
  const m = q.data;
  const hasData = !!m && m.examRows.length > 0;

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
        <SessionMarksheetView m={m} maxHeight="50vh" />
      )}
    </Dialog>
  );
}
