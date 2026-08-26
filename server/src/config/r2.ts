import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '@/config/env.js';

const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = env.R2_BUCKET_NAME;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

export const getUploadUrl = async (key: string, contentType: string) => {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
};

export const createMultipartUpload = async (key: string, contentType: string) => {
  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const { UploadId } = await r2Client.send(command);
  return UploadId;
};

export const getMultipartPartUrl = async (key: string, uploadId: string, partNumber: number) => {
  const command = new UploadPartCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
};

export const completeMultipartUpload = async (key: string, uploadId: string, parts: any[]) => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });
  return await r2Client.send(command);
};

export const getDownloadUrl = async (key: string) => {
  if (env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL}/${key}`;
  }
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
};

export const deleteFromR2 = async (key: string) => {
  if (!key) return;
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }),
    );
  } catch (error) {
    console.error('Error deleting from R2:', error);
  }
};

/** Upload a buffer directly (server-side put; no presign round-trip). */
export const uploadToR2 = async (key: string, body: Buffer, contentType = 'application/pdf') => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

/** True if the object exists. Cheap (metadata only). */
export const headObject = async (key: string): Promise<boolean> => {
  if (!key) return false;
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (error: any) {
    if (
      error.name === 'NotFound' ||
      error.name === 'NoSuchKey' ||
      error.$metadata?.httpStatusCode === 404
    ) {
      return false;
    }
    throw error;
  }
};

/**
 * Object ETag (content identity). Detects in-place overwrites at the same key
 * that a path-only fingerprint would miss.
 */
export const headObjectEtag = async (key: string): Promise<string | null> => {
  if (!key) return null;
  try {
    const res = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return res.ETag ?? null;
  } catch (error: any) {
    if (
      error.name === 'NotFound' ||
      error.name === 'NoSuchKey' ||
      error.$metadata?.httpStatusCode === 404
    ) {
      return null;
    }
    throw error;
  }
};

/** List object keys under a prefix (paginated). For reconciliation sweeps. */
export const listKeys = async (prefix: string): Promise<string[]> => {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
};

export const getFileBuffer = async (
  key: string,
  options?: { quiet?: boolean },
): Promise<Buffer | null> => {
  if (!key) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    const response = await r2Client.send(command);
    if (!response.Body) return null;
    const bodyContents = await response.Body.transformToByteArray();
    return Buffer.from(bodyContents);
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      if (!options?.quiet) {
        console.warn(`File not found in R2: ${key}`);
      }
    } else {
      console.error(`Error fetching file from R2 (${key}):`, error);
    }
    return null;
  }
};

/**
 * Load an R2 object, trying the stored key and a school-prefixed variant
 * (legacy rows sometimes omit / include the tenant prefix).
 * Also tries class6/class8 ↔ class-6/class-8 path aliases for registration media.
 */
export const resolveR2FileBuffer = async (
  key: string,
  schoolId?: number | null,
): Promise<Buffer | null> => {
  if (!key) return null;
  const normalized = key.replace(/^\/+/, '');
  const withClassAlias = (value: string) => {
    const aliases = [value];
    if (value.includes('/registrations/class6/') || value.startsWith('registrations/class6/')) {
      aliases.push(value.replace(/registrations\/class6\//g, 'registrations/class-6/'));
    }
    if (value.includes('/registrations/class8/') || value.startsWith('registrations/class8/')) {
      aliases.push(value.replace(/registrations\/class8\//g, 'registrations/class-8/'));
    }
    if (value.includes('/registrations/class-6/') || value.startsWith('registrations/class-6/')) {
      aliases.push(value.replace(/registrations\/class-6\//g, 'registrations/class6/'));
    }
    if (value.includes('/registrations/class-8/') || value.startsWith('registrations/class-8/')) {
      aliases.push(value.replace(/registrations\/class-8\//g, 'registrations/class8/'));
    }
    return aliases;
  };

  const candidates = [...withClassAlias(normalized)];

  if (Number.isInteger(schoolId)) {
    const prefix = `${schoolId}/`;
    if (normalized.startsWith(prefix)) {
      candidates.push(...withClassAlias(normalized.slice(prefix.length)));
    } else {
      candidates.push(...withClassAlias(`${prefix}${normalized}`));
    }
  }

  const tried = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || tried.has(candidate)) continue;
    tried.add(candidate);
    const buffer = await getFileBuffer(candidate, { quiet: true });
    if (buffer?.length) return buffer;
  }

  console.warn(`File not found in R2: ${normalized}`);
  return null;
};

export { r2Client };
