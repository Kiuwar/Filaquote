import type { Client } from "../domain/quote";
import { newId, type Db } from "./db";

interface Row {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

const fromRow = (r: Row): Client => ({
  id: r.id,
  name: r.name,
  phone: r.phone ?? "",
  email: r.email ?? "",
  notes: r.notes ?? "",
  createdAt: r.created_at,
});

export type ClientInput = Pick<Client, "name" | "phone" | "email" | "notes">;

export async function listClients(db: Db, search = ""): Promise<Client[]> {
  const q = `%${search.trim()}%`;
  const rows = await db.select<Row>(
    "SELECT * FROM clients WHERE name LIKE $1 OR phone LIKE $1 OR email LIKE $1 ORDER BY name COLLATE NOCASE",
    [q],
  );
  return rows.map(fromRow);
}

export async function getClient(db: Db, id: string): Promise<Client | null> {
  const rows = await db.select<Row>("SELECT * FROM clients WHERE id = $1", [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createClient(db: Db, input: ClientInput): Promise<string> {
  const id = newId();
  await db.execute(
    "INSERT INTO clients (id, name, phone, email, notes) VALUES ($1, $2, $3, $4, $5)",
    [
      id,
      input.name.trim() || "Cliente sem nome",
      input.phone.trim(),
      input.email.trim(),
      input.notes.trim(),
    ],
  );
  return id;
}

export async function updateClient(db: Db, id: string, input: ClientInput): Promise<void> {
  await db.execute(
    "UPDATE clients SET name = $2, phone = $3, email = $4, notes = $5, updated_at = datetime('now') WHERE id = $1",
    [
      id,
      input.name.trim() || "Cliente sem nome",
      input.phone.trim(),
      input.email.trim(),
      input.notes.trim(),
    ],
  );
}

export async function countClientQuotes(db: Db, id: string): Promise<number> {
  const rows = await db.select<{ n: number }>(
    "SELECT COUNT(*) AS n FROM quotes WHERE client_id = $1",
    [id],
  );
  return rows[0]?.n ?? 0;
}

/**
 * Exclui os dados pessoais do cliente (LGPD). Por padrão os orçamentos ficam, sem vínculo
 * com a pessoa ("cliente excluído"), para manter o histórico financeiro; com
 * `deleteQuotes`, os orçamentos dele também são apagados.
 */
export async function deleteClient(db: Db, id: string, deleteQuotes: boolean): Promise<void> {
  await db.batch([
    deleteQuotes
      ? { sql: "DELETE FROM quotes WHERE client_id = $1", params: [id] }
      : { sql: "UPDATE quotes SET client_id = NULL WHERE client_id = $1", params: [id] },
    { sql: "DELETE FROM clients WHERE id = $1", params: [id] },
  ]);
}
