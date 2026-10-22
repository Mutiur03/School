/**
 * Direct-to-R2 uploads, as in dashboard/src/lib/uploadToR2.ts: the server signs a PUT URL for a
 * tenant-prefixed key (GET .../presigned-url, admin only), the file goes straight to storage with
 * no auth header or cookies, and the key is then saved through the normal endpoint, which
 * re-checks that it belongs to this school (assertTenantR2Key).
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { isObj } from './parse';

/** A file picked by the user. Only the web build can produce one for now (see FilePicker). */
export interface PickedFile {
  name: string;
  type: string;
  size: number;
  body: Blob;
  /** Native only: the cached file the pickers returned (read with expo-file-system). */
  uri?: string;
}

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
}

export function parsePresigned(v: unknown, path: string): PresignedUpload {
  if (isObj(v) && typeof v.uploadUrl === 'string' && typeof v.key === 'string' && v.key) {
    return { uploadUrl: v.uploadUrl, key: v.key };
  }
  throw new ApiError({ kind: 'parse', message: 'Invalid presigned URL response.', path });
}

/** Percent (0-100) of the upload in flight, null when idle. Read with useUploadPercent(). */
export const uploadProgress = (() => {
  let value: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: number | null) {
      if (next === value) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
})();

/** PUT with progress events (fetch has none). Resolves like a fetch Response status check. */
function xhrPut(uploadUrl: string, file: PickedFile): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        uploadProgress.set(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new ApiError({
              kind: 'http',
              status: xhr.status,
              message: `Upload failed (${xhr.status}).`,
            }),
          );
    xhr.onerror = () =>
      reject(new ApiError({ kind: 'network', message: 'Upload failed. Check your connection.' }));
    xhr.ontimeout = xhr.onerror;
    xhr.send(file.body as unknown as XMLHttpRequestBodyInit);
  });
}

export async function putToPresignedUrl(
  uploadUrl: string,
  file: PickedFile,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Promise<Response> {
  const doFetch = fetchImpl;
  let res: Response;
  try {
    res = await doFetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file.body,
      credentials: 'omit',
    });
  } catch (cause) {
    throw new ApiError({
      kind: 'network',
      message: 'Upload failed. Check your connection.',
      cause,
    });
  }
  if (!res.ok) {
    throw new ApiError({
      kind: 'http',
      status: res.status,
      message: `Upload failed (${res.status}).`,
    });
  }
  return res;
}

/** Presign with `query` (filename + contentType + extras), upload, return the stored key. */
export async function uploadViaPresign(
  client: ApiClient,
  presignPath: string,
  file: PickedFile,
  extra: Record<string, string> = {},
  fetchImpl?: typeof fetch,
): Promise<string> {
  const data = await client.get<unknown>(presignPath, {
    query: { filename: file.name, contentType: file.type, ...extra },
  });
  const { uploadUrl, key } = parsePresigned(data, presignPath);
  if (!fetchImpl && typeof XMLHttpRequest !== 'undefined') {
    // Real uploads report progress (XHR); tests inject their own fetch instead.
    uploadProgress.set(0);
    try {
      await xhrPut(uploadUrl, file);
    } finally {
      uploadProgress.set(null);
    }
  } else {
    await putToPresignedUrl(uploadUrl, file, fetchImpl);
  }
  return key;
}
