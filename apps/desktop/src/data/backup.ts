import type { Db, Statement } from "./db";

/** Tabelas na ordem de dependência (pais primeiro). */
export const BACKUP_TABLES = [
  "settings",
  "profiles",
  "clients",
  "parts",
  "quotes",
  "quote_items",
  "closures",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface Backup {
  app: "filaquote";
  format: 1;
  /** Versão das migrations do banco que gerou o backup. */
  schemaVersion: number;
  exportedAt: string;
  tables: Record<BackupTable, Array<Record<string, unknown>>>;
}

export async function exportBackup(db: Db, schemaVersion: number): Promise<Backup> {
  const tables = {} as Backup["tables"];
  for (const t of BACKUP_TABLES)
    tables[t] = await db.select<Record<string, unknown>>(`SELECT * FROM ${t}`);
  return {
    app: "filaquote",
    format: 1,
    schemaVersion,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Valida o arquivo antes de qualquer alteração. Mensagens em português. */
export function parseBackup(text: string, currentSchema: number): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um backup do Filaquote (JSON inválido).");
  }
  const b = data as Partial<Backup>;
  if (
    b?.app !== "filaquote" ||
    b.format !== 1 ||
    typeof b.tables !== "object" ||
    b.tables === null
  ) {
    throw new Error("O arquivo não é um backup do Filaquote.");
  }
  if (typeof b.schemaVersion !== "number" || b.schemaVersion > currentSchema) {
    throw new Error(
      "Este backup veio de uma versão mais nova do Filaquote. Atualize o app antes de importar.",
    );
  }
  for (const t of BACKUP_TABLES) {
    const rows = (b.tables as Record<string, unknown>)[t];
    if (rows !== undefined && !Array.isArray(rows))
      throw new Error(`Backup corrompido (tabela ${t}).`);
  }
  return b as Backup;
}

export function backupCounts(b: Backup): Record<BackupTable, number> {
  return Object.fromEntries(BACKUP_TABLES.map((t) => [t, b.tables[t]?.length ?? 0])) as Record<
    BackupTable,
    number
  >;
}

async function columnsOf(db: Db, table: string): Promise<Set<string>> {
  const rows = await db.select<{ name: string }>(`SELECT name FROM pragma_table_info('${table}')`);
  return new Set(rows.map((r) => r.name));
}

/**
 * Substitui todos os dados pelos do backup, numa transação: ou entra tudo, ou nada muda.
 * Colunas que o banco atual não conhece são ignoradas; colunas novas ficam com o padrão.
 */
export async function importBackup(db: Db, backup: Backup): Promise<void> {
  const statements: Statement[] = [...BACKUP_TABLES]
    .reverse()
    .map((t) => ({ sql: `DELETE FROM ${t}` }));
  for (const t of BACKUP_TABLES) {
    const known = await columnsOf(db, t);
    for (const row of backup.tables[t] ?? []) {
      const cols = Object.keys(row).filter((c) => known.has(c));
      if (cols.length === 0) continue;
      statements.push({
        sql: `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
        params: cols.map((c) => row[c] ?? null),
      });
    }
  }
  await db.batch(statements);
}

/** Apaga orçamentos, clientes, peças e perfis (mantém as preferências de aparência). */
export async function deleteAllData(db: Db): Promise<void> {
  await db.batch(
    BACKUP_TABLES.filter((t) => t !== "settings")
      .reverse()
      .map((t) => ({ sql: `DELETE FROM ${t}` })),
  );
}
