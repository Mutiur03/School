/** Web only: drop files on a view to pick them (no-op on native). */
import { useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';
import { matchesAccept } from '@/lib/files/accept';
import type { PickedFile } from '@/lib/api/uploads';

export function useDropZone(
  accept: string,
  onFiles: (files: PickedFile[]) => void,
  opts: { multiple?: boolean; disabled?: boolean } = {},
) {
  const ref = useRef<View>(null);
  const [over, setOver] = useState(false);
  const handler = useRef(onFiles);
  handler.current = onFiles;
  const { multiple, disabled } = opts;

  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el || typeof el.addEventListener !== 'function' || disabled) {
      return;
    }
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const enter = (e: Event) => {
      stop(e);
      setOver(true);
    };
    const leave = (e: Event) => {
      stop(e);
      setOver(false);
    };
    const drop = (e: DragEvent) => {
      stop(e);
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? [])
        .filter((f) => matchesAccept(f, accept))
        .map((f) => ({ name: f.name, type: f.type, size: f.size, body: f as Blob }));
      if (files.length) handler.current(multiple ? files : files.slice(0, 1));
    };
    el.addEventListener('dragenter', enter);
    el.addEventListener('dragover', enter);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => {
      el.removeEventListener('dragenter', enter);
      el.removeEventListener('dragover', enter);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
    };
  }, [accept, multiple, disabled]);

  return { ref, over };
}
