import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/school';
process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.NODE_ENV = 'test';

const { runWithRlsContext } = await import('@/config/rlsContextStore.js');
const { assertTenantR2Key, swapR2Key } = await import('./r2Key.util.js');

describe('assertTenantR2Key', () => {
  it('accepts keys under the current tenant prefix', () => {
    runWithRlsContext({ schoolId: 42, isSuperAdmin: false, inRlsTransaction: false }, () => {
      assert.doesNotThrow(() => assertTenantR2Key('42/notices/file.pdf'));
    });
  });

  it('rejects keys outside the current tenant prefix', () => {
    runWithRlsContext({ schoolId: 42, isSuperAdmin: false, inRlsTransaction: false }, () => {
      assert.throws(() => assertTenantR2Key('99/notices/file.pdf'), /Invalid storage key/);
    });
  });
});

describe('swapR2Key', () => {
  it('does not reject a legacy unprefixed old key when the new key is tenant-scoped', async () => {
    await runWithRlsContext(
      { schoolId: 42, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        await assert.doesNotReject(() => swapR2Key('teachers/legacy.jpg', '42/teachers/new.jpg'));
      },
    );
  });

  it('rejects a new key outside the current tenant', async () => {
    await runWithRlsContext(
      { schoolId: 42, isSuperAdmin: false, inRlsTransaction: false },
      async () => {
        await assert.rejects(
          () => swapR2Key('teachers/legacy.jpg', '99/teachers/new.jpg'),
          /Invalid storage key/,
        );
      },
    );
  });
});
