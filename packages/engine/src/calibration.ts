// Função 2: calibração pelo histórico.
//
// Compara o estimado com o real dos pedidos fechados (função 1) e sugere ajustes no
// perfil de cálculo. Nunca aplica sozinho: o usuário aceita cada sugestão.

import type { ClosureInput, Reprint } from "./closure";
import { productionCost, validateProfile, type CostProfile } from "./cost";
import { throwIfIssues } from "./validation";

export interface CalibrationSample {
  /** Identificador do item fechado, para exibir e excluir. */
  id: string;
  /** Tempo do fatiador (h), sem fator. */
  slicerHours: number;
  actualHours?: number;
  /** Filamento do fatiador, com purga (g). */
  slicerGrams: number;
  weighedGrams?: number;
  /** Pós-processamento estimado (min), sem fator. */
  estimatedPostMinutes: number;
  actualPostMinutes?: number;
  reprints?: Reprint[];
  /** Impressão atípica (pausa, troca de bico, teste) marcada para não entrar na conta. */
  excluded?: boolean;
}

/** Converte um fechamento da função 1 em amostra de calibração. */
export function sampleFromClosure(
  id: string,
  closure: ClosureInput,
  excluded = false,
): CalibrationSample {
  return {
    id,
    slicerHours: closure.estimated.printHours,
    actualHours: closure.actual.printHours,
    slicerGrams: closure.estimated.grams + (closure.estimated.purgeGrams ?? 0),
    weighedGrams: closure.actual.weighedGrams,
    estimatedPostMinutes: closure.estimated.postMinutes,
    actualPostMinutes: closure.actual.postMinutes,
    reprints: closure.actual.reprints,
    excluded,
  };
}

export type CalibratedField =
  "timeFactor" | "postProcessingFactor" | "wastePercent" | "failurePercent";

export interface Suggestion {
  field: CalibratedField;
  current: number;
  /** Valor sugerido, ou `null` enquanto faltam amostras. */
  suggested: number | null;
  /** Amostras com o dado necessário. */
  samples: number;
  /** Quantas faltam para sugerir. */
  missingSamples: number;
  /** Menor e maior valor individual observado (fatores e percentuais). */
  range: [number, number] | null;
  /** Diferença sugerido − atual (mesma unidade do campo). */
  difference: number | null;
  /** Amostras suficientes e mudança acima do limiar. */
  worthApplying: boolean;
  note?: string;
}

export interface CalibrationOptions {
  /** Mínimo de amostras para sugerir. Padrão 5. */
  minSamples?: number;
  /** Mudança mínima em fatores, em % do valor atual. Padrão 2%. */
  minFactorChangePercent?: number;
  /** Mudança mínima em campos percentuais, em pontos percentuais. Padrão 1 p.p. */
  minPercentPointChange?: number;
}

export interface CalibrationResult {
  suggestions: Suggestion[];
  /** Amostras consideradas (não excluídas). */
  used: number;
  excluded: number;
}

/** Mediana: resistente a uma impressão fora da curva. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("mediana de lista vazia");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function rangeOf(values: readonly number[]): [number, number] | null {
  return values.length === 0 ? null : [Math.min(...values), Math.max(...values)];
}

export function suggestCalibration(
  profile: CostProfile,
  samples: readonly CalibrationSample[],
  options: CalibrationOptions = {},
): CalibrationResult {
  throwIfIssues(validateProfile(profile));
  const minSamples = options.minSamples ?? 5;
  const minFactorChange = (options.minFactorChangePercent ?? 2) / 100;
  const minPointChange = options.minPercentPointChange ?? 1;

  const used = samples.filter((s) => !s.excluded);

  const build = (
    field: CalibratedField,
    values: number[],
    suggestedFrom: (values: number[]) => number,
    isFactor: boolean,
  ): Suggestion => {
    const current = profile[field];
    const enough = values.length >= minSamples;
    const suggested = enough ? suggestedFrom(values) : null;
    const difference = suggested === null ? null : suggested - current;
    // Tolerância de arredondamento binário: uma mudança exatamente no limiar conta.
    const EPS = 1e-9;
    const significant =
      difference !== null &&
      (isFactor
        ? Math.abs(difference) / current >= minFactorChange - EPS
        : Math.abs(difference) >= minPointChange - EPS);
    return {
      field,
      current,
      suggested,
      samples: values.length,
      missingSamples: Math.max(0, minSamples - values.length),
      range: rangeOf(values),
      difference,
      worthApplying: significant,
    };
  };

  // Tempo: real ÷ fatiador, por impressão.
  const timeRatios = used
    .filter((s) => s.actualHours !== undefined && s.slicerHours > 0)
    .map((s) => s.actualHours! / s.slicerHours);
  const time = build("timeFactor", timeRatios, median, true);

  // Pós-processamento: real ÷ estimado.
  const postRatios = used
    .filter((s) => s.actualPostMinutes !== undefined && s.estimatedPostMinutes > 0)
    .map((s) => s.actualPostMinutes! / s.estimatedPostMinutes);
  const post = build("postProcessingFactor", postRatios, median, true);

  // Desperdício: quanto o peso pesado passa do fatiador, em %.
  const wasteValues = used
    .filter((s) => s.weighedGrams !== undefined && s.slicerGrams > 0)
    .map((s) => (s.weighedGrams! / s.slicerGrams - 1) * 100);
  const waste = build("wastePercent", wasteValues, (v) => Math.max(0, median(v)), false);
  if (waste.suggested === 0 && wasteValues.length >= minSamples && median(wasteValues) < 0) {
    waste.note = `O fatiador superestima o peso em ${Math.abs(median(wasteValues)).toFixed(1)}%; o desperdício sugerido fica em 0%.`;
  }

  // Falha: custo de produção perdido em reimpressões ÷ custo de produção entregue, somados.
  // Toda amostra conta (as sem reimpressão também), senão a taxa sairia inflada.
  const delivered = used.map(
    (s) =>
      productionCost(
        profile,
        s.weighedGrams ?? s.slicerGrams * (1 + profile.wastePercent / 100),
        s.actualHours ?? s.slicerHours * profile.timeFactor,
      ).total,
  );
  const lost = used.map((s) =>
    (s.reprints ?? []).reduce(
      (sum, r) => sum + productionCost(profile, r.grams, r.printHours).total,
      0,
    ),
  );
  const failureValues = used.map((_, i) =>
    delivered[i]! > 0 ? (lost[i]! / delivered[i]!) * 100 : 0,
  );
  const failure = build(
    "failurePercent",
    failureValues,
    () => {
      const totalDelivered = delivered.reduce((a, b) => a + b, 0);
      const totalLost = lost.reduce((a, b) => a + b, 0);
      const rate = totalDelivered > 0 ? (totalLost / totalDelivered) * 100 : 0;
      return Math.min(rate, 99);
    },
    false,
  );
  if (failure.suggested === 99) {
    failure.note = "As reimpressões custaram quase tanto quanto as entregas. Confira os registros.";
  }

  return {
    suggestions: [time, post, waste, failure],
    used: used.length,
    excluded: samples.length - used.length,
  };
}

/** Aplica só as sugestões aceitas pelo usuário. Devolve um novo perfil. */
export function applyCalibration(
  profile: CostProfile,
  suggestions: readonly Suggestion[],
  accepted: readonly CalibratedField[],
): CostProfile {
  const next = { ...profile };
  for (const s of suggestions) {
    if (accepted.includes(s.field) && s.suggested !== null) next[s.field] = s.suggested;
  }
  throwIfIssues(validateProfile(next));
  return next;
}
