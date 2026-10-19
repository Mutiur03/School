/**
 * The signed-in teacher's own account, as used by dashboard/src/pages/Teachers/TeacherSettings.tsx
 * and verified against server/src/modules/teacher/teacher.{route,controller,service}.ts:
 *
 *   POST   /api/teachers/change-password      { currentPassword, newPassword }   (teacher only)
 *   POST   /api/teachers/image/upload-url     { id, key, contentType } -> { uploadUrl, key }
 *   PUT    /api/teachers/:id/image            { key }
 *   POST   /api/teachers/signature/upload-url { id, key, contentType } -> { uploadUrl, key }
 *   PUT    /api/teachers/:id/signature        { key }
 *   DELETE /api/teachers/:id/signature
 *
 * Image / signature routes are admin + teacher; for teachers the server refuses any id other than
 * their own (req.user.id), so `id` here is always the session user's id. The school is never
 * sent: the server signs a tenant-prefixed key and re-checks it on save.
 */
import type { ApiClient } from './client';
import { parsePresigned, putToPresignedUrl, type PickedFile } from './uploads';

export const TEACHER_SELF_PATHS = {
  changePassword: '/api/teachers/change-password',
  imageUploadUrl: '/api/teachers/image/upload-url',
  signatureUploadUrl: '/api/teachers/signature/upload-url',
  image: (id: number) => `/api/teachers/${id}/image`,
  signature: (id: number) => `/api/teachers/${id}/signature`,
} as const;

export type TeacherFileKind = 'image' | 'signature';

/** Same limits as the web settings page. */
export const TEACHER_FILE_LIMITS: Record<TeacherFileKind, { maxBytes: number; label: string }> = {
  image: { maxBytes: 2 * 1024 * 1024, label: '2MB' },
  signature: { maxBytes: 1 * 1024 * 1024, label: '1MB' },
};

/** null when the file can be uploaded, else the message the web page shows. */
export function checkTeacherFile(kind: TeacherFileKind, file: Pick<PickedFile, 'type' | 'size'>) {
  if (!file.type.startsWith('image/')) return 'Please select an image file';
  const { maxBytes, label } = TEACHER_FILE_LIMITS[kind];
  if (file.size > maxBytes) return `File size must be less than ${label}`;
  return null;
}

/** Object name the web page asks for (the server re-prefixes it, and renames signatures). */
export function teacherFileKey(
  kind: TeacherFileKind,
  id: number,
  file: PickedFile,
  now = Date.now(),
) {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'png';
  return kind === 'image' ? `${id}-${now}.${ext}` : `${id}-signature-${now}.${ext}`;
}

export function createTeacherSelfApi(client: ApiClient, fetchImpl?: typeof fetch) {
  return {
    changePassword(body: { currentPassword: string; newPassword: string }) {
      return client.post<unknown>(TEACHER_SELF_PATHS.changePassword, body);
    },
    /** Presign, upload straight to storage, then save the key on the teacher. */
    async uploadFile(kind: TeacherFileKind, id: number, file: PickedFile): Promise<string> {
      const presignPath =
        kind === 'image'
          ? TEACHER_SELF_PATHS.imageUploadUrl
          : TEACHER_SELF_PATHS.signatureUploadUrl;
      const data = await client.post<unknown>(presignPath, {
        id,
        key: teacherFileKey(kind, id, file),
        contentType: file.type,
      });
      const { uploadUrl, key } = parsePresigned(data, presignPath);
      await putToPresignedUrl(uploadUrl, file, fetchImpl);
      const savePath =
        kind === 'image' ? TEACHER_SELF_PATHS.image(id) : TEACHER_SELF_PATHS.signature(id);
      await client.put<unknown>(savePath, { key });
      return key;
    },
    removeImage(id: number) {
      return client.delete<unknown>(TEACHER_SELF_PATHS.image(id));
    },
    removeSignature(id: number) {
      return client.delete<unknown>(TEACHER_SELF_PATHS.signature(id));
    },
  };
}

export type TeacherSelfApi = ReturnType<typeof createTeacherSelfApi>;
