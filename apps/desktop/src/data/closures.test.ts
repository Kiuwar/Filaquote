// @vitest-environment node
import { describe, expect, it } from "vitest";
import { calibrationSample, closureResult } from "../domain/closure";
import { emptyProfileData, type ProfileData } from "../domain/profile";
import { createNodeDb } from "../test/nodeDb";
import { closuresForQuote, listClosedItems, saveClosure, setClosureExcluded } from "./closures";
import { createQuote, deleteQuote, getQuote, newItem, saveQuote } from "./quotes";

function profile(): ProfileData {
  const d = emptyProfileData();
  d.cost = {
    filamentPricePerKg: 100,
    wastePercent: 0,
    printerWatts: 0,
    energyTariffPerKwh: 0,
    depreciationPerHour: 2,
    maintenancePerHour: 0,
    laborPerHour: 60,
    failurePercent: 0,
    timeFactor: 1,
    postProcessingFactor: 1,
  };
  return d;
}

async function setup() {
  const { db } = createNodeDb();
  const id = await createQuote(db, { validDays: null, paymentTerms: "", leadTime: "" });
  const { quote } = (await getQuote(db, id))!;
  const item = {
    ...newItem(id, 0, "perfil-1", profile()),
    quantity: 2,
    input: { grams: 20, purgeGrams: 0, printHours: 1, postMinutes: 5, prepMinutes: 10, extras: [] },
    unitPrice: 30,
  };
  await saveQuote(db, quote, [item]);
  return { db, id, item };
}

describe("fechamentos", () => {
  it("grava, lê e calcula o lucro real do item", async () => {
    const { db, id, item } = await setup();
    await saveClosure(db, {
      itemId: item.id,
      closedOn: "2026-11-01",
      actual: { printHours: 2.5, postMinutes: 30 },
      revenue: 60,
      fees: 0,
      excluded: false,
    });
    const map = await closuresForQuote(db, id);
    const c = map.get(item.id)!;
    expect(c.actual.printHours).toBe(2.5);
    const r = closureResult(item, c)!;
    // estimado: material 4 + máquina 4 + mão de obra (10 + 10) min = 20 → 28
    expect(r.estimated.total).toBeCloseTo(28, 10);
    // real: material 4 + máquina 5 + mão de obra (10 + 30) min = 40 → 49
    expect(r.actual.total).toBeCloseTo(49, 10);
    expect(r.actualProfit).toBeCloseTo(11, 10);
    expect(calibrationSample(item, c)).toMatchObject({ slicerHours: 2, actualHours: 2.5 });
  });

  it("filtra por perfil, marca exclusão e apaga junto com o orçamento", async () => {
    const { db, id, item } = await setup();
    await saveClosure(db, {
      itemId: item.id,
      closedOn: "2026-11-01",
      actual: {},
      revenue: 60,
      fees: 0,
      excluded: false,
    });
    expect(await listClosedItems(db, "perfil-1")).toHaveLength(1);
    expect(await listClosedItems(db, "outro")).toHaveLength(0);
    await setClosureExcluded(db, item.id, true);
    expect((await listClosedItems(db))[0]!.closure.excluded).toBe(true);
    await deleteQuote(db, id);
    expect(await listClosedItems(db)).toEqual([]);
  });

  it("editar o orçamento não apaga o fechamento (itens atualizados no lugar)", async () => {
    const { db, id, item } = await setup();
    await saveClosure(db, {
      itemId: item.id,
      closedOn: "2026-11-01",
      actual: {},
      revenue: 60,
      fees: 0,
      excluded: false,
    });
    const { quote, items } = (await getQuote(db, id))!;
    await saveQuote(db, { ...quote, notes: "x" }, items);
    expect(await listClosedItems(db)).toHaveLength(1);
  });
});
