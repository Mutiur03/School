import axios from "axios";

/** PUT to presigned R2/S3 URL — no cookies, no auth header. */
export async function putFileToPresignedUrl(
  uploadUrl: string,
  file: File | Blob,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: { "Content-Type": contentType },
    withCredentials: false,
    transformRequest: [
      (data, headers) => {
        delete headers?.["Authorization"];
        return data;
      },
    ],
    onUploadProgress: onProgress
      ? (e) => {
          const pct = Math.round((e.loaded * 100) / (e.total ?? e.loaded));
          onProgress(pct);
        }
      : undefined,
  });
}

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
  const { data: body } = await axios.get(presignEndpoint, {
    params: { filename: file.name, contentType: file.type },
  });

  const { uploadUrl, key } = body?.data ?? body;

  if (!uploadUrl || !key) {
    throw new Error("Invalid presigned URL response from server");
  }

  await putFileToPresignedUrl(uploadUrl, file, file.type, onProgress);

  return key;
}
