// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeDb, migrationFiles, MIGRATIONS_DIR } from "../test/nodeDb";

/** Dados típicos de cada versão, gravados logo depois de aplicá-la. */
const SEED: Record<number, string[]> = {
  1: [`INSERT INTO settings (key, value) VALUES ('appearance', '{"mode":"dark"}')`],
  2: [`INSERT INTO profiles (id, name, data, is_default) VALUES ('p1', 'PLA', '{}', 1)`],
  3: [
    `INSERT INTO clients (id, name, phone) VALUES ('c1', 'Ana', '11 90000-0000')`,
    `INSERT INTO quotes (id, number, client_id, status) VALUES ('q1', 7, 'c1', 'enviado')`,
    `INSERT INTO quote_items (id, quote_id, position, name, quantity, profile_snapshot, input, unit_price, unit_cost)
     VALUES ('i1', 'q1', 0, 'Suporte', 3, '{}', '{}', 25.5, 12)`,
  ],
  4: [
    `INSERT INTO parts (id, name, input) VALUES ('pt1', 'Suporte', '{}')`,
    `UPDATE quote_items SET part_id = 'pt1' WHERE id = 'i1'`,
  ],
};

/** O que precisa continuar igual depois de todas as migrations seguintes. */
const EXPECT: Record<number, Array<[string, unknown[]]>> = {
  1: [["SELECT key, value FROM settings", [{ key: "appearance", value: '{"mode":"dark"}' }]]],
  2: [["SELECT id, name, is_default FROM profiles", [{ id: "p1", name: "PLA", is_default: 1 }]]],
  3: [
    ["SELECT name, phone FROM clients", [{ name: "Ana", phone: "11 90000-0000" }]],
    [
      "SELECT number, client_id, status FROM quotes",
      [{ number: 7, client_id: "c1", status: "enviado" }],
    ],
    [
      "SELECT name, quantity, unit_price, unit_cost FROM quote_items",
      [{ name: "Suporte", quantity: 3, unit_price: 25.5, unit_cost: 12 }],
    ],
  ],
  4: [["SELECT part_id FROM quote_items", [{ part_id: "pt1" }]]],
};

describe("migrations", () => {
  it("versões em sequência, sem buracos nem repetição", () => {
    const versions = migrationFiles().map((m) => m.version);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
  });

  it("todas registradas no Rust, na mesma ordem e com a mesma versão", () => {
    const lib = readFileSync(join(MIGRATIONS_DIR, "../src/lib.rs"), "utf8");
    const registered = [
      ...lib.matchAll(/version:\s*(\d+),[\s\S]*?include_str!\("\.\.\/migrations\/([^"]+)"\)/g),
    ].map((m) => [Number(m[1]), m[2]]);
    expect(registered).toEqual(migrationFiles().map((m) => [m.version, m.name]));
  });

  it("toda migration tem dados de teste (lembrete ao criar uma nova)", () => {
    for (const { version } of migrationFiles()) {
      expect(SEED[version], `faltam dados de teste para a migration ${version}`).toBeDefined();
    }
  });

  it("dados de cada versão sobrevivem às migrations seguintes", async () => {
    // Para cada ponto de partida k: banco na versão k com os dados de 1..k, depois o resto.
    for (const { version: start } of migrationFiles()) {
      const { db, migrate } = createNodeDb(0);
      for (const { version } of migrationFiles().filter((m) => m.version <= start)) {
        migrate(version);
        for (const sql of SEED[version] ?? []) await db.execute(sql);
      }
      migrate();
      for (const { version } of migrationFiles().filter((m) => m.version <= start)) {
        for (const [sql, rows] of EXPECT[version] ?? []) expect(await db.select(sql)).toEqual(rows);
      }
    }
  });
});
