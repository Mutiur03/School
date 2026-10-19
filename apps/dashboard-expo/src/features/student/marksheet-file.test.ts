import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPdfBytes, marksheetFileName } from './marksheet-file';

const enc = (s: string) => new TextEncoder().encode(s);

describe('marksheet file', () => {
  it('builds safe file names', () => {
    assert.equal(
      marksheetFileName('Half Yearly Examination', 2026),
      'marksheet-half-yearly-examination-2026.pdf',
    );
    assert.equal(marksheetFileName('../../etc/passwd', 2026), 'marksheet-etc-passwd-2026.pdf');
    assert.equal(marksheetFileName('বার্ষিক', 2026), 'marksheet-exam-2026.pdf');
    assert.equal(
      marksheetFileName('Test/Annual: 2nd?', NaN),
      'marksheet-test-annual-2nd-unknown.pdf',
    );
  });
  it('accepts only real PDFs', () => {
    assert.deepEqual(checkPdfBytes(enc('%PDF-1.7\n...')), { ok: true });
    assert.deepEqual(checkPdfBytes(new Uint8Array()), {
      ok: false,
      message: 'The marksheet file was empty.',
    });
  });
  it('surfaces the server message from a JSON body', () => {
    const r = checkPdfBytes(
      enc('{"success":false,"message":"This result has not been published yet"}'),
    );
    assert.deepEqual(r, { ok: false, message: 'This result has not been published yet' });
  });
  it('rejects HTML with a generic message', () => {
    const r = checkPdfBytes(enc('<html>502</html>'));
    assert.equal(r.ok, false);
  });
});
