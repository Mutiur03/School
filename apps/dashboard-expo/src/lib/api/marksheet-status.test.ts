import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { createMarksApi } from './marks';
import {
  formatBundleScope,
  genPanelView,
  isGenComplete,
  isQueueActive,
  marksheetPollMs,
  parseMarksheetStatus,
} from './marksheet-status';

const zero = { pending: 0, generating: 0, ready: 0, failed: 0, skipped: 0, total: 0, done: 0 };
const make = (top: Partial<typeof zero>, bundles: Record<string, unknown> = {}) =>
  parseMarksheetStatus({ ...zero, ...top, bundles: { ...zero, ...bundles } });

describe('marksheet generation status', () => {
  it('parses defensively', () => {
    const s = parseMarksheetStatus({
      total: 10,
      done: '4',
      pending: -2,
      bundles: {
        total: 2,
        stale: 1,
        staleItems: [{ class: 9, section: 'ALL' }, { class: 0 }, 'x'],
        failedItems: [{ class: 10, section: 'A', error: 'boom' }],
      },
    });
    assert.equal(s.done, 4);
    assert.equal(s.pending, 0);
    assert.deepEqual(s.bundles.staleItems, [{ class: 9, section: 'ALL' }]);
    assert.deepEqual(s.bundles.failedItems, [{ class: 10, section: 'A', error: 'boom' }]);
    assert.equal(parseMarksheetStatus(null).total, 0);
  });

  it('matches the web completeness / activity rules and poll interval', () => {
    const running = make({ total: 10, done: 4, pending: 6 });
    assert.equal(isGenComplete(running), false);
    assert.equal(isQueueActive(running), true);
    assert.equal(marksheetPollMs(running), 8_000);

    const done = make({ total: 10, done: 10 }, { total: 2, done: 2 });
    assert.equal(isGenComplete(done), true);
    assert.equal(marksheetPollMs(done), false);

    const stale = make({ total: 10, done: 10 }, { total: 2, done: 2, stale: 1 });
    assert.equal(marksheetPollMs(stale), 60_000);

    const bundling = make(
      { total: 10, done: 10 },
      { total: 4, done: 1, generating: 1, pending: 2 },
    );
    assert.equal(isGenComplete(bundling), false);
    assert.equal(marksheetPollMs(make({})), false);
    assert.equal(marksheetPollMs(undefined), false);
  });

  it('builds the panel text like MarksheetGenProgress', () => {
    const bundling = genPanelView(
      make({ total: 10, done: 10 }, { total: 4, done: 1, generating: 1, pending: 2 }),
    );
    assert.equal(bundling.title, 'Generating class bundles in background');
    assert.equal(bundling.count, '1/4');
    assert.equal(bundling.percent, 25);
    assert.equal(bundling.bundleLabel, 'Class bundles generating');

    const running = genPanelView(make({ total: 8, done: 2, pending: 6 }, { total: 2, pending: 2 }));
    assert.equal(running.title, 'Generating marksheets in background');
    assert.equal(running.compactTitle, 'Generating marksheets');
    assert.equal(running.percent, 25);
    assert.equal(running.bundleProgress, true);

    const stale = genPanelView(
      make(
        { total: 3, done: 3 },
        { total: 2, done: 2, stale: 1, staleItems: [{ class: 9, section: 'A' }] },
      ),
    );
    assert.equal(stale.title, 'Marksheets ready');
    assert.equal(stale.bundleLabel, 'Class bundles outdated');
    assert.deepEqual(stale.stale, [{ class: 9, section: 'A' }]);

    assert.equal(formatBundleScope({ class: 9, section: 'ALL' }), 'Class 9 (all sections)');
    assert.equal(formatBundleScope({ class: 10, section: 'A+B' }), 'Class 10 (A+B)');
  });

  it('reads the Nest envelope from the exam status path', async () => {
    const urls: string[] = [];
    const api = createMarksApi(
      createApiClient({
        baseUrl: 'https://s.test',
        fetch: (async (url: RequestInfo | URL) => {
          urls.push(String(url));
          return new Response(
            JSON.stringify({ success: true, data: { total: 5, done: 5, bundles: {} } }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }) as typeof fetch,
      }),
    );
    const s = await api.marksheetStatus(42);
    assert.equal(new URL(urls[0]!).pathname, '/api/marksheets/exams/42/status');
    assert.equal(new URL(urls[0]!).search, '');
    assert.equal(s.total, 5);
    assert.equal(isGenComplete(s), true);
  });
});
