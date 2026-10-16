import { PDFDocument } from 'pdf-lib';

/**
 * Concatenate ordered per-student marksheet PDFs into one class bundle.
 * Each buffer may be one or more pages; page order within each file is kept.
 */
export async function mergeMarksheetPdfs(pdfBuffers: Buffer[]): Promise<Buffer> {
  if (pdfBuffers.length === 0) {
    throw new Error('No non-null marks found for any student in this class.');
  }

  const out = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) {
      out.addPage(page);
    }
  }

  const bytes = await out.save();
  return Buffer.from(bytes);
}
