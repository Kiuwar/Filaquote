import {
  closeItem,
  fitPlateModel,
  plateTotals,
  sampleFromClosure,
  type ActualJob,
  type CalibrationSample,
  type ClosureResult,
  type JobInput,
} from "@filaquote/engine";
import { resolveCostProfile } from "./profile";
import { totalJob, type QuoteItem } from "./quote";

/** Fechamento de um item entregue (função 1). Valores reais do item inteiro. */
export interface Closure {
  itemId: string;
  closedOn: string;
  actual: ActualJob;
  /** Valor recebido pelo item (todas as unidades). */
  revenue: number;
  fees: number;
  /** Impressão atípica: fica fora da calibração. */
  excluded: boolean;
}

/** A entrada estimada do item, como o motor de custo usou no orçamento. */
export function estimatedJob(item: QuoteItem): JobInput | null {
  if (item.plate?.enabled) {
    try {
      const t = plateTotals(fitPlateModel(item.plate.a, item.plate.b), item.quantity);
      return {
        grams: t.grams,
        purgeGrams: t.purgeGrams,
        printHours: t.printHours,
        prepMinutes: t.plates * (item.input.prepMinutes ?? 0),
        postMinutes: item.quantity * (item.input.postMinutes ?? 0),
        extras: item.input.extras.map((e) => ({
          label: e.label,
          amount: e.amount * item.quantity,
        })),
      };
    } catch {
      return null;
    }
  }
  const job = totalJob(item.input, item.quantity);
  return "job" in job ? job.job : null;
}

export function closureResult(item: QuoteItem, closure: Closure): ClosureResult | null {
  const profile = resolveCostProfile(item.snapshot);
  const job = estimatedJob(item);
  if (!profile.ok || !job) return null;
  return closeItem(profile.value, {
    revenue: closure.revenue,
    fees: closure.fees,
    estimated: job,
    actual: closure.actual,
  });
}

export function calibrationSample(item: QuoteItem, closure: Closure): CalibrationSample | null {
  const job = estimatedJob(item);
  if (!job) return null;
  return sampleFromClosure(
    item.id,
    { revenue: closure.revenue, fees: closure.fees, estimated: job, actual: closure.actual },
    closure.excluded,
  );
}
