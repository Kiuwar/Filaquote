// Banco para testes: node:sqlite em memória, com as mesmas migrations do app.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { singleConnectionBatch, toNumberedParams, type Db } from "../data/db";

export const MIGRATIONS_DIR = join(import.meta.dirname, "../../src-tauri/migrations");

export function migrationFiles(): Array<{ version: number; name: string; sql: string }> {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({
      version: Number(name.slice(0, 4)),
      name,
      sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8"),
    }));
}

export function createNodeDb(upToVersion = Infinity): {
  db: Db;
  raw: DatabaseSync;
  migrate(to?: number): void;
} {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  let applied = 0;
  const migrate = (to = Infinity) => {
    for (const m of migrationFiles()) {
      if (m.version > applied && m.version <= to) {
        raw.exec(m.sql);
        applied = m.version;
      }
    }
  };
  migrate(upToVersion);
  const db: Db = {
    async select<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(toNumberedParams(sql)).all(...(params as never[])) as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      const r = raw.prepare(toNumberedParams(sql)).run(...(params as never[]));
      return { rowsAffected: Number(r.changes) };
    },
    batch: singleConnectionBatch((sql, params) => {
      raw.prepare(toNumberedParams(sql)).run(...(params as never[]));
    }),
  };
  return { db, raw, migrate };
}
