import type { KeyValueStore } from "../platform/storage";
import type { Db } from "./db";

/** Preferências (tabela `settings`, migração 0001) sobre o banco local. */
export function createDbKeyValueStore(db: Db): KeyValueStore {
  return {
    async get(key) {
      const rows = await db.select<{ value: string }>("SELECT value FROM settings WHERE key = $1", [
        key,
      ]);
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
