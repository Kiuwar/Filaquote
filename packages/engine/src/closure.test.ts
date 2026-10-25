import { describe, expect, it } from "vitest";
import { closeItem, summarizeByMonth, type ClosureInput } from "./closure";
import { JOB, PROFILE } from "./test-fixtures";
import { EngineInputError } from "./validation";

// Orçado (ver cost.test.ts): total 42,14, dos quais falha 2,24.
const INPUT: ClosureInput = {
  revenue: 80,
  fees: 8,
  estimated: JOB,
  actual: {
    printHours: 4.5,
    weighedGrams: 118,
    postMinutes: 35,
    reprints: [{ grams: 40, printHours: 1.5 }],
  },
};

describe("closeItem", () => {
  it("custo real com peso pesado, tempo real, pós real e uma reimpressão", () => {
    const r = closeItem(PROFILE, INPUT);
    // material = 118 g × 0,12 = 14,16 (peso pesado já inclui purga e desperdício)
    expect(r.actual.material).toBeCloseTo(14.16, 10);
    // energia = 0,15 kW × 4,5 h × 0,90 = 0,6075; máquina = 4,5 h × 2 = 9
    expect(r.actual.energy).toBeCloseTo(0.6075, 10);
    expect(r.actual.machine).toBeCloseTo(9, 10);
    // mão de obra = (10 + 35) min ÷ 60 × 30 = 22,50
    expect(r.actual.labor).toBeCloseTo(22.5, 10);
    // reimpressão = 40 g × 0,12 + 0,15 × 1,5 × 0,9 + 1,5 × 2 = 4,80 + 0,2025 + 3 = 8,0025
    expect(r.actual.failure).toBeCloseTo(8.0025, 10);
    // total = 23,7675 + 22,50 + 2,50 + 8,0025 = 56,77
    expect(r.actual.total).toBeCloseTo(56.77, 10);
    expect(r.estimated.total).toBeCloseTo(42.14, 10);
  });

  it("lucro e margem: orçado × real", () => {
    const r = closeItem(PROFILE, INPUT);
    // 80 − 8 − 42,14 = 29,86 → 37,325%; 80 − 8 − 56,77 = 15,23 → 19,0375%
    expect(r.estimatedProfit).toBeCloseTo(29.86, 10);
    expect(r.actualProfit).toBeCloseTo(15.23, 10);
    expect(r.estimatedMarginPercent).toBeCloseTo(37.325, 8);
    expect(r.actualMarginPercent).toBeCloseTo(19.0375, 8);
  });

  it("mostra onde o dinheiro foi: desvios em ordem de peso", () => {
    const r = closeItem(PROFILE, INPUT);
    expect(r.deviation.total).toBeCloseTo(14.63, 10);
    expect(r.mainDeviations.map((d) => d.component)).toEqual([
      "labor", // +7,50
      "failure", // +5,7625
      "machine", // +1,00
      "material", // +0,30
      "energy", // +0,0675
    ]);
  });

  it("horas de máquina contam a reimpressão", () => {
    const r = closeItem(PROFILE, INPUT);
    expect(r.reprintHours).toBeCloseTo(1.5, 10);
    expect(r.reprintGrams).toBeCloseTo(40, 10);
    expect(r.machineHours).toBeCloseTo(6, 10);
  });

  it("sem dados reais: igual ao orçado, mas sem a reserva de falha", () => {
    const r = closeItem(PROFILE, { revenue: 80, estimated: JOB, actual: {} });
    expect(r.actual.material).toBeCloseTo(r.estimated.material, 10);
    expect(r.actual.labor).toBeCloseTo(r.estimated.labor, 10);
    expect(r.actual.failure).toBe(0);
    expect(r.actual.total).toBeCloseTo(42.14 - 2.24, 10);
    expect(r.fees).toBe(0);
  });

  it("sem dados reais, usa a calibração do perfil", () => {
    const profile = { ...PROFILE, timeFactor: 1.25, postProcessingFactor: 2 };
    const r = closeItem(profile, { revenue: 80, estimated: JOB, actual: {} });
    expect(r.actual.effectiveHours).toBeCloseTo(5, 10);
    expect(r.actual.laborMinutes).toBeCloseTo(10 + 40, 10);
  });

  it("valor cobrado zero: margem indefinida", () => {
    const r = closeItem(PROFILE, { revenue: 0, estimated: JOB, actual: {} });
    expect(r.actualMarginPercent).toBeNull();
  });

  it("rejeita valores negativos no real", () => {
    expect(() =>
      closeItem(PROFILE, {
        ...INPUT,
        actual: { weighedGrams: -1, reprints: [{ grams: 1, printHours: -2 }] },
      }),
    ).toThrowError(EngineInputError);
  });
});

describe("summarizeByMonth", () => {
  const a = closeItem(PROFILE, INPUT); // lucro real 15,23
  const b = closeItem(PROFILE, { revenue: 80, estimated: JOB, actual: {} }); // lucro real 40,10

  it("agrupa por mês e soma lucro, desvio, reimpressões e horas", () => {
    const months = summarizeByMonth([
      { closedOn: "2026-11-02", result: b },
      { closedOn: "2026-10-05", result: a },
      { closedOn: "2026-10-30", result: b },
    ]);
    expect(months.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
    const oct = months[0]!;
    expect(oct.items).toBe(2);
    expect(oct.revenue).toBeCloseTo(160, 10);
    expect(oct.actualProfit).toBeCloseTo(15.23 + 40.1, 10);
    // orçado: 29,86 + (80 − 42,14) = 67,72 → desvio = 55,33 − 67,72 = −12,39
    expect(oct.profitDeviation).toBeCloseTo(-12.39, 10);
    expect(oct.reprintCost).toBeCloseTo(8.0025, 10);
    expect(oct.machineHours).toBeCloseTo(6 + 4, 10);
    expect(oct.actualMarginPercent).toBeCloseTo((55.33 / 160) * 100, 8);
  });

  it("exige data AAAA-MM-DD", () => {
    expect(() => summarizeByMonth([{ closedOn: "05/10/2026", result: a }])).toThrowError(
      /AAAA-MM-DD/,
    );
  });
});
