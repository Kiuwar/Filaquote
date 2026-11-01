import { sanitizeProfileData, type ProfileData } from "../domain/profile";
import type { ItemInput, PlateData, QuoteItem } from "../domain/quote";
import { newId, type Db } from "./db";
import { parseJson } from "./json";
import { itemFromRow } from "./quotes";

/** Função 4: peça recorrente. Guarda a entrada, não o preço. */
export interface Part {
  id: string;
  name: string;
  finish: string;
  input: ItemInput;
  plate: PlateData | null;
  notes: string;
  lastSnapshot: ProfileData | null;
  lastUnitPrice: number | null;
  updatedAt: string;
}

interface Row {
  id: string;
  name: string;
  finish: string | null;
  input: string;
  plate: string | null;
  notes: string | null;
  last_snapshot: string | null;
  last_unit_price: number | null;
  updated_at: string;
}

function fromRow(r: Row): Part {
  // Reaproveita a validação de entrada dos itens.
  const asItem = itemFromRow({
    id: r.id,
    quote_id: "",
    position: 0,
    name: r.name,
    quantity: 1,
    finish: r.finish,
    profile_id: null,
    profile_snapshot: "{}",
    input: r.input,
    source: "manual",
    plate: r.plate,
    method: null,
    target_price: null,
    unit_price: 0,
    unit_cost: 0,
    part_id: null,
  });
  return {
    id: r.id,
    name: r.name,
    finish: r.finish ?? "",
    input: asItem.input,
    plate: asItem.plate,
    notes: r.notes ?? "",
    lastSnapshot: r.last_snapshot ? sanitizeProfileData(parseJson(r.last_snapshot, {})) : null,
    lastUnitPrice: r.last_unit_price,
    updatedAt: r.updated_at,
  };
}

export async function listParts(db: Db, search = ""): Promise<Part[]> {
  const rows = await db.select<Row>(
    "SELECT * FROM parts WHERE name LIKE $1 ORDER BY name COLLATE NOCASE",
    [`%${search.trim()}%`],
  );
  return rows.map(fromRow);
}

/** Salva (ou atualiza) a peça a partir de um item de orçamento. */
export async function savePartFromItem(db: Db, item: QuoteItem): Promise<string> {
  const id = item.partId ?? newId();
  await db.execute(
    `INSERT INTO parts (id, name, finish, input, plate, last_snapshot, last_unit_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, finish = excluded.finish, input = excluded.input,
       plate = excluded.plate, last_snapshot = excluded.last_snapshot, last_unit_price = excluded.last_unit_price,
       updated_at = datetime('now')`,
    [
      id,
      item.name,
      item.finish,
      JSON.stringify(item.input),
      item.plate ? JSON.stringify(item.plate) : null,
      JSON.stringify(item.snapshot),
      item.unitPrice > 0 ? item.unitPrice : null,
    ],
  );
  return id;
}

export async function renamePart(db: Db, id: string, name: string): Promise<void> {
  await db.execute("UPDATE parts SET name = $2, updated_at = datetime('now') WHERE id = $1", [
    id,
    name.trim(),
  ]);
}

export async function deletePart(db: Db, id: string): Promise<void> {
  await db.execute("DELETE FROM parts WHERE id = $1", [id]);
}
