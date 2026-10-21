export type PdfSample = { name: string; buffer: Buffer };
/** A group of samples; each generator runs on its own so one failure does not hide the rest. */
export type PdfSampleGroup = {
  group: string;
  samples: { name: string; make: () => Promise<Buffer> }[];
};
