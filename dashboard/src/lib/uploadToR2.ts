import axios from "axios";

/**
 * Upload a file directly to R2 using a presigned URL.
 *
 * @param presignEndpoint  - e.g. "/api/exams/presigned-url"
 * @param file             - the File to upload
 * @param onProgress       - optional callback with 0-100 progress
 * @returns { key }        - the R2 object key to save in the DB
 */
export async function uploadToR2(
  presignEndpoint: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // 1. Get presigned PUT URL from backend
  const { data } = await axios.get<{ uploadUrl: string; key: string }>(
    presignEndpoint,
    { params: { filename: file.name, contentType: file.type } },
  );

  const { uploadUrl, key } = data;

  // 2. PUT directly to R2 (no auth header — presigned URL is self-authenticating)
  await axios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type },
    // Strip the Authorization header so it doesn't clash with the presigned signature
    transformRequest: [
      (data, headers) => {
        delete headers?.["Authorization"];
        return data;
      },
    ],
    onUploadProgress: (e) => {
      if (onProgress) {
        const pct = Math.round((e.loaded * 100) / (e.total ?? e.loaded));
        onProgress(pct);
      }
    },
  });

  return key;
}
