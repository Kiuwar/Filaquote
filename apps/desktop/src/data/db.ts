/**
 * Acesso ao SQLite local. No app, via tauri-plugin-sql (migrations aplicadas pelo Rust).
 * No modo de desenvolvimento no navegador, via sql.js em memória. Nos testes, via node:sqlite.
 * As consultas usam parâmetros `$1, $2…`.
 */
export interface Db {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
}

/** Converte `$1` para `?1` (numerado), aceito por sql.js e node:sqlite. */
export function toNumberedParams(sql: string): string {
  return sql.replace(/\$(\d+)/g, "?$1");
}

/** Executa várias instruções em sequência dentro de uma transação. */
export async function transaction(db: Db, run: () => Promise<void>): Promise<void> {
  await db.execute("BEGIN");
  try {
    await run();
    await db.execute("COMMIT");
  } catch (err) {
    await db.execute("ROLLBACK");
    throw err;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
