import { isTauri } from "../platform/tauri";
import type { Db } from "./db";

/** Mesmo nome usado em src-tauri/src/lib.rs (`DB_URL`). */
export const DB_URL = "sqlite:filaquote.db";

async function createTauriDb(): Promise<Db> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load(DB_URL);
  // Chaves estrangeiras valem por conexão no SQLite.
  await db.execute("PRAGMA foreign_keys = ON");
  return {
    select: (sql, params = []) => db.select(sql, params),
    async execute(sql, params = []) {
      const r = await db.execute(sql, params);
      return { rowsAffected: r.rowsAffected };
    },
  };
}

export async function openDb(): Promise<Db> {
  if (isTauri()) return createTauriDb();
  if (import.meta.env.DEV) {
    const { createDevDb } = await import("./devDb");
    return createDevDb();
  }
  throw new Error("Abra o Filaquote pelo aplicativo instalado.");
}
