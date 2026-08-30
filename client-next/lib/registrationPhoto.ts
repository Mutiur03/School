/** Fixed registration photo dimensions (width × height). */
export const REG_PHOTO_WIDTH = 300;
export const REG_PHOTO_HEIGHT = 330;
export const REG_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const REG_PHOTO_SIZE_LABEL = `${REG_PHOTO_WIDTH}×${REG_PHOTO_HEIGHT} px`;

export type RegistrationPhotoCheck =
  { ok: true; width: number; height: number } | { ok: false; message: string };

function isJpegFile(file: File): boolean {
  if (!/\.jpe?g$/i.test(file.name)) return false;
  // Some browsers leave type empty; extension already required above.
  if (!file.type) return true;
  return file.type === 'image/jpeg' || file.type === 'image/jpg';
}

/** JPG, max 2MB, exact 300×330 px. */
export function checkRegistrationPhoto(file: File): Promise<RegistrationPhotoCheck> {
  if (!isJpegFile(file)) {
    return Promise.resolve({
      ok: false,
      message: 'Only JPG/JPEG images are allowed.',
    });
  }
  if (file.size > REG_PHOTO_MAX_BYTES) {
    return Promise.resolve({
      ok: false,
      message: 'File is too large! Maximum allowed size is 2MB.',
    });
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width !== REG_PHOTO_WIDTH || img.height !== REG_PHOTO_HEIGHT) {
        resolve({
          ok: false,
          message: `Image must be exactly ${REG_PHOTO_SIZE_LABEL} (got ${img.width}×${img.height}).`,
        });
        return;
      }
      resolve({ ok: true, width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, message: 'Could not read image file.' });
    };
    img.src = url;
  });
}
