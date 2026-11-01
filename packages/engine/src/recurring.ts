// Função 4: peças recorrentes com preço sempre atual.
//
// A peça guarda as ENTRADAS (gramas, tempo, preparo, pós, extras), não o preço. Ao
// orçar de novo, ou ao aprovar um orçamento enviado há tempos, o motor recalcula com o
// perfil de hoje e mostra o que mudou desde o orçamento anterior.

import {
  costBreakdown,
  PROFILE_FIELDS,
  type CostBreakdown,
  type CostProfile,
  type JobInput,
} from "./cost";
import { checkNonNegative, throwIfIssues, type Issue } from "./validation";

/** O que foi gravado no orçamento anterior. */
export interface QuoteSnapshot {
  /** Perfil de cálculo usado na época. */
  profile: CostProfile;
  job: JobInput;
  /** Preço cobrado (R$). */
  price: number;
  /** Taxas sobre a venda (R$). */
  fees?: number;
}

export interface ProfileChange {
  field: keyof CostProfile;
  label: string;
  unit: string;
  before: number;
  after: number;
  /** Variação relativa (%), ou `null` se o valor anterior era zero. */
  changePercent: number | null;
}

/** Campos do perfil que mudaram, na ordem do perfil. */
export function profileChanges(before: CostProfile, after: CostProfile): ProfileChange[] {
  return (Object.keys(PROFILE_FIELDS) as Array<keyof CostProfile>)
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      field,
      label: PROFILE_FIELDS[field].label,
      unit: PROFILE_FIELDS[field].unit,
      before: before[field],
      after: after[field],
      changePercent: before[field] !== 0 ? (after[field] / before[field] - 1) * 100 : null,
    }));
}

export interface StalenessResult {
  costThen: CostBreakdown;
  costNow: CostBreakdown;
  /** Custo de hoje − custo da época (R$). */
  costDelta: number;
  /** Variação do custo (%), ou `null` se o custo da época era zero. */
  costDeltaPercent: number | null;
  /** Margem do preço cobrado com o custo da época e com o de hoje (%). */
  marginThenPercent: number | null;
  marginNowPercent: number | null;
  /** Preço que devolve a margem da época com o custo de hoje. */
  priceToKeepMargin: number | null;
  changes: ProfileChange[];
  /** O custo mudou pelo menos o limiar (padrão 1%). */
  stale: boolean;
}

/**
 * Compara um orçamento anterior com o custo de hoje.
 * Margem = (preço − taxas − custo) ÷ preço.
 */
export function compareWithSnapshot(
  snapshot: QuoteSnapshot,
  current: CostProfile,
  options: { thresholdPercent?: number } = {},
): StalenessResult {
  const issues: Issue[] = [];
  checkNonNegative(issues, "price", snapshot.price);
  if (snapshot.fees !== undefined) checkNonNegative(issues, "fees", snapshot.fees);
  const threshold = options.thresholdPercent ?? 1;
  checkNonNegative(issues, "thresholdPercent", threshold);
  throwIfIssues(issues);

  const costThen = costBreakdown(snapshot.profile, snapshot.job);
  const costNow = costBreakdown(current, snapshot.job);
  const fees = snapshot.fees ?? 0;
  const costDelta = costNow.total - costThen.total;
  const costDeltaPercent = costThen.total > 0 ? (costDelta / costThen.total) * 100 : null;

  const margin = (cost: number) =>
    snapshot.price > 0 ? ((snapshot.price - fees - cost) / snapshot.price) * 100 : null;
  const marginThenPercent = margin(costThen.total);
  const marginNowPercent = margin(costNow.total);
  const priceToKeepMargin =
    marginThenPercent !== null && marginThenPercent < 100
      ? (costNow.total + fees) / (1 - marginThenPercent / 100)
      : null;

  const stale =
    costDeltaPercent === null ? costDelta !== 0 : Math.abs(costDeltaPercent) >= threshold;

  return {
    costThen,
    costNow,
    costDelta,
    costDeltaPercent,
    marginThenPercent,
    marginNowPercent,
    priceToKeepMargin,
    changes: profileChanges(snapshot.profile, current),
    stale,
  };
}
