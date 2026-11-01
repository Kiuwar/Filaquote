import type { ActualJob } from "@filaquote/engine";
import type { Closure } from "../domain/closure";
import type { QuoteItem } from "../domain/quote";
import type { Db } from "./db";
import { parseJson } from "./json";
import { itemFromRow } from "./quotes";

interface Row {
  item_id: string;
  closed_on: string;
  actual: string;
  revenue: number;
  fees: number;
  excluded: number;
}

const fromRow = (r: Row): Closure => ({
  itemId: r.item_id,
  closedOn: r.closed_on,
  actual: parseJson<ActualJob>(r.actual, {}),
  revenue: r.revenue,
  fees: r.fees,
  excluded: r.excluded === 1,
});

export async function saveClosure(db: Db, c: Closure): Promise<void> {
  await db.execute(
    `INSERT INTO closures (item_id, closed_on, actual, revenue, fees, excluded) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(item_id) DO UPDATE SET closed_on = excluded.closed_on, actual = excluded.actual,
       revenue = excluded.revenue, fees = excluded.fees, excluded = excluded.excluded, updated_at = datetime('now')`,
    [c.itemId, c.closedOn, JSON.stringify(c.actual), c.revenue, c.fees, c.excluded ? 1 : 0],
  );
}

export async function closuresForQuote(db: Db, quoteId: string): Promise<Map<string, Closure>> {
  const rows = await db.select<Row>(
    "SELECT c.* FROM closures c JOIN quote_items i ON i.id = c.item_id WHERE i.quote_id = $1",
    [quoteId],
  );
  return new Map(rows.map((r) => [r.item_id, fromRow(r)]));
}

export interface ClosedItem {
  item: QuoteItem;
  closure: Closure;
}

/** Itens fechados; com `profileId`, só os calculados com aquele perfil (calibração). */
export async function listClosedItems(db: Db, profileId?: string): Promise<ClosedItem[]> {
  const rows = await db.select<Row & Record<string, unknown>>(
    `SELECT i.*, c.item_id, c.closed_on, c.actual, c.revenue, c.fees, c.excluded
       FROM closures c JOIN quote_items i ON i.id = c.item_id
      WHERE ($1 IS NULL OR i.profile_id = $1)
      ORDER BY c.closed_on`,
    [profileId ?? null],
  );
  return rows.map((r) => ({
    item: itemFromRow(r as unknown as Parameters<typeof itemFromRow>[0]),
    closure: fromRow(r),
  }));
}

export async function setClosureExcluded(db: Db, itemId: string, excluded: boolean): Promise<void> {
  await db.execute(
    "UPDATE closures SET excluded = $2, updated_at = datetime('now') WHERE item_id = $1",
    [itemId, excluded ? 1 : 0],
  );
}
