import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withUploadedKey, withoutField } from './r2UploadPayload.ts';

describe('r2UploadPayload', () => {
  it('withUploadedKey adds the field only when a new key exists', () => {
    const base = { title: 'Hi' };
    assert.deepEqual(withUploadedKey(base, 'key', undefined), base);
    assert.deepEqual(withUploadedKey(base, 'key', '42/notices/a.pdf'), {
      title: 'Hi',
      key: '42/notices/a.pdf',
    });
  });

  it('withoutField drops stored paths from edit payloads', () => {
    assert.deepEqual(withoutField({ a: 1, notice_key: 'legacy/notice.pdf' }, 'notice_key'), {
      a: 1,
    });
  });
});
