import { describe, expect, it } from "vitest";
import { createLocalStorageStore, createMemoryStore, readJson, writeJson } from "./storage";

describe("armazenamento de preferências", () => {
  it("memória: grava e lê", async () => {
    const store = createMemoryStore();
    expect(await store.get("x")).toBeNull();
    await store.set("x", "1");
    expect(await store.get("x")).toBe("1");
  });

  it("localStorage: usa prefixo", async () => {
    const store = createLocalStorageStore("teste:");
    await store.set("tema", "escuro");
    expect(window.localStorage.getItem("teste:tema")).toBe("escuro");
    expect(await store.get("tema")).toBe("escuro");
  });

  it("readJson ignora JSON corrompido e chave ausente", async () => {
    const store = createMemoryStore({ ruim: "{nao é json" });
    expect(await readJson(store, "ruim")).toBeUndefined();
    expect(await readJson(store, "ausente")).toBeUndefined();
    await writeJson(store, "bom", { a: 1 });
    expect(await readJson(store, "bom")).toEqual({ a: 1 });
  });
});
