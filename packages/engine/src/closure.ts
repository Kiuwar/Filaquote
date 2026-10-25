// Função 1: fechamento do pedido (estimado × real).
//
// Depois de entregar, o maker informa o que de fato aconteceu: tempo real, peso real,
// reimpressões, minutos de pós-processamento. O motor recalcula o custo com os mesmos
// preços do perfil e mostra o lucro real ao lado do orçado.

import {
  costBreakdown,
  productionCost,
  type CostBreakdown,
  type CostProfile,
  type Extra,
  type JobInput,
} from "./cost";
import { checkNonNegative, throwIfIssues, type Issue } from "./validation";

/** Uma tentativa que falhou e foi refeita. */
export interface Reprint {
  /** Filamento perdido na tentativa (g). */
  grams: number;
  /** Tempo de máquina perdido na tentativa (h). */
  printHours: number;
}

/** O que aconteceu de fato. Campo ausente = igual ao orçado (com a calibração do perfil). */
export interface ActualJob {
  /** Tempo real de impressão (h), como mostrado pela impressora. */
  printHours?: number;
  /** Peso real consumido (g), pesado na balança; já inclui purga e desperdício. */
  weighedGrams?: number;
  prepMinutes?: number;
  /** Minutos reais de pós-processamento. */
  postMinutes?: number;
  extras?: Extra[];
  /** Reimpressões. Ausente = nenhuma: no fechamento, ou falhou ou não falhou. */
  reprints?: Reprint[];
}

export interface ClosureInput {
  /** Valor cobrado pelo item (todas as unidades), já com descontos (R$). */
  revenue: number;
  /** Taxas pagas sobre a venda: marketplace, cartão etc. (R$). */
  fees?: number;
  /** A entrada usada no orçamento. */
  estimated: JobInput;
  actual: ActualJob;
}

export type CostComponent = "material" | "energy" | "machine" | "labor" | "extras" | "failure";

export const COST_COMPONENT_LABELS: Record<CostComponent, string> = {
  material: "Material",
  energy: "Energia",
  machine: "Máquina",
  labor: "Mão de obra",
  extras: "Extras",
  failure: "Falhas e reimpressões",
};

export interface ClosureResult {
  estimated: CostBreakdown;
  actual: CostBreakdown;
  revenue: number;
  fees: number;
  estimatedProfit: number;
  actualProfit: number;
  /** Lucro ÷ valor cobrado (%), ou `null` se nada foi cobrado. */
  estimatedMarginPercent: number | null;
  actualMarginPercent: number | null;
  /** Real − estimado, por parcela (R$). Positivo = custou mais que o orçado. */
  deviation: Record<CostComponent | "total", number>;
  /** Parcelas com desvio, da que mais pesou para a que menos pesou. */
  mainDeviations: Array<{ component: CostComponent; amount: number }>;
  reprintHours: number;
  reprintGrams: number;
  /** Horas de máquina usadas, contando reimpressões. */
  machineHours: number;
}

function validateActual(actual: ActualJob): Issue[] {
  const issues: Issue[] = [];
  const optional = ["printHours", "weighedGrams", "prepMinutes", "postMinutes"] as const;
  for (const field of optional) {
    if (actual[field] !== undefined) checkNonNegative(issues, `actual.${field}`, actual[field]);
  }
  actual.extras?.forEach((e, i) =>
    checkNonNegative(issues, `actual.extras[${i}].amount`, e.amount),
  );
  actual.reprints?.forEach((r, i) => {
    checkNonNegative(issues, `actual.reprints[${i}].grams`, r.grams);
    checkNonNegative(issues, `actual.reprints[${i}].printHours`, r.printHours);
  });
  return issues;
}

/** Custo real, com os preços do perfil e as quantidades informadas. */
export function actualCost(
  profile: CostProfile,
  estimated: JobInput,
  actual: ActualJob,
): CostBreakdown {
  // Valida perfil e orçado pelo caminho normal do motor.
  const estimatedCost = costBreakdown(profile, estimated);
  throwIfIssues(validateActual(actual));

  const effectiveHours = actual.printHours ?? estimatedCost.effectiveHours;
  const effectiveGrams = actual.weighedGrams ?? estimatedCost.effectiveGrams;
  const prod = productionCost(profile, effectiveGrams, effectiveHours);

  const prep = actual.prepMinutes ?? estimated.prepMinutes;
  const post = actual.postMinutes ?? estimated.postMinutes * profile.postProcessingFactor;
  const laborMinutes = prep + post;
  const labor = (laborMinutes / 60) * profile.laborPerHour;

  const extras = (actual.extras ?? estimated.extras ?? []).reduce((sum, e) => sum + e.amount, 0);
  // A falha real é o custo de produção das tentativas perdidas, não o percentual do perfil.
  const failure = (actual.reprints ?? []).reduce(
    (sum, r) => sum + productionCost(profile, r.grams, r.printHours).total,
    0,
  );

  return {
    material: prod.material,
    energy: prod.energy,
    machine: prod.machine,
    labor,
    extras,
    failure,
    production: prod.total,
    total: prod.total + failure + labor + extras,
    effectiveHours,
    effectiveGrams,
    laborMinutes,
  };
}

const COMPONENTS: readonly CostComponent[] = [
  "material",
  "energy",
  "machine",
  "labor",
  "extras",
  "failure",
];

/** Fecha um item: custo e lucro reais ao lado dos orçados. */
export function closeItem(profile: CostProfile, input: ClosureInput): ClosureResult {
  const issues: Issue[] = [];
  checkNonNegative(issues, "revenue", input.revenue);
  if (input.fees !== undefined) checkNonNegative(issues, "fees", input.fees);
  throwIfIssues(issues);

  const estimated = costBreakdown(profile, input.estimated);
  const actual = actualCost(profile, input.estimated, input.actual);
  const fees = input.fees ?? 0;
  const estimatedProfit = input.revenue - fees - estimated.total;
  const actualProfit = input.revenue - fees - actual.total;
  const margin = (profit: number) => (input.revenue > 0 ? (profit / input.revenue) * 100 : null);

  const deviation = { total: actual.total - estimated.total } as ClosureResult["deviation"];
  for (const c of COMPONENTS) deviation[c] = actual[c] - estimated[c];

  const mainDeviations = COMPONENTS.map((component) => ({
    component,
    amount: deviation[component],
  }))
    .filter((d) => Math.abs(d.amount) >= 0.005)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const reprints = input.actual.reprints ?? [];
  const reprintHours = reprints.reduce((s, r) => s + r.printHours, 0);
  const reprintGrams = reprints.reduce((s, r) => s + r.grams, 0);

  return {
    estimated,
    actual,
    revenue: input.revenue,
    fees,
    estimatedProfit,
    actualProfit,
    estimatedMarginPercent: margin(estimatedProfit),
    actualMarginPercent: margin(actualProfit),
    deviation,
    mainDeviations,
    reprintHours,
    reprintGrams,
    machineHours: actual.effectiveHours + reprintHours,
  };
}

export interface ClosedItem {
  /** Data do fechamento, AAAA-MM-DD. */
  closedOn: string;
  result: ClosureResult;
}

export interface MonthSummary {
  /** AAAA-MM */
  month: string;
  items: number;
  revenue: number;
  fees: number;
  estimatedProfit: number;
  actualProfit: number;
  /** Lucro real − lucro orçado (R$). Negativo = ganhou menos que o previsto. */
  profitDeviation: number;
  actualMarginPercent: number | null;
  reprintCost: number;
  machineHours: number;
}

const DATE_RE = /^(\d{4}-\d{2})-\d{2}$/;

/** Soma os fechamentos por mês (pela data informada, sem fuso horário). */
export function summarizeByMonth(items: readonly ClosedItem[]): MonthSummary[] {
  const issues: Issue[] = [];
  items.forEach((item, i) => {
    if (!DATE_RE.test(item.closedOn)) {
      issues.push({
        field: `items[${i}].closedOn`,
        message: "precisa estar no formato AAAA-MM-DD",
      });
    }
  });
  throwIfIssues(issues);

  const byMonth = new Map<string, MonthSummary>();
  for (const { closedOn, result } of items) {
    const month = closedOn.slice(0, 7);
    const m = byMonth.get(month) ?? {
      month,
      items: 0,
      revenue: 0,
      fees: 0,
      estimatedProfit: 0,
      actualProfit: 0,
      profitDeviation: 0,
      actualMarginPercent: null,
      reprintCost: 0,
      machineHours: 0,
    };
    m.items += 1;
    m.revenue += result.revenue;
    m.fees += result.fees;
    m.estimatedProfit += result.estimatedProfit;
    m.actualProfit += result.actualProfit;
    m.reprintCost += result.actual.failure;
    m.machineHours += result.machineHours;
    byMonth.set(month, m);
  }

  return [...byMonth.values()]
    .map((m) => ({
      ...m,
      profitDeviation: m.actualProfit - m.estimatedProfit,
      actualMarginPercent: m.revenue > 0 ? (m.actualProfit / m.revenue) * 100 : null,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
