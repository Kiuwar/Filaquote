// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeDb, migrationFiles, MIGRATIONS_DIR } from "../test/nodeDb";

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

  it("aplicar de novo não falha (idempotentes)", () => {
    const { raw } = createNodeDb();
    for (const m of migrationFiles()) expect(() => raw.exec(m.sql)).not.toThrow();
  });

  it("dados de cada versão sobrevivem às migrations seguintes", async () => {
    // Para cada versão k: cria o banco até k, grava dados típicos de k e aplica o resto.
    for (const { version } of migrationFiles()) {
      const { db, migrate } = createNodeDb(version);
      await db.execute(
        "INSERT INTO settings (key, value) VALUES ('appearance', '{\"mode\":\"dark\"}')",
      );
      if (version >= 2) {
        await db.execute(
          "INSERT INTO profiles (id, name, data, is_default) VALUES ('p1', 'PLA', '{}', 1)",
        );
      }
      migrate();
      expect(await db.select("SELECT key, value FROM settings")).toEqual([
        { key: "appearance", value: '{"mode":"dark"}' },
      ]);
      if (version >= 2) {
        expect(await db.select("SELECT id, name, is_default FROM profiles")).toEqual([
          { id: "p1", name: "PLA", is_default: 1 },
        ]);
      }
    }
  });
});
