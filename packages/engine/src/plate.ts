// Função 6: preço por quantidade a partir da mesa cheia.
//
// Duas impressões fatiadas da mesma peça com números diferentes de cópias (ex.: 1 e 8)
// permitem separar o que é gasto por mesa (aquecimento, calibração, linha de purga,
// purgas de cor por camada) do que é gasto por unidade. Com isso, o custo de qualquer
// quantidade sai da conta, em vez de um desconto chutado.

import { costBreakdown, type CostBreakdown, type CostProfile, type Extra } from "./cost";
import { marginPercent } from "./money";
import { checkNonNegative, checkPercentBelow100, throwIfIssues, type Issue } from "./validation";

export interface PlateSample {
  /** Cópias da peça na mesa (inteiro ≥ 1). */
  copies: number;
  /** Tempo de impressão da mesa inteira (h). */
  printHours: number;
  /** Filamento da mesa inteira (g). */
  grams: number;
  /** Purga da mesa inteira (g), se o fatiador informar à parte. */
  purgeGrams?: number;
}

export type PlateMetric = "printHours" | "grams" | "purgeGrams";

export interface PlateAmounts {
  printHours: number;
  grams: number;
  purgeGrams: number;
}

export interface PlateWarning {
  metric: PlateMetric;
  message: string;
}

export interface PlateModel {
  /** Gasto fixo de cada mesa, independente do número de cópias. */
  perPlate: PlateAmounts;
  /** Gasto de cada cópia. */
  perUnit: PlateAmounts;
  /** Cópias que cabem numa mesa. */
  maxCopiesPerPlate: number;
  /** Métricas em que os dados não seguiram o modelo e foi usada a hipótese conservadora. */
  warnings: PlateWarning[];
}

const METRIC_LABEL: Record<PlateMetric, string> = {
  printHours: "tempo",
  grams: "filamento",
  purgeGrams: "purga",
};

function checkCopies(issues: Issue[], field: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    issues.push({ field, message: "precisa ser um número inteiro de cópias, a partir de 1" });
  }
}

function validateSample(issues: Issue[], prefix: string, s: PlateSample): void {
  checkCopies(issues, `${prefix}.copies`, s.copies);
  checkNonNegative(issues, `${prefix}.printHours`, s.printHours);
  checkNonNegative(issues, `${prefix}.grams`, s.grams);
  if (s.purgeGrams !== undefined) checkNonNegative(issues, `${prefix}.purgeGrams`, s.purgeGrams);
}

/**
 * Ajusta o modelo linear `mesa = fixo + cópias × unitário` a partir de duas amostras.
 *
 * Quando os dados fogem do modelo, usa a hipótese que não subestima o custo:
 * - fixo negativo (a mesa cheia rende menos por cópia): fixo 0 e unitário = maior
 *   gasto por cópia entre as amostras;
 * - unitário negativo (mais cópias gastaram menos no total): unitário 0 e fixo = maior
 *   total entre as amostras.
 */
export function fitPlateModel(
  a: PlateSample,
  b: PlateSample,
  maxCopiesPerPlate?: number,
): PlateModel {
  const issues: Issue[] = [];
  validateSample(issues, "amostraA", a);
  validateSample(issues, "amostraB", b);
  if (issues.length === 0 && a.copies === b.copies) {
    issues.push({
      field: "amostraB.copies",
      message: "precisa ter número de cópias diferente da amostra A",
    });
  }
  if (maxCopiesPerPlate !== undefined) checkCopies(issues, "maxCopiesPerPlate", maxCopiesPerPlate);
  throwIfIssues(issues);

  const [lo, hi] = a.copies < b.copies ? [a, b] : [b, a];
  const warnings: PlateWarning[] = [];
  const perPlate: PlateAmounts = { printHours: 0, grams: 0, purgeGrams: 0 };
  const perUnit: PlateAmounts = { printHours: 0, grams: 0, purgeGrams: 0 };

  for (const metric of ["printHours", "grams", "purgeGrams"] as const) {
    const vLo = lo[metric] ?? 0;
    const vHi = hi[metric] ?? 0;
    let unit = (vHi - vLo) / (hi.copies - lo.copies);
    let fixed = vLo - lo.copies * unit;

    if (unit < 0) {
      unit = 0;
      fixed = Math.max(vLo, vHi);
      warnings.push({
        metric,
        message: `Mais cópias gastaram menos ${METRIC_LABEL[metric]} no total. Confira os arquivos; usei o maior valor por mesa.`,
      });
    } else if (fixed < 0) {
      unit = Math.max(vLo / lo.copies, vHi / hi.copies);
      fixed = 0;
      warnings.push({
        metric,
        message: `A mesa cheia não diluiu o ${METRIC_LABEL[metric]}. Usei o maior gasto por cópia, sem desconto por mesa.`,
      });
    }
    perPlate[metric] = fixed;
    perUnit[metric] = unit;
  }

  return {
    perPlate,
    perUnit,
    maxCopiesPerPlate: maxCopiesPerPlate ?? hi.copies,
    warnings,
  };
}

export interface PlateTotals extends PlateAmounts {
  plates: number;
}

/** Mesas e gastos para uma quantidade. Total = mesas × fixo + quantidade × unitário. */
export function plateTotals(model: PlateModel, quantity: number): PlateTotals {
  const issues: Issue[] = [];
  checkCopies(issues, "quantity", quantity);
  throwIfIssues(issues);

  const plates = Math.ceil(quantity / model.maxCopiesPerPlate);
  const total = (metric: PlateMetric) =>
    plates * model.perPlate[metric] + quantity * model.perUnit[metric];
  return {
    plates,
    printHours: total("printHours"),
    grams: total("grams"),
    purgeGrams: total("purgeGrams"),
  };
}

export interface QuantityOptions {
  /** Preparo de cada mesa: montar, iniciar, retirar (min). */
  prepMinutesPerPlate: number;
  /** Pós-processamento de cada cópia (min). */
  postMinutesPerUnit: number;
  /** Extras que se repetem por cópia (embalagem, por exemplo). Frete entra à parte no orçamento. */
  extrasPerUnit?: Extra[];
  /** Preço de tabela de 1 unidade (R$). */
  unitPrice: number;
  /** Margem mínima aceitável (%). */
  minMarginPercent: number;
  /** Quantidades das faixas. Padrão: 1, N, 2N e 4N (N = cópias por mesa). */
  quantities?: number[];
}

export interface QuantityTier {
  quantity: number;
  plates: number;
  cost: CostBreakdown;
  unitCost: number;
  /** Preço unitário que mantém a margem do preço de tabela (repassa a economia). */
  suggestedUnitPrice: number;
  suggestedDiscountPercent: number;
  /** Menor preço unitário que ainda dá a margem mínima. */
  minUnitPrice: number;
  /** Maior desconto sobre o preço de tabela que mantém a margem mínima (≥ 0). */
  maxDiscountPercent: number;
  /** O preço de tabela, sem desconto, já fica abaixo da margem mínima nesta faixa. */
  belowMinMargin: boolean;
}

export interface QuantityTiersResult {
  /** Margem do preço de tabela para 1 unidade (%), ou `null` se o custo for zero. */
  baseMarginPercent: number | null;
  tiers: QuantityTier[];
  warnings: PlateWarning[];
}

function scaleExtras(extras: Extra[] | undefined, factor: number): Extra[] {
  return (extras ?? []).map((e) => ({ label: e.label, amount: e.amount * factor }));
}

/** Custo completo (motor base) para uma quantidade, usando o modelo da mesa. */
export function quantityCost(
  profile: CostProfile,
  model: PlateModel,
  quantity: number,
  options: Pick<QuantityOptions, "prepMinutesPerPlate" | "postMinutesPerUnit" | "extrasPerUnit">,
): { totals: PlateTotals; cost: CostBreakdown } {
  const totals = plateTotals(model, quantity);
  const cost = costBreakdown(profile, {
    grams: totals.grams,
    purgeGrams: totals.purgeGrams,
    printHours: totals.printHours,
    prepMinutes: totals.plates * options.prepMinutesPerPlate,
    postMinutes: quantity * options.postMinutesPerUnit,
    extras: scaleExtras(options.extrasPerUnit, quantity),
  });
  return { totals, cost };
}

function defaultQuantities(n: number): number[] {
  return [...new Set([1, n, 2 * n, 4 * n])].sort((x, y) => x - y);
}

/**
 * Faixas de preço por quantidade. Para cada quantidade mostra o custo unitário, o
 * preço que mantém a margem do preço de tabela e o desconto máximo até a margem mínima.
 */
export function quantityTiers(
  profile: CostProfile,
  model: PlateModel,
  options: QuantityOptions,
): QuantityTiersResult {
  const issues: Issue[] = [];
  checkNonNegative(issues, "prepMinutesPerPlate", options.prepMinutesPerPlate);
  checkNonNegative(issues, "postMinutesPerUnit", options.postMinutesPerUnit);
  checkNonNegative(issues, "unitPrice", options.unitPrice);
  checkPercentBelow100(issues, "minMarginPercent", options.minMarginPercent);
  options.quantities?.forEach((q, i) => checkCopies(issues, `quantities[${i}]`, q));
  throwIfIssues(issues);

  const base = quantityCost(profile, model, 1, options);
  const baseMargin = marginPercent(options.unitPrice, base.cost.total);
  const keepMargin = base.cost.total > 0 && baseMargin !== null ? baseMargin : null;

  const quantities = options.quantities ?? defaultQuantities(model.maxCopiesPerPlate);
  const tiers = quantities.map((quantity): QuantityTier => {
    const { totals, cost } = quantityCost(profile, model, quantity, options);
    const unitCost = cost.total / quantity;
    const suggestedUnitPrice =
      keepMargin === null ? options.unitPrice : unitCost / (1 - keepMargin / 100);
    const minUnitPrice = unitCost / (1 - options.minMarginPercent / 100);
    const discount = (price: number) =>
      options.unitPrice > 0 ? (1 - price / options.unitPrice) * 100 : 0;
    const rawMaxDiscount = discount(minUnitPrice);
    return {
      quantity,
      plates: totals.plates,
      cost,
      unitCost,
      suggestedUnitPrice,
      suggestedDiscountPercent: discount(suggestedUnitPrice),
      minUnitPrice,
      maxDiscountPercent: Math.max(0, rawMaxDiscount),
      belowMinMargin: rawMaxDiscount < 0,
    };
  });

  return { baseMarginPercent: baseMargin, tiers, warnings: model.warnings };
}
