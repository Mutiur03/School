import { StreamableFile } from '@nestjs/common';

/** PDF response (passed through ResponseInterceptor unwrapped). */
export const pdfFile = (buffer: Buffer, filename: string, disposition = 'inline') =>
  new StreamableFile(buffer, {
    type: 'application/pdf',
    disposition: `${disposition}; filename="${filename}"`,
  });
