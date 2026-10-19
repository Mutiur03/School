/** UI pieces shared by the batch-6 content screens. */
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { PickFilesButton } from '@/components/ui/FilePicker';
import { Icon } from '@/components/ui/Icon';
import { Download, ExternalLink, FileText, Trash2 } from '@/components/ui/icons';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { openStoredFile, viewStoredPdf } from '@/features/admin/open-file';
import { fileUrl } from '@/features/student/components';
import { openPdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { saveFile } from '@/lib/files/save-file';
import { isPdf, type PickedFile, type SiteDoc } from '@/lib/api';
import { dayOf, fileNameOf } from './model';
import { PdfPreview } from './PdfPreview';

/** Single-flight file downloads (PDF tabs, server-built .xlsx/.zip) with toasts. */
export function useFileTasks() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const run = async (
    id: string,
    task: () => Promise<'opened' | 'saved' | 'unavailable'>,
    fail: string,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(id);
    try {
      const r = await task();
      if (r === 'unavailable') toast.error("This device can't open or save the file.");
    } catch (e) {
      toast.error(mutationErrorMessage(e, fail));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  return {
    busy,
    pdf: (id: string, load: () => Promise<ArrayBuffer>, name: string, fail: string) =>
      void run(id, () => openPdf(load, name), fail),
    save: (
      id: string,
      load: () => Promise<ArrayBuffer>,
      name: string,
      mime: string,
      fail: string,
    ) => void run(id, async () => saveFile(await load(), name, mime), fail),
  };
}

export const ZIP_MIME = 'application/zip';

/**
 * One stored PDF (citizen charter, class routine): file card with View / Download / Replace /
 * Remove, or an upload button when empty.
 */
export function PdfSlot({
  label,
  doc,
  busy,
  onUpload,
  onRemove,
  testID,
}: {
  label: string;
  doc: SiteDoc | null;
  busy: boolean;
  onUpload: (file: PickedFile) => void;
  onRemove?: () => void;
  testID?: string;
}) {
  const toast = useToast();
  const pick = (files: PickedFile[]) => {
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) {
      toast.error('Please select a PDF file.');
      return;
    }
    onUpload(f);
  };
  const open = async (key: string) => {
    if (!(await openStoredFile(key))) toast.error('No file stored.');
  };
  const view = async (key: string) => {
    const name = pdfFileName([fileNameOf(key).replace(/\.pdf$/i, '') || label]);
    if (!(await viewStoredPdf(key, name))) toast.error('No file stored.');
  };
  if (!doc) {
    return (
      <View
        testID={testID}
        className="border-border items-center gap-3 rounded-xl border border-dashed px-4 py-10"
      >
        <Icon icon={FileText} size={28} color="mutedForeground" />
        <View className="items-center">
          <Text weight="medium">{`Upload ${label} PDF`}</Text>
          <Text size="sm" color="mutedForeground">
            Not uploaded
          </Text>
        </View>
        <PickFilesButton
          accept="application/pdf,.pdf"
          label={busy ? 'Uploading…' : 'Choose PDF'}
          disabled={busy}
          onPick={pick}
          testID={testID ? `${testID}-upload` : undefined}
        />
      </View>
    );
  }
  const previewUrl = fileUrl(doc.viewKey);
  return (
    <View className="gap-3">
      <View
        testID={testID}
        className="border-border bg-card flex-row flex-wrap items-center gap-3 rounded-xl border p-4"
      >
        <View className="bg-primary/10 h-11 w-11 items-center justify-center rounded-lg">
          <Icon icon={FileText} size={22} color="primary" />
        </View>
        <View className="min-w-[160px] flex-1">
          <Text weight="medium" numberOfLines={1}>
            {fileNameOf(doc.viewKey)}
          </Text>
          <Text size="xs" color="mutedForeground">
            {doc.at ? `Updated ${dayOf(doc.at)}` : 'Stored PDF'}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            icon={ExternalLink}
            label="View"
            onPress={() => void view(doc.viewKey)}
          />
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            label="Download"
            onPress={() => void open(doc.downloadKey)}
          />
          <PickFilesButton
            accept="application/pdf,.pdf"
            variant="outline"
            size="sm"
            label={busy ? 'Uploading…' : 'Replace'}
            disabled={busy}
            onPick={pick}
            testID={testID ? `${testID}-replace` : undefined}
          />
          {onRemove ? (
            <Button
              variant="outline"
              size="sm"
              icon={Trash2}
              label="Remove"
              onPress={onRemove}
              disabled={busy}
            />
          ) : null}
        </View>
      </View>
      {previewUrl ? (
        <PdfPreview
          url={previewUrl}
          title={`${label} PDF`}
          testID={testID ? `${testID}-preview` : undefined}
        />
      ) : null}
    </View>
  );
}

/** Label / value grid for details dialogs. */
export function DetailGrid({
  items,
}: {
  items: readonly (readonly [string, string | null | undefined])[];
}) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return null;
  return (
    <View className="flex-row flex-wrap gap-y-3">
      {shown.map(([label, value]) => (
        <View key={label} className="w-full pr-3 sm:w-1/2">
          <Text size="xs" color="mutedForeground">
            {label}
          </Text>
          <Text size="sm" selectable>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}
