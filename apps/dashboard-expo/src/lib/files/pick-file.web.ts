/** Web: a throwaway `<input type="file">`, resolved with the chosen files (empty on cancel). */
import type { PickedFile } from '@/lib/api/uploads';

export function pickFiles(
  accept: string,
  opts: { multiple?: boolean } = {},
): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = !!opts.multiple;
    input.style.display = 'none';
    input.setAttribute('data-testid', 'file-picker-input');
    const done = (files: PickedFile[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => {
      done(
        Array.from(input.files ?? []).map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          body: f as Blob,
        })),
      );
    });
    input.addEventListener('cancel', () => done([]));
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickFile(accept: string): Promise<PickedFile | null> {
  return (await pickFiles(accept))[0] ?? null;
}

export async function readPickedBytes(file: PickedFile): Promise<ArrayBuffer> {
  return file.body.arrayBuffer();
}
