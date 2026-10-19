/**
 * Pure helpers shared by the native and web file pickers (tested in node): what an `accept`
 * string asks for, the MIME types to hand the document picker, and a type / name for a picked
 * asset when the OS doesn't report one.
 */

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
};

const parts = (accept: string) =>
  accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** True when every accepted entry is an image (then the photo library is the right picker). */
export function acceptsOnlyImages(accept: string): boolean {
  const p = parts(accept);
  return (
    p.length > 0 &&
    p.every(
      (a) =>
        a.startsWith('image/') || (a.startsWith('.') && EXT_MIME[a.slice(1)]?.startsWith('image/')),
    )
  );
}

/**
 * MIME types for expo-document-picker. Extensions are mapped; spreadsheets also allow
 * `application/octet-stream` because some Android file providers report .xlsx that way (the
 * screens still check the extension). Nothing usable → any file.
 */
export function documentPickerTypes(accept: string): string[] {
  const out = new Set<string>();
  for (const a of parts(accept)) {
    if (a.startsWith('.')) {
      const m = EXT_MIME[a.slice(1)];
      if (m) out.add(m);
    } else if (a.includes('/')) out.add(a);
    if (a === '.xlsx' || a === '.xls' || a.includes('spreadsheet') || a.includes('ms-excel'))
      out.add('application/octet-stream');
  }
  return out.size ? [...out] : ['*/*'];
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.split(/[?#]/)[0] ?? '');
  return m ? m[1]!.toLowerCase() : '';
}

/** The reported type, else one guessed from the file name, else octet-stream. */
export function mimeFor(name: string, reported?: string | null): string {
  if (reported && reported !== 'application/octet-stream') return reported;
  return EXT_MIME[extensionOf(name)] ?? reported ?? 'application/octet-stream';
}

/** A file name for an asset: the reported one, else the last URI segment, else a dated default. */
export function nameFor(uri: string, reported?: string | null, now = Date.now()): string {
  if (reported && reported.trim()) return reported.trim();
  const last = decodeURIComponent(uri.split(/[?#]/)[0]!.split('/').pop() ?? '');
  return last && /\.[a-z0-9]+$/i.test(last) ? last : `file-${now}`;
}
