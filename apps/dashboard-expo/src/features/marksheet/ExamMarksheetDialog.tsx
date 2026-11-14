/**
 * One (non year-end) exam's marksheet (popup on View Result, inline on the student's result
 * page), laid out like the exam marksheet PDF (marksheet-draw.ts): Name of Subjects (full mark) |
 * Obtained Marks (or CQ | MCQ | PRAC for class 9-10 breakdown subjects) | Total | Letter Grade |
 * Grade Point | Highest Marks. A combined subject lists its papers one per line with Total /
 * Letter Grade / Grade Point spanning them; then Total Marks, Continuous assessment and Grand
 * Total Marks · GPA. Phones get one block per subject.
 * Live data: GET /api/marks/students/:id/exam?year&exam (Nest; same numbers as the PDF).
 */
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Download } from '@/components/ui/icons';
import { StickyTable, stickyHeader } from '@/components/ui/StickyTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { SubjectBlock } from '@/features/marksheet/SessionMarksheetScreen';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { ExamSheet, ExamSheetPaper, ExamSheetRow } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const v = (n: number | string | null) => (n === null ? '-' : String(n));
/** "Bangla 1st Paper (100)", as the PDF prints subject names. */
const named = (subject: string, full: number | null) => (full ? `${subject} (${full})` : subject);

const COL_W = 104;
const NAME_MIN = 220;
const LINE = 'h-10 justify-center';

/** A fixed-width value cell with the PDF's column rule on its left. */
function C({
  children,
  bold,
  className,
}: {
  children: ReactNode;
  bold?: boolean;
  className?: string;
}) {
  return (
    <View
      className={cn('border-border items-center justify-center border-l px-2', className)}
      style={{ width: COL_W }}
    >
      {typeof children === 'string' ? (
        <Text
          size="sm"
          tabular
          weight={bold ? 'semibold' : undefined}
          color={children === '-' ? 'mutedForeground' : undefined}
          className="text-center"
        >
          {children === '-' ? '—' : children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function Name({ children, bold, right }: { children: string; bold?: boolean; right?: boolean }) {
  return (
    <View className={cn('min-w-0 flex-1 px-3', LINE, right && 'items-end')}>
      <Text size="sm" weight={bold ? 'semibold' : 'medium'}>
        {children}
      </Text>
    </View>
  );
}

/** `studentId` null = disabled (no student picked yet). */
export function useExamSheet(studentId: number | null, year: number, exam: string) {
  const { marks } = useApi();
  const { resolution } = useTenant();
  return useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'exam-marksheet', studentId, year, exam),
    queryFn: ({ signal }) => marks.examSheet({ studentId: studentId!, year, exam }, signal),
    enabled: studentId !== null && !!exam,
  });
}

/** The marksheet as the PDF draws it, plus the result line; `maxHeight` caps the table scroll. */
export function ExamMarksheetView({ m, maxHeight }: { m: ExamSheet; maxHeight?: string }) {
  const phone = useBreakpoint() === 'mobile';
  const bd = m.breakdown;
  // Per-line cells left of the spanned ones: CQ / MCQ / PRAC or Obtained Marks.
  const parts = (r: ExamSheetRow | ExamSheetPaper) =>
    bd ? [v(r.cq), v(r.mcq), v(r.practical)] : [v(r.marks)];
  const partHeads = bd ? ['CQ', 'MCQ', 'PRAC'] : ['Obtained Marks'];
  const exams = m.rows.filter((r) => r.assessment_type !== 'continuous');
  const continuous = m.rows.filter((r) => r.assessment_type === 'continuous');
  const minWidth = NAME_MIN + (partHeads.length + 4) * COL_W;

  const subjectRow = (r: ExamSheetRow, i: number) => {
    const lines: (ExamSheetRow | ExamSheetPaper)[] = r.papers.length ? r.papers : [r];
    return (
      <View key={`${r.subject}-${i}`} className="border-border bg-card flex-row border-b">
        <View className="min-w-0 flex-1">
          {lines.map((l, j) => (
            <View key={j} className={cn('flex-row', j > 0 && 'border-border border-t')}>
              <Name>{named(l.subject, l.full_mark)}</Name>
              {parts(l).map((c, k) => (
                <C key={k} className={LINE}>
                  {c}
                </C>
              ))}
            </View>
          ))}
        </View>
        <C>{v(r.marks)}</C>
        <C>{v(r.grade)}</C>
        <C>{v(r.gp)}</C>
        <View className="border-border border-l" style={{ width: COL_W }}>
          {lines.map((l, j) => (
            <View key={j} className={cn('items-center', LINE, j > 0 && 'border-border border-t')}>
              <Text size="sm" tabular color={l.highest ? undefined : 'mutedForeground'}>
                {l.highest ?? '—'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
  const sumRow = (label: string, cells: string[], key: string) => (
    <View key={key} className="border-border bg-muted flex-row border-b">
      <Name bold right>
        {label}
      </Name>
      {cells.map((c, k) => (
        <C key={k} bold className={LINE}>
          {c}
        </C>
      ))}
    </View>
  );
  const block = (r: ExamSheetRow, i: number) => (
    <SubjectBlock
      key={`${r.subject}-${i}`}
      title={r.papers.length ? r.subject : named(r.subject, r.full_mark)}
      pairs={[
        ...(r.papers.length
          ? r.papers.map((p) => [named(p.subject, p.full_mark), v(p.marks)] as const)
          : partHeads.map((h, k) => [h, parts(r)[k]!] as const)),
        ['Total', v(r.marks)],
        ['Grade', v(r.grade)],
        ['GP', v(r.gp)],
        ['Highest', r.papers.length ? r.papers.map((p) => v(p.highest)).join(' / ') : v(r.highest)],
      ]}
    />
  );
  const caLabel = (
    <View className="bg-card border-border border-b px-3 pb-2 pt-4">
      <Text size="xs" weight="semibold" color="mutedForeground" className="text-center uppercase">
        Continuous assessment
      </Text>
    </View>
  );

  return (
    <View className="border-border overflow-hidden rounded-lg border" testID="exam-marksheet">
      {phone ? (
        <View>
          {exams.map(block)}
          <SubjectBlock
            title="Total Marks"
            bold
            pairs={[
              ['Total', String(m.total)],
              ['Highest', v(m.class_highest_total)],
            ]}
          />
          {continuous.length ? (
            <>
              {caLabel}
              {continuous.map(block)}
            </>
          ) : null}
          <SubjectBlock
            title="Grand Total Marks"
            bold
            pairs={[
              ['Total', String(m.grand_total)],
              ['GPA', m.gpa],
              ['Highest', v(m.class_highest_grand_total)],
            ]}
          />
        </View>
      ) : (
        <StickyTable maxHeight={maxHeight}>
          <View className="flex-1" style={{ minWidth }}>
            <View className="bg-muted border-border flex-row border-b" style={stickyHeader}>
              <View className="min-w-0 flex-1 justify-center px-3 py-2.5">
                <Text size="xs" weight="semibold" className="uppercase text-gray-700">
                  Name of Subjects
                </Text>
              </View>
              {[...partHeads, 'Total', 'Letter Grade', 'Grade Point', 'Highest Marks'].map((h) => (
                <C key={h} className="py-2.5">
                  <Text size="xs" weight="semibold" className="text-center uppercase text-gray-700">
                    {h}
                  </Text>
                </C>
              ))}
            </View>
            {exams.map(subjectRow)}
            {sumRow('Total Marks', [String(m.total), '', '', v(m.class_highest_total)], 'total')}
            {continuous.length ? (
              <>
                {caLabel}
                {continuous.map(subjectRow)}
              </>
            ) : null}
            {sumRow(
              'Grand Total Marks',
              [String(m.grand_total), 'GPA', m.gpa, v(m.class_highest_grand_total)],
              'grand',
            )}
          </View>
        </StickyTable>
      )}
      <View className="border-border flex-row flex-wrap gap-x-10 gap-y-3 border-t p-4">
        {(
          [
            ['Result', m.is_failed ? 'Failed' : 'Passed'],
            ['Failed subjects', String(m.fail_count)],
          ] as const
        ).map(([label, value]) => (
          <View key={label}>
            <Text size="xs" color="mutedForeground">
              {label}
            </Text>
            <Text
              weight="semibold"
              tabular
              color={label === 'Result' && m.is_failed ? 'destructive' : undefined}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ExamMarksheetDialog({
  student,
  year,
  exam,
  description,
  onClose,
  onDownload,
  downloading,
}: {
  student: { id: number; name: string } | null;
  year: number;
  exam: string;
  description?: string;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const q = useExamSheet(student?.id ?? null, year, exam);
  const m = q.data;
  const hasData = !!m && m.rows.length > 0;

  return (
    <Dialog
      open={student !== null}
      onClose={onClose}
      title={student ? `${student.name} · Marksheet` : 'Marksheet'}
      description={description}
      size="full"
      testID="exam-marksheet-dialog"
      footer={
        <>
          <Button variant="outline" label="Close" onPress={onClose} />
          {hasData ? (
            <Button
              icon={Download}
              label={downloading ? 'Preparing…' : 'Download PDF'}
              disabled={downloading}
              onPress={onDownload}
              testID="exam-marksheet-pdf"
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
        <ExamMarksheetView m={m} maxHeight="50vh" />
      )}
    </Dialog>
  );
}
