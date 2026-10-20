import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import type { SessionSnapshot } from '../api/session';
import { privateQueryKey, tenantQueryKey } from '@/tenant/query-keys';
import { startQueryPersistence, scopeForSnapshot } from './persister';
import {
  buildSnapshot,
  isPersistableKey,
  MAX_AGE_MS,
  parseSnapshot,
  scopeFileName,
  tenantFilePrefix,
  type CacheScope,
} from './policy';
import type { QueryCacheStore } from './store';

const T = 'school-a.example';
const scope: CacheScope = { tenantKey: T, role: 'admin', userId: 1 };

describe('cache allowlist', () => {
  it('keeps only home-screen data: admin overview and student notices', () => {
    for (const key of [
      privateQueryKey(T, 'dashboard', 1, 'overview'),
      privateQueryKey(T, 'student', 9, 'notices'),
    ]) {
      assert.equal(isPersistableKey(key, T), true, JSON.stringify(key));
    }
  });

  it('never persists sensitive or personal data', () => {
    for (const key of [
      privateQueryKey(T, 'notices'),
      privateQueryKey(T, 'events'),
      privateQueryKey(T, 'holidays'),
      privateQueryKey(T, 'attendance'),
      privateQueryKey(T, 'marks'),
      privateQueryKey(T, 'marks', { exam: 1 }),
      privateQueryKey(T, 'results'),
      privateQueryKey(T, 'students'),
      privateQueryKey(T, 'teachers', { limit: 500 }),
      privateQueryKey(T, 'staff'),
      privateQueryKey(T, 'fees'),
      privateQueryKey(T, 'dashboard', 1, 'attendance', 7),
      privateQueryKey(T, 'student', 9, 'profile', 2026),
      privateQueryKey(T, 'student', 9, 'attendance', 2026, 9),
      privateQueryKey(T, 'student', 9, 'marks', 2026, 'Final'),
      privateQueryKey(T, 'notices', 'extra'),
      privateQueryKey(T, 'dashboard', 'anon', 'overview'),
      tenantQueryKey(T, 'branding'),
      tenantQueryKey(T, 'notices'),
      privateQueryKey('other-school', 'notices'),
      ['session'],
      ['token'],
    ]) {
      assert.equal(isPersistableKey(key, T), false, JSON.stringify(key));
    }
  });

  it('buildSnapshot drops non-allowlisted, failed and expired queries', () => {
    const now = 10 * MAX_AGE_MS;
    const snap = buildSnapshot(
      [
        {
          queryKey: privateQueryKey(T, 'dashboard', 1, 'overview'),
          status: 'success',
          data: [1],
          dataUpdatedAt: now - 5,
        },
        {
          queryKey: privateQueryKey(T, 'marks'),
          status: 'success',
          data: ['secret'],
          dataUpdatedAt: now,
        },
        {
          queryKey: privateQueryKey(T, 'notices'),
          status: 'success',
          data: ['full notices page'],
          dataUpdatedAt: now,
        },
        {
          queryKey: privateQueryKey(T, 'student', 9, 'notices'),
          status: 'error',
          data: undefined,
          dataUpdatedAt: now,
        },
        {
          queryKey: privateQueryKey(T, 'student', 9, 'notices'),
          status: 'success',
          data: [],
          dataUpdatedAt: now - MAX_AGE_MS - 1,
        },
      ],
      scope,
      'b1',
      now,
    );
    assert.deepEqual(
      snap.queries.map((q) => q.queryKey.slice(3)),
      [['dashboard', 1, 'overview']],
    );
    assert.doesNotMatch(JSON.stringify(snap), /secret|full notices page/);
  });
});

describe('cache scoping and expiry', () => {
  const now = 10 * MAX_AGE_MS;
  const raw = JSON.stringify(
    buildSnapshot(
      [
        {
          queryKey: privateQueryKey(T, 'dashboard', 1, 'overview'),
          status: 'success',
          data: [1],
          dataUpdatedAt: now,
        },
      ],
      scope,
      'b1',
      now,
    ),
  );

  it('restores for the same school, role, user and build', () => {
    assert.equal(parseSnapshot(raw, scope, 'b1', now + 1).length, 1);
  });

  it('rejects another user, role, school, a new build, an old snapshot or garbage', () => {
    assert.equal(parseSnapshot(raw, { ...scope, userId: 2 }, 'b1', now).length, 0);
    assert.equal(parseSnapshot(raw, { ...scope, role: 'teacher' }, 'b1', now).length, 0);
    assert.equal(parseSnapshot(raw, { ...scope, tenantKey: 'school-b' }, 'b1', now).length, 0);
    assert.equal(parseSnapshot(raw, scope, 'b2', now).length, 0);
    assert.equal(parseSnapshot(raw, scope, 'b1', now + MAX_AGE_MS + 1).length, 0);
    assert.equal(parseSnapshot('not json', scope, 'b1', now).length, 0);
    assert.equal(parseSnapshot(null, scope, 'b1', now).length, 0);
  });

  it('a tampered snapshot cannot inject non-allowlisted keys', () => {
    const evil = JSON.stringify({
      buster: 'b1',
      scope: `${T}|admin|1`,
      savedAt: now,
      queries: [{ queryKey: privateQueryKey(T, 'marks'), data: 1, dataUpdatedAt: now }],
    });
    assert.equal(parseSnapshot(evil, scope, 'b1', now).length, 0);
  });

  it('file names are per school + role + user', () => {
    assert.notEqual(scopeFileName(scope), scopeFileName({ ...scope, userId: 2 }));
    assert.notEqual(scopeFileName(scope), scopeFileName({ ...scope, tenantKey: 'school-b' }));
    assert.match(scopeFileName({ ...scope, tenantKey: '../../x' }), /^[A-Za-z0-9_.-]+$/);
  });
});

function memoryStore() {
  const files = new Map<string, string>();
  const store: QueryCacheStore = {
    enabled: true,
    read: async (s) => files.get(scopeFileName(s)) ?? null,
    write: async (s, text) => {
      files.set(scopeFileName(s), text);
    },
    clear: async (opts) => {
      for (const name of [...files.keys()]) {
        if (opts?.keepTenantKey && name.startsWith(tenantFilePrefix(opts.keepTenantKey))) continue;
        files.delete(name);
      }
    },
  };
  return { files, store };
}

function fakeSession(initial: SessionSnapshot) {
  let snap = initial;
  const listeners = new Set<(s: SessionSnapshot) => void>();
  return {
    getSnapshot: () => snap,
    subscribe: (l: (s: SessionSnapshot) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(next: Partial<SessionSnapshot>) {
      snap = { ...snap, ...next };
      for (const l of listeners) l(snap);
    },
  };
}

const base: SessionSnapshot = {
  status: 'unknown',
  user: null,
  endedReason: null,
  startupError: null,
  provisional: null,
};
const authed = (id: number): Partial<SessionSnapshot> => ({
  status: 'authenticated',
  user: { id, role: 'admin' },
  provisional: null,
});
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('persister lifecycle', () => {
  it('writes allowlisted data only, restores it at launch for the provisional user', async () => {
    const { files, store } = memoryStore();
    const qc = new QueryClient();
    const session = fakeSession({ ...base, ...authed(1) } as SessionSnapshot);
    const p = startQueryPersistence({
      queryClient: qc,
      tenantKey: T,
      session,
      store,
      buster: 'b',
      debounceMs: 1,
    });
    qc.setQueryData(privateQueryKey(T, 'dashboard', 1, 'overview'), [{ id: 1, title: 'Exam' }]);
    qc.setQueryData(privateQueryKey(T, 'marks'), [{ secret: 'A+' }]);
    await p.flush();
    p.stop();
    const text = [...files.values()].join();
    assert.match(text, /Exam/);
    assert.doesNotMatch(text, /A\+/);

    // Next launch: provisional user 1 before the server answers.
    const qc2 = new QueryClient();
    let restored = false;
    const s2 = fakeSession({ ...base, provisional: { role: 'admin', userId: 1 } });
    const p2 = startQueryPersistence({
      queryClient: qc2,
      tenantKey: T,
      session: s2,
      store,
      buster: 'b',
      onRestored: () => (restored = true),
    });
    await p2.idle();
    await tick();
    assert.deepEqual(qc2.getQueryData(privateQueryKey(T, 'dashboard', 1, 'overview')), [
      { id: 1, title: 'Exam' },
    ]);
    assert.equal(qc2.getQueryData(privateQueryKey(T, 'marks')), undefined);
    assert.equal(restored, true);
    p2.stop();
  });

  it('clears on logout / expiry', async () => {
    const { files, store } = memoryStore();
    const qc = new QueryClient();
    const session = fakeSession({ ...base, ...authed(1) } as SessionSnapshot);
    const p = startQueryPersistence({ queryClient: qc, tenantKey: T, session, store, buster: 'b' });
    qc.setQueryData(privateQueryKey(T, 'student', 9, 'notices'), [1]);
    await p.flush();
    assert.equal(files.size, 1);
    session.set({ status: 'anonymous', user: null, endedReason: 'expired' });
    await p.idle();
    assert.equal(files.size, 0);
    // No writes after sign-out.
    qc.setQueryData(privateQueryKey(T, 'student', 9, 'notices'), [2]);
    await p.flush();
    assert.equal(files.size, 0);
    p.stop();
  });

  it('school switch: other schools\u2019 snapshots are dropped when the new school starts', async () => {
    const { files, store } = memoryStore();
    await store.write({ ...scope, tenantKey: 'school-b' }, 'x');
    await store.write(scope, 'y');
    const qc = new QueryClient();
    const p = startQueryPersistence({
      queryClient: qc,
      tenantKey: T,
      session: fakeSession(base),
      store,
      buster: 'b',
    });
    await p.idle();
    assert.deepEqual([...files.keys()], [scopeFileName(scope)]);
    p.stop();
  });

  it('confirmed user differs from the provisional one: purge and clear', async () => {
    const { files, store } = memoryStore();
    const qc = new QueryClient();
    const session = fakeSession({ ...base, provisional: { role: 'admin', userId: 1 } });
    const p = startQueryPersistence({ queryClient: qc, tenantKey: T, session, store, buster: 'b' });
    await store.write(scope, 'stale');
    qc.setQueryData(privateQueryKey(T, 'dashboard', 1, 'overview'), ['from user 1']);
    session.set(authed(2));
    await p.idle();
    assert.equal(qc.getQueryData(privateQueryKey(T, 'dashboard', 1, 'overview')), undefined);
    assert.equal(files.size, 0);
    p.stop();
  });

  it('never writes while the session is only provisional', async () => {
    const { files, store } = memoryStore();
    const qc = new QueryClient();
    const session = fakeSession({ ...base, provisional: { role: 'admin', userId: 1 } });
    const p = startQueryPersistence({ queryClient: qc, tenantKey: T, session, store, buster: 'b' });
    qc.setQueryData(privateQueryKey(T, 'dashboard', 1, 'overview'), [1]);
    await p.flush();
    assert.equal(files.size, 0);
    p.stop();
  });

  it('disabled store (web) is a no-op', async () => {
    const qc = new QueryClient();
    const p = startQueryPersistence({
      queryClient: qc,
      tenantKey: T,
      session: fakeSession(base),
      store: {
        enabled: false,
        read: async () => 'x',
        write: async () => assert.fail('write'),
        clear: async () => assert.fail('clear'),
      },
      buster: 'b',
    });
    qc.setQueryData(privateQueryKey(T, 'dashboard', 1, 'overview'), [1]);
    await p.flush();
    p.stop();
  });

  it('scope comes from the server user, or the saved user while unconfirmed', () => {
    assert.deepEqual(scopeForSnapshot({ ...base, ...authed(3) } as SessionSnapshot, T), {
      tenantKey: T,
      role: 'admin',
      userId: 3,
    });
    assert.deepEqual(
      scopeForSnapshot({ ...base, provisional: { role: 'teacher', userId: 4 } }, T),
      { tenantKey: T, role: 'teacher', userId: 4 },
    );
    assert.equal(
      scopeForSnapshot({ ...base, provisional: { role: 'teacher', userId: null } }, T),
      null,
    );
    assert.equal(scopeForSnapshot({ ...base, status: 'anonymous' }, T), null);
  });
});
