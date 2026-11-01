import { describe, expect, it } from "vitest";
import {
  applyCalibration,
  median,
  sampleFromClosure,
  suggestCalibration,
  type CalibrationSample,
} from "./calibration";
import { JOB, PROFILE } from "./test-fixtures";

function sample(i: number, extra: Partial<CalibrationSample>): CalibrationSample {
  return { id: `s${i}`, slicerHours: 4, slicerGrams: 100, estimatedPostMinutes: 20, ...extra };
}

const byField = (r: ReturnType<typeof suggestCalibration>, field: string) =>
  r.suggestions.find((s) => s.field === field)!;

describe("median", () => {
  it("ímpar, par e lista vazia", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrowError(RangeError);
  });
});

describe("fator de tempo", () => {
  const ratios = [1.05, 1.1, 1.08, 1.2, 1.07];
  const samples = ratios.map((r, i) => sample(i, { actualHours: 4 * r }));

  it("sugere a mediana de real ÷ fatiador com 5 amostras", () => {
    const t = byField(suggestCalibration(PROFILE, samples), "timeFactor");
    expect(t.suggested).toBeCloseTo(1.08, 10);
    expect(t.samples).toBe(5);
    expect(t.range![0]).toBeCloseTo(1.05, 10);
    expect(t.range![1]).toBeCloseTo(1.2, 10);
    expect(t.difference).toBeCloseTo(0.08, 10);
    expect(t.worthApplying).toBe(true);
  });

  it("com 4 amostras não sugere e diz quantas faltam", () => {
    const t = byField(suggestCalibration(PROFILE, samples.slice(0, 4)), "timeFactor");
    expect(t.suggested).toBeNull();
    expect(t.missingSamples).toBe(1);
    expect(t.worthApplying).toBe(false);
  });

  it("uma impressão fora da curva não puxa a sugestão", () => {
    const withOutlier = [1.05, 1.06, 1.07, 1.08, 3].map((r, i) =>
      sample(i, { actualHours: 4 * r }),
    );
    expect(byField(suggestCalibration(PROFILE, withOutlier), "timeFactor").suggested).toBeCloseTo(
      1.07,
      10,
    );
  });

  it("amostras excluídas não entram e são contadas à parte", () => {
    const r = suggestCalibration(PROFILE, [
      ...samples,
      sample(9, { actualHours: 40, excluded: true }),
    ]);
    expect(byField(r, "timeFactor").suggested).toBeCloseTo(1.08, 10);
    expect(r.used).toBe(5);
    expect(r.excluded).toBe(1);
  });

  it("mudança abaixo de 2% não vale a pena aplicar", () => {
    const close = [1.01, 1.0, 1.01, 1.02, 1.01].map((r, i) => sample(i, { actualHours: 4 * r }));
    const t = byField(suggestCalibration(PROFILE, close), "timeFactor");
    expect(t.suggested).toBeCloseTo(1.01, 10);
    expect(t.worthApplying).toBe(false);
  });
});

describe("pós-processamento", () => {
  it("sugere a mediana de real ÷ estimado", () => {
    const samples = [30, 24, 28, 40, 26].map((m, i) => sample(i, { actualPostMinutes: m }));
    // razões 1,5; 1,2; 1,4; 2,0; 1,3 → mediana 1,4
    expect(
      byField(suggestCalibration(PROFILE, samples), "postProcessingFactor").suggested,
    ).toBeCloseTo(1.4, 10);
  });
});

describe("desperdício", () => {
  it("sugere quanto o peso pesado passa do fatiador", () => {
    const samples = [104, 103, 106, 102, 105].map((g, i) => sample(i, { weighedGrams: g }));
    const w = byField(suggestCalibration(PROFILE, samples), "wastePercent");
    expect(w.suggested).toBeCloseTo(4, 10);
    // atual 5% → diferença −1 p.p., no limiar
    expect(w.difference).toBeCloseTo(-1, 10);
    expect(w.worthApplying).toBe(true);
  });

  it("fatiador que superestima: sugere 0% e explica", () => {
    const samples = [97, 98, 99, 96, 98].map((g, i) => sample(i, { weighedGrams: g }));
    const w = byField(suggestCalibration(PROFILE, samples), "wastePercent");
    expect(w.suggested).toBe(0);
    expect(w.note).toMatch(/superestima o peso em 2\.0%/);
  });
});

describe("taxa de falha", () => {
  it("custo perdido ÷ custo entregue, contando também os pedidos sem falha", () => {
    const samples = [0, 1, 2, 3, 4].map((i) =>
      sample(i, {
        actualHours: 4,
        reprints: i === 2 ? [{ grams: 40, printHours: 1.5 }] : undefined,
      }),
    );
    const f = byField(suggestCalibration(PROFILE, samples), "failurePercent");
    // entregue por pedido: 105 g × 0,12 + 0,15 × 4 × 0,9 + 4 × 2 = 12,60 + 0,54 + 8 = 21,14 → × 5 = 105,70
    // perdido: 40 × 0,12 + 0,15 × 1,5 × 0,9 + 1,5 × 2 = 8,0025
    expect(f.suggested).toBeCloseTo((8.0025 / 105.7) * 100, 8);
    expect(f.samples).toBe(5);
    expect(f.worthApplying).toBe(true);
  });

  it("sem nenhuma falha sugere 0%", () => {
    const samples = [0, 1, 2, 3, 4].map((i) => sample(i, { actualHours: 4 }));
    expect(byField(suggestCalibration(PROFILE, samples), "failurePercent").suggested).toBe(0);
  });
});

describe("applyCalibration", () => {
  const samples = [1.05, 1.1, 1.08, 1.2, 1.07].map((r, i) =>
    sample(i, { actualHours: 4 * r, weighedGrams: 104 }),
  );
  const r = suggestCalibration(PROFILE, samples);

  it("aplica só o que o usuário aceitou", () => {
    const next = applyCalibration(PROFILE, r.suggestions, ["timeFactor"]);
    expect(next.timeFactor).toBeCloseTo(1.08, 10);
    expect(next.wastePercent).toBe(PROFILE.wastePercent);
    expect(PROFILE.timeFactor).toBe(1); // não altera o original
  });

  it("ignora sugestões sem valor (amostras insuficientes)", () => {
    const few = suggestCalibration(PROFILE, samples.slice(0, 2));
    expect(applyCalibration(PROFILE, few.suggestions, ["timeFactor"])).toEqual(PROFILE);
  });
});

describe("sampleFromClosure", () => {
  it("leva os dados do fechamento (função 1) para a calibração", () => {
    const s = sampleFromClosure("item-1", {
      revenue: 80,
      estimated: JOB,
      actual: { printHours: 4.5, weighedGrams: 118, postMinutes: 35 },
    });
    expect(s).toMatchObject({
      id: "item-1",
      slicerHours: 4,
      actualHours: 4.5,
      slicerGrams: 110,
      weighedGrams: 118,
      estimatedPostMinutes: 20,
      actualPostMinutes: 35,
      excluded: false,
    });
  });
});
