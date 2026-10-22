/**
 * Admission results, replicating dashboard/src/pages/Admin/AdmissionResult.tsx: per year, one row
 * per class (6–9) with the 1st Result List and two waiting lists as PDFs, upload / edit (pick any
 * of the three PDFs) and delete.
 * Live data: GET/POST/PUT/DELETE /api/admission-result, POST /api/admission-result/upload
 * (presigned direct upload to R2; the server re-checks each key belongs to this school). Files
 * over 50 MB go up in 10 MB parts (multipart/sign-part + complete), as on the web; the save
 * button shows the progress.
 */
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
import { ExternalLink, Pencil, Trash2, Upload } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { openStoredFile } from '@/features/admin/open-file';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import {
  isPdf,
  RESULT_LISTS,
  RESULT_MAX_BYTES,
  formatBytes,
  type AdmissionResultRow,
  type PickedFile,
  type ResultListKey,
} from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import {
  ADMISSION_RESULT_CLASSES,
  admissionResultRows,
  admissionResultSummary,
  dateTimeOf,
  resultYearOptions,
} from './model';

interface ResultForm {
  id: number | null;
  cls: string;
  year: string;
  files: Partial<Record<ResultListKey, PickedFile>>;
  current: AdmissionResultRow | null;
}

export function AdmissionResultScreen() {
  const { admission } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [picked, setPicked] = useState<number | null>(null);
  const [form, setForm] = useState<ResultForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionResultRow | null>(null);

  const settings = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'admission', 'settings'),
    queryFn: ({ signal }) => admission.settings(signal),
  });
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'admission', 'results'),
    queryFn: ({ signal }) => admission.results(signal),
  });
  const all = q.data ?? [];
  const base = settings.data?.year ?? new Date().getFullYear();
  const year = picked ?? base;
  const rows = admissionResultRows(all, year);

  const [progress, setProgress] = useState<string | null>(null);
  const save = useAdminMutation({
    mutationFn: (f: ResultForm) =>
      admission
        .saveResult(
          f.id,
          { class_name: f.cls, admission_year: Number(f.year), files: f.files },
          setProgress,
        )
        .finally(() => setProgress(null)),
    invalidate: [['admission', 'results']],
    success: () =>
      form?.id ? 'Admission result updated successfully' : 'Admission result uploaded successfully',
    failure: 'Failed to upload admission result',
    onSuccess: () => setForm(null),
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => admission.removeResult(id),
    invalidate: [['admission', 'results']],
    success: 'Result deleted successfully',
    failure: 'Failed to delete result',
    onSuccess: () => setDeleteTarget(null),
  });

  const openForm = (cls: string, r: AdmissionResultRow | null) =>
    setForm({
      id: r?.id ?? null,
      cls: r?.class_name ?? cls,
      year: String(r?.admission_year ?? year),
      files: {},
      current: r,
    });
  const submit = () => {
    if (!form) return;
    if (!/^\d{4}$/.test(form.year.trim())) {
      toast.error('Enter a 4-digit admission year');
      return;
    }
    if (!form.id && !Object.values(form.files).some(Boolean)) {
      toast.error('Please upload at least one PDF file');
      return;
    }
    save.mutate(form);
  };
  const pick = (key: ResultListKey, f: PickedFile | null) => {
    if (!form) return;
    if (f && !isPdf(f)) {
      toast.error('Please upload only PDF files');
      return;
    }
    if (f && f.size > RESULT_MAX_BYTES) {
      toast.error(`${f.name} is larger than ${formatBytes(RESULT_MAX_BYTES)}`);
      return;
    }
    const files = { ...form.files };
    if (f) files[key] = f;
    else delete files[key];
    setForm({ ...form, files });
  };
  const open = async (key: string | null) => {
    if (!(await openStoredFile(key))) toast.error('No file stored.');
  };

  type Row = (typeof rows)[number];
  const listCell = (r: Row, key: ResultListKey) => {
    const stored = r.result?.[key];
    return stored ? (
      <Button
        variant="link"
        size="sm"
        icon={ExternalLink}
        label="View PDF"
        onPress={() => void open(stored)}
        className="self-start px-0"
      />
    ) : (
      <Text size="sm" color="mutedForeground">
        Not uploaded
      </Text>
    );
  };
  const actions = (r: Row) =>
    r.result ? (
      <View className="flex-row gap-0.5">
        <ActionButton
          icon={Pencil}
          label={`Edit class ${r.cls} result`}
          tone="emerald"
          onPress={() => openForm(r.cls, r.result)}
        />
        <ActionButton
          icon={Trash2}
          label={`Delete class ${r.cls} result`}
          tone="red"
          onPress={() => setDeleteTarget(r.result)}
        />
      </View>
    ) : (
      <Button
        variant="outline"
        size="sm"
        icon={Upload}
        label="Upload"
        onPress={() => openForm(r.cls, null)}
      />
    );
  const columns: Column<Row>[] = [
    {
      key: 'class',
      label: 'Class',
      className: 'w-24',
      render: (r) => <Text weight="medium">{`Class ${r.cls}`}</Text>,
    },
    ...RESULT_LISTS.map((l): Column<Row> => ({
      key: l.key,
      label: l.label,
      className: 'min-w-0 flex-1',
      render: (r) => listCell(r, l.key),
    })),
    {
      key: 'uploaded',
      label: 'Uploaded',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" color="mutedForeground" tabular>
          {r.result ? dateTimeOf(r.result.created_at) : '—'}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[110px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Admission results"
      description={q.isPending ? 'Loading…' : admissionResultSummary(all, year)}
      titleAccessory={
        <Select
          label="Admission year"
          size="sm"
          value={year}
          options={resultYearOptions(all, base, year).map((y) => ({ value: y, label: String(y) }))}
          onChange={setPicked}
          testID="result-year"
        />
      }
      actions={
        <Button
          icon={Upload}
          label="Upload result"
          onPress={() => openForm('6', null)}
          testID="result-new"
        />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't load admission results"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="admission-results"
          rows={rows}
          columns={columns}
          rowKey={(r) => r.key}
          loading={q.isPending}
          empty="No classes."
          renderMobile={(r) => (
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text weight="medium">{`Class ${r.cls}`}</Text>
                {actions(r)}
              </View>
              {RESULT_LISTS.map((l) => (
                <View key={l.key} className="flex-row items-center justify-between gap-2">
                  <Text size="sm" color="mutedForeground">
                    {l.label}
                  </Text>
                  {listCell(r, l.key)}
                </View>
              ))}
            </View>
          )}
        />
      )}

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : setForm(null))}
        title={form?.id ? 'Edit admission result' : 'Upload admission result'}
        testID="result-form"
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
                save.isPending ? (progress ?? 'Uploading…') : form?.id ? 'Save changes' : 'Upload'
              }
              onPress={submit}
              disabled={save.isPending}
              testID="result-submit"
            />
          </>
        }
      >
        {form ? (
          <>
            <View className="flex-row flex-wrap gap-4">
              <View className="min-w-[140px] flex-1">
                <Field label="Class" required>
                  <Select
                    label="Class"
                    value={form.cls}
                    options={ADMISSION_RESULT_CLASSES.map((c) => ({
                      value: c,
                      label: `Class ${c}`,
                    }))}
                    onChange={(cls) => setForm({ ...form, cls })}
                  />
                </Field>
              </View>
              <View className="min-w-[140px] flex-1">
                <Field label="Admission year" required>
                  <Input
                    value={form.year}
                    onChangeText={(y) =>
                      setForm({ ...form, year: y.replace(/\D/g, '').slice(0, 4) })
                    }
                    keyboardType="number-pad"
                    accessibilityLabel="Admission year"
                  />
                </Field>
              </View>
            </View>
            {RESULT_LISTS.map((l) => (
              <Field
                key={l.key}
                label={`${l.label} PDF`}
                hint="PDF. Files over 50 MB upload in parts."
              >
                <FilePicker
                  label={`${l.label} PDF`}
                  accept="application/pdf,.pdf"
                  value={form.files[l.key] ?? null}
                  onChange={(f) => pick(l.key, f)}
                  currentLabel={form.current?.[l.key] ? 'Current PDF' : undefined}
                  onOpenCurrent={
                    form.current?.[l.key] ? () => void open(form.current![l.key]) : undefined
                  }
                />
              </Field>
            ))}
          </>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete result?"
        message={`Delete the Class ${deleteTarget?.class_name ?? ''} ${deleteTarget?.admission_year ?? ''} result and its PDFs? This cannot be undone.`}
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
}
