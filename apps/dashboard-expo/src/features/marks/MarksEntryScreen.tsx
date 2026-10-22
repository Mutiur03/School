/**
 * Marks entry, replicating dashboard/src/pages/Admin/AddMarks.tsx: Year / Exam / Class / Group /
 * Section / Subject pickers, Students · Entered · Not entered stats, one row per student with
 * the subject's cells (Marks, or CQ / MCQ / Prac + Total), only changed students saved, an
 * "N unsaved" bar with Discard / Save, and a confirm before a picker change throws edits away.
 *
 * Keyboard (web and hardware keyboards): Enter / ↓ next student, ↑ previous, Tab along the row.
 * Rules (bounds, empty = not entered, BREAKDOWN totals) live in features/marks/entry.ts.
 * Live data: GET /api/exams/getExams, /api/sub/getSubjects, /api/marks/roster, /api/marks;
 * PUT /api/marks. Excel import is not ported.
 *
 * Shared by admins (/marks) and teachers (/teacher/marks). For teachers the Year / Class /
 * Section pickers are narrowed to their class-teacher assignments (session `levels`, see
 * features/teacher/scope.ts) like the web page; the server enforces the real scope (roster and
 * class marks 403 outside it, PUT /api/marks rejects other students per row).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLeaveGuard } from '@/navigation/LeaveGuard';
import { parseStoredClass } from '@/features/attendance/model';
import { useTenantStorage } from '@/tenant/useTenantStorage';
import { Platform, View, type TextInput } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Save } from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/SearchInput';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import {
  buildSubmission,
  cellText,
  changedStudents,
  entryCounts,
  entrySubjects,
  groupMismatch,
  isBreakdown,
  markColumns,
  nextRow,
  rowState,
  saveMessage,
  savedMarks,
  scopeRoster,
  subjectConfigured,
  type Draft,
  type MarkField,
} from '@/features/marks/entry';
import { MarkCell } from '@/features/marks/MarkCell';
import {
  GROUPS,
  examClasses,
  examNames,
  sectionsOf,
  sessionYears,
} from '@/features/results/filters';
import { narrowClasses, narrowSections, narrowYears } from '@/features/teacher/scope';
import { useClassScope } from '@/features/teacher/useClassScope';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';

const CURRENT_YEAR = new Date().getFullYear();

export function MarksEntryScreen() {
  const { exams, subjects, marks } = useApi();
  const scope = useClassScope();
  const unassigned = scope !== null && scope.years.length === 0;
  const { resolution } = useTenant();
  const mobile = useBreakpoint() === 'mobile';
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = (...p: unknown[]) => privateQueryKey(resolution.tenantKey, ...p);

  const [year, setYear] = useState(() =>
    scope && scope.years.length && !scope.years.includes(CURRENT_YEAR)
      ? scope.years[0]!
      : CURRENT_YEAR,
  );
  const [examName, setExamName] = useState('');
  const [cls, setCls] = useState<number | null>(null);
  const [group, setGroup] = useState('');
  const [section, setSection] = useState('');
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>({});
  const [pending, setPending] = useState<{ what: string; apply: () => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const refs = useRef(new Map<string, TextInput>());

  const examsQ = useQuery({
    queryKey: key('exams'),
    queryFn: ({ signal }) => exams.list(signal),
    staleTime: 60_000,
  });
  const subjectsQ = useQuery({
    queryKey: key('subjects'),
    queryFn: ({ signal }) => subjects.list(signal),
    staleTime: 60_000,
  });
  const rosterQ = useQuery({
    queryKey: key('marks-roster', year, cls),
    queryFn: ({ signal }) => marks.roster({ cls: cls!, year }, signal),
    enabled: cls !== null && !unassigned,
  });
  const classMarksQ = useQuery({
    queryKey: key('class-marks', year, cls, examName),
    queryFn: ({ signal }) => marks.classMarks({ cls: cls!, year, exam: examName }, signal),
    enabled: cls !== null && !!examName && !unassigned,
  });

  const allExams = examsQ.data ?? [];
  const examList = examNames(allExams, year);
  const classList = narrowClasses(examClasses(allExams, year, examName), scope, year);
  const subjectList = useMemo(
    () => (cls === null ? [] : entrySubjects(subjectsQ.data ?? [], cls, year, group)),
    [subjectsQ.data, cls, year, group],
  );
  const subject = subjectList.find((s) => s.id === subjectId) ?? null;
  const roster = useMemo(() => rosterQ.data ?? [], [rosterQ.data]);
  const sections = narrowSections(sectionsOf(roster), scope, year, cls);
  const saved = useMemo(
    () => (subject ? savedMarks(classMarksQ.data ?? [], subject.id) : {}),
    [classMarksQ.data, subject],
  );
  const scoped = useMemo(() => scopeRoster(roster, { section, group }), [roster, section, group]);
  const shown = useMemo(
    () => scopeRoster(roster, { section, group, search }),
    [roster, section, group, search],
  );
  const changed = subject ? changedStudents(subject, roster, draft, saved) : [];
  const unsaved = changed.length;

  // A teacher with exactly one class this year gets it picked for them (as on the web).
  const only = scope?.only(year) ?? null;
  useEffect(() => {
    if (!only || !examName || !classList.includes(only.cls)) return;
    setCls(only.cls);
    setSection(only.section);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the exam/year changes
  }, [examName, year, only?.cls, only?.section]);

  // Start on the class last used in Attendance / Running Away / here, when this exam covers it.
  const storage = useTenantStorage();
  useEffect(() => {
    if (only || !examName || cls !== null) return;
    let alive = true;
    void storage
      .get('attendance-class')
      .then((raw) => {
        const c = parseStoredClass(raw);
        if (alive && c && classList.includes(c)) setCls((cur) => cur ?? c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the exam changes
  }, [examName, only?.cls]);

  // A group subject (e.g. Physics) narrows the roster to its group, like the web page.
  useEffect(() => {
    if (subject?.group && subject.group !== group) setGroup(subject.group);
  }, [subject, group]);

  // Reload/close guard on web while there are unsaved marks.
  useEffect(() => {
    if (Platform.OS !== 'web' || unsaved === 0 || typeof window === 'undefined') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  // In-app guard: the sidebar, tab bar, menus and Android back ask before dropping marks.
  useLeaveGuard(unsaved > 0, {
    title: 'Leave without saving?',
    message: `${unsaved} student${unsaved === 1 ? ' has' : 's have'} unsaved marks. They are lost if you leave this page now.`,
  });

  /** Run a picker change, asking first when it would discard unsaved marks. */
  const guarded = (what: string, apply: () => void) => {
    if (unsaved === 0) {
      apply();
      setDraft({});
    } else setPending({ what, apply });
  };

  const columns = subject ? markColumns(subject) : [];
  const breakdown = subject ? isBreakdown(subject) : false;
  const configured = subject ? subjectConfigured(subject) : false;
  const counts = subject ? entryCounts(subject, scoped, draft, saved) : null;

  const setCell = (studentId: number, field: MarkField, text: string) =>
    setDraft((d) => ({ ...d, [studentId]: { ...d[studentId], [field]: text } }));

  const move = (field: MarkField, index: number, step: 1 | -1) => {
    const col = columns.find((c) => c.field === field);
    const enabled = shown.map((st) => !groupMismatch(subject, st) && (col?.max ?? 0) > 0);
    const to = nextRow(enabled, index, step);
    if (to !== null) refs.current.get(`${field}:${to}`)?.focus();
  };

  const save = async () => {
    if (!subject || saving) return;
    const sub = buildSubmission({ subject, students: roster, draft, saved, examName, year });
    if (sub.invalid.length) {
      const first = sub.invalid[0]!;
      toast.error(
        `Fix ${sub.invalid.length} mark${sub.invalid.length === 1 ? '' : 's'} first: ${first.name} (${first.message}).`,
      );
      return;
    }
    if (!sub.payload) {
      toast.error(configured ? 'No mark changes to save.' : 'This subject has no mark limits set.');
      return;
    }
    setSaving(true);
    try {
      const result = await marks.save(sub.payload);
      const msg = saveMessage(result);
      if (msg.tone === 'success') toast.success(msg.text);
      else toast.error(msg.text);
      await queryClient.invalidateQueries({ queryKey: key('class-marks') });
      setDraft({});
    } catch (e) {
      toast.error(mutationErrorMessage(e, 'Failed to save marks'));
    } finally {
      setSaving(false);
    }
  };

  const summary = unassigned
    ? 'You have no class assigned this year.'
    : !examName
      ? scope
        ? `Your classes: ${scope.label(year) || 'none'}. Pick an exam, class and subject.`
        : 'Pick an exam, class and subject to enter marks.'
      : cls === null
        ? `${examName} ${year} · pick a class`
        : [
            `Class ${cls}${section ? ` ${section}` : ''}${group ? ` · ${group}` : ''}`,
            `${scoped.length.toLocaleString()} students`,
            subject ? `${subject.name} · full mark ${subject.full_mark || 0}` : 'pick a subject',
          ].join(' · ');

  const loading =
    cls !== null &&
    (rosterQ.isPending || (!!examName && classMarksQ.isPending) || subjectsQ.isPending);
  const empty = !examName
    ? 'Pick an exam to start.'
    : cls === null
      ? 'Pick a class to see its students.'
      : roster.length === 0
        ? 'No students found for this class.'
        : !subject
          ? 'Pick a subject to enter marks.'
          : shown.length === 0
            ? `No students match${search ? ` “${search}”` : ' these filters'}.`
            : null;

  const saveButton = (
    <Button
      label={saving ? 'Saving…' : 'Save marks'}
      icon={Save}
      onPress={() => void save()}
      disabled={saving || !configured || unsaved === 0}
      testID="save-marks"
    />
  );

  const error = examsQ.error ?? rosterQ.error ?? classMarksQ.error ?? subjectsQ.error;

  return (
    <PageLayout
      title="Marks entry"
      description={summary}
      actions={unsaved === 0 ? saveButton : undefined}
      footer={
        unsaved > 0 ? (
          <ActionBar label={`${unsaved} unsaved ${unsaved === 1 ? 'student' : 'students'}`}>
            <Button variant="ghost" size="sm" label="Discard" onPress={() => setDraft({})} />
            {saveButton}
          </ActionBar>
        ) : null
      }
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Select
          label="Year"
          size="sm"
          value={year}
          options={narrowYears(sessionYears(allExams, CURRENT_YEAR, 10), scope, CURRENT_YEAR).map(
            (y) => ({
              value: y,
              label: String(y),
            }),
          )}
          onChange={(y) =>
            guarded('year', () => {
              setYear(y);
              setExamName('');
              setCls(null);
              setGroup('');
              setSection('');
              setSubjectId(null);
            })
          }
        />
        <Select
          label="Exam"
          size="sm"
          value={examName || null}
          placeholder="Select exam"
          disabled={examsQ.isPending || unassigned}
          options={examList.map((n) => ({ value: n, label: n }))}
          onChange={(n) =>
            guarded('exam', () => {
              setExamName(n);
              setCls(null);
              setGroup('');
              setSection('');
              setSubjectId(null);
            })
          }
          testID="marks-exam"
        />
        <Select
          label="Class"
          size="sm"
          value={cls}
          placeholder="Select class"
          disabled={!examName}
          options={classList.map((c) => ({ value: c, label: `Class ${c}` }))}
          onChange={(c) =>
            guarded('class', () => {
              setCls(c);
              void storage.set('attendance-class', String(c)).catch(() => {});
              setGroup('');
              setSection('');
              setSubjectId(null);
            })
          }
          testID="marks-class"
        />
        {cls !== null && cls >= 9 ? (
          <Select
            label="Group"
            size="sm"
            value={group}
            options={[
              { value: '', label: 'All groups' },
              ...GROUPS.map((g) => ({ value: g, label: g })),
            ]}
            onChange={(g) => guarded('group', () => setGroup(g))}
          />
        ) : null}
        <Select
          label="Section"
          size="sm"
          value={section}
          disabled={cls === null}
          options={[
            { value: '', label: scope ? 'My sections' : 'All sections' },
            ...sections.map((s) => ({ value: s, label: `Section ${s}` })),
          ]}
          onChange={(s) => guarded('section', () => setSection(s))}
        />
        <Select
          label="Subject"
          size="sm"
          value={subjectId}
          placeholder="Select subject"
          disabled={cls === null}
          options={subjectList.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(id) => guarded('subject', () => setSubjectId(id))}
          testID="marks-subject"
        />
      </View>

      {unassigned ? (
        <Notice tone="info" title="No class assigned">
          Marks can only be entered for classes you&apos;re the class teacher of this year. Ask an
          admin to assign you on Assigned Teachers.
        </Notice>
      ) : null}

      {examName && cls === null && classList.length === 0 && scope && !unassigned ? (
        <Notice tone="info" title="None of your classes sit this exam">
          {`${examName} ${year} doesn't include your classes (${scope.label(year)}).`}
        </Notice>
      ) : null}

      {subject && !configured ? (
        <Text size="sm" className="text-amber-800">
          {subject.name} has no mark limits set.{' '}
          {scope
            ? 'Ask an admin to set its full mark (and CQ/MCQ/Practical marks) before entering marks.'
            : 'Set its full mark (and CQ/MCQ/Practical marks) on the Subjects page before entering marks.'}
        </Text>
      ) : null}

      {counts && scoped.length > 0 ? (
        <StatStrip>
          <Stat label="Students" value={counts.eligible} />
          <Stat label="Entered" value={counts.entered} dot="bg-emerald-500" />
          <Stat label="Not entered" value={counts.notEntered} dot="bg-amber-500" />
        </StatStrip>
      ) : null}

      {error && !rosterQ.data ? (
        <ErrorState
          title="Couldn't load marks"
          message={error.message}
          onRetry={() => void rosterQ.refetch()}
        />
      ) : (
        <SectionCard noPadding>
          {subject && roster.length > 0 ? (
            <View className="border-border border-b px-3 py-2">
              <SearchInput
                value={search}
                onChangeText={setSearch}
                placeholder="Name or roll…"
                label="Search students"
              />
            </View>
          ) : null}
          <View className="bg-muted border-border flex-row items-center border-b px-3 py-2.5">
            {mobile ? null : (
              <>
                <Text size="xs" weight="semibold" className="w-14 uppercase text-gray-700">
                  Roll
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  className="min-w-0 flex-1 uppercase text-gray-700"
                >
                  Student
                </Text>
              </>
            )}
            {columns.map((c) => (
              <Text
                key={c.field}
                size="xs"
                weight="semibold"
                tabular
                className={cn(
                  'text-center uppercase text-gray-700',
                  mobile ? 'flex-1' : 'w-[72px]',
                )}
              >
                {c.label} /{c.max}
              </Text>
            ))}
            {breakdown ? (
              <Text
                size="xs"
                weight="semibold"
                tabular
                className={cn(
                  'text-center uppercase text-gray-700',
                  mobile ? 'flex-1' : 'w-[64px]',
                )}
              >
                Total /{subject?.full_mark}
              </Text>
            ) : null}
          </View>
          {loading ? (
            <View className="gap-2 p-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </View>
          ) : empty ? (
            <Text size="sm" color="mutedForeground" className="px-4 py-12 text-center">
              {empty}
            </Text>
          ) : (
            subject &&
            shown.map((st, index) => {
              const mismatch = groupMismatch(subject, st);
              const row = rowState(subject, draft, saved, st.student_id);
              const dirty = changed.includes(st.student_id);
              return (
                <View
                  key={st.student_id}
                  testID={`marks-row-${st.student_id}`}
                  className={cn(
                    'border-border border-b px-3 py-1.5',
                    mobile ? 'gap-1.5 py-2.5' : 'flex-row items-center',
                    !dirty && 'bg-card',
                  )}
                  style={dirty ? { backgroundColor: withAlpha(colors.primary, 0.06) } : undefined}
                >
                  <View className={cn('flex-row items-center', !mobile && 'min-w-0 flex-1')}>
                    <Text size="sm" tabular className="w-14">
                      {section ? st.roll : `${st.section}-${st.roll}`}
                    </Text>
                    <Text
                      size="sm"
                      weight="medium"
                      numberOfLines={1}
                      color={mismatch ? 'mutedForeground' : undefined}
                      className="min-w-0 flex-1 pr-2"
                    >
                      {st.name}
                    </Text>
                  </View>
                  {mismatch ? (
                    <Text
                      size="xs"
                      color="mutedForeground"
                      className={mobile ? 'pl-14' : 'text-center'}
                      style={
                        mobile ? undefined : { width: 72 * columns.length + (breakdown ? 64 : 0) }
                      }
                    >
                      Not for {st.group || 'this'} group
                    </Text>
                  ) : (
                    <View className="flex-row items-center">
                      {columns.map((c) => (
                        <View
                          key={c.field}
                          className={cn('items-center', mobile ? 'flex-1' : 'w-[72px]')}
                        >
                          <MarkCell
                            value={cellText(draft, saved, st.student_id, c.field)}
                            max={c.max}
                            disabled={c.max <= 0}
                            error={row.errors[c.field]}
                            label={`${st.name} ${c.label}`}
                            testID={`mark-${st.student_id}-${c.field}`}
                            inputRef={(el) => {
                              const k = `${c.field}:${index}`;
                              if (el) refs.current.set(k, el);
                              else refs.current.delete(k);
                            }}
                            onChange={(t) => setCell(st.student_id, c.field, t)}
                            onMove={(step) => move(c.field, index, step)}
                          />
                        </View>
                      ))}
                      {breakdown ? (
                        <Text
                          size="sm"
                          weight="semibold"
                          tabular
                          className={cn('text-center', mobile ? 'flex-1' : 'w-[64px]')}
                        >
                          {row.total ?? '—'}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })
          )}
          {subject && shown.length > 0 ? (
            <Text size="xs" color="mutedForeground" className="px-4 py-2.5">
              Enter or ↓ moves to the next student, ↑ to the previous. Marks above the limit are not
              saved. Empty = not entered.
            </Text>
          ) : null}
        </SectionCard>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Discard unsaved changes?"
        message={`You have unsaved marks. Changing the ${pending?.what ?? 'filter'} will discard them.`}
        confirmLabel="Discard & continue"
        onClose={() => setPending(null)}
        onConfirm={() => {
          pending?.apply();
          setDraft({});
          setPending(null);
        }}
      />
    </PageLayout>
  );
}
