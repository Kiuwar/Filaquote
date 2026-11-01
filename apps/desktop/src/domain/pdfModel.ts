import { readableOn } from "../theme/color";
import { quoteCode, quoteTotals, type Quote, type QuoteItem } from "./quote";

/**
 * Tudo o que o PDF do cliente mostra. Montado só com campos públicos: custo interno,
 * margem, método de preço e perfil nunca entram aqui (o teste garante).
 */
export interface PdfModel {
  title: string;
  code: string;
  version: number;
  issuedOn: string;
  validUntil: string | null;
  clientName: string | null;
  logo: string | null;
  colors: { primary: string; onPrimary: string };
  showBreakdown: boolean;
  lines: Array<{
    name: string;
    quantity: number;
    finish: string;
    unitPrice: number | null;
    total: number | null;
  }>;
  total: number;
  paymentTerms: string;
  leadTime: string;
  notes: string;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const pdfMoney = (n: number) => brl.format(n);

export function pdfDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function buildPdfModel(input: {
  quote: Quote;
  items: readonly QuoteItem[];
  clientName: string | null;
  prefix: string;
  logo: string | null;
  primary: string;
  today: string;
}): PdfModel {
  const { quote, items } = input;
  return {
    title: "Orçamento",
    code: quoteCode(input.prefix, quote.number),
    version: quote.version,
    issuedOn: pdfDate(input.today),
    validUntil: quote.validUntil ? pdfDate(quote.validUntil) : null,
    clientName: input.clientName,
    logo: input.logo,
    colors: { primary: input.primary, onPrimary: readableOn(input.primary) },
    showBreakdown: quote.showBreakdown,
    lines: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      finish: i.finish,
      unitPrice: quote.showBreakdown ? i.unitPrice : null,
      total: quote.showBreakdown ? i.unitPrice * i.quantity : null,
    })),
    total: quoteTotals(items).price,
    paymentTerms: quote.paymentTerms,
    leadTime: quote.leadTime,
    notes: quote.notes,
  };
}

export function pdfFileName(model: PdfModel): string {
  const client = (model.clientName ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-");
  return `${model.code}-v${model.version}${client ? `-${client}` : ""}.pdf`.replace(/-+/g, "-");
}
