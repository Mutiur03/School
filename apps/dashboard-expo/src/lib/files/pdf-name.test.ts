import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPdfUrl, pdfFileName, pdfNameFromUrl } from './pdf-name';

test('isPdfUrl / pdfNameFromUrl: CDN notice URLs', () => {
  assert.equal(isPdfUrl('https://cdn.x/notices/a.PDF?v=1'), true);
  assert.equal(isPdfUrl('https://cdn.x/teachers/p.jpg'), false);
  assert.equal(
    pdfNameFromUrl('https://cdn.x/notices/1712345678901-Exam%20Routine.pdf?v=1'),
    pdfFileName(['Exam Routine']),
  );
  assert.ok(pdfNameFromUrl('https://cdn.x/%E0%A4%ZZ.pdf').endsWith('.pdf'));
});
