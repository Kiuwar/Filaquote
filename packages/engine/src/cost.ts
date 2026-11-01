import {
  checkNonNegative,
  checkPercentBelow100,
  checkPositive,
  throwIfIssues,
  type Issue,
} from "./validation";

/**
 * Perfil de cálculo: uma "forma de calcular" salva pelo usuário. Nenhum valor tem
 * padrão no motor; tudo vem do perfil. Fórmulas em docs/motor-de-preco.md.
 */
export interface CostProfile {
  /** Preço do filamento (R$/kg). */
  filamentPricePerKg: number;
  /** Desperdício sobre o filamento (%): sobras de rolo, testes, limpeza do bico. */
  wastePercent: number;
  /** Potência média da impressora imprimindo (W). */
  printerWatts: number;
  /** Tarifa de energia (R$/kWh). */
  energyTariffPerKwh: number;
  /** Depreciação da impressora por hora de impressão (R$/h). Ver `depreciationPerHour`. */
  depreciationPerHour: number;
  /** Manutenção por hora de impressão (R$/h): bico, mesa, correias, lubrificação. */
  maintenancePerHour: number;
  /** Valor da hora de trabalho (R$/h). */
  laborPerHour: number;
  /** Taxa de falha (%) sobre o custo de produção (material + energia + máquina). */
  failurePercent: number;
  /** Calibração: multiplica o tempo do fatiador. 1 = sem ajuste. */
  timeFactor: number;
  /** Calibração: multiplica o tempo de pós-processamento estimado. 1 = sem ajuste. */
  postProcessingFactor: number;
}

export interface Extra {
  label: string;
  /** Valor em R$. */
  amount: number;
}

/** Uma impressão a orçar (todas as cópias somadas). */
export interface JobInput {
  /** Filamento da peça segundo o fatiador ou a estimativa (g). */
  grams: number;
  /** Purga de troca de cor (g), quando informada à parte. */
  purgeGrams?: number;
  /** Tempo de impressão segundo o fatiador (h), antes da calibração. */
  printHours: number;
  /** Preparo: fatiar, montar a mesa, retirar as peças (min). */
  prepMinutes: number;
  /** Pós-processamento: suportes, lixa, pintura, montagem (min), antes da calibração. */
  postMinutes: number;
  /** Embalagem, frete, insumos (cola, tinta, lixa) etc. */
  extras?: Extra[];
}

export interface CostBreakdown {
  material: number;
  energy: number;
  machine: number;
  labor: number;
  extras: number;
  failure: number;
  /** Material + energia + máquina: o que se perde quando uma impressão falha. */
  production: number;
  total: number;
  /** Horas de impressão após o fator de calibração. */
  effectiveHours: number;
  /** Filamento consumido, com purga e desperdício (g). */
  effectiveGrams: number;
  /** Minutos de trabalho (preparo + pós calibrado). */
  laborMinutes: number;
}

export function validateProfile(profile: CostProfile): Issue[] {
  const issues: Issue[] = [];
  checkNonNegative(issues, "filamentPricePerKg", profile.filamentPricePerKg);
  checkNonNegative(issues, "wastePercent", profile.wastePercent);
  checkNonNegative(issues, "printerWatts", profile.printerWatts);
  checkNonNegative(issues, "energyTariffPerKwh", profile.energyTariffPerKwh);
  checkNonNegative(issues, "depreciationPerHour", profile.depreciationPerHour);
  checkNonNegative(issues, "maintenancePerHour", profile.maintenancePerHour);
  checkNonNegative(issues, "laborPerHour", profile.laborPerHour);
  checkPercentBelow100(issues, "failurePercent", profile.failurePercent);
  checkPositive(issues, "timeFactor", profile.timeFactor);
  checkPositive(issues, "postProcessingFactor", profile.postProcessingFactor);
  return issues;
}

export function validateJob(job: JobInput): Issue[] {
  const issues: Issue[] = [];
  checkNonNegative(issues, "grams", job.grams);
  if (job.purgeGrams !== undefined) checkNonNegative(issues, "purgeGrams", job.purgeGrams);
  checkNonNegative(issues, "printHours", job.printHours);
  checkNonNegative(issues, "prepMinutes", job.prepMinutes);
  checkNonNegative(issues, "postMinutes", job.postMinutes);
  job.extras?.forEach((extra, i) => checkNonNegative(issues, `extras[${i}].amount`, extra.amount));
  return issues;
}

/** Depreciação por hora: (preço de compra − valor residual) ÷ vida útil em horas. */
export function depreciationPerHour(
  purchasePrice: number,
  residualValue: number,
  lifetimeHours: number,
): number {
  const issues: Issue[] = [];
  checkNonNegative(issues, "purchasePrice", purchasePrice);
  checkNonNegative(issues, "residualValue", residualValue);
  checkPositive(issues, "lifetimeHours", lifetimeHours);
  if (issues.length === 0 && residualValue > purchasePrice) {
    issues.push({ field: "residualValue", message: "não pode ser maior que o preço de compra" });
  }
  throwIfIssues(issues);
  return (purchasePrice - residualValue) / lifetimeHours;
}

/** Custo de produção (material, energia, máquina) de uma quantidade física. */
export function productionCost(
  profile: CostProfile,
  grams: number,
  hours: number,
): { material: number; energy: number; machine: number; total: number } {
  const material = (grams * profile.filamentPricePerKg) / 1000;
  const energy = (profile.printerWatts / 1000) * hours * profile.energyTariffPerKwh;
  const machine = hours * (profile.depreciationPerHour + profile.maintenancePerHour);
  return { material, energy, machine, total: material + energy + machine };
}

/**
 * Custo base de uma impressão.
 *
 * - material = (g + purga) × (1 + desperdício) × R$/kg ÷ 1000
 * - energia  = W ÷ 1000 × horas × R$/kWh
 * - máquina  = horas × (depreciação/h + manutenção/h)
 * - mão de obra = (preparo + pós × fator) ÷ 60 × R$/h
 * - falha    = (material + energia + máquina) × taxa de falha
 * - total    = material + energia + máquina + falha + mão de obra + extras
 *
 * "horas" já inclui o fator de calibração de tempo.
 */
export function costBreakdown(profile: CostProfile, job: JobInput): CostBreakdown {
  throwIfIssues([...validateProfile(profile), ...validateJob(job)]);

  const effectiveHours = job.printHours * profile.timeFactor;
  const effectiveGrams = (job.grams + (job.purgeGrams ?? 0)) * (1 + profile.wastePercent / 100);
  const prod = productionCost(profile, effectiveGrams, effectiveHours);
  const laborMinutes = job.prepMinutes + job.postMinutes * profile.postProcessingFactor;
  const labor = (laborMinutes / 60) * profile.laborPerHour;
  const extras = (job.extras ?? []).reduce((sum, e) => sum + e.amount, 0);
  const failure = prod.total * (profile.failurePercent / 100);

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

/** Rótulos e unidades dos campos do perfil, para a interface e comparações. */
export const PROFILE_FIELDS: Record<keyof CostProfile, { label: string; unit: string }> = {
  filamentPricePerKg: { label: "Preço do filamento", unit: "R$/kg" },
  wastePercent: { label: "Desperdício de filamento", unit: "%" },
  printerWatts: { label: "Potência da impressora", unit: "W" },
  energyTariffPerKwh: { label: "Tarifa de energia", unit: "R$/kWh" },
  depreciationPerHour: { label: "Depreciação", unit: "R$/h" },
  maintenancePerHour: { label: "Manutenção", unit: "R$/h" },
  laborPerHour: { label: "Valor da hora de trabalho", unit: "R$/h" },
  failurePercent: { label: "Taxa de falha", unit: "%" },
  timeFactor: { label: "Fator de tempo (calibração)", unit: "×" },
  postProcessingFactor: { label: "Fator de pós-processamento (calibração)", unit: "×" },
};
