import { RedisWindowStore } from './lookup-throttle.guard.js';

// Fake ioredis MULTI: no Redis (runs in CI).
function fakeRedis() {
  const counts = new Map<string, number>();
  const ttl = new Map<string, number>();
  const client = {
    multi() {
      const ops: Array<() => [null, number]> = [];
      const chain = {
        incr(k: string) {
          ops.push(() => {
            counts.set(k, (counts.get(k) ?? 0) + 1);
            return [null, counts.get(k)!];
          });
          return chain;
        },
        pexpire(k: string, ms: number, _nx: 'NX') {
          ops.push(() => {
            if (!ttl.has(k)) ttl.set(k, ms);
            return [null, 1];
          });
          return chain;
        },
        pttl(k: string) {
          ops.push(() => [null, ttl.get(k) ?? -1]);
          return chain;
        },
        exec: async () => ops.map((op) => op()),
      };
      return chain;
    },
    decr: async (k: string) => counts.set(k, (counts.get(k) ?? 0) - 1),
    del: async (k: string) => counts.delete(k),
  };
  return { client: client as any, counts, ttl };
}

describe('RedisWindowStore', () => {
  it('counts per key under the prefix, sets the window once', async () => {
    const { client, counts, ttl } = fakeRedis();
    const store = new RedisWindowStore(client, 'rl:test:');
    store.init({ windowMs: 60_000 });
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    const second = await store.increment('1.2.3.4');
    expect(second.totalHits).toBe(2);
    expect(second.resetTime!.getTime()).toBeGreaterThan(Date.now());
    expect(counts.get('rl:test:1.2.3.4')).toBe(2);
    expect(ttl.get('rl:test:1.2.3.4')).toBe(60_000);
    await store.resetKey('1.2.3.4');
    expect(counts.has('rl:test:1.2.3.4')).toBe(false);
  });
});
