import { AuthSessionStore, REUSE_GRACE_MS, type SessionOwner } from './auth-sessions.js';

// In-memory stand-in for prisma.auth_sessions: no DB (runs in CI).
type Row = {
  jti: string;
  family_id: string;
  user_role: string;
  user_id: number;
  school_id: number | null;
  client: string;
  expires_at: Date;
  rotated_at: Date | null;
  replaced_by: string | null;
  revoked_at: Date | null;
};

function fakeDb() {
  const rows = new Map<string, Row>();
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as any)[k] === v);
  const db = {
    auth_sessions: {
      create: async ({ data }: any) => {
        const row = { rotated_at: null, replaced_by: null, revoked_at: null, ...data } as Row;
        rows.set(row.jti, row);
        return row;
      },
      findUnique: async ({ where }: any) => rows.get(where.jti) ?? null,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of rows.values()) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
  };
  return { db: db as any, rows };
}

const owner: SessionOwner = { role: 'admin', userId: 1, schoolId: 10 };

describe('AuthSessionStore', () => {
  let clock: number;
  let store: AuthSessionStore;
  let rows: Map<string, Row>;

  beforeEach(() => {
    clock = Date.parse('2026-10-18T10:00:00Z');
    const fake = fakeDb();
    rows = fake.rows;
    store = new AuthSessionStore(fake.db, () => new Date(clock));
  });

  it('create starts a family with school scope and 7 day expiry', async () => {
    const s = await store.create(owner, 'native');
    const row = rows.get(s.jti)!;
    expect(row).toMatchObject({ family_id: s.familyId, school_id: 10, client: 'native' });
    expect(row.expires_at.getTime() - clock).toBe(7 * 24 * 3600 * 1000);
  });

  it('super_admin sessions have no school', async () => {
    const s = await store.create({ role: 'super_admin', userId: 1, schoolId: 99 }, 'web');
    expect(rows.get(s.jti)!.school_id).toBeNull();
  });

  it('rotates: old row replaced, same family', async () => {
    const s = await store.create(owner, 'native');
    const r = await store.rotate(owner, 'native', s.jti, 'next-1');
    expect(r).toEqual({ status: 'rotated', familyId: s.familyId, jti: 'next-1' });
    expect(rows.get(s.jti)).toMatchObject({ replaced_by: 'next-1' });
  });

  it('reuse after the grace window revokes the whole family', async () => {
    const s = await store.create(owner, 'native');
    await store.rotate(owner, 'native', s.jti, 'next-1');
    await store.create(owner, 'native', s.familyId, 'next-1');
    clock += REUSE_GRACE_MS + 1;
    expect(await store.rotate(owner, 'native', s.jti, 'next-2')).toEqual({ status: 'reused' });
    expect(rows.get('next-1')!.revoked_at).not.toBeNull();
    // The legitimate newer token is dead too.
    expect(await store.rotate(owner, 'native', 'next-1', 'next-3')).toEqual({ status: 'invalid' });
  });

  it('reuse inside the grace window (multi-tab race) gets a sibling token', async () => {
    const s = await store.create(owner, 'web');
    await store.rotate(owner, 'web', s.jti, 'next-1');
    clock += 1000;
    expect(await store.rotate(owner, 'web', s.jti, 'next-2')).toMatchObject({
      status: 'rotated',
      familyId: s.familyId,
    });
  });

  it.each([
    ['another user', { ...owner, userId: 2 }, 'native'],
    ['another school', { ...owner, schoolId: 11 }, 'native'],
    ['another role', { ...owner, role: 'teacher' }, 'native'],
    ['another client kind', owner, 'web'],
  ] as const)('rejects a row owned by %s', async (_n, who, client) => {
    const s = await store.create(owner, 'native');
    expect(await store.rotate(who, client, s.jti, 'x')).toEqual({ status: 'invalid' });
  });

  it('rejects unknown, revoked and expired rows', async () => {
    expect(await store.rotate(owner, 'native', 'nope', 'x')).toEqual({ status: 'invalid' });
    const a = await store.create(owner, 'native');
    await store.revokeFamily(owner, a.familyId);
    expect(await store.rotate(owner, 'native', a.jti, 'x')).toEqual({ status: 'invalid' });
    const b = await store.create(owner, 'native');
    clock += 8 * 24 * 3600 * 1000;
    expect(await store.rotate(owner, 'native', b.jti, 'x')).toEqual({ status: 'invalid' });
  });

  it('revokeByJti (logout) revokes the family only for the owner', async () => {
    const s = await store.create(owner, 'native');
    await store.revokeByJti({ ...owner, userId: 2 }, s.jti);
    expect(rows.get(s.jti)!.revoked_at).toBeNull();
    await store.revokeByJti(owner, s.jti);
    expect(rows.get(s.jti)!.revoked_at).not.toBeNull();
  });
});
