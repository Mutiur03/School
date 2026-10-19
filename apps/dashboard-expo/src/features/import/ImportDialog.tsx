/**
 * "Import from Excel" dialog for the student and subject lists: download the template, pick an
 * .xlsx (file picker on web, document picker on native), read it on the device
 * (src/lib/files/xlsx.ts), check every row like the web page, then upload in one request.
 * Nothing is sent until every row passes; the server validates again.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { PickFilesButton } from '@/components/ui/FilePicker';
import { Icon } from '@/components/ui/Icon';
import { AlertCircle, Download, FileText } from '@/components/ui/icons';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import type { PickedFile } from '@/lib/api';
import { readPickedBytes } from '@/lib/files/pick-file';
import { saveFile, XLSX_MIME } from '@/lib/files/save-file';
import { buildXlsx, readXlsxRows, SpreadsheetError } from '@/lib/files/xlsx';
import type { ImportResult } from './models';

export const XLSX_ACCEPT =
  '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function ImportDialog<T>({
  open,
  onClose,
  title,
  noun,
  requiredColumns,
  template,
  parse,
  onUpload,
  busy,
  testID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Singular, e.g. "student". */
  noun: string;
  requiredColumns: readonly string[];
  template: { fileName: string; sheet: string; rows: string[][] };
  parse: (rows: string[][]) => ImportResult<T>;
  onUpload: (rows: T[]) => void;
  busy: boolean;
  testID?: string;
}) {
  const toast = useToast();
  const [file, setFile] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult<T> | null>(null);
  const [reading, setReading] = useState(false);
  const plural = (n: number) => `${n} ${noun}${n === 1 ? '' : 's'}`;

  const reset = () => {
    setFile(null);
    setResult(null);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };
  const read = async (f: PickedFile) => {
    reset();
    if (!/\.xlsx$/i.test(f.name)) {
      toast.error('Choose an .xlsx file (Excel Workbook).');
      return;
    }
    setReading(true);
    try {
      const rows = readXlsxRows(await readPickedBytes(f));
      setFile(f.name);
      setResult(parse(rows));
    } catch (e) {
      toast.error(e instanceof SpreadsheetError ? e.message : 'Failed to read spreadsheet');
    } finally {
      setReading(false);
    }
  };
  const downloadTemplate = async () => {
    const bytes = buildXlsx(template.sheet, template.rows);
    const copy = bytes.slice().buffer;
    if ((await saveFile(copy, template.fileName, XLSX_MIME)) === 'unavailable')
      toast.error("Couldn't save the template on this device.");
  };

  const errors = result && !result.ok ? result.errors : [];
  const ready = result && result.ok ? result.rows : null;
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description="Rows are checked on this device before anything is uploaded."
      testID={testID}
      footer={
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" label="Cancel" onPress={close} disabled={busy} />
          <Button
            label={busy ? 'Uploading…' : ready ? `Upload ${plural(ready.length)}` : 'Upload'}
            disabled={!ready || busy}
            onPress={() => ready && onUpload(ready)}
            testID={testID ? `${testID}-submit` : undefined}
          />
        </View>
      }
    >
      <View className="gap-4">
        <View className="gap-1">
          <Text size="sm" weight="medium">
            Required columns
          </Text>
          <Text size="sm" color="mutedForeground">
            {requiredColumns.join(', ')}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <PickFilesButton
            accept={XLSX_ACCEPT}
            label={reading ? 'Reading…' : file ? 'Choose another file' : 'Choose Excel file'}
            disabled={reading || busy}
            onPick={(files) => files[0] && void read(files[0])}
            testID={testID ? `${testID}-pick` : undefined}
          />
          <Button
            variant="outline"
            icon={Download}
            label="Download template"
            onPress={() => void downloadTemplate()}
          />
        </View>
        {file ? (
          <View className="border-border flex-row items-center gap-3 rounded-lg border p-3">
            <Icon icon={FileText} size={18} color="primary" />
            <View className="min-w-0 flex-1">
              <Text size="sm" weight="medium" numberOfLines={1}>
                {file}
              </Text>
              <Text size="xs" color={ready ? 'mutedForeground' : 'destructive'}>
                {ready
                  ? `${plural(ready.length)} ready to upload`
                  : `${errors.length} problem${errors.length === 1 ? '' : 's'} to fix`}
              </Text>
            </View>
          </View>
        ) : null}
        {errors.length ? (
          <View className="border-destructive/30 bg-destructive/5 gap-1 rounded-lg border p-3">
            {errors.slice(0, 5).map((e) => (
              <View key={e} className="flex-row gap-2">
                <Icon icon={AlertCircle} size={14} color="destructive" />
                <Text size="xs" className="flex-1">
                  {e}
                </Text>
              </View>
            ))}
            {errors.length > 5 ? (
              <Text size="xs" color="mutedForeground">
                …and {errors.length - 5} more.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Dialog>
  );
}
