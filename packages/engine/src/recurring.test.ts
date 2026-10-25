import { describe, expect, it } from "vitest";
import { compareWithSnapshot, profileChanges } from "./recurring";
import { JOB, PROFILE } from "./test-fixtures";

// Hoje: filamento 120 → 135 R$/kg e energia 0,90 → 1,00 R$/kWh.
const NOW = { ...PROFILE, filamentPricePerKg: 135, energyTariffPerKwh: 1 };
const SNAPSHOT = { profile: PROFILE, job: JOB, price: 80, fees: 8 };

describe("compareWithSnapshot", () => {
  it("recalcula o custo da peça com o perfil de hoje", () => {
    const r = compareWithSnapshot(SNAPSHOT, NOW);
    expect(r.costThen.total).toBeCloseTo(42.14, 10);
    // material 110 × 1,05 × 0,135 = 15,5925; energia 0,15 × 4 × 1 = 0,60; máquina 8
    // produção 24,1925; falha 2,41925; mão de obra 15; extras 2,50 → 44,11175
    expect(r.costNow.total).toBeCloseTo(44.11175, 10);
    expect(r.costDelta).toBeCloseTo(1.97175, 10);
    expect(r.costDeltaPercent).toBeCloseTo((1.97175 / 42.14) * 100, 8);
    expect(r.stale).toBe(true);
  });

  it("mostra a margem caindo e o preço que a devolve", () => {
    const r = compareWithSnapshot(SNAPSHOT, NOW);
    // (80 − 8 − 42,14) ÷ 80 = 37,325%; (80 − 8 − 44,11175) ÷ 80 = 34,8603%
    expect(r.marginThenPercent).toBeCloseTo(37.325, 8);
    expect(r.marginNowPercent).toBeCloseTo(34.8603125, 8);
    // (44,11175 + 8) ÷ (1 − 0,37325) = 83,146...
    expect(r.priceToKeepMargin).toBeCloseTo(52.11175 / 0.62675, 8);
  });

  it("lista o que mudou no perfil", () => {
    const r = compareWithSnapshot(SNAPSHOT, NOW);
    expect(r.changes.map((c) => [c.field, c.before, c.after])).toEqual([
      ["filamentPricePerKg", 120, 135],
      ["energyTariffPerKwh", 0.9, 1],
    ]);
    expect(r.changes[0]!.changePercent).toBeCloseTo(12.5, 10);
    expect(r.changes[0]!.label).toBe("Preço do filamento");
  });

  it("perfil igual: nada mudou, não está defasado", () => {
    const r = compareWithSnapshot(SNAPSHOT, PROFILE);
    expect(r.costDelta).toBe(0);
    expect(r.changes).toEqual([]);
    expect(r.stale).toBe(false);
    expect(r.priceToKeepMargin).toBeCloseTo(80, 10);
  });

  it("respeita o limiar de defasagem", () => {
    // +4,68% no custo: defasado com limiar 1%, não com 5%
    expect(compareWithSnapshot(SNAPSHOT, NOW, { thresholdPercent: 5 }).stale).toBe(false);
  });

  it("custo menor hoje também aparece (e pode baixar o preço)", () => {
    const cheaper = { ...PROFILE, filamentPricePerKg: 100 };
    const r = compareWithSnapshot(SNAPSHOT, cheaper);
    expect(r.costDelta).toBeLessThan(0);
    expect(r.priceToKeepMargin!).toBeLessThan(80);
  });

  it("preço zero: margens indefinidas", () => {
    const r = compareWithSnapshot({ ...SNAPSHOT, price: 0, fees: 0 }, NOW);
    expect(r.marginThenPercent).toBeNull();
    expect(r.priceToKeepMargin).toBeNull();
  });

  it("rejeita preço negativo", () => {
    expect(() => compareWithSnapshot({ ...SNAPSHOT, price: -1 }, NOW)).toThrowError(/price/);
  });
});

describe("profileChanges", () => {
  it("variação indefinida quando o valor anterior era zero", () => {
    const [change] = profileChanges({ ...PROFILE, maintenancePerHour: 0 }, PROFILE);
    expect(change!.field).toBe("maintenancePerHour");
    expect(change!.changePercent).toBeNull();
  });
});
