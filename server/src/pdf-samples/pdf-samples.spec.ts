import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Generates one sample PDF of every kind the system makes. Run with `pnpm pdf:samples` (sets
// PDF_SAMPLES_DIR); skipped everywhere else, so CI never runs it. No DB: each generator gets fake data.
const OUT = process.env.PDF_SAMPLES_DIR;
const run = OUT ? describe : describe.skip;

// Keep the heavy / DB-bound imports out of the generators' module graph.
jest.unstable_mockModule('@/config/prisma.js', () => ({
  prisma: {},
  rlsTransaction: async (fn: (tx: unknown) => unknown) => fn({}),
}));
jest.unstable_mockModule('@/nest/modules/marksheets/pdf/marksheet-renderer.js', () => ({
  MarksheetRenderer: class {},
}));

// The attendance sheet pulls in a Bull queue and a Redis-cached school lookup: stub both.
jest.unstable_mockModule('@/modules/attendence/attendence-sheet.queue.js', () => ({
  attendanceSheetQueue: {},
  attendanceSheetJobId: () => '',
  defaultJobOpts: {},
  enqueueUserPriority: async () => undefined,
  ensureJobQueued: async () => undefined,
  PRIORITY_BACKFILL: 0,
  PRIORITY_USER: 0,
}));
jest.unstable_mockModule('@/modules/school/school.service.js', () => ({
  SchoolService: {
    getSchoolInfo: async () => ({
      name: 'Panchbibi Model High School',
      upazila: 'Panchbibi',
      district: 'Joypurhat',
      address: 'Not for print',
      phone: '01700000000',
    }),
  },
}));

run('sample PDFs', () => {
  it('writes every kind', async () => {
    const dir = OUT!;
    fs.mkdirSync(dir, { recursive: true });
    const { marksheetSamples } = await import('./marksheet.samples.js');
    const { otherSamples } = await import('./other.samples.js');

    const failures: string[] = [];
    for (const g of [...(await marksheetSamples()), ...(await otherSamples())]) {
      for (const s of g.samples) {
        const label = `${g.group}/${s.name}`;
        try {
          const buffer = Buffer.from(await s.make()); // puppeteer hands back a Uint8Array
          if (!buffer.subarray(0, 5).toString().startsWith('%PDF')) throw new Error('not a PDF');
          const file = path.join(dir, `${g.group}_${s.name}.pdf`);
          fs.writeFileSync(file, buffer);
          console.log(`ok   ${label} (${Math.round(buffer.length / 1024)} KB)`);
        } catch (e) {
          failures.push(label);
          console.log(`FAIL ${label}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 600_000);
});
