import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NO_VIEWER_NOTICE, pdfNotice, setPdfNoticeSink } from './pdf-notice';
import {
  ACTION_VIEW,
  FLAG_GRANT_READ_URI_PERMISSION,
  launchOrDetect,
  viewIntent,
} from './pdf-view-model';

test('ACTION_VIEW intent: content URI, PDF type, read-grant flag', () => {
  assert.equal(ACTION_VIEW, 'android.intent.action.VIEW');
  assert.equal(FLAG_GRANT_READ_URI_PERMISSION, 0x1);
  assert.deepEqual(viewIntent('content://x/cache/a.pdf'), {
    data: 'content://x/cache/a.pdf',
    type: 'application/pdf',
    flags: 1,
  });
});

test('launchOrDetect: an immediate rejection (no viewer app) is reported as no-viewer', async () => {
  const r = await launchOrDetect(() => Promise.reject(new Error('No Activity found')), 200);
  assert.equal(r, 'no-viewer');
});

test('launchOrDetect: a launch still pending after the window means the viewer is open', async () => {
  let settle!: (e: Error) => void;
  const pending = new Promise((_, rej) => (settle = rej));
  const t0 = Date.now();
  const r = await launchOrDetect(() => pending, 30);
  assert.equal(r, 'opened');
  assert.ok(Date.now() - t0 >= 25);
  settle(new Error('closed later')); // a late rejection is swallowed (no unhandled rejection)
  await new Promise((res) => setTimeout(res, 5));
});

test('launchOrDetect: a launch that resolves (viewer closed quickly) is opened', async () => {
  assert.equal(await launchOrDetect(() => Promise.resolve({ resultCode: 0 }), 200), 'opened');
});

test('pdfNotice: goes to the registered sink only', () => {
  const seen: string[] = [];
  pdfNotice('dropped');
  setPdfNoticeSink((m) => seen.push(m));
  pdfNotice(NO_VIEWER_NOTICE);
  setPdfNoticeSink(null);
  pdfNotice('dropped too');
  assert.deepEqual(seen, [NO_VIEWER_NOTICE]);
});
