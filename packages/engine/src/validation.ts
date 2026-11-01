export interface Issue {
  /** Campo com problema (caminho simples, ex.: "filamentPricePerKg"). */
  field: string;
  /** Mensagem em português, pronta para a interface. */
  message: string;
}

/** Erro de entrada inválida. `issues` lista todos os problemas encontrados. */
export class EngineInputError extends Error {
  readonly issues: Issue[];

  constructor(issues: Issue[]) {
    super(issues.map((i) => `${i.field}: ${i.message}`).join("; "));
    this.name = "EngineInputError";
    this.issues = issues;
  }
}

export function checkNonNegative(issues: Issue[], field: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ field, message: "precisa ser um número" });
  } else if (value < 0) {
    issues.push({ field, message: "não pode ser negativo" });
  }
}

export function checkPositive(issues: Issue[], field: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ field, message: "precisa ser um número" });
  } else if (value <= 0) {
    issues.push({ field, message: "precisa ser maior que zero" });
  }
}

/** Percentual em [0, 100). 100% tornaria divisões e taxas sem sentido. */
export function checkPercentBelow100(issues: Issue[], field: string, value: unknown): void {
  checkNonNegative(issues, field, value);
  if (typeof value === "number" && Number.isFinite(value) && value >= 100) {
    issues.push({ field, message: "precisa ser menor que 100%" });
  }
}

export function throwIfIssues(issues: Issue[]): void {
  if (issues.length > 0) throw new EngineInputError(issues);
}
