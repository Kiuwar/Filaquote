import { describe, expect, it } from "vitest";
import { marginPercent, markupPercent, priceForMargin, priceForMarkup, roundMoney } from "./money";

describe("arredondamento", () => {
  it("arredonda para centavos, inclusive o caso 1,005", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(42.144)).toBe(42.14);
    expect(roundMoney(0)).toBe(0);
  });
});

describe("margem × markup", () => {
  it("custo 60 e preço 100: margem 40% e markup 66,7%", () => {
    expect(marginPercent(100, 60)).toBeCloseTo(40, 10);
    expect(markupPercent(100, 60)).toBeCloseTo(66.6667, 3);
  });

  it("as fórmulas inversas voltam ao preço", () => {
    expect(priceForMargin(60, 40)).toBeCloseTo(100, 10);
    expect(priceForMarkup(60, 66.666666667)).toBeCloseTo(100, 6);
  });

  it("devolve null quando a divisão não faz sentido", () => {
    expect(marginPercent(0, 10)).toBeNull();
    expect(markupPercent(10, 0)).toBeNull();
  });

  it("margem de 100% é impossível", () => {
    expect(() => priceForMargin(10, 100)).toThrowError(/menor que 100%/);
  });
});
