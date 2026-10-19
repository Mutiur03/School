/**
 * Native file picking: expo-image-picker (system photo picker) when only images are accepted,
 * expo-document-picker otherwise. Each asset becomes a PickedFile whose `body` is an RN Blob
 * read from the cached copy (so presigned PUTs work as on web) and whose `uri` lets
 * `readPickedBytes` read the bytes through expo-file-system (RN's Blob has no arrayBuffer()).
 * The Android photo picker and iOS PHPicker need no library permission; the permission text in
 * app.config.ts covers older Android versions.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import type { PickedFile } from '@/lib/api/uploads';
import { acceptsOnlyImages, documentPickerTypes, mimeFor, nameFor } from './pick-model';

async function toPicked(
  uri: string,
  name: string | null | undefined,
  type: string | null | undefined,
  size: number | null | undefined,
): Promise<PickedFile> {
  const body = await (await fetch(uri)).blob();
  const fileName = nameFor(uri, name);
  return {
    name: fileName,
    type: mimeFor(fileName, type ?? body.type),
    size: size ?? body.size,
    body,
    uri,
  };
}

export async function pickFiles(
  accept: string,
  opts: { multiple?: boolean } = {},
): Promise<PickedFile[]> {
  const multiple = !!opts.multiple;
  if (acceptsOnlyImages(accept)) {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? 0 : 1,
      quality: 1,
    });
    if (res.canceled) return [];
    return Promise.all(res.assets.map((a) => toPicked(a.uri, a.fileName, a.mimeType, a.fileSize)));
  }
  const res = await DocumentPicker.getDocumentAsync({
    type: documentPickerTypes(accept),
    multiple,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];
  return Promise.all(res.assets.map((a) => toPicked(a.uri, a.name, a.mimeType, a.size)));
}

export async function pickFile(accept: string): Promise<PickedFile | null> {
  return (await pickFiles(accept))[0] ?? null;
}

/** The picked file's bytes (spreadsheet import). */
export async function readPickedBytes(file: PickedFile): Promise<ArrayBuffer> {
  if (file.uri) return new File(file.uri).arrayBuffer();
  return file.body.arrayBuffer();
}
