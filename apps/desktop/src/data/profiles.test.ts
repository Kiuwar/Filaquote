// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emptyProfileData } from "../domain/profile";
import { createNodeDb } from "../test/nodeDb";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  getProfile,
  listProfiles,
  setDefaultProfile,
  updateProfile,
} from "./profiles";

describe("perfis de cálculo", () => {
  it("o primeiro perfil nasce padrão; salvar e ler de volta", async () => {
    const { db } = createNodeDb();
    const data = emptyProfileData();
    data.cost.filamentPricePerKg = 99.9;
    const a = await createProfile(db, "PLA básico", data);
    const b = await createProfile(db, "PETG", emptyProfileData());
    const all = await listProfiles(db);
    expect(all.map((p) => [p.name, p.isDefault])).toEqual([
      ["PLA básico", true],
      ["PETG", false],
    ]);
    expect((await getProfile(db, a))!.data.cost.filamentPricePerKg).toBe(99.9);

    await updateProfile(db, b, "PETG preto", { ...data, cost: { ...data.cost, wastePercent: 3 } });
    expect((await getProfile(db, b))!.name).toBe("PETG preto");
    expect((await getProfile(db, b))!.data.cost.wastePercent).toBe(3);
  });

  it("só um padrão por vez; excluir o padrão promove outro", async () => {
    const { db } = createNodeDb();
    const a = await createProfile(db, "A", emptyProfileData());
    const b = await createProfile(db, "B", emptyProfileData());
    await setDefaultProfile(db, b);
    expect((await listProfiles(db)).filter((p) => p.isDefault).map((p) => p.id)).toEqual([b]);
    await deleteProfile(db, b);
    expect((await getProfile(db, a))!.isDefault).toBe(true);
  });

  it("duplicar copia os parâmetros com outro nome", async () => {
    const { db } = createNodeDb();
    const data = emptyProfileData();
    data.pricing.marginPercent = 35;
    const a = await createProfile(db, "Base", data);
    const copy = await duplicateProfile(db, a);
    const p = await getProfile(db, copy!);
    expect(p!.name).toBe("Base (cópia)");
    expect(p!.data.pricing.marginPercent).toBe(35);
    expect(p!.isDefault).toBe(false);
  });

  it("JSON corrompido no banco vira perfil vazio, sem quebrar", async () => {
    const { db } = createNodeDb();
    await db.execute("INSERT INTO profiles (id, name, data) VALUES ('x', 'Quebrado', '{nao json')");
    expect((await getProfile(db, "x"))!.data).toEqual(emptyProfileData());
  });
});
