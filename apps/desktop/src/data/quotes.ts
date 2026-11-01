import { sanitizeProfileData, type ProfileData } from "../domain/profile";
import {
  emptyItemInput,
  type ItemInput,
  type ItemSource,
  type PlateData,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
} from "../domain/quote";
import { newId, transaction, type Db } from "./db";
import { parseJson } from "./json";

interface QuoteRow {
  id: string;
  number: number;
  version: number;
  client_id: string | null;
  status: QuoteStatus;
  valid_until: string | null;
  payment_terms: string | null;
  lead_time: string | null;
  notes: string | null;
  show_breakdown: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  decided_at: string | null;
}

interface ItemRow {
  id: string;
  quote_id: string;
  position: number;
  name: string;
  quantity: number;
  finish: string | null;
  profile_id: string | null;
  profile_snapshot: string;
  input: string;
  source: ItemSource;
  plate: string | null;
  method: string | null;
  target_price: number | null;
  unit_price: number;
  unit_cost: number;
  part_id: string | null;
}

const quoteFromRow = (r: QuoteRow): Quote => ({
  id: r.id,
  number: r.number,
  version: r.version,
  clientId: r.client_id,
  status: r.status,
  validUntil: r.valid_until,
  paymentTerms: r.payment_terms ?? "",
  leadTime: r.lead_time ?? "",
  notes: r.notes ?? "",
  showBreakdown: r.show_breakdown === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  sentAt: r.sent_at,
  decidedAt: r.decided_at,
});

function sanitizeInput(value: unknown): ItemInput {
  const base = emptyItemInput();
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    grams: n(v.grams),
    purgeGrams: n(v.purgeGrams),
    printHours: n(v.printHours),
    postMinutes: n(v.postMinutes) ?? base.postMinutes,
    prepMinutes: n(v.prepMinutes) ?? base.prepMinutes,
    extras: Array.isArray(v.extras)
      ? (v.extras as Array<Record<string, unknown>>)
          .filter((e) => typeof e?.label === "string" && typeof e?.amount === "number")
          .map((e) => ({ label: e.label as string, amount: e.amount as number }))
      : [],
  };
}

export const itemFromRow = (r: ItemRow): QuoteItem => ({
  id: r.id,
  quoteId: r.quote_id,
  position: r.position,
  name: r.name,
  quantity: r.quantity,
  finish: r.finish ?? "",
  profileId: r.profile_id,
  snapshot: sanitizeProfileData(parseJson(r.profile_snapshot, {})),
  input: sanitizeInput(parseJson(r.input, {})),
  source: r.source,
  plate: parseJson<PlateData | null>(r.plate, null),
  method: r.method,
  targetPrice: r.target_price,
  unitPrice: r.unit_price,
  unitCost: r.unit_cost,
  partId: r.part_id,
});

export interface NewQuoteDefaults {
  validDays: number | null;
  paymentTerms: string;
  leadTime: string;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function nextQuoteNumber(db: Db): Promise<number> {
  const rows = await db.select<{ n: number | null }>("SELECT MAX(number) AS n FROM quotes");
  return (rows[0]?.n ?? 0) + 1;
}

export async function createQuote(db: Db, defaults: NewQuoteDefaults): Promise<string> {
  const id = newId();
  await db.execute(
    `INSERT INTO quotes (id, number, version, valid_until, payment_terms, lead_time)
     VALUES ($1, $2, 1, $3, $4, $5)`,
    [
      id,
      await nextQuoteNumber(db),
      defaults.validDays === null ? null : addDays(defaults.validDays),
      defaults.paymentTerms,
      defaults.leadTime,
    ],
  );
  return id;
}

export async function getQuote(
  db: Db,
  id: string,
): Promise<{ quote: Quote; items: QuoteItem[] } | null> {
  const rows = await db.select<QuoteRow>("SELECT * FROM quotes WHERE id = $1", [id]);
  if (!rows[0]) return null;
  const items = await db.select<ItemRow>(
    "SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY position",
    [id],
  );
  return { quote: quoteFromRow(rows[0]), items: items.map(itemFromRow) };
}

export function newItem(
  quoteId: string,
  position: number,
  profileId: string | null,
  snapshot: ProfileData,
): QuoteItem {
  return {
    id: newId(),
    quoteId,
    position,
    name: `Peça ${position + 1}`,
    quantity: 1,
    finish: "",
    profileId,
    snapshot,
    input: emptyItemInput(),
    source: "manual",
    plate: null,
    method: null,
    targetPrice: null,
    unitPrice: 0,
    unitCost: 0,
    partId: null,
  };
}

/** Grava o orçamento e substitui os itens pelos informados. */
export async function saveQuote(db: Db, quote: Quote, items: readonly QuoteItem[]): Promise<void> {
  await transaction(db, async () => {
    await db.execute(
      `UPDATE quotes SET client_id = $2, valid_until = $3, payment_terms = $4, lead_time = $5, notes = $6,
         show_breakdown = $7, updated_at = datetime('now') WHERE id = $1`,
      [
        quote.id,
        quote.clientId,
        quote.validUntil,
        quote.paymentTerms,
        quote.leadTime,
        quote.notes,
        quote.showBreakdown ? 1 : 0,
      ],
    );
    // Atualiza no lugar (não apaga e recria): o fechamento de um item fica ligado ao id dele.
    const keep = items.map((i) => i.id);
    const existing = await db.select<{ id: string }>(
      "SELECT id FROM quote_items WHERE quote_id = $1",
      [quote.id],
    );
    for (const { id } of existing) {
      if (!keep.includes(id)) await db.execute("DELETE FROM quote_items WHERE id = $1", [id]);
    }
    for (const [position, item] of items.entries()) {
      await db.execute(
        `INSERT INTO quote_items (id, quote_id, position, name, quantity, finish, profile_id, profile_snapshot,
           input, source, plate, method, target_price, unit_price, unit_cost, part_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT(id) DO UPDATE SET position = excluded.position, name = excluded.name,
           quantity = excluded.quantity, finish = excluded.finish, profile_id = excluded.profile_id,
           profile_snapshot = excluded.profile_snapshot, input = excluded.input, source = excluded.source,
           plate = excluded.plate, method = excluded.method, target_price = excluded.target_price,
           unit_price = excluded.unit_price, unit_cost = excluded.unit_cost, part_id = excluded.part_id,
           updated_at = datetime('now')`,
        [
          item.id,
          quote.id,
          position,
          item.name.trim() || `Peça ${position + 1}`,
          item.quantity,
          item.finish,
          item.profileId,
          JSON.stringify(item.snapshot),
          JSON.stringify(item.input),
          item.source,
          item.plate ? JSON.stringify(item.plate) : null,
          item.method,
          item.targetPrice,
          item.unitPrice,
          item.unitCost,
          item.partId,
        ],
      );
    }
  });
}

export async function deleteQuote(db: Db, id: string): Promise<void> {
  await db.execute("DELETE FROM quotes WHERE id = $1", [id]);
}

export interface QuoteSummary {
  id: string;
  number: number;
  version: number;
  status: QuoteStatus;
  clientId: string | null;
  clientName: string | null;
  itemNames: string;
  items: number;
  total: number;
  cost: number;
  createdAt: string;
  updatedAt: string;
  validUntil: string | null;
}

export async function listQuotes(
  db: Db,
  options: { search?: string; status?: QuoteStatus | "todos" } = {},
): Promise<QuoteSummary[]> {
  const q = `%${(options.search ?? "").trim()}%`;
  const status = options.status && options.status !== "todos" ? options.status : null;
  return db.select<QuoteSummary>(
    `SELECT q.id, q.number, q.version, q.status, q.client_id AS clientId, c.name AS clientName,
            COALESCE(GROUP_CONCAT(i.name, ', '), '') AS itemNames, COUNT(i.id) AS items,
            COALESCE(SUM(i.unit_price * i.quantity), 0) AS total, COALESCE(SUM(i.unit_cost * i.quantity), 0) AS cost,
            q.created_at AS createdAt, q.updated_at AS updatedAt, q.valid_until AS validUntil
       FROM quotes q
       LEFT JOIN clients c ON c.id = q.client_id
       LEFT JOIN quote_items i ON i.quote_id = q.id
      WHERE ($2 IS NULL OR q.status = $2)
      GROUP BY q.id
     HAVING ($1 = '%%' OR c.name LIKE $1 OR itemNames LIKE $1 OR CAST(q.number AS TEXT) LIKE $1)
      ORDER BY q.number DESC, q.version DESC`,
    [q, status],
  );
}

async function copyQuote(db: Db, id: string, number: number, version: number): Promise<string> {
  const original = await getQuote(db, id);
  if (!original) throw new Error("Orçamento não encontrado");
  const newQuoteId = newId();
  await db.execute(
    `INSERT INTO quotes (id, number, version, client_id, valid_until, payment_terms, lead_time, notes, show_breakdown)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newQuoteId,
      number,
      version,
      original.quote.clientId,
      original.quote.validUntil,
      original.quote.paymentTerms,
      original.quote.leadTime,
      original.quote.notes,
      original.quote.showBreakdown ? 1 : 0,
    ],
  );
  await saveQuote(
    db,
    { ...original.quote, id: newQuoteId },
    original.items.map((i) => ({ ...i, id: newId(), quoteId: newQuoteId })),
  );
  return newQuoteId;
}

/** Duplicar: novo número, versão 1, em rascunho. */
export async function duplicateQuote(db: Db, id: string): Promise<string> {
  return copyQuote(db, id, await nextQuoteNumber(db), 1);
}

/** Nova versão: mesmo número, versão seguinte, em rascunho (para revisar um orçamento enviado). */
export async function newQuoteVersion(db: Db, id: string): Promise<string> {
  const original = await getQuote(db, id);
  if (!original) throw new Error("Orçamento não encontrado");
  const rows = await db.select<{ v: number }>(
    "SELECT MAX(version) AS v FROM quotes WHERE number = $1",
    [original.quote.number],
  );
  return copyQuote(db, id, original.quote.number, (rows[0]?.v ?? original.quote.version) + 1);
}

export async function setQuoteStatus(db: Db, id: string, status: QuoteStatus): Promise<void> {
  await db.execute(
    `UPDATE quotes SET status = $2, updated_at = datetime('now'),
       sent_at = CASE WHEN $2 = 'enviado' AND sent_at IS NULL THEN datetime('now') ELSE sent_at END,
       decided_at = CASE WHEN $2 IN ('aprovado', 'recusado') THEN datetime('now') ELSE decided_at END
     WHERE id = $1`,
    [id, status],
  );
}

/** Troca preço e cópia do perfil dos itens (aceitar os custos de hoje na aprovação). */
export async function updateItemPricing(
  db: Db,
  itemId: string,
  patch: { unitPrice: number; unitCost: number; snapshot: ProfileData },
): Promise<void> {
  await db.execute(
    "UPDATE quote_items SET unit_price = $2, unit_cost = $3, profile_snapshot = $4, updated_at = datetime('now') WHERE id = $1",
    [itemId, patch.unitPrice, patch.unitCost, JSON.stringify(patch.snapshot)],
  );
}
