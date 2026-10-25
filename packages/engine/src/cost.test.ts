import { describe, expect, it } from "vitest";
import { costBreakdown, depreciationPerHour, productionCost } from "./cost";
import { JOB, PROFILE } from "./test-fixtures";
import { EngineInputError } from "./validation";

describe("costBreakdown", () => {
  it("confere cada parcela com a conta feita à mão", () => {
    const c = costBreakdown(PROFILE, JOB);
    // material = (100 + 10) g × 1,05 × 120 R$/kg ÷ 1000 = 13,86
    expect(c.material).toBeCloseTo(13.86, 10);
    // energia = 150 W ÷ 1000 × 4 h × 0,90 R$/kWh = 0,54
    expect(c.energy).toBeCloseTo(0.54, 10);
    // máquina = 4 h × (1,50 + 0,50) = 8,00
    expect(c.machine).toBeCloseTo(8, 10);
    // mão de obra = (10 + 20) min ÷ 60 × 30 R$/h = 15,00
    expect(c.labor).toBeCloseTo(15, 10);
    expect(c.extras).toBeCloseTo(2.5, 10);
    // produção = 13,86 + 0,54 + 8 = 22,40; falha = 10% × 22,40 = 2,24
    expect(c.production).toBeCloseTo(22.4, 10);
    expect(c.failure).toBeCloseTo(2.24, 10);
    // total = 22,40 + 2,24 + 15 + 2,50 = 42,14
    expect(c.total).toBeCloseTo(42.14, 10);
    expect(c.effectiveGrams).toBeCloseTo(115.5, 10);
  });

  it("aplica os fatores de calibração ao tempo de impressão e ao pós", () => {
    const c = costBreakdown({ ...PROFILE, timeFactor: 1.25, postProcessingFactor: 1.5 }, JOB);
    expect(c.effectiveHours).toBeCloseTo(5, 10);
    expect(c.machine).toBeCloseTo(10, 10);
    // (10 + 20 × 1,5) min = 40 min → 20,00
    expect(c.laborMinutes).toBeCloseTo(40, 10);
    expect(c.labor).toBeCloseTo(20, 10);
  });

  it("aceita peça sem purga nem extras", () => {
    const c = costBreakdown(PROFILE, { grams: 50, printHours: 1, prepMinutes: 0, postMinutes: 0 });
    expect(c.extras).toBe(0);
    expect(c.material).toBeCloseTo(50 * 1.05 * 0.12, 10);
  });

  it("rejeita valores negativos, não numéricos e taxa de falha de 100%", () => {
    expect(() =>
      costBreakdown({ ...PROFILE, failurePercent: 100 }, { ...JOB, grams: -1 }),
    ).toThrowError(EngineInputError);
    const err = (() => {
      try {
        costBreakdown(
          { ...PROFILE, failurePercent: 100, timeFactor: 0 },
          {
            ...JOB,
            grams: Number.NaN,
          },
        );
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(EngineInputError);
    expect((err as EngineInputError).issues.map((i) => i.field)).toEqual([
      "failurePercent",
      "timeFactor",
      "grams",
    ]);
  });

  it("valida o valor de cada extra", () => {
    expect(() =>
      costBreakdown(PROFILE, { ...JOB, extras: [{ label: "Frete", amount: -5 }] }),
    ).toThrowError(/extras\[0\]\.amount/);
  });
});

describe("productionCost", () => {
  it("é a soma de material, energia e máquina", () => {
    const p = productionCost(PROFILE, 1000, 10);
    expect(p.material).toBeCloseTo(120, 10);
    expect(p.energy).toBeCloseTo(1.35, 10);
    expect(p.machine).toBeCloseTo(20, 10);
    expect(p.total).toBeCloseTo(141.35, 10);
  });
});

describe("depreciationPerHour", () => {
  it("divide o valor depreciável pela vida útil", () => {
    // (5000 − 1000) ÷ 4000 h = 1,00 R$/h
    expect(depreciationPerHour(5000, 1000, 4000)).toBeCloseTo(1, 10);
  });

  it("rejeita vida útil zero e residual maior que o preço", () => {
    expect(() => depreciationPerHour(5000, 0, 0)).toThrowError(EngineInputError);
    expect(() => depreciationPerHour(1000, 2000, 100)).toThrowError(/residualValue/);
  });
});
