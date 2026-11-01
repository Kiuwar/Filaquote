import {
  compareWithSnapshot,
  costBreakdown,
  fitPlateModel,
  priceItem,
  quantityCost,
  quantityTiers,
  type CostBreakdown,
  type Extra,
  type JobInput,
  type PlateModel,
  type PlateSample,
  type PricingResult,
  type QuantityTiersResult,
  type StalenessResult,
  METHOD_LABELS,
} from "@filaquote/engine";
import { resolveCostProfile, type ProfileData } from "./profile";

export type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado" | "entregue";

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  entregue: "Entregue",
};

export type ItemSource = "manual" | "stl" | "3mf";

/** Entrada de um item: valores por unidade, mais o preparo do item inteiro. */
export interface ItemInput {
  grams: number | null;
  purgeGrams: number | null;
  printHours: number | null;
  postMinutes: number | null;
  /** Preparo do item (ou de cada mesa, quando o custo vem da mesa cheia). */
  prepMinutes: number | null;
  /** Extras por unidade: embalagem, insumos. */
  extras: Extra[];
}

/** Função 6: duas mesas fatiadas da mesma peça. */
export interface PlateData {
  a: PlateSample;
  b: PlateSample;
  /** Usar o modelo da mesa cheia para o custo do item. */
  enabled: boolean;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  position: number;
  name: string;
  quantity: number;
  finish: string;
  profileId: string | null;
  snapshot: ProfileData;
  input: ItemInput;
  source: ItemSource;
  plate: PlateData | null;
  /** Método ou faixa escolhida (`margin`, `recommended`…) ou `manual`. */
  method: string | null;
  targetPrice: number | null;
  unitPrice: number;
  unitCost: number;
  partId: string | null;
}

export interface Quote {
  id: string;
  number: number;
  version: number;
  clientId: string | null;
  status: QuoteStatus;
  validUntil: string | null;
  paymentTerms: string;
  leadTime: string;
  notes: string;
  showBreakdown: boolean;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  decidedAt: string | null;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

export function emptyItemInput(): ItemInput {
  return {
    grams: null,
    purgeGrams: null,
    printHours: null,
    postMinutes: 0,
    prepMinutes: 0,
    extras: [],
  };
}

const INPUT_LABELS: Record<"grams" | "printHours" | "postMinutes" | "prepMinutes", string> = {
  grams: "gramas por unidade",
  printHours: "tempo de impressão",
  postMinutes: "pós-processamento",
  prepMinutes: "preparo",
};

/** Entrada total (todas as unidades) para o motor, ou o que falta preencher. */
export function totalJob(
  input: ItemInput,
  quantity: number,
): { job: JobInput } | { missing: string[] } {
  const missing = (Object.keys(INPUT_LABELS) as Array<keyof typeof INPUT_LABELS>)
    .filter((k) => input[k] === null)
    .map((k) => INPUT_LABELS[k]);
  if (missing.length) return { missing };
  return {
    job: {
      grams: input.grams! * quantity,
      purgeGrams: (input.purgeGrams ?? 0) * quantity,
      printHours: input.printHours! * quantity,
      prepMinutes: input.prepMinutes!,
      postMinutes: input.postMinutes! * quantity,
      extras: input.extras.map((e) => ({ label: e.label, amount: e.amount * quantity })),
    },
  };
}

export interface ItemCalc {
  cost: CostBreakdown | null;
  pricing: PricingResult | null;
  plateModel: PlateModel | null;
  tiers: QuantityTiersResult | null;
  /** O que falta para calcular (perfil incompleto, entrada incompleta) ou erro do motor. */
  problems: string[];
}

/** Calcula custo, métodos de preço e (se houver) as faixas da mesa cheia de um item. */
export function calculateItem(item: QuoteItem): ItemCalc {
  const out: ItemCalc = { cost: null, pricing: null, plateModel: null, tiers: null, problems: [] };
  const profile = resolveCostProfile(item.snapshot);
  if (!profile.ok) out.problems.push(`Perfil a confirmar: ${profile.missing.join(", ")}`);

  try {
    if (item.plate) out.plateModel = fitPlateModel(item.plate.a, item.plate.b);
  } catch (err) {
    out.problems.push(`Mesa cheia: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!profile.ok) return out;

  try {
    if (item.plate?.enabled && out.plateModel) {
      const missing = [item.input.prepMinutes, item.input.postMinutes].some((v) => v === null);
      if (missing) {
        out.problems.push("Preencha preparo e pós-processamento.");
        return out;
      }
      out.cost = quantityCost(profile.value, out.plateModel, item.quantity, {
        prepMinutesPerPlate: item.input.prepMinutes!,
        postMinutesPerUnit: item.input.postMinutes!,
        extrasPerUnit: item.input.extras,
      }).cost;
    } else {
      const job = totalJob(item.input, item.quantity);
      if ("missing" in job) {
        out.problems.push(`Falta: ${job.missing.join(", ")}`);
        return out;
      }
      out.cost = costBreakdown(profile.value, job.job);
    }
    out.pricing = priceItem(
      { cost: out.cost, quantity: item.quantity, targetUnitPrice: item.targetPrice },
      item.snapshot.pricing,
    );
    if (out.plateModel && item.unitPrice > 0) {
      out.tiers = quantityTiers(profile.value, out.plateModel, {
        prepMinutesPerPlate: item.input.prepMinutes ?? 0,
        postMinutesPerUnit: item.input.postMinutes ?? 0,
        extrasPerUnit: item.input.extras,
        unitPrice: item.unitPrice,
        minMarginPercent: item.snapshot.pricing.minimumMarginPercent ?? 0,
      });
    }
  } catch (err) {
    out.problems.push(err instanceof Error ? err.message : String(err));
  }
  return out;
}

/** Função 4: o custo deste item mudaria com o perfil de hoje? */
export function itemStaleness(item: QuoteItem, current: ProfileData): StalenessResult | null {
  const then = resolveCostProfile(item.snapshot);
  const now = resolveCostProfile(current);
  const job = totalJob(item.input, item.quantity);
  if (!then.ok || !now.ok || "missing" in job || item.plate?.enabled) return null;
  return compareWithSnapshot(
    { profile: then.value, job: job.job, price: item.unitPrice * item.quantity },
    now.value,
  );
}

export function quoteCode(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(4, "0")}`;
}

export interface QuoteTotals {
  price: number;
  cost: number;
  profit: number;
  marginPercent: number | null;
}

export function quoteTotals(items: readonly QuoteItem[]): QuoteTotals {
  const price = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cost = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  return {
    price,
    cost,
    profit: price - cost,
    marginPercent: price > 0 ? ((price - cost) / price) * 100 : null,
  };
}

export const BAND_PREFIX = "faixa:";

/**
 * Recalcula custo e preço do item. Se o preço veio de um método ou faixa, acompanha a
 * nova conta; se foi digitado (`manual`), fica como está.
 */
export function syncItem(item: QuoteItem): { item: QuoteItem; calc: ItemCalc } {
  const calc = calculateItem(item);
  if (!calc.pricing)
    return { item: { ...item, unitCost: calc.cost ? calc.cost.total / item.quantity : 0 }, calc };
  let unitPrice = item.unitPrice;
  if (item.method?.startsWith(BAND_PREFIX)) {
    const band = calc.pricing.bands.find((b) => `${BAND_PREFIX}${b.id}` === item.method);
    if (band?.unitPrice != null) unitPrice = band.unitPrice;
  } else if (item.method && item.method !== "manual") {
    const method = calc.pricing.methods.find((m) => m.id === item.method);
    if (method?.unitPrice != null) unitPrice = method.unitPrice;
  }
  return { item: { ...item, unitCost: calc.pricing.unitCost, unitPrice }, calc };
}

export function methodLabel(method: string | null): string {
  if (!method) return "Sem preço";
  if (method === "manual") return "Preço digitado";
  if (method.startsWith(BAND_PREFIX)) {
    const id = method.slice(BAND_PREFIX.length);
    return (
      { minimum: "Faixa mínimo", recommended: "Faixa recomendado", premium: "Faixa premium" }[id] ??
      method
    );
  }
  return METHOD_LABELS[method as keyof typeof METHOD_LABELS] ?? method;
}
