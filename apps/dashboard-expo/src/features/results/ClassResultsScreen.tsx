/**
 * Class results, replicating dashboard/src/pages/Admin/ViewMarks.tsx: Year / Exam / Class /
 * Section / Group pickers, a Roll · Student · one column per subject table (students with at
 * least one entered mark; "—" = not entered), a per-student details dialog (CQ / MCQ / Prac /
 * Total) with the exam marksheet PDF, and the class Summary PDF / All marksheets downloads.
 * Phones get one card per student instead of the wide table.
 * Live data: GET /api/exams/getExams, /api/marks, /api/marksheets/*. While the exam's marksheets
 * are still generating in the background, the web's progress panel shows above the table.
 * Not ported: the marksheet-generation progress / stale-bundle panels.
 *
 * Shared by admins (/results) and teachers (/teacher/results). Teachers get Year / Class /
 * Section narrowed to their assignments (features/teacher/scope.ts); the server limits
 * GET /api/marks, the summary PDF and the bundle to their sections and 403s anything else.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Download, FileText, Info } from '@/components/ui/icons';
import { ScrollView } from '@/components/ui/ScrollView';
import { SearchInput } from '@/components/ui/SearchInput';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import {
  examClasses,
  examNames,
  marksBySubject,
  resultsTable,
  sectionsOf,
  sessionYears,
} from '@/features/results/filters';
import { narrowClasses, narrowSections, narrowYears } from '@/features/teacher/scope';
import { useClassScope } from '@/features/teacher/useClassScope';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { isGenComplete, type ClassMarksRow } from '@/lib/api';
import { openPdf, openRemote } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { MarksheetGenPanel, useMarksheetStatus } from '@/features/results/MarksheetGenPanel';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const CURRENT_YEAR = new Date().getFullYear();

function Dash() {
  return (
    <Text size="sm" color="mutedForeground" accessibilityLabel="Not entered">
      —
    </Text>
  );
}

export function ClassResultsScreen() {
  const { exams, marks } = useApi();
  const scope = useClassScope();
  const unassigned = scope !== null && scope.years.length === 0;
  const { resolution } = useTenant();
  const toast = useToast();
  const mobile = useBreakpoint() === 'mobile';
  const key = (...p: unknown[]) => privateQueryKey(resolution.tenantKey, ...p);

  const [year, setYear] = useState(() =>
    scope && scope.years.length && !scope.years.includes(CURRENT_YEAR)
      ? scope.years[0]!
      : CURRENT_YEAR,
  );
  const [exam, setExam] = useState('');
  const [cls, setCls] = useState<number | null>(null);
  const [section, setSection] = useState('');
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClassMarksRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);

  const examsQ = useQuery({
    queryKey: key('exams'),
    queryFn: ({ signal }) => exams.list(signal),
    staleTime: 60_000,
  });
  const marksQ = useQuery({
    queryKey: key('class-marks', year, cls, exam),
    queryFn: ({ signal }) => marks.classMarks({ cls: cls!, year, exam }, signal),
    enabled: cls !== null && !!exam && !unassigned,
  });

  const allExams = examsQ.data ?? [];
  const rows = marksQ.data ?? [];
  const table = resultsTable(rows, { section, group, search });
  const sections = narrowSections(sectionsOf(rows), scope, year, cls);
  const classOptions = narrowClasses(examClasses(allExams, year, exam), scope, year);
  const examId = exam
    ? allExams.find((e) => e.exam_name === exam && e.exam_year === year)?.id
    : undefined;
  const genStatus = useMarksheetStatus(examId).data;

  // A teacher with exactly one class this year gets it picked for them (as on the web).
  const only = scope?.only(year) ?? null;
  useEffect(() => {
    if (!only || !exam || !classOptions.includes(only.cls)) return;
    setCls(only.cls);
    setSection(only.section);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the exam/year changes
  }, [exam, year, only?.cls, only?.section]);
  const ready = cls !== null && !!exam;

  /** One download at a time; errors as toasts. */
  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    try {
      const r = await fn();
      if (r === 'unavailable') toast.error("This device can't open the PDF.");
    } catch (e) {
      toast.error(mutationErrorMessage(e, 'Failed to download marksheet'));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };
  const studentPdf = (r: ClassMarksRow) =>
    run(`student-${r.student_id}`, () =>
      openPdf(
        () => marks.studentPdf({ studentId: r.student_id, year, exam }),
        pdfFileName(['marksheet', r.student_id, exam, year]),
      ),
    );
  const summaryPdf = () =>
    run('summary', () =>
      openPdf(
        () => marks.summaryPdf({ cls: cls!, year, exam, section: section || undefined }),
        pdfFileName([`class-${cls}${section}`, 'summary', exam, year]),
      ),
    );
  const bundle = () =>
    run('bundle', () =>
      openRemote(
        () => marks.bundleUrl({ cls: cls!, year, exam, section: section || undefined }),
        pdfFileName([`class-${cls}${section}`, 'marksheets', exam, year]),
      ),
    );

  const summary = unassigned
    ? 'You have no class assigned this year.'
    : !ready
      ? scope
        ? `Your classes: ${scope.label(year) || 'none'}. Pick an exam and class.`
        : 'Pick an exam and class to see results.'
      : marksQ.isPending
        ? 'Loading results…'
        : [
            `${exam} ${year} · Class ${cls}${section ? ` ${section}` : ''}${group ? ` · ${group}` : ''}`,
            `${table.withMarks.length.toLocaleString()} students with marks`,
            table.noMarks > 0 ? `${table.noMarks.toLocaleString()} with none entered` : null,
            `${table.subjects.length} subjects`,
          ]
            .filter(Boolean)
            .join(' · ');
  const empty = !ready
    ? 'Pick an exam and class to see results.'
    : search
      ? `No students match “${search}”.`
      : 'No marks found for these filters.';

  const detail = [...(selected?.marks ?? [])].sort((a, b) => a.priority - b.priority);
  const detailBreakdown = detail.some((m) => m.marking_scheme === 'BREAKDOWN');
  const part = (scheme: string, v: number | null) => (scheme === 'BREAKDOWN' ? (v ?? '—') : '—');

  return (
    <PageLayout
      title="Class results"
      description={summary}
      actions={
        ready && table.withMarks.length > 0 ? (
          <>
            <Button
              variant="outline"
              icon={FileText}
              label={
                busy === 'summary'
                  ? 'Preparing…'
                  : section
                    ? `Section ${section} summary`
                    : 'Summary PDF'
              }
              disabled={busy !== null}
              onPress={() => void summaryPdf()}
            />
            <Button
              icon={Download}
              label={
                busy === 'bundle'
                  ? 'Preparing…'
                  : section
                    ? `Section ${section} marksheets`
                    : scope
                      ? 'My sections’ marksheets'
                      : 'All marksheets'
              }
              disabled={busy !== null}
              onPress={() => void bundle()}
            />
          </>
        ) : undefined
      }
      onRefresh={() => void marksQ.refetch()}
      refreshing={marksQ.isRefetching}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Select
          label="Year"
          size="sm"
          value={year}
          options={narrowYears(sessionYears(allExams, CURRENT_YEAR), scope, CURRENT_YEAR).map(
            (y) => ({
              value: y,
              label: String(y),
            }),
          )}
          onChange={(y) => {
            setYear(y);
            setExam('');
            setCls(null);
            setSection('');
            setGroup('');
          }}
        />
        <Select
          label="Exam"
          size="sm"
          value={exam || null}
          placeholder="Select exam"
          disabled={unassigned}
          options={examNames(allExams, year).map((n) => ({ value: n, label: n }))}
          onChange={(n) => {
            setExam(n);
            setCls(null);
            setSection('');
            setGroup('');
          }}
          testID="results-exam"
        />
        <Select
          label="Class"
          size="sm"
          value={cls}
          placeholder="Select class"
          disabled={!exam}
          options={classOptions.map((c) => ({
            value: c,
            label: `Class ${c}`,
          }))}
          onChange={(c) => {
            setCls(c);
            setSection('');
            setGroup('');
          }}
          testID="results-class"
        />
        <Select
          label="Section"
          size="sm"
          value={section}
          disabled={!ready || sections.length === 0}
          options={[
            { value: '', label: scope ? 'My sections' : 'All sections' },
            ...sections.map((s) => ({ value: s, label: `Section ${s}` })),
          ]}
          onChange={setSection}
        />
        <Select
          label="Group"
          size="sm"
          value={group}
          disabled={!ready || table.groups.length === 0}
          options={[
            { value: '', label: 'All groups' },
            ...table.groups.map((g) => ({ value: g, label: g })),
          ]}
          onChange={setGroup}
        />
      </View>

      {unassigned ? (
        <Notice tone="info" title="No class assigned">
          Results are shown for classes you&apos;re the class teacher of this year. Ask an admin to
          assign you on Assigned Teachers.
        </Notice>
      ) : exam && classOptions.length === 0 && scope ? (
        <Notice tone="info" title="None of your classes sit this exam">
          {`${exam} ${year} doesn't include your classes (${scope.label(year)}).`}
        </Notice>
      ) : null}

      {exam && genStatus && !isGenComplete(genStatus) ? (
        <MarksheetGenPanel status={genStatus} />
      ) : null}

      {marksQ.isError && !marksQ.data ? (
        <ErrorState
          title="Couldn't load results"
          message={marksQ.error.message}
          onRetry={() => void marksQ.refetch()}
        />
      ) : (
        <SectionCard noPadding>
          {ready && table.withMarks.length > 0 ? (
            <View className="border-border border-b px-3 py-2">
              <SearchInput
                value={search}
                onChangeText={setSearch}
                placeholder="Name or roll…"
                label="Search students"
              />
            </View>
          ) : null}
          {ready && marksQ.isPending ? (
            <View className="gap-2 p-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </View>
          ) : table.shown.length === 0 ? (
            <Text size="sm" color="mutedForeground" className="px-4 py-12 text-center">
              {empty}
            </Text>
          ) : mobile ? (
            table.shown.map((r) => {
              const entered = r.marks.filter((m) => m.marks !== null).length;
              return (
                <Pressable
                  key={r.student_id}
                  onPress={() => setSelected(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.name}, details`}
                  className="border-border flex-row items-center gap-3 border-b px-4 py-3"
                >
                  <Text size="sm" tabular className="w-12">
                    {section ? r.roll : `${r.section}-${r.roll}`}
                  </Text>
                  <View className="min-w-0 flex-1">
                    <Text size="sm" weight="medium" numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text size="xs" color="mutedForeground" tabular>
                      {entered} of {table.subjects.length} subjects entered
                    </Text>
                  </View>
                  <Info size={16} color="#16a34a" />
                </Pressable>
              );
            })
          ) : (
            <ScrollView horizontal contentContainerClassName="min-w-full">
              <View className="flex-1">
                <View className="bg-muted border-border flex-row items-center border-b px-3 py-2.5">
                  <Text size="xs" weight="semibold" className="w-16 uppercase text-gray-700">
                    Roll
                  </Text>
                  <Text
                    size="xs"
                    weight="semibold"
                    className="min-w-[224px] flex-1 uppercase text-gray-700"
                  >
                    Student
                  </Text>
                  {table.subjects.map((s) => (
                    <Text
                      key={s}
                      size="xs"
                      weight="semibold"
                      numberOfLines={2}
                      className="w-24 px-1 text-center text-gray-700"
                    >
                      {s}
                    </Text>
                  ))}
                  <View className="w-20" />
                </View>
                {table.shown.map((r) => {
                  const by = marksBySubject(r);
                  return (
                    <View
                      key={r.student_id}
                      className="border-border bg-card flex-row items-center border-b px-3 py-1.5"
                    >
                      <Text size="sm" tabular className="w-16">
                        {section ? r.roll : `${r.section || '—'}-${r.roll}`}
                      </Text>
                      <Pressable
                        onPress={() => setSelected(r)}
                        accessibilityRole="button"
                        className="min-w-[224px] flex-1 pr-2"
                      >
                        <Text size="sm" weight="medium" numberOfLines={1}>
                          {r.name}
                        </Text>
                      </Pressable>
                      {table.subjects.map((s) => (
                        <View key={s} className="w-24 items-center">
                          {by[s] === null || by[s] === undefined ? (
                            <Dash />
                          ) : (
                            <Text size="sm" tabular>
                              {by[s]}
                            </Text>
                          )}
                        </View>
                      ))}
                      <View className="w-20 flex-row justify-end gap-0.5">
                        <ActionButton
                          icon={Info}
                          label={`Details for ${r.name}`}
                          tone="emerald"
                          onPress={() => setSelected(r)}
                        />
                        <ActionButton
                          icon={Download}
                          label={`Exam PDF for ${r.name}`}
                          tone="blue"
                          onPress={() => void studentPdf(r)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </SectionCard>
      )}

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        description={
          selected
            ? `Class ${selected.class}${selected.section ? ` · Section ${selected.section}` : ''} · Roll ${selected.roll}${selected.group ? ` · ${selected.group}` : ''} · ${exam} ${year}`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" label="Close" onPress={() => setSelected(null)} />
            <Button
              icon={Download}
              label={busy?.startsWith('student') ? 'Preparing…' : 'Download exam PDF'}
              disabled={busy !== null}
              onPress={() => selected && void studentPdf(selected)}
            />
          </>
        }
      >
        <View className="border-border overflow-hidden rounded-lg border">
          <View className="bg-muted border-border flex-row border-b px-3 py-2.5">
            <Text size="xs" weight="semibold" className="flex-1 uppercase text-gray-700">
              Subject
            </Text>
            {detailBreakdown
              ? ['CQ', 'MCQ', 'Prac'].map((h) => (
                  <Text
                    key={h}
                    size="xs"
                    weight="semibold"
                    className="w-14 text-center uppercase text-gray-700"
                  >
                    {h}
                  </Text>
                ))
              : null}
            <Text size="xs" weight="semibold" className="w-14 text-center uppercase text-gray-700">
              Total
            </Text>
          </View>
          {detail.length === 0 ? (
            <Text size="sm" color="mutedForeground" className="px-3 py-8 text-center">
              No marks recorded
            </Text>
          ) : (
            detail.map((m) => (
              <View
                key={m.subject_id}
                className="border-border flex-row items-center border-b px-3 py-2"
              >
                <Text size="sm" weight="medium" className="flex-1" numberOfLines={1}>
                  {m.subject}
                </Text>
                {detailBreakdown ? (
                  <>
                    <Text size="sm" tabular className="w-14 text-center">
                      {part(m.marking_scheme, m.cq_marks)}
                    </Text>
                    <Text size="sm" tabular className="w-14 text-center">
                      {part(m.marking_scheme, m.mcq_marks)}
                    </Text>
                    <Text size="sm" tabular className="w-14 text-center">
                      {part(m.marking_scheme, m.practical_marks)}
                    </Text>
                  </>
                ) : null}
                <Text size="sm" weight="semibold" tabular className="w-14 text-center">
                  {m.marks ?? '—'}
                </Text>
              </View>
            ))
          )}
        </View>
        <Text size="xs" color="mutedForeground">
          — = not entered
        </Text>
      </Dialog>
    </PageLayout>
  );
}
