import path from 'path';
import { getUploadUrl } from '@/config/r2.js';

const FOLDER_BY_KIND: Record<string, string> = {
  logo: 'logos',
  header: 'headers',
  banner: 'banners',
  hotline: 'hotlines',
};

/** Presigned PUT for a school branding image: `schools/<folder>/<ms>-<safe-name><ext>`. */
export async function schoolAssetUploadUrl(
  fileName: string,
  contentType: string,
  rawKind?: string,
) {
  const kind = FOLDER_BY_KIND[String(rawKind || 'logo')] ? String(rawKind || 'logo') : 'logo';
  const ext = path.extname(fileName) || '.png';
  const base = path.basename(fileName, ext).replace(/[^a-zA-Z0-9-_]/g, '-');
  const key = `schools/${FOLDER_BY_KIND[kind]}/${Date.now()}-${base}${ext}`;
  const uploadUrl = await getUploadUrl(key, contentType);
  return { uploadUrl, key, kind };
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
