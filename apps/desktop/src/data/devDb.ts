// Banco em memória para desenvolver a interface no navegador (só em `pnpm dev`).
// Não entra no build de produção: é importado atrás de `import.meta.env.DEV`.
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { singleConnectionBatch, toNumberedParams, type Db } from "./db";
import { MIGRATIONS } from "./migrations";

export async function createDevDb(): Promise<Db> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return {
    async select<T>(sql: string, params: unknown[] = []) {
      const stmt = db.prepare(toNumberedParams(sql));
      stmt.bind(params as initSqlJs.BindParams);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      stmt.free();
      return rows;
    },
    async execute(sql: string, params: unknown[] = []) {
      db.run(toNumberedParams(sql), params as initSqlJs.BindParams);
      return { rowsAffected: db.getRowsModified() };
    },
    batch: singleConnectionBatch((sql, params) =>
      db.run(toNumberedParams(sql), params as initSqlJs.BindParams),
    ),
  };
}
