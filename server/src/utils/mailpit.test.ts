import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { mailpitPayload, sendToMailpit } from './mailpit.js';

describe('mailpit', () => {
  const original = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original;
  });

  it('builds a Mailpit send body, including a base64 attachment', () => {
    const payload = mailpitPayload({
      from: 'no-reply@school.test',
      to: 'parent@school.test',
      subject: 'Result',
      body: 'See attached.',
      attachment: { filename: 'result.txt', content: Buffer.from('ok') },
    });

    assert.deepEqual(payload, {
      From: { Email: 'no-reply@school.test', Name: 'School System' },
      To: [{ Email: 'parent@school.test' }],
      Subject: 'Result',
      Text: 'See attached.',
      Attachments: [{ Filename: 'result.txt', Content: Buffer.from('ok').toString('base64') }],
    });
  });

  it('posts the message and reports a down catcher', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as typeof fetch;

    const result = await sendToMailpit('http://127.0.0.1:8025/api/v1/send', {
      from: 'no-reply@school.test',
      to: 'parent@school.test',
      subject: 'Hi',
      body: 'Hello',
    });

    assert.equal(result.ok, false);
    assert.match(result.detail, /ECONNREFUSED/);
  });
});
