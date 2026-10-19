import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryKeyValueStore } from '@/lib/storage/key-value';
import {
  clearSelection,
  loadSelection,
  parseSelection,
  saveSelection,
  selectionFromLookup,
  SELECTION_KEY,
} from './selection';

const lookup = {
  school: { name: 'Lalbagh High School', shortName: 'LBHS', logo: null },
  tenant: {
    host: 'lbhs-dashboard.mutiurrahman.com',
    apiBaseUrl: 'https://lbhs-dashboard.mutiurrahman.com',
  },
  roleHint: 'student' as const,
};

describe('school selection storage', () => {
  it('round-trips public lookup data only', async () => {
    const store = createMemoryKeyValueStore();
    await saveSelection(store, selectionFromLookup(lookup, 1000));
    const raw = JSON.parse(store.dump()[SELECTION_KEY]!);
    assert.deepEqual(Object.keys(raw).sort(), [
      'apiBaseUrl',
      'host',
      'logo',
      'name',
      'roleHint',
      'selectedAt',
      'shortName',
    ]);
    const loaded = await loadSelection(store);
    assert.equal(loaded?.host, lookup.tenant.host);
    assert.equal(loaded?.roleHint, 'student');
    await clearSelection(store);
    assert.equal(await loadSelection(store), null);
  });
  it('rejects tampered or corrupt entries', () => {
    const base = selectionFromLookup(lookup, 1);
    assert.equal(parseSelection('not json'), null);
    assert.equal(
      parseSelection(JSON.stringify({ ...base, apiBaseUrl: 'https://evil.test' })),
      null,
    );
    assert.equal(parseSelection(JSON.stringify({ ...base, host: 'Bad Host' })), null);
    assert.equal(parseSelection(JSON.stringify({ ...base, name: 5 })), null);
    assert.equal(
      parseSelection(JSON.stringify({ ...base, roleHint: 'super_admin' }))?.roleHint,
      null,
    );
  });
});
