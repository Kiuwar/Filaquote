// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emptyProfileData } from "../domain/profile";
import { createNodeDb } from "../test/nodeDb";
import { countClientQuotes, createClient, deleteClient, listClients } from "./clients";
import { deletePart, listParts, savePartFromItem } from "./parts";
import {
  createQuote,
  deleteQuote,
  duplicateQuote,
  getQuote,
  listQuotes,
  newItem,
  newQuoteVersion,
  saveQuote,
  setQuoteStatus,
} from "./quotes";

const DEFAULTS = { validDays: 10, paymentTerms: "Pix", leadTime: "5 dias úteis" };

async function quoteWithItems() {
  const { db } = createNodeDb();
  const clientId = await createClient(db, {
    name: "Ana Souza",
    phone: "11 9",
    email: "",
    notes: "",
  });
  const id = await createQuote(db, DEFAULTS);
  const { quote } = (await getQuote(db, id))!;
  const a = {
    ...newItem(id, 0, null, emptyProfileData()),
    name: "Suporte de headset",
    quantity: 2,
    unitPrice: 30,
    unitCost: 18,
  };
  const b = {
    ...newItem(id, 1, null, emptyProfileData()),
    name: "Chaveiro",
    quantity: 10,
    unitPrice: 5,
    unitCost: 2,
  };
  await saveQuote(db, { ...quote, clientId }, [a, b]);
  return { db, id, clientId, a, b };
}

describe("orçamentos", () => {
  it("numera em sequência e aplica os padrões", async () => {
    const { db } = createNodeDb();
    const first = await createQuote(db, DEFAULTS);
    const second = await createQuote(db, DEFAULTS);
    const q1 = (await getQuote(db, first))!.quote;
    const q2 = (await getQuote(db, second))!.quote;
    expect([q1.number, q2.number]).toEqual([1, 2]);
    expect(q1).toMatchObject({
      version: 1,
      status: "rascunho",
      paymentTerms: "Pix",
      leadTime: "5 dias úteis",
    });
    expect(q1.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("salva itens em ordem e atualiza no lugar (mantém os ids)", async () => {
    const { db, id, a, b } = await quoteWithItems();
    let loaded = (await getQuote(db, id))!;
    expect(loaded.items.map((i) => i.name)).toEqual(["Suporte de headset", "Chaveiro"]);
    await saveQuote(db, loaded.quote, [{ ...b, quantity: 20 }, a]);
    loaded = (await getQuote(db, id))!;
    expect(loaded.items.map((i) => [i.id, i.quantity])).toEqual([
      [b.id, 20],
      [a.id, 2],
    ]);
    await saveQuote(db, loaded.quote, [a]);
    expect((await getQuote(db, id))!.items).toHaveLength(1);
  });

  it("lista com cliente, total e busca", async () => {
    const { db } = await quoteWithItems();
    const all = await listQuotes(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ clientName: "Ana Souza", items: 2, total: 110, cost: 56 });
    expect(await listQuotes(db, { search: "headset" })).toHaveLength(1);
    expect(await listQuotes(db, { search: "Ana" })).toHaveLength(1);
    expect(await listQuotes(db, { search: "inexistente" })).toHaveLength(0);
    expect(await listQuotes(db, { status: "aprovado" })).toHaveLength(0);
  });

  it("status registra envio e decisão", async () => {
    const { db, id } = await quoteWithItems();
    await setQuoteStatus(db, id, "enviado");
    await setQuoteStatus(db, id, "aprovado");
    const q = (await getQuote(db, id))!.quote;
    expect(q.status).toBe("aprovado");
    expect(q.sentAt).not.toBeNull();
    expect(q.decidedAt).not.toBeNull();
  });

  it("duplicar dá novo número; nova versão mantém o número", async () => {
    const { db, id } = await quoteWithItems();
    const dup = (await getQuote(db, await duplicateQuote(db, id)))!;
    expect([dup.quote.number, dup.quote.version, dup.items.length]).toEqual([2, 1, 2]);
    const v2 = (await getQuote(db, await newQuoteVersion(db, id)))!;
    expect([v2.quote.number, v2.quote.version, v2.quote.status]).toEqual([1, 2, "rascunho"]);
    const v3 = (await getQuote(db, await newQuoteVersion(db, id)))!;
    expect(v3.quote.version).toBe(3);
  });

  it("excluir orçamento apaga os itens", async () => {
    const { db, id } = await quoteWithItems();
    await deleteQuote(db, id);
    expect(await db.select("SELECT * FROM quote_items")).toEqual([]);
  });
});

describe("clientes (LGPD)", () => {
  it("excluir mantendo orçamentos: some a pessoa, fica o histórico", async () => {
    const { db, id, clientId } = await quoteWithItems();
    expect(await countClientQuotes(db, clientId)).toBe(1);
    await deleteClient(db, clientId, false);
    expect(await listClients(db)).toEqual([]);
    const q = (await getQuote(db, id))!;
    expect(q.quote.clientId).toBeNull();
    expect(q.items).toHaveLength(2);
  });

  it("excluir com os orçamentos: apaga tudo do cliente", async () => {
    const { db, clientId } = await quoteWithItems();
    await deleteClient(db, clientId, true);
    expect(await listQuotes(db)).toEqual([]);
    expect(await db.select("SELECT * FROM quote_items")).toEqual([]);
  });
});

describe("peças recorrentes", () => {
  it("salva a entrada e o último preço; reaproveita o id ao salvar de novo", async () => {
    const { db, a } = await quoteWithItems();
    const id = await savePartFromItem(db, { ...a, input: { ...a.input, grams: 42 } });
    let parts = await listParts(db);
    expect(parts[0]).toMatchObject({ name: "Suporte de headset", lastUnitPrice: 30 });
    expect(parts[0]!.input.grams).toBe(42);
    await savePartFromItem(db, { ...a, partId: id, name: "Suporte v2", unitPrice: 32 });
    parts = await listParts(db);
    expect(parts.map((p) => [p.name, p.lastUnitPrice])).toEqual([["Suporte v2", 32]]);
    await deletePart(db, id);
    expect(await listParts(db)).toEqual([]);
  });
});
