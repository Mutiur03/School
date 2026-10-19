/** Native: write the bytes to the cache directory and open the system share / open-with sheet. */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SaveFileResult = 'saved' | 'unavailable';

export async function saveFile(
  bytes: ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<SaveFileResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(bytes));
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
  return 'saved';
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
