import { pdfMoney, type PdfModel } from "./pdfModel";

/**
 * Mensagem pronta para colar no WhatsApp. Marcadores do modelo:
 * {cliente}, {numero}, {total}, {validade}, {itens}, {prazo}, {pagamento}.
 */
export function buildWhatsappMessage(template: string, model: PdfModel): string {
  const items = model.lines
    .map(
      (l) =>
        `• ${l.quantity}× ${l.name}${l.finish ? ` (${l.finish})` : ""}${l.total !== null ? ` — ${pdfMoney(l.total)}` : ""}`,
    )
    .join("\n");
  const firstName = model.clientName?.trim().split(/\s+/)[0];
  const values: Record<string, string> = {
    cliente: firstName ? `, ${firstName}` : "",
    numero: `${model.code} (versão ${model.version})`,
    total: pdfMoney(model.total),
    validade: model.validUntil ?? "a combinar",
    itens: items,
    prazo: model.leadTime || "a combinar",
    pagamento: model.paymentTerms || "a combinar",
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match).trim();
}
