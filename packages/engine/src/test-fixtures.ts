import type { CostProfile, JobInput } from "./cost";

// Valores fictícios, só para os testes conferirem as contas. Não são sugestão de preço.
export const PROFILE: CostProfile = {
  filamentPricePerKg: 120,
  wastePercent: 5,
  printerWatts: 150,
  energyTariffPerKwh: 0.9,
  depreciationPerHour: 1.5,
  maintenancePerHour: 0.5,
  laborPerHour: 30,
  failurePercent: 10,
  timeFactor: 1,
  postProcessingFactor: 1,
};

export const JOB: JobInput = {
  grams: 100,
  purgeGrams: 10,
  printHours: 4,
  prepMinutes: 10,
  postMinutes: 20,
  extras: [{ label: "Embalagem", amount: 2.5 }],
};
