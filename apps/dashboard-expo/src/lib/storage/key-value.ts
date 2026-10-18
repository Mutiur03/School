/** Minimal async key-value contract shared by the web and native implementations. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** In-memory store for tests and as a fallback when platform storage is unavailable. */
export function createMemoryKeyValueStore(): KeyValueStore & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}
