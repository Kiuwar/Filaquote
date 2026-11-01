/**
 * Armazenamento chave/valor das preferências. No app, fica no SQLite local
 * (ver data/kv.ts); aqui ficam as versões em memória e em localStorage.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
  };
}

export function createLocalStorageStore(prefix = "filaquote:"): KeyValueStore {
  // localStorage pode estar indisponível (modo privado, bloqueio); cai para memória.
  const fallback = createMemoryStore();
  return {
    async get(key) {
      try {
        return window.localStorage.getItem(prefix + key);
      } catch {
        return fallback.get(key);
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(prefix + key, value);
      } catch {
        await fallback.set(key, value);
      }
    },
  };
}

export async function readJson(store: KeyValueStore, key: string): Promise<unknown> {
  const raw = await store.get(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  return store.set(key, JSON.stringify(value));
}
