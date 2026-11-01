import { describe, expect, it } from "vitest";
import { emptyProfileData, type ProfileData } from "./profile";
import { calculateItem, quoteTotals, syncItem, totalJob, type QuoteItem } from "./quote";

function fullProfile(): ProfileData {
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
  d.pricing.marginPercent = 50;
  d.pricing.minimumMarginPercent = 20;
  d.pricing.premiumPercent = 20;
  return d;
}

function item(patch: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: "i",
    quoteId: "q",
    position: 0,
    name: "Peça",
    quantity: 2,
    finish: "",
    profileId: null,
    snapshot: fullProfile(),
    input: {
      grams: 20,
      purgeGrams: 0,
      printHours: 1,
      postMinutes: 5,
      prepMinutes: 10,
      extras: [{ label: "Saquinho", amount: 1 }],
    },
    source: "manual",
    plate: null,
    method: null,
    targetPrice: null,
    unitPrice: 0,
    unitCost: 0,
    partId: null,
    ...patch,
  };
}

describe("item de orçamento", () => {
  it("entrada por unidade vira total; preparo conta uma vez", () => {
    const r = totalJob(item().input, 3);
    expect(r).toEqual({
      job: {
        grams: 60,
        purgeGrams: 0,
        printHours: 3,
        prepMinutes: 10,
        postMinutes: 15,
        extras: [{ label: "Saquinho", amount: 3 }],
      },
    });
  });

  it("custo: 2 un × (20 g × 0,10 + 1 h × 2) + (10 + 10) min de trabalho + 2 de extras", () => {
    const c = calculateItem(item());
    // material 4 + máquina 4 + mão de obra 20 + extras 2 = 30 → 15 por unidade
    expect(c.cost!.total).toBeCloseTo(30, 10);
    expect(c.pricing!.unitCost).toBeCloseTo(15, 10);
    expect(c.problems).toEqual([]);
  });

  it("perfil incompleto e entrada incompleta dizem o que falta", () => {
    expect(calculateItem(item({ snapshot: emptyProfileData() })).problems.join()).toMatch(
      /Perfil a confirmar/,
    );
    const c = calculateItem(item({ input: { ...item().input, grams: null } }));
    expect(c.problems.join()).toMatch(/gramas por unidade/);
  });

  it("preço acompanha o método escolhido; digitado fica fixo", () => {
    const viaMargin = syncItem(item({ method: "margin" })).item;
    expect(viaMargin.unitPrice).toBe(30); // 15 ÷ (1 − 0,5)
    const premium = syncItem(item({ method: "faixa:premium" })).item;
    expect(premium.unitPrice).toBe(36);
    const manual = syncItem(item({ method: "manual", unitPrice: 99 })).item;
    expect(manual.unitPrice).toBe(99);
    expect(manual.unitCost).toBeCloseTo(15, 10);
  });

  it("mesa cheia: custo pelo modelo de mesa quando ligado", () => {
    const plate = {
      a: { copies: 1, printHours: 3, grams: 20 },
      b: { copies: 4, printHours: 6, grams: 80 },
      enabled: true,
    };
    const c = calculateItem(item({ quantity: 4, plate, input: { ...item().input, extras: [] } }));
    // 1 mesa: 6 h × 2 = 12; 80 g × 0,10 = 8; mão de obra (10 + 4 × 5) min = 30 → 50
    expect(c.cost!.total).toBeCloseTo(50, 10);
  });

  it("totais do orçamento", () => {
    const t = quoteTotals([
      item({ unitPrice: 30, unitCost: 15 }),
      item({ quantity: 1, unitPrice: 10, unitCost: 8 }),
    ]);
    expect(t).toEqual({ price: 70, cost: 38, profit: 32, marginPercent: (32 / 70) * 100 });
  });
});
