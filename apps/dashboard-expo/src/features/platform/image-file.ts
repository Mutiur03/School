/**
 * Picked image → preview URI and pixel size, for the branding rules (IMAGE_RULES). Native files
 * already have a cache URI; on web a temporary object URL is made from the File and revoked when
 * the preview goes away.
 */
import { Image, Platform } from 'react-native';
import type { PickedFile } from '@/lib/api';
import { validateImageDimensions, validateImageFile, type ImageKind } from './model';

export function previewUri(file: PickedFile): string {
  if (file.uri) return file.uri;
  return URL.createObjectURL(file.body);
}

export function releasePreview(uri: string | null | undefined) {
  if (uri && Platform.OS === 'web' && uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}

export function readImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (e) => reject(e instanceof Error ? e : new Error('Unable to read image')),
    ),
  );
}

/** null when the file passes the rules (type, size, dimensions); otherwise the message. */
export async function checkImage(
  file: PickedFile,
  uri: string,
  kind: ImageKind,
): Promise<string | null> {
  const basic = validateImageFile(file, kind);
  if (basic) return basic;
  try {
    return validateImageDimensions(await readImageSize(uri), kind);
  } catch {
    return `Unable to read ${kind === 'header' ? 'header logo' : kind} image`;
  }
}
