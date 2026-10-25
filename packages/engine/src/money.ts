import { EngineInputError } from "./validation";

/**
 * Arredonda para centavos. Os cálculos internos não arredondam; só a apresentação.
 * O `Number.EPSILON` corrige casos como 1,005 → 1,01.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Margem sobre o preço de venda, em %: quanto do preço é lucro.
 * margem = (preço − custo) ÷ preço. Devolve `null` se o preço não for positivo.
 */
export function marginPercent(price: number, cost: number): number | null {
  if (!(price > 0)) return null;
  return ((price - cost) / price) * 100;
}

/**
 * Markup sobre o custo, em %: quanto se soma ao custo.
 * markup = (preço − custo) ÷ custo. Devolve `null` se o custo não for positivo.
 */
export function markupPercent(price: number, cost: number): number | null {
  if (!(cost > 0)) return null;
  return ((price - cost) / cost) * 100;
}

/** Preço que dá a margem pedida: preço = custo ÷ (1 − margem). */
export function priceForMargin(cost: number, margin: number): number {
  if (!(margin < 100)) {
    throw new EngineInputError([{ field: "margin", message: "precisa ser menor que 100%" }]);
  }
  return cost / (1 - margin / 100);
}

/** Preço com markup sobre o custo: preço = custo × (1 + markup). */
export function priceForMarkup(cost: number, markup: number): number {
  return cost * (1 + markup / 100);
}
