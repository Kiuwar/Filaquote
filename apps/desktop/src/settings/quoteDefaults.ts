/** Padrões dos orçamentos novos e do PDF. Nada vem preenchido: o usuário define. */
export interface QuoteDefaults {
  /** Prefixo da numeração, ex.: ORC → ORC-0007. */
  prefix: string;
  validDays: number | null;
  paymentTerms: string;
  leadTime: string;
  /** Logo do PDF (data URL), opcional. */
  logo: string | null;
  /** Modelo da mensagem de WhatsApp. Marcadores: {cliente}, {numero}, {total}, {validade}, {itens}. */
  whatsappTemplate: string;
}

export const QUOTE_DEFAULTS_KEY = "quoteDefaults";

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Olá{cliente}! Segue o orçamento {numero}:\n{itens}\nTotal: {total}\nVálido até {validade}.";

export function sanitizeQuoteDefaults(value: unknown): QuoteDefaults {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const str = (x: unknown, fallback = "") => (typeof x === "string" ? x : fallback);
  const days =
    typeof v.validDays === "number" && Number.isInteger(v.validDays) && v.validDays >= 0
      ? v.validDays
      : null;
  return {
    prefix: str(v.prefix, "ORC").trim() || "ORC",
    validDays: days,
    paymentTerms: str(v.paymentTerms),
    leadTime: str(v.leadTime),
    logo: typeof v.logo === "string" && v.logo.startsWith("data:image/") ? v.logo : null,
    whatsappTemplate:
      str(v.whatsappTemplate, DEFAULT_WHATSAPP_TEMPLATE) || DEFAULT_WHATSAPP_TEMPLATE,
  };
}
