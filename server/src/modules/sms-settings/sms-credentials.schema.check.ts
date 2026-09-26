import assert from 'node:assert/strict';
import { updateSmsCredentialsSchema } from './sms-credentials.schema.js';

const repro = {
  api_url: '',
  sender_id: '',
  service_type: 'onecode',
  estimated_sms: null,
  balance_message: null,
};
const rejected = updateSmsCredentialsSchema.safeParse(repro);
assert.equal(rejected.success, false);
if (!rejected.success) {
  assert.match(
    rejected.error.issues.map((issue) => issue.message).join(' '),
    /Sender ID is required/,
  );
}

const cleared = updateSmsCredentialsSchema.safeParse({});
assert.equal(cleared.success, true);
if (cleared.success) assert.deepEqual(cleared.data, {});

const switchToShared = updateSmsCredentialsSchema.safeParse({ api_key: null });
assert.equal(switchToShared.success, true);
if (switchToShared.success) assert.deepEqual(switchToShared.data, { api_key: null });

const saved = updateSmsCredentialsSchema.safeParse({
  api_url: '',
  sender_id: ' 8801711111111 ',
  service_type: 'onecode',
  api_key: ' secret ',
  estimated_sms: 12,
  balance_message: 'ok',
  api_key_masked: '••••cret',
});
assert.equal(saved.success, true);
if (saved.success) {
  assert.deepEqual(saved.data, {
    sender_id: '8801711111111',
    service_type: 'onecode',
    api_key: 'secret',
  });
  assert.equal('estimated_sms' in saved.data, false);
  assert.equal('balance_message' in saved.data, false);
  assert.equal('api_key_masked' in saved.data, false);
}

assert.equal(
  updateSmsCredentialsSchema.safeParse({ sender_id: '8801711111111', service_type: 'other' })
    .success,
  false,
);
assert.equal(updateSmsCredentialsSchema.safeParse({ sender_id: '   ' }).success, false);
assert.equal(
  updateSmsCredentialsSchema.safeParse({ sender_id: null, service_type: 'onecode' }).success,
  false,
);
assert.equal(updateSmsCredentialsSchema.safeParse({ sender_id: 'x'.repeat(51) }).success, false);
assert.equal(
  updateSmsCredentialsSchema.safeParse({ sender_id: '8801711111111', api_key: '' }).success,
  false,
);
assert.equal(
  updateSmsCredentialsSchema.safeParse({ sender_id: '8801711111111', api_key: '   ' }).success,
  false,
);

console.log('sms credentials schema ok');
