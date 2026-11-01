import { describe, expect, it } from "vitest";
import type { CostBreakdown } from "./cost";
import {
  applyRounding,
  emptyPricingSettings,
  formatBRL,
  priceItem,
  tierDiscount,
  type PricingSettings,
} from "./pricing";
import { EngineInputError } from "./validation";

// Item de 2 unidades: custo total 40 (20 por unidade), 6 h (3 h/un), 100 g (50 g/un), extras 4 (2/un).
const COST: CostBreakdown = {
  material: 10,
  energy: 2,
  machine: 12,
  labor: 10,
  extras: 4,
  failure: 2,
  production: 24,
  total: 40,
  effectiveHours: 6,
  effectiveGrams: 100,
  laborMinutes: 20,
};

// Valores fictícios só para conferir as contas.
const FULL: PricingSettings = {
  markupPercent: 50,
  marginPercent: 40,
  machineHourRate: 8,
  pricePerGram: 0.5,
  marketplaceFeePercent: 20,
  marketplaceFixedFee: 5,
  marketplaceShipping: 0,
  marketplaceMarginPercent: 20,
  quantityTiers: [
    { minQuantity: 2, discountPercent: 10 },
    { minQuantity: 10, discountPercent: 20 },
  ],
  minimumMarginPercent: 20,
  premiumPercent: 30,
  minimumUnitPrice: null,
  rounding: "none",
  recommendedMethod: "margin",
};

const method = (r: ReturnType<typeof priceItem>, id: string) => r.methods.find((m) => m.id === id)!;
const bandOf = (r: ReturnType<typeof priceItem>, id: string) => r.bands.find((b) => b.id === id)!;

describe("arredondamento", () => {
  it("nunca arredonda para baixo", () => {
    expect(applyRounding(12.31, "none")).toBe(12.31);
    expect(applyRounding(12.31, "up-0.10")).toBe(12.4);
    expect(applyRounding(12.4, "up-0.10")).toBe(12.4);
    expect(applyRounding(12.31, "up-0.50")).toBe(12.5);
    expect(applyRounding(12.51, "up-0.50")).toBe(13);
    expect(applyRounding(12.01, "up-1")).toBe(13);
    expect(applyRounding(12.31, "end-0.90")).toBe(12.9);
    expect(applyRounding(12.95, "end-0.90")).toBe(13.9);
    expect(applyRounding(12.9, "end-0.90")).toBe(12.9);
  });
});

describe("os 7 métodos", () => {
  const r = priceItem({ cost: COST, quantity: 2, targetUnitPrice: 30 }, FULL);

  it("divide o custo por unidade", () => {
    expect(r.unitCost).toBe(20);
    expect(r.unitHours).toBe(3);
    expect(r.unitGrams).toBe(50);
  });

  it("1. markup: 20 × 1,5 = 30", () => {
    expect(method(r, "markup").unitPrice).toBeCloseTo(30, 10);
    expect(method(r, "markup").markupPercent).toBeCloseTo(50, 10);
    expect(method(r, "markup").marginPercent).toBeCloseTo(33.3333, 3);
  });

  it("2. margem: 20 ÷ 0,6 = 33,33", () => {
    expect(method(r, "margin").unitPrice).toBeCloseTo(33.33, 10);
    expect(method(r, "margin").marginPercent).toBeCloseTo(40, 1);
  });

  it("3. hora de máquina: 3 h × 8 + 2 = 26", () => {
    expect(method(r, "machineHour").unitPrice).toBeCloseTo(26, 10);
  });

  it("4. por grama: 50 g × 0,50 + 2 = 27", () => {
    expect(method(r, "perGram").unitPrice).toBeCloseTo(27, 10);
  });

  it("5. preço-alvo: lucro, margem e markup reversos", () => {
    const t = method(r, "target");
    expect(t.unitPrice).toBe(30);
    expect(t.unitProfit).toBe(10);
    expect(t.marginPercent).toBeCloseTo(33.3333, 3);
    expect(t.markupPercent).toBeCloseTo(50, 10);
  });

  it("6. marketplace: (20 + 5) ÷ (1 − 0,2 − 0,2) = 41,67", () => {
    expect(method(r, "marketplace").unitPrice).toBeCloseTo(41.67, 10);
  });

  it("7. quantidade: 2 un → 10% sobre o recomendado (33,33) = 30", () => {
    expect(method(r, "quantity").unitPrice).toBeCloseTo(30, 10);
    expect(tierDiscount(FULL.quantityTiers, 12)?.discountPercent).toBe(20);
    expect(tierDiscount(FULL.quantityTiers, 1)).toBeNull();
  });

  it("cada método explica a conta", () => {
    expect(method(r, "margin").explanation.join(" ")).toContain(formatBRL(33.333333333333336));
  });
});

describe("faixas", () => {
  const r = priceItem({ cost: COST, quantity: 2 }, FULL);

  it("mínimo mantém a margem mínima: 20 ÷ 0,8 = 25", () => {
    expect(bandOf(r, "minimum").unitPrice).toBe(25);
  });

  it("recomendado vem do método escolhido", () => {
    expect(bandOf(r, "recommended").unitPrice).toBeCloseTo(33.33, 10);
  });

  it("premium = recomendado + 30%", () => {
    expect(bandOf(r, "premium").unitPrice).toBeCloseTo(43.33, 10);
    expect(bandOf(r, "premium").totalPrice).toBeCloseTo(86.66, 10);
  });

  it("aplica preço mínimo e arredondamento em tudo", () => {
    const r2 = priceItem(
      { cost: COST, quantity: 2 },
      { ...FULL, minimumUnitPrice: 28, rounding: "end-0.90" },
    );
    expect(method(r2, "machineHour").unitPrice).toBe(28.9); // 26 → mínimo 28 → 28,90
    expect(method(r2, "margin").unitPrice).toBe(33.9);
    expect(method(r2, "machineHour").explanation.join(" ")).toMatch(/preço mínimo/);
  });
});

describe("a confirmar", () => {
  it("sem parâmetros, tudo indisponível e diz o que falta", () => {
    const r = priceItem({ cost: COST, quantity: 1 }, emptyPricingSettings());
    expect(r.methods.every((m) => !m.available)).toBe(true);
    expect(method(r, "marketplace").missing).toHaveLength(4);
    expect(bandOf(r, "minimum").unitPrice).toBe(40); // só o custo
    expect(bandOf(r, "recommended").unitPrice).toBeNull();
    expect(bandOf(r, "premium").unitPrice).toBeNull();
  });

  it("taxa + margem ≥ 100% no marketplace não tem preço", () => {
    const r = priceItem(
      { cost: COST, quantity: 1 },
      { ...FULL, marketplaceFeePercent: 60, marketplaceMarginPercent: 40 },
    );
    expect(method(r, "marketplace").available).toBe(false);
  });

  it("rejeita quantidade zero e margem de 100%", () => {
    expect(() => priceItem({ cost: COST, quantity: 0 }, FULL)).toThrowError(EngineInputError);
    expect(() =>
      priceItem({ cost: COST, quantity: 1 }, { ...FULL, marginPercent: 100 }),
    ).toThrowError(/marginPercent/);
  });
});
