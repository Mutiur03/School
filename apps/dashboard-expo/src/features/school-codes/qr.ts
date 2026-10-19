/**
 * QR modules for a school code. The web page renders the same data with `qrcode`'s canvas
 * output (margin 1, error correction M); here the matrix is drawn with react-native-svg so web
 * and native share one renderer. The QR holds only the code; the app's scanner resolves it like
 * a typed code.
 */
import { create } from 'qrcode';

export interface QrMatrix {
  size: number;
  /** Row-major dark flags. */
  dark: boolean[];
}

export function qrMatrix(text: string): QrMatrix {
  const qr = create(text, { errorCorrectionLevel: 'M' });
  const { size, data } = qr.modules;
  return { size, dark: Array.from(data, (v) => v === 1) };
}

/** One SVG path ("M x y h1 v1 h-1 z" per dark module) offset by `margin` modules. */
export function qrPath(m: QrMatrix, margin = 1): string {
  let d = '';
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (m.dark[r * m.size + c]) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return d;
}

export const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', student: 'Student' } as const;
