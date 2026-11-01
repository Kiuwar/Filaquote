import { isTauri } from "./tauri";

/**
 * Armazenamento chave/valor das preferências.
 * No app: SQLite local (tabela `settings`, migração 0001), na pasta de dados do
 * usuário do sistema operacional; cada conta do Windows tem o próprio banco.
 * No navegador (desenvolvimento da interface): localStorage.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** Mesmo nome usado em src-tauri/src/lib.rs (`DB_URL`). */
export const DB_URL = "sqlite:filaquote.db";

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

async function createSqliteStore(): Promise<KeyValueStore> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load(DB_URL);
  return {
    async get(key) {
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = $1",
        [key],
      );
      return rows[0]?.value ?? null;
    },
    async set(key, value) {
      await db.execute(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value],
      );
    },
  };
}

export function openSettingsStore(): Promise<KeyValueStore> {
  return isTauri() ? createSqliteStore() : Promise.resolve(createLocalStorageStore());
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
