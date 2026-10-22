import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { smspitAdapter } from './smspit.adapter.js';

describe('smspitAdapter', () => {
  const original = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original;
  });

  it('posts each message to the SMSPit generic endpoint', async () => {
    const calls: { url: string; body: unknown }[] = [];
    globalThis.fetch = mock.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ id: 'sms_1', status: 'captured' }), { status: 200 });
    }) as typeof fetch;

    const result = await smspitAdapter.send(
      [
        { Number: '8801711111111', Text: 'Hello' },
        { Number: '8801722222222', Text: 'Again' },
      ],
      { apiKey: 'smspit', apiUrl: 'http://127.0.0.1:2876/generic', senderId: 'SCHOOL' },
    );

    assert.equal(result.success, true);
    assert.equal(result.unitsUsed, 2);
    assert.deepEqual(calls, [
      {
        url: 'http://127.0.0.1:2876/generic',
        body: { to: '+8801711111111', from: 'SCHOOL', message: 'Hello' },
      },
      {
        url: 'http://127.0.0.1:2876/generic',
        body: { to: '+8801722222222', from: 'SCHOOL', message: 'Again' },
      },
    ]);
  });

  it('reports a down catcher instead of throwing', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as typeof fetch;

    const result = await smspitAdapter.send([{ Number: '8801711111111', Text: 'Hi' }], {
      apiKey: 'smspit',
      apiUrl: 'http://127.0.0.1:2876/generic',
      senderId: 'SCHOOL',
    });

    assert.equal(result.success, false);
    assert.match(result.message ?? '', /ECONNREFUSED/);
  });
});
