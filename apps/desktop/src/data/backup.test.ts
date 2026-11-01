// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emptyProfileData } from "../domain/profile";
import { createNodeDb } from "../test/nodeDb";
import { backupCounts, deleteAllData, exportBackup, importBackup, parseBackup } from "./backup";
import { saveClosure } from "./closures";
import { createClient } from "./clients";
import { savePartFromItem } from "./parts";
import { createProfile } from "./profiles";
import { createQuote, getQuote, newItem, saveQuote } from "./quotes";

async function filled() {
  const { db } = createNodeDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ('appearance', '{\"mode\":\"dark\"}')",
  );
  const profileId = await createProfile(db, "PLA", emptyProfileData());
  const clientId = await createClient(db, { name: "Ana", phone: "", email: "", notes: "" });
  const quoteId = await createQuote(db, { validDays: null, paymentTerms: "Pix", leadTime: "" });
  const { quote } = (await getQuote(db, quoteId))!;
  const item = {
    ...newItem(quoteId, 0, profileId, emptyProfileData()),
    name: "Vaso",
    unitPrice: 50,
  };
  await saveQuote(db, { ...quote, clientId }, [item]);
  await savePartFromItem(db, item);
  await saveClosure(db, {
    itemId: item.id,
    closedOn: "2026-11-01",
    actual: { printHours: 3 },
    revenue: 50,
    fees: 0,
    excluded: false,
  });
  return db;
}

describe("backup", () => {
  it("exporta e importa tudo em outro computador (banco vazio)", async () => {
    const source = await filled();
    const backup = parseBackup(JSON.stringify(await exportBackup(source, 5)), 5);
    expect(backupCounts(backup)).toEqual({
      settings: 1,
      profiles: 1,
      clients: 1,
      parts: 1,
      quotes: 1,
      quote_items: 1,
      closures: 1,
    });
    const { db: target } = createNodeDb();
    await importBackup(target, backup);
    for (const t of [
      "settings",
      "profiles",
      "clients",
      "parts",
      "quotes",
      "quote_items",
      "closures",
    ]) {
      expect(await target.select(`SELECT * FROM ${t}`)).toEqual(
        await source.select(`SELECT * FROM ${t}`),
      );
    }
  });

  it("importar substitui os dados atuais", async () => {
    const db = await filled();
    await createClient(db, { name: "Bruno", phone: "", email: "", notes: "" });
    const backup = await exportBackup(await filled(), 5);
    await importBackup(db, backup);
    expect(await db.select("SELECT name FROM clients")).toEqual([{ name: "Ana" }]);
  });

  it("recusa arquivos que não são backup, ou de versão mais nova", () => {
    expect(() => parseBackup("{nao json", 5)).toThrowError(/JSON inválido/);
    expect(() => parseBackup(JSON.stringify({ app: "outro" }), 5)).toThrowError(/não é um backup/);
    expect(() =>
      parseBackup(
        JSON.stringify({ app: "filaquote", format: 1, schemaVersion: 99, tables: {} }),
        5,
      ),
    ).toThrowError(/versão mais nova/);
  });

  it("backup antigo (sem tabelas novas) importa, e colunas desconhecidas são ignoradas", async () => {
    const { db } = createNodeDb();
    await importBackup(
      db,
      parseBackup(
        JSON.stringify({
          app: "filaquote",
          format: 1,
          schemaVersion: 2,
          exportedAt: "",
          tables: { settings: [{ key: "k", value: "v", coluna_do_futuro: 1 }], profiles: [] },
        }),
        5,
      ),
    );
    expect(await db.select("SELECT key, value FROM settings")).toEqual([{ key: "k", value: "v" }]);
  });

  it("falha no meio: nada muda (transação)", async () => {
    const db = await filled();
    const before = await db.select("SELECT * FROM quotes");
    const broken = await exportBackup(db, 5);
    broken.tables.quote_items = [
      {
        id: "x",
        quote_id: "nao-existe",
        position: 0,
        name: "y",
        quantity: 1,
        profile_snapshot: "{}",
        input: "{}",
      },
    ];
    await expect(importBackup(db, broken)).rejects.toThrow();
    expect(await db.select("SELECT * FROM quotes")).toEqual(before);
  });

  it("apagar todos os dados mantém só as preferências", async () => {
    const db = await filled();
    await deleteAllData(db);
    expect(await db.select("SELECT COUNT(*) AS n FROM quotes")).toEqual([{ n: 0 }]);
    expect(await db.select("SELECT COUNT(*) AS n FROM profiles")).toEqual([{ n: 0 }]);
    expect(await db.select("SELECT COUNT(*) AS n FROM settings")).toEqual([{ n: 1 }]);
  });
});
