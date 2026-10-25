import { describe, expect, it } from "vitest";
import type { CostProfile } from "./cost";
import { fitPlateModel, plateTotals, quantityTiers } from "./plate";
import { EngineInputError } from "./validation";

// Perfil fictício com números redondos para conferir à mão.
const SIMPLE: CostProfile = {
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

describe("fitPlateModel", () => {
  it("separa gasto por mesa e por cópia (1 cópia × 8 cópias)", () => {
    const m = fitPlateModel(
      { copies: 1, printHours: 2, grams: 30, purgeGrams: 12 },
      { copies: 8, printHours: 9, grams: 240, purgeGrams: 20 },
    );
    // tempo: unitário = (9 − 2) ÷ 7 = 1 h; fixo = 2 − 1 = 1 h
    expect(m.perUnit.printHours).toBeCloseTo(1, 10);
    expect(m.perPlate.printHours).toBeCloseTo(1, 10);
    // filamento: unitário = 210 ÷ 7 = 30 g; fixo = 0
    expect(m.perUnit.grams).toBeCloseTo(30, 10);
    expect(m.perPlate.grams).toBeCloseTo(0, 10);
    // purga: unitário = 8 ÷ 7 g; fixo = 12 − 8/7 = 76/7 g (a maior parte é por mesa)
    expect(m.perUnit.purgeGrams).toBeCloseTo(8 / 7, 10);
    expect(m.perPlate.purgeGrams).toBeCloseTo(76 / 7, 10);
    expect(m.maxCopiesPerPlate).toBe(8);
    expect(m.warnings).toEqual([]);
  });

  it("aceita as amostras em qualquer ordem", () => {
    const a = { copies: 4, printHours: 6, grams: 80 };
    const b = { copies: 1, printHours: 3, grams: 20 };
    expect(fitPlateModel(a, b)).toEqual(fitPlateModel(b, a));
  });

  it("mesa cheia que não dilui: sem fixo, maior gasto por cópia e aviso", () => {
    // 1 cópia = 2 h; 4 cópias = 10 h (2,5 h por cópia): o linear daria fixo negativo.
    const m = fitPlateModel(
      { copies: 1, printHours: 2, grams: 10 },
      { copies: 4, printHours: 10, grams: 40 },
    );
    expect(m.perPlate.printHours).toBe(0);
    expect(m.perUnit.printHours).toBeCloseTo(2.5, 10);
    expect(m.warnings.map((w) => w.metric)).toEqual(["printHours"]);
  });

  it("mais cópias gastando menos no total: sem unitário, maior total por mesa e aviso", () => {
    const m = fitPlateModel(
      { copies: 1, printHours: 2, grams: 10, purgeGrams: 12 },
      { copies: 8, printHours: 9, grams: 80, purgeGrams: 10 },
    );
    expect(m.perUnit.purgeGrams).toBe(0);
    expect(m.perPlate.purgeGrams).toBe(12);
    expect(m.warnings.map((w) => w.metric)).toEqual(["purgeGrams"]);
  });

  it("rejeita mesmo número de cópias, cópias fracionadas e valores negativos", () => {
    expect(() =>
      fitPlateModel({ copies: 2, printHours: 1, grams: 1 }, { copies: 2, printHours: 2, grams: 2 }),
    ).toThrowError(/diferente/);
    expect(() =>
      fitPlateModel(
        { copies: 1.5, printHours: 1, grams: 1 },
        { copies: 3, printHours: 2, grams: -2 },
      ),
    ).toThrowError(EngineInputError);
  });
});

describe("plateTotals", () => {
  const m = fitPlateModel(
    { copies: 1, printHours: 2, grams: 30, purgeGrams: 12 },
    { copies: 8, printHours: 9, grams: 240, purgeGrams: 20 },
  );

  it("10 unidades com 8 por mesa = 2 mesas", () => {
    const t = plateTotals(m, 10);
    expect(t.plates).toBe(2);
    // 2 × 1 h + 10 × 1 h = 12 h; 10 × 30 g = 300 g; purga 2 × 76/7 + 10 × 8/7 = 232/7 g
    expect(t.printHours).toBeCloseTo(12, 10);
    expect(t.grams).toBeCloseTo(300, 10);
    expect(t.purgeGrams).toBeCloseTo(232 / 7, 10);
  });

  it("rejeita quantidade zero", () => {
    expect(() => plateTotals(m, 0)).toThrowError(/quantity/);
  });
});

describe("quantityTiers", () => {
  // 1 cópia = 3 h e 20 g; 4 cópias = 6 h e 80 g → fixo 2 h por mesa, 1 h e 20 g por cópia.
  const model = fitPlateModel(
    { copies: 1, printHours: 3, grams: 20 },
    { copies: 4, printHours: 6, grams: 80 },
  );
  const options = {
    prepMinutesPerPlate: 10,
    postMinutesPerUnit: 5,
    extrasPerUnit: [{ label: "Embalagem", amount: 1 }],
    unitPrice: 30,
    minMarginPercent: 10,
  };

  it("calcula custo unitário, preço sugerido e desconto máximo por faixa", () => {
    const r = quantityTiers(SIMPLE, model, { ...options, quantities: [1, 4, 5, 8] });
    // 1 un: material 2 + máquina 6 + mão de obra 15 + embalagem 1 = 24 → margem (30 − 24) ÷ 30 = 20%
    expect(r.baseMarginPercent).toBeCloseTo(20, 10);
    const [q1, q4, q5, q8] = r.tiers;

    expect(q1!.unitCost).toBeCloseTo(24, 10);
    expect(q1!.suggestedUnitPrice).toBeCloseTo(30, 10);
    // mínimo = 24 ÷ 0,9 = 26,67 → desconto máximo 11,11%
    expect(q1!.maxDiscountPercent).toBeCloseTo((1 - 24 / 0.9 / 30) * 100, 8);

    // 4 un, 1 mesa: material 8 + máquina 12 + mão de obra 30 + embalagem 4 = 54 → 13,50 por unidade
    expect(q4!.plates).toBe(1);
    expect(q4!.unitCost).toBeCloseTo(13.5, 10);
    // mantendo 20% de margem: 13,50 ÷ 0,8 = 16,875 → 43,75% de desconto
    expect(q4!.suggestedUnitPrice).toBeCloseTo(16.875, 10);
    expect(q4!.suggestedDiscountPercent).toBeCloseTo(43.75, 10);
    // margem mínima 10%: 13,50 ÷ 0,9 = 15 → até 50% de desconto
    expect(q4!.minUnitPrice).toBeCloseTo(15, 10);
    expect(q4!.maxDiscountPercent).toBeCloseTo(50, 10);

    // 5 un precisam de 2 mesas: 78 ÷ 5 = 15,60, mais caro por unidade que 4
    expect(q5!.plates).toBe(2);
    expect(q5!.unitCost).toBeCloseTo(15.6, 10);
    // 8 un, 2 mesas cheias: volta a 13,50
    expect(q8!.unitCost).toBeCloseTo(13.5, 10);
  });

  it("faixas padrão: 1, N, 2N e 4N", () => {
    const r = quantityTiers(SIMPLE, model, options);
    expect(r.tiers.map((t) => t.quantity)).toEqual([1, 4, 8, 16]);
  });

  it("marca a faixa em que o preço de tabela já fica abaixo da margem mínima", () => {
    const r = quantityTiers(SIMPLE, model, { ...options, unitPrice: 25, quantities: [1] });
    // mínimo = 26,67 > 25
    expect(r.tiers[0]!.belowMinMargin).toBe(true);
    expect(r.tiers[0]!.maxDiscountPercent).toBe(0);
  });

  it("rejeita margem mínima de 100% e quantidade inválida", () => {
    expect(() => quantityTiers(SIMPLE, model, { ...options, minMarginPercent: 100 })).toThrowError(
      /minMarginPercent/,
    );
    expect(() => quantityTiers(SIMPLE, model, { ...options, quantities: [0] })).toThrowError(
      /quantities\[0\]/,
    );
  });
});
