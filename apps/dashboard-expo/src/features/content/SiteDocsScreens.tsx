/**
 * Citizen Charter, Class Routine and Syllabus, replicating dashboard/src/pages/Admin/
 * {CitizenCharter,ClassRoutinePDF,Syllabus}.tsx: one PDF per page (charter / routine) shown on
 * the public website, and one syllabus PDF per class (6–10) and year.
 * Live data: /api/citizen-charter/document, /api/class-routines, /api/syllabuses (src/lib/api/site-docs).
 * Uploads go straight to R2 through a presigned URL (file picker on web, document picker on
 * native).
 */
import { uploadLabel, useUploadPercent } from '@/hooks/useUploadPercent';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { FilePicker } from '@/components/ui/FilePicker';
import { ExternalLink, Pencil, Plus, Trash2, Upload } from '@/components/ui/icons';
import { Select } from '@/components/ui/Select';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { openStoredFile } from '@/features/admin/open-file';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { isPdf, type PickedFile, type SyllabusRow } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import {
  dayOf,
  fileNameOf,
  SYLLABUS_CLASSES,
  syllabusSummary,
  syllabusRows,
  syllabusYears,
} from './model';
import { PdfSlot } from './ui';

export function CitizenCharterScreen() {
  const { siteDocs } = useApi();
  const { resolution } = useTenant();
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'citizen-charter'),
    queryFn: ({ signal }) => siteDocs.charter(signal),
  });
  const upload = useAdminMutation({
    mutationFn: (f: PickedFile) => siteDocs.uploadCharter(f),
    invalidate: [['citizen-charter']],
    success: 'Citizen charter uploaded',
    failure: 'Failed to upload the citizen charter',
  });
  return (
    <PageLayout
      title="Citizen Charter"
      description={
        q.isPending
          ? 'Loading…'
          : q.data
            ? `PDF shown on the public website · updated ${dayOf(q.data.at)}`
            : 'Not uploaded'
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't load the citizen charter"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending ? (
        <Skeleton height={88} />
      ) : (
        <PdfSlot
          label="citizen charter"
          doc={q.data ?? null}
          busy={upload.isPending}
          onUpload={(f) => upload.mutate(f)}
          testID="charter"
        />
      )}
    </PageLayout>
  );
}

export function ClassRoutineScreen() {
  const { siteDocs } = useApi();
  const { resolution } = useTenant();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'class-routine'),
    queryFn: ({ signal }) => siteDocs.routine(signal),
  });
  const upload = useAdminMutation({
    mutationFn: (f: PickedFile) => siteDocs.uploadRoutine(f, q.data ?? null),
    invalidate: [['class-routine']],
    success: () => (q.data ? 'Class routine replaced' : 'Class routine uploaded'),
    failure: 'Failed to upload the class routine',
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => siteDocs.removeRoutine(id),
    invalidate: [['class-routine']],
    success: 'Class routine removed',
    failure: 'Failed to remove the class routine',
    onSuccess: () => setConfirm(false),
  });
  return (
    <PageLayout
      title="Class Routine"
      description={
        q.isPending
          ? 'Loading…'
          : q.data
            ? `PDF shown on the public website · added ${dayOf(q.data.at)}`
            : 'Not uploaded'
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't load the class routine"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending ? (
        <Skeleton height={88} />
      ) : (
        <PdfSlot
          label="class routine"
          doc={q.data ?? null}
          busy={upload.isPending || remove.isPending}
          onUpload={(f) => upload.mutate(f)}
          onRemove={() => setConfirm(true)}
          testID="routine"
        />
      )}
      <ConfirmDialog
        open={confirm}
        title="Remove class routine?"
        message="Delete this class routine PDF? It disappears from the website until you upload another."
        confirmLabel="Remove PDF"
        busy={remove.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => q.data && remove.mutate(q.data.id)}
      />
    </PageLayout>
  );
}

interface SyllabusForm {
  id: number | null;
  cls: string;
  year: string;
  file: PickedFile | null;
  current: SyllabusRow | null;
}

export function SyllabusScreen() {
  const pct = useUploadPercent();
  const { siteDocs } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [form, setForm] = useState<SyllabusForm | null>(null);
  const [errors, setErrors] = useState<{ cls?: string; file?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<SyllabusRow | null>(null);

  // The server caches only the unfiltered list reliably (see web-parity.md), so fetch it all.
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'syllabus'),
    queryFn: ({ signal }) => siteDocs.syllabus(signal),
  });
  const all = q.data ?? [];
  const table = syllabusRows(all, year);

  const save = useAdminMutation({
    mutationFn: (f: SyllabusForm) =>
      siteDocs.saveSyllabus(f.id, { class: Number(f.cls), year: Number(f.year), file: f.file }),
    invalidate: [['syllabus']],
    success: () => (form?.id ? 'Syllabus updated' : 'Syllabus uploaded'),
    failure: 'Failed to save the syllabus',
    onSuccess: () => setForm(null),
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => siteDocs.removeSyllabus(id),
    invalidate: [['syllabus']],
    success: 'Syllabus deleted',
    failure: 'Failed to delete the syllabus',
    onSuccess: () => setDeleteTarget(null),
  });

  const openForm = (cls: number | null, row: SyllabusRow | null) => {
    setErrors({});
    setForm({
      id: row?.id ?? null,
      cls: cls ? String(cls) : '',
      year: String(row?.year ?? year),
      file: null,
      current: row,
    });
  };
  const submit = () => {
    if (!form) return;
    const e: typeof errors = {};
    if (!form.cls) e.cls = 'Select a class';
    if (!form.id && !form.file) e.file = 'Please select a PDF file.';
    setErrors(e);
    if (!e.cls && !e.file) save.mutate(form);
  };
  const pick = (file: PickedFile | null) => {
    if (!form) return;
    if (file && !isPdf(file)) {
      toast.error('Please select a PDF file.');
      return;
    }
    setForm({ ...form, file });
  };
  const open = async (key: string) => {
    if (!(await openStoredFile(key))) toast.error('No file stored.');
  };

  type Row = (typeof table)[number];
  const actions = ({ cls, row }: Row) =>
    row ? (
      <View className="flex-row gap-0.5">
        <ActionButton
          icon={ExternalLink}
          label={`Open class ${cls} syllabus`}
          tone="blue"
          onPress={() => void open(row.viewKey)}
        />
        <ActionButton
          icon={Pencil}
          label={`Replace class ${cls} syllabus`}
          tone="emerald"
          onPress={() => openForm(cls, row)}
        />
        <ActionButton
          icon={Trash2}
          label={`Delete class ${cls} syllabus`}
          tone="red"
          onPress={() => setDeleteTarget(row)}
        />
      </View>
    ) : (
      <Button
        variant="outline"
        size="sm"
        icon={Upload}
        label="Upload"
        onPress={() => openForm(cls, null)}
      />
    );
  const columns: Column<Row>[] = [
    {
      key: 'class',
      label: 'Class',
      className: 'w-28',
      render: (r) => <Text weight="medium">{`Class ${r.cls}`}</Text>,
    },
    {
      key: 'file',
      label: 'File',
      className: 'min-w-0 flex-1',
      render: (r) =>
        r.row ? (
          <Text size="sm" numberOfLines={1}>
            {fileNameOf(r.row.viewKey)}
          </Text>
        ) : (
          <Text size="sm" color="mutedForeground">
            Not uploaded
          </Text>
        ),
    },
    {
      key: 'added',
      label: 'Added',
      className: 'w-36',
      render: (r) => (
        <Text size="sm" color="mutedForeground" tabular>
          {r.row ? dayOf(r.row.at) : '—'}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[120px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Syllabus"
      description={q.isPending ? 'Loading…' : syllabusSummary(all, year)}
      titleAccessory={
        <Select
          label="Year"
          size="sm"
          value={year}
          options={syllabusYears(all, thisYear).map((y) => ({ value: y, label: String(y) }))}
          onChange={setYear}
          testID="syllabus-year"
        />
      }
      actions={
        <Button
          label="Upload syllabus"
          icon={Plus}
          onPress={() => openForm(null, null)}
          testID="syllabus-new"
        />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't load the syllabus"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="syllabus"
          rows={table}
          columns={columns}
          rowKey={(r) => r.key}
          loading={q.isPending}
          empty="No classes."
          renderMobile={(r) => (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text size="sm" weight="medium">{`Class ${r.cls}`}</Text>
                <Text size="xs" color="mutedForeground" numberOfLines={1}>
                  {r.row ? `${fileNameOf(r.row.viewKey)} · ${dayOf(r.row.at)}` : 'Not uploaded'}
                </Text>
              </View>
              {actions(r)}
            </View>
          )}
        />
      )}

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : setForm(null))}
        title={form?.id ? 'Replace syllabus' : 'Upload syllabus'}
        testID="syllabus-form"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setForm(null)}
              disabled={save.isPending}
            />
            <Button
              label={
                save.isPending ? uploadLabel(pct, 'Saving…') : form?.id ? 'Save changes' : 'Upload'
              }
              onPress={submit}
              disabled={save.isPending}
              testID="syllabus-submit"
            />
          </>
        }
      >
        {form ? (
          <>
            <Field label="Class" required error={errors.cls}>
              <Select
                label="Class"
                value={form.cls || null}
                placeholder="Select a class"
                options={SYLLABUS_CLASSES.map((c) => ({ value: String(c), label: `Class ${c}` }))}
                onChange={(cls) => setForm({ ...form, cls })}
                invalid={!!errors.cls}
              />
            </Field>
            <Field label="Year" required>
              <Select
                label="Year"
                value={form.year}
                options={syllabusYears(all, thisYear).map((y) => ({
                  value: String(y),
                  label: String(y),
                }))}
                onChange={(y) => setForm({ ...form, year: y })}
              />
            </Field>
            <Field label="PDF" required={!form.id} error={errors.file}>
              <FilePicker
                label="PDF"
                accept="application/pdf,.pdf"
                value={form.file}
                onChange={pick}
                currentLabel={form.current ? fileNameOf(form.current.viewKey) : undefined}
                onOpenCurrent={form.current ? () => void open(form.current!.viewKey) : undefined}
              />
            </Field>
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete syllabus?"
        message={`Delete the class ${deleteTarget?.class ?? ''} syllabus for ${deleteTarget?.year ?? ''}? It disappears from the website.`}
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
}
