/**
 * Acesso ao SQLite local. No app, via tauri-plugin-sql (migrations aplicadas pelo Rust).
 * No modo de desenvolvimento no navegador, via sql.js em memória. Nos testes, via node:sqlite.
 * As consultas usam parâmetros `$1, $2…`.
 */
export interface Statement {
  sql: string;
  params?: unknown[];
}

export interface Db {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
  /** Executa tudo ou nada, numa transação (no app, pelo comando Rust `sql_batch`). */
  batch(statements: Statement[]): Promise<void>;
}

/** Converte `$1` para `?1` (numerado), aceito por sql.js e node:sqlite. */
export function toNumberedParams(sql: string): string {
  return sql.replace(/\$(\d+)/g, "?$1");
}

/** Transação para bancos de conexão única (sql.js e node:sqlite). */
export function singleConnectionBatch(run: (sql: string, params: unknown[]) => void) {
  return async (statements: Statement[]): Promise<void> => {
    run("BEGIN", []);
    try {
      for (const st of statements) run(st.sql, st.params ?? []);
      run("COMMIT", []);
    } catch (err) {
      run("ROLLBACK", []);
      throw err;
    }
  };
}

export function newId(): string {
  return crypto.randomUUID();
}
