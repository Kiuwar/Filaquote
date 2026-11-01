import {
  emptyPricingSettings,
  PROFILE_FIELDS,
  type CostProfile,
  type DiscountTier,
  type PricingSettings,
  type RoundingMode,
  type VolumeEstimateSettings,
} from "@filaquote/engine";

/** Campos do custo como o usuário preenche: vazio (`null`) = "a confirmar". */
export type CostFields = { [K in keyof CostProfile]: number | null };
export type VolumeFields = { [K in keyof VolumeEstimateSettings]: number | null };

export interface ProfileData {
  cost: CostFields;
  volume: VolumeFields;
  pricing: PricingSettings;
}

export interface Profile {
  id: string;
  name: string;
  isDefault: boolean;
  data: ProfileData;
  createdAt: string;
  updatedAt: string;
}

export const VOLUME_FIELDS: Record<
  keyof VolumeEstimateSettings,
  { label: string; unit: string; hint: string }
> = {
  densityGPerCm3: {
    label: "Densidade do filamento",
    unit: "g/cm³",
    hint: "Da ficha técnica do fabricante.",
  },
  infillPercent: { label: "Preenchimento", unit: "%", hint: "O mesmo usado no fatiador." },
  solidFraction: {
    label: "Fração maciça",
    unit: "0 a 1",
    hint: "Parte do volume que sai maciça (paredes, topo e fundo). Ajuste comparando com o fatiador.",
  },
  flowGramsPerHour: {
    label: "Vazão média",
    unit: "g/h",
    hint: "Gramas por hora que sua impressora imprime. Calibrável.",
  },
};

export function emptyProfileData(): ProfileData {
  return {
    cost: {
      filamentPricePerKg: null,
      wastePercent: null,
      printerWatts: null,
      energyTariffPerKwh: null,
      depreciationPerHour: null,
      maintenancePerHour: null,
      laborPerHour: null,
      failurePercent: null,
      // Fatores de calibração: 1 = sem ajuste (não é um preço, é a ausência de correção).
      timeFactor: 1,
      postProcessingFactor: 1,
    },
    volume: {
      densityGPerCm3: null,
      infillPercent: null,
      solidFraction: null,
      flowGramsPerHour: null,
    },
    pricing: emptyPricingSettings(),
  };
}

const ROUNDING: readonly RoundingMode[] = ["none", "up-0.10", "up-0.50", "up-1", "end-0.90"];
const RECOMMENDED = ["markup", "margin", "machineHour", "perGram", "marketplace"] as const;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Aceita qualquer valor (banco, backup) e devolve dados de perfil bem formados. */
export function sanitizeProfileData(value: unknown): ProfileData {
  const base = emptyProfileData();
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const cost = (v.cost ?? {}) as Record<string, unknown>;
  const volume = (v.volume ?? {}) as Record<string, unknown>;
  const pricing = (v.pricing ?? {}) as Record<string, unknown>;

  for (const key of Object.keys(base.cost) as Array<keyof CostFields>) {
    const n = num(cost[key]);
    base.cost[key] = n ?? base.cost[key];
  }
  for (const key of Object.keys(base.volume) as Array<keyof VolumeFields>) {
    base.volume[key] = num(volume[key]);
  }
  const p = base.pricing;
  for (const key of [
    "markupPercent",
    "marginPercent",
    "machineHourRate",
    "pricePerGram",
    "marketplaceFeePercent",
    "marketplaceFixedFee",
    "marketplaceShipping",
    "marketplaceMarginPercent",
    "minimumMarginPercent",
    "premiumPercent",
    "minimumUnitPrice",
  ] as const) {
    p[key] = num(pricing[key]);
  }
  if (Array.isArray(pricing.quantityTiers)) {
    p.quantityTiers = (pricing.quantityTiers as unknown[])
      .map((t) => t as Record<string, unknown>)
      .map((t): DiscountTier | null => {
        const minQuantity = num(t?.minQuantity);
        const discountPercent = num(t?.discountPercent);
        return minQuantity !== null && discountPercent !== null
          ? { minQuantity, discountPercent }
          : null;
      })
      .filter((t): t is DiscountTier => t !== null);
  }
  if (ROUNDING.includes(pricing.rounding as RoundingMode))
    p.rounding = pricing.rounding as RoundingMode;
  if (RECOMMENDED.includes(pricing.recommendedMethod as (typeof RECOMMENDED)[number])) {
    p.recommendedMethod = pricing.recommendedMethod as PricingSettings["recommendedMethod"];
  }
  return base;
}

export type Resolved<T> = { ok: true; value: T } | { ok: false; missing: string[] };

/** Perfil de custo completo para o motor, ou a lista do que falta preencher. */
export function resolveCostProfile(data: ProfileData): Resolved<CostProfile> {
  const missing = (Object.keys(data.cost) as Array<keyof CostFields>)
    .filter((k) => data.cost[k] === null)
    .map((k) => PROFILE_FIELDS[k].label);
  return missing.length > 0
    ? { ok: false, missing }
    : { ok: true, value: data.cost as CostProfile };
}

export function resolveVolumeSettings(data: ProfileData): Resolved<VolumeEstimateSettings> {
  const missing = (Object.keys(data.volume) as Array<keyof VolumeFields>)
    .filter((k) => data.volume[k] === null)
    .map((k) => VOLUME_FIELDS[k].label);
  return missing.length > 0
    ? { ok: false, missing }
    : { ok: true, value: data.volume as VolumeEstimateSettings };
}
