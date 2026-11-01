// Métodos de preço, faixas (mínimo, recomendado, premium), preço mínimo e arredondamento.
//
// Tudo por unidade: o custo do item (todas as cópias) é dividido pela quantidade.
// Nenhum parâmetro tem padrão: o que não foi preenchido no perfil fica "a confirmar"
// e o método aparece como indisponível, dizendo o que falta.

import type { CostBreakdown } from "./cost";
import { markupPercent as markupOf, marginPercent as marginOf } from "./money";
import { checkNonNegative, checkPercentBelow100, throwIfIssues, type Issue } from "./validation";

export type MethodId =
  "markup" | "margin" | "machineHour" | "perGram" | "target" | "marketplace" | "quantity";

export type RoundingMode = "none" | "up-0.10" | "up-0.50" | "up-1" | "end-0.90";

export interface DiscountTier {
  /** A partir desta quantidade… */
  minQuantity: number;
  /** …aplica este desconto (%) sobre o preço recomendado. */
  discountPercent: number;
}

export interface PricingSettings {
  /** Método 1: markup sobre o custo (%). */
  markupPercent: number | null;
  /** Método 2: margem sobre o preço de venda (%). */
  marginPercent: number | null;
  /** Método 3: preço por hora de máquina (R$/h). */
  machineHourRate: number | null;
  /** Método 4: preço por grama de filamento (R$/g). */
  pricePerGram: number | null;
  /** Método 6: taxas do marketplace (todas "a confirmar" com a plataforma). */
  marketplaceFeePercent: number | null;
  marketplaceFixedFee: number | null;
  marketplaceShipping: number | null;
  marketplaceMarginPercent: number | null;
  /** Método 7: faixas de desconto por quantidade. */
  quantityTiers: DiscountTier[];
  /** Faixa "mínimo": margem mínima aceitável (%). */
  minimumMarginPercent: number | null;
  /** Faixa "premium": acréscimo sobre o recomendado (%). */
  premiumPercent: number | null;
  /** Preço mínimo por unidade (R$). */
  minimumUnitPrice: number | null;
  rounding: RoundingMode;
  /** Método usado na faixa "recomendado". */
  recommendedMethod: Exclude<MethodId, "quantity" | "target">;
}

export const METHOD_LABELS: Record<MethodId, string> = {
  markup: "Custo + markup",
  margin: "Margem sobre o preço",
  machineHour: "Meta por hora de máquina",
  perGram: "Preço por grama",
  target: "Preço-alvo (cálculo reverso)",
  marketplace: "Marketplace",
  quantity: "Escalonado por quantidade",
};

export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  none: "Sem arredondamento",
  "up-0.10": "Para cima, de R$ 0,10 em R$ 0,10",
  "up-0.50": "Para cima, de R$ 0,50 em R$ 0,50",
  "up-1": "Para cima, para o real inteiro",
  "end-0.90": "Para cima, terminando em ,90",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function formatBRL(value: number): string {
  return brl.format(value);
}

export function formatPercent(value: number): string {
  return `${pct.format(value)}%`;
}

/** Arredonda um preço conforme a regra escolhida. Nunca arredonda para baixo. */
export function applyRounding(value: number, mode: RoundingMode): number {
  const cents = Math.round(value * 100);
  const up = (stepCents: number) => (Math.ceil(cents / stepCents) * stepCents) / 100;
  switch (mode) {
    case "none":
      return cents / 100;
    case "up-0.10":
      return up(10);
    case "up-0.50":
      return up(50);
    case "up-1":
      return up(100);
    case "end-0.90": {
      const candidate = Math.floor(cents / 100) * 100 + 90;
      return (candidate >= cents ? candidate : candidate + 100) / 100;
    }
  }
}

export interface MethodResult {
  id: MethodId;
  label: string;
  available: boolean;
  /** Campos do perfil que faltam ("a confirmar") quando indisponível. */
  missing: string[];
  /** Preço por unidade antes do arredondamento e do mínimo. */
  rawUnitPrice: number | null;
  /** Preço por unidade final. */
  unitPrice: number | null;
  totalPrice: number | null;
  unitProfit: number | null;
  marginPercent: number | null;
  markupPercent: number | null;
  /** A conta, linha a linha, para mostrar na tela. */
  explanation: string[];
}

export type BandId = "minimum" | "recommended" | "premium";

export interface Band {
  id: BandId;
  label: string;
  unitPrice: number | null;
  totalPrice: number | null;
  marginPercent: number | null;
  explanation: string[];
}

export interface PricingInput {
  /** Custo do item inteiro (todas as unidades), do motor de custo. */
  cost: CostBreakdown;
  quantity: number;
  /** Preço-alvo por unidade digitado pelo usuário (método 5). */
  targetUnitPrice?: number | null;
}

export interface PricingResult {
  unitCost: number;
  unitHours: number;
  unitGrams: number;
  unitExtras: number;
  quantity: number;
  methods: MethodResult[];
  bands: Band[];
}

export function validatePricingSettings(s: PricingSettings): Issue[] {
  const issues: Issue[] = [];
  const optional = (field: string, value: number | null, percentBelow100 = false) => {
    if (value === null) return;
    if (percentBelow100) checkPercentBelow100(issues, field, value);
    else checkNonNegative(issues, field, value);
  };
  optional("markupPercent", s.markupPercent);
  optional("marginPercent", s.marginPercent, true);
  optional("machineHourRate", s.machineHourRate);
  optional("pricePerGram", s.pricePerGram);
  optional("marketplaceFeePercent", s.marketplaceFeePercent, true);
  optional("marketplaceFixedFee", s.marketplaceFixedFee);
  optional("marketplaceShipping", s.marketplaceShipping);
  optional("marketplaceMarginPercent", s.marketplaceMarginPercent, true);
  optional("minimumMarginPercent", s.minimumMarginPercent, true);
  optional("premiumPercent", s.premiumPercent);
  optional("minimumUnitPrice", s.minimumUnitPrice);
  s.quantityTiers.forEach((t, i) => {
    if (!Number.isInteger(t.minQuantity) || t.minQuantity < 1) {
      issues.push({
        field: `quantityTiers[${i}].minQuantity`,
        message: "precisa ser um número inteiro a partir de 1",
      });
    }
    checkPercentBelow100(issues, `quantityTiers[${i}].discountPercent`, t.discountPercent);
  });
  return issues;
}

/** Desconto da faixa de quantidade que se aplica (a de maior `minQuantity` atingida). */
export function tierDiscount(
  tiers: readonly DiscountTier[],
  quantity: number,
): DiscountTier | null {
  return (
    [...tiers]
      .filter((t) => quantity >= t.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0] ?? null
  );
}

export function priceItem(input: PricingInput, settings: PricingSettings): PricingResult {
  const issues: Issue[] = validatePricingSettings(settings);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    issues.push({ field: "quantity", message: "precisa ser um número inteiro a partir de 1" });
  }
  if (input.targetUnitPrice != null)
    checkNonNegative(issues, "targetUnitPrice", input.targetUnitPrice);
  throwIfIssues(issues);

  const q = input.quantity;
  const unitCost = input.cost.total / q;
  const unitHours = input.cost.effectiveHours / q;
  const unitGrams = input.cost.effectiveGrams / q;
  const unitExtras = input.cost.extras / q;

  const finish = (raw: number, lines: string[]): { unit: number; lines: string[] } => {
    const out = [...lines];
    let value = raw;
    const min = settings.minimumUnitPrice;
    if (min !== null && value < min) {
      out.push(`Abaixo do preço mínimo: sobe para ${formatBRL(min)}.`);
      value = min;
    }
    const rounded = applyRounding(value, settings.rounding);
    if (settings.rounding !== "none" && Math.abs(rounded - value) >= 0.005) {
      out.push(
        `Arredondamento (${ROUNDING_LABELS[settings.rounding].toLowerCase()}): ${formatBRL(rounded)}.`,
      );
    }
    return { unit: rounded, lines: out };
  };

  const result = (
    id: MethodId,
    raw: number | null,
    lines: string[],
    missing: string[] = [],
  ): MethodResult => {
    if (raw === null || missing.length > 0) {
      return {
        id,
        label: METHOD_LABELS[id],
        available: false,
        missing,
        rawUnitPrice: null,
        unitPrice: null,
        totalPrice: null,
        unitProfit: null,
        marginPercent: null,
        markupPercent: null,
        explanation: lines,
      };
    }
    const { unit, lines: finalLines } = finish(raw, lines);
    return {
      id,
      label: METHOD_LABELS[id],
      available: true,
      missing: [],
      rawUnitPrice: raw,
      unitPrice: unit,
      totalPrice: unit * q,
      unitProfit: unit - unitCost,
      marginPercent: marginOf(unit, unitCost),
      markupPercent: markupOf(unit, unitCost),
      explanation: finalLines,
    };
  };

  const costLine = `Custo por unidade: ${formatBRL(unitCost)}.`;
  const methods: MethodResult[] = [];

  // 1. Custo + markup
  if (settings.markupPercent === null) {
    methods.push(result("markup", null, ["Defina o markup (%) no perfil."], ["markup (%)"]));
  } else {
    const raw = unitCost * (1 + settings.markupPercent / 100);
    methods.push(
      result("markup", raw, [
        costLine,
        `Preço = custo × (1 + ${formatPercent(settings.markupPercent)}) = ${formatBRL(raw)}.`,
      ]),
    );
  }

  // 2. Margem sobre o preço de venda
  if (settings.marginPercent === null) {
    methods.push(result("margin", null, ["Defina a margem (%) no perfil."], ["margem (%)"]));
  } else {
    const raw = unitCost / (1 - settings.marginPercent / 100);
    methods.push(
      result("margin", raw, [
        costLine,
        `Preço = custo ÷ (1 − ${formatPercent(settings.marginPercent)}) = ${formatBRL(raw)}.`,
      ]),
    );
  }

  // 3. Meta por hora de máquina
  if (settings.machineHourRate === null) {
    methods.push(
      result(
        "machineHour",
        null,
        ["Defina o valor por hora de máquina no perfil."],
        ["R$ por hora de máquina"],
      ),
    );
  } else {
    const raw = unitHours * settings.machineHourRate + unitExtras;
    methods.push(
      result("machineHour", raw, [
        `${num.format(unitHours)} h × ${formatBRL(settings.machineHourRate)}/h + extras ${formatBRL(unitExtras)} = ${formatBRL(raw)}.`,
      ]),
    );
  }

  // 4. Preço por grama
  if (settings.pricePerGram === null) {
    methods.push(
      result("perGram", null, ["Defina o preço por grama no perfil."], ["R$ por grama"]),
    );
  } else {
    const raw = unitGrams * settings.pricePerGram + unitExtras;
    methods.push(
      result("perGram", raw, [
        `${num.format(unitGrams)} g × ${formatBRL(settings.pricePerGram)}/g + extras ${formatBRL(unitExtras)} = ${formatBRL(raw)}.`,
      ]),
    );
  }

  // 5. Preço-alvo manual com cálculo reverso (sem arredondamento: é o preço que você digitou)
  const target = input.targetUnitPrice ?? null;
  if (target === null) {
    methods.push(
      result(
        "target",
        null,
        ["Digite um preço-alvo para ver lucro, margem e markup."],
        ["preço-alvo"],
      ),
    );
  } else {
    const profit = target - unitCost;
    const margin = marginOf(target, unitCost);
    const markup = markupOf(target, unitCost);
    methods.push({
      id: "target",
      label: METHOD_LABELS.target,
      available: true,
      missing: [],
      rawUnitPrice: target,
      unitPrice: target,
      totalPrice: target * q,
      unitProfit: profit,
      marginPercent: margin,
      markupPercent: markup,
      explanation: [
        `Preço digitado: ${formatBRL(target)}. ${costLine}`,
        `Lucro = ${formatBRL(profit)} por unidade.`,
        `Margem = lucro ÷ preço = ${margin === null ? "—" : formatPercent(margin)}; markup = lucro ÷ custo = ${markup === null ? "—" : formatPercent(markup)}.`,
      ],
    });
  }

  // 6. Marketplace
  const mpMissing: string[] = [];
  if (settings.marketplaceFeePercent === null) mpMissing.push("taxa do marketplace (%)");
  if (settings.marketplaceFixedFee === null) mpMissing.push("taxa fixa do marketplace");
  if (settings.marketplaceShipping === null) mpMissing.push("frete pago pelo vendedor");
  if (settings.marketplaceMarginPercent === null)
    mpMissing.push("margem desejada no marketplace (%)");
  if (mpMissing.length > 0) {
    methods.push(
      result(
        "marketplace",
        null,
        ["Preencha as taxas da plataforma no perfil (a confirmar com o marketplace)."],
        mpMissing,
      ),
    );
  } else {
    const fee = settings.marketplaceFeePercent! / 100;
    const margin = settings.marketplaceMarginPercent! / 100;
    if (fee + margin >= 1) {
      methods.push(
        result(
          "marketplace",
          null,
          ["Taxa + margem somam 100% ou mais: não existe preço que feche a conta."],
          ["taxa + margem abaixo de 100%"],
        ),
      );
    } else {
      const fixed = settings.marketplaceFixedFee! + settings.marketplaceShipping!;
      const raw = (unitCost + fixed) / (1 - fee - margin);
      methods.push(
        result("marketplace", raw, [
          costLine,
          `Preço = (custo + taxa fixa + frete ${formatBRL(fixed)}) ÷ (1 − taxa ${formatPercent(fee * 100)} − margem ${formatPercent(margin * 100)}) = ${formatBRL(raw)}.`,
          `A plataforma retém ${formatBRL(raw * fee + fixed)} por unidade.`,
        ]),
      );
    }
  }

  // 7. Escalonado por quantidade (desconto sobre o recomendado)
  const recommended = methods.find((m) => m.id === settings.recommendedMethod);
  if (settings.quantityTiers.length === 0) {
    methods.push(
      result(
        "quantity",
        null,
        ["Cadastre faixas de quantidade no perfil."],
        ["faixas de quantidade"],
      ),
    );
  } else if (!recommended?.available || recommended.rawUnitPrice === null) {
    methods.push(
      result(
        "quantity",
        null,
        [
          `Depende do método recomendado (${METHOD_LABELS[settings.recommendedMethod]}), que está a confirmar.`,
        ],
        [METHOD_LABELS[settings.recommendedMethod]],
      ),
    );
  } else {
    const tier = tierDiscount(settings.quantityTiers, q);
    const discount = tier?.discountPercent ?? 0;
    const raw = recommended.rawUnitPrice * (1 - discount / 100);
    methods.push(
      result("quantity", raw, [
        `Base: ${METHOD_LABELS[settings.recommendedMethod]} = ${formatBRL(recommended.rawUnitPrice)}.`,
        tier
          ? `${q} unidades: faixa a partir de ${tier.minQuantity}, desconto de ${formatPercent(discount)} → ${formatBRL(raw)}.`
          : `${q} unidade(s): nenhuma faixa atingida, sem desconto.`,
      ]),
    );
  }

  // Faixas
  const bands: Band[] = [];
  const band = (id: BandId, label: string, raw: number | null, lines: string[]): Band => {
    if (raw === null) {
      return {
        id,
        label,
        unitPrice: null,
        totalPrice: null,
        marginPercent: null,
        explanation: lines,
      };
    }
    const { unit, lines: finalLines } = finish(raw, lines);
    return {
      id,
      label,
      unitPrice: unit,
      totalPrice: unit * q,
      marginPercent: marginOf(unit, unitCost),
      explanation: finalLines,
    };
  };

  if (settings.minimumMarginPercent === null) {
    bands.push(
      band("minimum", "Mínimo", unitCost, [
        "Margem mínima a confirmar: o mínimo mostrado é só o custo (lucro zero).",
        costLine,
      ]),
    );
  } else {
    const raw = unitCost / (1 - settings.minimumMarginPercent / 100);
    bands.push(
      band("minimum", "Mínimo", raw, [
        `Menor preço que mantém a margem mínima de ${formatPercent(settings.minimumMarginPercent)}.`,
        `Custo ÷ (1 − ${formatPercent(settings.minimumMarginPercent)}) = ${formatBRL(raw)}.`,
      ]),
    );
  }

  const recBase = recommended?.available ? recommended.rawUnitPrice : null;
  bands.push(
    band(
      "recommended",
      "Recomendado",
      recBase,
      recBase === null
        ? [
            `O método recomendado (${METHOD_LABELS[settings.recommendedMethod]}) está a confirmar no perfil.`,
          ]
        : [
            `Pelo método ${METHOD_LABELS[settings.recommendedMethod].toLowerCase()}.`,
            ...(recommended?.explanation.slice(0, 2) ?? []),
          ],
    ),
  );

  if (recBase === null || settings.premiumPercent === null) {
    bands.push(
      band("premium", "Premium", null, [
        recBase === null ? "Depende do recomendado." : "Defina o acréscimo premium (%) no perfil.",
      ]),
    );
  } else {
    const raw = recBase * (1 + settings.premiumPercent / 100);
    bands.push(
      band("premium", "Premium", raw, [
        `Recomendado + ${formatPercent(settings.premiumPercent)}: para urgência, acabamento caprichado ou peça exclusiva.`,
        `${formatBRL(recBase)} × (1 + ${formatPercent(settings.premiumPercent)}) = ${formatBRL(raw)}.`,
      ]),
    );
  }

  return { unitCost, unitHours, unitGrams, unitExtras, quantity: q, methods, bands };
}

/** Configuração vazia: tudo "a confirmar". O usuário preenche no perfil. */
export function emptyPricingSettings(): PricingSettings {
  return {
    markupPercent: null,
    marginPercent: null,
    machineHourRate: null,
    pricePerGram: null,
    marketplaceFeePercent: null,
    marketplaceFixedFee: null,
    marketplaceShipping: null,
    marketplaceMarginPercent: null,
    quantityTiers: [],
    minimumMarginPercent: null,
    premiumPercent: null,
    minimumUnitPrice: null,
    rounding: "none",
    recommendedMethod: "margin",
  };
}
